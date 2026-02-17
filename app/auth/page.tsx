'use client';

import { Suspense } from 'react';
import ClerkAuthProvider from '@/components/ClerkAuthProvider';
import AuthScreen from '@/components/AuthScreen';

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <ClerkAuthProvider>
        <AuthScreen />
      </ClerkAuthProvider>
    </Suspense>
  );
}
