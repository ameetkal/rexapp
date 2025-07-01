import { Suspense } from 'react';
import AuthProvider from '@/components/AuthProvider';
import MainApp from '@/components/MainApp';

export default function Home() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <MainApp />
      </Suspense>
    </AuthProvider>
  );
}
