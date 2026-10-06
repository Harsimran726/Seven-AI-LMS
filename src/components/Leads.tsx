import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Plus, X, Trash2, Mail, Phone, User, Calendar, Clock, 
  TrendingUp, BarChart3, Filter, CheckCircle2, AlertCircle, 
  Sparkles, Share2, MessageSquare, Search, Edit3, Layers, 
  Award, ArrowUpRight, CheckSquare, Target, Megaphone
} from 'lucide-react';
import { format, isBefore, isToday, parseISO } from 'date-fns';
import { COURSES, LEAD_STATUSES, LEAD_HANDLERS, LEAD_SOURCES } from '../lib/constants';
import { Lead, FollowUpRecord } from '../types';

const Leads: React.FC = () => {
  const { leads } = useData();
  const { user } = useAuth();
  
  // View state: 'table' or 'analytics'
  const [activeTab, setActiveTab] = useState<'table' | 'analytics'>('table');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  // Selected lead for Follow-Up management modal
  const [selectedFollowUpLead, setSelectedFollowUpLead] = useState<Lead | null>(null);
  
  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    work: '',
    studyClass: '',
    institution: '',
    address: '',
    courseInterest: COURSES[0] || '',
    status: 'Intersted',
    handleBy: LEAD_HANDLERS[0] || '',
    source: LEAD_SOURCES[0] || ''
  });
  
  // New Follow Up Modal Form
  const [followUpNote, setFollowUpNote] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  
  // Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterHandler, setFilterHandler] = useState<string>('ALL');
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterCourse, setFilterCourse] = useState<string>('ALL');

  const [submitting, setSubmitting] = useState(false);

  // Open Form for Create
  const handleOpenCreateForm = () => {
    setEditingLead(null);
    setFormData({
      name: '',
      email: '',
      mobile: '',
      work: '',
      studyClass: '',
      institution: '',
      address: '',
      courseInterest: COURSES[0] || '',
      status: 'Intersted',
      handleBy: LEAD_HANDLERS[0] || 'Jagdeep Kaur',
      source: LEAD_SOURCES[0] || 'advertisement'
    });
    setShowForm(true);
  };

  // Open Form for Edit
  const handleOpenEditForm = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name || '',
      email: lead.email || '',
      mobile: lead.mobile || '',
      work: lead.work || '',
      studyClass: lead.studyClass || '',
      institution: lead.institution || '',
      address: lead.address || '',
      courseInterest: lead.courseInterest || COURSES[0],
      status: lead.status || 'Intersted',
      handleBy: lead.handleBy || LEAD_HANDLERS[0],
      source: lead.source || LEAD_SOURCES[0]
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      if (editingLead) {
        // Update existing lead
        await updateDoc(doc(db, 'leads', editingLead.id), {
          name: formData.name,
          email: formData.email,
          mobile: formData.mobile,
          work: formData.work,
          studyClass: formData.studyClass,
          institution: formData.institution,
          address: formData.address,
          courseInterest: formData.courseInterest,
          status: formData.status,
          handleBy: formData.handleBy,
          source: formData.source,
          updatedAt: Date.now()
        });
      } else {
        // Create new lead
        const payload: Partial<Lead> = {
          instituteId: 'SevenAI',
          name: formData.name,
          email: formData.email,
          mobile: formData.mobile,
          work: formData.work || '',
          studyClass: formData.studyClass || '',
          institution: formData.institution || '',
          address: formData.address || '',
          courseInterest: formData.courseInterest,
          status: formData.status,
          handleBy: formData.handleBy,
          source: formData.source,
          followUps: [],
          followUpCount: 0,
          createdAt: Date.now()
        };
        const docRef = doc(collection(db, 'leads'));
        await setDoc(docRef, payload);
      }
      setShowForm(false);
      setEditingLead(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'leads');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await deleteDoc(doc(db, 'leads', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'leads');
    }
  };

  // Direct status update from table dropdown
  const handleQuickStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), { 
        status: newStatus,
        updatedAt: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'leads');
    }
  };

  // Direct handleBy update from table dropdown
  const handleQuickHandlerChange = async (leadId: string, newHandler: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), { 
        handleBy: newHandler,
        updatedAt: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'leads');
    }
  };

  // Log a new Follow-up
  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUpLead || !followUpNote.trim()) return;

    const currentFollowUps = selectedFollowUpLead.followUps || [];
    const currentCount = currentFollowUps.length;

    if (currentCount >= 5) {
      alert('Maximum 5 follow-ups reached for this lead as per follow-up policy.');
      return;
    }

    const nextCount = currentCount + 1;
    // Follow-ups 1-3: First 2 weeks, Follow-ups 4-5: Late Month Batch Update
    const stage = nextCount <= 3 ? 'First 2 Weeks' : 'Late Month Batch Update';

    const newRecord: FollowUpRecord = {
      id: 'fu_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      notes: followUpNote.trim(),
      countNumber: nextCount,
      stage,
      createdAt: Date.now(),
      by: user?.displayName || user?.email || 'Staff'
    };

    const updatedFollowUps = [...currentFollowUps, newRecord];

    try {
      const updateData: any = {
        followUps: updatedFollowUps,
        followUpCount: updatedFollowUps.length,
        nextFollowUpDate: nextFollowUpDate || null,
        updatedAt: Date.now()
      };

      // If lead status is 'Intersted', automatically transition to 'Follow up' if not yet converted
      if (selectedFollowUpLead.status === 'Intersted') {
        updateData.status = 'Follow up';
      }

      await updateDoc(doc(db, 'leads', selectedFollowUpLead.id), updateData);
      
      // Update local modal state
      setSelectedFollowUpLead({
        ...selectedFollowUpLead,
        ...updateData
      });

      setFollowUpNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'leads');
    }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm ||
        (lead.name && lead.name.toLowerCase().includes(query)) ||
        (lead.mobile && lead.mobile.includes(query)) ||
        (lead.email && lead.email.toLowerCase().includes(query)) ||
        (lead.institution && lead.institution.toLowerCase().includes(query));

      const matchesStatus = filterStatus === 'ALL' || lead.status === filterStatus;
      const matchesHandler = filterHandler === 'ALL' || lead.handleBy === filterHandler;
      const matchesSource = filterSource === 'ALL' || lead.source === filterSource;
      const matchesCourse = filterCourse === 'ALL' || lead.courseInterest === filterCourse;

      return matchesSearch && matchesStatus && matchesHandler && matchesSource && matchesCourse;
    });
  }, [leads, searchTerm, filterStatus, filterHandler, filterSource, filterCourse]);

  // Analytics Computation
  const analytics = useMemo(() => {
    const totalLeads = leads.length;
    const successCount = leads.filter(l => l.status === 'Sucess').length;
    const conversionRate = totalLeads > 0 ? ((successCount / totalLeads) * 100).toFixed(1) : '0';
    
    const activeFollowUpsCount = leads.filter(l => 
      ['Intersted', 'Follow up', 'Demo Pending', 'Admission Follow Up'].includes(l.status || '')
    ).length;

    const demoPendingCount = leads.filter(l => l.status === 'Demo Pending').length;
    const demoCompletedCount = leads.filter(l => l.status === 'Demo Completed').length;
    const cancelledCount = leads.filter(l => l.status === 'Cancelled' || l.status === 'Not Intersted').length;

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    LEAD_STATUSES.forEach(st => { statusCounts[st] = 0; });
    leads.forEach(l => {
      const st = l.status || 'Intersted';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    // Handler breakdown
    const handlerStats: Record<string, { total: number; success: number; active: number }> = {};
    LEAD_HANDLERS.forEach(h => {
      handlerStats[h] = { total: 0, success: 0, active: 0 };
    });
    leads.forEach(l => {
      const handler = l.handleBy || 'Unassigned';
      if (!handlerStats[handler]) {
        handlerStats[handler] = { total: 0, success: 0, active: 0 };
      }
      handlerStats[handler].total += 1;
      if (l.status === 'Sucess') {
        handlerStats[handler].success += 1;
      }
      if (['Intersted', 'Follow up', 'Demo Pending', 'Admission Follow Up'].includes(l.status || '')) {
        handlerStats[handler].active += 1;
      }
    });

    // Source breakdown
    const sourceStats: Record<string, { total: number; success: number }> = {};
    LEAD_SOURCES.forEach(s => {
      sourceStats[s] = { total: 0, success: 0 };
    });
    leads.forEach(l => {
      const src = l.source || 'Other';
      if (!sourceStats[src]) {
        sourceStats[src] = { total: 0, success: 0 };
      }
      sourceStats[src].total += 1;
      if (l.status === 'Sucess') {
        sourceStats[src].success += 1;
      }
    });

    // Follow-up Stage Compliance
    const followUpDistribution = {
      zero: leads.filter(l => !l.followUpCount || l.followUpCount === 0).length,
      stage1: leads.filter(l => (l.followUpCount || 0) >= 1 && (l.followUpCount || 0) <= 3).length, // 1 to 3
      stage2: leads.filter(l => (l.followUpCount || 0) >= 4).length // 4 to 5
    };

    // Follow-up due today or overdue
    const todayStr = new Date().toISOString().split('T')[0];
    const dueFollowUps = leads.filter(l => {
      if (!l.nextFollowUpDate) return false;
      if (['Sucess', 'Cancelled', 'Not Intersted'].includes(l.status || '')) return false;
      return l.nextFollowUpDate <= todayStr;
    });

    return {
      totalLeads,
      successCount,
      conversionRate,
      activeFollowUpsCount,
      demoPendingCount,
      demoCompletedCount,
      cancelledCount,
      statusCounts,
      handlerStats,
      sourceStats,
      followUpDistribution,
      dueFollowUps
    };
  }, [leads]);

  // Helper for status badge styling
  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'Intersted':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'Not Intersted':
        return 'bg-slate-100 border-slate-200 text-slate-600';
      case 'Follow up':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'Demo Pending':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'Demo Completed':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'Admission Follow Up':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'Cancelled':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'Sucess':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & View Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Leads Collection & Analytics</h2>
          <p className="text-slate-500 text-sm mt-1">Track visitor enquiries, follow-up schedules, handler performance & source attribution</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200">
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'table'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} /> ALL LEADS ({leads.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 size={14} /> ANALYTICS DASHBOARD
            </button>
          </div>

          <button 
            onClick={handleOpenCreateForm}
            className="bg-indigo-600 text-white text-xs font-bold rounded shadow hover:bg-indigo-700 transition px-4 py-2.5 uppercase tracking-wide flex items-center justify-center gap-2"
          >
            <Plus size={16} /> NEW ENQUIRY
          </button>
        </div>
      </div>

      {/* NEW/EDIT LEAD FORM MODAL / PANEL */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg transition-all animate-fadeIn">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <User size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">{editingLead ? 'Edit Lead Record' : 'Add New Lead Enquiry'}</h3>
                <p className="text-xs text-slate-500">Fill in visitor details, interest, assigned handler, and marketing source</p>
              </div>
            </div>
            <button 
              onClick={() => setShowForm(false)} 
              className="uppercase tracking-widest text-slate-400 hover:text-rose-500 text-[10px] font-bold flex items-center gap-1 transition-colors"
            >
              CLOSE <X size={14}/>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Full Name *</label>
              <input 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. Rahul Sharma"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Mobile Number *</label>
              <input 
                required 
                type="tel" 
                value={formData.mobile} 
                onChange={e => setFormData({...formData, mobile: e.target.value})} 
                placeholder="e.g. 9876543210"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
              <input 
                type="email" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="e.g. rahul@gmail.com"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Course Interest *</label>
              <select 
                value={formData.courseInterest} 
                onChange={e => setFormData({...formData, courseInterest: e.target.value})} 
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700 font-medium"
              >
                {COURSES.map(course => <option key={course} value={course}>{course}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Status *</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value})} 
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700 font-bold"
              >
                {LEAD_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Handle By (Assigned Staff) *</label>
              <select 
                value={formData.handleBy} 
                onChange={e => setFormData({...formData, handleBy: e.target.value})} 
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700 font-medium"
              >
                {LEAD_HANDLERS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Lead Source (How Lead Came) *</label>
              <select 
                value={formData.source} 
                onChange={e => setFormData({...formData, source: e.target.value})} 
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700 font-medium"
              >
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Class / Study Stage</label>
              <input 
                value={formData.studyClass} 
                onChange={e => setFormData({...formData, studyClass: e.target.value})} 
                placeholder="e.g. 12th Standard / B.Tech CSE"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">School / College Name</label>
              <input 
                value={formData.institution} 
                onChange={e => setFormData({...formData, institution: e.target.value})} 
                placeholder="e.g. St. Xavier School / PCTE"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Work / Occupation</label>
              <input 
                value={formData.work} 
                onChange={e => setFormData({...formData, work: e.target.value})} 
                placeholder="e.g. Student / Job Seeker / Business"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Address / Location</label>
              <input 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
                placeholder="e.g. Model Town, Ludhiana"
                className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
              />
            </div>

            <div className="md:col-span-3 pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button 
                disabled={submitting} 
                type="submit" 
                className="bg-slate-900 text-white font-bold text-xs uppercase tracking-widest py-2.5 px-8 rounded-lg shadow hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'SAVING...' : editingLead ? 'UPDATE LEAD' : 'SAVE LEAD'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ANALYTICS DASHBOARD TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Key Performance Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Leads</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{analytics.totalLeads}</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">100%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-between bg-gradient-to-br from-emerald-50/50 to-white">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Conversions (Success)</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-700">{analytics.successCount}</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">{analytics.conversionRate}%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col justify-between bg-gradient-to-br from-amber-50/50 to-white">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Active Follow-Ups</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-700">{analytics.activeFollowUpsCount}</span>
                <span className="text-xs text-amber-600 font-medium">In Pipeline</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex flex-col justify-between bg-gradient-to-br from-indigo-50/50 to-white">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Demo Stage</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-700">{analytics.demoPendingCount + analytics.demoCompletedCount}</span>
                <span className="text-[11px] text-indigo-600 font-bold">{analytics.demoPendingCount} Pend / {analytics.demoCompletedCount} Done</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex flex-col justify-between bg-gradient-to-br from-rose-50/50 to-white">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Cancelled / Lost</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-700">{analytics.cancelledCount}</span>
                <span className="text-xs text-rose-500 font-medium">
                  {analytics.totalLeads > 0 ? ((analytics.cancelledCount / analytics.totalLeads) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-between bg-gradient-to-br from-blue-50/50 to-white">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Due Follow-Ups</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-2xl font-black ${analytics.dueFollowUps.length > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {analytics.dueFollowUps.length}
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">Action Today</span>
              </div>
            </div>
          </div>

          {/* Section 1: Handler Performance & Source Attribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Handled By Performance */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Lead Distribution & Conversions by Handler</h3>
                    <p className="text-xs text-slate-500">Salesman & team performance tracking</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {LEAD_HANDLERS.map(handler => {
                  const stat = analytics.handlerStats[handler] || { total: 0, success: 0, active: 0 };
                  const rate = stat.total > 0 ? ((stat.success / stat.total) * 100).toFixed(0) : '0';
                  const percentOfTotal = analytics.totalLeads > 0 ? ((stat.total / analytics.totalLeads) * 100).toFixed(0) : '0';

                  return (
                    <div key={handler} className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{handler}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{stat.total} Leads ({percentOfTotal}%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{stat.active} Active</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">{stat.success} Success ({rate}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-emerald-500 h-full" 
                          style={{ width: `${stat.total > 0 ? (stat.success / stat.total) * 100 : 0}%` }}
                          title={`Success: ${stat.success}`}
                        />
                        <div 
                          className="bg-amber-400 h-full" 
                          style={{ width: `${stat.total > 0 ? (stat.active / stat.total) * 100 : 0}%` }}
                          title={`Active: ${stat.active}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source Attribution (How Lead Came) */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Lead Source Attribution (How Lead Came)</h3>
                    <p className="text-xs text-slate-500">Marketing & acquisition channel efficiency</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {LEAD_SOURCES.map(source => {
                  const stat = analytics.sourceStats[source] || { total: 0, success: 0 };
                  const rate = stat.total > 0 ? ((stat.success / stat.total) * 100).toFixed(0) : '0';
                  const share = analytics.totalLeads > 0 ? ((stat.total / analytics.totalLeads) * 100).toFixed(0) : '0';

                  return (
                    <div key={source} className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-800 capitalize">{source}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{stat.total} Enquiries ({share}%)</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">{stat.success} Won ({rate}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-600 h-full rounded-full" 
                          style={{ width: `${analytics.totalLeads > 0 ? (stat.total / analytics.totalLeads) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Status Breakdown & Follow-Up System Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Full Status Breakdown */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Target size={18} className="text-indigo-600" /> Lead Pipeline by Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {LEAD_STATUSES.map(st => {
                  const count = analytics.statusCounts[st] || 0;
                  const percent = analytics.totalLeads > 0 ? ((count / analytics.totalLeads) * 100).toFixed(1) : '0';

                  return (
                    <div key={st} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex flex-col justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded self-start border ${getStatusBadgeClass(st)}`}>
                        {st}
                      </span>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-xl font-bold text-slate-800">{count}</span>
                        <span className="text-xs text-slate-400 font-medium">{percent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Follow-Up Compliance & Schedule Guidance */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <Clock size={18} className="text-amber-500" /> Follow-Up Policy Compliance
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Policy rule: Up to 5 follow-ups maximum (3 in first 2 weeks + 2 in last 2 weeks of the month for batch updates).
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-blue-900">Stage 1: First 2 Weeks (1 - 3 Follow-ups)</p>
                      <p className="text-[11px] text-blue-700">Initial engagement & demo booking</p>
                    </div>
                    <span className="text-lg font-bold text-blue-900">{analytics.followUpDistribution.stage1} Leads</span>
                  </div>

                  <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-purple-900">Stage 2: Late Month Batch Update (4 - 5 Follow-ups)</p>
                      <p className="text-[11px] text-purple-700">Final push for upcoming batch seats</p>
                    </div>
                    <span className="text-lg font-bold text-purple-900">{analytics.followUpDistribution.stage2} Leads</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Not Followed Up Yet (0 Touches)</p>
                      <p className="text-[11px] text-slate-500">Fresh leads requiring initial call</p>
                    </div>
                    <span className="text-lg font-bold text-slate-700">{analytics.followUpDistribution.zero} Leads</span>
                  </div>
                </div>
              </div>

              {analytics.dueFollowUps.length > 0 && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-800 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle size={16} className="text-rose-600" />
                    {analytics.dueFollowUps.length} leads have follow-up scheduled for today or overdue!
                  </span>
                  <button 
                    onClick={() => {
                      setActiveTab('table');
                      setFilterStatus('Follow up');
                    }}
                    className="underline text-rose-900 font-bold uppercase text-[10px]"
                  >
                    View Due Leads
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ALL LEADS TABLE VIEW */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          {/* Filters & Search Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search name, phone, email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses ({leads.length})</option>
                {LEAD_STATUSES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* Handler Filter */}
              <select
                value={filterHandler}
                onChange={e => setFilterHandler(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Handlers</option>
                {LEAD_HANDLERS.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>

              {/* Source Filter */}
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Sources</option>
                {LEAD_SOURCES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Reset Filters */}
              {(filterStatus !== 'ALL' || filterHandler !== 'ALL' || filterSource !== 'ALL' || searchTerm !== '') && (
                <button
                  onClick={() => {
                    setFilterStatus('ALL');
                    setFilterHandler('ALL');
                    setFilterSource('ALL');
                    setSearchTerm('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Enquiry Date</th>
                    <th className="px-5 py-3.5">Visitor Contact Details</th>
                    <th className="px-5 py-3.5">Course & Source</th>
                    <th className="px-5 py-3.5">Handled By</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Follow-Up Progress</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map(lead => {
                    const followUpsCount = lead.followUps?.length || 0;

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Date */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800">{format(new Date(lead.createdAt), 'MMM dd, yyyy')}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{format(new Date(lead.createdAt), 'hh:mm a')}</p>
                        </td>

                        {/* Contact */}
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900 text-sm">{lead.name || 'Unnamed Visitor'}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-slate-700 font-semibold flex items-center gap-1">
                              <Phone size={12} className="text-slate-400" /> {lead.mobile}
                            </span>
                            {lead.email && (
                              <span className="text-slate-500 flex items-center gap-1">
                                <Mail size={12} className="text-slate-400" /> {lead.email}
                              </span>
                            )}
                          </div>
                          {(lead.studyClass || lead.institution) && (
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              {lead.studyClass} {lead.institution ? `@ ${lead.institution}` : ''}
                            </p>
                          )}
                        </td>

                        {/* Course & Source */}
                        <td className="px-5 py-4">
                          <span className="bg-indigo-50 text-indigo-700 py-1 px-2.5 rounded-md font-bold text-[10px] uppercase tracking-wider block w-fit">
                            {lead.courseInterest || 'General'}
                          </span>
                          <span className="text-[10px] text-purple-700 font-semibold mt-1 flex items-center gap-1 capitalize">
                            <Megaphone size={11} className="text-purple-500" /> {lead.source || 'advertisement'}
                          </span>
                        </td>

                        {/* Handled By */}
                        <td className="px-5 py-4">
                          <select
                            value={lead.handleBy || LEAD_HANDLERS[0]}
                            onChange={(e) => handleQuickHandlerChange(lead.id, e.target.value)}
                            className="bg-slate-50 hover:bg-white border border-slate-200 text-slate-800 font-bold text-xs py-1 px-2 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                          >
                            {LEAD_HANDLERS.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <select
                            value={lead.status || 'Intersted'}
                            onChange={(e) => handleQuickStatusChange(lead.id, e.target.value)}
                            className={`text-xs font-bold uppercase tracking-wider py-1 px-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${getStatusBadgeClass(lead.status)}`}
                          >
                            {LEAD_STATUSES.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </td>

                        {/* Follow Up Progress System */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setSelectedFollowUpLead(lead)}
                            className="group flex flex-col items-start gap-1 p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition text-left"
                          >
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 group-hover:text-indigo-700">
                              <Calendar size={13} className="text-indigo-600" />
                              <span>{followUpsCount} / 5 Touches</span>
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-extrabold ml-1">
                                LOG +
                              </span>
                            </div>
                            {lead.nextFollowUpDate ? (
                              <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                                Next: {lead.nextFollowUpDate}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Set next date</span>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenEditForm(lead)} 
                              title="Edit Lead"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button 
                              onClick={() => handleDelete(lead.id)} 
                              title="Delete Lead"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No leads matched your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FOLLOW-UP MANAGEMENT MODAL */}
      {selectedFollowUpLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    {selectedFollowUpLead.courseInterest}
                  </span>
                  <span className="text-xs bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded font-bold uppercase">
                    Handled by: {selectedFollowUpLead.handleBy || 'Unassigned'}
                  </span>
                </div>
                <h3 className="text-xl font-bold mt-2">{selectedFollowUpLead.name || 'Unnamed Lead'}</h3>
                <p className="text-xs text-slate-300 flex items-center gap-3 mt-1">
                  <span><Phone size={12} className="inline mr-1" />{selectedFollowUpLead.mobile}</span>
                  {selectedFollowUpLead.email && <span><Mail size={12} className="inline mr-1" />{selectedFollowUpLead.email}</span>}
                </p>
              </div>

              <button 
                onClick={() => setSelectedFollowUpLead(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Policy & Progress Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-slate-700">Follow-Up Policy Schedule (Max 5 Touches)</span>
                  <span className="text-indigo-600">{selectedFollowUpLead.followUpCount || 0} / 5 Completed</span>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex mb-3">
                  {[1, 2, 3, 4, 5].map((step) => {
                    const isDone = (selectedFollowUpLead.followUpCount || 0) >= step;
                    return (
                      <div 
                        key={step} 
                        className={`flex-1 border-r border-white/50 h-full ${
                          isDone ? (step <= 3 ? 'bg-indigo-600' : 'bg-purple-600') : 'bg-slate-200'
                        }`}
                      />
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded bg-indigo-50 border border-indigo-100 text-indigo-900 font-semibold">
                    💡 <strong>First 2 Weeks (Touches 1-3):</strong> Initial contact, course syllabus discussion, demo invitation.
                  </div>
                  <div className="p-2 rounded bg-purple-50 border border-purple-100 text-purple-900 font-semibold">
                    🚀 <strong>Late Month (Touches 4-5):</strong> Batch start updates & seat confirmation urgency.
                  </div>
                </div>
              </div>

              {/* Log New Follow Up Form */}
              {(selectedFollowUpLead.followUpCount || 0) < 5 ? (
                <form onSubmit={handleAddFollowUp} className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus size={14} className="text-indigo-600" /> 
                      Log Follow-Up #{(selectedFollowUpLead.followUpCount || 0) + 1}
                    </h4>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      {(selectedFollowUpLead.followUpCount || 0) + 1 <= 3 ? 'Stage 1: First 2 Weeks' : 'Stage 2: Batch Update'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Follow-Up Remarks / Feedback *</label>
                    <textarea 
                      required
                      rows={2}
                      value={followUpNote}
                      onChange={e => setFollowUpNote(e.target.value)}
                      placeholder="e.g. Student interested in weekend batch. Scheduled demo call for Friday."
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Next Follow-Up Date</label>
                      <input 
                        type="date" 
                        value={nextFollowUpDate}
                        onChange={e => setNextFollowUpDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-lg shadow hover:bg-indigo-700 transition"
                    >
                      LOG FOLLOW-UP RECORD
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-bold text-center">
                  Maximum 5 follow-up touchpoints recorded. Update final outcome below.
                </div>
              )}

              {/* Quick Status Update Buttons */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Update Outcome / Status</span>
                <div className="flex flex-wrap gap-2">
                  {LEAD_STATUSES.map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleQuickStatusChange(selectedFollowUpLead.id, st)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                        selectedFollowUpLead.status === st 
                          ? 'ring-2 ring-indigo-600 shadow-sm' 
                          : 'opacity-80 hover:opacity-100'
                      } ${getStatusBadgeClass(st)}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Follow-Up History Timeline */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Follow-Up History Log</h4>

                {selectedFollowUpLead.followUps && selectedFollowUpLead.followUps.length > 0 ? (
                  <div className="space-y-2 border-l-2 border-indigo-200 ml-2 pl-4">
                    {selectedFollowUpLead.followUps.map((record, index) => (
                      <div key={record.id || index} className="bg-slate-50 p-3 rounded-lg border border-slate-100 relative">
                        <div className="absolute -left-[21px] top-3.5 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span className="font-bold text-indigo-900">
                            Touchpoint #{record.countNumber || index + 1} ({record.stage || 'First 2 Weeks'})
                          </span>
                          <span className="font-semibold text-slate-400">{record.date}</span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium">{record.notes}</p>
                        {record.by && <p className="text-[10px] text-slate-400 mt-1">Logged by: {record.by}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No follow-ups recorded yet for this lead.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setSelectedFollowUpLead(null)}
                className="bg-slate-900 text-white font-bold text-xs uppercase px-5 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
