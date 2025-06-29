'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PersonalItem } from '@/lib/types';
import { getPersonalItem } from '@/lib/firestore';
import { signUp } from '@/lib/auth';

export default function PersonalInvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params.itemId as string;
  const referrerName = searchParams.get('ref') || 'Someone';
  
  const [item, setItem] = useState<PersonalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupMode, setSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(referrerName !== 'Someone' ? referrerName : '');
  const [signupLoading, setSignupLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const itemData = await getPersonalItem(itemId);
        setItem(itemData);
      } catch (error) {
        console.error('Error fetching personal item:', error);
      } finally {
        setLoading(false);
      }
    };

    if (itemId) {
      fetchItem();
    }
  }, [itemId]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);
    setError('');

    try {
      await signUp(email, password, name);
      // User will be redirected to main app by auth state change
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'An error occurred');
    } finally {
      setSignupLoading(false);
    }
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'books':
        return '📚';
      case 'movies':
        return '🎬';
      case 'places':
        return '📍';
      case 'music':
        return '🎵';
      default:
        return '✨';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recommendation...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Recommendation Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            This recommendation may no longer be available.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Explore Rex
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Your recommendation was saved!
          </h1>
          <p className="text-gray-600">
            {referrerName} saved your recommendation on Rex
          </p>
        </div>

        {/* Item Preview */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-2xl">{getCategoryEmoji(item.category)}</span>
              <span className="text-sm bg-gray-100 px-3 py-1 rounded-full font-medium text-gray-600">
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
              </span>
            </div>
            <h2 className="font-bold text-gray-900 mb-3 text-xl">
              {item.title}
            </h2>
            {item.description && (
              <p className="text-gray-600 text-sm mb-4">
                {item.description}
              </p>
            )}
            {item.rating && (
              <div className="flex items-center justify-center space-x-1 mb-4">
                <span className="text-yellow-500">⭐</span>
                <span className="text-sm font-medium text-gray-700">
                  {item.rating}/10
                </span>
              </div>
            )}
            <div className="inline-flex items-center space-x-1 text-xs bg-green-50 text-green-700 px-3 py-2 rounded-full">
              <span>💾</span>
              <span>Saved to their list</span>
            </div>
          </div>
        </div>

        {/* Signup Form */}
        {!signupMode ? (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Join Rex to share recommendations
            </h3>
            <p className="text-gray-600 text-sm text-center mb-6">
              Connect with friends, save recommendations, and never forget what to try next.
            </p>
            <button
              onClick={() => setSignupMode(true)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-3"
            >
              Create Free Account
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Sign In Instead
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
              Create Your Account
            </h3>

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Create a password"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {signupLoading ? 'Creating Account...' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setSignupMode(false)}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        )}
        
        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Rex helps you save and share trusted recommendations
          </p>
        </div>
      </div>
    </div>
  );
} 