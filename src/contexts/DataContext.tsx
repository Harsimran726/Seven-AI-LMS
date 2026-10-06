import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { Student, Transaction, AttendanceRecord, Expense, Batch, Lead, OfficeEarning } from '../types';

interface DataContextType {
  students: Student[];
  transactions: Transaction[];
  attendances: AttendanceRecord[];
  expenses: Expense[];
  batches: Batch[];
  leads: Lead[];
  officeEarnings: OfficeEarning[];
  loading: boolean;
}

const DataContext = createContext<DataContextType>({ students: [], transactions: [], attendances: [], expenses: [], batches: [], leads: [], officeEarnings: [], loading: true });

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.emailVerified) {
      setStudents([]);
      setTransactions([]);
      setAttendances([]);
      setExpenses([]);
      setBatches([]);
      setLeads([]);
      setOfficeEarnings([]);
      setLoading(false);
      return;
    }

    const studentsQuery = query(collection(db, 'students'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studs: Student[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      // Clientside sort by name
      studs.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const txQuery = query(collection(db, 'transactions'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeTxs = onSnapshot(txQuery, (snapshot) => {
      const txs: Transaction[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      // Clientside sort by latest
      txs.sort((a, b) => b.createdAt - a.createdAt);
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const attQuery = query(collection(db, 'attendances'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeAtts = onSnapshot(attQuery, (snapshot) => {
      const atts: AttendanceRecord[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      atts.sort((a, b) => b.timestamp - a.timestamp);
      setAttendances(atts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendances');
    });

    const expQuery = query(collection(db, 'expenses'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeExpenses = onSnapshot(expQuery, (snapshot) => {
      const exps: Expense[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      exps.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(exps);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    const batchQuery = query(collection(db, 'batches'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeBatches = onSnapshot(batchQuery, (snapshot) => {
      const bs: Batch[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Batch));
      bs.sort((a, b) => b.createdAt - a.createdAt);
      setBatches(bs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'batches');
    });

    const leadsQuery = query(collection(db, 'leads'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
      const ls: Lead[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      ls.sort((a, b) => b.createdAt - a.createdAt);
      setLeads(ls);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    });

    const oeQuery = query(collection(db, 'office_earnings'), where('instituteId', '==', 'SevenAI'));
    const unsubscribeOE = onSnapshot(oeQuery, (snapshot) => {
      const oes: OfficeEarning[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfficeEarning));
      oes.sort((a, b) => b.createdAt - a.createdAt);
      setOfficeEarnings(oes);

      // Finally loading = false here
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'office_earnings');
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
    };
  }, [user]);

  return (
    <DataContext.Provider value={{ students, transactions, attendances, expenses, batches, leads, officeEarnings, loading: loading && (!students.length && !transactions.length && !attendances.length && !expenses.length && !batches.length && !leads.length && !officeEarnings.length) }}>
      {children}
    </DataContext.Provider>
  );
};
