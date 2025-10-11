'use client';

import { useState } from 'react';
import PhoneSignIn from './PhoneSignIn';
import PhoneSignUp from './PhoneSignUp';
import ProfileCompletion from './ProfileCompletion';

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [signupStep, setSignupStep] = useState<'phone' | 'profile'>('phone');
  const [signupPhoneNumber, setSignupPhoneNumber] = useState('');

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
                  className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          
          {/* Content */}
          <div className="p-8">
            {activeTab === 'signin' ? (
              <PhoneSignIn />
            ) : signupStep === 'phone' ? (
              <PhoneSignUp 
                onSignUpComplete={handleSignUpComplete}
              />
            ) : (
              <ProfileCompletion 
                phoneNumber={signupPhoneNumber}
                onBack={() => {
                  setSignupStep('phone');
                  setActiveTab('signup');
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

