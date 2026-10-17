import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format, parseISO, isWithinInterval, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { 
  CheckCircle2, Trash2, UserCheck, Wallet, Receipt, 
  BarChart3, Calendar, Search, Filter, AlertCircle, ArrowUpRight,
  CreditCard, ShieldCheck, Download, History
} from 'lucide-react';
import { FEES_COLLECTORS } from '../lib/constants';
import { Student } from '../types';
import { StudentPaymentHistoryModal } from './StudentPaymentHistoryModal';

type FeeTab = 'fees' | 'history' | 'reports' | 'office';

const FeesCollection = () => {
  const { students, transactions, officeEarnings } = useData();
  const { user, isAdmin, role } = useAuth();
  
  const [activeTab, setActiveTab] = useState<FeeTab>('fees');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date Range Filter for Reports
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));

  // Form Data for Fees
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    monthForFee: format(new Date(), 'yyyy-MM'),
    paymentMethod: 'cash' as 'cash' | 'online',
    collectedBy: FEES_COLLECTORS[0] || 'Harsimran Singh'
  });

  // Form Data for Office
  const [officeFormData, setOfficeFormData] = useState({
    title: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'cash' as 'cash' | 'online',
    collectedBy: FEES_COLLECTORS[0] || 'Harsimran Singh'
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Computed Collector Stats
  const collectorStats = useMemo(() => {
    const statsMap: Record<string, { total: number; count: number; cash: number; online: number }> = {};
    
    FEES_COLLECTORS.forEach(person => {
      statsMap[person] = { total: 0, count: 0, cash: 0, online: 0 };
    });

    const dataset = activeTab === 'office'
      ? officeEarnings.map(o => ({ amount: o.amount, person: o.collectedBy || o.staffName || 'Unassigned', method: o.paymentMethod }))
      : transactions.map(t => ({ amount: t.amount, person: t.collectedBy || t.staffName || 'Unassigned', method: t.paymentMethod }));

    dataset.forEach(item => {
      const p = item.person.trim() || 'Unassigned';
      if (!statsMap[p]) {
        statsMap[p] = { total: 0, count: 0, cash: 0, online: 0 };
      }
      statsMap[p].total += item.amount;
      statsMap[p].count += 1;
      if (item.method === 'online') {
        statsMap[p].online += item.amount;
      } else {
        statsMap[p].cash += item.amount;
      }
    });

    return Object.entries(statsMap).map(([person, data]) => ({ person, ...data }));
  }, [transactions, officeEarnings, activeTab]);

  // Report Analytics Calculations
  const reportAnalytics = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Filter transactions within range
    const rangeTxns = transactions.filter(t => {
      try {
        const d = parseISO(t.date || new Date(t.createdAt).toISOString());
        return isWithinInterval(d, { start, end });
      } catch (e) {
        return true;
      }
    });

    // Payment Method Breakdown
    const totalCash = rangeTxns.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.amount, 0);
    const totalOnline = rangeTxns.filter(t => t.paymentMethod === 'online').reduce((sum, t) => sum + t.amount, 0);
    const totalRevenue = totalCash + totalOnline;

    // Academic Year Revenue Summary
    const yearStart = startOfYear(new Date());
    const yearEnd = endOfYear(new Date());
    const yearTxns = transactions.filter(t => {
      try {
        const d = parseISO(t.date || new Date(t.createdAt).toISOString());
        return isWithinInterval(d, { start: yearStart, end: yearEnd });
      } catch (e) {
        return true;
      }
    });
    const academicYearTotal = yearTxns.reduce((sum, t) => sum + t.amount, 0);

    // Outstanding Dues Detection (Students who haven't paid for current month)
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const studentsWithDues = students.map(st => {
      const studentTxns = transactions.filter(t => t.studentId === st.id);
      const hasPaidCurrentMonth = studentTxns.some(t => t.monthForFee === currentMonthStr);
      const lastPayment = studentTxns.sort((a, b) => b.createdAt - a.createdAt)[0];

      return {
        student: st,
        hasPaidCurrentMonth,
        lastPaymentMonth: lastPayment ? lastPayment.monthForFee : 'Never',
        totalPaid: studentTxns.reduce((sum, t) => sum + t.amount, 0)
      };
    }).filter(s => !s.hasPaidCurrentMonth);

    return {
      totalRevenue,
      totalCash,
      totalOnline,
      academicYearTotal,
      txnsCount: rangeTxns.length,
      studentsWithDues
    };
  }, [transactions, students, startDate, endDate]);

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.studentId || !formData.amount || !formData.monthForFee || !formData.collectedBy) return;
    
    setSubmitting(true);
    setSuccess(false);
    try {
      const docRef = doc(collection(db, 'transactions'));
      await setDoc(docRef, {
        instituteId: 'SevenAI',
        studentId: formData.studentId,
        amount: Number(formData.amount),
        date: new Date().toISOString(),
        monthForFee: formData.monthForFee,
        paymentMethod: formData.paymentMethod,
        collectedBy: formData.collectedBy,
        staffId: user.uid,
        staffName: user.displayName || user.email || 'Staff',
        createdAt: Date.now()
      });
      setSuccess(true);
      setFormData(prev => ({...prev, studentId: '', amount: '' }));
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCollectOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !officeFormData.title || !officeFormData.amount || !officeFormData.date || !officeFormData.collectedBy) return;
    
    setSubmitting(true);
    setSuccess(false);
    try {
      const docRef = doc(collection(db, 'office_earnings'));
      await setDoc(docRef, {
        instituteId: 'SevenAI',
        title: officeFormData.title,
        amount: Number(officeFormData.amount),
        date: officeFormData.date,
        paymentMethod: officeFormData.paymentMethod,
        collectedBy: officeFormData.collectedBy,
        staffId: user.uid,
        staffName: user.displayName || user.email || 'Staff',
        createdAt: Date.now()
      });
      setSuccess(true);
      setOfficeFormData(prev => ({...prev, title: '', amount: '' }));
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'office_earnings');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, isOffice: boolean = false) => {
    try {
      const collectionName = isOffice ? 'office_earnings' : 'transactions';
      await deleteDoc(doc(db, collectionName, id));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, isOffice ? 'office_earnings' : 'transactions');
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Fee Collection System</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage student fee payments, payment history ledgers, revenue analytics & office earnings</p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
          <button 
            onClick={() => setActiveTab('fees')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'fees' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            FEE COLLECTION
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            STUDENT PAYMENT HISTORY
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reports' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            REVENUE REPORTS
          </button>
          <button 
            onClick={() => setActiveTab('office')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'office' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            OFFICE EARNINGS
          </button>
        </div>
      </div>

      {/* Collector Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {collectorStats.map(stat => (
          <div key={stat.person} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-indigo-600" />
                {stat.person}
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                {stat.count} Transactions
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xl font-black text-slate-900 tabular-nums font-mono">₹{stat.total.toLocaleString()}</p>
              <div className="flex gap-3 text-[10px] font-semibold text-slate-500 mt-1">
                <span>Cash: ₹{stat.cash.toLocaleString()}</span>
                <span>•</span>
                <span>Online: ₹{stat.online.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TAB 1: RECORD FEE COLLECTION */}
      {activeTab === 'fees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Record Fee Form */}
          <div className="lg:col-span-1 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm h-fit space-y-4">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
              <Receipt size={16} className="text-indigo-600" /> Record Student Fee
            </h3>

            <form onSubmit={handleCollect} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Select Student *</label>
                <select 
                  required
                  value={formData.studentId}
                  onChange={e => setFormData({...formData, studentId: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800"
                >
                  <option value="" disabled>-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.course})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Amount Paid (₹) *</label>
                <input 
                  type="number" 
                  required 
                  min="1"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  placeholder="e.g. 5000"
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Fee Month *</label>
                <input 
                  type="month" 
                  required 
                  value={formData.monthForFee}
                  onChange={e => setFormData({...formData, monthForFee: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Collected By *</label>
                <select 
                  required
                  value={formData.collectedBy}
                  onChange={e => setFormData({...formData, collectedBy: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800"
                >
                  {FEES_COLLECTORS.map(collector => (
                    <option key={collector} value={collector}>{collector}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Payment Method *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: 'cash'})}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition ${
                      formData.paymentMethod === 'cash' ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: 'online'})}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition ${
                      formData.paymentMethod === 'online' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    ONLINE
                  </button>
                </div>
              </div>

              <div className="pt-2">
                {success && (
                  <div className="mb-3 text-emerald-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center">
                    <CheckCircle2 size={14} /> TRANSACTION RECORDED SUCCESSFULLY
                  </div>
                )}
                <button 
                  disabled={submitting} 
                  type="submit" 
                  className="w-full bg-indigo-600 text-white text-xs font-bold rounded-xl shadow hover:bg-indigo-700 disabled:opacity-50 transition py-3 uppercase tracking-wider"
                >
                  {submitting ? 'PROCESSING...' : 'RECORD FEE RECEIPT'}
                </button>
              </div>
            </form>
          </div>

          {/* Recent Fee Transactions */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">Recent Fee Transactions</h3>
              <span className="text-xs text-slate-400 font-semibold">{transactions.length} Total Receipts</span>
            </div>

            <div className="flex-1 overflow-x-auto">
              {transactions.length > 0 ? (
                <table className="w-full text-left whitespace-nowrap text-xs">
                  <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="p-4">Date & Month</th>
                      <th className="p-4">Student</th>
                      <th className="p-4">Amount & Method</th>
                      <th className="p-4">Collected By</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map(t => {
                      const student = students.find(s => s.id === t.studentId);
                      const isOnline = t.paymentMethod === 'online';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-800">{format(new Date(t.createdAt), 'dd MMM yyyy')}</p>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Fee: {t.monthForFee}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900 text-sm">{student?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{student?.course}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900 tabular-nums font-mono text-sm">₹{t.amount.toLocaleString()}</p>
                            <span className={`text-[9px] px-2 py-0.5 font-bold uppercase rounded ${
                              isOnline ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {t.paymentMethod}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-semibold">
                            {t.collectedBy || t.staffName}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {deleteConfirmId === t.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] font-bold text-slate-400">Cancel</button>
                                <button onClick={() => handleDelete(t.id)} className="text-[10px] font-bold text-rose-600">Delete</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId(t.id)} className="p-1 text-slate-400 hover:text-rose-600 transition">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-slate-400 text-sm">No fee transactions recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT PAYMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search student name, course, batch..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">
              Click any student row to view full payment history & print receipts
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5">Course & Batch</th>
                  <th className="px-5 py-3.5">Total Paid</th>
                  <th className="px-5 py-3.5">Current Month Fee</th>
                  <th className="px-5 py-3.5 text-right">Ledger Drawer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students
                  .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.course.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(st => {
                    const studentTxns = transactions.filter(t => t.studentId === st.id);
                    const totalPaid = studentTxns.reduce((sum, t) => sum + t.amount, 0);
                    const currentMonth = format(new Date(), 'yyyy-MM');
                    const hasPaidCurrent = studentTxns.some(t => t.monthForFee === currentMonth);

                    return (
                      <tr 
                        key={st.id} 
                        onClick={() => setSelectedStudentForHistory(st)}
                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-4 font-bold text-slate-900 text-sm">
                          {st.name}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-700">{st.course}</span>
                          {st.batch && <span className="text-[10px] text-slate-400 block font-medium">Batch: {st.batch}</span>}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900 tabular-nums font-mono text-sm">
                          ₹{totalPaid.toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          {hasPaidCurrent ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                              PAID ({currentMonth})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                              PENDING / DUE
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center gap-1 ml-auto">
                            <History size={13} /> VIEW HISTORY
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REVENUE REPORTS & OUTSTANDING DUES */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Date Range Picker Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="text-indigo-600" size={20} />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Advanced Revenue Filter & Date Range</h3>
                <p className="text-xs text-slate-500">Filter financial statistics across custom billing timeframes</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Report Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filtered Revenue</span>
              <span className="text-2xl font-black text-slate-900 tabular-nums font-mono mt-1 block">
                ₹{reportAnalytics.totalRevenue.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block font-semibold">{reportAnalytics.txnsCount} Transactions</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm bg-gradient-to-br from-amber-50/50 to-white">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Cash Collection</span>
              <span className="text-2xl font-black text-amber-900 tabular-nums font-mono mt-1 block">
                ₹{reportAnalytics.totalCash.toLocaleString()}
              </span>
              <span className="text-[11px] text-amber-700 mt-1 block font-semibold">
                {reportAnalytics.totalRevenue > 0 ? ((reportAnalytics.totalCash / reportAnalytics.totalRevenue) * 100).toFixed(0) : 0}% of Total
              </span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Online Collection</span>
              <span className="text-2xl font-black text-indigo-900 tabular-nums font-mono mt-1 block">
                ₹{reportAnalytics.totalOnline.toLocaleString()}
              </span>
              <span className="text-[11px] text-indigo-700 mt-1 block font-semibold">
                {reportAnalytics.totalRevenue > 0 ? ((reportAnalytics.totalOnline / reportAnalytics.totalRevenue) * 100).toFixed(0) : 0}% of Total
              </span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Academic Year Summary</span>
              <span className="text-2xl font-black text-emerald-900 tabular-nums font-mono mt-1 block">
                ₹{reportAnalytics.academicYearTotal.toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-700 mt-1 block font-semibold">Jan - Dec {format(new Date(), 'yyyy')}</span>
            </div>
          </div>

          {/* Outstanding Dues Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-600" /> Outstanding Dues & Pending Payments List
                </h3>
                <p className="text-xs text-slate-500">Students who haven't paid fee for current month ({format(new Date(), 'MMMM yyyy')})</p>
              </div>
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                {reportAnalytics.studentsWithDues.length} Students Pending
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Student Name</th>
                    <th className="px-5 py-3.5">Course Name</th>
                    <th className="px-5 py-3.5">Last Fee Paid Month</th>
                    <th className="px-5 py-3.5">Total Paid Till Date</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportAnalytics.studentsWithDues.map(item => (
                    <tr key={item.student.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900 text-sm">
                        {item.student.name}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {item.student.course}
                      </td>
                      <td className="px-5 py-4 font-bold text-amber-800">
                        {item.lastPaymentMonth}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 tabular-nums font-mono">
                        ₹{item.totalPaid.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedStudentForHistory(item.student);
                          }}
                          className="bg-indigo-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                        >
                          COLLECT FEE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reportAnalytics.studentsWithDues.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-emerald-600 font-bold text-sm">
                        All students are fully up to date with their fees for this month!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OFFICE EARNINGS */}
      {activeTab === 'office' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm h-fit space-y-4">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest border-b border-slate-100 pb-3">Record Office Earning</h3>
            <form onSubmit={handleCollectOffice} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Title / Description *</label>
                <input 
                  type="text" 
                  required 
                  value={officeFormData.title}
                  onChange={e => setOfficeFormData({...officeFormData, title: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold" 
                  placeholder="e.g. Book sales / Certificate fee"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Amount (₹) *</label>
                <input 
                  type="number" 
                  required 
                  min="1"
                  value={officeFormData.amount}
                  onChange={e => setOfficeFormData({...officeFormData, amount: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Date *</label>
                <input 
                  type="date" 
                  required 
                  value={officeFormData.date}
                  onChange={e => setOfficeFormData({...officeFormData, date: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Collected By *</label>
                <select 
                  required
                  value={officeFormData.collectedBy}
                  onChange={e => setOfficeFormData({...officeFormData, collectedBy: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800"
                >
                  {FEES_COLLECTORS.map(collector => (
                    <option key={collector} value={collector}>{collector}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Payment Method *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOfficeFormData({...officeFormData, paymentMethod: 'cash'})}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition ${
                      officeFormData.paymentMethod === 'cash' ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfficeFormData({...officeFormData, paymentMethod: 'online'})}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition ${
                      officeFormData.paymentMethod === 'online' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    ONLINE
                  </button>
                </div>
              </div>

              <div className="pt-2">
                {success && <div className="mb-3 text-emerald-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center"><CheckCircle2 size={14} /> RECORD SAVED</div>}
                <button 
                  disabled={submitting} 
                  type="submit" 
                  className="w-full bg-emerald-600 text-white text-xs font-bold rounded-xl shadow hover:bg-emerald-700 disabled:opacity-50 transition py-3 uppercase tracking-wider"
                >
                  {submitting ? 'PROCESSING...' : 'RECORD OFFICE EARNING'}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
            <h3 className="font-bold text-slate-800 p-5 border-b border-slate-100 uppercase text-xs tracking-widest">Office Earnings History</h3>
            <div className="flex-1 overflow-x-auto">
              {officeEarnings.length > 0 ? (
                <table className="w-full text-left whitespace-nowrap text-xs">
                  <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="p-4">Date</th>
                      <th className="p-4">Title</th>
                      <th className="p-4">Amount & Method</th>
                      <th className="p-4">Collected By</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {officeEarnings.map(t => {
                      const isOnline = t.paymentMethod === 'online';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-slate-700">
                            {format(new Date(t.date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {t.title}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-900 tabular-nums font-mono text-sm">₹{t.amount.toLocaleString()}</p>
                            <span className={`text-[9px] px-2 py-0.5 font-bold uppercase rounded ${
                              isOnline ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {t.paymentMethod}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-semibold">
                            {t.collectedBy || t.staffName}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {deleteConfirmId === t.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] font-bold text-slate-400">Cancel</button>
                                <button onClick={() => handleDelete(t.id, true)} className="text-[10px] font-bold text-rose-600">Delete</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId(t.id)} className="p-1 text-slate-400 hover:text-rose-600 transition">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-slate-400 text-sm">No office earnings recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STUDENT PAYMENT HISTORY MODAL / DRAWER */}
      {selectedStudentForHistory && (
        <StudentPaymentHistoryModal
          student={selectedStudentForHistory}
          onClose={() => setSelectedStudentForHistory(null)}
        />
      )}
    </div>
  );
};

export default FeesCollection;
