'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { onAuthStateChange, getUserProfile } from '@/lib/auth';
import PWAInstallPrompt from './PWAInstallPrompt';
import { usePWAInstallStatus } from './PWAInstallStatus';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserProfile, setLoading } = useAuthStore();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { isInstalled, isLoading: installStatusLoading } = usePWAInstallStatus();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user);
      
      if (user) {
        const userProfile = await getUserProfile(user.uid);
        setUserProfile(userProfile);
        
        // Check if we should show the PWA install prompt
        const hasSeenInstallPrompt = localStorage.getItem('rex-pwa-prompt-shown');
        const isNewUser = !hasSeenInstallPrompt;
        
        if (isNewUser && !isInstalled && !installStatusLoading) {
          // Show the install prompt after a short delay to let the app load
          setTimeout(() => {
            setShowInstallPrompt(true);
          }, 2000);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setUserProfile, setLoading, isInstalled, installStatusLoading]);

  const handleDismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    // Remember that we've shown the prompt to this user
    localStorage.setItem('rex-pwa-prompt-shown', 'true');
  };

  return (
    <>
      {children}
      {showInstallPrompt && (
        <PWAInstallPrompt onDismiss={handleDismissInstallPrompt} />
      )}
    </>
  );
} 