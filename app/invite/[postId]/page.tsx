'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Post } from '@/lib/types';
import { getPost } from '@/lib/firestore';
import { signUp } from '@/lib/auth';
import { BookOpenIcon, FilmIcon, MapPinIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function InvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const postId = params.postId as string;
  const referrerName = searchParams.get('ref') || 'Someone';
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupMode, setSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(referrerName !== 'Someone' ? referrerName : '');
  const [signupLoading, setSignupLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPost = async () => {
      try {
        console.log('🔍 Fetching post with ID:', postId);
        console.log('🌐 Current URL:', window.location.href);
        console.log('📱 User Agent:', navigator.userAgent);
        
        // Mobile debugging - remove after testing
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          alert(`DEBUG: Fetching post ${postId} on mobile`);
          // Quick Firebase connection test
          const { db } = await import('@/lib/firebase');
          alert(`DEBUG: Firebase db object: ${db ? 'Connected' : 'Not connected'}`);
        }
        
        const postData = await getPost(postId);
        console.log('📄 Post data received:', postData ? 'Found' : 'Not found');
        
        // Mobile debugging - remove after testing
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          alert(`DEBUG: Post fetch result: ${postData ? 'SUCCESS - Found post' : 'FAILED - No post found'}`);
        }
        
        setPost(postData);
              } catch (error) {
          console.error('❌ Error fetching post:', error);
          console.error('🔧 Error details:', {
            postId,
            url: window.location.href,
            timestamp: new Date().toISOString()
          });
          
          // Mobile debugging - remove after testing
          if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            alert(`DEBUG: Error fetching post: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchPost();
    } else {
      console.warn('⚠️ No postId provided');
      setLoading(false);
    }
  }, [postId]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);
    setError('');

    try {
      await signUp(email, password, name);
      // Redirect to main app after successful signup
      window.location.href = '/';
    } catch (err: unknown) {
      const error = err as Error;
      let errorMessage = error.message || 'An error occurred';
      
      // Show user-friendly error messages
      if (errorMessage.includes('auth/email-already-in-use')) {
        errorMessage = 'An account with this email already exists. Try signing in instead.';
      } else if (errorMessage.includes('auth/weak-password')) {
        errorMessage = 'Password should be at least 6 characters long.';
      } else if (errorMessage.includes('auth/invalid-email')) {
        errorMessage = 'Please enter a valid email address.';
      }
      
      setError(errorMessage);
      setSignupLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'books':
        return <BookOpenIcon className="h-6 w-6" />;
      case 'movies':
        return <FilmIcon className="h-6 w-6" />;
      case 'places':
        return <MapPinIcon className="h-6 w-6" />;
      default:
        return <SparklesIcon className="h-6 w-6" />;
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

  if (!post) {
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {post.authorName} is sharing your recommendation!
          </h1>
        </div>

        {/* Post Preview */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {post.universalItem?.image ? (
                <Image
                  src={post.universalItem.image}
                  alt={post.title}
                  width={80}
                  height={100}
                  className="w-20 h-25 object-cover rounded-lg"
                />
              ) : (
                <div className="w-20 h-25 bg-gray-200 rounded-lg flex items-center justify-center">
                  {getCategoryIcon(post.category)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">{getCategoryEmoji(post.category)}</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full font-medium text-gray-600">
                  {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
                </span>
              </div>
              <h2 className="font-bold text-gray-900 mb-2 text-lg">
                {post.title}
              </h2>
              {post.description && (
                <p className="text-gray-600 text-sm mb-3">
                  {post.description}
                </p>
              )}
              {post.rating && (
                <div className="flex items-center space-x-1 mb-2">
                  <span className="text-yellow-500">⭐</span>
                  <span className="text-sm font-medium text-gray-700">
                    {post.rating}/10
                  </span>
                </div>
              )}
              <div className="text-xs text-gray-500">
                Shared by {post.authorName}
                {post.recommendedBy && (
                  <span> • Recommended by {post.recommendedBy}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Signup Form */}
        {!signupMode ? (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Join Rex to see more
            </h3>
            <p className="text-gray-600 text-sm text-center mb-6">
              Save recommendations from friends, discover new experiences, and never forget what to try next.
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