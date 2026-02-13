'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for error in URL params
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          setError(errorDescription || errorParam);
          return;
        }

        // Helper function to sync session to server cookies
        const syncSessionToCookies = async (session: { access_token: string; refresh_token: string }) => {
          try {
            await fetch('/api/auth/set-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              }),
            });
          } catch (err) {
            console.error('Failed to sync session to cookies:', err);
          }
        };

        // Get the session - Supabase client automatically handles the tokens from URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
          return;
        }

        if (session) {
          // Sync session to server cookies before redirecting
          await syncSessionToCookies(session);
          const next = searchParams.get('next') || '/';
          router.push(next);
        } else {
          // No session yet, try to exchange code if present
          const code = searchParams.get('code');
          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.error('Code exchange error:', exchangeError);
              setError(exchangeError.message);
              return;
            }
            if (data.session) {
              await syncSessionToCookies(data.session);
            }
            const next = searchParams.get('next') || '/';
            router.push(next);
          } else {
            // No code and no session - this might be a hash-based redirect
            // Wait a moment for Supabase to process the hash
            setTimeout(async () => {
              const { data: { session: delayedSession } } = await supabase.auth.getSession();
              if (delayedSession) {
                await syncSessionToCookies(delayedSession);
                const next = searchParams.get('next') || '/';
                router.push(next);
              } else {
                setError('Authentication failed. Please try again.');
              }
            }, 1000);
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An unexpected error occurred');
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
          <button
            onClick={() => router.push('/admin/login')}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Completing sign in...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
