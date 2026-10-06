import React, { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { format } from 'date-fns';
import { Send, AlertCircle, Mail, CheckCircle2, MessageSquare, GraduationCap, Users } from 'lucide-react';

const Reminders = () => {
  const { students, transactions, leads } = useData();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState<'pending' | 'templates'>('pending');
  const [selectedTemplate, setSelectedTemplate] = useState('reminder');

  // Calculate unpaid students for the selected month
  const unpaidStudents = useMemo(() => {
    // get set of studentIds who paid this month
    const paidStudentIds = new Set(
      transactions
        .filter(t => t.monthForFee === selectedMonth)
        .map(t => t.studentId)
    );

    return students.filter(s => !paidStudentIds.has(s.id));
  }, [students, transactions, selectedMonth]);

  const [errorMsg, setErrorMsg] = useState<string>('');

  const emailTemplates = {
    reminder: {
      id: 'reminder',
      name: 'Fee Reminder',
      icon: <AlertCircle size={18} />,
      subject: (s: any) => `Fee Reminder for ${format(new Date(`${selectedMonth}-01`), 'MMMM yyyy')} - Seven AI`,
      body: (s: any) => `Dear ${s.name} / Parents,\n\nHope you are doing well.\n\nThis is a friendly reminder that your fees for the month of ${format(new Date(`${selectedMonth}-01`), 'MMMM yyyy')} are currently pending. Please arrange the payment at your earliest convenience to avoid any interruption in classes.\n\nPlease let us know if the payment has already been made.\n\nBest Regards,\nSeven AI Institute\nEmail: sevenaiinstitute@gmail.com`
    },
    success: {
      id: 'success',
      name: 'Fee Submission Success',
      icon: <CheckCircle2 size={18} />,
      subject: (s: any) => `Payment Confirmation - Seven AI`,
      body: (s: any) => `Dear ${s.name} / Parents,\n\nWe have successfully received your fee payment. \n\nThank you for your prompt payment and continued trust in our institute.\n\nBest Regards,\nSeven AI Institute\nEmail: sevenaiinstitute@gmail.com`
    },
    completion: {
      id: 'completion',
      name: 'Course Completion',
      icon: <GraduationCap size={18} />,
      subject: (s: any) => `Congratulations on Completing your Course! - Seven AI`,
      body: (s: any) => `Dear ${s.name},\n\nCongratulations on successfully completing your course! It has been an absolute pleasure having you with us.\n\nWe are incredibly proud of your progress and wish you the absolute best in all your future endeavors. Always remember that learning is a lifelong journey, and our doors are always open for you.\n\nBest Regards,\nSeven AI Institute\nEmail: sevenaiinstitute@gmail.com`
    },
    feedback: {
      id: 'feedback',
      name: 'Feedback Request',
      icon: <MessageSquare size={18} />,
      subject: (s: any) => `We Value Your Feedback - Seven AI`,
      body: (s: any) => `Dear ${s.name},\n\nWe hope you are enjoying your learning experience at Seven AI Institute.\n\nWe are always striving to improve and provide the best possible education. We would deeply appreciate it if you could take a few minutes to share your feedback with us.\n\nYour insights are invaluable in helping us serve you better.\n\nBest Regards,\nSeven AI Institute\nEmail: sevenaiinstitute@gmail.com`
    },
    welcome: {
      id: 'welcome',
      name: 'Welcome to Seven AI',
      icon: <CheckCircle2 size={18} />,
      subject: (s: any) => `Welcome to Seven AI Institute, ${s.name}!`,
      body: (s: any) => `Dear ${s.name},\n\nWelcome to Seven AI Institute!\n\nWe are absolutely thrilled to have you join us. This is the beginning of a wonderful journey, and we are committed to providing you with the best possible learning experience.\n\nPlease feel free to reach out to our administration if you have any questions or need assistance settling in.\n\nBest Regards,\nSeven AI Institute\nEmail: sevenaiinstitute@gmail.com`
    },
    visitor: {
      id: 'visitor',
      name: 'Visitor / Enquiry',
      icon: <Users size={18} />,
      subject: (s: any) => `Thank You for Visiting Seven AI Institute, ${s.name}!`,
      body: (s: any) => `Dear ${s.name},\n\nThank you for taking the time to visit Seven AI Institute and inquiring about our ${s.courseInterest || 'courses'}.\n\nWe would love to help you build a smarter future. If you have any further questions regarding the curriculum, timings, or enrollment, please do not hesitate to contact us. Kal ke liye aaj se smart bano!\n\nBest Regards,\nSeven AI Institute\nEmail: sevenaiinstitute@gmail.com`
    }
  };

  const [sending, setSending] = useState<string | null>(null);

  const getHtmlTemplate = (title: string, content: string) => `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 4px solid #4f46e5;">
        <img src="https://ui-avatars.com/api/?name=7+AI&background=4f46e5&color=fff&size=80&rounded=true&font-size=0.4" alt="Seven AI Logo" style="width: 80px; height: 80px; margin-bottom: 16px; border-radius: 50%;" />
        <h1 style="color: #0f172a; margin: 0; font-size: 26px; letter-spacing: 2px; text-transform: uppercase; font-weight: 800;">Seven AI</h1>
        <p style="color: #64748b; margin: 8px 0 0; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Kal ke liye aaj se smart bano</p>
      </div>
      <div style="padding: 40px 32px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 24px; font-size: 20px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">${title}</h2>
        <div style="color: #334155; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">${content}</div>
      </div>
      <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.6;">
          <strong>Seven AI Institute</strong><br>
          <a href="https://sevenaiinstitute.com" style="color: #4f46e5; text-decoration: none; font-weight: 600;">www.sevenaiinstitute.com</a>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 12px 0 0;">
          This is an automated message. Please contact administration for any queries.
        </p>
      </div>
    </div>
  `;

  const handleSendEmail = async (student: any, templateId: string) => {
    const template = emailTemplates[templateId as keyof typeof emailTemplates];
    if (!template) return;

    if (!student.email) {
      setErrorMsg(`No email found for ${student.name}.`);
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const subject = template.subject(student);
    const body = template.body(student);
    const html = getHtmlTemplate(template.name, body);

    setSending(student.id);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: student.email,
          subject,
          html
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setErrorMsg('Email sent successfully!');
      setTimeout(() => setErrorMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Communications</h2>
            <p className="text-slate-500 text-sm mt-1">Send fee reminders and official automated emails</p>
          </div>
          
          <div className="flex bg-white border border-slate-200 rounded-lg p-1">
             <button
               onClick={() => setActiveTab('pending')}
               className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'pending' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Pending Fees
             </button>
             <button
               onClick={() => setActiveTab('templates')}
               className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'templates' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Email Templates
             </button>
          </div>
       </div>

       {errorMsg && (
         <div className="bg-rose-50 text-rose-700 text-sm font-semibold p-3 rounded-lg border border-rose-200">
           {errorMsg}
         </div>
       )}

       {activeTab === 'pending' && (
         <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
               <div className="flex items-center gap-3">
                 <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Select Month</label>
                 <input 
                   type="month" 
                   value={selectedMonth}
                   onChange={(e) => setSelectedMonth(e.target.value)}
                   className="border border-slate-200 bg-white rounded p-1.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                 />
               </div>
            </div>
            
            {unpaidStudents.length > 0 ? (
              <div className="p-4 border-b border-rose-200 bg-rose-50 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-rose-700">
                    <AlertCircle size={18}/>
                    <span className="font-bold text-xs uppercase tracking-wide">{unpaidStudents.length} OUTSTANDING PAYMENTS</span>
                 </div>
              </div>
            ) : (
               <div className="p-8 text-center text-slate-500 text-sm border-b border-slate-200">
                  All accounts settled for {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy')}.
               </div>
            )}

            <div className="flex-1 overflow-x-auto">
               <table className="min-w-full divide-y divide-slate-100 whitespace-nowrap text-left text-sm">
                 <thead className="bg-white text-slate-400 uppercase text-[10px] font-bold">
                   <tr>
                     <th className="px-6 py-3">Student Name</th>
                     <th className="px-6 py-3">Course / Batch</th>
                     <th className="px-6 py-3">Contact</th>
                     <th className="px-6 py-3 text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {unpaidStudents.map(student => (
                     <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-6 py-4 font-medium text-slate-700">{student.name}</td>
                       <td className="px-6 py-4">
                          <span className="font-semibold text-slate-700">{student.course}</span>
                          {student.batch && <span className="text-[10px] ml-2 bg-indigo-50 px-2 py-1 text-indigo-700 rounded font-bold uppercase tracking-wider">{student.batch}</span>}
                       </td>
                       <td className="px-6 py-4 text-slate-500">
                          <p className="font-medium text-slate-700">{student.phone || 'N/A'}</p>
                          <p className="text-[11px] mt-0.5">{student.email}</p>
                       </td>
                       <td className="px-6 py-4 text-right border-l border-slate-100 bg-indigo-50/20">
                          <button 
                            disabled={sending === student.id}
                            onClick={() => handleSendEmail(student, 'reminder')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-bold rounded shadow-sm transition text-[10px] uppercase tracking-widest"
                          >
                             {sending === student.id ? <><AlertCircle size={12} className="animate-spin" /> SENDING...</> : <><Send size={12} /> SEND REMINDER</>}
                          </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
         </div>
       )}

       {activeTab === 'templates' && (
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           {/* Sidebar Templates */}
           <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-fit">
               <div className="p-4 border-b border-slate-200 bg-slate-50">
                 <h3 className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">Select Template</h3>
               </div>
               <div className="flex flex-col">
                 {Object.values(emailTemplates).map((template) => (
                   <button
                     key={template.id}
                     onClick={() => setSelectedTemplate(template.id)}
                     className={`text-left p-4 flex items-center gap-3 border-b border-slate-100 transition-colors ${selectedTemplate === template.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}
                   >
                     <div className={`${selectedTemplate === template.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                       {template.icon}
                     </div>
                     <span className={`text-sm font-bold ${selectedTemplate === template.id ? 'text-indigo-900' : 'text-slate-600'}`}>
                       {template.name}
                     </span>
                   </button>
                 ))}
               </div>
           </div>

           {/* Send using Template */}
           <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <Mail size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Template Preview</span>
                 </div>
                 <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Subject</p>
                      <p className="text-sm font-semibold text-slate-800">{emailTemplates[selectedTemplate as keyof typeof emailTemplates]?.subject({ name: '[Student Name]' })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Body</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{emailTemplates[selectedTemplate as keyof typeof emailTemplates]?.body({ name: '[Student Name]' })}</p>
                    </div>
                 </div>
              </div>
              
              <div className="flex-1 overflow-x-auto">
                 <div className="p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">Select Recipient to Send</h3>
                 </div>
                 <table className="min-w-full divide-y divide-slate-100 whitespace-nowrap text-left text-sm">
                   <tbody className="divide-y divide-slate-100">
                     {selectedTemplate === 'visitor' ? (
                       leads.map((lead: any) => (
                         <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4">
                              <p className="font-bold text-slate-800">{lead.name}</p>
                              <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Lead: {lead.courseInterest}</p>
                           </td>
                           <td className="px-6 py-4 text-slate-500">
                              <p className="text-[11px]">{lead.email || 'No email'}</p>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button 
                                disabled={!lead.email || sending === lead.id}
                                onClick={() => handleSendEmail(lead, selectedTemplate)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 disabled:opacity-50 text-white hover:bg-slate-800 font-bold rounded shadow-sm transition text-[10px] uppercase tracking-widest border border-slate-700"
                              >
                                 {sending === lead.id ? <><AlertCircle size={12} className="animate-spin" /> SENDING...</> : <><Send size={12} /> SEND EMAIL</>}
                              </button>
                           </td>
                         </tr>
                       ))
                     ) : (
                       students.map((student: any) => (
                         <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4">
                              <p className="font-bold text-slate-800">{student.name}</p>
                              <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{student.course}</p>
                           </td>
                           <td className="px-6 py-4 text-slate-500">
                              <p className="text-[11px]">{student.email || 'No email'}</p>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button 
                                disabled={!student.email || sending === student.id}
                                onClick={() => handleSendEmail(student, selectedTemplate)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 disabled:opacity-50 text-white hover:bg-slate-800 font-bold rounded shadow-sm transition text-[10px] uppercase tracking-widest border border-slate-700"
                              >
                                 {sending === student.id ? <><AlertCircle size={12} className="animate-spin" /> SENDING...</> : <><Send size={12} /> SEND EMAIL</>}
                              </button>
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
              </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default Reminders;

