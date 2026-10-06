import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { CheckCircle2, TrendingUp, TrendingDown, DollarSign, Trash2, UserCheck, CreditCard } from 'lucide-react';
import { FEES_COLLECTORS } from '../lib/constants';

const Expenses = () => {
  const { transactions, expenses } = useData();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Utilities',
    paidBy: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Calculate totals
  const totalFeesCollected = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfit = totalFeesCollected - totalExpenses;

  const expensesByPerson = useMemo(() => {
    const personMap: Record<string, { total: number; count: number }> = {};
    
    FEES_COLLECTORS.forEach(person => {
      personMap[person] = { total: 0, count: 0 };
    });

    expenses.forEach(exp => {
      const p = (exp.paidBy || exp.staffName || 'Unassigned').trim();
      if (!personMap[p]) {
        personMap[p] = { total: 0, count: 0 };
      }
      personMap[p].total += exp.amount;
      personMap[p].count += 1;
    });

    return Object.entries(personMap).map(([person, data]) => ({ person, ...data }));
  }, [expenses]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.amount || !formData.date || !formData.paidBy) return;
    
    setSubmitting(true);
    setSuccess(false);
    try {
      const docRef = doc(collection(db, 'expenses'));
      await setDoc(docRef, {
        instituteId: 'SevenAI',
        title: formData.title,
        amount: Number(formData.amount),
        date: formData.date,
        category: formData.category,
        paidBy: formData.paidBy,
        staffId: user.uid,
        staffName: user.displayName || user.email || 'Staff',
        createdAt: Date.now()
      });
      setSuccess(true);
      setFormData(prev => ({ ...prev, title: '', amount: '', paidBy: '' }));
      
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
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Institute Expenses & Profit</h2>
        <p className="text-slate-500 text-sm mt-1">Manage outbound expenses and view net profit</p>
      </div>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-slate-200 rounded-lg">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Total Fee Collected</p>
               <p className="text-2xl font-bold text-slate-800">₹{totalFeesCollected.toLocaleString()}</p>
             </div>
             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={24} /></div>
           </div>
        </div>
        
        <div className="bg-white p-6 border border-slate-200 rounded-lg">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Total Expenses</p>
               <p className="text-2xl font-bold text-slate-800">₹{totalExpenses.toLocaleString()}</p>
             </div>
             <div className="p-3 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown size={24} /></div>
           </div>
        </div>
        
        <div className={`bg-white p-6 border border-slate-200 rounded-lg relative overflow-hidden ${netProfit >= 0 ? '' : ''}`}>
           <div className="absolute inset-0 bg-indigo-600 opacity-[0.03]"></div>
           <div className="flex justify-between items-start relative z-10">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Net Profit</p>
               <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {netProfit < 0 ? '-' : ''}₹{Math.abs(netProfit).toLocaleString()}
               </p>
             </div>
             <div className={`p-3 rounded-lg ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
               <DollarSign size={24} />
             </div>
           </div>
        </div>
      </div>

      {/* Expenses Paid By Person Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {expensesByPerson.map(stat => (
          <div key={stat.person} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-rose-600" />
                {stat.person}
              </span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                {stat.count} {stat.count === 1 ? 'expense' : 'expenses'}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xl font-bold text-slate-900">₹{stat.total.toLocaleString()}</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Total Expenses Paid
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Form */}
         <div className="lg:col-span-1 bg-white p-6 border border-slate-200 rounded-lg flex flex-col h-fit">
           <h3 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-widest border-b border-slate-100 pb-3">Log New Expense</h3>
           <form onSubmit={handleAddExpense} className="space-y-5">
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Expense Title *</label>
               <input 
                 required 
                 value={formData.title} 
                 onChange={e => setFormData({...formData, title: e.target.value})} 
                 placeholder="e.g. Electricity Bill, Internet"
                 className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
               />
             </div>
             
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Amount (₹) *</label>
               <input 
                 type="number" 
                 required 
                 min="0"
                 value={formData.amount} 
                 onChange={e => setFormData({...formData, amount: e.target.value})} 
                 className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
               />
             </div>
             
             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date *</label>
               <input 
                 type="date" 
                 required 
                 value={formData.date} 
                 onChange={e => setFormData({...formData, date: e.target.value})} 
                 className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
               />
             </div>

             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Category *</label>
               <select 
                 required 
                 value={formData.category} 
                 onChange={e => setFormData({...formData, category: e.target.value})} 
                 className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
               >
                 <option value="Utilities">Utilities (Electricity, Water, Internet)</option>
                 <option value="Maintenance">Maintenance & Repairs</option>
                 <option value="Marketing">Marketing & Advertising</option>
                 <option value="Salary">Staff Salary</option>
                 <option value="Rent">Rent</option>
                 <option value="Supplies">Office Supplies</option>
                 <option value="Miscellaneous">Miscellaneous</option>
               </select>
             </div>

             <div>
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Paid By *</label>
               <select 
                 required 
                 value={formData.paidBy} 
                 onChange={e => setFormData({...formData, paidBy: e.target.value})} 
                 className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
               >
                 <option value="" disabled>Select Person</option>
                 {FEES_COLLECTORS.map(person => (
                   <option key={person} value={person}>{person}</option>
                 ))}
               </select>
             </div>
             
             <div className="pt-2">
               {success && <div className="mb-3 text-emerald-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center"><CheckCircle2 size={14} /> SAVED</div>}
               <button 
                 disabled={submitting} 
                 type="submit" 
                 className="w-full bg-slate-900 text-white text-[11px] font-bold rounded shadow hover:bg-slate-800 disabled:opacity-50 transition p-3 uppercase tracking-widest"
               >
                 {submitting ? 'PROCESSING...' : 'RECORD EXPENSE'}
               </button>
             </div>
           </form>
         </div>

         {/* History */}
         <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
            <h3 className="font-bold text-slate-700 m-6 mb-4 uppercase text-xs tracking-widest">Expense History</h3>
            <div className="flex-1 overflow-x-auto">
              {expenses.length > 0 ? (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Date</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Title & Category</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Amount</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Paid By</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Logged By</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-700">
                           {format(new Date(exp.date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                           <p className="font-bold text-slate-800 text-sm">{exp.title}</p>
                           <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{exp.category}</p>
                        </td>
                        <td className="px-4 py-3">
                           <span className="font-bold text-slate-700">₹{exp.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600">
                           {exp.paidBy || '-'}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">
                           {exp.staffName}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {deleteConfirmId === exp.id ? (
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-[9px] uppercase tracking-wider text-rose-500 font-bold">Delete?</span>
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                                <button onClick={() => handleDelete(exp.id)} className="text-[10px] uppercase font-bold text-rose-600 hover:text-rose-700">Yes</button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeleteConfirmId(exp.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-10 flex flex-col items-center justify-center text-slate-400 text-sm">
                   No expenses recorded yet.
                </div>
              )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Expenses;
