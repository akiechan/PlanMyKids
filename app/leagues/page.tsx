'use client';

import Link from 'next/link';

export default function LeaguesPage() {
  return (
    <div className="bg-gradient-to-b from-indigo-50 to-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="text-primary-600 hover:text-primary-700 text-sm mb-6 inline-flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="text-center py-16">
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">🏆</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Leagues
          </h1>
          <div className="inline-flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
