import React, { useState, useMemo } from 'react';
import { Student, Transaction } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format, parseISO } from 'date-fns';
import { X, Receipt, CheckCircle2, AlertCircle, Clock, Plus, Phone, Mail, BookOpen, Shield, CreditCard, Wallet, Calendar } from 'lucide-react';
import { FEES_COLLECTORS } from '../lib/constants';

interface Props {
  student: Student;
  onClose: () => void;
}

export const StudentPaymentHistoryModal: React.FC<Props> = ({ student, onClose }) => {
  const { transactions } = useData();
  const { user } = useAuth();

  // Filter transactions for this specific student
  const studentTransactions = useMemo(() => {
    return transactions
      .filter(t => t.studentId === student.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [transactions, student.id]);

  const totalPaid = useMemo(() => {
    return studentTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [studentTransactions]);

  // Determine current month fee status
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const paidMonths = useMemo(() => {
    return new Set(studentTransactions.map(t => t.monthForFee));
  }, [studentTransactions]);

  const isCurrentMonthPaid = paidMonths.has(currentMonthStr);

  // Form state for inline fee payment
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMonth, setPayMonth] = useState(currentMonthStr);
  const [payMethod, setPayMethod] = useState<'cash' | 'online'>('cash');
  const [collectedBy, setCollectedBy] = useState(FEES_COLLECTORS[0] || 'Harsimran Singh');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRecordFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !payAmount || !payMonth || !collectedBy) return;

    setSubmitting(true);
    setSuccess(false);

    try {
      const docRef = doc(collection(db, 'transactions'));
      await setDoc(docRef, {
        instituteId: 'SevenAI',
        studentId: student.id,
        amount: Number(payAmount),
        date: new Date().toISOString(),
        monthForFee: payMonth,
        paymentMethod: payMethod,
        collectedBy,
        staffId: user.uid,
        staffName: user.displayName || user.email || 'Staff',
        createdAt: Date.now()
      });

      setSuccess(true);
      setPayAmount('');
      setShowPayForm(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-slideInRight">
        {/* Drawer Header */}
        <div className="p-6 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-md">
                {student.course}
              </span>
              {student.batch && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                  Batch: {student.batch}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{student.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-1">
              <span className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {student.phone}</span>
              {student.email && <span className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> {student.email}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Overview Banner */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Lifetime Fee Paid</span>
            <span className="text-xl font-black text-slate-900 tabular-nums font-mono mt-1 block">
              ₹{totalPaid.toLocaleString()}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Entries</span>
            <span className="text-xl font-black text-indigo-600 tabular-nums font-mono mt-1 block">
              {studentTransactions.length} Receipts
            </span>
          </div>

          <div className={`p-4 rounded-xl border shadow-sm ${
            isCurrentMonthPaid 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
              Current Month ({format(new Date(), 'MMM yyyy')})
            </span>
            <span className="text-xs font-bold mt-1 flex items-center gap-1.5">
              {isCurrentMonthPaid ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-600" /> PAID FOR {currentMonthStr}
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-amber-600" /> FEE PENDING / OVERDUE
                </>
              )}
            </span>
          </div>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Quick Pay Action Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={18} className="text-indigo-600" /> Chronological Fee Ledger
            </h3>

            <button
              onClick={() => setShowPayForm(!showPayForm)}
              className="bg-indigo-600 text-white text-xs font-bold px-3.5 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> {showPayForm ? 'CLOSE FORM' : 'RECORD NEW PAYMENT'}
            </button>
          </div>

          {/* Inline Pay Form */}
          {showPayForm && (
            <form onSubmit={handleRecordFee} className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-5 space-y-4 animate-fadeIn">
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                <CreditCard size={16} className="text-indigo-600" /> Record Fee Payment for {student.name}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Fee For Month *</label>
                  <input
                    type="month"
                    required
                    value={payMonth}
                    onChange={e => setPayMonth(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Collected By *</label>
                  <select
                    required
                    value={collectedBy}
                    onChange={e => setCollectedBy(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {FEES_COLLECTORS.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Payment Method *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPayMethod('cash')}
                      className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg border transition ${
                        payMethod === 'cash' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMethod('online')}
                      className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg border transition ${
                        payMethod === 'online' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      ONLINE
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayForm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 text-white text-xs font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition uppercase shadow"
                >
                  {submitting ? 'SAVING...' : 'SAVE RECEIPT'}
                </button>
              </div>
            </form>
          )}

          {/* Timeline Table */}
          {studentTransactions.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Fee Month</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {format(new Date(t.createdAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-700">
                        {t.monthForFee}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 tabular-nums font-mono text-sm">
                        ₹{t.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          t.paymentMethod === 'online' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {t.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {t.collectedBy || t.staffName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No Payment Receipts Found</p>
              <p className="text-xs text-slate-400 mt-1">This student has no fee payments recorded in the system yet.</p>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-800 transition"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
