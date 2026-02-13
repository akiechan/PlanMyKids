'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAdminLogger } from '@/hooks/useAdminLogger';

interface Program {
  id: string;
  name: string;
  provider_name: string;
  category: string[];
  description: string;
  status: string;
  program_type?: 'program' | 'camp' | 'birthday_venue';
}

interface DuplicatePair {
  program1: Program;
  program2: Program;
  similarity: number;
  reasons: string[];
}

interface MergeHistoryItem {
  id: string;
  name: string;
  provider_name: string;
  merged_into: string;
  merged_into_name?: string;
  updated_at: string;
}

interface MergedFormData {
  name: string;
  provider_name: string;
  category: string[];
  description: string;
}

export default function AdminDuplicatesPage() {
  const { logAction } = useAdminLogger();
  const [scanning, setScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [threshold, setThreshold] = useState(0.7);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<DuplicatePair[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Manual merge state
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [selectedManualPrograms, setSelectedManualPrograms] = useState<Program[]>([]);
  const [showManualMergeModal, setShowManualMergeModal] = useState(false);
  const [mergedFormData, setMergedFormData] = useState<MergedFormData>({
    name: '',
    provider_name: '',
    category: [],
    description: ''
  });
  const [manualMergeProcessing, setManualMergeProcessing] = useState(false);
  const [programSearchQuery, setProgramSearchQuery] = useState('');

  // Merge history state
  const [mergeHistory, setMergeHistory] = useState<MergeHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch all programs and merge history on mount
  useEffect(() => {
    fetchAllPrograms();
    fetchMergeHistory();
  }, []);

  const fetchAllPrograms = async () => {
    const { data, error } = await supabase
      .from('programs')
      .select('id, name, provider_name, category, description, status, program_type')
      .eq('status', 'active')
      .is('merged_into', null)
      .order('name');

    if (!error && data) {
      setAllPrograms(data);
    }
  };

  const fetchMergeHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, provider_name, merged_into, updated_at')
        .not('merged_into', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        // Fetch the names of programs they were merged into
        const mergedIntoIds = [...new Set(data.map(p => p.merged_into))];
        const { data: targetPrograms } = await supabase
          .from('programs')
          .select('id, name')
          .in('id', mergedIntoIds);

        const targetMap = new Map(targetPrograms?.map(p => [p.id, p.name]) || []);

        const historyWithNames = data.map(item => ({
          ...item,
          merged_into_name: targetMap.get(item.merged_into) || 'Unknown'
        }));

        setMergeHistory(historyWithNames);
      }
    } catch (err) {
      console.error('Error fetching merge history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  };

  const findDuplicates = async () => {
    setScanning(true);
    setDuplicates([]);
    setSelectedPairs(new Set());

    try {
      // Fetch all active programs
      const { data: programs, error } = await supabase
        .from('programs')
        .select('id, name, provider_name, category, description, status, program_type')
        .eq('status', 'active')
        .is('merged_into', null);

      if (error) throw error;

      const pairs: DuplicatePair[] = [];

      // Compare each program with every other program
      for (let i = 0; i < (programs || []).length; i++) {
        for (let j = i + 1; j < (programs || []).length; j++) {
          const p1 = programs![i];
          const p2 = programs![j];

          const nameSimilarity = calculateSimilarity(
            p1.name.toLowerCase().trim(),
            p2.name.toLowerCase().trim()
          );

          const providerSimilarity = calculateSimilarity(
            p1.provider_name.toLowerCase(),
            p2.provider_name.toLowerCase()
          );

          const categories1 = new Set<string>(p1.category || []);
          const categories2 = new Set<string>(p2.category || []);
          const categoryOverlap = [...categories1].filter((c: string) => categories2.has(c)).length;
          const categoryScore = categoryOverlap > 0
            ? categoryOverlap / Math.max(categories1.size, categories2.size)
            : 0;

          const reasons: string[] = [];
          let isDuplicate = false;

          // Check various duplicate conditions
          if (nameSimilarity > 0.85) {
            reasons.push(`Very similar names (${(nameSimilarity * 100).toFixed(0)}% match)`);
            isDuplicate = true;
          } else if (nameSimilarity > 0.7 && providerSimilarity > 0.7) {
            reasons.push(`Similar names and providers (${(nameSimilarity * 100).toFixed(0)}% / ${(providerSimilarity * 100).toFixed(0)}%)`);
            isDuplicate = true;
          }

          if (p1.provider_name.toLowerCase() === p2.provider_name.toLowerCase() && nameSimilarity > 0.6) {
            reasons.push(`Same provider with similar names`);
            isDuplicate = true;
          }

          if (categoryScore > 0.5 && nameSimilarity > 0.65) {
            reasons.push(`Similar categories (${(categoryScore * 100).toFixed(0)}% overlap) and names`);
            isDuplicate = true;
          }

          // Check for containment
          const name1 = p1.name.toLowerCase().trim();
          const name2 = p2.name.toLowerCase().trim();
          if ((name1.includes(name2) || name2.includes(name1)) && Math.min(name1.length, name2.length) > 10) {
            reasons.push(`One name contains the other`);
            isDuplicate = true;
          }

          if (isDuplicate) {
            const overallSimilarity = (nameSimilarity + providerSimilarity + categoryScore) / 3;
            if (overallSimilarity >= threshold) {
              pairs.push({
                program1: p1,
                program2: p2,
                similarity: overallSimilarity,
                reasons
              });
            }
          }
        }
      }

      // Sort by similarity score
      pairs.sort((a, b) => b.similarity - a.similarity);
      setDuplicates(pairs);
    } catch (err) {
      console.error('Error finding duplicates:', err);
      alert('Error scanning for duplicates');
    } finally {
      setScanning(false);
    }
  };

  const handleMerge = async (keepId: string, mergeId: string) => {
    if (!confirm(`Are you sure you want to merge these programs? The selected program will be kept, and the other will be marked as merged.`)) {
      return;
    }

    setProcessing(mergeId);

    // Find the program names from the duplicates
    const pair = duplicates.find(p =>
      (p.program1.id === keepId && p.program2.id === mergeId) ||
      (p.program2.id === keepId && p.program1.id === mergeId)
    );
    const keptProgram = pair?.program1.id === keepId ? pair.program1 : pair?.program2;
    const mergedProgram = pair?.program1.id === mergeId ? pair.program1 : pair?.program2;

    try {
      // Mark the program as merged
      const { error } = await supabase
        .from('programs')
        .update({
          merged_into: keepId,
          status: 'inactive'
        })
        .eq('id', mergeId);

      if (error) throw error;

      await logAction({
        action: 'Find & Merge Duplicates',
        entityType: 'program',
        entityId: keepId,
        entityName: keptProgram?.name || 'Unknown',
        details: { action: 'merged', mergedProgramId: mergeId, mergedProgramName: mergedProgram?.name, program_type: keptProgram?.program_type },
      });

      alert('✅ Programs merged successfully!');

      // Remove the merged pair from the list
      setDuplicates(prev => prev.filter(
        pair => pair.program1.id !== mergeId && pair.program2.id !== mergeId
      ));
    } catch (err) {
      console.error('Error merging programs:', err);
      alert('Failed to merge programs');
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkMerge = () => {
    if (selectedPairs.size === 0) {
      alert('Please select at least one duplicate pair to merge');
      return;
    }

    const pairsToReview = duplicates.filter(pair =>
      selectedPairs.has(`${pair.program1.id}-${pair.program2.id}`)
    );

    setReviewQueue(pairsToReview);
    setCurrentReviewIndex(0);
    setShowReviewModal(true);
  };

  const handleMergeChoice = async (keepId: string, mergeId: string) => {
    try {
      // Keep the selected program, merge the other into it
      const { error } = await supabase
        .from('programs')
        .update({
          merged_into: keepId,
          status: 'inactive'
        })
        .eq('id', mergeId);

      if (error) throw error;

      // Remove from duplicates list
      setDuplicates(prev => prev.filter(
        p => p.program1.id !== mergeId && p.program2.id !== mergeId
      ));

      // Move to next pair or close modal
      if (currentReviewIndex < reviewQueue.length - 1) {
        setCurrentReviewIndex(prev => prev + 1);
      } else {
        // All pairs reviewed
        setShowReviewModal(false);
        setSelectedPairs(new Set());
        setReviewQueue([]);
        setCurrentReviewIndex(0);
        alert('✅ Bulk merge review complete!');
      }
    } catch (err) {
      console.error('Error merging programs:', err);
      alert('Failed to merge programs');
    }
  };

  const handleSkipPair = () => {
    // Move to next pair or close modal
    if (currentReviewIndex < reviewQueue.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
    } else {
      // All pairs reviewed
      setShowReviewModal(false);
      setSelectedPairs(new Set());
      setReviewQueue([]);
      setCurrentReviewIndex(0);
      alert('✅ Bulk merge review complete!');
    }
  };

  const handleCancelReview = () => {
    setShowReviewModal(false);
    setReviewQueue([]);
    setCurrentReviewIndex(0);
  };

  const togglePairSelection = (pairId: string) => {
    setSelectedPairs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pairId)) {
        newSet.delete(pairId);
      } else {
        newSet.add(pairId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPairs.size === duplicates.length) {
      setSelectedPairs(new Set());
    } else {
      setSelectedPairs(new Set(duplicates.map(pair => `${pair.program1.id}-${pair.program2.id}`)));
    }
  };

  // Manual merge handlers
  const handleAddProgramToManualMerge = (programId: string) => {
    if (selectedManualPrograms.length >= 3) {
      alert('You can only select up to 3 programs to merge');
      return;
    }

    const program = allPrograms.find(p => p.id === programId);
    if (program && !selectedManualPrograms.find(p => p.id === programId)) {
      setSelectedManualPrograms(prev => [...prev, program]);
    }
    setProgramSearchQuery('');
  };

  const handleRemoveProgramFromManualMerge = (programId: string) => {
    setSelectedManualPrograms(prev => prev.filter(p => p.id !== programId));
  };

  const handleOpenManualMergeModal = () => {
    if (selectedManualPrograms.length < 2) {
      alert('Please select at least 2 programs to merge');
      return;
    }

    // Pre-populate merged form with data from the first selected program
    const primary = selectedManualPrograms[0];

    // Combine all unique categories
    const allCategories = new Set<string>();
    selectedManualPrograms.forEach(p => {
      (p.category || []).forEach(cat => allCategories.add(cat));
    });

    // Combine descriptions
    const combinedDescription = selectedManualPrograms
      .map(p => p.description)
      .filter(Boolean)
      .join('\n\n---\n\n');

    setMergedFormData({
      name: primary.name,
      provider_name: primary.provider_name,
      category: [...allCategories],
      description: combinedDescription
    });

    setShowManualMergeModal(true);
  };

  const handleManualMergeSubmit = async () => {
    if (selectedManualPrograms.length < 2) return;

    setManualMergeProcessing(true);

    try {
      // The first program is the one we keep
      const keepId = selectedManualPrograms[0].id;
      const mergeIds = selectedManualPrograms.slice(1).map(p => p.id);

      // Update the kept program with merged data
      const { error: updateError } = await supabase
        .from('programs')
        .update({
          name: mergedFormData.name,
          provider_name: mergedFormData.provider_name,
          category: mergedFormData.category,
          description: mergedFormData.description
        })
        .eq('id', keepId);

      if (updateError) throw updateError;

      // Mark other programs as merged
      const { error: mergeError } = await supabase
        .from('programs')
        .update({
          merged_into: keepId,
          status: 'inactive'
        })
        .in('id', mergeIds);

      if (mergeError) throw mergeError;

      await logAction({
        action: 'Find & Merge Duplicates',
        entityType: 'program',
        entityId: keepId,
        entityName: mergeIds.length > 1 ? `Multiple programs (${mergeIds.length + 1})` : mergedFormData.name,
        details: { action: 'merged', mergedProgramIds: mergeIds, count: mergeIds.length, program_type: selectedManualPrograms[0]?.program_type },
      });

      alert('✅ Programs merged successfully!');

      // Reset state
      setShowManualMergeModal(false);
      setSelectedManualPrograms([]);
      setMergedFormData({ name: '', provider_name: '', category: [], description: '' });

      // Refresh data
      fetchAllPrograms();
      fetchMergeHistory();

      // Remove merged programs from duplicate list if present
      setDuplicates(prev => prev.filter(pair =>
        !mergeIds.includes(pair.program1.id) && !mergeIds.includes(pair.program2.id)
      ));
    } catch (err) {
      console.error('Error in manual merge:', err);
      alert('Failed to merge programs');
    } finally {
      setManualMergeProcessing(false);
    }
  };

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setMergedFormData(prev => ({
        ...prev,
        category: [...prev.category, category]
      }));
    } else {
      setMergedFormData(prev => ({
        ...prev,
        category: prev.category.filter(c => c !== category)
      }));
    }
  };

  const filteredPrograms = allPrograms.filter(p =>
    !selectedManualPrograms.find(sp => sp.id === p.id) &&
    (p.name.toLowerCase().includes(programSearchQuery.toLowerCase()) ||
     p.provider_name.toLowerCase().includes(programSearchQuery.toLowerCase()))
  );

  // All possible categories from selected programs
  const availableCategories = new Set<string>();
  selectedManualPrograms.forEach(p => {
    (p.category || []).forEach(cat => availableCategories.add(cat));
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Duplicate Detection</h1>
          <p className="text-gray-600">
            Scan all programs to find potential duplicates and merge them
          </p>
        </div>
        <Link href="/admin" className="btn-secondary">
          ← Back to Admin
        </Link>
      </div>

      {/* Find & Merge Card */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        {/* Automatic Scan Section */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Automatic Duplicate Detection</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Similarity Threshold: {(threshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher threshold = fewer, more certain matches. Lower = more potential duplicates.
              </p>
            </div>
            <button
              onClick={findDuplicates}
              disabled={scanning}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {scanning ? 'Scanning...' : 'Scan for Duplicates'}
            </button>
          </div>
        </div>

        {/* Manual Merge Section */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Merge</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select up to 3 programs to merge manually. The first selected program will be the primary (kept).
          </p>

          {/* Program Search */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search programs by name or provider..."
              value={programSearchQuery}
              onChange={(e) => setProgramSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {programSearchQuery && filteredPrograms.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredPrograms.slice(0, 10).map(program => (
                  <button
                    key={program.id}
                    onClick={() => handleAddProgramToManualMerge(program.id)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{program.name}</div>
                    <div className="text-sm text-gray-500">{program.provider_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Programs - Card Layout */}
          {selectedManualPrograms.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Manual Merge Selection
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-600">
                        {selectedManualPrograms.length}/3 programs selected
                      </span>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                        First selected will be kept
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleOpenManualMergeModal}
                    disabled={selectedManualPrograms.length < 2}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Merge Selected ({selectedManualPrograms.length})
                  </button>
                </div>
              </div>

              <div className={`grid gap-6 p-6 ${
                selectedManualPrograms.length === 1 ? 'grid-cols-1' :
                selectedManualPrograms.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
              }`}>
                {selectedManualPrograms.map((program, index) => (
                  <div
                    key={program.id}
                    className={`space-y-3 ${
                      index === 0 ? 'border-2 border-primary-200 rounded-lg p-4 bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {index === 0 && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-primary-600 text-white rounded">
                              Primary (Keep)
                            </span>
                          )}
                          {index > 0 && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-gray-500 text-white rounded">
                              Will be merged
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-900 mb-1">{program.name}</h4>
                        <p className="text-sm text-gray-600 mb-2">Provider: {program.provider_name}</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(program.category || []).map((cat) => (
                            <span key={cat} className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded">
                              {cat}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-3">{program.description}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveProgramFromManualMerge(program.id)}
                        className="text-red-500 hover:text-red-700 p-1 ml-2"
                        title="Remove from selection"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/programs/${program.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        View →
                      </a>
                      <a
                        href={`/admin/edit/${program.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Edit →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedManualPrograms.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500">Search and select programs above to merge them</p>
            </div>
          )}
        </div>

        {/* Merge History Section */}
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 hover:text-primary-600 transition-colors"
          >
            <span>Merge History</span>
            <svg
              className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHistory && (
            <div className="bg-gray-50 rounded-lg p-4">
              {loadingHistory ? (
                <div className="text-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent"></div>
                </div>
              ) : mergeHistory.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {mergeHistory.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        <span className="text-gray-400 mx-2">→</span>
                        <span className="text-sm text-primary-600">{item.merged_into_name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No merge history yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {duplicates.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium">
              Found {duplicates.length} potential duplicate pair(s)
            </p>
          </div>

          {/* Bulk Actions */}
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-primary-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPairs.size === duplicates.length && duplicates.length > 0}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({selectedPairs.size} / {duplicates.length})
                  </span>
                </label>
                {selectedPairs.size > 0 && (
                  <span className="text-sm text-gray-600">
                    Note: First program in each pair will be kept
                  </span>
                )}
              </div>
              <button
                onClick={handleBulkMerge}
                disabled={selectedPairs.size === 0 || bulkProcessing}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkProcessing ? 'Merging...' : `Merge Selected (${selectedPairs.size})`}
              </button>
            </div>
          </div>

          {duplicates.map((pair, index) => {
            const pairId = `${pair.program1.id}-${pair.program2.id}`;
            const isSelected = selectedPairs.has(pairId);

            return (
              <div key={pairId} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePairSelection(pairId)}
                        className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Duplicate #{index + 1}
                        </h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600">
                            Similarity: {(pair.similarity * 100).toFixed(0)}%
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {pair.reasons.map((reason, i) => (
                              <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-2 gap-6 p-6">
                {/* Program 1 */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{pair.program1.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">Provider: {pair.program1.provider_name}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {pair.program1.category.map((cat) => (
                          <span key={cat} className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-3">{pair.program1.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/programs/${pair.program1.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      View →
                    </a>
                    <a
                      href={`/admin/edit/${pair.program1.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Edit →
                    </a>
                  </div>
                  <button
                    onClick={() => handleMerge(pair.program1.id, pair.program2.id)}
                    disabled={processing !== null}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    Keep This One
                  </button>
                </div>

                {/* Divider */}
                <div className="absolute left-1/2 top-24 bottom-24 w-px bg-gray-200" />

                {/* Program 2 */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{pair.program2.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">Provider: {pair.program2.provider_name}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {pair.program2.category.map((cat) => (
                          <span key={cat} className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-3">{pair.program2.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/programs/${pair.program2.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      View →
                    </a>
                    <a
                      href={`/admin/edit/${pair.program2.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Edit →
                    </a>
                  </div>
                  <button
                    onClick={() => handleMerge(pair.program2.id, pair.program1.id)}
                    disabled={processing !== null}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    Keep This One
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : scanning ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600">Scanning programs for duplicates...</p>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">Click "Scan for Duplicates" to find potential duplicate programs</p>
          <p className="text-sm text-gray-500">This will compare all active programs and identify similar ones</p>
        </div>
      )}

      {/* Manual Merge Modal */}
      {showManualMergeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-50 to-blue-50 px-6 py-4 border-b border-primary-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Merge Programs</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Click on a value to use it, or edit directly in the "Final Value" field
                  </p>
                </div>
                <button
                  onClick={() => setShowManualMergeModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Program Headers */}
              <div className={`grid gap-4 mb-4 ${
                selectedManualPrograms.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
              }`}>
                {selectedManualPrograms.map((p, index) => (
                  <div
                    key={p.id}
                    className={`text-center p-2 rounded-lg ${
                      index === 0 ? 'bg-primary-100 border border-primary-300' : 'bg-gray-100'
                    }`}
                  >
                    <span className={`text-xs font-semibold ${index === 0 ? 'text-primary-700' : 'text-gray-600'}`}>
                      {index === 0 ? '★ Primary (Keep)' : `Program ${index + 1}`}
                    </span>
                  </div>
                ))}
                <div className="text-center p-2 rounded-lg bg-green-100 border border-green-300">
                  <span className="text-xs font-semibold text-green-700">Final Value</span>
                </div>
              </div>

              {/* Program Name Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Program Name</label>
                <div className={`grid gap-4 ${
                  selectedManualPrograms.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                }`}>
                  {selectedManualPrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMergedFormData(prev => ({ ...prev, name: p.name }))}
                      className={`text-left p-3 rounded-lg border-2 transition-all hover:border-primary-400 ${
                        mergedFormData.name === p.name
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-sm text-gray-900">{p.name}</span>
                    </button>
                  ))}
                  <input
                    type="text"
                    value={mergedFormData.name}
                    onChange={(e) => setMergedFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="p-3 border-2 border-green-300 rounded-lg bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
              </div>

              {/* Provider Name Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Provider Name</label>
                <div className={`grid gap-4 ${
                  selectedManualPrograms.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                }`}>
                  {selectedManualPrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMergedFormData(prev => ({ ...prev, provider_name: p.provider_name }))}
                      className={`text-left p-3 rounded-lg border-2 transition-all hover:border-primary-400 ${
                        mergedFormData.provider_name === p.provider_name
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-sm text-gray-900">{p.provider_name}</span>
                    </button>
                  ))}
                  <input
                    type="text"
                    value={mergedFormData.provider_name}
                    onChange={(e) => setMergedFormData(prev => ({ ...prev, provider_name: e.target.value }))}
                    className="p-3 border-2 border-green-300 rounded-lg bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
              </div>

              {/* Categories Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Categories</label>
                <div className={`grid gap-4 ${
                  selectedManualPrograms.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                }`}>
                  {selectedManualPrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMergedFormData(prev => ({ ...prev, category: [...(p.category || [])] }))}
                      className={`text-left p-3 rounded-lg border-2 transition-all hover:border-primary-400 ${
                        JSON.stringify(mergedFormData.category.sort()) === JSON.stringify([...(p.category || [])].sort())
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex flex-wrap gap-1">
                        {(p.category || []).map((cat) => (
                          <span key={cat} className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded">
                            {cat}
                          </span>
                        ))}
                        {(!p.category || p.category.length === 0) && (
                          <span className="text-xs text-gray-400 italic">No categories</span>
                        )}
                      </div>
                    </button>
                  ))}
                  <div className="p-3 border-2 border-green-300 rounded-lg bg-green-50">
                    <div className="flex flex-wrap gap-1">
                      {[...availableCategories].map(category => (
                        <label
                          key={category}
                          className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors text-xs ${
                            mergedFormData.category.includes(category)
                              ? 'bg-primary-100 border-primary-300 text-primary-800'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={mergedFormData.category.includes(category)}
                            onChange={(e) => handleCategoryChange(category, e.target.checked)}
                            className="sr-only"
                          />
                          {category}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <div className={`grid gap-4 ${
                  selectedManualPrograms.length === 2 ? 'grid-cols-3' : 'grid-cols-4'
                }`}>
                  {selectedManualPrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMergedFormData(prev => ({ ...prev, description: p.description || '' }))}
                      className={`text-left p-3 rounded-lg border-2 transition-all hover:border-primary-400 max-h-32 overflow-y-auto ${
                        mergedFormData.description === p.description
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-xs text-gray-700 line-clamp-5">{p.description || <em className="text-gray-400">No description</em>}</span>
                    </button>
                  ))}
                  <textarea
                    value={mergedFormData.description}
                    onChange={(e) => setMergedFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="p-3 border-2 border-green-300 rounded-lg bg-green-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <strong>{selectedManualPrograms[0]?.name}</strong> will be updated with merged values.
                  <br />
                  <span className="text-gray-500">{selectedManualPrograms.length - 1} program(s) will be marked as merged.</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowManualMergeModal(false)}
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualMergeSubmit}
                    disabled={manualMergeProcessing}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {manualMergeProcessing ? 'Merging...' : 'Confirm Merge'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Merge Review Modal */}
      {showReviewModal && reviewQueue.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Review Duplicate Pair</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Reviewing pair {currentReviewIndex + 1} of {reviewQueue.length}
                  </p>
                </div>
                <button
                  onClick={handleCancelReview}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-6">
                Choose which program to keep. The other will be marked as merged and hidden.
              </p>

              {reviewQueue[currentReviewIndex] && (
                <div className="grid grid-cols-2 gap-6">
                  {/* Program 1 */}
                  <div className="border-2 border-blue-200 rounded-xl p-6 bg-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full">
                        Option 1
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {reviewQueue[currentReviewIndex].program1.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Provider: {reviewQueue[currentReviewIndex].program1.provider_name}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {reviewQueue[currentReviewIndex].program1.category.map((cat) => (
                            <span key={cat} className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded">
                              {cat}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-700 mb-4">
                          {reviewQueue[currentReviewIndex].program1.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`/programs/${reviewQueue[currentReviewIndex].program1.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          View Full Details →
                        </a>
                        <a
                          href={`/admin/edit/${reviewQueue[currentReviewIndex].program1.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                        >
                          Edit →
                        </a>
                      </div>
                      <button
                        onClick={() => handleMergeChoice(
                          reviewQueue[currentReviewIndex].program1.id,
                          reviewQueue[currentReviewIndex].program2.id
                        )}
                        className="w-full btn-primary bg-blue-600 hover:bg-blue-700"
                      >
                        Keep This Program
                      </button>
                    </div>
                  </div>

                  {/* Program 2 */}
                  <div className="border-2 border-green-200 rounded-xl p-6 bg-green-50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-green-600 text-white text-sm font-semibold rounded-full">
                        Option 2
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {reviewQueue[currentReviewIndex].program2.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Provider: {reviewQueue[currentReviewIndex].program2.provider_name}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {reviewQueue[currentReviewIndex].program2.category.map((cat) => (
                            <span key={cat} className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded">
                              {cat}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-700 mb-4">
                          {reviewQueue[currentReviewIndex].program2.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`/programs/${reviewQueue[currentReviewIndex].program2.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          View Full Details →
                        </a>
                        <a
                          href={`/admin/edit/${reviewQueue[currentReviewIndex].program2.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                        >
                          Edit →
                        </a>
                      </div>
                      <button
                        onClick={() => handleMergeChoice(
                          reviewQueue[currentReviewIndex].program2.id,
                          reviewQueue[currentReviewIndex].program1.id
                        )}
                        className="w-full btn-primary bg-green-600 hover:bg-green-700"
                      >
                        Keep This Program
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleSkipPair}
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Skip This Pair
                  </button>
                  <div className="text-sm text-gray-500">
                    {currentReviewIndex + 1} / {reviewQueue.length} pairs reviewed
                  </div>
                  <button
                    onClick={handleCancelReview}
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
