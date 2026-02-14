'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FeaturedSubscription {
  id: string;
  program_id: string | null;
  user_id: string;
  plan_type: string;
  status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  program_logo_url: string | null;
  program_data: { name?: string } | null;
  created_at: string;
  updated_at: string;
  programs: { name: string; provider_name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-400',
};

const PLAN_LABELS: Record<string, string> = {
  free_trial: 'Free Trial',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function AdminFeaturedPage() {
  const [subscriptions, setSubscriptions] = useState<FeaturedSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/featured-subscriptions');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error('Error fetching featured subscriptions:', err);
      setError('Failed to load featured subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const getProgramName = (sub: FeaturedSubscription) => {
    if (sub.programs?.name) return sub.programs.name;
    if (sub.program_data?.name) return sub.program_data.name;
    return 'Unknown Program';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filtered = subscriptions.filter((sub) => {
    if (statusFilter && sub.status !== statusFilter) return false;
    if (planFilter && sub.plan_type !== planFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const programName = getProgramName(sub).toLowerCase();
      if (
        !programName.includes(q) &&
        !sub.contact_name.toLowerCase().includes(q) &&
        !sub.contact_email.toLowerCase().includes(q) &&
        !(sub.contact_phone || '').includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Featured Programs</h1>
          <p className="text-gray-600 mt-2">
            All featured subscriptions with contact information
          </p>
        </div>
        <Link href="/admin" className="btn-secondary">
          ← Back to Admin
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by program, contact name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="pending">Pending</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Plan:</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All Plans</option>
              <option value="free_trial">Free Trial</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Showing {filtered.length} of {subscriptions.length} subscriptions
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Program</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Contact</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Plan</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Period</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {sub.program_logo_url && (
                          <img
                            src={sub.program_logo_url}
                            alt=""
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <div>
                          {sub.program_id ? (
                            <Link
                              href={`/programs/${sub.program_id}`}
                              className="font-medium text-gray-900 hover:text-primary-600"
                              target="_blank"
                            >
                              {getProgramName(sub)}
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-900">
                              {getProgramName(sub)}
                            </span>
                          )}
                          {sub.programs?.provider_name && (
                            <div className="text-xs text-gray-500">{sub.programs.provider_name}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{sub.contact_name}</div>
                      <a
                        href={`mailto:${sub.contact_email}`}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        {sub.contact_email}
                      </a>
                      {sub.contact_phone && (
                        <div className="text-gray-500">{sub.contact_phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {PLAN_LABELS[sub.plan_type] || sub.plan_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {sub.status === 'trialing' || sub.plan_type === 'free_trial' ? (
                      <div>
                        <div>{formatDate(sub.trial_start)} – {formatDate(sub.trial_end)}</div>
                      </div>
                    ) : sub.current_period_start ? (
                      <div>{formatDate(sub.current_period_start)} – {formatDate(sub.current_period_end)}</div>
                    ) : (
                      '—'
                    )}
                    {sub.canceled_at && (
                      <div className="text-xs text-red-500 mt-0.5">
                        Canceled {formatDate(sub.canceled_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {formatDate(sub.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {subscriptions.length === 0
              ? 'No featured subscriptions yet'
              : 'No subscriptions matching your filters'}
          </div>
        )}
      </div>
    </div>
  );
}
