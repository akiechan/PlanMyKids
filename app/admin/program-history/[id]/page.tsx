'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Program } from '@/types/database';

interface ActivityLogEntry {
  id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface MergedProgram extends Program {
  merged_at?: string;
}

interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

function getUpdatedFieldsFromDetails(details: Record<string, unknown> | null): string[] {
  if (!details?.updatedFields || !Array.isArray(details.updatedFields)) {
    return [];
  }
  return details.updatedFields.filter((f): f is string => typeof f === 'string');
}

function getFieldChanges(details: Record<string, unknown> | null): FieldChange[] {
  if (!details) return [];

  const beforeValues = details.beforeValues as Record<string, unknown> | undefined;
  const afterValues = details.afterValues as Record<string, unknown> | undefined;
  const updatedFields = getUpdatedFieldsFromDetails(details);

  if (!beforeValues && !afterValues) return [];

  return updatedFields.map(field => ({
    field,
    before: beforeValues?.[field],
    after: afterValues?.[field],
  }));
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ') || '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function ProgramHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const programId = params.id as string;
  const initialTab = searchParams.get('type') === 'merges' ? 'merges' : 'edits';

  const [program, setProgram] = useState<Program | null>(null);
  const [editHistory, setEditHistory] = useState<ActivityLogEntry[]>([]);
  const [mergedPrograms, setMergedPrograms] = useState<MergedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'edits' | 'merges'>(initialTab);

  useEffect(() => {
    fetchData();
  }, [programId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch program details
      const { data: programData } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (programData) {
        setProgram(programData);
      }

      // Fetch edit history from activity log
      const { data: activityData } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('entity_id', programId)
        .eq('entity_type', 'program')
        .order('created_at', { ascending: false });

      if (activityData) {
        setEditHistory(activityData);
      }

      // Fetch programs that were merged into this one
      const { data: mergedData } = await supabase
        .from('programs')
        .select('*')
        .eq('merged_into', programId)
        .order('updated_at', { ascending: false });

      if (mergedData) {
        setMergedPrograms(mergedData.map(p => ({
          ...p,
          merged_at: p.updated_at,
        })));
      }
    } catch (err) {
      console.error('Error fetching program history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getActionLabel = (action: string, details: Record<string, unknown> | null) => {
    const actionDetail = details?.action as string;
    const labels: Record<string, string> = {
      added: 'Created',
      approved: 'Approved',
      edited: 'Edited',
      updated: 'Updated',
      merged: 'Merged',
      removed: 'Removed',
      rejected: 'Rejected',
    };
    return labels[actionDetail] || action;
  };

  const getActionColor = (details: Record<string, unknown> | null) => {
    const actionDetail = details?.action as string;
    const colors: Record<string, string> = {
      added: 'bg-green-100 text-green-800',
      approved: 'bg-green-100 text-green-800',
      edited: 'bg-blue-100 text-blue-800',
      updated: 'bg-blue-100 text-blue-800',
      merged: 'bg-purple-100 text-purple-800',
      removed: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[actionDetail] || 'bg-gray-100 text-gray-800';
  };


  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin/activity"
            className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block"
          >
            ← Back to Activity Log
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Program History
          </h1>
          {program && (
            <p className="text-gray-600 mt-1">
              <Link
                href={`/programs/${programId}`}
                className="text-primary-600 hover:underline"
              >
                {program.name}
              </Link>
            </p>
          )}
        </div>
        <Link href="/admin" className="btn-secondary">
          ← Back to Admin
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('edits')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'edits'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Edit History ({editHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('merges')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'merges'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Merged Programs ({mergedPrograms.length})
          </button>
        </nav>
      </div>

      {/* Edit History Tab */}
      {activeTab === 'edits' && (
        <div className="space-y-4">
          {editHistory.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
              No edit history found for this program.
            </div>
          ) : (
            editHistory.map((log) => {
              const changedFields = getUpdatedFieldsFromDetails(log.details);
              const duplicatesCount = typeof log.details?.duplicatesCount === 'number' ? log.details.duplicatesCount : 0;

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(
                          log.details
                        )}`}
                      >
                        {getActionLabel(log.action, log.details)}
                      </span>
                      <span className="text-sm text-gray-600">
                        by {log.admin_email}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(log.created_at)}
                    </span>
                  </div>

                  {/* Show changed fields with before/after values */}
                  {(() => {
                    const fieldChanges = getFieldChanges(log.details);
                    if (fieldChanges.length > 0) {
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Field Changes:
                          </p>
                          <div className="space-y-2">
                            {fieldChanges.map(({ field, before, after }) => (
                              <div key={field} className="bg-gray-50 rounded-lg p-3">
                                <div className="text-sm font-medium text-gray-700 mb-2">
                                  {field.replace(/_/g, ' ')}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-xs text-gray-400 block mb-1">Before:</span>
                                    <span className="text-red-600 bg-red-50 px-2 py-1 rounded inline-block max-w-full break-words">
                                      {formatFieldValue(before)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs text-gray-400 block mb-1">After:</span>
                                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded inline-block max-w-full break-words">
                                      {formatFieldValue(after)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    // Fallback: show just field names if no before/after values
                    if (changedFields.length > 0) {
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Changed Fields:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {changedFields.map((field) => (
                              <span
                                key={field}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                              >
                                {field.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Show merge info */}
                  {duplicatesCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-600">
                        Merged {duplicatesCount} duplicate(s)
                      </p>
                    </div>
                  )}

                  {/* Show additional details */}
                  {log.details && Object.keys(log.details).filter(k => !['action', 'updatedFields', 'duplicatesCount', 'mergeDuplicates'].includes(k)).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <details className="text-sm">
                        <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                          {JSON.stringify(
                            Object.fromEntries(
                              Object.entries(log.details).filter(
                                ([k]) => !['action', 'updatedFields', 'duplicatesCount', 'mergeDuplicates'].includes(k)
                              )
                            ),
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Merged Programs Tab */}
      {activeTab === 'merges' && (
        <div className="space-y-4">
          {mergedPrograms.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
              No programs have been merged into this program.
            </div>
          ) : (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-800">
                  The following programs were identified as duplicates and merged into{' '}
                  <strong>{program?.name}</strong>. They are now inactive but their data is preserved.
                </p>
              </div>
              {mergedPrograms.map((merged) => (
                <div
                  key={merged.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{merged.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {merged.category?.join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                        Merged
                      </span>
                      {merged.merged_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(merged.merged_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {merged.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                      {merged.description}
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      ID: {merged.id}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
