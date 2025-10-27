'use client';

import { useState, useEffect } from 'react';
import { useSignUp } from '@clerk/nextjs';
import { checkUsernameAvailability } from '@/lib/firestore';

interface ProfileCompletionProps {
  phoneNumber: string;
  invitationData?: {
    inviterName: string;
    thingTitle: string;
    recipientName?: string;
  } | null;
}

export default function ProfileCompletion({ phoneNumber, invitationData }: ProfileCompletionProps) {
  const { isLoaded } = useSignUp();
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Pre-fill name and generate username from invitation data
  useEffect(() => {
    if (invitationData) {
      console.log('🔍 ProfileCompletion invitationData:', invitationData);
      
      // Pre-fill the name with the recipient's name (if available)
      if (invitationData.recipientName) {
        console.log('✅ Pre-filling name with recipientName:', invitationData.recipientName);
        setName(invitationData.recipientName);
        
        // Generate a username from the recipient's name
        const firstName = invitationData.recipientName.split(' ')[0].toLowerCase();
        const randomSuffix = Math.floor(Math.random() * 10000);
        const generatedUsername = `${firstName.replace(/[^a-z0-9]/g, '')}${randomSuffix}`;
        console.log('✅ Generated username from recipient name:', generatedUsername);
        setUsername(generatedUsername);
      } else {
        console.log('❌ No recipientName found in invitationData');
        // Fallback to inviter's name if recipient name not available
        const firstName = invitationData.inviterName.split(' ')[0].toLowerCase();
        const randomSuffix = Math.floor(Math.random() * 10000);
        const generatedUsername = `${firstName.replace(/[^a-z0-9]/g, '')}${randomSuffix}`;
        console.log('⚠️ Using inviter name as fallback for username:', generatedUsername);
        setUsername(generatedUsername);
      }
    }
  }, [invitationData]);

  // Check username availability as user types
  useEffect(() => {
    if (username.length >= 3) {
      const checkUsername = async () => {
        setCheckingUsername(true);
        try {
          const available = await checkUsernameAvailability(username.toLowerCase());
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
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (usernameAvailable === false) {
      setError('Username is already taken');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Store profile data and redirect
      const profileData = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
      };
      
      localStorage.setItem('pendingProfileData', JSON.stringify(profileData));
      
      // Clean up phone number from localStorage
      localStorage.removeItem('verifiedPhoneNumber');
      
      // Add a small delay to show the success message
      setTimeout(() => {
        // Redirect to root - ClerkAuthProvider will handle Firestore user creation
        // Use replaceState to avoid back button issues
        window.history.replaceState({}, '', '/');
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      console.error('Error completing sign-up:', err);
      setError('Failed to complete sign-up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Profile</h2>
        <p className="text-sm text-gray-500 mt-1">Phone: {phoneNumber} ✓</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
            Username <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="john_doe"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              pattern="^[a-z0-9_]*$"
              maxLength={20}
              disabled={loading}
            />
            {checkingUsername && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {!checkingUsername && username.length >= 3 && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {usernameAvailable ? (
                  <span className="text-green-600 text-xl">✓</span>
                ) : (
                  <span className="text-red-600 text-xl">✗</span>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Letters, numbers, and underscores only
            {!checkingUsername && username.length >= 3 && (
              <span className={usernameAvailable ? 'text-green-600' : 'text-red-600'}>
                {' - '}{usernameAvailable ? 'Available!' : 'Already taken'}
              </span>
            )}
          </p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim() || !username.trim() || !email.trim() || usernameAvailable === false}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Setting up your account...' : 'Complete Sign Up'}
        </button>
      </form>
    </div>
  );
}

