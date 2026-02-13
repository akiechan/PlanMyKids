'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

function PremiumContent() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithMagicLink, user, loading } = useAuth();

  const returnUrl = searchParams.get('return') || '/';
  const action = searchParams.get('action');

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setError('Authentication failed. The link may have expired. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    // Redirect if already logged in - use return URL if provided
    if (!loading && user) {
      router.push(returnUrl || '/familyplanning/dashboard');
    }
  }, [user, loading, router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Use return URL if provided, otherwise default to dashboard
      const redirectTo = returnUrl || '/familyplanning/dashboard';
      const { error: signInError } = await signInWithMagicLink(email, redirectTo);
      if (signInError) {
        setError(signInError.message);
      } else {
        setSuccess('Check your email for a login link!');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link
            href={returnUrl}
            className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go back
          </Link>

          <div className="text-center mt-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👨‍👩‍👧‍👦</span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">
              Family Planner
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to save programs and organize your family's activities
            </p>
          </div>
        </div>

        {action === 'save' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm text-center">
            <span className="font-medium">Want to save this comparison?</span>
            <br />
            Sign in to access your Family Planner!
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                <p className="font-medium">Check your email!</p>
                <p className="text-sm mt-1">We sent a login link to <strong>{email}</strong></p>
              </div>
            )}

            {!success && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    We'll send you a secure link to sign in
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Login Link'
                  )}
                </button>
              </>
            )}
          </form>
        </div>

        {/* Basic Plan */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🆓</span>
            <h3 className="font-medium text-gray-800">Basic Plan</h3>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Free</span>
          </div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Save up to 5 programs
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> 1 child profile
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> 1 parent profile
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Basic calendar view
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Compare programs side-by-side
            </li>
          </ul>
        </div>

        {/* Family Pro Plan */}
        <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl p-4 border border-primary-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⭐</span>
            <h3 className="font-medium text-primary-800">Family Pro</h3>
          </div>
          <p className="text-sm text-primary-700 mb-3">
            Upgrade anytime for unlimited features:
          </p>
          <ul className="text-sm text-primary-700 space-y-2 mb-4">
            <li className="flex items-start gap-2">
              <span>💾</span>
              <span>Unlimited saved programs</span>
            </li>
            <li className="flex items-start gap-2">
              <span>👨‍👩‍👧‍👦</span>
              <span>Unlimited child profiles</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📅</span>
              <span>Email reminders before registration</span>
            </li>
            <li className="flex items-start gap-2">
              <span>🗓️</span>
              <span>Sync to Google/Apple Calendar</span>
            </li>
            <li className="flex items-start gap-2">
              <span>👥</span>
              <span>Family sharing (2 accounts)</span>
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/60 rounded-lg p-3 text-center">
              <p className="text-xs text-primary-600 font-medium">MONTHLY</p>
              <p className="text-lg font-bold text-primary-900">$8.50</p>
              <p className="text-xs text-primary-600">per month</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3 text-center border-2 border-primary-400">
              <p className="text-xs text-primary-600 font-medium">YEARLY</p>
              <p className="text-lg font-bold text-primary-900">$60</p>
              <p className="text-xs text-primary-600">Save 41%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      }
    >
      <PremiumContent />
    </Suspense>
  );
}
