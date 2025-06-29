'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChange, getUserProfile } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';
import PWAInstallPrompt from './PWAInstallPrompt';
import { usePWAInstallStatus } from './PWAInstallStatus';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { setUser, setUserProfile, setLoading } = useAuthStore();
  const { isInstalled, isLoading: pwaLoading } = usePWAInstallStatus();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setLoading(true);
      
      if (user) {
        try {
          const userProfile = await getUserProfile(user.uid);
          setUser(user);
          setUserProfile(userProfile);
          
          // Show PWA install prompt for new users (if not already installed)
          if (userProfile && !isInstalled && !pwaLoading) {
            const hasSeenPrompt = localStorage.getItem('rex-pwa-prompt-seen');
            if (!hasSeenPrompt) {
              setTimeout(() => setShowInstallPrompt(true), 2000); // Show after 2 seconds
            }
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
          setUser(user);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setUserProfile, setLoading, isInstalled, pwaLoading]);

  const handleInstallPromptDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('rex-pwa-prompt-seen', 'true');
  };

  return (
    <>
      {children}
      {showInstallPrompt && (
        <PWAInstallPrompt onDismiss={handleInstallPromptDismiss} />
      )}
    </>
  );
} 