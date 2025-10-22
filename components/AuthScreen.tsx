'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import PhoneSignIn from './PhoneSignIn';
import PhoneSignUp from './PhoneSignUp';
import ProfileCompletion from './ProfileCompletion';
import { getInvitation } from '@/lib/firestore';
import { Invitation } from '@/lib/types';

export default function AuthScreen() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [signupStep, setSignupStep] = useState<'phone' | 'profile'>('phone');
  const [signupPhoneNumber, setSignupPhoneNumber] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  
  // Get invite code and step from URL
  const inviteCode = searchParams.get('i') || searchParams.get('invite');
  const step = searchParams.get('step');

  // Load invitation data if code present
  useEffect(() => {
    const loadInvitation = async () => {
      if (!inviteCode) return;
      
      try {
        const inviteData = await getInvitation(inviteCode);
        setInvitation(inviteData);
        
        // If there's an invitation, default to Sign Up tab
        if (inviteData) {
          setActiveTab('signup');
        }
      } catch (error) {
        console.error('Error loading invitation:', error);
      }
    };
    
    loadInvitation();
  }, [inviteCode]);

  // Handle step parameter from URL
  useEffect(() => {
    
    if (step === 'profile') {
      setActiveTab('signup');
      setSignupStep('profile');
      
      // Try to get the verified phone number from localStorage
      const storedPhoneNumber = localStorage.getItem('verifiedPhoneNumber');
      if (storedPhoneNumber) {
        setSignupPhoneNumber(storedPhoneNumber);
      } else {
        setSignupPhoneNumber('Verified');
      }
    }
  }, [step]);

  const handleSignUpComplete = (userId: string, phone: string) => {
    setSignupPhoneNumber(phone);
    setSignupStep('profile');
  };

  const tabs = [
    { id: 'signin' as const, label: 'Sign In' },
    { id: 'signup' as const, label: 'Sign Up' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Rex Logo/Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Rex</h1>
          <p className="text-gray-600">Share & Save Recommendations</p>
        </div>
        
        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Tabs - Only show for phone/signin step, hide during profile completion */}
          {!(activeTab === 'signup' && signupStep === 'profile') && (
            <div className="flex border-b border-gray-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'signup') {
                      setSignupStep('phone'); // Reset signup to phone step
                    }
                  }}
                  className={`flex-1 px-4 py-3 font-medium text-sm border-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-white bg-blue-600'
                      : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          
          {/* Content */}
          <div className="p-8">
            {/* Invitation Banner */}
            {invitation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900 font-medium">
                  🎉 <strong>{invitation.inviterName}</strong> invited you to join Rex!
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  They said you recommended &quot;{invitation.thingTitle}&quot; - sign up to save & share recs.
                </p>
              </div>
            )}
            
            {activeTab === 'signin' ? (
              <PhoneSignIn />
            ) : signupStep === 'phone' ? (
              <PhoneSignUp 
                onSignUpComplete={handleSignUpComplete}
              />
            ) : (
              <ProfileCompletion 
                phoneNumber={signupPhoneNumber}
                invitationData={invitation ? {
                  inviterName: invitation.inviterName,
                  thingTitle: invitation.thingTitle,
                  recipientName: invitation.recipientName
                } : null}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

