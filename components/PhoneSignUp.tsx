'use client';

import { useState } from 'react';
import { useSignUp } from '@clerk/nextjs';

interface PhoneSignUpProps {
  onSignUpComplete: (userId: string, phoneNumber: string) => void;
}

export default function PhoneSignUp({ onSignUpComplete }: PhoneSignUpProps) {
  const { isLoaded, signUp } = useSignUp();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !phoneNumber.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Create sign-up with phone number
      await signUp.create({
        phoneNumber: phoneNumber.trim(),
      });

      // Send verification code
      await signUp.preparePhoneNumberVerification({
        strategy: 'phone_code',
      });

      console.log('✅ SMS code sent to:', phoneNumber);
      setStep('code');
    } catch (err) {
      console.error('Error sending code:', err);
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || 'Failed to send code. Please check your phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !code.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Verify the OTP code
      const result = await signUp.attemptPhoneNumberVerification({
        code: code.trim(),
      });

      if (result.status === 'complete') {
        // Phone verified! Now we need to collect profile info
        const userId = result.createdUserId;
        console.log('✅ Phone verified! User ID:', userId);
        
        // Call parent to show profile completion step
        onSignUpComplete(userId!, phoneNumber);
      } else {
        console.log('Sign-up status:', result.status);
        setError('Verification incomplete. Please try again.');
      }
    } catch (err) {
      console.error('Error verifying code:', err);
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || 'Invalid code. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setStep('phone');
    setCode('');
    setError('');
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
        <p className="text-gray-600">
          {step === 'phone' 
            ? 'Enter your phone number to get started' 
            : 'Enter the verification code we sent you'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 555-5555"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !phoneNumber.trim()}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center tracking-widest"
              maxLength={6}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              Enter the 6-digit code sent to {phoneNumber}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              Resend code
            </button>
            <div>
              <button
                type="button"
                onClick={handleChangeNumber}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Change phone number
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

