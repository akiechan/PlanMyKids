'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface PlannerSubscription {
  plan: 'free' | 'pro';
  status: string;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string | null;
  price: number;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  features: string[];
}

const PLANS = {
  free: {
    name: 'Basic',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Save up to 5 programs',
      '1 child profile',
      '1 parent profile',
      'Basic calendar view',
    ],
  },
  pro: {
    name: 'Family Pro',
    monthlyPrice: 8.5,
    yearlyPrice: 65,
    features: [
      'Unlimited saved programs',
      'Unlimited child profiles',
      'Email reminders before registration',
      'Sync to Google/Apple Calendar',
      'Family sharing (2 accounts)',
      'Priority support',
    ],
  },
};

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<PlannerSubscription | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/familyplanning/billing');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'true') {
        setSuccessMessage('Subscription activated! Welcome to Family Pro.');
        window.history.replaceState({}, '', '/familyplanning/billing');
      }
    }
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/user/subscriptions');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch subscription');
      }

      setSubscription(result.familyPlanner);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (cycle: 'monthly' | 'yearly') => {
    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/stripe/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscribe', cycle }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create checkout');
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
      setProcessing(false);
    }
  };

  const handleSwitchCycle = async (cycle: 'monthly' | 'yearly') => {
    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/stripe/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', cycle }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to switch plan');
      }

      setSuccessMessage(`Switched to ${cycle} billing!`);
      await fetchSubscription();
    } catch (err) {
      console.error('Switch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch plan');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/stripe/planner', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      setShowCancelModal(false);
      setSuccessMessage('Subscription will be cancelled at the end of the billing period.');
      await fetchSubscription();
    } catch (err) {
      console.error('Cancel error:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/stripe/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reactivate');
      }

      setSuccessMessage('Subscription reactivated!');
      await fetchSubscription();
    } catch (err) {
      console.error('Reactivate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to reactivate');
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isFreePlan = !subscription || subscription.plan === 'free';
  const isProMonthly = subscription?.plan === 'pro' && subscription.billingCycle === 'monthly';
  const isProYearly = subscription?.plan === 'pro' && subscription.billingCycle === 'yearly';
  const isCancelling = subscription?.cancelAtPeriodEnd === true;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/familyplanning/dashboard"
            className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 text-sm mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Family Planner — Plans & Billing</h1>
          <p className="text-gray-600 mt-1">Choose the plan that works best for your family</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
            <button onClick={() => setSuccessMessage('')} className="text-green-500 hover:text-green-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Current Plan Status */}
        {!isFreePlan && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    Family Pro — {subscription?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isCancelling
                      ? `Access until ${subscription?.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'end of period'}`
                      : `${subscription?.billingCycle === 'yearly' ? '$65/year' : '$8.50/month'} · Renews ${subscription?.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'soon'}`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  isCancelling ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                }`}>
                  {isCancelling ? 'Cancelling' : 'Active'}
                </span>
                {isCancelling ? (
                  <button
                    onClick={handleReactivate}
                    disabled={processing}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Reactivate'}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-3 py-1.5 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Free Plan */}
          <div className={`bg-white rounded-xl shadow-sm border-2 p-6 relative ${
            isFreePlan ? 'border-primary-500' : 'border-gray-200'
          }`}>
            {isFreePlan && (
              <div className="absolute -top-3 left-4">
                <span className="bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Current Plan
                </span>
              </div>
            )}
            <h3 className="text-lg font-bold text-gray-900 mt-1">Basic</h3>
            <div className="mt-3 mb-5">
              <span className="text-3xl font-bold text-gray-900">$0</span>
              <span className="text-gray-500 text-sm ml-1">forever</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {PLANS.free.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {isFreePlan && (
              <p className="text-center text-xs text-gray-400 mt-2">You&apos;re on this plan</p>
            )}
          </div>

          {/* Pro Monthly */}
          <div className={`bg-white rounded-xl shadow-sm border-2 p-6 relative ${
            isProMonthly ? 'border-primary-500' : 'border-gray-200'
          }`}>
            {isProMonthly && (
              <div className="absolute -top-3 left-4">
                <span className="bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Current Plan
                </span>
              </div>
            )}
            <h3 className="text-lg font-bold text-gray-900 mt-1">Family Pro</h3>
            <p className="text-xs text-gray-500">Monthly billing</p>
            <div className="mt-3 mb-5">
              <span className="text-3xl font-bold text-gray-900">$8.50</span>
              <span className="text-gray-500 text-sm ml-1">/month</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {PLANS.pro.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {isFreePlan && (
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={processing}
                className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Redirecting...' : 'Get Monthly'}
              </button>
            )}
            {isProYearly && !isCancelling && (
              <button
                onClick={() => handleSwitchCycle('monthly')}
                disabled={processing}
                className="w-full py-2.5 border border-primary-300 text-primary-700 text-sm font-medium rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Switch to Monthly'}
              </button>
            )}
            {isProMonthly && !isCancelling && (
              <p className="text-center text-xs text-gray-400 mt-2">You&apos;re on this plan</p>
            )}
          </div>

          {/* Pro Yearly — Recommended */}
          <div className={`bg-white rounded-xl shadow-md border-2 p-6 relative ${
            isProYearly ? 'border-primary-500' : 'border-amber-300 ring-1 ring-amber-200'
          }`}>
            <div className="absolute -top-3 left-4 flex items-center gap-2">
              {isProYearly ? (
                <span className="bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Current Plan
                </span>
              ) : (
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Recommended
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-1">Family Pro</h3>
            <p className="text-xs text-gray-500">Yearly billing</p>
            <div className="mt-3 mb-1">
              <span className="text-3xl font-bold text-gray-900">$65</span>
              <span className="text-gray-500 text-sm ml-1">/year</span>
            </div>
            <p className="text-xs text-green-600 font-medium mb-5">
              $5.42/mo — Save ${(8.5 * 12 - 65).toFixed(0)}/year vs monthly
            </p>
            <ul className="space-y-2.5 mb-6">
              {PLANS.pro.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            {isFreePlan && (
              <button
                onClick={() => handleSubscribe('yearly')}
                disabled={processing}
                className="w-full py-2.5 bg-gradient-to-r from-primary-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-primary-600 hover:to-blue-600 transition-all shadow-sm disabled:opacity-50"
              >
                {processing ? 'Redirecting...' : 'Get Yearly'}
              </button>
            )}
            {isProMonthly && !isCancelling && (
              <button
                onClick={() => handleSwitchCycle('yearly')}
                disabled={processing}
                className="w-full py-2.5 bg-gradient-to-r from-primary-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-primary-600 hover:to-blue-600 transition-all shadow-sm disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Switch to Yearly'}
              </button>
            )}
            {isProYearly && !isCancelling && (
              <p className="text-center text-xs text-gray-400 mt-2">You&apos;re on this plan</p>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-gray-900">Can I switch between monthly and yearly?</p>
              <p className="text-gray-600 mt-1">Yes! You can switch anytime. If upgrading to yearly, you&apos;ll be credited for the remaining time on your monthly plan.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">What happens if I cancel?</p>
              <p className="text-gray-600 mt-1">You&apos;ll keep access until the end of your current billing period. After that, you&apos;ll be moved to the free Basic plan.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Can I get a refund?</p>
              <p className="text-gray-600 mt-1">We offer a full refund within the first 7 days of any new subscription. Contact support@planmykids.com.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Subscription?</h3>
            <p className="text-gray-600 mb-4">
              You&apos;ll continue to have access until your current billing period ends, then switch to the Basic plan.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-yellow-800 mb-2">You&apos;ll lose access to:</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {PLANS.pro.features.slice(0, 4).map((feature, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={processing}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
