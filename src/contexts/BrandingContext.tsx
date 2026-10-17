import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BrandingSettings } from '../types';

interface BrandingContextType {
  branding: BrandingSettings;
  updateBranding: (newSettings: Partial<BrandingSettings>) => Promise<void>;
  loadingBranding: boolean;
}

const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: '/seven-ai-logo.png',
  platformName: 'Seven AI',
  tagline: 'Kal ke liye aaj se smart bano'
};

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  updateBranding: async () => {},
  loadingBranding: false
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loadingBranding, setLoadingBranding] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'branding'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as BrandingSettings;
        setBranding({
          logoUrl: data.logoUrl || '/seven-ai-logo.png',
          platformName: data.platformName || 'Seven AI',
          tagline: data.tagline || 'Kal ke liye aaj se smart bano',
          updatedAt: data.updatedAt
        });
      } else {
        setBranding(DEFAULT_BRANDING);
      }
      setLoadingBranding(false);
    }, (err) => {
      console.warn("Branding settings snapshot listener (using default fallback):", err);
      setLoadingBranding(false);
    });

    return () => unsubscribe();
  }, []);

  const updateBranding = async (newSettings: Partial<BrandingSettings>) => {
    try {
      await setDoc(doc(db, 'settings', 'branding'), {
        ...branding,
        ...newSettings,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/branding');
      throw err;
    }
  };

  return (
    <BrandingContext.Provider value={{ branding, updateBranding, loadingBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};
