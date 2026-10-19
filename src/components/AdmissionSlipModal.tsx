import React, { useState } from 'react';
import { Student } from '../types';
import { useBranding } from '../contexts/BrandingContext';
import { Printer, X, CheckCircle, Clock, ShieldCheck, Mail, Phone, MapPin, Calendar, BookOpen, User, Download } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';

interface AdmissionSlipModalProps {
  student: Student;
  onClose: () => void;
}

export const AdmissionSlipModal: React.FC<AdmissionSlipModalProps> = ({ student, onClose }) => {
  const { branding } = useBranding();
  const [downloading, setDownloading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const elem = document.getElementById('admission-slip-printable');
    if (!elem) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(elem, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Admission_Slip_${student.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download admission slip', err);
    } finally {
      setDownloading(false);
    }
  };

  const regNo = `SAI-${new Date(student.createdAt).getFullYear()}-${student.id.slice(0, 6).toUpperCase()}`;
  const joiningDateFormatted = student.startDate 
    ? format(new Date(student.startDate + 'T00:00:00'), 'dd MMMM yyyy')
    : format(new Date(student.createdAt), 'dd MMMM yyyy');

  const isAdmissionFeeDone = student.admissionFeeStatus === 'done' || (student.admissionFeeAmount && student.admissionFeeAmount > 0 && student.admissionFeeStatus !== 'pending');
  const admissionFeeAmount = student.admissionFeeAmount ?? 1000;

  const isRegFeeDone = student.registrationFeeStatus === 'done' || (student.registrationFeeAmount && student.registrationFeeAmount > 0 && student.registrationFeeStatus !== 'pending');
  const regFeeAmount = student.registrationFeeAmount ?? 500;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #admission-slip-printable, #admission-slip-printable * {
            visibility: visible !important;
          }
          #admission-slip-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 relative flex flex-col">
        {/* Top Control Bar (Hidden during Print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-indigo-400" size={20} />
            <h3 className="font-bold text-sm tracking-wide">STUDENT ADMISSION SLIP</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={14} /> {downloading ? 'DOWNLOADING...' : 'DOWNLOAD SLIP'}
            </button>
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Printer size={14} /> PRINT SLIP
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Admission Document */}
        <div id="admission-slip-printable" className="p-8 bg-white text-slate-800 flex flex-col justify-between min-h-[650px]">
          
          {/* Document Header */}
          <div>
            <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-5 mb-6">
              <div className="flex items-center gap-4">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt={branding.platformName || 'Seven AI Institute'}
                    className="h-16 w-16 object-contain rounded-lg border border-slate-200 p-1 bg-white shadow-sm"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
                    7AI
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    {branding.platformName || 'SEVEN AI INSTITUTE'}
                  </h1>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mt-0.5">
                    {branding.tagline || 'Kal ke liye aaj se smart bano'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><MapPin size={11} className="text-slate-400" /> Main Campus, Seven AI Institute</span>
                    <span>|</span>
                    <span className="flex items-center gap-1"><Phone size={11} className="text-slate-400" /> Admissions Desk</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-3 py-1.5 rounded-lg text-center">
                  <span className="block text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Registration No.</span>
                  <span className="font-mono text-sm font-extrabold">{regNo}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Issue Date: {format(new Date(student.createdAt), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="bg-slate-900 text-white text-center py-2.5 rounded-lg mb-6 shadow-sm flex items-center justify-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest">OFFICIAL STUDENT ADMISSION SLIP</span>
            </div>

            {/* Main Details Grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs mb-6">
              
              {/* Student Name */}
              <div className="col-span-2 sm:col-span-1 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Student Name</span>
                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <User size={14} className="text-indigo-600" /> {student.name}
                </span>
              </div>

              {/* Course Enrolled */}
              <div className="col-span-2 sm:col-span-1 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Course Enrolled</span>
                <span className="text-sm font-bold text-indigo-700 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-indigo-600" /> {student.course}
                </span>
              </div>

              {/* Joining Date */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Joining / Start Date</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-500" /> {joiningDateFormatted}
                </span>
              </div>

              {/* Registration Fee Status */}
              <div className={`p-3 rounded-lg border ${isRegFeeDone ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-80">
                  Registration Fee
                </span>
                <div className="flex items-center gap-2">
                  {isRegFeeDone ? (
                    <>
                      <CheckCircle size={15} className="text-indigo-600" />
                      <span className="font-extrabold text-sm text-indigo-800">DONE (₹{regFeeAmount.toLocaleString('en-IN')})</span>
                    </>
                  ) : (
                    <>
                      <Clock size={15} className="text-amber-600" />
                      <span className="font-extrabold text-sm text-amber-800">PENDING (₹{regFeeAmount.toLocaleString('en-IN')})</span>
                    </>
                  )}
                </div>
              </div>

              {/* Admission Fee Status */}
              <div className={`p-3 rounded-lg border ${isAdmissionFeeDone ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-80">
                  Admission Fee Status
                </span>
                <div className="flex items-center gap-2">
                  {isAdmissionFeeDone ? (
                    <>
                      <CheckCircle size={15} className="text-emerald-600" />
                      <span className="font-extrabold text-sm text-emerald-700">DONE / PAID (₹{admissionFeeAmount.toLocaleString('en-IN')})</span>
                    </>
                  ) : (
                    <>
                      <Clock size={15} className="text-amber-600" />
                      <span className="font-extrabold text-sm text-amber-700">PENDING (₹{admissionFeeAmount.toLocaleString('en-IN')})</span>
                    </>
                  )}
                </div>
              </div>

              {/* Mail ID */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Mail ID</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 break-all">
                  <Mail size={13} className="text-slate-500 shrink-0" /> {student.email || 'N/A'}
                </span>
              </div>

              {/* Mobile Number */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Mobile Number</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-500" /> {student.phone || 'N/A'}
                </span>
              </div>

              {/* Father Name */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Father / Guardian Name</span>
                <span className="font-semibold text-slate-800">{student.fatherName || 'N/A'}</span>
              </div>

              {/* Batch / School */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Batch / Class</span>
                <span className="font-semibold text-slate-800">
                  {student.batch ? `Batch: ${student.batch}` : 'General Batch'}
                  {student.schoolClass ? ` | Class ${student.schoolClass}` : ''}
                </span>
              </div>

              {/* Address of Student */}
              <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Student Residential Address</span>
                <span className="font-medium text-slate-800 flex items-start gap-1.5">
                  <MapPin size={13} className="text-slate-500 mt-0.5 shrink-0" /> {student.address || 'Address not recorded'}
                </span>
              </div>

            </div>

            {/* Terms & Regulations */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 mb-8">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Important Instructions</span>
              <ul className="text-[10px] text-slate-600 list-disc list-inside space-y-0.5">
                <li>Registration and admission fees once deposited are non-refundable and non-transferable.</li>
                <li>Students must maintain at least 75% attendance for course completion certification.</li>
                <li>Please carry this admission slip for identity card issuance at the institute admin desk.</li>
              </ul>
            </div>
          </div>

          {/* Signatures & Verification Footer */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 items-end">
            <div className="text-center">
              <div className="h-12 border-b border-dashed border-slate-300 mb-2"></div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student / Guardian Signature</p>
            </div>

            <div className="text-center relative">
              <div className="h-12 border-b border-dashed border-slate-300 mb-2 flex items-center justify-center">
                <span className="text-[9px] font-mono text-slate-300 italic uppercase">Seven AI Authorized Stamp</span>
              </div>
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Authorized Signatory</p>
              <p className="text-[9px] font-semibold text-indigo-600">{branding.platformName || 'Seven AI Institute'}</p>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="no-print bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            CLOSE
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-5 py-2 rounded-lg bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} /> DOWNLOAD IMAGE
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow transition-colors flex items-center gap-1.5"
          >
            <Printer size={14} /> PRINT NOW
          </button>
        </div>

      </div>
    </div>
  );
};
