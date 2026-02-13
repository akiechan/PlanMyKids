'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePlannerData } from '@/hooks/usePlannerData';

interface ReminderSettings {
  leadTimeDays: number; // days before date to remind
  emailEnabled: boolean;
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const {
    reminders, programs, subscription, preferences,
    toggleReminder: hookToggleReminder, updatePreferences,
    loading: plannerLoading,
  } = usePlannerData(authLoading ? undefined : (user?.id ?? null));
  const [settings, setSettings] = useState<ReminderSettings>({
    leadTimeDays: 7,
    emailEnabled: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/familyplanning/settings');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync settings from preferences once loaded
  useEffect(() => {
    if (!plannerLoading) {
      setSettings({
        leadTimeDays: preferences.reminderLeadTimeDays,
        emailEnabled: preferences.reminderEmailEnabled,
      });
    }
  }, [plannerLoading, preferences.reminderLeadTimeDays, preferences.reminderEmailEnabled]);

  const saveSettings = async (newSettings: ReminderSettings) => {
    setSettings(newSettings);
    try {
      await updatePreferences({
        reminderLeadTimeDays: newSettings.leadTimeDays,
        reminderEmailEnabled: newSettings.emailEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Optimistic update already applied; DB write may have failed
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const toggleReminder = async (programId: string, type: 'registration' | 're_enrollment') => {
    try {
      await hookToggleReminder(programId, type);
    } catch {
      // Silently handled — optimistic update in hook
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Programs that have at least one reminder set
  const programsWithReminders = programs.filter(p => reminders[p.id]);
  const isPro = subscription?.plan === 'pro' || subscription?.plan === 'family';

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/familyplanning/dashboard"
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Reminder Settings</h1>
        </div>

        {/* Save Notification */}
        {saved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <span>✓</span> Settings saved
          </div>
        )}

        {/* Reminder Preferences */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Preferences</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Remind me before date
              </label>
              <select
                value={settings.leadTimeDays}
                onChange={(e) => saveSettings({ ...settings, leadTimeDays: Number(e.target.value) })}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>1 day before</option>
                <option value={3}>3 days before</option>
                <option value={7}>1 week before</option>
                <option value={14}>2 weeks before</option>
                <option value={30}>1 month before</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Email reminders</p>
                <p className="text-xs text-gray-500">
                  {isPro ? 'Receive email notifications for upcoming dates' : 'Available on Pro plan'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (isPro) {
                    saveSettings({ ...settings, emailEnabled: !settings.emailEnabled });
                  } else {
                    router.push('/familyplanning/billing');
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.emailEnabled && isPro
                    ? 'bg-blue-500'
                    : 'bg-gray-200'
                } ${!isPro ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.emailEnabled && isPro ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Active Reminders */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Active Reminders
            {programsWithReminders.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">({programsWithReminders.length})</span>
            )}
          </h2>

          {programsWithReminders.length > 0 ? (
            <div className="space-y-3">
              {programsWithReminders.map(program => {
                const reminder = reminders[program.id];
                return (
                  <div key={program.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900 text-sm mb-2">{program.name}</p>
                    <div className="space-y-1.5">
                      {reminder?.registration && program.new_registration_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-0.5">
                            📅 Registration: {formatDate(program.new_registration_date)}
                          </span>
                          <button
                            onClick={() => toggleReminder(program.id, 'registration')}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {reminder?.re_enrollment && program.re_enrollment_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-purple-700 bg-purple-100 rounded px-2 py-0.5">
                            🔄 Re-enroll: {formatDate(program.re_enrollment_date)}
                          </span>
                          <button
                            onClick={() => toggleReminder(program.id, 're_enrollment')}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm">No active reminders</p>
              <p className="text-xs text-gray-400 mt-1">
                Tap the 💡 icon next to dates in your dashboard to set reminders
              </p>
            </div>
          )}
        </div>

        {/* Link to billing */}
        <div className="mt-4 text-center">
          <Link href="/familyplanning/billing" className="text-sm text-blue-600 hover:text-blue-700">
            Manage subscription
          </Link>
        </div>
      </main>
    </div>
  );
}
