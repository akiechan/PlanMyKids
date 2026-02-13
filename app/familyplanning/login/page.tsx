'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

function FamilyPlanningLoginContent() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithMagicLink, signInWithGoogle, user, loading } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setError('Authentication failed. The link may have expired. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    // Redirect if already logged in
    if (!loading && user) {
      router.push('/familyplanning/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signInWithMagicLink(email, '/familyplanning/dashboard');
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>

          <div className="text-center mt-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
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

        <div className="bg-white rounded-xl shadow-md p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {!success && (
            <>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setGoogleLoading(true);
                  const { error: googleError } = await signInWithGoogle('/familyplanning/dashboard');
                  if (googleError) {
                    setError(googleError.message);
                    setGoogleLoading(false);
                  }
                }}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {googleLoading ? 'Redirecting...' : 'Continue with Google'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-500">or sign in with email</span>
                </div>
              </div>
            </>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {success && (
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-4xl">📧</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Check your inbox!</h3>
                <p className="text-gray-600 mb-4">
                  We sent a magic link to<br/>
                  <strong className="text-green-600">{email}</strong>
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                  <p className="text-sm text-green-800 font-medium mb-2">What to do next:</p>
                  <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
                    <li>Open your email inbox</li>
                    <li>Look for an email from PlanMyKids</li>
                    <li>Click the login link inside</li>
                  </ol>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Didn&apos;t get it? Check your spam folder or{' '}
                  <button
                    onClick={() => setSuccess(null)}
                    className="text-green-600 hover:text-green-700 underline"
                  >
                    try again
                  </button>
                </p>
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
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                  className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

        {/* Free Features */}
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🆓</span>
            <h3 className="font-medium text-green-800">Free Features</h3>
          </div>
          <ul className="text-sm text-green-700 space-y-1">
            <li className="flex items-center gap-2">
              <span>✓</span> Save programs you're interested in
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Track enrollment dates and deadlines
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Assign activities to each child
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Compare programs side-by-side
            </li>
          </ul>
        </div>

        {/* Premium Plans */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⭐</span>
            <h3 className="font-medium text-amber-800">Premium</h3>
            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Coming Soon</span>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            Supercharge your search for the perfect programs:
          </p>
          <ul className="text-sm text-amber-700 space-y-2 mb-4">
            <li className="flex items-start gap-2">
              <span>💾</span>
              <span>Save comparisons & access anytime</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📅</span>
              <span>Registration alerts & deadline reminders</span>
            </li>
            <li className="flex items-start gap-2">
              <span>👨‍👩‍👧‍👦</span>
              <span>Manage programs for all your children</span>
            </li>
            <li className="flex items-start gap-2">
              <span>💰</span>
              <span>Track costs across all programs</span>
            </li>
            <li className="flex items-start gap-2">
              <span>🗓️</span>
              <span>Calendar integration</span>
            </li>
            <li className="flex items-start gap-2">
              <span>🔔</span>
              <span>Priority notifications for new programs</span>
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/60 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-600 font-medium">MONTHLY</p>
              <p className="text-lg font-bold text-amber-900">$8.50</p>
              <p className="text-xs text-amber-600">per month</p>
            </div>
            <div className="bg-white/60 rounded-lg p-3 text-center border-2 border-amber-400">
              <p className="text-xs text-amber-600 font-medium">YEARLY</p>
              <p className="text-lg font-bold text-amber-900">$60</p>
              <p className="text-xs text-amber-600">Save 41%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FamilyPlanningLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <FamilyPlanningLoginContent />
    </Suspense>
  );
}
