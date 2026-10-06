import React, { useRef, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Download,  Camera, Upload, Users, Loader2, CheckCircle2, Calendar, Trash2  } from 'lucide-react';
import { format } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

const Attendance = () => {
  const { students, attendances, batches } = useData();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'take' | 'manual' | 'history' | 'student-tracker'>('take');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [viewingNote, setViewingNote] = useState<string | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<{ record: any, studentId: string } | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<any | null>(null);
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [aiBatch, setAiBatch] = useState('');
  const [presentStudents, setPresentStudents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualNote, setManualNote] = useState('');
  const [manualBatch, setManualBatch] = useState('');
  const [manualPresent, setManualPresent] = useState<string[]>([]);
  const [manualAbsent, setManualAbsent] = useState<string[]>([]);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [manualIsNoClass, setManualIsNoClass] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSavedMsg, setManualSavedMsg] = useState('');
  const [manualDirty, setManualDirty] = useState(false);
  
  const filteredStudents = manualBatch ? students.filter(s => s.batch === manualBatch) : students;

  React.useEffect(() => {
    if (manualDirty) return;
    // Check if there's an existing record for the selected date and batch
    const existingRecord = attendances.find(a => 
      a.date === manualDate && (manualBatch ? a.batch === manualBatch : !a.batch)
    );
    if (existingRecord) {
      setManualIsNoClass(!!existingRecord.isNoClass);
      setManualPresent(existingRecord.presentStudents || []);
      setManualAbsent(existingRecord.absentStudents || []);
      setManualNote(existingRecord.note || '');
      setExistingRecordId(existingRecord.id);
    } else {
      setManualIsNoClass(false);
      setManualPresent([]);
      setManualAbsent([]);
      setManualNote('');
      setExistingRecordId(null);
    }
  }, [manualDate, manualBatch, attendances]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
      setPresentStudents([]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRecognize = async () => {
    if (!imageBase64 || !imagePreview) return;
    setProcessing(true);
    setError(null);
    try {
      // Lazy load face-api
      const faceapi = await import('@vladmandic/face-api');
      
      const modelUrl = '/models';
      
      // Load models if not loaded yet
      if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);
      }

      // Helper to load image
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      // 1. Process reference images
      const labeledFaceDescriptors = [];
      const targetStudents = aiBatch ? students.filter(s => s.batch === aiBatch) : students;
      for (const student of targetStudents) {
        if (!student.image) continue;
        try {
          const img = await loadImage(student.image);
          const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
          if (detection) {
            labeledFaceDescriptors.push(
              new faceapi.LabeledFaceDescriptors(student.id, [detection.descriptor])
            );
          }
        } catch (e) {
          console.warn(`Could not process reference image for ${student.name}`);
        }
      }

      if (labeledFaceDescriptors.length === 0) {
        throw new Error('No valid reference faces found for students. Please add student photos first.');
      }

      const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

      // 2. Process classroom image
      const classImg = await loadImage(imageBase64);
      const detections = await faceapi.detectAllFaces(classImg).withFaceLandmarks().withFaceDescriptors();

      if (detections.length === 0) {
        throw new Error('No faces detected in the classroom photo.');
      }

      // 3. Match faces
      const presentIds = new Set<string>();
      detections.forEach(d => {
        const bestMatch = faceMatcher.findBestMatch(d.descriptor);
        if (bestMatch.label !== 'unknown') {
          presentIds.add(bestMatch.label);
        }
      });

      setPresentStudents(Array.from(presentIds));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during recognition');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('Delete this attendance record?')) return;
    try {
      await deleteDoc(doc(db, 'attendances', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'attendances');
    }
  };

  const exportToCSV = () => {
    // Collect all unique attendance sessions
    const sortedAtts = [...attendances].sort((a, b) => a.timestamp - b.timestamp);
    const sessionHeaders = sortedAtts.map(a => {
      const dateStr = format(new Date(a.timestamp), 'MMM d, yyyy');
      return a.batch ? `${dateStr} (${a.batch})` : dateStr;
    });

    let csvContent = "Student Name,Course,Batch,Total Present,Total Absent,Attendance %," + sessionHeaders.join(",") + "\n";

    students.forEach(student => {
      let presentCount = 0;
      let absentCount = 0;
      let sessionData = [];

      sortedAtts.forEach(att => {
        if (att.isNoClass) {
          sessionData.push("No Class");
          return;
        }
        
        // If the attendance is for a specific batch, and this student is not in that batch, skip
        if (att.batch && student.batch && att.batch !== student.batch) {
          sessionData.push("N/A");
          return;
        }

        const isP = att.presentStudents?.includes(student.id);
        const isA = att.absentStudents?.includes(student.id);
        
        if (isP) {
          presentCount++;
          sessionData.push("P");
        } else if (isA) {
          absentCount++;
          sessionData.push("A");
        } else {
          sessionData.push("-");
        }
      });

      const total = presentCount + absentCount;
      const percentage = total > 0 ? Math.round((presentCount / total) * 100) + "%" : "0%";

      csvContent += `"${student.name}","${student.course}","${student.batch || ''}",${presentCount},${absentCount},${percentage},` + sessionData.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Attendance</h2>
          <p className="text-slate-500 text-sm mt-1">Capture class photo for automated attendance</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
          <div className="flex bg-slate-100 p-1 rounded-lg">
           <button
             onClick={() => setActiveTab('take')}
             className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'take' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             AI Attendance
           </button>
           <button
             onClick={() => setActiveTab('manual')}
             className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'manual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Manual Entry
           </button>
           <button
             onClick={() => setActiveTab('history')}
             className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Log History
           </button>
           <button
             onClick={() => setActiveTab('student-tracker')}
             className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'student-tracker' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             Student Calendar
           </button>
        </div>
        </div>
      </div>

      {activeTab === 'manual' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Manual Entry</h3>
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <label className="flex items-center gap-2 cursor-pointer bg-amber-50 text-amber-700 px-3 py-1.5 rounded border border-amber-200">
                <input 
                  type="checkbox"
                  checked={manualIsNoClass}
                  onChange={(e) => {
                    setManualIsNoClass(e.target.checked);
                    if (e.target.checked) setManualPresent([]);
                  }}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="text-[11px] font-bold uppercase tracking-widest">No Class Today</span>
              </label>
              <div className="flex-1 md:flex-none">
                <select 
                  value={manualBatch}
                  onChange={e => {
                    setManualBatch(e.target.value);
                    setManualPresent([]);
                  }}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-slate-700"
                >
                  <option value="">All Batches</option>
                  {batches.map((b: any) => <option key={b.id} value={b.identifier}>{b.identifier} ({b.course})</option>)}
                </select>
              </div>
              <div className="flex-1 md:flex-none">
                <input 
                  type="text"
                  placeholder="Teacher's Note (Topic taught...)"
                  value={manualNote}
                  onChange={(e) => { setManualNote(e.target.value); setManualDirty(true); }}
                  className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Date</label>
                <input 
                  type="date"
                  value={manualDate}
                  onChange={(e) => { setManualDate(e.target.value); setManualDirty(false); }}
                  className="border border-slate-200 bg-slate-50 rounded p-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </div>
          </div>

          {!manualIsNoClass && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500 w-48 text-center">
                      <div className="flex flex-col gap-2">
                         <span>Status</span>
                         <div className="flex bg-slate-200 rounded p-0.5 justify-center">
                           <button 
                             onClick={() => {
                               setManualPresent(filteredStudents.map(s => s.id));
                               setManualAbsent([]);
                               setManualDirty(true);
                             }}
                             className="text-[9px] px-2 py-1 rounded bg-transparent hover:bg-white flex-1"
                           >
                             All Present
                           </button>
                           <button 
                             onClick={() => {
                               setManualAbsent(filteredStudents.map(s => s.id));
                               setManualPresent([]);
                               setManualDirty(true);
                             }}
                             className="text-[9px] px-2 py-1 rounded bg-transparent hover:bg-white flex-1"
                           >
                             All Absent
                           </button>
                         </div>
                      </div>
                    </th>
                    <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Student Name</th>
                    <th className="p-4 text-[10px] tracking-widest uppercase font-bold text-slate-500">Course / Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(student => {
                    const isP = manualPresent.includes(student.id);
                    const isA = manualAbsent.includes(student.id);
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg w-fit">
                            <button
                              onClick={() => {
                                setManualPresent([...manualPresent.filter(id => id !== student.id), student.id]);
                                setManualAbsent(manualAbsent.filter(id => id !== student.id));
                                setManualDirty(true);
                              }}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${isP ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                            >
                              P
                            </button>
                            <button
                              onClick={() => {
                                setManualAbsent([...manualAbsent.filter(id => id !== student.id), student.id]);
                                setManualPresent(manualPresent.filter(id => id !== student.id));
                                setManualDirty(true);
                              }}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${isA ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                            >
                              A
                            </button>
                            <button
                              onClick={() => {
                                setManualPresent(manualPresent.filter(id => id !== student.id));
                                setManualAbsent(manualAbsent.filter(id => id !== student.id));
                                setManualDirty(true);
                              }}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${!isP && !isA ? 'bg-slate-400 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                            >
                              -
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{student.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600">{student.course}</span>
                          {student.batch && <span className="text-[10px] ml-2 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-widest font-bold">{student.batch}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {students.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No students available.</div>}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button 
               onClick={async () => {
                  setManualSaving(true);
                  try {
                    const attId = existingRecordId || `manual-${manualDate}-${Date.now()}`;
                    const docRef = doc(collection(db, 'attendances'), attId);
                    await setDoc(docRef, {
                      instituteId: 'SevenAI',
                      date: manualDate,
                      timestamp: existingRecordId ? (attendances.find(a => a.id === existingRecordId)?.timestamp || new Date(manualDate).getTime() + (new Date().getTime() % 86400000)) : new Date(manualDate).getTime() + (new Date().getTime() % 86400000),
                      presentStudents: manualIsNoClass ? [] : manualPresent,
                      absentStudents: manualIsNoClass ? [] : manualAbsent,
                      isNoClass: manualIsNoClass,
                      note: manualNote,
                      batch: manualBatch || null,
                      staffId: user?.uid || 'unknown',
                      staffName: user?.displayName || user?.email || 'Unknown Staff'
                    });
                    
                    setManualSavedMsg(existingRecordId ? 'Attendance updated successfully!' : 'Attendance saved successfully!');
                    setManualDirty(false);
                    setTimeout(() => {
                      setManualSavedMsg('');
                    }, 2000);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.CREATE, 'attendances');
                  } finally {
                    setManualSaving(false);
                  }
               }}
               disabled={manualSaving || (!manualIsNoClass && manualPresent.length === 0 && manualAbsent.length === 0)}
               className="bg-indigo-600 disabled:opacity-50 text-white font-bold text-[11px] uppercase tracking-widest px-6 py-3 rounded shadow hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
               {manualSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
               {manualSavedMsg || (existingRecordId ? 'Update Manual Attendance' : 'Save Manual Attendance')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'take' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col items-center">
          <div className="w-full mb-6">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Select Batch (Optional)</label>
            <select 
              value={aiBatch}
              onChange={(e) => setAiBatch(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded text-sm text-slate-700 bg-slate-50 focus:bg-white transition-colors"
            >
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          
          {imagePreview ? (
             <div className="relative w-full aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 mb-6 flex items-center justify-center">
               <img src={imagePreview} alt="Classroom" className="object-contain max-h-full max-w-full" />
             </div>
          ) : (
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="w-full aspect-video bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-lg mb-6 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors"
             >
               <Camera size={48} className="text-indigo-400 mb-4" />
               <p className="font-bold text-indigo-700 uppercase tracking-widest text-xs">Tap to Capture Classroom Photo</p>
             </div>
          )}

          <div className="flex gap-4 w-full">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-widest py-3 rounded shadow-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={16} /> {imagePreview ? 'Retake Photo' : 'Upload File'}
            </button>
            <button 
              onClick={handleRecognize}
              disabled={!imageBase64 || processing}
              className="flex-1 bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest py-3 rounded shadow hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 className="animate-spin" size={16} /> : <Users size={16} />}
              {processing ? 'Processing...' : 'Recognize'}
            </button>
          </div>

          {error && <div className="mt-4 p-3 bg-rose-50 text-rose-700 text-sm rounded border border-rose-200 w-full">{error}</div>}
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200">
           <h3 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-widest border-b border-slate-100 pb-3">Detected Attendance</h3>
           
           {presentStudents.length > 0 ? (
             <div className="space-y-3">
               <div className="bg-emerald-50 text-emerald-700 p-3 rounded font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-4">
                 <CheckCircle2 size={16} /> {presentStudents.length} Students Detected
               </div>
               <div className="max-h-[300px] overflow-y-auto pr-2">
                 {presentStudents.map(id => {
                   const student = students.find(s => s.id === id);
                   if (!student) return null;
                   return (
                     <div key={id} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="font-bold text-sm text-slate-700">{student.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{student.course} - {student.batch}</p>
                        </div>
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Present</span>
                     </div>
                   );
                 })}
               </div>
               {saving ? (
                 <button 
                    disabled
                    className="flex justify-center items-center w-full mt-4 bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest py-3 rounded shadow opacity-70"
                 >
                    <Loader2 size={16} className="animate-spin mr-2" /> Saving...
                 </button>
               ) : savedMsg ? (
                 <div className="w-full mt-4 bg-emerald-50 text-emerald-700 font-bold text-xs uppercase tracking-widest py-3 rounded text-center">
                    {savedMsg}
                 </div>
               ) : (
                 <button 
                    onClick={async () => {
                       setSaving(true);
                       try {
                         const attId = format(new Date(), 'yyyy-MM-dd-HH-mm-ss');
                         const docRef = doc(collection(db, 'attendances'), attId);
                         const targetStudents = aiBatch ? students.filter(s => s.batch === aiBatch) : students;
                         const studentsWithImages = targetStudents.filter(s => s.image);
                         const absentStudents = studentsWithImages.map(s => s.id).filter(id => !presentStudents.includes(id));
                         await setDoc(docRef, {
                           instituteId: 'SevenAI',
                           date: format(new Date(), 'yyyy-MM-dd'),
                           timestamp: Date.now(),
                           presentStudents,
                           absentStudents,
                           batch: aiBatch || null,
                           staffId: user?.uid || 'unknown',
                           staffName: user?.displayName || user?.email || 'Unknown Staff'
                         });
                         
                         setSavedMsg('Attendance saved successfully!');
                         setTimeout(() => {
                           setSavedMsg('');
                           setPresentStudents([]);
                           setImagePreview(null);
                           setImageBase64(null);
                         }, 2000);
                       } catch (err) {
                         handleFirestoreError(err, OperationType.CREATE, 'attendances');
                       } finally {
                         setSaving(false);
                       }
                    }}
                    className="w-full mt-4 bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest py-3 rounded shadow hover:bg-emerald-700 transition-colors"
                 >
                    Submit Attendance
                 </button>
               )}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-[200px] text-slate-400">
               <Users size={48} className="mb-4 opacity-20" />
               <p className="text-sm">No faces recognized yet.</p>
               <p className="text-xs mt-1">Upload a photo to begin.</p>
             </div>
           )}
        </div>
      </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {attendances && attendances.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-xs tracking-wider uppercase font-bold text-slate-500">Date/Time</th>
                    <th className="p-4 text-xs tracking-wider uppercase font-bold text-slate-500">Present</th>
                    <th className="p-4 text-xs tracking-wider uppercase font-bold text-slate-500">Note / Topic</th>
                    <th className="p-4 text-xs tracking-wider uppercase font-bold text-slate-500">Recorded By</th>
                    <th className="p-4 text-xs tracking-wider uppercase font-bold text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendances.map(att => (
                    <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{format(new Date(att.timestamp), 'MMM d, yyyy')}</p>
                        <p className="text-[10px] text-slate-500">{format(new Date(att.timestamp), 'h:mm a')}</p>
                      </td>
                      <td className="px-4 py-3">
                        {att.isNoClass ? (
                          <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-bold w-fit uppercase tracking-widest">
                            No Class
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-bold w-fit">
                            {att.presentStudents ? att.presentStudents.length : 0} Students
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-600 font-medium">{att.note || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-600">{att.staffName}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => handleDeleteAttendance(att.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 flex flex-col items-center justify-center text-slate-400">
              <Calendar size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">No attendance records found.</p>
            </div>
          )}
        </div>
      )}
      {activeTab === 'student-tracker' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          {/* Sidebar Student List */}
          <div className="w-full md:w-64 border-r border-slate-200 flex flex-col bg-slate-50">
             <div className="p-4 border-b border-slate-200">
               <h3 className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">Select Student</h3>
             </div>
             <div className="flex-1 overflow-y-auto max-h-[300px] md:max-h-full">
               {students.map(student => (
                 <button
                   key={student.id}
                   onClick={() => setSelectedStudentId(student.id)}
                   className={`w-full text-left p-3 border-b border-slate-200/50 flex items-center gap-3 transition-colors ${selectedStudentId === student.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : 'hover:bg-slate-100 border-l-2 border-l-transparent'}`}
                 >
                   {student.image ? (
                     <img src={student.image} alt={student.name} className="w-8 h-8 rounded-full object-cover bg-white" />
                   ) : (
                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 bg-white">{student.name.charAt(0)}</div>
                   )}
                   <div className="min-w-0">
                     <p className={`text-sm truncate font-bold ${selectedStudentId === student.id ? 'text-indigo-900' : 'text-slate-700'}`}>{student.name}</p>
                     <p className="text-[10px] truncate text-slate-500 uppercase tracking-widest">{student.course}</p>
                   </div>
                 </button>
               ))}
             </div>
          </div>

          {/* Calendar View */}
          <div className="flex-1 p-6 bg-white">
             {!selectedStudentId ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <Calendar size={48} className="opacity-20 mb-4" />
                 <p className="text-sm font-bold uppercase tracking-widest">Select a student</p>
                 <p className="text-xs mt-1">To view their attendance calendar</p>
               </div>
             ) : (
               <div className="flex flex-col h-full">
                 <div className="mb-6 flex justify-between items-end">
                   <div>
                     <h3 className="text-lg font-bold text-slate-800">{students.find(s => s.id === selectedStudentId)?.name}</h3>
                     <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">Attendance Record</p>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                   {attendances.filter(att => !att.batch || (students.find(s => s.id === selectedStudentId)?.batch && att.batch === students.find(s => s.id === selectedStudentId)?.batch)).map(att => {
                     const isNoClass = att.isNoClass;
                     const isPresent = !isNoClass && att.presentStudents && att.presentStudents.includes(selectedStudentId);
                     
                     const isAbsent = !isNoClass && att.absentStudents && att.absentStudents.includes(selectedStudentId);

                     let bgColor = "bg-slate-50 border-slate-200";
                     let textColor = "bg-slate-100 text-slate-700";
                     let text = "Not Marked";

                     if (isNoClass) {
                       bgColor = "bg-amber-50 border-amber-200";
                       textColor = "bg-amber-100 text-amber-700";
                       text = "No Class";
                     } else if (isPresent) {
                       bgColor = "bg-emerald-50 border-emerald-200";
                       textColor = "bg-emerald-100 text-emerald-700";
                       text = "Present";
                     } else if (isAbsent) {
                       bgColor = "bg-rose-50 border-rose-200";
                       textColor = "bg-rose-100 text-rose-700";
                       text = "Absent";
                     }

                     return (
                       <div key={att.id} onClick={() => setEditingAttendance({ record: att, studentId: selectedStudentId })} className={`cursor-pointer hover:shadow-md transition-shadow p-4 border rounded-lg flex flex-col items-center justify-center gap-2 ${bgColor}`}>
                         <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                           {format(new Date(att.timestamp), 'MMM d')}
                         </div>
                         <div className="text-xs font-bold text-slate-700">
                           {format(new Date(att.timestamp), 'h:mm a')}
                         </div>
                         <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${textColor}`}>
                           {text}
                         </div>
                         {att.note && <div className="text-[9px] text-slate-500 mt-1 text-center font-medium line-clamp-2" title="Click to view full note">📝 {att.note}</div>}
                       </div>
                     );
                   })}
                   {attendances.length === 0 && (
                     <div className="col-span-full py-12 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">No attendance sessions logged overall.</div>
                   )}
                 </div>
               </div>
             )}
          </div>
        </div>
      )}
      
      {editingAttendance && (
         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
               <h3 className="font-bold text-slate-800 text-lg mb-4">Edit Attendance</h3>
               
               <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                 <p className="text-sm text-slate-700 mb-1"><strong>Date:</strong> {format(new Date(editingAttendance.record.timestamp), 'MMM d, yyyy h:mm a')}</p>
                 {editingAttendance.record.batch && <p className="text-sm text-slate-700 mb-1"><strong>Batch:</strong> {editingAttendance.record.batch}</p>}
                 {editingAttendance.record.note && (
                   <div className="mt-2 text-sm text-slate-600 bg-white p-2 rounded border border-slate-100">
                     <strong>Teacher's Note:</strong><br />
                     {editingAttendance.record.note}
                   </div>
                 )}
               </div>

               <div className="flex flex-col gap-3 mb-6">
                 <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Update Status</h4>
                 <div className="grid grid-cols-3 gap-2">
                   <button
                     onClick={async () => {
                       const { record, studentId } = editingAttendance;
                       try {
                         const newP = (record.presentStudents || []).filter((id: string) => id !== studentId);
                         const newA = (record.absentStudents || []).filter((id: string) => id !== studentId);
                         newP.push(studentId);
                         await setDoc(doc(db, 'attendances', record.id), { ...record, presentStudents: newP, absentStudents: newA }, { merge: true });
                         setEditingAttendance(null);
                       } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'attendances'); }
                     }}
                     className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors"
                   >
                     Present
                   </button>
                   <button
                     onClick={async () => {
                       const { record, studentId } = editingAttendance;
                       try {
                         const newP = (record.presentStudents || []).filter((id: string) => id !== studentId);
                         const newA = (record.absentStudents || []).filter((id: string) => id !== studentId);
                         newA.push(studentId);
                         await setDoc(doc(db, 'attendances', record.id), { ...record, presentStudents: newP, absentStudents: newA }, { merge: true });
                         setEditingAttendance(null);
                       } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'attendances'); }
                     }}
                     className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors"
                   >
                     Absent
                   </button>
                   <button
                     onClick={async () => {
                       const { record, studentId } = editingAttendance;
                       try {
                         const newP = (record.presentStudents || []).filter((id: string) => id !== studentId);
                         const newA = (record.absentStudents || []).filter((id: string) => id !== studentId);
                         await setDoc(doc(db, 'attendances', record.id), { ...record, presentStudents: newP, absentStudents: newA }, { merge: true });
                         setEditingAttendance(null);
                       } catch (e) { handleFirestoreError(e, OperationType.UPDATE, 'attendances'); }
                     }}
                     className="bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors"
                   >
                     Not Marked
                   </button>
                 </div>
               </div>
               <div className="flex gap-3 pt-4 border-t border-slate-100">
                 <button onClick={() => setEditingAttendance(null)} className="flex-1 bg-slate-900 text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded hover:bg-slate-800 transition-colors">
                   Close
                 </button>
               </div>
            </div>
         </div>
      )}


      {viewingNote && (
         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full relative">
               <h3 className="font-bold text-slate-800 text-lg mb-4">Teacher's Note</h3>
               <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewingNote}</p>
               <button onClick={() => setViewingNote(null)} className="mt-6 w-full bg-slate-900 text-white font-bold text-xs uppercase tracking-widest py-3 rounded hover:bg-slate-800 transition-colors">
                 Close Note
               </button>
            </div>
         </div>
      )}
    </div>
  );
};

export default Attendance;
