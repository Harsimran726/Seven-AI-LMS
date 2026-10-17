import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { compressAndConvertToDataUrl } from '../lib/imageUtils';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  X, Upload, Image as ImageIcon, Camera, Check, RefreshCw, 
  Shield, User, Sparkles, Building2, CheckCircle2, AlertCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'profile' | 'branding';
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80'
];

export const ProfileAndBrandingModal: React.FC<Props> = ({ isOpen, onClose, defaultTab = 'profile' }) => {
  const { user, profile, isAdmin } = useAuth();
  const { branding, updateBranding } = useBranding();

  const [activeTab, setActiveTab] = useState<'profile' | 'branding'>(
    isAdmin && defaultTab === 'branding' ? 'branding' : 'profile'
  );

  // User Profile State
  const [profilePhoto, setProfilePhoto] = useState<string>(profile?.photoURL || user?.photoURL || '');
  const [profileName, setProfileName] = useState<string>(profile?.name || user?.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Platform Branding State
  const [logoUrl, setLogoUrl] = useState<string>(branding.logoUrl || '/seven-ai-logo.png');
  const [platformName, setPlatformName] = useState<string>(branding.platformName || 'Seven AI');
  const [tagline, setTagline] = useState<string>(branding.tagline || 'Kal ke liye aaj se smart bano');
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle User Profile Picture Upload
  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageError(null);
      const dataUrl = await compressAndConvertToDataUrl(file, 250, 250, 0.85);
      setProfilePhoto(dataUrl);
    } catch (err: any) {
      setImageError(err?.message || 'Failed to process selected profile image.');
    }
  };

  // Handle Platform Logo Image Upload
  const handleLogoImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImageError(null);
      const dataUrl = await compressAndConvertToDataUrl(file, 300, 300, 0.9);
      setLogoUrl(dataUrl);
    } catch (err: any) {
      setImageError(err?.message || 'Failed to process selected platform logo.');
    }
  };

  // Save User Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setProfileSuccess(false);
    try {
      const staffRef = doc(db, 'staff', user.uid);
      await updateDoc(staffRef, {
        name: profileName.trim() || 'User',
        photoURL: profilePhoto,
        updatedAt: Date.now()
      });

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staff/${user.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  // Save Platform Logo & Settings (Admin)
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSavingBranding(true);
    setBrandingSuccess(false);
    try {
      await updateBranding({
        logoUrl,
        platformName: platformName.trim() || 'Seven AI',
        tagline: tagline.trim() || 'Kal ke liye aaj se smart bano'
      });

      setBrandingSuccess(true);
      setTimeout(() => setBrandingSuccess(false), 3000);
    } catch (err) {
      console.error("Save branding failed:", err);
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scaleUp">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center border-b border-indigo-900">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Camera size={20} className="text-indigo-400" />
              Profile & Platform Settings
            </h3>
            <p className="text-xs text-indigo-200/80 mt-0.5">Customize your personal profile picture or platform branding</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider rounded-t-xl transition border-b-2 ${
              activeTab === 'profile'
                ? 'bg-white border-indigo-600 text-indigo-700 shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <User size={15} /> My Profile Picture
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('branding')}
              className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider rounded-t-xl transition border-b-2 ${
                activeTab === 'branding'
                  ? 'bg-white border-indigo-600 text-indigo-700 shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Building2 size={15} /> Platform Logo & Branding
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {imageError && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{imageError}</span>
            </div>
          )}

          {/* TAB 1: USER PROFILE PICTURE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                {/* Image Preview */}
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 rounded-full border-4 border-indigo-500 shadow-md overflow-hidden bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{profileName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => profileFileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition"
                    title="Upload New Photo"
                  >
                    <Upload size={14} />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">Upload Profile Picture</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Upload a high-quality personal photo or avatar. Recommended size 300x300 pixels (PNG, JPG, WebP).
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                    <button
                      type="button"
                      onClick={() => profileFileInputRef.current?.click()}
                      className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                    >
                      <Upload size={14} /> Upload Image File
                    </button>

                    {profilePhoto && (
                      <button
                        type="button"
                        onClick={() => setProfilePhoto('')}
                        className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  <input
                    ref={profileFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Preset Avatars Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Or Choose From Preset Avatars
                </label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfilePhoto(url)}
                      className={`w-12 h-12 rounded-full overflow-hidden border-2 transition ${
                        profilePhoto === url ? 'border-indigo-600 ring-2 ring-indigo-500 scale-105' : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              {profileSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Profile picture and display name updated successfully!
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={savingProfile}
                  type="submit"
                  className="bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-6 rounded-xl shadow hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PLATFORM LOGO & BRANDING (ADMIN ONLY) */}
          {activeTab === 'branding' && isAdmin && (
            <form onSubmit={handleSaveBranding} className="space-y-5">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                {/* Platform Logo Preview */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-2xl border-2 border-indigo-500 bg-white p-2 shadow-md flex items-center justify-center overflow-hidden">
                    <img 
                      src={logoUrl || '/seven-ai-logo.png'} 
                      alt="Platform Logo" 
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).setAttribute('src', '/seven-ai-logo.png');
                      }}
                    />
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">Upload Platform Logo</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    This logo appears on the Login screen, Sidebar header, Reports, and System Receipts.
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="bg-indigo-600 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow hover:bg-indigo-700 transition"
                    >
                      <Upload size={14} /> Upload New Logo
                    </button>

                    <button
                      type="button"
                      onClick={() => setLogoUrl('/seven-ai-logo.png')}
                      className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Reset Default
                    </button>
                  </div>

                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Direct Logo Image URL Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Or Paste Custom Image Web URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              {/* Platform Name & Tagline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Platform Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={platformName}
                    onChange={e => setPlatformName(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Sub-tagline
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              {brandingSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Platform logo and branding updated live across all screens!
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={savingBranding}
                  type="submit"
                  className="bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-6 rounded-xl shadow hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {savingBranding ? 'Saving...' : 'Update Platform Branding'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
