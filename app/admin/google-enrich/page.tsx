'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useReauthAction } from '@/hooks/useReauthAction';
import { ReauthDialog } from '@/components/ReauthDialog';

interface ProgramToEnrich {
  id: string;
  name: string;
  provider_name: string;
  currentAddress: string | null;
  hasLocation: boolean;
  hasRating: boolean;
  rating: number | null;
}

interface GooglePreview {
  program: {
    id: string;
    name: string;
    provider_name: string;
    currentLocation: Record<string, unknown> | null;
  };
  googleResult: {
    name: string;
    address: string;
    parsedAddress: { address: string; city: string; state: string; zip: string };
    coordinates: { lat: number; lng: number } | null;
    rating: number | null;
    reviewCount: number | null;
    phone: string | null;
    website: string | null;
    googleMapsUrl: string | null;
  } | null;
}

interface EnrichResult {
  programId: string;
  name: string;
  success: boolean;
  googleFound: boolean;
  updates?: Record<string, unknown>;
  error?: string;
}

export default function GoogleEnrichPage() {
  const [programs, setPrograms] = useState<ProgramToEnrich[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    needsEnrichment: 0,
    complete: 0,
    missingAddress: 0,
    missingReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<GooglePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResults, setEnrichResults] = useState<EnrichResult[] | null>(null);
  const [programType, setProgramType] = useState<'camp' | 'program'>('camp');
  const [filter, setFilter] = useState<'address' | 'reviews' | 'all'>('reviews');
  const { executeWithReauth, needsReauth, reauthMessage, handleReauth, dismissReauth } = useReauthAction();

  useEffect(() => {
    fetchPrograms();
  }, [programType, filter]);

  const fetchPrograms = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const response = await fetch(`/api/admin/google-enrich?action=list&programType=${programType}&filter=${filter}`);
      const data = await response.json();
      setPrograms(data.programs || []);
      setStats({
        total: data.total || 0,
        needsEnrichment: data.needsEnrichment || 0,
        complete: data.complete || 0,
        missingAddress: data.missingAddress || 0,
        missingReviews: data.missingReviews || 0,
      });
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const previewProgram = async (programId: string) => {
    setPreviewLoading(programId);
    setPreviewData(null);
    try {
      const response = await fetch(`/api/admin/google-enrich?action=preview&programId=${programId}`);
      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      console.error('Error previewing:', error);
    } finally {
      setPreviewLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === programs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(programs.map(p => p.id)));
    }
  };

  const runEnrichment = async (dryRun: boolean) => {
    if (selectedIds.size === 0) return;

    setEnriching(true);
    setEnrichResults(null);

    try {
      const response = await executeWithReauth(() => fetch('/api/admin/google-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programIds: Array.from(selectedIds),
          dryRun,
        }),
      }));
      if (!response) return;

      const data = await response.json();
      setEnrichResults(data.results || []);

      if (!dryRun) {
        // Refresh the list after actual enrichment
        await fetchPrograms();
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Error enriching:', error);
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading programs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Admin
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Google Places Enrichment</h1>
          <p className="text-gray-600 mb-4">
            Enrich program data with addresses, ratings, and contact info from Google Places.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Programs</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.missingAddress}</div>
              <div className="text-sm text-orange-700">Missing Address</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.missingReviews}</div>
              <div className="text-sm text-yellow-700">Missing Reviews</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.complete}</div>
              <div className="text-sm text-green-700">Fully Complete</div>
            </div>
          </div>

          {/* Program Type Toggle */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 self-center mr-2">Type:</span>
            <button
              onClick={() => setProgramType('camp')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                programType === 'camp'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Camps
            </button>
            <button
              onClick={() => setProgramType('program')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                programType === 'program'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Programs
            </button>
          </div>

          {/* Filter Toggle */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="text-sm text-gray-500 self-center mr-2">Filter:</span>
            <button
              onClick={() => setFilter('address')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'address'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Missing Address ({stats.missingAddress})
            </button>
            <button
              onClick={() => setFilter('reviews')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'reviews'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Missing Reviews ({stats.missingReviews})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Missing Data
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={selectAll}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              {selectedIds.size === programs.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={() => runEnrichment(true)}
              disabled={selectedIds.size === 0 || enriching}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {enriching ? 'Processing...' : `Preview Enrichment (${selectedIds.size})`}
            </button>
            <button
              onClick={() => runEnrichment(false)}
              disabled={selectedIds.size === 0 || enriching}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {enriching ? 'Processing...' : `Apply Enrichment (${selectedIds.size})`}
            </button>
          </div>

          {/* Selected count */}
          {selectedIds.size > 0 && (
            <div className="text-sm text-gray-600 mb-4">
              {selectedIds.size} program{selectedIds.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Enrichment Results */}
        {enrichResults && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Enrichment Results
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({enrichResults.filter(r => r.googleFound).length} found, {enrichResults.filter(r => !r.googleFound).length} not found)
              </span>
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {enrichResults.map((result) => (
                <div
                  key={result.programId}
                  className={`p-3 rounded-lg ${
                    result.googleFound
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-900">{result.name}</span>
                      {result.googleFound ? (
                        <span className="ml-2 text-green-600 text-sm">Found on Google</span>
                      ) : (
                        <span className="ml-2 text-yellow-600 text-sm">Not found</span>
                      )}
                    </div>
                  </div>
                  {result.updates && Object.keys(result.updates).length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Updates: </span>
                      {Object.entries(result.updates).map(([key, value]) => (
                        <span key={key} className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-2 mb-1">
                          {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                  {result.error && (
                    <div className="mt-2 text-sm text-red-600">{result.error}</div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setEnrichResults(null)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Clear results
            </button>
          </div>
        )}

        {/* Programs List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Programs Needing Enrichment ({programs.length})
          </h2>

          {programs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">✓</span>
              All {programType}s have complete {filter === 'address' ? 'address' : filter === 'reviews' ? 'review' : ''} data!
            </div>
          ) : (
            <div className="space-y-2">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                    selectedIds.has(program.id)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(program.id)}
                    onChange={() => toggleSelect(program.id)}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{program.name}</div>
                    {program.provider_name && program.provider_name !== program.name && (
                      <div className="text-sm text-gray-500 truncate">by {program.provider_name}</div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {!program.hasLocation || !program.currentAddress ? (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">No address</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded truncate max-w-[200px]">{program.currentAddress}</span>
                      )}
                      {!program.hasRating ? (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">No reviews</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">⭐ {program.rating}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => previewProgram(program.id)}
                    disabled={previewLoading === program.id}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    {previewLoading === program.id ? '...' : 'Preview'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {previewData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Google Preview</h3>
                  <button
                    onClick={() => setPreviewData(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Current Data */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">Current Data</h4>
                    <div className="text-sm space-y-1">
                      <div><span className="text-gray-500">Name:</span> {previewData.program.name}</div>
                      <div><span className="text-gray-500">Provider:</span> {previewData.program.provider_name}</div>
                      {previewData.program.currentLocation && (
                        <div><span className="text-gray-500">Address:</span> {(previewData.program.currentLocation as Record<string, unknown>).address as string || 'None'}</div>
                      )}
                    </div>
                  </div>

                  {/* Google Data */}
                  {previewData.googleResult ? (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-medium text-green-700 mb-2">Google Places Data</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="text-gray-500">Name:</span> {previewData.googleResult.name}</div>
                        <div><span className="text-gray-500">Address:</span> {previewData.googleResult.address}</div>
                        {previewData.googleResult.coordinates && (
                          <div>
                            <span className="text-gray-500">Coordinates:</span>{' '}
                            {previewData.googleResult.coordinates.lat.toFixed(6)}, {previewData.googleResult.coordinates.lng.toFixed(6)}
                          </div>
                        )}
                        {previewData.googleResult.rating && (
                          <div>
                            <span className="text-gray-500">Rating:</span>{' '}
                            ⭐ {previewData.googleResult.rating} ({previewData.googleResult.reviewCount} reviews)
                          </div>
                        )}
                        {previewData.googleResult.phone && (
                          <div><span className="text-gray-500">Phone:</span> {previewData.googleResult.phone}</div>
                        )}
                        {previewData.googleResult.website && (
                          <div>
                            <span className="text-gray-500">Website:</span>{' '}
                            <a href={previewData.googleResult.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {previewData.googleResult.website}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <h4 className="font-medium text-yellow-700 mb-2">No Google Result</h4>
                      <p className="text-sm text-yellow-600">
                        No matching business found on Google Places for &quot;{previewData.program.provider_name || previewData.program.name}&quot;
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setPreviewData(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                  {previewData.googleResult && (
                    <button
                      onClick={() => {
                        setSelectedIds(new Set([previewData.program.id]));
                        setPreviewData(null);
                      }}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                    >
                      Select for Enrichment
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ReauthDialog isOpen={needsReauth} message={reauthMessage} onReauth={handleReauth} onCancel={dismissReauth} />
    </div>
  );
}
