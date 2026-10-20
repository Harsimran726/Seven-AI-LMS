import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { 
  CheckCircle2, TrendingUp, TrendingDown, DollarSign, Trash2, UserCheck, 
  CreditCard, Users, Receipt, Search, Filter, PieChart as PieChartIcon, 
  Building2, Tag, Briefcase, Plus, Wallet, ArrowUpRight
} from 'lucide-react';
import { FEES_COLLECTORS, EXPENSE_CATEGORIES } from '../lib/constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

const CATEGORY_COLORS: Record<string, string> = {
  'Salary': '#6366f1', // Indigo
  'Rent': '#3b82f6', // Blue
  'Utilities': '#f59e0b', // Amber
  'Marketing & Advertising': '#10b981', // Emerald
  'Maintenance & Repairs': '#ec4899', // Pink
  'Office Supplies': '#8b5cf6', // Purple
  'Software & Tech': '#06b6d4', // Cyan
  'Events & Demos': '#14b8a6', // Teal
  'Miscellaneous': '#64748b' // Slate
};

const Expenses = () => {
  const { transactions, expenses } = useData();
  const { user } = useAuth();

  // Search, Filter & Tab States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('ALL');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month'>('all');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Salary',
    salaryRecipient: 'Harsimran Singh',
    paidBy: FEES_COLLECTORS[0] || 'Harsimran Singh',
    note: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Time-filtered Expenses
  const filteredTimeExpenses = useMemo(() => {
    if (timeFilter === 'month') {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      return expenses.filter(exp => {
        try {
          const d = parseISO(exp.date);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        } catch (e) {
          return true;
        }
      });
    }
    return expenses;
  }, [expenses, timeFilter]);

  // Overall Totals
  const totalFeesCollected = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return filteredTimeExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredTimeExpenses]);

  const netProfit = totalFeesCollected - totalExpenses;

  // 1. COMBINED SALARY ANALYTICS (Matches multiple salary expenses and groups them)
  const salaryAnalytics = useMemo(() => {
    const salaryExpenses = filteredTimeExpenses.filter(e => 
      e.category === 'Salary' || e.title.toLowerCase().includes('salary') || e.title.toLowerCase().includes('pay')
    );

    const totalSalaryPaid = salaryExpenses.reduce((sum, e) => sum + e.amount, 0);
    const payoutCount = salaryExpenses.length;

    // Group by Salary Recipient / Staff
    const recipientMap: Record<string, { total: number; count: number; lastPaid: string }> = {};

    salaryExpenses.forEach(exp => {
      // Extract recipient name if set or parse from title
      let recipient = exp.salaryRecipient?.trim() || '';
      if (!recipient) {
        if (exp.title.toLowerCase().includes('harsimran')) recipient = 'Harsimran Singh';
        else if (exp.title.toLowerCase().includes('nishant')) recipient = 'Nishant Mittal';
        else if (exp.title.toLowerCase().includes('nikhil')) recipient = 'Nikhil Mittal';
        else if (exp.title.toLowerCase().includes('jagdeep')) recipient = 'Jagdeep Kaur';
        else recipient = exp.title || 'Staff Member';
      }

      if (!recipientMap[recipient]) {
        recipientMap[recipient] = { total: 0, count: 0, lastPaid: exp.date };
      }
      recipientMap[recipient].total += exp.amount;
      recipientMap[recipient].count += 1;
      if (exp.date > recipientMap[recipient].lastPaid) {
        recipientMap[recipient].lastPaid = exp.date;
      }
    });

    const recipientBreakdown = Object.entries(recipientMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        lastPaid: data.lastPaid,
        percentage: totalSalaryPaid > 0 ? Math.round((data.total / totalSalaryPaid) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalSalaryPaid,
      payoutCount,
      recipientBreakdown
    };
  }, [filteredTimeExpenses]);

  // 2. COMBINED CATEGORY BREAKDOWN (Combines expenses per type)
  const categoryAnalytics = useMemo(() => {
    const catMap: Record<string, { total: number; count: number }> = {};

    EXPENSE_CATEGORIES.forEach(cat => {
      catMap[cat] = { total: 0, count: 0 };
    });

    filteredTimeExpenses.forEach(exp => {
      const cat = EXPENSE_CATEGORIES.includes(exp.category as any) ? exp.category : 'Miscellaneous';
      if (!catMap[cat]) {
        catMap[cat] = { total: 0, count: 0 };
      }
      catMap[cat].total += exp.amount;
      catMap[cat].count += 1;
    });

    return Object.entries(catMap)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 100) : 0,
        color: CATEGORY_COLORS[category] || '#64748b'
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTimeExpenses, totalExpenses]);

  // 3. COMBINED PAID BY PERSON ANALYTICS
  const expensesByPerson = useMemo(() => {
    const personMap: Record<string, { total: number; count: number }> = {};
    
    FEES_COLLECTORS.forEach(person => {
      personMap[person] = { total: 0, count: 0 };
    });

    filteredTimeExpenses.forEach(exp => {
      const p = (exp.paidBy || exp.staffName || 'Unassigned').trim();
      if (!personMap[p]) {
        personMap[p] = { total: 0, count: 0 };
      }
      personMap[p].total += exp.amount;
      personMap[p].count += 1;
    });

    return Object.entries(personMap).map(([person, data]) => ({ person, ...data }));
  }, [filteredTimeExpenses]);

  // 4. MATCH EXPENSES SEARCH & TAB FILTERING
  const matchingExpenses = useMemo(() => {
    return filteredTimeExpenses.filter(exp => {
      // Category Tab filter
      if (selectedCategoryTab !== 'ALL' && exp.category !== selectedCategoryTab) {
        if (selectedCategoryTab === 'Salary' && (exp.category === 'Salary' || exp.title.toLowerCase().includes('salary'))) {
          // match salary
        } else {
          return false;
        }
      }

      // Keyword Search Filter ("Match Expense")
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = exp.title.toLowerCase().includes(query);
        const matchCategory = exp.category.toLowerCase().includes(query);
        const matchPaidBy = (exp.paidBy || '').toLowerCase().includes(query);
        const matchRecipient = (exp.salaryRecipient || '').toLowerCase().includes(query);
        const matchAmount = exp.amount.toString().includes(query);

        return matchTitle || matchCategory || matchPaidBy || matchRecipient || matchAmount;
      }

      return true;
    });
  }, [filteredTimeExpenses, selectedCategoryTab, searchQuery]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.amount || !formData.date || !formData.paidBy) return;
    
    setSubmitting(true);
    setSuccess(false);
    try {
      const docRef = doc(collection(db, 'expenses'));
      const now = Date.now();
      await setDoc(docRef, {
        instituteId: 'SevenAI',
        title: formData.title,
        amount: Number(formData.amount),
        date: formData.date,
        category: formData.category,
        salaryRecipient: formData.category === 'Salary' ? formData.salaryRecipient : '',
        paidBy: formData.paidBy,
        note: formData.note || '',
        staffId: user.uid,
        staffName: user.displayName || user.email || 'Staff',
        createdAt: now
      });

      setSuccess(true);
      setFormData({
        title: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        category: 'Salary',
        salaryRecipient: 'Harsimran Singh',
        paidBy: FEES_COLLECTORS[0] || 'Harsimran Singh',
        note: ''
      });
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'expenses');
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Title & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Institute Expenses & Profit</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track outbound expenses, combine staff salaries, and view category analytics</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All-Time Expenses
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeFilter === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            This Month ({format(new Date(), 'MMM yyyy')})
          </button>
        </div>
      </div>
      
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Fee Collected</p>
               <p className="text-2xl font-extrabold text-slate-900 font-mono">₹{totalFeesCollected.toLocaleString('en-IN')}</p>
               <p className="text-[11px] text-emerald-600 font-semibold mt-1">Total Revenue Logged</p>
             </div>
             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={22} /></div>
           </div>
        </div>
        
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Expenses Logged</p>
               <p className="text-2xl font-extrabold text-rose-700 font-mono">₹{totalExpenses.toLocaleString('en-IN')}</p>
               <p className="text-[11px] text-slate-500 font-medium mt-1">{filteredTimeExpenses.length} Total Expense Records</p>
             </div>
             <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown size={22} /></div>
           </div>
        </div>
        
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
           <div className="flex justify-between items-start relative z-10">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Net Institute Profit</p>
               <p className={`text-2xl font-extrabold font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {netProfit < 0 ? '-' : ''}₹{Math.abs(netProfit).toLocaleString('en-IN')}
               </p>
               <p className="text-[11px] text-slate-500 font-medium mt-1">Revenue minus Expenses</p>
             </div>
             <div className={`p-3 rounded-xl ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
               <DollarSign size={22} />
             </div>
           </div>
        </div>
      </div>

      {/* COMBINED SALARY ANALYTICS SECTION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                Combined Staff Salary Analytics
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {salaryAnalytics.payoutCount} Payouts
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Combines all staff & teacher salary expenses into one unified report</p>
            </div>
          </div>

          <div className="bg-indigo-50/80 border border-indigo-200 px-4 py-2 rounded-xl text-right">
            <span className="block text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Total Combined Salary</span>
            <span className="font-mono text-xl font-black text-indigo-900">₹{salaryAnalytics.totalSalaryPaid.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Salary Recipient Breakdown Cards */}
        {salaryAnalytics.recipientBreakdown.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {salaryAnalytics.recipientBreakdown.map(rec => (
              <div key={rec.name} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between relative hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Users size={14} className="text-indigo-600" />
                    {rec.name}
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                    {rec.percentage}% of Pool
                  </span>
                </div>

                <div className="mt-3">
                  <p className="font-mono text-lg font-extrabold text-slate-900">₹{rec.total.toLocaleString('en-IN')}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-1">
                    <span>{rec.count} Salary {rec.count === 1 ? 'Payout' : 'Payouts'}</span>
                    <span>Last: {format(new Date(rec.lastPaid), 'dd MMM')}</span>
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${rec.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No staff salary expenses recorded for this timeframe yet.
          </div>
        )}
      </div>

      {/* EXPENSE CATEGORIES SUMMARY BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <PieChartIcon size={18} className="text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Combined Category Expense Breakdown</h3>
          </div>
          <span className="text-xs font-bold text-slate-400">{categoryAnalytics.filter(c => c.total > 0).length} Active Categories</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {categoryAnalytics.map(cat => (
            <div 
              key={cat.category} 
              onClick={() => setSelectedCategoryTab(cat.category)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedCategoryTab === cat.category 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 truncate">{cat.category}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
              </div>
              <p className="font-mono font-extrabold text-sm mt-1">₹{cat.total.toLocaleString('en-IN')}</p>
              <div className="flex items-center justify-between text-[9px] font-medium opacity-70 mt-0.5">
                <span>{cat.count} items</span>
                <span>{cat.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Form Column */}
         <div className="lg:col-span-1 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col h-fit space-y-4">
           <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
             <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
               <Receipt size={16} className="text-indigo-600" /> Log Institute Expense
             </h3>
           </div>

           <form onSubmit={handleAddExpense} className="space-y-4">
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Expense Category *</label>
               <select 
                 required 
                 value={formData.category} 
                 onChange={e => setFormData({...formData, category: e.target.value})} 
                 className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
               >
                 {EXPENSE_CATEGORIES.map(cat => (
                   <option key={cat} value={cat}>{cat}</option>
                 ))}
               </select>
             </div>

             {/* If Salary selected, show Salary Recipient dropdown */}
             {formData.category === 'Salary' && (
               <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl space-y-2">
                 <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Salary Paid To (Staff / Teacher) *</label>
                 <select
                   required
                   value={formData.salaryRecipient}
                   onChange={e => {
                     const rec = e.target.value;
                     setFormData({
                       ...formData,
                       salaryRecipient: rec,
                       title: `Monthly Salary - ${rec}`
                     });
                   }}
                   className="w-full border border-indigo-200 bg-white rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                   <option value="Harsimran Singh">Harsimran Singh (Teacher)</option>
                   <option value="Nishant Mittal">Nishant Mittal (Teacher)</option>
                   <option value="Nikhil Mittal">Nikhil Mittal (Staff)</option>
                   <option value="Jagdeep Kaur">Jagdeep Kaur (Staff)</option>
                   <option value="Telecaler">Telecaler Staff</option>
                   <option value="Custom">Other Staff Member</option>
                 </select>
               </div>
             )}

             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Expense Title / Particulars *</label>
               <input 
                 required 
                 value={formData.title} 
                 onChange={e => setFormData({...formData, title: e.target.value})} 
                 placeholder={formData.category === 'Salary' ? 'e.g. Monthly Salary - Harsimran Singh' : 'e.g. Electricity Bill, High Speed Broadband'}
                 className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
               />
             </div>
             
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Amount Paid (₹) *</label>
               <input 
                 type="number" 
                 required 
                 min="1"
                 value={formData.amount} 
                 onChange={e => setFormData({...formData, amount: e.target.value})} 
                 placeholder="e.g. 15000"
                 className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
               />
             </div>
             
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Payment Date *</label>
               <input 
                 type="date" 
                 required 
                 value={formData.date} 
                 onChange={e => setFormData({...formData, date: e.target.value})} 
                 className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
               />
             </div>

             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Expense Paid By *</label>
               <select 
                 required 
                 value={formData.paidBy} 
                 onChange={e => setFormData({...formData, paidBy: e.target.value})} 
                 className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-800"
               >
                 {FEES_COLLECTORS.map(person => (
                   <option key={person} value={person}>{person}</option>
                 ))}
               </select>
             </div>

             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Notes / Remarks</label>
               <input 
                 value={formData.note} 
                 onChange={e => setFormData({...formData, note: e.target.value})} 
                 placeholder="Optional details or payment receipt no."
                 className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" 
               />
             </div>
             
             <div className="pt-2">
               {success && (
                 <div className="mb-3 text-emerald-600 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center bg-emerald-50 py-2 rounded-lg border border-emerald-200">
                   <CheckCircle2 size={15} /> EXPENSE RECORDED SUCCESSFULLY
                 </div>
               )}
               <button 
                 disabled={submitting} 
                 type="submit" 
                 className="w-full bg-slate-900 text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800 disabled:opacity-50 transition p-3 uppercase tracking-wider cursor-pointer"
               >
                 {submitting ? 'RECORDING...' : 'SAVE EXPENSE RECORD'}
               </button>
             </div>
           </form>
         </div>

         {/* History & Matching Search Table Column */}
         <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
            {/* Search & Category Filter Toolbar */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-slate-400" />
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">Match Expenses & History</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Box ("Match Expense") */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Match Expense (e.g. Salary, Rent...)"
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-48 sm:w-60 font-medium"
                  />
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs">×</button>
                  )}
                </div>

                {/* Filter Category Select */}
                <select
                  value={selectedCategoryTab}
                  onChange={e => setSelectedCategoryTab(e.target.value)}
                  className="border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Categories ({filteredTimeExpenses.length})</option>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-x-auto">
              {matchingExpenses.length > 0 ? (
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="p-4">Date</th>
                      <th className="p-4">Particulars & Category</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Paid By</th>
                      <th className="p-4">Logged By</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {matchingExpenses.map(exp => {
                      const color = CATEGORY_COLORS[exp.category] || '#64748b';
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3.5 text-slate-600 font-bold">
                             {format(new Date(exp.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3.5">
                             <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                               {exp.title}
                               {exp.salaryRecipient && (
                                 <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                   Staff: {exp.salaryRecipient}
                                 </span>
                               )}
                             </p>
                             <span 
                               className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded text-white inline-block mt-1"
                               style={{ backgroundColor: color }}
                             >
                               {exp.category}
                             </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-sm text-slate-900">
                             ₹{exp.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-700">
                             {exp.paidBy || '-'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                             {exp.staffName}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {deleteConfirmId === exp.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] font-bold text-slate-400">Cancel</button>
                                <button onClick={() => handleDelete(exp.id)} className="text-[10px] font-bold text-rose-600">Delete</button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setDeleteConfirmId(exp.id)}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded hover:bg-slate-100"
                                title="Delete Expense"
                              >
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
                <div className="p-12 text-center text-slate-400 text-sm">
                   No matching expenses found for your filter.
                </div>
              )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Expenses;
