'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

function FeaturedLoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [usePasswordLogin, setUsePasswordLogin] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signInWithMagicLink, signInWithGoogle, user, loading } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setError('Authentication failed. The link may have expired. Please try again.');
    }
  }, [searchParams]);

  // Don't auto-redirect - let user confirm their email first

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowConfirmation(true);
  };

  const handleConfirmSend = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Use the Edge Function API to send magic link via Resend
      const redirectUrl = `${window.location.origin}/auth/callback?next=/featured/setup`;
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: redirectUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send magic link');
        setShowConfirmation(false);
        return;
      }

      if (data.success) {
        setSuccess(data.message || 'Check your email to get started!');
      } else {
        setSuccess('Check your email to get started!');
      }
    } catch {
      setError('An unexpected error occurred');
      setShowConfirmation(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditEmail = () => {
    setShowConfirmation(false);
    setSuccess(null);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push('/featured/setup');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link
            href="/featured"
            className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block"
          >
            ← Back to Featured Businesses
          </Link>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">
            Feature Your Business
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Get started with your featured listing
          </p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-amber-500 text-xl mr-2">⭐</span>
              <div className="text-sm text-amber-800">
                <p className="font-medium">Get noticed by more families!</p>
                <p className="mt-1">Featured businesses appear at the top of search results with a premium badge.</p>
              </div>
            </div>
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Google Sign In — shown when not logged in and not in confirmation/success flow */}
        {!user && !showConfirmation && !success && !usePasswordLogin && (
          <>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setGoogleLoading(true);
                const { error: googleError } = await signInWithGoogle('/featured/setup');
                if (googleError) {
                  setError(googleError.message);
                  setGoogleLoading(false);
                }
              }}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {googleLoading ? 'Redirecting...' : 'Continue with Google'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-gradient-to-b from-amber-50 to-white text-gray-500">or</span>
              </div>
            </div>
          </>
        )}

        {/* Already logged in - show confirmation */}
        {user ? (
          <div className="mt-8 space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm text-green-600 mb-2">You&apos;re signed in as:</p>
              <p className="text-lg font-semibold text-green-800">{user.email}</p>
            </div>

            <button
              onClick={() => router.push('/featured/setup')}
              className="w-full py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
            >
              Continue to Setup
            </button>

            <div className="text-center">
              <button
                onClick={() => {
                  // Sign out to use a different email
                  import('@/lib/supabase').then(({ supabase }) => {
                    supabase.auth.signOut().then(() => {
                      window.location.reload();
                    });
                  });
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : usePasswordLogin ? (
          /* Password Login (for testing) */
          <form className="mt-8 space-y-6" onSubmit={handlePasswordLogin}>
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setUsePasswordLogin(false)}
                className="text-sm text-amber-600 hover:text-amber-700"
              >
                Use email link instead
              </button>
            </div>
          </form>
        ) : !showConfirmation ? (
          /* Step 1: Enter Email */
          <form className="mt-8 space-y-6" onSubmit={handleEmailSubmit}>
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                We&apos;ll send you a secure link to get started
              </p>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
              >
                Continue with Email
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setUsePasswordLogin(true)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Use password instead (testing)
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Confirm Email */
          <div className="mt-8 space-y-6">
            {success ? (
              <div className="text-center">
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                  <p className="font-medium">Link sent!</p>
                  <p className="text-sm mt-1">Check your inbox at <strong>{email}</strong></p>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Click the link in the email to get started with your featured listing.
                </p>
                <button
                  onClick={handleEditEmail}
                  className="mt-4 text-sm text-amber-600 hover:text-amber-700"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 mb-2">Send link to:</p>
                  <p className="text-lg font-semibold text-gray-900">{email}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleEditEmail}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSend}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Get Started'
                    )}
                  </button>
                </div>

              </>
            )}
          </div>
        )}

        <div className="text-center text-xs text-gray-500">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>

    </div>
  );
}

export default function FeaturedLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      }
    >
      <FeaturedLoginContent />
    </Suspense>
  );
}
