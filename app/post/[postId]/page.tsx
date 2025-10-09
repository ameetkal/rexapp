'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PostDetailPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to feed - post details now shown inline via comments
    router.push('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Redirecting to feed...</p>
      </div>
    </div>
  );
} 