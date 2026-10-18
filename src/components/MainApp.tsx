import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { DataProvider } from '../contexts/DataContext';
import { loginWithGoogle, logout } from '../lib/firebase';
import { 
  LayoutDashboard, Users, Receipt, Bell, LogOut, Loader2, 
  Coins, UserCheck, ShieldCheck, Mail, BookOpen, Contact, Shield, User, KeyRound, Sparkles, AlertCircle, Camera, Settings, Calendar
} from 'lucide-react';
import Dashboard from './Dashboard';
import Students from './Students';
import FeesCollection from './FeesCollection';
import Reminders from './Reminders';
import Attendance from './Attendance';
import Expenses from './Expenses';
import StaffManagement from './StaffManagement';
import Batches from './Batches';
import Leads from './Leads';
import CalendarView from './CalendarView';
import { ProfileAndBrandingModal } from './ProfileAndBrandingModal';

type Tab = 'dashboard' | 'students' | 'batches' | 'leads' | 'calendar' | 'fees' | 'reminders' | 'attendance' | 'expenses' | 'staff';

const MainApp = () => {
  const { user, profile, loading, isAdmin, isStaff, hasAccess } = useAuth();
  const { branding } = useBranding();
  
  // Default tab based on role
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Settings & Profile Photo Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState<'profile' | 'branding'>('profile');

  const handleOpenSettings = (tab: 'profile' | 'branding') => {
    setModalDefaultTab(tab);
    setShowSettingsModal(true);
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Sign-in error:", err);
      const errCode = err?.code || '';
      const errMsg = err?.message || String(err);

      if (errCode === 'auth/unauthorized-domain') {
        setAuthError(
          `Domain Unauthorized: '${window.location.hostname}' is not authorized in Firebase Console. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains and add this domain.`
        );
      } else if (errCode === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups or try again.');
      } else if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
        setAuthError('Sign-in popup was closed before completing. Please click below to try again.');
      } else if (errCode === 'auth/network-request-failed') {
        setAuthError('Network error during sign-in. Please check your internet connection.');
      } else {
        setAuthError(errMsg || 'An error occurred during Google sign in.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Enforce access control for staff members: if staff tries to visit admin-only tab, redirect to 'leads'
  useEffect(() => {
    if (!loading && hasAccess) {
      if (isAdmin) {
        // Admins can default to dashboard if on initial mount
        if (activeTab === 'leads' && !sessionStorage.getItem('visitedTab')) {
          setActiveTab('dashboard');
          sessionStorage.setItem('visitedTab', 'true');
        }
      } else {
        // Staff members are allowed 'leads', 'calendar', 'attendance', 'reminders'
        const allowedStaffTabs: Tab[] = ['leads', 'calendar', 'attendance', 'reminders'];
        if (!allowedStaffTabs.includes(activeTab)) {
          setActiveTab('leads');
        }
      }
    }
  }, [loading, isAdmin, hasAccess, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verifying Authentication & Role...</p>
        </div>
      </div>
    );
  }

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'sevenaiinstitute.store';

  const copyHostToClipboard = () => {
    navigator.clipboard.writeText(currentHost);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  if (!user) {
    const isDomainError = authError?.includes('Domain Unauthorized') || authError?.includes('unauthorized-domain');

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans text-slate-900 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <div className={`bg-white p-8 border border-slate-200/20 shadow-2xl rounded-2xl w-full text-center relative overflow-hidden backdrop-blur-xl transition-all ${isDomainError ? 'max-w-md' : 'max-w-sm'}`}>
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <img 
            src={branding.logoUrl || "/seven-ai-logo.png"} 
            alt={branding.platformName || "Seven AI"} 
            className="w-20 h-20 mx-auto mb-4 bg-slate-50 p-1.5 rounded-full border-2 border-indigo-500 shadow-md object-contain" 
          />
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{branding.platformName || "Seven AI"}</h1>
          <p className="text-slate-500 mb-6 text-[10px] uppercase tracking-[0.2em] font-bold">{branding.tagline || "Kal ke liye aaj se smart bano"}</p>

          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 text-left mb-4">
            <p className="text-[11px] font-bold text-indigo-950 flex items-center gap-1.5">
              <KeyRound size={14} className="text-indigo-600" /> Authorized Access Only
            </p>
            <p className="text-[10px] text-indigo-700 mt-1">Sign in with Google to access Institute Management Portal.</p>
          </div>

          {authError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 mb-4 text-left space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-rose-900">Authentication Failed</p>
                  <p className="text-[10px] text-rose-700 mt-0.5 leading-relaxed">{authError}</p>
                </div>
              </div>

              {isDomainError && (
                <div className="mt-3 pt-3 border-t border-rose-200/80 text-[11px] space-y-2.5">
                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200 flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-slate-800 text-[11px] truncate">{currentHost}</span>
                    <button
                      onClick={copyHostToClipboard}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded text-[10px] transition shrink-0 flex items-center gap-1"
                    >
                      {copiedDomain ? 'Copied!' : 'Copy Domain'}
                    </button>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900 text-[10px] leading-relaxed">
                    <p className="font-bold text-amber-950 mb-1">Quick Fix Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 font-medium">
                      <li>Open <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-indigo-700">Firebase Console</a>.</li>
                      <li>Go to <strong>Authentication</strong> → <strong>Settings</strong> tab.</li>
                      <li>Under <strong>Authorized domains</strong>, click <strong>Add domain</strong>.</li>
                      <li>Paste <code className="bg-amber-100 px-1 rounded font-bold text-slate-900">{currentHost}</code> and save.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            className="w-full bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
          >
            {isSigningIn ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Signing In...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Sign In With Google
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
        <div className="bg-white p-8 border border-slate-200 shadow-xl rounded-2xl max-w-md w-full text-center">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center font-bold text-amber-600 mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase mb-2">Access Request Pending</h1>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Your Google Account (<strong className="text-slate-900">{user.email}</strong>) is registered, but pending approval by an Institute Administrator.
          </p>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left mb-6 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Registered Name:</span>
              <span className="font-bold text-slate-800">{user.displayName || 'Staff Member'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Email Address:</span>
              <span className="font-semibold text-slate-800">{user.email}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Access Status:</span>
              <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[10px] uppercase">Pending Admin Approval</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <a 
              href={`mailto:harsimransingh27448@gmail.com?subject=Access Request for Seven AI&body=Hi Admin,%0D%0A%0D%0APlease approve my access to the Seven AI system.%0D%0A%0D%0AMy registered email is: ${user.email}%0D%0A%0D%0ARegards,%0D%0A${user.displayName || 'Staff'}`}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow flex items-center justify-center gap-2"
            >
              <Mail size={16} /> Contact Admin For Instant Approval
            </a>
            <button 
              onClick={logout}
              className="w-full bg-slate-100 text-slate-700 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-widest hover:bg-slate-200 transition"
            >
              Sign Out / Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userPhoto = profile?.photoURL || user?.photoURL;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-950 text-slate-200 flex flex-col border-r border-indigo-900 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-6 pb-4 relative group">
          <div className="flex flex-col items-center gap-2">
            <div className="relative group">
              <img 
                src={branding.logoUrl || "/seven-ai-logo.png"} 
                alt={branding.platformName || "Seven AI"} 
                className="w-14 h-14 bg-white p-1 rounded-full border-2 border-indigo-500 shadow-md object-contain" 
              />
              {isAdmin && (
                <button
                  onClick={() => handleOpenSettings('branding')}
                  className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1 rounded-full shadow hover:bg-indigo-500 transition"
                  title="Change Platform Logo"
                >
                  <Camera size={12} />
                </button>
              )}
            </div>

            <h1 className="text-lg font-black tracking-tight text-white uppercase text-center">
              {branding.platformName || "Seven AI"}<br/>
              <span className="text-[10px] text-indigo-400 uppercase tracking-[0.1em] font-medium">Institute Platform</span>
            </h1>
          </div>
        </div>
        
        {/* Navigation Menu */}
        <nav className="mt-4 flex-1 px-3 space-y-1">
          {/* ADMIN ONLY TABS */}
          {isAdmin && (
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={<LayoutDashboard size={18}/>} 
              label="Executive Dashboard" 
            />
          )}

          {/* BOTH ADMIN & STAFF TABS */}
          <NavItem 
            active={activeTab === 'leads'} 
            onClick={() => setActiveTab('leads')} 
            icon={<Contact size={18}/>} 
            label="Leads Collection" 
          />

          <NavItem 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
            icon={<Calendar size={18}/>} 
            label="Academic Calendar & Timings" 
          />

          {/* ADMIN ONLY TABS */}
          {isAdmin && (
            <>
              <NavItem 
                active={activeTab === 'students'} 
                onClick={() => setActiveTab('students')} 
                icon={<Users size={18}/>} 
                label="Student Registry" 
              />
              <NavItem 
                active={activeTab === 'batches'} 
                onClick={() => setActiveTab('batches')} 
                icon={<BookOpen size={18}/>} 
                label="Batch Management" 
              />
              <NavItem 
                active={activeTab === 'fees'} 
                onClick={() => setActiveTab('fees')} 
                icon={<Receipt size={18}/>} 
                label="Billing & Collection" 
              />
            </>
          )}

          {/* BOTH ADMIN & STAFF TABS */}
          <NavItem 
            active={activeTab === 'attendance'} 
            onClick={() => setActiveTab('attendance')} 
            icon={<UserCheck size={18}/>} 
            label="AI Attendance" 
          />

          {/* ADMIN ONLY TABS */}
          {isAdmin && (
            <NavItem 
              active={activeTab === 'expenses'} 
              onClick={() => setActiveTab('expenses')} 
              icon={<Coins size={18}/>} 
              label="Institute Expenses" 
            />
          )}

          {/* BOTH ADMIN & STAFF TABS */}
          <NavItem 
            active={activeTab === 'reminders'} 
            onClick={() => setActiveTab('reminders')} 
            icon={<Mail size={18}/>} 
            label="Communications" 
          />

          {/* ADMIN ONLY TABS */}
          {isAdmin && (
            <NavItem 
              active={activeTab === 'staff'} 
              onClick={() => setActiveTab('staff')} 
              icon={<ShieldCheck size={18}/>} 
              label="Admin & Staff Access" 
            />
          )}
        </nav>
        
        {/* Profile & Logout Footer */}
        <div className="p-4 mt-auto border-t border-indigo-900 bg-indigo-950/80">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => handleOpenSettings('profile')}
              className="relative group shrink-0"
              title="Change Profile Picture"
            >
              {userPhoto ? (
                <img 
                  src={userPhoto} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-indigo-400 shadow-md" 
                />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white ${
                  isAdmin ? 'bg-indigo-500 border border-indigo-300' : 'bg-emerald-600 border border-emerald-400'
                }`}>
                  {profile?.name?.[0]?.toUpperCase() || user.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Camera size={12} className="text-white" />
              </div>
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{profile?.name || user.displayName || 'User'}</p>
              
              {/* Role Badge */}
              <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.2 rounded mt-0.5 ${
                isAdmin ? 'bg-indigo-500/30 text-indigo-300' : 'bg-emerald-500/30 text-emerald-300'
              }`}>
                {isAdmin ? <Shield size={10} /> : <User size={10} />}
                {isAdmin ? 'ADMINISTRATOR' : 'STAFF MEMBER'}
              </span>
            </div>

            <button
              onClick={() => handleOpenSettings(isAdmin ? 'branding' : 'profile')}
              className="text-indigo-300 hover:text-white p-1.5 rounded-lg hover:bg-indigo-900/60 transition"
              title="Image & Branding Settings"
            >
              <Settings size={16} />
            </button>
          </div>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-widest text-indigo-300 hover:text-rose-400 hover:bg-indigo-900/60 p-2 rounded-lg transition"
          >
            <LogOut size={14} /> System Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-auto">
        <DataProvider>
          <div className="p-8 max-w-7xl mx-auto flex flex-col min-h-screen">
             {/* Component Rendering with Access Protection */}
             {activeTab === 'dashboard' && isAdmin && <Dashboard />}
             {activeTab === 'leads' && <Leads />}
             {activeTab === 'calendar' && <CalendarView />}
             {activeTab === 'students' && isAdmin && <Students />}
             {activeTab === 'batches' && isAdmin && <Batches />}
             {activeTab === 'fees' && isAdmin && <FeesCollection />}
             {activeTab === 'attendance' && <Attendance />}
             {activeTab === 'expenses' && isAdmin && <Expenses />}
             {activeTab === 'reminders' && <Reminders />}
             {activeTab === 'staff' && isAdmin && <StaffManagement />}
             
             {/* Footer Context Bar */}
             <footer className="py-3 border-t border-slate-200 flex justify-between items-center mt-auto text-[10px] font-bold text-slate-400 uppercase tracking-wider">
               <div className="flex items-center gap-3">
                 <span>{branding.platformName || "SEVEN AI PORTAL"} v2.5</span>
                 <span className="text-slate-300">•</span>
                 <span>ROLE: {isAdmin ? 'ADMINISTRATOR (FULL ACCESS)' : 'STAFF MEMBER (RESTRICTED)'}</span>
               </div>
               <div className="flex gap-4">
                 <span className="text-emerald-600">SESSION: ACTIVE</span>
               </div>
             </footer>
          </div>
        </DataProvider>
      </main>

      {/* Profile & Platform Branding Settings Modal */}
      <ProfileAndBrandingModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
        defaultTab={modalDefaultTab} 
      />
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all ${
      active 
        ? 'bg-indigo-600 text-white font-bold shadow-sm' 
        : 'text-indigo-200 hover:bg-indigo-900/50 hover:text-white'
    }`}
  >
    <div className={active ? 'opacity-100 text-white' : 'opacity-70'}>{icon}</div>
    <span className="text-xs font-semibold">{label}</span>
  </button>
);

export default MainApp;
