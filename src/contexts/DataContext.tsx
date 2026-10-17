import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { 
  Student, Transaction, AttendanceRecord, Expense, Batch, Lead, OfficeEarning,
  TeacherAvailability, CalendarEvent, EmailLog 
} from '../types';

interface DataContextType {
  students: Student[];
  transactions: Transaction[];
  attendances: AttendanceRecord[];
  expenses: Expense[];
  batches: Batch[];
  leads: Lead[];
  officeEarnings: OfficeEarning[];
  teacherAvailabilities: TeacherAvailability[];
  calendarEvents: CalendarEvent[];
  emailLogs: EmailLog[];
  loading: boolean;
}

const DataContext = createContext<DataContextType>({ 
  students: [], transactions: [], attendances: [], expenses: [], batches: [], 
  leads: [], officeEarnings: [], teacherAvailabilities: [], calendarEvents: [], emailLogs: [], loading: true 
});

export const useData = () => useContext(DataContext);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [officeEarnings, setOfficeEarnings] = useState<OfficeEarning[]>([]);
  const [teacherAvailabilities, setTeacherAvailabilities] = useState<TeacherAvailability[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStudents([]);
      setTransactions([]);
      setAttendances([]);
      setExpenses([]);
      setBatches([]);
      setLeads([]);
      setOfficeEarnings([]);
      setTeacherAvailabilities([]);
      setCalendarEvents([]);
      setEmailLogs([]);
      setLoading(false);
      return;
    }

    const studentsQuery = query(collection(db, 'students'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studs: Student[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      studs.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));

    const txQuery = query(collection(db, 'transactions'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeTxs = onSnapshot(txQuery, (snapshot) => {
      const txs: Transaction[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      txs.sort((a, b) => b.createdAt - a.createdAt);
      setTransactions(txs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const attQuery = query(collection(db, 'attendances'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeAtts = onSnapshot(attQuery, (snapshot) => {
      const atts: AttendanceRecord[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      atts.sort((a, b) => b.timestamp - a.timestamp);
      setAttendances(atts);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendances'));

    const expQuery = query(collection(db, 'expenses'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeExpenses = onSnapshot(expQuery, (snapshot) => {
      const exps: Expense[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      exps.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(exps);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const batchQuery = query(collection(db, 'batches'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeBatches = onSnapshot(batchQuery, (snapshot) => {
      const bs: Batch[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Batch));
      bs.sort((a, b) => b.createdAt - a.createdAt);
      setBatches(bs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'batches'));

    const leadsQuery = query(collection(db, 'leads'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const ls: Lead[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      ls.sort((a, b) => b.createdAt - a.createdAt);
      setLeads(ls);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'leads'));

    const oeQuery = query(collection(db, 'office_earnings'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeOE = onSnapshot(oeQuery, (snapshot) => {
      const oes: OfficeEarning[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeEarning));
      oes.sort((a, b) => b.createdAt - a.createdAt);
      setOfficeEarnings(oes);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'office_earnings'));

    const availQuery = query(collection(db, 'teacher_availability'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeAvail = onSnapshot(availQuery, (snapshot) => {
      const avails: TeacherAvailability[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherAvailability));
      setTeacherAvailabilities(avails);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teacher_availability'));

    const calQuery = query(collection(db, 'calendar_events'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeCal = onSnapshot(calQuery, (snapshot) => {
      const events: CalendarEvent[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
      events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      setCalendarEvents(events);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'calendar_events'));

    const mailQuery = query(collection(db, 'email_logs'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeMail = onSnapshot(mailQuery, (snapshot) => {
      const logs: EmailLog[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailLog));
      logs.sort((a, b) => b.sentAt - a.sentAt);
      setEmailLogs(logs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'email_logs');
      setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeTxs();
      unsubscribeAtts();
      unsubscribeExpenses();
      unsubscribeBatches();
      unsubscribeLeads();
      unsubscribeOE();
      unsubscribeAvail();
      unsubscribeCal();
      unsubscribeMail();
    };
  }, [user]);

  return (
    <DataContext.Provider value={{ 
      students, transactions, attendances, expenses, batches, leads, officeEarnings,
      teacherAvailabilities, calendarEvents, emailLogs, loading
    }}>
      {children}
    </DataContext.Provider>
  );
};

