import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Staff } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Staff | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  hasAccess: boolean;
  role: 'admin' | 'staff' | null;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isAdmin: false, 
  isStaff: false,
  hasAccess: false,
  role: null
});

export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAILS = ['harsimransingh27448@gmail.com', 'harsimransd726@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser?.emailVerified) {
         try {
           const staffRef = doc(db, 'staff', currentUser.uid);
           const staffSnap = await getDoc(staffRef);
           const isDefaultAdmin = currentUser.email ? ADMIN_EMAILS.includes(currentUser.email.toLowerCase()) : false;
           
           if (!staffSnap.exists()) {
             // Check if an admin pre-approved or pre-added this email in the staff collection
             let preApprovedRole: 'admin' | 'staff' = 'staff';
             let preApprovedStatus: 'approved' | 'pending' = 'pending';

             if (currentUser.email) {
               const preQuery = query(collection(db, 'staff'), where('email', '==', currentUser.email.toLowerCase()));
               const preSnap = await getDocs(preQuery);
               if (!preSnap.empty) {
                 const preData = preSnap.docs[0].data();
                 preApprovedRole = preData.role === 'admin' ? 'admin' : 'staff';
                 preApprovedStatus = preData.status === 'approved' ? 'approved' : 'pending';
               }
             }

             await setDoc(staffRef, {
               name: currentUser.displayName || currentUser.email || 'User',
               email: currentUser.email?.toLowerCase() || '',
               status: isDefaultAdmin ? 'approved' : preApprovedStatus,
               role: isDefaultAdmin ? 'admin' : preApprovedRole,
               createdAt: Date.now()
             });
           } else if (isDefaultAdmin) {
             const data = staffSnap.data();
             if (data.role !== 'admin' || data.status !== 'approved') {
               await setDoc(staffRef, { status: 'approved', role: 'admin' }, { merge: true });
             }
           }

           unsubscribeProfile = onSnapshot(staffRef, (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                setProfile({ 
                  id: snap.id, 
                  ...data,
                  status: data.status || 'pending',
                  role: data.role || 'staff'
                } as Staff);
              }
              setLoading(false);
           }, () => setLoading(false));

         } catch (error) {
           console.error("Error creating or fetching staff record", error);
           setLoading(false);
         }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const isAdmin = profile?.role === 'admin' || (user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false);
  const isStaff = profile?.role === 'staff' && !isAdmin;
  const hasAccess = isAdmin || profile?.status === 'approved';
  const role = isAdmin ? 'admin' : profile?.role === 'staff' ? 'staff' : null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isStaff, hasAccess, role }}>
      {children}
    </AuthContext.Provider>
  );
};
