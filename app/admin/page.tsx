'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const categories = [
  {
    title: 'Review & Moderation',
    description: 'Review new and edited programs',
    color: 'blue',
    links: [
      {
        href: '/admin/review',
        title: 'Review Programs',
        description: 'Review and approve submitted programs',
        icon: '📋',
      },
      {
        href: '/admin/edits',
        title: 'Edit Requests',
        description: 'Review user-submitted edit requests',
        icon: '✏️',
      },
    ],
  },
  {
    title: 'Program Management',
    description: 'Add, edit, delete, and merge programs, camps, venues, and leagues',
    color: 'green',
    links: [
      {
        href: '/admin/programs',
        title: 'All Programs',
        description: 'View, edit, and delete all programs',
        icon: '📁',
      },
      {
        href: '/admin/edit-program',
        title: 'Add / Scrape',
        description: 'Add program from website or manually',
        icon: '🌐',
      },
      {
        href: '/admin/search',
        title: 'Google Search & Add',
        description: 'Search Google Places and add programs',
        icon: '🔎',
      },
      {
        href: '/admin/duplicates',
        title: 'Find & Merge Duplicates',
        description: 'Detect, merge, and view merge history',
        icon: '🔗',
      },
    ],
  },
  {
    title: 'Data Quality',
    description: 'Fix addresses, neighborhoods, categories, and duplicates',
    color: 'purple',
    links: [
      {
        href: '/admin/neighborhoods',
        title: 'Neighborhoods',
        description: 'View and fix neighborhood assignments',
        icon: '🏘️',
      },
      {
        href: '/admin/dedupe',
        title: 'Remove Duplicates',
        description: 'Find and remove duplicate programs by name + type',
        icon: '🗑️',
      },
      {
        href: '/admin/merge',
        title: 'Merge Variants',
        description: 'Consolidate similar neighborhoods and categories',
        icon: '🔀',
      },
      {
        href: '/admin/google-enrich',
        title: 'Google Enrichment',
        description: 'Add addresses and reviews from Google Places API',
        icon: '📍',
      },
      {
        href: '/admin/mass-update',
        title: 'Mass Update',
        description: 'Bulk update program fields',
        icon: '📦',
      },
    ],
  },
  {
    title: 'Import & Enrichment',
    description: 'CSV imports and external data',
    color: 'teal',
    links: [
      {
        href: '/admin/import-dates',
        title: 'Import Dates & Hours',
        description: 'Import camp dates and hours from CSV',
        icon: '📅',
      },
      {
        href: '/admin/compare-names',
        title: 'Compare CSV Names',
        description: 'Compare CSV camp names with database',
        icon: '🔍',
      },
    ],
  },
  {
    title: 'Analytics & History',
    description: 'Activity logs, subscriptions, and system tools',
    color: 'amber',
    links: [
      {
        href: '/admin/featured',
        title: 'Featured Programs',
        description: 'View featured subscriptions and contacts',
        icon: '⭐',
      },
      {
        href: '/admin/activity',
        title: 'Activity Log',
        description: 'View admin activity history',
        icon: '📊',
      },
      {
        href: '/admin/merged-programs',
        title: 'Merge History',
        description: 'View previously merged programs',
        icon: '📜',
      },
      {
        href: '/admin/setup',
        title: 'Setup',
        description: 'Database and system setup',
        icon: '⚙️',
      },
    ],
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', iconBg: 'bg-green-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-100' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', iconBg: 'bg-teal-100' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
};

export default function AdminPage() {
  const [pendingEditRequests, setPendingEditRequests] = useState(0);
  const [pendingProgramReviews, setPendingProgramReviews] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      // Fetch pending edit requests
      const { count: editCount } = await supabase
        .from('program_edit_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (editCount !== null) setPendingEditRequests(editCount);

      // Fetch pending program reviews
      const { count: reviewCount } = await supabase
        .from('programs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (reviewCount !== null) setPendingProgramReviews(reviewCount);
    };
    fetchCounts();
  }, []);

  const getPendingCount = (href: string) => {
    if (href === '/admin/edits') return pendingEditRequests;
    if (href === '/admin/review') return pendingProgramReviews;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>

        <div className="space-y-10">
          {categories.map((category) => {
            const colors = colorClasses[category.color];
            return (
              <div key={category.title}>
                <div className="mb-4">
                  <h2 className={`text-xl font-bold ${colors.text}`}>{category.title}</h2>
                  <p className="text-sm text-gray-500">{category.description}</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.links.map((link) => {
                    const pendingCount = getPendingCount(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`${colors.bg} ${colors.border} border rounded-xl p-5 hover:shadow-md transition-all group`}
                      >
                        <div className={`w-12 h-12 ${colors.iconBg} rounded-lg flex items-center justify-center mb-3`}>
                          <span className="text-2xl">{link.icon}</span>
                        </div>
                        <h3 className={`font-semibold ${colors.text} group-hover:underline flex items-center gap-2`}>
                          {link.title}
                          {pendingCount > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="animate-pulse">💡</span>
                              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                {pendingCount}
                              </span>
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{link.description}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 p-4 bg-gray-100 border border-gray-200 rounded-lg">
          <p className="text-gray-600 text-sm">
            <strong>Note:</strong> Admin authentication is currently disabled for development.
          </p>
        </div>
      </div>
    </div>
  );
}
