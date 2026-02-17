'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-xl font-semibold text-gray-900">Rex</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/sign-in"
                className="text-gray-700 hover:text-gray-900 px-4 py-2 text-sm font-medium transition-colors"
              >
                Login
              </Link>
              <Link
                href="#waitlist"
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Join waitlist
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-light text-gray-900 mb-6 leading-tight">
            A calm place to remember what you do.
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 font-light leading-relaxed">
            Log books, places, movies, and moments. See patterns. Turn &apos;want to&apos; into &apos;did.&apos;
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link
              href="#waitlist"
              className="bg-gray-900 text-white px-8 py-4 rounded-lg text-base font-medium hover:bg-gray-800 transition-colors"
            >
              Join waitlist
            </Link>
            <Link
              href="#how-it-works"
              className="border border-gray-300 text-gray-900 px-8 py-4 rounded-lg text-base font-medium hover:bg-gray-50 transition-colors"
            >
              Learn more
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            Private by default. No likes. No performative feed.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-16">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-medium text-gray-900 mb-3">Log in seconds</h3>
              <p className="text-gray-600 leading-relaxed">
                Free text, zero friction. Type &quot;saw Dune&quot; or &quot;read Atomic Habits&quot; and Rex captures it instantly.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-medium text-gray-900 mb-3">Rex enriches quietly</h3>
              <p className="text-gray-600 leading-relaxed">
                Places and books auto-match. Confirm only if needed. Your ledger stays accurate without effort.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💡</div>
              <h3 className="text-xl font-medium text-gray-900 mb-3">Learn + act</h3>
              <p className="text-gray-600 leading-relaxed">
                See patterns in what you do. Turn recommendations into action with &quot;Do this&quot; to follow through.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-16">
            Built for real life
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Today</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Quick capture for what you&apos;re doing right now. No forms, no friction.
              </p>
            </div>
            <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ledger</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Your complete history, searchable and organized. See what you&apos;ve done, when, and where.
              </p>
            </div>
            <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Friends</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Thing-first social. See what friends did and recommend. No vanity metrics, just real connections.
              </p>
            </div>
            <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Reflections</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Lightweight, optional notes. Add context when it matters, skip it when it doesn&apos;t.
              </p>
            </div>
            <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Do this</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Intent-based action. Turn recommendations into bookings, purchases, or plans—when you&apos;re ready.
              </p>
            </div>
            <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Patterns</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Meaningful insights emerge naturally. Understand yourself better through what you actually do.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Trust */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-12">
            Privacy by design
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Private by default</h3>
              <p className="text-gray-600 leading-relaxed">
                Your ledger is yours alone. Share only what you choose, with only who you choose.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">You control visibility</h3>
              <p className="text-gray-600 leading-relaxed">
                Every item has privacy settings. Friends see what you want them to see, nothing more.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">No selling personal data</h3>
              <p className="text-gray-600 leading-relaxed">
                We don&apos;t sell your data. Ever. Revenue comes from helping you act on intent, not from ads or data sales.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Export anytime</h3>
              <p className="text-gray-600 leading-relaxed">
                Your data is yours. Export everything in standard formats whenever you want.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-12">
            Preview feedback
          </h2>
          <div className="space-y-8">
            <div className="border-l-4 border-gray-300 pl-6">
              <p className="text-gray-700 italic mb-2">
                &quot;Finally, a way to remember what I actually do without it feeling like work. The auto-matching is magic.&quot;
              </p>
              <p className="text-sm text-gray-500">— Early tester, NYC</p>
            </div>
            <div className="border-l-4 border-gray-300 pl-6">
              <p className="text-gray-700 italic mb-2">
                &quot;I love that it&apos;s not performative. My friends see what I did, not what I&apos;m trying to be. It&apos;s refreshing.&quot;
              </p>
              <p className="text-sm text-gray-500">— Early tester, Boston</p>
            </div>
            <div className="border-l-4 border-gray-300 pl-6">
              <p className="text-gray-700 italic mb-2">
                &quot;The &apos;Do this&apos; feature actually got me to book that restaurant my friend recommended months ago. That&apos;s the point.&quot;
              </p>
              <p className="text-sm text-gray-500">— Early tester, SF</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Is this another social network?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                No. Rex is a life ledger first, social second. You log what you do for yourself. Sharing with friends is optional and thing-focused—no feeds, no likes, no performative posts.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Do I need to write reviews?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                No. Logging is free text—&quot;saw Dune&quot; or &quot;read Atomic Habits&quot; is enough. Add notes only if you want. Rex handles the rest.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                How does Rex make money?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Intent-based commerce. When you&apos;re ready to act on a recommendation—book a restaurant, buy a book, see a movie—Rex connects you with partners. We don&apos;t sell your data or show ads.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                When will the app launch?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                We&apos;re in private beta. Join the waitlist to get early access when we&apos;re ready.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Will it integrate with Strava/Netflix/etc.?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Possibly in the future. For now, Rex focuses on manual logging with smart enrichment. We believe intentional capture beats passive tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="waitlist" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
            Join the waitlist
          </h2>
          <p className="text-gray-600 mb-8 text-lg">
            Be among the first to experience Rex when we launch.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-600 text-sm">
              © {new Date().getFullYear()} Rex. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="text-gray-600 hover:text-gray-900 transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      setStatus('error');
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong');
      }

      setStatus('success');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <p className="text-green-800 font-medium">Thanks! We&apos;ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          placeholder="Enter your email"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder-gray-500"
          aria-label="Email address"
          aria-invalid={status === 'error'}
          aria-describedby={status === 'error' ? 'email-error' : undefined}
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Joining...' : 'Join waitlist'}
        </button>
      </div>
      {status === 'error' && (
        <p id="email-error" className="mt-2 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
