import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { collection, doc, setDoc, deleteDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Trash2, Camera, Edit, Eye, User, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { compressImage } from '../lib/resizeImage';
import { Student } from '../types';
import { COURSES } from '../lib/constants';

const Students = () => {
  const { students, attendances, batches } = useData();
  const { user, isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  const [formData, setFormData] = useState({
    name: '', age: '', email: '', phone: '', course: '', batch: '',
    schoolClass: '', schoolName: '', fatherName: '', address: '', image: '', startDate: '', status: 'active'
  });
  
  const [filterCourse, setFilterCourse] = useState('');
  const [filterBatch, setFilterBatch] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file);
      setFormData(prev => ({ ...prev, image: base64 }));
    } catch (err) {
      console.error('Image compression failed', err);
      console.error('Failed to process image');
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchCourse = !filterCourse || s.course.toLowerCase().includes(filterCourse.trim().toLowerCase());
      const matchBatch = !filterBatch || (s.batch && s.batch.toLowerCase().includes(filterBatch.trim().toLowerCase()));
      return matchCourse && matchBatch;
    });
  }, [students, filterCourse, filterBatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const now = Date.now();
      const payload: any = {
        name: formData.name,
        age: formData.age || '',
        email: formData.email,
        phone: formData.phone,
        course: formData.course,
        batch: formData.batch,
        schoolClass: formData.schoolClass || '',
        schoolName: formData.schoolName || '',
        fatherName: formData.fatherName || '',
        address: formData.address || '',
        image: formData.image || '',
        startDate: formData.startDate || '',
        status: formData.status || 'active',
        updatedAt: now
      };

      if (editingId) {
        const docRef = doc(db, 'students', editingId);
        await setDoc(docRef, payload, { merge: true });
      } else {
        const docRef = doc(collection(db, 'students'));
        payload.instituteId = 'SevenAI';
        payload.createdByStaffId = user.uid;
        payload.createdByStaffName = user.displayName || user.email || 'Staff';
        payload.createdAt = now;
        await setDoc(docRef, payload);
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', age: '', email: '', phone: '', course: '', batch: '', schoolClass: '', schoolName: '', fatherName: '', address: '', image: '', startDate: '', status: 'active' });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'students');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const q = query(collection(db, 'transactions'), where('instituteId', '==', 'SevenAI'), where('studentId', '==', id));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      batch.delete(doc(db, 'students', id));
      
      await batch.commit();
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'students/transactions');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Registry</h2>
          <p className="text-slate-500 text-sm mt-1">Directory of enrolled individuals</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white text-xs font-bold rounded shadow hover:bg-indigo-700 transition px-4 py-3 uppercase tracking-wide flex items-center justify-center gap-2"
        >
          <Plus size={16} /> NEW RECORD
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
         <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Filter By:</div>
         <select 
           value={filterCourse}
           onChange={e => setFilterCourse(e.target.value)}
           className="border border-slate-200 bg-slate-50 rounded px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-auto text-slate-700"
         >
           <option value="">All Courses</option>
           {COURSES.map(course => <option key={course} value={course}>{course}</option>)}
         </select>
         <input 
           type="text"
           placeholder="Batch (e.g. 2024)"
           value={filterBatch}
           onChange={e => setFilterBatch(e.target.value)}
           className="border border-slate-200 bg-slate-50 rounded px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-auto"
         />
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-700">{editingId ? 'Edit Student Record' : 'Add New Student'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); setFormData({ name: '', age: '', email: '', phone: '', course: '', batch: '', schoolClass: '', schoolName: '', fatherName: '', address: '', image: '', startDate: '', status: 'active' }); }} className="uppercase tracking-widest text-slate-400 hover:text-rose-500 text-[10px] font-bold flex items-center gap-1 transition-colors">
              CLOSE <X size={14}/>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student Face Photo (Required for AI Attendance)</label>
              <div className="flex items-center gap-4">
                 {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-16 h-16 object-cover rounded-full border border-slate-200" />
                 ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400">
                       <Camera size={24} />
                    </div>
                 )}
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-100 text-slate-700 text-xs font-bold py-2 px-4 rounded hover:bg-slate-200">
                    {formData.image ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
                 </button>
                 <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Age</label>
              <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Course Enrolled *</label>
              <select required value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-slate-700">
                <option value="">Select a Course</option>
                {COURSES.map(course => <option key={course} value={course}>{course}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Batch Identifier</label>
              <select value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-slate-700">
                <option value="">Select Batch (Optional)</option>
                {batches.filter(b => !formData.course || b.course === formData.course).map(b => <option key={b.id} value={b.identifier}>{b.identifier} ({b.timing})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Class / Grade</label>
              <input value={formData.schoolClass} onChange={e => setFormData({...formData, schoolClass: e.target.value})} placeholder="e.g. 10th" className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors placeholder:text-slate-300" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">School Name</label>
              <input value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Father's Name</label>
              <input value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
              <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-slate-700">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Course Start Date</label>
              <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors text-sm" />
            </div>
            <div className="md:col-span-2 pt-4">
              <button disabled={submitting} type="submit" className="w-full md:w-auto bg-slate-900 text-white font-bold text-xs uppercase tracking-widest py-3 px-8 rounded shadow hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {submitting ? 'PROCESSING...' : (editingId ? 'UPDATE STUDENT RECORD' : 'SAVE STUDENT RECORD')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-3">Student Name</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3">Enrollment Data</th>
                <th className="px-6 py-3">Contact Info</th>
                <th className="px-6 py-3">Attendance</th>
                <th className="px-6 py-3 border-l border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       {student.image ? (
                          <img src={student.image} alt={student.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                       ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500">{student.name.charAt(0)}</div>
                       )}
                       <div>
                         <p className="font-medium text-slate-700">{student.name} {student.age ? `(${student.age})` : ''}</p>
                         <p className="text-[10px] font-normal text-slate-400 mt-0.5">Joined: {format(new Date(student.createdAt), 'MMM yyyy')}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-700 text-xs">{student.schoolName || '-'}</p>
                    <p className="text-[10px] mt-0.5 text-slate-500">Class {student.schoolClass || '-'} | Father: {student.fatherName || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-700">{student.course}</span>
                    {student.batch && <span className="ml-2 bg-indigo-50 text-indigo-700 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">{student.batch}</span>}
                    {student.startDate && (
                       <p className="text-[10px] text-slate-500 font-medium mt-1">Starts: {format(new Date(student.startDate + 'T00:00:00'), 'MMM dd, yyyy')}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <p className="font-medium text-slate-700">{student.phone || 'N/A'}</p>
                    <p className="text-[11px] mt-0.5">{student.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const totalClasses = attendances ? attendances.length : 0;
                      const presentClasses = attendances ? attendances.filter(a => a.presentStudents && a.presentStudents.includes(student.id)).length : 0;
                      const percentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
                      
                      return (
                        <div>
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                            <span className="text-slate-500">{presentClasses}/{totalClasses} Days</span>
                            <span className={percentage >= 75 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : percentage > 0 ? 'text-rose-600' : 'text-slate-400'}>{percentage}%</span>
                          </div>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${percentage >= 75 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 border-l border-slate-100 bg-indigo-50/20 text-right">
                    {deleteConfirmId === student.id ? (
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[9px] uppercase tracking-wider text-rose-500 font-bold">Delete?</span>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                          <button onClick={() => handleDelete(student.id)} className="text-[10px] uppercase font-bold text-rose-600 hover:text-rose-700">Yes</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-3 flex-nowrap">
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => setViewingStudent(student)} 
                              className="text-slate-400 hover:text-emerald-600 transition-colors"
                              title="View Profile"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={async () => {
                                if (student.status === 'completed') {
                                  if (!confirm('Mark student as active?')) return;
                                  try {
                                    await setDoc(doc(db, 'students', student.id), { status: 'active' }, { merge: true });
                                  } catch (err) { handleFirestoreError(err, OperationType.UPDATE, 'students'); }
                                } else {
                                  if (!confirm('Mark student course as completed?')) return;
                                  try {
                                    await setDoc(doc(db, 'students', student.id), { status: 'completed' }, { merge: true });
                                  } catch (err) { handleFirestoreError(err, OperationType.UPDATE, 'students'); }
                                }
                              }}
                              className={`${student.status === 'completed' ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-emerald-600'} transition`}
                              title={student.status === 'completed' ? 'Mark Active' : 'Mark Completed'}
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingId(student.id);
                              setFormData({
                                name: student.name || '',
                                age: student.age?.toString() || '',
                                email: student.email || '',
                                phone: student.phone || '',
                                course: student.course || '',
                                batch: student.batch || '',
                                schoolClass: student.schoolClass || '',
                                schoolName: student.schoolName || '',
                                fatherName: student.fatherName || '',
                                address: student.address || '',
                                image: student.image || '',
                                startDate: student.startDate || '',
                                status: student.status || 'active'
                              });
                              setShowForm(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} 
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          </>
                        )}
                        <button onClick={() => setDeleteConfirmId(student.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && students.length > 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">No students match your filters.</td>
                </tr>
              )}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">No students found. Add one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewingStudent(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-700 uppercase tracking-widest text-sm flex items-center gap-2">
                <User size={16} className="text-indigo-500" />
                Student Profile
              </h3>
              <button onClick={() => setViewingStudent(null)} className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 p-1.5 rounded-full">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center gap-6 mb-8">
               {viewingStudent.image ? (
                  <img src={viewingStudent.image} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-slate-50 shadow-sm" />
               ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center font-bold text-2xl text-slate-400 border-4 border-white shadow-sm">
                    {viewingStudent.name.charAt(0)}
                  </div>
               )}
               <div>
                  <h2 className="text-2xl font-bold text-slate-800">{viewingStudent.name} {viewingStudent.age ? `(${viewingStudent.age} yrs)` : ''}</h2>
                  <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded textxs uppercase tracking-wider font-bold">
                      {viewingStudent.course}
                    </span>
                    {viewingStudent.batch && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded textxs uppercase tracking-wider font-bold">{viewingStudent.batch}</span>}
                  </p>
               </div>
              </div>

               <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</label>
                    <p className="text-sm font-medium text-slate-700">{viewingStudent.email || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</label>
                    <p className="text-sm font-medium text-slate-700">{viewingStudent.phone || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Father's Name</label>
                    <p className="text-sm font-medium text-slate-700">{viewingStudent.fatherName || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">School</label>
                    <p className="text-sm font-medium text-slate-700">{viewingStudent.schoolName || '-'} {viewingStudent.schoolClass ? `(Class ${viewingStudent.schoolClass})` : ''}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Address</label>
                    <p className="text-sm font-medium text-slate-700">{viewingStudent.address || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Course Start Date</label>
                    <p className="text-sm font-medium text-slate-700">{viewingStudent.startDate ? format(new Date(viewingStudent.startDate + 'T00:00:00'), 'MMMM dd, yyyy') : '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registered On</label>
                    <p className="text-sm font-medium text-slate-700">{format(new Date(viewingStudent.createdAt), 'MMMM dd, yyyy')}</p>
                  </div>
               </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
