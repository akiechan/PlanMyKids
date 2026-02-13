'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionDetails {
  id: string;
  plan_type: string;
  status: string;
  contact_name: string;
  contact_email: string;
  trial_end: string | null;
  program_id: string | null;
  program_data: {
    name?: string;
  } | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user || !sessionId) {
        setLoading(false);
        return;
      }

      try {
        // Get the most recent subscription for this user
        const { data, error: fetchError } = await supabase
          .from('featured_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError) {
          console.error('Error fetching subscription:', fetchError);
          setError('Could not load subscription details');
        } else {
          setSubscription(data);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchSubscription();
    }
  }, [user, sessionId, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const programName = subscription?.program_data?.name || 'Your Program';
  const isTrialing = subscription?.status === 'trialing' || subscription?.plan_type === 'free_trial';

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isTrialing ? 'Your Free Trial Has Started!' : 'Payment Successful!'}
          </h1>
          <p className="text-gray-600 mb-8">
            {isTrialing
              ? `Your 3-day free trial for "${programName}" is now active.`
              : `"${programName}" is now a featured business!`}
          </p>

          {/* Subscription Details */}
          {subscription && (
            <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
              <h2 className="font-semibold text-gray-900 mb-4">Subscription Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium text-gray-900">
                    {subscription.plan_type === 'free_trial'
                      ? 'Free Trial (3 days)'
                      : subscription.plan_type === 'weekly'
                      ? 'Weekly ($98/week)'
                      : 'Monthly ($298/month)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-medium ${
                    subscription.status === 'trialing' || subscription.status === 'active'
                      ? 'text-green-600'
                      : 'text-yellow-600'
                  }`}>
                    {subscription.status === 'trialing'
                      ? 'Trial Active'
                      : subscription.status === 'active'
                      ? 'Active'
                      : 'Processing'}
                  </span>
                </div>
                {subscription.trial_end && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trial Ends</span>
                    <span className="font-medium text-gray-900">
                      {new Date(subscription.trial_end).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Contact</span>
                  <span className="font-medium text-gray-900">{subscription.contact_email}</span>
                </div>
              </div>
            </div>
          )}

          {/* What's Next */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 text-left">
            <h2 className="font-semibold text-amber-800 mb-3 flex items-center">
              <span className="mr-2">⭐</span> What Happens Next?
            </h2>
            <ul className="space-y-2 text-amber-700 text-sm">
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Your business will appear at the top of search results with a featured badge</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>You&apos;ll receive a confirmation email with more details</span>
              </li>
              {isTrialing && (
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Cancel anytime within 3 days to avoid any charges</span>
                </li>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Browse Programs
            </Link>
            {subscription?.program_id && (
              <Link
                href={`/programs/${subscription.program_id}`}
                className="inline-block bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                View Your Program
              </Link>
            )}
          </div>
        </div>

        {/* Support Note */}
        <p className="mt-8 text-sm text-gray-500">
          Questions? Contact us at{' '}
          <a href="mailto:support@sfhubs.com" className="text-primary-600 hover:underline">
            support@sfhubs.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default function FeaturedSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
