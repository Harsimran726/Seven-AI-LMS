import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { COURSES } from '../lib/constants';

const Batches = () => {
  const { batches } = useData();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    identifier: '', course: '', startDate: '', timing: '', teacher: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const now = Date.now();
      const payload: any = {
        instituteId: 'SevenAI',
        identifier: formData.identifier,
        course: formData.course,
        startDate: formData.startDate,
        timing: formData.timing,
        teacher: formData.teacher,
        createdAt: now
      };
      const docRef = doc(collection(db, 'batches'));
      await setDoc(docRef, payload);
      setShowForm(false);
      setFormData({ identifier: '', course: '', startDate: '', timing: '', teacher: ''});
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'batches');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;
    try {
      await deleteDoc(doc(db, 'batches', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'batches');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Batch Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage class batches and schedules</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white text-xs font-bold rounded shadow hover:bg-indigo-700 transition px-4 py-3 uppercase tracking-wide flex items-center justify-center gap-2"
        >
          <Plus size={16} /> NEW BATCH
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-700">Add New Batch</h3>
            <button onClick={() => setShowForm(false)} className="uppercase tracking-widest text-slate-400 hover:text-rose-500 text-[10px] font-bold flex items-center gap-1 transition-colors">
              CLOSE <X size={14}/>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Batch Identifier *</label>
              <input required value={formData.identifier} onChange={e => setFormData({...formData, identifier: e.target.value})} placeholder="e.g. Web-Morning" className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Course *</label>
              <select required value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700">
                <option value="">Select a Course</option>
                {COURSES.map(course => <option key={course} value={course}>{course}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date *</label>
              <input required type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Timing *</label>
              <div className="flex gap-2">
                <input required type="time" value={formData.timing.split(' - ')[0] || ''} onChange={e => setFormData({...formData, timing: `${e.target.value} - ${formData.timing.split(' - ')[1] || ''}`})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
                <span className="self-center font-bold text-slate-400">TO</span>
                <input required type="time" value={formData.timing.split(' - ')[1] || ''} onChange={e => setFormData({...formData, timing: `${formData.timing.split(' - ')[0] || ''} - ${e.target.value}`})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Teacher Name *</label>
              <select required value={formData.teacher} onChange={e => setFormData({...formData, teacher: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700">
                <option value="" disabled>Select a Teacher</option>
                <option value="Harsimran Singh">Harsimran Singh</option>
                <option value="Nishant Mittal">Nishant Mittal</option>
                <option value="Nikhil Mittal">Nikhil Mittal</option>
              </select>
            </div>
            
            <div className="md:col-span-2 pt-4">
              <button disabled={submitting} type="submit" className="w-full md:w-auto bg-slate-900 text-white font-bold text-xs uppercase tracking-widest py-3 px-8 rounded shadow hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {submitting ? 'SAVING...' : 'SAVE BATCH'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100 text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold">
            <tr>
              <th className="px-6 py-3">Batch Identifier</th>
              <th className="px-6 py-3">Course</th>
              <th className="px-6 py-3">Start Date</th>
              <th className="px-6 py-3">Timing</th>
              <th className="px-6 py-3">Teacher</th>
              <th className="px-6 py-3 border-l border-slate-200 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map(batch => (
              <tr key={batch.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-bold text-slate-700">{batch.identifier}</td>
                <td className="px-6 py-4">{batch.course}</td>
                <td className="px-6 py-4">{format(new Date(batch.startDate + 'T00:00:00'), 'MMM dd, yyyy')}</td>
                <td className="px-6 py-4">{batch.timing}</td>
                <td className="px-6 py-4 font-medium text-slate-700">{batch.teacher}</td>
                <td className="px-6 py-4 text-right border-l border-slate-100">
                  <button onClick={() => handleDelete(batch.id)} className="text-slate-400 hover:text-rose-600 transition">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">No batches created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Batches;
