import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { format, parseISO } from 'date-fns';
import { IndianRupee, Users, TrendingUp, Receipt, Trash2, Wallet, CreditCard, UserCheck, GraduationCap, BookOpen } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FEES_COLLECTORS, COURSES } from '../lib/constants';

const Dashboard = () => {
  const { students, transactions, expenses, officeEarnings, loading } = useData();
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'transactions');
    }
  };

  const stats = useMemo(() => {
    const totalRev = transactions.reduce((sum, t) => sum + t.amount, 0);
    const currMonth = format(new Date(), 'yyyy-MM');
    const monthlyRev = transactions
      .filter(t => t.monthForFee === currMonth)
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      totalRev,
      monthlyRev,
      totalStudents: students.length,
      monthlyCount: transactions.filter(t => t.monthForFee === currMonth).length
    };
  }, [transactions, students]);

  const feesByPerson = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    
    FEES_COLLECTORS.forEach(person => {
      map[person] = { total: 0, count: 0 };
    });

    const allEarnings = [
      ...transactions.map(t => ({ amount: t.amount, person: t.collectedBy || t.staffName || 'Unassigned' })),
      ...officeEarnings.map(o => ({ amount: o.amount, person: o.collectedBy || o.staffName || 'Unassigned' }))
    ];

    allEarnings.forEach(item => {
      const p = item.person.trim() || 'Unassigned';
      if (!map[p]) map[p] = { total: 0, count: 0 };
      map[p].total += item.amount;
      map[p].count += 1;
    });

    return Object.entries(map)
      .map(([person, data]) => ({ person, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, officeEarnings]);

  const expensesByPerson = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};

    FEES_COLLECTORS.forEach(person => {
      map[person] = { total: 0, count: 0 };
    });

    expenses.forEach(exp => {
      const p = (exp.paidBy || exp.staffName || 'Unassigned').trim();
      if (!map[p]) map[p] = { total: 0, count: 0 };
      map[p].total += exp.amount;
      map[p].count += 1;
    });

    return Object.entries(map)
      .map(([person, data]) => ({ person, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const feesByCourse = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};

    COURSES.forEach(c => {
      map[c] = { total: 0, count: 0 };
    });

    transactions.forEach(t => {
      const student = students.find(s => s.id === t.studentId);
      const course = student?.course?.trim() || 'General / Other';
      if (!map[course]) {
        map[course] = { total: 0, count: 0 };
      }
      map[course].total += t.amount;
      map[course].count += 1;
    });

    if (officeEarnings.length > 0) {
      const officeTotal = officeEarnings.reduce((sum, o) => sum + o.amount, 0);
      map['Office Earnings'] = { total: officeTotal, count: officeEarnings.length };
    }

    return Object.entries(map)
      .map(([course, data]) => ({ course, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, students, officeEarnings]);

  const chartData = useMemo(() => {
    // group by monthForFee for chart
    const monthly = transactions.reduce((acc, t) => {
      acc[t.monthForFee] = (acc[t.monthForFee] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(monthly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({
        name: format(parseISO(`${month}-01`), 'MMM yy'),
        amount
      })).slice(-6); // last 6 months
  }, [transactions]);

  if (loading) return <div className="text-slate-500 text-sm">Loading dashboard metrics...</div>;

  const totalFeesCollectedAll = feesByPerson.reduce((acc, item) => acc + item.total, 0);
  const totalExpensesPaidAll = expensesByPerson.reduce((acc, item) => acc + item.total, 0);
  const totalFeesByCourseAll = feesByCourse.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
          <p className="text-slate-500 text-sm">Automated billing period: {format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center">
            SYSTEM ACTIVE
          </div>
        </div>
      </header>
      
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 p-5 rounded-lg flex flex-col justify-between min-h-[128px]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</span>
          <span className="text-2xl font-bold">₹{stats.totalRev.toLocaleString()}</span>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-lg flex flex-col justify-between min-h-[128px]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month's Revenue</span>
          <span className="text-2xl font-bold">₹{stats.monthlyRev.toLocaleString()}</span>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-lg flex flex-col justify-between min-h-[128px]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Students</span>
          <span className="text-2xl font-bold">{stats.totalStudents}</span>
        </div>
        <div className="bg-indigo-600 p-5 rounded-lg flex flex-col justify-between shadow-lg shadow-indigo-100 text-white min-h-[128px]">
          <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Fees Received</span>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold">{stats.monthlyCount}</span>
            <span className="text-[10px] bg-indigo-500/50 px-2 py-1 rounded font-bold">THIS MONTH</span>
          </div>
        </div>
      </section>

      {/* Financial Attribution & Course Breakdown Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fees Collected By Person */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Wallet size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Total Fees Collected By Person</h3>
                <p className="text-xs text-slate-400">Attributed fee & office earnings</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
              ₹{totalFeesCollectedAll.toLocaleString()}
            </span>
          </div>

          <div className="space-y-4 flex-1">
            {feesByPerson.map(item => {
              const percent = totalFeesCollectedAll > 0 ? Math.round((item.total / totalFeesCollectedAll) * 100) : 0;
              return (
                <div key={item.person} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <UserCheck size={14} className="text-indigo-500" />
                      {item.person}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-normal">({item.count} txns)</span>
                      <span className="text-slate-900 font-bold">₹{item.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expenses Paid By Person */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <CreditCard size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Total Expenses Paid By Person</h3>
                <p className="text-xs text-slate-400">Outbound expense payments</p>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded">
              ₹{totalExpensesPaidAll.toLocaleString()}
            </span>
          </div>

          <div className="space-y-4 flex-1">
            {expensesByPerson.map(item => {
              const percent = totalExpensesPaidAll > 0 ? Math.round((item.total / totalExpensesPaidAll) * 100) : 0;
              return (
                <div key={item.person} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <UserCheck size={14} className="text-rose-500" />
                      {item.person}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-normal">({item.count} items)</span>
                      <span className="text-slate-900 font-bold">₹{item.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fee Collection By Course */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <GraduationCap size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Fee Collection By Course</h3>
                <p className="text-xs text-slate-400">Revenue per course offering</p>
              </div>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded">
              ₹{totalFeesByCourseAll.toLocaleString()}
            </span>
          </div>

          <div className="space-y-4 flex-1">
            {feesByCourse.map(item => {
              const percent = totalFeesByCourseAll > 0 ? Math.round((item.total / totalFeesByCourseAll) * 100) : 0;
              return (
                <div key={item.course} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 flex items-center gap-1.5 truncate max-w-[170px]" title={item.course}>
                      <BookOpen size={14} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{item.course}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-normal">({item.count} txns)</span>
                      <span className="text-slate-900 font-bold">₹{item.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white">
            <h3 className="font-bold text-slate-700">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3 border-l border-slate-200 font-bold text-indigo-600">Collected By</th>
                  <th className="px-6 py-3 border-l border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.slice(0, 7).map(t => {
                  const student = students.find(s => s.id === t.studentId);
                  const isOnline = t.paymentMethod === 'online';
                  const collector = t.collectedBy || t.staffName || 'Staff';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {student?.name || 'Unknown'}
                        <p className="text-[10px] font-normal text-slate-400 mt-0.5">{format(new Date(t.createdAt), 'dd MMM yyyy')}</p>
                      </td>
                      <td className="px-6 py-4 font-bold">₹{t.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${isOnline ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                          {t.paymentMethod}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-l border-slate-100 bg-indigo-50/20">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-[8px] flex items-center justify-center font-bold text-indigo-700">
                            {collector.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{collector}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-l border-slate-100 bg-indigo-50/20 text-right">
                        {deleteConfirmId === t.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                            <button onClick={() => handleDelete(t.id)} className="text-[10px] uppercase font-bold text-rose-600 hover:text-rose-700">Yes, Delete</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(t.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-center text-xs text-slate-500 font-medium">
                    Showing latest 7 transactions
                  </td>
                </tr>
              </tfoot>
            </table>
            {transactions.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">No transactions found.</div>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col text-slate-900">
           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Revenue Trend (6M)</h4>
           <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#334155'}} />
                  <Bar dataKey="amount" fill="#4f46e5" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
