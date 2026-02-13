'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  sql?: string;
}

export default function AdminSetupPage() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    const results: CheckResult[] = [];

    // Check 1: program_edit_requests table exists
    try {
      const { error } = await supabase
        .from('program_edit_requests')
        .select('id')
        .limit(1);

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          results.push({
            name: 'program_edit_requests table',
            passed: false,
            message: 'Table does not exist',
            sql: `-- Create program_edit_requests table
CREATE TABLE IF NOT EXISTS program_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  edited_data JSONB NOT NULL,
  submitted_by_email TEXT,
  submitted_by_name TEXT,
  edit_notes TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_edit_requests_program_id ON program_edit_requests(program_id);
CREATE INDEX idx_edit_requests_status ON program_edit_requests(status);
CREATE INDEX idx_edit_requests_created_at ON program_edit_requests(created_at DESC);`
          });
        } else {
          throw error;
        }
      } else {
        results.push({
          name: 'program_edit_requests table',
          passed: true,
          message: 'Table exists'
        });
      }
    } catch (err) {
      results.push({
        name: 'program_edit_requests table',
        passed: false,
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    // Check 2: merged_into column exists
    try {
      const { error } = await supabase
        .from('programs')
        .select('merged_into')
        .limit(1);

      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          results.push({
            name: 'merged_into column',
            passed: false,
            message: 'Column does not exist in programs table',
            sql: `-- Add merged_into column
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programs_merged_into ON programs(merged_into);`
          });
        } else {
          throw error;
        }
      } else {
        results.push({
          name: 'merged_into column',
          passed: true,
          message: 'Column exists'
        });
      }
    } catch (err) {
      results.push({
        name: 'merged_into column',
        passed: false,
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    // Check 3: google_places_search_cache table
    try {
      const { error } = await supabase
        .from('google_places_search_cache')
        .select('id')
        .limit(1);

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          results.push({
            name: 'google_places_search_cache table',
            passed: false,
            message: 'Table does not exist',
            sql: `-- Create search cache table
CREATE TABLE IF NOT EXISTS google_places_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL UNIQUE,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_search_cache_query ON google_places_search_cache(search_query);
CREATE INDEX idx_search_cache_created_at ON google_places_search_cache(created_at);`
          });
        } else {
          throw error;
        }
      } else {
        results.push({
          name: 'google_places_search_cache table',
          passed: true,
          message: 'Table exists'
        });
      }
    } catch (err) {
      results.push({
        name: 'google_places_search_cache table',
        passed: false,
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    // Check 4: google_reviews_url populated
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, google_place_id, google_reviews_url')
        .not('google_place_id', 'is', null)
        .is('google_reviews_url', null)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        results.push({
          name: 'google_reviews_url backfill',
          passed: false,
          message: `${data.length}+ programs missing review URLs`,
          sql: `-- Backfill google_reviews_url
UPDATE programs
SET google_reviews_url = 'https://search.google.com/local/reviews?placeid=' || google_place_id
WHERE google_place_id IS NOT NULL
  AND google_place_id != ''
  AND (google_reviews_url IS NULL OR google_reviews_url = '');`
        });
      } else {
        results.push({
          name: 'google_reviews_url backfill',
          passed: true,
          message: 'All programs have review URLs'
        });
      }
    } catch (err) {
      results.push({
        name: 'google_reviews_url backfill',
        passed: false,
        message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    setChecks(results);
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('SQL copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-8 w-1/3 rounded" />
          <div className="bg-gray-200 h-64 w-full rounded" />
        </div>
      </div>
    );
  }

  const failedChecks = checks.filter(c => !c.passed);
  const allPassed = failedChecks.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Database Setup Check</h1>
          <p className="text-gray-600 mt-2">
            Verify that all required migrations have been run
          </p>
        </div>
        <Link href="/admin" className="btn-secondary">
          ← Back to Admin
        </Link>
      </div>

      {allPassed ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center mb-8">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">All Checks Passed!</h2>
          <p className="text-gray-600">
            Your database is properly configured and ready to use.
          </p>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">⚠️ {failedChecks.length} Issue(s) Found</h2>
          <p className="text-gray-600">
            Please run the SQL migrations below in your Supabase SQL Editor.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {checks.map((check, index) => (
          <div
            key={index}
            className={`bg-white rounded-xl shadow-md overflow-hidden ${
              check.passed ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{check.passed ? '✓' : '✗'}</span>
                    <h3 className="text-lg font-bold text-gray-900">{check.name}</h3>
                  </div>
                  <p className={`text-sm ${check.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {check.message}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    check.passed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {check.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>

              {!check.passed && check.sql && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Required SQL:</p>
                    <button
                      onClick={() => copyToClipboard(check.sql!)}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                  <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-x-auto">
                    <code>{check.sql}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-2">How to Run Migrations</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Go to your Supabase dashboard</li>
          <li>Navigate to "SQL Editor"</li>
          <li>Copy the SQL from the failed checks above</li>
          <li>Paste and run each migration</li>
          <li>Refresh this page to verify</li>
        </ol>
      </div>
    </div>
  );
}
