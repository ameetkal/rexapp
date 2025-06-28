'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { onAuthStateChange, getUserProfile } from '@/lib/auth';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setUserProfile, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user);
      
      if (user) {
        const userProfile = await getUserProfile(user.uid);
        setUserProfile(userProfile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setUserProfile, setLoading]);

  return <>{children}</>;
} 