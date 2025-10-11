'use client';

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function PhoneSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  
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
      // Start phone number sign-in
      await signIn.create({
        identifier: phoneNumber,
      });

      // Send OTP code to phone
      if (!signIn.supportedFirstFactors) {
        throw new Error('No authentication methods available');
      }
      
      const phoneCodeFactor = signIn.supportedFirstFactors.find(
        (factor) => factor.strategy === 'phone_code'
      );
      
      if (!phoneCodeFactor || !('phoneNumberId' in phoneCodeFactor)) {
        throw new Error('Phone authentication not available');
      }
      
      await signIn.prepareFirstFactor({
        strategy: 'phone_code',
        phoneNumberId: phoneCodeFactor.phoneNumberId,
      });

      console.log('✅ SMS code sent to:', phoneNumber);
      setStep('code');
    } catch (err) {
      console.error('Error sending code:', err);
      setError(err instanceof Error ? err.message : 'Failed to send code. Please check your phone number.');
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
      const result = await signIn.attemptFirstFactor({
        strategy: 'phone_code',
        code: code.trim(),
      });

      if (result.status === 'complete') {
        // Sign in successful
        await setActive({ session: result.createdSessionId });
        console.log('✅ Signed in successfully');
        router.push('/');
      } else {
        // Handle other statuses if needed
        console.log('Sign-in status:', result.status);
      }
    } catch (err) {
      console.error('Error verifying code:', err);
      setError('Invalid code. Please try again.');
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
        <p className="text-gray-600">Enter your phone number to continue</p>
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
            {loading ? 'Sending...' : 'Send Code'}
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
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleChangeNumber}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Change phone number
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

