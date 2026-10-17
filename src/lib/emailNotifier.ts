import { addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface SendDemoNotificationParams {
  teacherName: string;
  teacherEmail?: string;
  demoTitle: string;
  studentName?: string;
  course?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  scheduledBy: string;
  notes?: string;
  openMailClient?: boolean;
}

export const sendDemoEmailNotification = async (params: SendDemoNotificationParams) => {
  const {
    teacherName,
    teacherEmail,
    demoTitle,
    studentName,
    course,
    date,
    startTime,
    endTime,
    scheduledBy,
    notes,
    openMailClient = false,
  } = params;

  // Format recipient email
  let recipientEmail = teacherEmail;
  if (!recipientEmail || !recipientEmail.includes('@')) {
    // Generate default teacher email format if not provided
    const cleanName = teacherName.toLowerCase().replace(/[^a-z0-9]/g, '');
    recipientEmail = `${cleanName}@sevenai.edu.in`;
  }

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const subject = `[SevenAI Calendar] New Demo Class Scheduled: ${demoTitle} on ${formattedDate}`;

  const body = `Hello ${teacherName},

A new Demo Class slot has been assigned to you at SevenAI Institute.

Details:
----------------------------------------
Topic / Title: ${demoTitle}
Student Name: ${studentName || 'Prospective Lead'}
Course: ${course || 'General Consultation'}
Date: ${formattedDate} (${date})
Time Slot: ${startTime} - ${endTime}
Assigned By: ${scheduledBy}
${notes ? `Additional Notes: ${notes}\n` : ''}
Please ensure your availability and check the SevenAI portal for more details.

Best regards,
SevenAI Academic Administration
`.trim();

  // 1. Log to Firestore
  try {
    await addDoc(collection(db, 'email_logs'), {
      instituteId: 'SevenAI',
      toEmail: recipientEmail,
      teacherName,
      subject,
      body,
      demoTitle,
      date,
      time: `${startTime} - ${endTime}`,
      sentAt: Date.now(),
      status: 'sent',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'email_logs');
  }

  // 2. Open mailto if explicitly triggered or requested
  if (openMailClient && typeof window !== 'undefined') {
    const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }

  return {
    recipientEmail,
    subject,
    body,
    formattedDate,
  };
};
