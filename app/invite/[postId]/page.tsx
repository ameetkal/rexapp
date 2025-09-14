'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Post } from '@/lib/types';
import { getPost, followUser } from '@/lib/firestore';
import { signUp } from '@/lib/auth';

export default function InvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
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
        

        
        const postData = await getPost(postId);
        console.log('📄 Post data received:', postData ? 'Found' : 'Not found');
        setPost(postData);
              } catch (error) {
          console.error('❌ Error fetching post:', error);
          console.error('🔧 Error details:', {
            postId,
            url: window.location.href,
            timestamp: new Date().toISOString()
          });
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
      const result = await signUp(email, password, name);
      // Auto-follow the inviter (post author) if available
      if (result?.user && post?.authorId) {
        try {
          await followUser(result.user.uid, post.authorId);
        } catch (err) {
          console.error('Error auto-following inviter:', err);
        }
      }
      // Redirect to main app after successful signup
      router.push('/');
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
            {post.authorName} shared your recommendation!
          </h1>
        </div>

        {/* Post Preview */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-3xl mb-3">{getCategoryEmoji(post.category)}</div>
            <h2 className="font-bold text-gray-900 mb-4 text-xl">
              {post.title}
            </h2>
            <div className="inline-flex items-center space-x-1 text-xs bg-green-50 text-green-700 px-3 py-2 rounded-full">
              <span>✅</span>
              <span>Shared</span>
            </div>
          </div>
        </div>

        {/* Signup Form */}
        {!signupMode ? (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
              Join Rex to save & share recommendations
            </h3>
            <button
              onClick={() => setSignupMode(true)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Join Rex
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
                <div className="flex items-center justify-center space-x-4 text-sm">
                  <button
                    type="button"
                    onClick={() => setSignupMode(false)}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={() => window.location.href = '/'}
                    className="text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Sign In Instead
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
} 