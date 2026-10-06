import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { CheckCircle2, Trash2, UserCheck, Wallet } from 'lucide-react';
import { FEES_COLLECTORS } from '../lib/constants';

const FeesCollection = () => {
  const { students, transactions, officeEarnings } = useData();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'fees' | 'office'>('fees');

  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    monthForFee: format(new Date(), 'yyyy-MM'),
    paymentMethod: 'cash',
    collectedBy: ''
  });

  const [officeFormData, setOfficeFormData] = useState({
    title: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'cash',
    collectedBy: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const collectorStats = useMemo(() => {
    const statsMap: Record<string, { total: number; count: number; cash: number; online: number }> = {};
    
    FEES_COLLECTORS.forEach(person => {
      statsMap[person] = { total: 0, count: 0, cash: 0, online: 0 };
    });

    const dataset = activeTab === 'fees'
      ? transactions.map(t => ({ amount: t.amount, person: t.collectedBy || t.staffName || 'Unassigned', method: t.paymentMethod }))
      : officeEarnings.map(o => ({ amount: o.amount, person: o.collectedBy || o.staffName || 'Unassigned', method: o.paymentMethod }));

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
      setFormData(prev => ({...prev, studentId: '', amount: '', paymentMethod: 'cash', collectedBy: ''}));
      
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
      setOfficeFormData(prev => ({...prev, title: '', amount: '', paymentMethod: 'cash', collectedBy: ''}));
      
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing & Collection</h2>
        <p className="text-slate-500 text-sm mt-1">Record and manage fee transactions</p>
      </div>
      
      <div className="flex border-b border-slate-200 gap-6">
        <button 
          onClick={() => setActiveTab('fees')}
          className={`pb-3 text-sm font-bold tracking-widest uppercase transition-colors relative ${activeTab === 'fees' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Fees Collection
          {activeTab === 'fees' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button 
          onClick={() => setActiveTab('office')}
          className={`pb-3 text-sm font-bold tracking-widest uppercase transition-colors relative ${activeTab === 'office' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Office Earnings
          {activeTab === 'office' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
      </div>

      {/* Collector Stats Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {collectorStats.map(stat => (
          <div key={stat.person} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-indigo-600" />
                {stat.person}
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                {stat.count} {stat.count === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xl font-bold text-slate-900">₹{stat.total.toLocaleString()}</p>
              <div className="flex gap-3 text-[10px] font-semibold text-slate-500 mt-1">
                <span>Cash: ₹{stat.cash.toLocaleString()}</span>
                <span>•</span>
                <span>Online: ₹{stat.online.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {activeTab === 'fees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 border border-slate-200 rounded-lg h-fit">
            <h3 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-widest border-b border-slate-100 pb-3">Record New Fee</h3>
            <form onSubmit={handleCollect} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Select Student *</label>
                <select 
                  required
                  value={formData.studentId}
                  onChange={e => setFormData({...formData, studentId: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                >
                  <option value="" disabled>-- Select a student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.course})</option>
                  ))}
                </select>
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
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fee For Month *</label>
                <input 
                  type="month" 
                  required 
                  value={formData.monthForFee}
                  onChange={e => setFormData({...formData, monthForFee: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fees Collected By *</label>
                <select 
                  required
                  value={formData.collectedBy}
                  onChange={e => setFormData({...formData, collectedBy: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-slate-700"
                >
                  <option value="" disabled>-- Select Receiver --</option>
                  {FEES_COLLECTORS.map(collector => (
                    <option key={collector} value={collector}>{collector}</option>
                  ))}
                </select>
              </div>

              <div>
                 <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Payment Method *</label>
                 <div className="flex gap-3">
                    <label className={`flex-1 border rounded p-3 cursor-pointer flex items-center justify-center gap-2 transition-colors ${formData.paymentMethod === 'cash' ? 'border-amber-500 bg-amber-50/50 text-amber-700 font-bold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                       <input type="radio" className="hidden" name="payment_method" value="cash" checked={formData.paymentMethod === 'cash'} onChange={() => setFormData({...formData, paymentMethod: 'cash'})} />
                       <span className="text-[11px] uppercase tracking-widest font-bold">Cash</span>
                    </label>
                    <label className={`flex-1 border rounded p-3 cursor-pointer flex items-center justify-center gap-2 transition-colors ${formData.paymentMethod === 'online' ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                       <input type="radio" className="hidden" name="payment_method" value="online" checked={formData.paymentMethod === 'online'} onChange={() => setFormData({...formData, paymentMethod: 'online'})} />
                       <span className="text-[11px] uppercase tracking-widest font-bold">Online</span>
                    </label>
                 </div>
              </div>

              <div className="pt-2">
                {success && <div className="mb-3 text-emerald-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center"><CheckCircle2 size={14} /> SAVED</div>}
                <button 
                  disabled={submitting} 
                  type="submit" 
                  className="w-full bg-indigo-600 text-white text-[11px] font-bold rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition p-3 uppercase tracking-widest"
                >
                  {submitting ? 'PROCESSING...' : 'RECORD FEE'}
                </button>
              </div>
            </form>
          </div>

          {/* History */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
            <h3 className="font-bold text-slate-700 m-6 mb-4 uppercase text-xs tracking-widest">Recent Transactions</h3>
            <div className="flex-1 overflow-x-auto">
              {transactions.length > 0 ? (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Date & Month</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Student Name</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Amount & Method</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Collected By</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map(t => {
                      const student = students.find(s => s.id === t.studentId);
                      const isOnline = t.paymentMethod === 'online';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors text-sm">
                          <td className="px-4 py-3">
                             <p className="font-medium text-slate-700">{format(new Date(t.createdAt), 'dd MMM yyyy')}</p>
                             <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Fee: {t.monthForFee}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">
                             {student?.name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3">
                             <p className="font-bold text-slate-700">₹{t.amount.toLocaleString()}</p>
                             <p className={`text-[9px] mt-0.5 inline-block px-1.5 py-0.5 font-bold uppercase tracking-wider rounded ${isOnline ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                               {t.paymentMethod}
                             </p>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-500 font-medium">
                             {t.collectedBy || t.staffName}
                          </td>
                          <td className="px-4 py-3 border-l border-slate-100 bg-indigo-50/20 text-right">
                            {deleteConfirmId === t.id ? (
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-[9px] uppercase tracking-wider text-rose-500 font-bold">Delete?</span>
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                                  <button onClick={() => handleDelete(t.id)} className="text-[10px] uppercase font-bold text-rose-600 hover:text-rose-700">Yes</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId(t.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
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
                <div className="p-10 flex flex-col items-center justify-center text-slate-400 text-sm">
                   No fee transactions recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 border border-slate-200 rounded-lg h-fit">
            <h3 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-widest border-b border-slate-100 pb-3">Record Office Earning</h3>
            <form onSubmit={handleCollectOffice} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Title / Description *</label>
                <input 
                  type="text" 
                  required 
                  value={officeFormData.title}
                  onChange={e => setOfficeFormData({...officeFormData, title: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
                  placeholder="e.g. Sale of books"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Amount (₹) *</label>
                <input 
                  type="number" 
                  required 
                  min="0"
                  value={officeFormData.amount}
                  onChange={e => setOfficeFormData({...officeFormData, amount: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date *</label>
                <input 
                  type="date" 
                  required 
                  value={officeFormData.date}
                  onChange={e => setOfficeFormData({...officeFormData, date: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Collected By *</label>
                <select 
                  required
                  value={officeFormData.collectedBy}
                  onChange={e => setOfficeFormData({...officeFormData, collectedBy: e.target.value})}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-slate-700"
                >
                  <option value="" disabled>-- Select Receiver --</option>
                  {FEES_COLLECTORS.map(collector => (
                    <option key={collector} value={collector}>{collector}</option>
                  ))}
                </select>
              </div>

              <div>
                 <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Payment Method *</label>
                 <div className="flex gap-3">
                    <label className={`flex-1 border rounded p-3 cursor-pointer flex items-center justify-center gap-2 transition-colors ${officeFormData.paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-bold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                       <input type="radio" className="hidden" name="office_payment_method" value="cash" checked={officeFormData.paymentMethod === 'cash'} onChange={() => setOfficeFormData({...officeFormData, paymentMethod: 'cash'})} />
                       <span className="text-[11px] uppercase tracking-widest font-bold">Cash</span>
                    </label>
                    <label className={`flex-1 border rounded p-3 cursor-pointer flex items-center justify-center gap-2 transition-colors ${officeFormData.paymentMethod === 'online' ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                       <input type="radio" className="hidden" name="office_payment_method" value="online" checked={officeFormData.paymentMethod === 'online'} onChange={() => setOfficeFormData({...officeFormData, paymentMethod: 'online'})} />
                       <span className="text-[11px] uppercase tracking-widest font-bold">Online</span>
                    </label>
                 </div>
              </div>

              <div className="pt-2">
                {success && <div className="mb-3 text-emerald-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 justify-center"><CheckCircle2 size={14} /> SAVED</div>}
                <button 
                  disabled={submitting} 
                  type="submit" 
                  className="w-full bg-emerald-600 text-white text-[11px] font-bold rounded shadow hover:bg-emerald-700 disabled:opacity-50 transition p-3 uppercase tracking-widest"
                >
                  {submitting ? 'PROCESSING...' : 'RECORD EARNING'}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
            <h3 className="font-bold text-slate-700 m-6 mb-4 uppercase text-xs tracking-widest">Office Earnings History</h3>
            <div className="flex-1 overflow-x-auto">
              {officeEarnings.length > 0 ? (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Date</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Title</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Amount & Method</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Collected By</th>
                      <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {officeEarnings.map(t => {
                      const isOnline = t.paymentMethod === 'online';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors text-sm">
                          <td className="px-4 py-3">
                             <p className="font-medium text-slate-700">{format(new Date(t.date), 'dd MMM yyyy')}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">
                             {t.title}
                          </td>
                          <td className="px-4 py-3">
                             <p className="font-bold text-slate-700">₹{t.amount.toLocaleString()}</p>
                             <p className={`text-[9px] mt-0.5 inline-block px-1.5 py-0.5 font-bold uppercase tracking-wider rounded ${isOnline ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                               {t.paymentMethod}
                             </p>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-500 font-medium">
                             {t.collectedBy || t.staffName}
                          </td>
                          <td className="px-4 py-3 border-l border-slate-100 bg-emerald-50/20 text-right">
                            {deleteConfirmId === t.id ? (
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-[9px] uppercase tracking-wider text-rose-500 font-bold">Delete?</span>
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                                  <button onClick={() => handleDelete(t.id, true)} className="text-[10px] uppercase font-bold text-rose-600 hover:text-rose-700">Yes</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId(t.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
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
                <div className="p-10 flex flex-col items-center justify-center text-slate-400 text-sm">
                   No office earnings recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesCollection;
