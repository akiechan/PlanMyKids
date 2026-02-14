'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface FeaturedSub {
  id: string;
  program_name: string;
  plan_type: string;
  status: string;
}

interface FamilyPlanner {
  plan: string;
  status: string;
  billingCycle?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [featuredSubs, setFeaturedSubs] = useState<FeaturedSub[]>([]);
  const [familyPlanner, setFamilyPlanner] = useState<FamilyPlanner | null>(null);
  const [subsLoading, setSubsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/profile');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || user.user_metadata?.name || '');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchSubs = async () => {
      try {
        const res = await fetch('/api/user/subscriptions');
        if (res.ok) {
          const data = await res.json();
          const active = (data.featuredSubscriptions || []).filter(
            (s: FeaturedSub) => ['active', 'trialing'].includes(s.status)
          );
          setFeaturedSubs(active);
          setFamilyPlanner(data.familyPlanner || null);
        }
      } catch {
        // silent
      } finally {
        setSubsLoading(false);
      }
    };
    fetchSubs();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Sync the updated session to cookies
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch('/api/auth/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
          });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while updating your profile' });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <Link
          href="/"
          className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block"
        >
          ← Back to Home
        </Link>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>

          {message && (
            <div
              className={`mb-6 px-4 py-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Email cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>

            {/* Family Planning Plan */}
            <div className="mb-5">
              <p className="text-sm text-gray-500 mb-1">Family Planning</p>
              {subsLoading ? (
                <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
              ) : familyPlanner?.plan === 'pro' ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  Pro {familyPlanner.billingCycle === 'yearly' ? '(Yearly)' : '(Monthly)'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                  Free Plan
                </span>
              )}
            </div>

            {/* Featured Programs */}
            <div className="mb-5">
              <p className="text-sm text-gray-500 mb-2">Featured Programs</p>
              {subsLoading ? (
                <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
              ) : featuredSubs.length > 0 ? (
                <ul className="space-y-2">
                  {featuredSubs.map((sub) => (
                    <li key={sub.id} className="flex items-center gap-2 text-sm">
                      <span className={`inline-block w-2 h-2 rounded-full ${sub.status === 'active' ? 'bg-green-500' : 'bg-yellow-400'}`} />
                      <span className="text-gray-800">{sub.program_name}</span>
                      <span className="text-xs text-gray-400 capitalize">({sub.status === 'trialing' ? 'trial' : sub.plan_type})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No featured programs</p>
              )}
            </div>

            <button
              onClick={() => router.push('/featured/setup')}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Feature Your Program
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
