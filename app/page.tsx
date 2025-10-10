import { Suspense } from 'react';
import ClerkAuthProvider from '@/components/ClerkAuthProvider';
import MainApp from '@/components/MainApp';

export default function Home() {
  return (
    <ClerkAuthProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <MainApp />
      </Suspense>
    </ClerkAuthProvider>
  );
}
