'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CampDate {
  name: string;
  dates: string;
  hours: string;
  website: string;
  parsedStart: string | null;
  parsedEnd: string | null;
  parsedHoursStart: string | null;
  parsedHoursEnd: string | null;
}

interface ImportResult {
  matched: string[];
  updated: string[];
  notFound: string[];
  errors: string[];
}

export default function ImportDatesPage() {
  const [camps, setCamps] = useState<CampDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCamps();
  }, []);

  const fetchCamps = async () => {
    try {
      const response = await fetch('/api/admin/import-camp-dates');
      const data = await response.json();
      if (data.camps) {
        setCamps(data.camps);
      } else {
        setError(data.error || 'Failed to load camps');
      }
    } catch (err) {
      setError('Failed to fetch camp data');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    setResults(null);

    try {
      const csvData = camps.map(c => ({
        name: c.name,
        dates: c.dates,
        hours: c.hours,
        website: c.website,
      }));

      const response = await fetch('/api/admin/import-camp-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData }),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.results);
      } else {
        setError(data.error || 'Import failed');
      }
    } catch (err) {
      setError('Failed to import dates');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
        <p className="mt-2 text-gray-600">Loading camp data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Camp Dates & Hours</h1>
          <p className="text-gray-600">
            Preview and import dates and hours from CSV.{' '}
            <Link href="/admin" className="text-green-600 hover:underline">
              Back to Admin
            </Link>
          </p>
        </div>
        <button
          onClick={handleImport}
          disabled={importing || camps.length === 0}
          className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import Dates & Hours'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {results && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Import Results</h2>

          {results.updated.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Updated ({results.updated.length})</h3>
              <ul className="text-sm text-green-700 space-y-1 max-h-40 overflow-y-auto">
                {results.updated.map((item, i) => (
                  <li key={i}>✓ {item}</li>
                ))}
              </ul>
            </div>
          )}

          {results.notFound.length > 0 && (
            <div className="bg-amber-50 p-4 rounded-lg">
              <h3 className="font-semibold text-amber-800 mb-2">Not Found in Database ({results.notFound.length})</h3>
              <ul className="text-sm text-amber-700 space-y-1 max-h-40 overflow-y-auto">
                {results.notFound.map((item, i) => (
                  <li key={i}>⚠ {item}</li>
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

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Camp Dates & Hours Preview ({camps.length} camps)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Camp Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date String</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parsed Dates</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours String</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parsed Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {camps.map((camp, i) => (
                <tr key={i} className={camp.parsedStart || camp.parsedHoursStart ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{camp.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{camp.dates || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {camp.parsedStart || camp.parsedEnd ? (
                      <span className="text-green-600">
                        {camp.parsedStart || '?'} - {camp.parsedEnd || '?'}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{camp.hours || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {camp.parsedHoursStart || camp.parsedHoursEnd ? (
                      <span className="text-blue-600">
                        {camp.parsedHoursStart || '?'} - {camp.parsedHoursEnd || '?'}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
