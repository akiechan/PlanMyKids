'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface FeaturedSubscription {
  id: string;
  program_id: string | null;
  program_name: string;
  plan_type: 'free_trial' | 'weekly' | 'monthly';
  status: 'pending' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  contact_email: string;
  created_at: string;
}

interface FamilyPlannerStatus {
  plan: 'free' | 'basic' | 'pro';
  status: string;
  billingCycle?: 'monthly' | 'yearly';
  nextBillingDate?: string | null;
  price?: number;
  cancelAtPeriodEnd?: boolean;
  stripeSubscriptionId?: string | null;
  features: string[];
}

interface SubscriptionData {
  featuredSubscriptions: FeaturedSubscription[];
  familyPlanner: FamilyPlannerStatus;
  email: string;
}

interface DowngradeItem {
  id: string;
  name: string;
  selected: boolean;
}

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  // Downgrade modal state
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgradeKids, setDowngradeKids] = useState<DowngradeItem[]>([]);
  const [downgradeAdults, setDowngradeAdults] = useState<DowngradeItem[]>([]);
  const [downgradePrograms, setDowngradePrograms] = useState<DowngradeItem[]>([]);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeType, setUpgradeType] = useState<'featured_monthly' | 'featured_weekly' | 'planner_yearly' | 'planner_monthly' | null>(null);
  const [upgradeSubId, setUpgradeSubId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/featured/login?redirect=/billing');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    }
  }, [user]);

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/user/subscriptions');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch subscriptions');
      }

      setData(result);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to delete this subscription? This cannot be undone.')) {
      return;
    }

    setDeletingId(subscriptionId);
    setError('');

    try {
      const response = await fetch(`/api/user/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete subscription');
      }

      if (data) {
        setData({
          ...data,
          featuredSubscriptions: data.featuredSubscriptions.filter(s => s.id !== subscriptionId),
        });
      }
    } catch (err) {
      console.error('Error deleting subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete subscription');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this featured subscription? Your listing will remain active until the end of the current billing period.')) {
      return;
    }

    setCancellingId(subscriptionId);
    setError('');

    try {
      const response = await fetch(`/api/user/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      if (data) {
        setData({
          ...data,
          featuredSubscriptions: data.featuredSubscriptions.map(s =>
            s.id === subscriptionId ? { ...s, canceled_at: new Date().toISOString() } : s
          ),
        });
      }
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancellingId(null);
    }
  };

  const handleReactivateSubscription = async (subscriptionId: string) => {
    setReactivatingId(subscriptionId);
    setError('');

    try {
      const response = await fetch(`/api/user/subscriptions/${subscriptionId}/reactivate`, {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reactivate subscription');
      }

      // If Stripe checkout is needed (expired subscription), redirect
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }

      if (data) {
        setData({
          ...data,
          featuredSubscriptions: data.featuredSubscriptions.map(s =>
            s.id === subscriptionId ? { ...s, status: 'active' as const, canceled_at: null } : s
          ),
        });
      }
    } catch (err) {
      console.error('Error reactivating subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    } finally {
      setReactivatingId(null);
    }
  };

  const openDowngradeModal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      const [kidsRes, adultsRes, programsRes] = await Promise.all([
        supabase.from('planner_kids').select('id, name').eq('user_id', userId).order('sort_order'),
        supabase.from('planner_adults').select('id, name').eq('user_id', userId).order('sort_order'),
        supabase.from('planner_saved_programs')
          .select('id, program_id, custom_program_data, program:programs(name)')
          .eq('user_id', userId)
          .order('saved_at'),
      ]);

      setDowngradeKids((kidsRes.data || []).map((k, i) => ({
        id: k.id,
        name: k.name,
        selected: i === 0,
      })));
      setDowngradeAdults((adultsRes.data || []).map((a, i) => ({
        id: a.id,
        name: a.name,
        selected: i === 0,
      })));
      setDowngradePrograms((programsRes.data || []).map((p: any, i: number) => ({
        id: p.id,
        name: p.program?.name || p.custom_program_data?.name || 'Unknown Program',
        selected: i < 5,
      })));
    } catch (e) {
      console.error('Error loading data for downgrade:', e);
      setError('Failed to load your data. Please try again.');
      return;
    }

    setShowDowngradeModal(true);
  };

  const handleRemoveAllExtras = () => {
    setDowngradeKids(prev => prev.map((k, i) => ({ ...k, selected: i === 0 })));
    setDowngradeAdults(prev => prev.map((a, i) => ({ ...a, selected: i === 0 })));
    setDowngradePrograms(prev => prev.map((p, i) => ({ ...p, selected: i < 5 })));
  };

  const [downgrading, setDowngrading] = useState(false);

  const handleConfirmDowngrade = async () => {
    const selectedKids = downgradeKids.filter(k => k.selected);
    const selectedAdults = downgradeAdults.filter(a => a.selected);
    const selectedPrograms = downgradePrograms.filter(p => p.selected);

    if (selectedKids.length > 1) {
      setError('Free plan allows only 1 child profile. Please deselect extras.');
      return;
    }
    if (selectedAdults.length > 1) {
      setError('Free plan allows only 1 parent profile. Please deselect extras.');
      return;
    }
    if (selectedPrograms.length > 5) {
      setError('Free plan allows only 5 programs. Please deselect extras.');
      return;
    }

    setDowngrading(true);
    try {
      const res = await fetch('/api/planner/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keepKidIds: selectedKids.map(k => k.id),
          keepAdultIds: selectedAdults.map(a => a.id),
          keepProgramIds: selectedPrograms.map(p => p.id),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to downgrade');
      }

      if (data) {
        setData({
          ...data,
          familyPlanner: {
            plan: 'free',
            status: 'active',
            features: ['Save up to 5 programs', '1 child profile', '1 parent profile', 'Basic calendar view'],
          },
        });
      }

      setShowDowngradeModal(false);
      setError('');
    } catch (e) {
      console.error('Error downgrading:', e);
      setError(e instanceof Error ? e.message : 'Failed to downgrade. Please try again.');
    } finally {
      setDowngrading(false);
    }
  };

  const openFeaturedUpgradeModal = (subscriptionId: string) => {
    setUpgradeType('featured_monthly');
    setUpgradeSubId(subscriptionId);
    setShowUpgradeModal(true);
  };

  const openFeaturedDowngradeModal = (subscriptionId: string) => {
    setUpgradeType('featured_weekly');
    setUpgradeSubId(subscriptionId);
    setShowUpgradeModal(true);
  };

  const openPlannerYearlyModal = () => {
    setUpgradeType('planner_yearly');
    setUpgradeSubId(data?.familyPlanner?.stripeSubscriptionId || null);
    setShowUpgradeModal(true);
  };

  const openPlannerMonthlyModal = () => {
    setUpgradeType('planner_monthly');
    setUpgradeSubId(data?.familyPlanner?.stripeSubscriptionId || null);
    setShowUpgradeModal(true);
  };

  const closeUpgradeModal = () => {
    setShowUpgradeModal(false);
    setUpgradeType(null);
    setUpgradeSubId(null);
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradeType || !upgradeSubId) return;

    setUpgrading(true);
    setError('');

    try {
      const body = (upgradeType === 'featured_monthly' || upgradeType === 'featured_weekly')
        ? { type: upgradeType, subscriptionId: upgradeSubId }
        : { type: upgradeType, stripeSubscriptionId: upgradeSubId };

      const response = await fetch('/api/user/subscriptions/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to change plan');
      }

      // Redirect to Stripe Billing Portal
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }

      // Fallback: refresh data if no redirect
      await fetchSubscriptions();
      closeUpgradeModal();
    } catch (err) {
      console.error('Error changing plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to change plan');
    } finally {
      setUpgrading(false);
    }
  };

  const getStatusBadge = (statusOrSub: string | FeaturedSubscription) => {
    const status = typeof statusOrSub === 'string' ? statusOrSub : statusOrSub.status;
    const isCanceling = typeof statusOrSub !== 'string' && statusOrSub.canceled_at && ['active', 'trialing'].includes(statusOrSub.status);

    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      past_due: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800',
      canceling: 'bg-orange-100 text-orange-800',
      expired: 'bg-gray-100 text-gray-600',
    };

    const labels: Record<string, string> = {
      active: 'Active',
      trialing: 'Trial',
      pending: 'Pending',
      past_due: 'Past Due',
      canceled: 'Canceled',
      canceling: 'Canceling',
      expired: 'Expired',
    };

    const displayStatus = isCanceling ? 'canceling' : status;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[displayStatus] || styles.pending}`}>
        {labels[displayStatus] || status}
      </span>
    );
  };

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      free_trial: 'Free Trial',
      weekly: 'Weekly ($98/week)',
      monthly: 'Monthly ($298/month)',
    };
    return labels[plan] || plan;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const plannerData = data?.familyPlanner;
  const isFreePlan = !plannerData || plannerData.plan === 'free' || plannerData.plan === 'basic';
  const isPlannerCancelling = plannerData?.cancelAtPeriodEnd === true;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscriptions</h1>
          <p className="text-gray-600 mt-1">Manage your subscriptions and payment information</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Featured Business Subscriptions */}
        {data?.featuredSubscriptions && data.featuredSubscriptions.length > 0 ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-100">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                Featured Businesses
              </h2>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {data.featuredSubscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{sub.program_name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{getPlanLabel(sub.plan_type)}</p>
                      </div>
                      {getStatusBadge(sub)}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      {sub.status === 'trialing' && (
                        <>
                          <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wide">Trial Started</span>
                            <p className="text-gray-900 font-medium">{formatDate(sub.trial_start)}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs uppercase tracking-wide">Trial Ends</span>
                            <p className="text-gray-900 font-medium">{formatDate(sub.trial_end)}</p>
                          </div>
                        </>
                      )}
                      {sub.status === 'active' && !sub.canceled_at && (
                        <div className="col-span-2">
                          <span className="text-gray-400 text-xs uppercase tracking-wide">Current Period</span>
                          <p className="text-gray-900 font-medium">
                            {formatDate(sub.current_period_start)} – {formatDate(sub.current_period_end)}
                          </p>
                        </div>
                      )}
                      {(sub.status === 'canceled' || (sub.canceled_at && ['active', 'trialing'].includes(sub.status))) && sub.current_period_end && (
                        <div className="col-span-2">
                          <span className="text-gray-400 text-xs uppercase tracking-wide">Active Until</span>
                          <p className="text-orange-700 font-medium">
                            {formatDate(sub.current_period_end)}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Created</span>
                        <p className="text-gray-900 font-medium">{formatDate(sub.created_at)}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {sub.plan_type === 'weekly' && ['active', 'trialing'].includes(sub.status) && !sub.canceled_at && (
                          <button
                            onClick={() => openFeaturedUpgradeModal(sub.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            Upgrade to Monthly
                          </button>
                        )}
                        {sub.plan_type === 'monthly' && ['active', 'trialing'].includes(sub.status) && !sub.canceled_at && (
                          <button
                            onClick={() => openFeaturedDowngradeModal(sub.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            Switch to Weekly
                          </button>
                        )}
                        <Link
                          href="/featured"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Feature More Businesses
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        {['active', 'trialing'].includes(sub.status) && !sub.canceled_at && (
                          <button
                            onClick={() => handleCancelSubscription(sub.id)}
                            disabled={cancellingId === sub.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {cancellingId === sub.id ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Cancelling...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel Subscription
                              </>
                            )}
                          </button>
                        )}
                        {(sub.status === 'canceled' || (sub.canceled_at && ['active', 'trialing'].includes(sub.status))) && (
                          <button
                            onClick={() => handleReactivateSubscription(sub.id)}
                            disabled={reactivatingId === sub.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {reactivatingId === sub.id ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Reactivating...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Reactivate
                              </>
                            )}
                          </button>
                        )}
                        {['pending', 'expired'].includes(sub.status) && (
                          <button
                            onClick={() => handleDeleteSubscription(sub.id)}
                            disabled={deletingId === sub.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {deletingId === sub.id ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-100">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                Featured Businesses
              </h2>
            </div>
            <div className="p-6 text-center py-10">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⭐</span>
              </div>
              <p className="text-gray-900 font-medium mb-1">No featured businesses yet</p>
              <p className="text-gray-500 text-sm mb-5">Get your business seen by more families</p>
              <Link
                href="/featured"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Feature a Business
              </Link>
            </div>
          </div>
        )}

        {/* Family Planner Subscription */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-primary-50 to-blue-50 px-6 py-4 border-b border-primary-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Family Planner
              </h2>
              {isFreePlan ? (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full uppercase tracking-wide">Free</span>
              ) : isPlannerCancelling ? (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full uppercase tracking-wide">Cancelling</span>
              ) : (
                <span className="px-3 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full uppercase tracking-wide">Pro</span>
              )}
            </div>
          </div>

          <div className="p-6">
            {data?.familyPlanner && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {isFreePlan ? 'Basic Plan' : `Family Pro — ${plannerData?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {isFreePlan
                        ? 'Free forever'
                        : isPlannerCancelling
                          ? `Access until ${plannerData?.nextBillingDate ? new Date(plannerData.nextBillingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'end of period'}`
                          : `$${plannerData?.price || 8.5}/${plannerData?.billingCycle === 'yearly' ? 'year' : 'month'}`
                      }
                    </p>
                  </div>
                  {getStatusBadge(data.familyPlanner.status)}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Current Features</p>
                  <ul className="space-y-1.5">
                    {data.familyPlanner.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href="/familyplanning/billing"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    View Plans
                  </Link>

                  {isFreePlan && (
                    <Link
                      href="/familyplanning/billing"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Upgrade to Pro
                    </Link>
                  )}

                  {!isFreePlan && plannerData?.billingCycle === 'monthly' && !isPlannerCancelling && (
                    <button
                      onClick={openPlannerYearlyModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Switch to Yearly (Save 36%)
                    </button>
                  )}

                  {!isFreePlan && plannerData?.billingCycle === 'yearly' && !isPlannerCancelling && (
                    <button
                      onClick={openPlannerMonthlyModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      Switch to Monthly
                    </button>
                  )}

                  {!isFreePlan && (
                    <button
                      onClick={openDowngradeModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      Switch to Free Plan
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">👤</span>
              Account Information
            </h2>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Email</span>
                <span className="text-gray-900 font-medium">{data?.email || user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500 text-sm">Account Created</span>
                <span className="text-gray-900 font-medium">
                  {user.created_at ? formatDate(user.created_at) : 'N/A'}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Need help with billing? Contact us at{' '}
                <a href="mailto:support@planmykids.com" className="text-primary-600 hover:underline font-medium">
                  support@planmykids.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            {upgradeType === 'featured_monthly' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Upgrade to Monthly Plan</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Switch from weekly billing to monthly and save 24%.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Current Plan</p>
                      <p className="font-semibold text-gray-900">Weekly — $98/week</p>
                      <p className="text-xs text-gray-400">~$392/month</p>
                    </div>
                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">Current</span>
                  </div>
                  <div className="border-t border-gray-200"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">New Plan</p>
                      <p className="font-semibold text-gray-900">Monthly — $298/month</p>
                      <p className="text-xs text-green-600 font-medium">Save $94/month (24%)</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Upgrade</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-blue-800 mb-1">What you get:</p>
                  <ul className="text-xs text-blue-700 space-y-0.5">
                    <li>- Your business featured at the top of search results</li>
                    <li>- Priority placement in your neighborhood</li>
                    <li>- Monthly billing instead of weekly</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-5">
                  <p className="text-sm text-amber-700">
                    You&apos;ll be charged a prorated amount now for the upgrade. Your new monthly billing starts at your next cycle.
                  </p>
                </div>
              </>
            )}

            {upgradeType === 'featured_weekly' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Switch to Weekly Plan</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Switch from monthly billing back to weekly.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Current Plan</p>
                      <p className="font-semibold text-gray-900">Monthly — $298/month</p>
                    </div>
                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">Current</span>
                  </div>
                  <div className="border-t border-gray-200"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">New Plan</p>
                      <p className="font-semibold text-gray-900">Weekly — $98/week</p>
                      <p className="text-xs text-gray-400">~$392/month</p>
                    </div>
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Downgrade</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-5">
                  <p className="text-sm text-amber-700">
                    Your change will take effect at your next billing date. You&apos;ll keep monthly pricing until then.
                  </p>
                </div>
              </>
            )}

            {upgradeType === 'planner_yearly' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Switch to Yearly Plan</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Switch from monthly to yearly billing and save 36%.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Current Plan</p>
                      <p className="font-semibold text-gray-900">Monthly — $8.50/month</p>
                      <p className="text-xs text-gray-400">$102/year</p>
                    </div>
                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">Current</span>
                  </div>
                  <div className="border-t border-gray-200"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">New Plan</p>
                      <p className="font-semibold text-gray-900">Yearly — $65/year</p>
                      <p className="text-xs text-green-600 font-medium">Save $37/year (36%)</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Switch</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-blue-800 mb-1">Pro features included:</p>
                  <ul className="text-xs text-blue-700 space-y-0.5">
                    <li>- Unlimited saved programs</li>
                    <li>- Unlimited child profiles</li>
                    <li>- Email reminders before registration</li>
                    <li>- Export to iOS/Android calendar</li>
                    <li>- Family sharing (2 accounts)</li>
                    <li>- Priority support</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-5">
                  <p className="text-sm text-amber-700">
                    You&apos;ll be charged a prorated amount now for the upgrade. Your new yearly billing starts at your next cycle.
                  </p>
                </div>
              </>
            )}

            {upgradeType === 'planner_monthly' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Switch to Monthly Plan</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Switch from yearly back to monthly billing.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Current Plan</p>
                      <p className="font-semibold text-gray-900">Yearly — $65/year</p>
                    </div>
                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">Current</span>
                  </div>
                  <div className="border-t border-gray-200"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">New Plan</p>
                      <p className="font-semibold text-gray-900">Monthly — $8.50/month</p>
                      <p className="text-xs text-gray-400">$102/year</p>
                    </div>
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Downgrade</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-5">
                  <p className="text-sm text-amber-700">
                    Your change will take effect at your next billing date. You&apos;ll keep yearly pricing until then.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeUpgradeModal}
                disabled={upgrading}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpgrade}
                disabled={upgrading}
                className={`flex-1 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  upgradeType === 'featured_weekly' || upgradeType === 'planner_monthly'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {upgrading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  upgradeType === 'featured_monthly' ? 'Confirm Upgrade'
                    : upgradeType === 'featured_weekly' ? 'Confirm Downgrade'
                    : 'Confirm Switch'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downgrade Modal */}
      {showDowngradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Switch to Free Plan</h3>
            <p className="text-gray-600 mb-4">
              The Free plan allows:
            </p>
            <ul className="text-sm text-gray-700 mb-4 space-y-1">
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 1 child profile</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 1 parent profile</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> 5 saved programs</li>
            </ul>

            {(downgradeKids.length > 1 || downgradeAdults.length > 1 || downgradePrograms.length > 5) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  You have more than the free plan allows. Select which to keep:
                </p>
                <button
                  onClick={handleRemoveAllExtras}
                  className="text-xs text-yellow-700 underline hover:text-yellow-800"
                >
                  Auto-select minimum
                </button>
              </div>
            )}

            {/* Kids selection */}
            {downgradeKids.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Kids ({downgradeKids.filter(k => k.selected).length}/1):
                </p>
                <div className="space-y-2">
                  {downgradeKids.map(kid => (
                    <label key={kid.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kid.selected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Radio-like: only one can be selected
                            setDowngradeKids(prev => prev.map(k => ({
                              ...k,
                              selected: k.id === kid.id,
                            })));
                          } else {
                            setDowngradeKids(prev => prev.map(k =>
                              k.id === kid.id ? { ...k, selected: false } : k
                            ));
                          }
                        }}
                        className="rounded text-primary-600"
                      />
                      {kid.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Adults selection */}
            {downgradeAdults.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Parents ({downgradeAdults.filter(a => a.selected).length}/1):
                </p>
                <div className="space-y-2">
                  {downgradeAdults.map(adult => (
                    <label key={adult.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adult.selected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDowngradeAdults(prev => prev.map(a => ({
                              ...a,
                              selected: a.id === adult.id,
                            })));
                          } else {
                            setDowngradeAdults(prev => prev.map(a =>
                              a.id === adult.id ? { ...a, selected: false } : a
                            ));
                          }
                        }}
                        className="rounded text-primary-600"
                      />
                      {adult.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Programs selection */}
            {downgradePrograms.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Programs ({downgradePrograms.filter(p => p.selected).length}/5):
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {downgradePrograms.map(program => (
                    <label key={program.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={program.selected}
                        onChange={(e) => {
                          if (e.target.checked && downgradePrograms.filter(p => p.selected).length >= 5) {
                            return;
                          }
                          setDowngradePrograms(prev => prev.map(p =>
                            p.id === program.id ? { ...p, selected: e.target.checked } : p
                          ));
                        }}
                        className="rounded text-primary-600"
                      />
                      {program.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowDowngradeModal(false); setError(''); }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDowngrade}
                disabled={downgrading}
                className={`flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 ${downgrading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {downgrading ? 'Downgrading...' : 'Confirm Downgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
