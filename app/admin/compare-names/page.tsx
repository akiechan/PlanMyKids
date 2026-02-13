'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CompareResult {
  csvName: string;
  csvWebsite: string;
  dbName: string | null;
  dbId: string | null;
  matchType: 'website' | 'exact' | 'partial' | 'not_found';
}

export default function CompareNamesPage() {
  const [results, setResults] = useState<CompareResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchComparison();
  }, []);

  const fetchComparison = async () => {
    try {
      const response = await fetch('/api/admin/compare-names');
      const data = await response.json();
      if (data.results) {
        setResults(data.results);
      } else {
        setError(data.error || 'Failed to load comparison');
      }
    } catch (err) {
      setError('Failed to fetch comparison data');
    } finally {
      setLoading(false);
    }
  };

  const exactMatches = results.filter(r => r.matchType === 'exact');
  const websiteMatches = results.filter(r => r.matchType === 'website');
  const partialMatches = results.filter(r => r.matchType === 'partial');
  const notFound = results.filter(r => r.matchType === 'not_found');

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
        <p className="mt-2 text-gray-600">Comparing names...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">CSV vs Database Name Comparison</h1>
        <p className="text-gray-600">
          Compare camp names from CSV with database records.{' '}
          <Link href="/admin" className="text-green-600 hover:underline">
            Back to Admin
          </Link>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-green-700">{exactMatches.length}</div>
          <div className="text-sm text-green-600">Exact Matches</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-blue-700">{websiteMatches.length}</div>
          <div className="text-sm text-blue-600">Website Match (Diff Name)</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-amber-700">{partialMatches.length}</div>
          <div className="text-sm text-amber-600">Partial Name Match</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-red-700">{notFound.length}</div>
          <div className="text-sm text-red-600">Not Found</div>
        </div>
      </div>

      {/* Website Matches with Different Names - Most Important */}
      {websiteMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
            <h2 className="text-lg font-semibold text-blue-800">
              Website Matched, Different Name ({websiteMatches.length}) - Review These
            </h2>
            <p className="text-sm text-blue-600">Same website URL but different camp name - likely need to update DB name</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CSV Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Database Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {websiteMatches.map((result, i) => (
                  <tr key={i} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{result.csvName}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 font-medium">{result.dbName}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/admin/edit/${result.dbId}`}
                        className="text-green-600 hover:text-green-700 hover:underline"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partial Name Matches */}
      {partialMatches.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-800">
              Partial Name Match ({partialMatches.length})
            </h2>
            <p className="text-sm text-amber-600">Matched by partial name (no website match)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CSV Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Database Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partialMatches.map((result, i) => (
                  <tr key={i} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{result.csvName}</td>
                    <td className="px-4 py-3 text-sm text-amber-600 font-medium">{result.dbName}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/admin/edit/${result.dbId}`}
                        className="text-green-600 hover:text-green-700 hover:underline"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Not Found */}
      {notFound.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
            <h2 className="text-lg font-semibold text-red-800">
              Not Found in Database ({notFound.length})
            </h2>
            <p className="text-sm text-red-600">These CSV camps have no match in the database</p>
          </div>
          <div className="p-4">
            <ul className="grid grid-cols-2 gap-2">
              {notFound.map((result, i) => (
                <li key={i} className="text-sm text-gray-700">• {result.csvName}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Exact Matches - Collapsed by default */}
      {exactMatches.length > 0 && (
        <details className="bg-white rounded-xl shadow-md overflow-hidden">
          <summary className="px-6 py-4 border-b border-gray-200 bg-green-50 cursor-pointer">
            <span className="text-lg font-semibold text-green-800">
              Exact Matches ({exactMatches.length}) - Click to expand
            </span>
          </summary>
          <div className="p-4 max-h-64 overflow-y-auto">
            <ul className="grid grid-cols-2 gap-2">
              {exactMatches.map((result, i) => (
                <li key={i} className="text-sm text-gray-600">✓ {result.csvName}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
