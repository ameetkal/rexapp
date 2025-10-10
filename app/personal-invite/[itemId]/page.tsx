'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PersonalInvitePage() {
  const searchParams = useSearchParams();
  const referrerName = searchParams.get('ref') || 'A friend';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🎉</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to Rex!
        </h1>
        
        <p className="text-gray-600 mb-6">
          {referrerName} invited you to join Rex - the best way to track and share activities with friends!
        </p>

        <p className="text-sm text-gray-500 mb-6">
          This invite link is from an older version, but you can still join Rex and start exploring.
        </p>
        
        <Link
          href="/"
          className="inline-block w-full py-3 px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Get Started with Rex
        </Link>
      </div>
    </div>
  );
}
