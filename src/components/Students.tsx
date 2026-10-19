import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { collection, doc, setDoc, deleteDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Trash2, Camera, Edit, Eye, User, CheckCircle, Printer, Receipt, FileText, CheckCircle2, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';
import { compressImage } from '../lib/resizeImage';
import { Student, Transaction } from '../types';
import { COURSES } from '../lib/constants';
import { AdmissionSlipModal } from './AdmissionSlipModal';
import { FeeSlipModal } from './FeeSlipModal';

const Students = () => {
  const { students, attendances, batches, transactions } = useData();
  const { user, isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  // Printing & Downloading Modals State
  const [admissionSlipStudent, setAdmissionSlipStudent] = useState<Student | null>(null);
  const [feeSlipData, setFeeSlipData] = useState<{ student: Student; transaction: Transaction } | null>(null);
  const [newlyCreatedStudent, setNewlyCreatedStudent] = useState<Student | null>(null);

  const [formData, setFormData] = useState({
    name: '', age: '', email: '', phone: '', course: '', batch: '',
    schoolClass: '', schoolName: '', fatherName: '', address: '', image: '', startDate: '', status: 'active',
    registrationFeeStatus: 'done' as 'done' | 'pending',
    registrationFeeAmount: '500',
    admissionFeeStatus: 'done' as 'done' | 'pending',
    admissionFeeAmount: '1000'
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
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchCourse = !filterCourse || s.course.toLowerCase().includes(filterCourse.trim().toLowerCase());
      const matchBatch = !filterBatch || (s.batch && s.batch.toLowerCase().includes(filterBatch.trim().toLowerCase()));
      return matchCourse && matchBatch;
    });
  }, [students, filterCourse, filterBatch]);

  const resetForm = () => {
    setFormData({
      name: '', age: '', email: '', phone: '', course: '', batch: '',
      schoolClass: '', schoolName: '', fatherName: '', address: '', image: '', startDate: '', status: 'active',
      registrationFeeStatus: 'done', registrationFeeAmount: '500',
      admissionFeeStatus: 'done', admissionFeeAmount: '1000'
    });
  };

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
        registrationFeeStatus: formData.registrationFeeStatus,
        registrationFeeAmount: Number(formData.registrationFeeAmount || 500),
        registrationFeeDate: formData.startDate || format(new Date(), 'yyyy-MM-dd'),
        admissionFeeStatus: formData.admissionFeeStatus,
        admissionFeeAmount: Number(formData.admissionFeeAmount || 1000),
        admissionFeeDate: formData.startDate || format(new Date(), 'yyyy-MM-dd'),
        updatedAt: now
      };

      let savedStudent: Student;

      if (editingId) {
        const docRef = doc(db, 'students', editingId);
        await setDoc(docRef, payload, { merge: true });
        savedStudent = { id: editingId, ...payload, createdAt: now, instituteId: 'SevenAI', createdByStaffId: user.uid, createdByStaffName: user.displayName || 'Staff' };
      } else {
        const docRef = doc(collection(db, 'students'));
        payload.id = docRef.id;
        payload.instituteId = 'SevenAI';
        payload.createdByStaffId = user.uid;
        payload.createdByStaffName = user.displayName || user.email || 'Staff';
        payload.createdAt = now;
        await setDoc(docRef, payload);
        savedStudent = payload as Student;

        // Auto-create registration fee transaction if paid
        if (formData.registrationFeeStatus === 'done' && Number(formData.registrationFeeAmount) > 0) {
          const regTxnRef = doc(collection(db, 'transactions'));
          await setDoc(regTxnRef, {
            instituteId: 'SevenAI',
            studentId: docRef.id,
            amount: Number(formData.registrationFeeAmount),
            date: new Date().toISOString(),
            monthForFee: `Registration Fee (${format(new Date(), 'MMM yyyy')})`,
            paymentMethod: 'cash',
            collectedBy: user.displayName || user.email || 'Admin',
            staffId: user.uid,
            staffName: user.displayName || user.email || 'Staff',
            createdAt: now
          });
        }

        // Auto-create admission fee transaction if paid
        if (formData.admissionFeeStatus === 'done' && Number(formData.admissionFeeAmount) > 0) {
          const admTxnRef = doc(collection(db, 'transactions'));
          await setDoc(admTxnRef, {
            instituteId: 'SevenAI',
            studentId: docRef.id,
            amount: Number(formData.admissionFeeAmount),
            date: new Date().toISOString(),
            monthForFee: `Admission Fee (${format(new Date(), 'MMM yyyy')})`,
            paymentMethod: 'cash',
            collectedBy: user.displayName || user.email || 'Admin',
            staffId: user.uid,
            staffName: user.displayName || user.email || 'Staff',
            createdAt: now + 1
          });
        }
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();

      if (!editingId) {
        // Prompt newly created student for instant printing/downloading
        setNewlyCreatedStudent(savedStudent);
      }
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

  const openLatestFeeSlip = (student: Student) => {
    const studentTxns = transactions
      .filter(t => t.studentId === student.id)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (studentTxns.length > 0) {
      setFeeSlipData({ student, transaction: studentTxns[0] });
    } else {
      alert('No fee transactions found for this student yet.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Registry</h2>
          <p className="text-slate-500 text-sm mt-1">Directory of enrolled individuals and admission management</p>
        </div>
        <button 
          onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}
          className="bg-indigo-600 text-white text-xs font-bold rounded-lg shadow hover:bg-indigo-700 transition px-4 py-3 uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={16} /> NEW STUDENT ADMISSION
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center shadow-sm">
         <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Filter By:</div>
         <select 
           value={filterCourse}
           onChange={e => setFilterCourse(e.target.value)}
           className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-auto text-slate-700 font-medium"
         >
           <option value="">All Courses</option>
           {COURSES.map(course => <option key={course} value={course}>{course}</option>)}
         </select>
         <input 
           type="text"
           placeholder="Search Batch (e.g. 2026)"
           value={filterBatch}
           onChange={e => setFilterBatch(e.target.value)}
           className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-auto"
         />
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800 text-base">{editingId ? 'Edit Student Record' : 'New Student Enrolment Form'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="uppercase tracking-widest text-slate-400 hover:text-rose-500 text-[10px] font-bold flex items-center gap-1 transition-colors">
              CLOSE <X size={14}/>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student Face Photo</label>
              <div className="flex items-center gap-4">
                 {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-16 h-16 object-cover rounded-full border border-slate-200 shadow-sm" />
                 ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400">
                       <Camera size={24} />
                    </div>
                 )}
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-100 text-slate-700 text-xs font-bold py-2 px-4 rounded-lg hover:bg-slate-200 transition-colors">
                    {formData.image ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
                 </button>
                 <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Student Full Name" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Age</label>
              <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} placeholder="Age" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="student@gmail.com" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone / Mobile Number *</label>
              <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Mobile Number" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Course Enrolled *</label>
              <select required value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700 font-medium">
                <option value="">Select a Course</option>
                {COURSES.map(course => <option key={course} value={course}>{course}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Batch Identifier</label>
              <select value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700">
                <option value="">Select Batch (Optional)</option>
                {batches.filter(b => !formData.course || b.course === formData.course).map(b => <option key={b.id} value={b.identifier}>{b.identifier} ({b.timing})</option>)}
              </select>
            </div>

            {/* Registration Fee Setup */}
            <div className="md:col-span-2 bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt size={15} className="text-indigo-600" /> Registration Fee Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Registration Fee Status</label>
                  <select 
                    value={formData.registrationFeeStatus} 
                    onChange={e => setFormData({...formData, registrationFeeStatus: e.target.value as 'done' | 'pending'})}
                    className="w-full border border-slate-300 bg-white rounded-lg p-2.5 font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="done">🟢 Registration Fee Done / Paid</option>
                    <option value="pending">🟠 Registration Fee Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Registration Fee Amount (₹)</label>
                  <input 
                    type="number" 
                    value={formData.registrationFeeAmount} 
                    onChange={e => setFormData({...formData, registrationFeeAmount: e.target.value})}
                    placeholder="500"
                    className="w-full border border-slate-300 bg-white rounded-lg p-2.5 font-mono font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Admission Fee Status Options */}
            <div className="md:col-span-2 bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt size={15} className="text-indigo-600" /> Admission Fee Payment Setup
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Admission Fee Status</label>
                  <select 
                    value={formData.admissionFeeStatus} 
                    onChange={e => setFormData({...formData, admissionFeeStatus: e.target.value as 'done' | 'pending'})}
                    className="w-full border border-indigo-200 bg-white rounded-lg p-2.5 font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="done">🟢 Admission Fee Done / Paid</option>
                    <option value="pending">🟠 Admission Fee Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Admission Fee Amount (₹)</label>
                  <input 
                    type="number" 
                    value={formData.admissionFeeAmount} 
                    onChange={e => setFormData({...formData, admissionFeeAmount: e.target.value})}
                    placeholder="1000"
                    className="w-full border border-indigo-200 bg-white rounded-lg p-2.5 font-mono font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Class / Grade</label>
              <input value={formData.schoolClass} onChange={e => setFormData({...formData, schoolClass: e.target.value})} placeholder="e.g. 10th" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">School / College Name</label>
              <input value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} placeholder="School Name" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Father's / Guardian Name</label>
              <input value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} placeholder="Father's Name" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student Address</label>
              <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Complete Residential Address" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Enrolment Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-slate-700">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Course Joining Date</label>
              <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors text-sm" />
            </div>

            <div className="md:col-span-2 pt-4 flex gap-3">
              <button disabled={submitting} type="submit" className="bg-slate-900 text-white font-bold text-xs uppercase tracking-widest py-3 px-8 rounded-lg shadow hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer">
                {submitting ? 'SAVING...' : (editingId ? 'UPDATE STUDENT RECORD' : 'SAVE STUDENT & GENERATE SLIP')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest py-3 px-6 rounded-lg hover:bg-slate-200 transition-colors">
                CANCEL
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Student List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Details</th>
                <th className="px-5 py-3.5">Course & Batch</th>
                <th className="px-5 py-3.5">Registration Fee</th>
                <th className="px-5 py-3.5">Admission Fee</th>
                <th className="px-5 py-3.5">Contact Info</th>
                <th className="px-5 py-3.5">Attendance</th>
                <th className="px-5 py-3.5 border-l border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(student => {
                const isRegFeeDone = student.registrationFeeStatus === 'done' || (student.registrationFeeAmount && student.registrationFeeAmount > 0 && student.registrationFeeStatus !== 'pending');
                const isAdmissionFeeDone = student.admissionFeeStatus === 'done' || (student.admissionFeeAmount && student.admissionFeeAmount > 0 && student.admissionFeeStatus !== 'pending');

                return (
                  <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                         {student.image ? (
                            <img src={student.image} alt={student.name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm" />
                         ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 border border-slate-200">{student.name.charAt(0)}</div>
                         )}
                         <div>
                           <p className="font-semibold text-slate-800 text-sm">{student.name} {student.age ? `(${student.age})` : ''}</p>
                           <p className="text-[10px] font-normal text-slate-400 mt-0.5">Joined: {format(new Date(student.createdAt), 'MMM dd, yyyy')}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-700 text-xs">{student.schoolName || '-'}</p>
                      <p className="text-[10px] mt-0.5 text-slate-500">Class {student.schoolClass || '-'} | Father: {student.fatherName || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-800 text-xs">{student.course}</span>
                      {student.batch && <span className="ml-2 bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">{student.batch}</span>}
                    </td>

                    {/* Registration Fee Column */}
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${
                        isRegFeeDone ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isRegFeeDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {isRegFeeDone ? `Paid (₹${student.registrationFeeAmount || 500})` : `Pending (₹${student.registrationFeeAmount || 500})`}
                      </span>
                    </td>

                    {/* Admission Fee Column */}
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${
                        isAdmissionFeeDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isAdmissionFeeDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {isAdmissionFeeDone ? `Paid (₹${student.admissionFeeAmount || 1000})` : `Pending (₹${student.admissionFeeAmount || 1000})`}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-500">
                      <p className="font-medium text-slate-700 text-xs">{student.phone || 'N/A'}</p>
                      <p className="text-[11px] mt-0.5">{student.email || 'N/A'}</p>
                    </td>
                    <td className="px-5 py-4">
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
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${percentage >= 75 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 border-l border-slate-100 bg-slate-50/40 text-right">
                      {deleteConfirmId === student.id ? (
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[9px] uppercase tracking-wider text-rose-500 font-bold">Delete?</span>
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                            <button onClick={() => handleDelete(student.id)} className="text-[10px] uppercase font-bold text-rose-600 hover:text-rose-700">Yes</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 flex-nowrap">
                          {/* Admission Slip Button */}
                          <button
                            onClick={() => setAdmissionSlipStudent(student)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all"
                            title="Admission Slip (Print / Download)"
                          >
                            <Printer size={13} /> Admission Slip
                          </button>

                          {/* Fee Slip Button */}
                          <button
                            onClick={() => openLatestFeeSlip(student)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all"
                            title="Fee Slip (Print / Download)"
                          >
                            <Receipt size={13} /> Fee Slip
                          </button>

                          <button 
                            onClick={() => setViewingStudent(student)} 
                            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-100"
                            title="View Profile"
                          >
                            <Eye size={16} />
                          </button>

                          {isAdmin && (
                            <>
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
                                className={`p-1.5 ${student.status === 'completed' ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-600'} transition rounded-lg hover:bg-slate-100`}
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
                                    status: student.status || 'active',
                                    registrationFeeStatus: student.registrationFeeStatus || 'done',
                                    registrationFeeAmount: student.registrationFeeAmount?.toString() || '500',
                                    admissionFeeStatus: student.admissionFeeStatus || 'done',
                                    admissionFeeAmount: student.admissionFeeAmount?.toString() || '1000'
                                  });
                                  setShowForm(true);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }} 
                                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-100"
                                title="Edit Record"
                              >
                                <Edit size={16} />
                              </button>
                            </>
                          )}
                          <button onClick={() => setDeleteConfirmId(student.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-slate-100" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && students.length > 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 text-sm">No students match your filters.</td>
                </tr>
              )}
              {students.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 text-sm">No students found. Add one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Profile View Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setViewingStudent(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs flex items-center gap-2">
                <User size={16} className="text-indigo-500" />
                Student Details Profile
              </h3>
              <button onClick={() => setViewingStudent(null)} className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 p-1.5 rounded-full">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center gap-6">
               {viewingStudent.image ? (
                  <img src={viewingStudent.image} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-slate-50 shadow-md" />
               ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center font-bold text-2xl text-slate-400 border-4 border-white shadow-md">
                    {viewingStudent.name.charAt(0)}
                  </div>
               )}
               <div>
                  <h2 className="text-2xl font-black text-slate-900">{viewingStudent.name} {viewingStudent.age ? `(${viewingStudent.age} yrs)` : ''}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md text-[11px] uppercase tracking-wider font-extrabold">
                      {viewingStudent.course}
                    </span>
                    {viewingStudent.batch && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wider font-bold">{viewingStudent.batch}</span>}
                  </div>
               </div>
              </div>

               {/* Quick Action Buttons */}
               <div className="flex gap-3">
                 <button
                   onClick={() => setAdmissionSlipStudent(viewingStudent)}
                   className="flex-1 bg-indigo-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                 >
                   <Printer size={15} /> Admission Slip
                 </button>
                 <button
                   onClick={() => openLatestFeeSlip(viewingStudent)}
                   className="flex-1 bg-emerald-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                 >
                   <Receipt size={15} /> Fee Slip
                 </button>
               </div>

               <div className="grid grid-cols-2 gap-y-5 gap-x-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Email</label>
                    <p className="text-xs font-semibold text-slate-800 break-all">{viewingStudent.email || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Phone</label>
                    <p className="text-xs font-semibold text-slate-800">{viewingStudent.phone || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Registration Fee</label>
                    <p className={`text-xs font-bold inline-flex items-center gap-1 ${
                      viewingStudent.registrationFeeStatus === 'done' ? 'text-indigo-600' : 'text-amber-600'
                    }`}>
                      {viewingStudent.registrationFeeStatus === 'done' ? '🟢 DONE' : '🟠 PENDING'} (₹{viewingStudent.registrationFeeAmount || 500})
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Admission Fee Status</label>
                    <p className={`text-xs font-bold inline-flex items-center gap-1 ${
                      viewingStudent.admissionFeeStatus === 'done' ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {viewingStudent.admissionFeeStatus === 'done' ? '🟢 DONE' : '🟠 PENDING'} (₹{viewingStudent.admissionFeeAmount || 1000})
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Father's Name</label>
                    <p className="text-xs font-semibold text-slate-800">{viewingStudent.fatherName || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Joining Date</label>
                    <p className="text-xs font-semibold text-slate-800">{viewingStudent.startDate ? format(new Date(viewingStudent.startDate + 'T00:00:00'), 'dd MMM yyyy') : '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Residential Address</label>
                    <p className="text-xs font-semibold text-slate-800">{viewingStudent.address || '-'}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-Creation Success Modal */}
      {newlyCreatedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Student Admission Registered!</h3>
              <p className="text-xs text-slate-500 mt-1">
                <strong>{newlyCreatedStudent.name}</strong> enrolled in <strong>{newlyCreatedStudent.course}</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  const s = newlyCreatedStudent;
                  setNewlyCreatedStudent(null);
                  setAdmissionSlipStudent(s);
                }}
                className="w-full bg-indigo-600 text-white font-bold text-xs py-3 px-4 rounded-xl shadow hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <Printer size={16} /> OPEN ADMISSION SLIP (PRINT / DOWNLOAD)
              </button>

              <button
                onClick={() => {
                  const s = newlyCreatedStudent;
                  setNewlyCreatedStudent(null);
                  openLatestFeeSlip(s);
                }}
                className="w-full bg-emerald-600 text-white font-bold text-xs py-3 px-4 rounded-xl shadow hover:bg-emerald-700 transition flex items-center justify-center gap-2"
              >
                <Receipt size={16} /> OPEN FEE RECEIPT (PRINT / DOWNLOAD)
              </button>

              <button
                onClick={() => setNewlyCreatedStudent(null)}
                className="w-full border border-slate-200 text-slate-600 font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-slate-50 transition"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admission Slip Printable & Downloadable Modal */}
      {admissionSlipStudent && (
        <AdmissionSlipModal
          student={admissionSlipStudent}
          onClose={() => setAdmissionSlipStudent(null)}
        />
      )}

      {/* Fee Slip Printable & Downloadable Modal */}
      {feeSlipData && (
        <FeeSlipModal
          student={feeSlipData.student}
          transaction={feeSlipData.transaction}
          onClose={() => setFeeSlipData(null)}
        />
      )}

    </div>
  );
};

export default Students;
