'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useReauthAction } from '@/hooks/useReauthAction';
import { ReauthDialog } from '@/components/ReauthDialog';

interface MergeGroup {
  canonical: string;
  variants: string[];
  counts: Record<string, number>;
}

interface DataItem {
  value: string;
  count: number;
}

interface MergeData {
  neighborhoods?: {
    total: number;
    items: DataItem[];
    suggestedMerges: MergeGroup[];
  };
  categories?: {
    total: number;
    items: DataItem[];
    suggestedMerges: MergeGroup[];
  };
}

export default function MergePage() {
  const [data, setData] = useState<MergeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'neighborhoods' | 'categories'>('neighborhoods');
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeResults, setMergeResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [customMerge, setCustomMerge] = useState<{ canonical: string; variants: string[] } | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [editingCanonical, setEditingCanonical] = useState(false);
  const [canonicalInput, setCanonicalInput] = useState('');
  const [programType, setProgramType] = useState<'all' | 'program' | 'camp'>('all');
  const { executeWithReauth, needsReauth, reauthMessage, handleReauth, dismissReauth } = useReauthAction();

  useEffect(() => {
    fetchData();
  }, [programType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/merge-data?programType=${programType}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeMerge = async (type: 'neighborhood' | 'category', canonical: string, variants: string[]) => {
    const key = `${type}-${canonical}`;
    setMerging(key);

    try {
      const response = await executeWithReauth(() => fetch('/api/admin/merge-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, canonical, variants }),
      }));
      if (!response) return;

      const result = await response.json();

      if (result.success) {
        setMergeResults(prev => ({
          ...prev,
          [key]: { success: true, message: `Merged ${result.totalUpdated} records into "${canonical}"` },
        }));
        // Refresh data after merge
        await fetchData();
      } else {
        setMergeResults(prev => ({
          ...prev,
          [key]: { success: false, message: result.error || 'Merge failed' },
        }));
      }
    } catch (error) {
      setMergeResults(prev => ({
        ...prev,
        [key]: { success: false, message: 'Network error' },
      }));
    } finally {
      setMerging(null);
    }
  };

  const startCustomMerge = (canonical: string) => {
    setCustomMerge({ canonical, variants: [] });
    setCanonicalInput(canonical);
    setEditingCanonical(false);
    setSelectedVariants(new Set());
  };

  const toggleVariant = (variant: string) => {
    const newSelected = new Set(selectedVariants);
    if (newSelected.has(variant)) {
      newSelected.delete(variant);
    } else {
      newSelected.add(variant);
    }
    setSelectedVariants(newSelected);
  };

  const executeCustomMerge = async () => {
    if (!customMerge || selectedVariants.size === 0) return;

    const type = activeTab === 'neighborhoods' ? 'neighborhood' : 'category';
    await executeMerge(type, customMerge.canonical, Array.from(selectedVariants));
    setCustomMerge(null);
    setSelectedVariants(new Set());
  };

  const currentData = activeTab === 'neighborhoods' ? data?.neighborhoods : data?.categories;
  const sortedItems = currentData?.items ? [...currentData.items].sort((a, b) => a.value.localeCompare(b.value)) : [];
  const mergeType = activeTab === 'neighborhoods' ? 'neighborhood' : 'category';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Admin
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Merge Data</h1>
          <p className="text-gray-600 mb-6">
            Consolidate similar neighborhoods and categories to clean up your data.
          </p>

          {/* Type filter + Tabs */}
          <div className="flex items-center justify-between mb-6 border-b border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('neighborhoods')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'neighborhoods'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Neighborhoods ({data?.neighborhoods?.total || 0})
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'categories'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Categories ({data?.categories?.total || 0})
              </button>
            </div>
            <div className="flex gap-1 mb-1">
              {(['all', 'program', 'camp'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setProgramType(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    programType === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'program' ? 'Programs' : 'Camps'}
                </button>
              ))}
            </div>
          </div>

          {/* Suggested Merges */}
          {currentData?.suggestedMerges && currentData.suggestedMerges.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-yellow-500">⚠️</span>
                Suggested Merges
              </h2>
              <div className="space-y-4">
                {currentData.suggestedMerges.map((group, idx) => {
                  const key = `${mergeType}-${group.canonical}`;
                  const result = mergeResults[key];
                  const isMerging = merging === key;

                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 ${
                        result?.success
                          ? 'border-green-200 bg-green-50'
                          : 'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="font-semibold text-gray-900">
                          {group.canonical}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {group.counts[group.canonical]} uses
                        </span>
                        <span className="text-gray-400">←</span>
                        {group.variants.map(variant => (
                          <span
                            key={variant}
                            className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                          >
                            {variant}
                            <span className="text-xs text-gray-500">
                              ({group.counts[variant]})
                            </span>
                          </span>
                        ))}
                      </div>

                      {result ? (
                        <div
                          className={`text-sm ${
                            result.success ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {result.success ? '✓' : '✗'} {result.message}
                        </div>
                      ) : (
                        <button
                          onClick={() => executeMerge(mergeType, group.canonical, group.variants)}
                          disabled={isMerging}
                          className="text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
                        >
                          {isMerging ? 'Merging...' : `Merge into "${group.canonical}"`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentData?.suggestedMerges?.length === 0 && (
            <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 flex items-center gap-2">
                <span>✓</span>
                No automatic merge suggestions. Your {activeTab} look clean!
              </p>
            </div>
          )}

          {/* All Items with Custom Merge */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              All {activeTab === 'neighborhoods' ? 'Neighborhoods' : 'Categories'}
            </h2>

            {customMerge && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="mb-3">
                  <span className="text-sm text-blue-700">Merge into:</span>
                  {editingCanonical ? (
                    <div className="inline-flex items-center gap-1.5 ml-2">
                      <input
                        type="text"
                        value={canonicalInput}
                        onChange={e => setCanonicalInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && canonicalInput.trim()) {
                            setCustomMerge({ ...customMerge, canonical: canonicalInput.trim() });
                            setEditingCanonical(false);
                          }
                          if (e.key === 'Escape') {
                            setCanonicalInput(customMerge.canonical);
                            setEditingCanonical(false);
                          }
                        }}
                        className="px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-48"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (canonicalInput.trim()) {
                            setCustomMerge({ ...customMerge, canonical: canonicalInput.trim() });
                            setEditingCanonical(false);
                          }
                        }}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Set
                      </button>
                      <button
                        onClick={() => { setCanonicalInput(customMerge.canonical); setEditingCanonical(false); }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="ml-2 inline-flex items-center gap-1.5">
                      <strong className="text-blue-900">{customMerge.canonical}</strong>
                      <button
                        onClick={() => { setCanonicalInput(customMerge.canonical); setEditingCanonical(true); }}
                        className="text-xs text-blue-500 hover:text-blue-700 underline"
                      >
                        edit
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-sm text-blue-700 mb-3">
                  Click on items below to select which ones to merge.
                </p>
                {selectedVariants.size > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-sm text-blue-700">Will merge:</span>
                    {Array.from(selectedVariants).map(v => (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1 text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full"
                      >
                        {v}
                        <button
                          onClick={() => toggleVariant(v)}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <span className="text-sm text-blue-700">&rarr; <strong>{customMerge.canonical}</strong></span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={executeCustomMerge}
                    disabled={selectedVariants.size === 0 || merging !== null}
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    {merging ? 'Merging...' : `Merge ${selectedVariants.size} into "${customMerge.canonical}"`}
                  </button>
                  <button
                    onClick={() => {
                      setCustomMerge(null);
                      setSelectedVariants(new Set());
                      setEditingCanonical(false);
                    }}
                    className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {sortedItems.map(item => {
                const isCanonical = customMerge?.canonical === item.value;
                const isSelected = selectedVariants.has(item.value);

                return (
                  <button
                    key={item.value}
                    onClick={() => {
                      if (customMerge) {
                        if (!isCanonical) {
                          toggleVariant(item.value);
                        }
                      } else {
                        startCustomMerge(item.value);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors ${
                      isCanonical
                        ? 'bg-blue-500 text-white'
                        : isSelected
                        ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {item.value}
                    <span
                      className={`text-xs ${
                        isCanonical
                          ? 'text-blue-200'
                          : isSelected
                          ? 'text-blue-600'
                          : 'text-gray-500'
                      }`}
                    >
                      ({item.count})
                    </span>
                  </button>
                );
              })}
            </div>

            {!customMerge && (
              <p className="text-sm text-gray-500 mt-4">
                Click on any {activeTab === 'neighborhoods' ? 'neighborhood' : 'category'} to start a custom merge (it will become the canonical name).
              </p>
            )}
          </div>

          {/* Show categories reference when on neighborhoods tab */}
          {activeTab === 'neighborhoods' && data?.categories && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                All Categories <span className="text-sm font-normal text-gray-400">({data.categories.total})</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {[...data.categories.items].sort((a, b) => a.value.localeCompare(b.value)).map(item => (
                  <span
                    key={item.value}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-700"
                  >
                    {item.value}
                    <span className="text-xs text-gray-500">({item.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <ReauthDialog isOpen={needsReauth} message={reauthMessage} onReauth={handleReauth} onCancel={dismissReauth} />
    </div>
  );
}
