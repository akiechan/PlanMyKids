'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const SESSION_STORAGE_KEY = 'planmykids-add-program';

export default function FeaturedPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [prefilledFromSession, setPrefilledFromSession] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);
  const [sessionFormData, setSessionFormData] = useState<{
    name?: string;
    description?: string;
    category?: string[];
    neighborhood?: string;
    address?: string;
    age_min?: number;
    age_max?: number;
    provider_name?: string;
    provider_website?: string;
    price_min?: number | null;
    price_max?: number | null;
    price_unit?: string;
  } | null>(null);

  // Load program data from localStorage if coming from add-provider
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData?.name) {
          setPrefilledFromSession(true);
          setSessionFormData(parsed.formData);
        }
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }, []);

  // Check if user has already used their free trial or has any subscription
  useEffect(() => {
    const checkFreeTrial = async () => {
      if (!user) {
        setHasUsedFreeTrial(false);
        return;
      }

      try {
        // Check for any existing subscriptions (free trial or paid)
        const { data: allSubscriptions } = await supabase
          .from('featured_subscriptions')
          .select('id, plan_type')
          .eq('user_id', user.id)
          .limit(5);

        if (allSubscriptions && allSubscriptions.length > 0) {
          // User has used free trial OR has any subscription - hide free trial option
          setHasUsedFreeTrial(true);
        }
      } catch (err) {
        console.error('Error checking free trial status:', err);
      }
    };

    checkFreeTrial();
  }, [user]);

  const handleGetStarted = () => {
    if (authLoading) return;
    // Always go to login page to confirm email before proceeding
    router.push('/featured/login');
  };

  return (
    <div className="bg-gradient-to-b from-amber-50 to-white min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <span className="text-lg">⭐</span> Featured Businesses
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Get Your Business Noticed
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Featured businesses appear at the top of search results and stand out with premium styling.
            Reach more families looking for quality enrichment programs.
          </p>
        </div>

        {/* Back button when coming from add-provider */}
        {prefilledFromSession && sessionFormData && (
          <div className="max-w-5xl mx-auto mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
              <p className="text-green-800 flex items-center gap-2">
                <span className="text-xl">✓</span>
                <span>
                  <strong>{sessionFormData.name}</strong> is ready to feature. Select a plan below to continue.
                </span>
              </p>
              <Link
                href="/add-provider"
                className="text-sm text-green-700 hover:text-green-800 flex items-center gap-1 font-medium"
              >
                <span>←</span> Edit Program
              </Link>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className={`grid gap-6 ${hasUsedFreeTrial ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'}`}>
            {/* Free Trial Plan - only show if user hasn't used it */}
            {!hasUsedFreeTrial && (
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-amber-500 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  START HERE
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Free Trial</h3>
                <p className="text-gray-600 mb-4">Try it free for 3 days</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-600">/3 days</span>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="text-amber-500">✓</span> Top placement in search results
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="text-amber-500">✓</span> Gold featured badge
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="text-amber-500">✓</span> Premium card styling
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <span className="text-amber-500">✓</span> Cancel within 3 days - no charge
                  </li>
                </ul>
                <button
                  onClick={handleGetStarted}
                  disabled={authLoading}
                  className="w-full py-3 rounded-lg font-medium transition-colors bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                >
                  {authLoading ? 'Loading...' : 'Start Free Trial'}
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Credit card required. Then $98/week.
                </p>
              </div>
            )}

            {/* Weekly Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 ${hasUsedFreeTrial ? 'border-amber-500' : 'border-gray-200'} ${hasUsedFreeTrial ? 'relative' : ''}`}>
              {hasUsedFreeTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  RECOMMENDED
                </div>
              )}
              <h3 className="text-xl font-bold text-gray-900 mb-2">Weekly</h3>
              <p className="text-gray-600 mb-4">Auto-renews weekly, cancel anytime</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$98</span>
                <span className="text-gray-600">/week</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Top placement in search results
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Gold featured badge
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Premium card styling
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Cancel anytime
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                disabled={authLoading}
                className={`w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${hasUsedFreeTrial ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {authLoading ? 'Loading...' : 'Get Started'}
              </button>
            </div>

            {/* Monthly Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 relative ${hasUsedFreeTrial ? 'border-amber-500' : 'border-gray-200'}`}>
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full ${hasUsedFreeTrial ? 'bg-green-600' : 'bg-green-500'}`}>
                BEST VALUE
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Monthly</h3>
              <p className="text-gray-600 mb-4">Auto-renews monthly, cancel anytime</p>
              <div className="mb-2">
                <span className="text-5xl font-bold text-gray-900">$298</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-sm text-green-600 font-medium mb-2">Save $94 vs weekly</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Top placement in search results
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Gold featured badge
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Premium card styling
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Priority support
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="text-amber-500">✓</span> Analytics dashboard (coming soon)
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                disabled={authLoading}
                className={`w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${hasUsedFreeTrial ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {authLoading ? 'Loading...' : 'Get Started'}
              </button>
            </div>
          </div>
        </div>

        {/* Example Mockups Section */}
        <div className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            How Featured Businesses Look
          </h2>

          {/* Homepage Example */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm">Homepage</span>
              Featured businesses appear first
            </h3>
            <div className="bg-gray-100 rounded-2xl p-6 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Featured Card Mockup */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden ring-2 ring-amber-400 relative">
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                    <span>⭐</span> Featured
                  </div>
                  <div className="h-32 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <span className="text-4xl">🏊</span>
                  </div>
                  <div className="p-4 border-t-4 border-amber-400">
                    <div className="flex gap-1 mb-2">
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">swimming</span>
                    </div>
                    <h4 className="font-bold text-gray-900">Your Swimming Academy</h4>
                    <p className="text-sm text-gray-600">Premium Swim School</p>
                    <div className="flex items-center gap-1 mt-2 text-sm">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-medium">4.9</span>
                      <span className="text-gray-500">(120 reviews)</span>
                    </div>
                  </div>
                </div>

                {/* Regular Card Mockup */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden opacity-60">
                  <div className="h-32 bg-gray-200 flex items-center justify-center">
                    <span className="text-4xl">🎨</span>
                  </div>
                  <div className="p-4">
                    <div className="flex gap-1 mb-2">
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">art</span>
                    </div>
                    <h4 className="font-bold text-gray-900">Art Studio</h4>
                    <p className="text-sm text-gray-600">Creative Learning</p>
                  </div>
                </div>

                {/* Regular Card Mockup */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden opacity-60">
                  <div className="h-32 bg-gray-200 flex items-center justify-center">
                    <span className="text-4xl">⚽</span>
                  </div>
                  <div className="p-4">
                    <div className="flex gap-1 mb-2">
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">soccer</span>
                    </div>
                    <h4 className="font-bold text-gray-900">Soccer Club</h4>
                    <p className="text-sm text-gray-600">Youth Sports</p>
                  </div>
                </div>
              </div>
              <p className="text-center text-gray-500 text-sm mt-4">
                Featured businesses always appear at the top, even with high ratings from competitors
              </p>
            </div>
          </div>

          {/* Detail Page Example */}
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm">Detail Page</span>
              Premium styling and badge
            </h3>
            <div className="bg-gray-100 rounded-2xl p-6 overflow-hidden">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-2xl mx-auto">
                {/* Featured Banner */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <span className="font-semibold">Featured Business</span>
                  </div>
                  <span className="text-sm opacity-90">Premium Partner</span>
                </div>
                <div className="p-6">
                  <div className="flex gap-2 mb-3">
                    <span className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full">swimming</span>
                    <span className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full">sports</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Swimming Academy</h2>
                  <p className="text-gray-600 mb-4">Premium Swim School</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500 text-lg">⭐</span>
                      <span className="font-bold text-lg">4.9</span>
                      <span className="text-gray-500">(120 reviews)</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-600">Marina District</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-gray-500 text-sm mt-4">
                Featured businesses get a prominent banner and gold accent styling
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Cards (Repeated) */}
        <div className="max-w-5xl mx-auto mb-16 mt-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Ready to Get Started?
          </h2>
          <div className={`grid gap-6 ${hasUsedFreeTrial ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'}`}>
            {/* Free Trial Plan - only show if user hasn't used it */}
            {!hasUsedFreeTrial && (
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-amber-500 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  START HERE
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Free Trial</h3>
                <p className="text-gray-600 mb-4">Try it free for 3 days</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-600">/3 days</span>
                </div>
                <button
                  onClick={handleGetStarted}
                  disabled={authLoading}
                  className="w-full py-3 rounded-lg font-medium transition-colors bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                >
                  {authLoading ? 'Loading...' : 'Start Free Trial'}
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Credit card required. Then $98/week.
                </p>
              </div>
            )}

            {/* Weekly Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 ${hasUsedFreeTrial ? 'border-amber-500 relative' : 'border-gray-200'}`}>
              {hasUsedFreeTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  RECOMMENDED
                </div>
              )}
              <h3 className="text-xl font-bold text-gray-900 mb-2">Weekly</h3>
              <p className="text-gray-600 mb-4">Auto-renews weekly</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$98</span>
                <span className="text-gray-600">/week</span>
              </div>
              <button
                onClick={handleGetStarted}
                disabled={authLoading}
                className={`w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${hasUsedFreeTrial ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {authLoading ? 'Loading...' : 'Get Started'}
              </button>
            </div>

            {/* Monthly Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 relative ${hasUsedFreeTrial ? 'border-amber-500' : 'border-gray-200'}`}>
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full ${hasUsedFreeTrial ? 'bg-green-600' : 'bg-green-500'}`}>
                BEST VALUE
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Monthly</h3>
              <p className="text-gray-600 mb-4">Save $94 vs weekly</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$298</span>
                <span className="text-gray-600">/month</span>
              </div>
              <button
                onClick={handleGetStarted}
                disabled={authLoading}
                className={`w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${hasUsedFreeTrial ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {authLoading ? 'Loading...' : 'Get Started'}
              </button>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {[
              {
                question: 'Where will my business appear?',
                answer: "Featured businesses appear at the very top of the homepage and search results, before all other programs. The only time they may not appear first is when a user filters by specific categories or ages that don't match your business."
              },
              ...(!hasUsedFreeTrial ? [{
                question: 'How does the free trial work?',
                answer: "The 3-day free trial gives you full access to all featured business benefits. Your credit card is saved but not charged during the trial. If you cancel within 3 days, you won't be charged. After the trial ends, your subscription automatically continues at $98/week unless you cancel."
              }] : []),
              {
                question: 'Can I cancel anytime?',
                answer: 'Yes! Both weekly and monthly plans auto-renew but you can cancel at any time. There are no long-term commitments or cancellation fees.'
              },
              {
                question: 'What happens if I cancel?',
                answer: "Your program will remain featured for the full period you paid for. If you cancel on the first day of your weekly or monthly subscription, your program stays featured for that entire week or month. You simply won't be charged again when the next billing period would have started."
              },
              {
                question: 'How do I update my business information?',
                answer: 'You can update your business details anytime by clicking "Suggest Edit" on your business\'s detail page. Featured businesses get priority review for edits.'
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedFaq === index ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
