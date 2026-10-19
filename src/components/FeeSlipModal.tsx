import React, { useState } from 'react';
import { Student, Transaction } from '../types';
import { useBranding } from '../contexts/BrandingContext';
import { Printer, X, Receipt, ShieldCheck, Mail, Phone, MapPin, Calendar, CheckCircle2, User, CreditCard, Wallet, Download } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';

interface FeeSlipModalProps {
  student: Student;
  transaction: Transaction;
  onClose: () => void;
}

export const FeeSlipModal: React.FC<FeeSlipModalProps> = ({ student, transaction, onClose }) => {
  const { branding } = useBranding();
  const [downloading, setDownloading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const elem = document.getElementById('fee-slip-printable');
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
      link.download = `Fee_Receipt_${student.name.replace(/\s+/g, '_')}_${transaction.monthForFee.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download fee receipt', err);
    } finally {
      setDownloading(false);
    }
  };

  const receiptNo = `REC-${new Date(transaction.createdAt).getFullYear()}-${transaction.id.slice(0, 6).toUpperCase()}`;
  const paymentDate = format(new Date(transaction.createdAt), 'dd MMMM yyyy, hh:mm a');

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #fee-slip-printable, #fee-slip-printable * {
            visibility: visible !important;
          }
          #fee-slip-printable {
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

      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8 relative flex flex-col">
        {/* Top Control Bar (Hidden during Print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="text-emerald-400" size={20} />
            <h3 className="font-bold text-sm tracking-wide">FEE PAYMENT RECEIPT</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={14} /> {downloading ? 'DOWNLOADING...' : 'DOWNLOAD RECEIPT'}
            </button>
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Printer size={14} /> PRINT RECEIPT
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Fee Document */}
        <div id="fee-slip-printable" className="p-8 bg-white text-slate-800 flex flex-col justify-between min-h-[580px]">
          
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-5 mb-5">
              <div className="flex items-center gap-4">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt={branding.platformName || 'Seven AI Institute'}
                    className="h-14 w-14 object-contain rounded-lg border border-slate-200 p-1 bg-white shadow-sm"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                    7AI
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                    {branding.platformName || 'SEVEN AI INSTITUTE'}
                  </h1>
                  <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">
                    FEE ACKNOWLEDGEMENT SLIP
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                    <span className="flex items-center gap-1"><MapPin size={10} className="text-slate-400" /> Seven AI Campus</span>
                    <span>|</span>
                    <span className="flex items-center gap-1"><Phone size={10} className="text-slate-400" /> Accounts Desk</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-lg text-center">
                  <span className="block text-[8px] font-bold text-emerald-600 uppercase tracking-wider">Receipt No.</span>
                  <span className="font-mono text-xs font-extrabold">{receiptNo}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  {paymentDate}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="bg-emerald-700 text-white text-center py-2 rounded-lg mb-5 shadow-sm">
              <span className="text-xs font-extrabold uppercase tracking-widest">OFFICIAL STUDENT FEE RECEIPT</span>
            </div>

            {/* Student Details Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student Name</span>
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1 mt-0.5">
                  <User size={13} className="text-emerald-600" /> {student.name}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Course / Batch</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {student.course} {student.batch ? `(${student.batch})` : ''}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</span>
                <span className="font-medium text-slate-700 mt-0.5 block">{student.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email ID</span>
                <span className="font-medium text-slate-700 mt-0.5 block break-all">{student.email || 'N/A'}</span>
              </div>
            </div>

            {/* Fee Particulars Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Fee Particulars</th>
                    <th className="px-4 py-2.5">For Period</th>
                    <th className="px-4 py-2.5">Payment Mode</th>
                    <th className="px-4 py-2.5 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  <tr>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">Tuition / Academic Fee</div>
                      <div className="text-[10px] text-slate-400">Collected by: {transaction.collectedBy || transaction.staffName || 'Admin'}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">
                      {transaction.monthForFee}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 uppercase font-bold text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {transaction.paymentMethod === 'online' ? <CreditCard size={11} className="text-emerald-600"/> : <Wallet size={11} className="text-amber-600"/>}
                        {transaction.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-sm text-slate-900">
                      ₹{transaction.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-emerald-50/80 border-t-2 border-emerald-500 font-bold text-slate-900 text-xs">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-emerald-900 font-extrabold">
                      Total Amount Received:
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-base text-emerald-700">
                      ₹{transaction.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Note */}
            <div className="flex items-center gap-2 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-8">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>Payment received with thanks. Computer generated receipt does not require physical stamp if verified online.</span>
            </div>
          </div>

          {/* Signatures Footer */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 items-end">
            <div className="text-center">
              <div className="h-10 border-b border-dashed border-slate-300 mb-1.5"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payer Signature</p>
            </div>

            <div className="text-center">
              <div className="h-10 border-b border-dashed border-slate-300 mb-1.5 flex items-center justify-center">
                <span className="text-[8px] font-mono text-slate-300 italic uppercase">Official Stamp</span>
              </div>
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Accounts Officer</p>
              <p className="text-[9px] font-semibold text-emerald-600">{branding.platformName || 'Seven AI Institute'}</p>
            </div>
          </div>

        </div>

        {/* Footer */}
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
            className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow transition-colors flex items-center gap-1.5"
          >
            <Printer size={14} /> PRINT RECEIPT
          </button>
        </div>

      </div>
    </div>
  );
};
