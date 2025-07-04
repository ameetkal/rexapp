'use client';

import { useState, useEffect } from 'react';
import { signIn, signUp } from '@/lib/auth';
import { useAuthStore } from '@/lib/store';
import { checkUsernameAvailability } from '@/lib/firestore';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onToggle: () => void;
}

export default function AuthForm({ mode, onToggle }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  const { setUserProfile } = useAuthStore();

  // Check username availability as user types
  useEffect(() => {
    if (mode === 'signup' && username.length >= 3) {
      const checkUsername = async () => {
        setCheckingUsername(true);
        try {
          const available = await checkUsernameAvailability(username);
          setUsernameAvailable(available);
        } catch (error) {
          console.error('Error checking username:', error);
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      };

      const timeoutId = setTimeout(checkUsername, 500); // Debounce
      return () => clearTimeout(timeoutId);
    } else {
      setUsernameAvailable(null);
      setCheckingUsername(false);
    }
  }, [username, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        // Validate username availability before submitting
        if (username && usernameAvailable === false) {
          throw new Error('Username is not available');
        }
        
        const { userProfile } = await signUp(email, password, name, username);
        setUserProfile(userProfile);
      } else {
        await signIn(email, password);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Rex
          </h1>
          <p className="text-gray-600">
            {mode === 'login' 
              ? 'Sign in to access your recommendations' 
              : 'Create your account to start saving recommendations'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'signup' && (
            <>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-500"
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all placeholder:text-gray-500 ${
                      username.length >= 3 
                        ? usernameAvailable === true 
                          ? 'border-green-300 focus:ring-green-500' 
                          : usernameAvailable === false 
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Enter a username (letters, numbers, underscore)"
                    pattern="^[a-z0-9_]+$"
                    minLength={3}
                    maxLength={20}
                  />
                  {username.length >= 3 && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {checkingUsername ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                      ) : usernameAvailable === true ? (
                        <span className="text-green-500 text-sm">✓</span>
                      ) : usernameAvailable === false ? (
                        <span className="text-red-500 text-sm">✗</span>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    3-20 characters, letters, numbers, and underscores only
                  </p>
                  {username.length >= 3 && (
                    <p className={`text-xs ${
                      checkingUsername 
                        ? 'text-gray-500' 
                        : usernameAvailable === true 
                        ? 'text-green-600' 
                        : usernameAvailable === false 
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      {checkingUsername 
                        ? 'Checking...' 
                        : usernameAvailable === true 
                        ? 'Available!' 
                        : usernameAvailable === false 
                        ? 'Not available'
                        : ''
                      }
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-500"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-500"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onToggle}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {mode === 'login' 
              ? "Don't have an account? Sign up" 
              : 'Already have an account? Sign in'
            }
          </button>
        </div>
      </div>
    </div>
  );
} 