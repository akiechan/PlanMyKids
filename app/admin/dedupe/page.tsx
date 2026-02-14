'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useReauthAction } from '@/hooks/useReauthAction';
import { ReauthDialog } from '@/components/ReauthDialog';

interface DuplicateGroup {
  name: string;
  program_type: string;
  count: number;
  keep: { id: string; name: string; fieldCount: number };
  remove: { id: string; name: string; fieldCount: number }[];
}

interface PreviewData {
  totalPrograms: number;
  duplicateGroups: number;
  toRemove: number;
  duplicates: DuplicateGroup[];
}

interface DedupeResult {
  removed: string[];
  kept: string[];
  errors: string[];
}

export default function DedupePage() {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<DedupeResult | null>(null);
  const [error, setError] = useState('');
  const { executeWithReauth, needsReauth, reauthMessage, handleReauth, dismissReauth } = useReauthAction();

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    try {
      const response = await fetch('/api/admin/dedupe');
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPreview(data);
      }
    } catch {
      setError('Failed to fetch duplicate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDedupe = async () => {
    if (!confirm('Are you sure you want to remove duplicates? This cannot be undone.')) {
      return;
    }

    setProcessing(true);
    setError('');
    setResults(null);

    try {
      const response = await executeWithReauth(() => fetch('/api/admin/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      }));
      if (!response) return;

      const data = await response.json();
      if (data.success) {
        setResults(data.results);
        // Refresh preview
        fetchPreview();
      } else {
        setError(data.error || 'Deduplication failed');
      }
    } catch {
      setError('Failed to run deduplication');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
        <p className="mt-2 text-gray-600">Finding duplicates...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Remove Duplicate Programs</h1>
          <p className="text-gray-600">
            Find and remove duplicate programs, keeping one per name + type.{' '}
            <Link href="/admin" className="text-green-600 hover:underline">
              Back to Admin
            </Link>
          </p>
        </div>
        {preview && preview.duplicateGroups > 0 && (
          <button
            onClick={handleDedupe}
            disabled={processing}
            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {processing ? 'Processing...' : `Remove ${preview.toRemove} Duplicates`}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {results && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Deduplication Results</h2>

          {results.removed.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Removed ({results.removed.length})</h3>
              <ul className="text-sm text-green-700 space-y-1 max-h-40 overflow-y-auto">
                {results.removed.map((item, i) => (
                  <li key={i}>✓ {item}</li>
                ))}
              </ul>
            </div>
          )}

          {results.kept.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Kept ({results.kept.length})</h3>
              <ul className="text-sm text-blue-700 space-y-1 max-h-40 overflow-y-auto">
                {results.kept.map((item, i) => (
                  <li key={i}>✓ {item}</li>
                ))}
              </ul>
            </div>
          )}

          {results.errors.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Errors ({results.errors.length})</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {results.errors.map((item, i) => (
                  <li key={i}>✕ {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {preview && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-blue-700">{preview.totalPrograms}</div>
            <div className="text-sm text-blue-600">Total Programs</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-amber-700">{preview.duplicateGroups}</div>
            <div className="text-sm text-amber-600">Duplicate Groups</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <div className="text-3xl font-bold text-red-700">{preview.toRemove}</div>
            <div className="text-sm text-red-600">To Remove</div>
          </div>
        </div>
      )}

      {/* Duplicate Groups */}
      {preview && preview.duplicates.length > 0 ? (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-800">
              Duplicate Groups ({preview.duplicateGroups})
            </h2>
            <p className="text-sm text-amber-600">
              Groups are based on normalized name + program_type. The entry with most data is kept.
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {preview.duplicates.map((group, i) => (
              <div key={i} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-gray-900">{group.name}</span>
                    <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {group.program_type}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{group.count} entries</span>
                </div>
                <div className="ml-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600 font-medium">Keep:</span>
                    <span className="text-gray-700">{group.keep.name}</span>
                    <span className="text-gray-400">({group.keep.fieldCount} fields)</span>
                    <Link
                      href={`/admin/edit/${group.keep.id}`}
                      className="text-green-600 hover:underline text-xs"
                    >
                      View →
                    </Link>
                  </div>
                  {group.remove.map((r, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm">
                      <span className="text-red-600 font-medium">Remove:</span>
                      <span className="text-gray-700">{r.name}</span>
                      <span className="text-gray-400">({r.fieldCount} fields)</span>
                      <Link
                        href={`/admin/edit/${r.id}`}
                        className="text-green-600 hover:underline text-xs"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 p-8 rounded-xl text-center">
          <div className="text-4xl mb-2">✓</div>
          <h3 className="text-lg font-semibold text-green-800">No Duplicates Found</h3>
          <p className="text-green-600">Your database has no duplicate programs within the same type.</p>
        </div>
      )}
      <ReauthDialog isOpen={needsReauth} message={reauthMessage} onReauth={handleReauth} onCancel={dismissReauth} />
    </div>
  );
}
