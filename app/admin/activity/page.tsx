'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAdminLogger } from '@/hooks/useAdminLogger';
import DateInput from '@/components/DateInput';

interface ActivityLogEntry {
  id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Actions that can be undone/redone
const REDOABLE_ACTIONS = ['edited', 'merged', 'approved'];

// Action colors based on the action detail
const ACTION_DETAIL_COLORS: Record<string, string> = {
  added: 'bg-green-100 text-green-800',
  approved: 'bg-green-100 text-green-800',
  edited: 'bg-blue-100 text-blue-800',
  updated: 'bg-blue-100 text-blue-800',
  merged: 'bg-purple-100 text-purple-800',
  removed: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
};

// Friendly labels for action details
const ACTION_DETAIL_LABELS: Record<string, string> = {
  added: 'Newly Created',
  approved: 'Approved',
  edited: 'Edited',
  updated: 'Updated',
  merged: 'Merged',
  removed: 'Removed',
  rejected: 'Rejected',
};

// Program type labels and colors
const PROGRAM_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  program: { label: 'Program', emoji: '📚', color: 'bg-blue-100 text-blue-700' },
  camp: { label: 'Camp', emoji: '🏕️', color: 'bg-amber-100 text-amber-700' },
  birthday_venue: { label: 'Birthday', emoji: '🎂', color: 'bg-pink-100 text-pink-700' },
};

// Admin page colors
const PAGE_COLORS: Record<string, string> = {
  'Review Programs': 'bg-blue-100 text-blue-800',
  'Edit Requests': 'bg-blue-100 text-blue-800',
  'All Programs': 'bg-green-100 text-green-800',
  'Search & Add': 'bg-green-100 text-green-800',
  'Find & Merge Duplicates': 'bg-green-100 text-green-800',
  'Mass Update': 'bg-purple-100 text-purple-800',
  'Activity Log': 'bg-amber-100 text-amber-800',
  'Setup': 'bg-amber-100 text-amber-800',
};

// Backward compatibility: map old action codes to new format
const LEGACY_ACTION_MAP: Record<string, { page: string; action: string }> = {
  'program_approved': { page: 'Review Programs', action: 'approved' },
  'program_rejected': { page: 'Review Programs', action: 'rejected' },
  'program_edited': { page: 'All Programs', action: 'edited' },
  'program_merged': { page: 'Find & Merge Duplicates', action: 'merged' },
  'program_deleted': { page: 'All Programs', action: 'removed' },
  'program_status_changed': { page: 'All Programs', action: 'updated' },
  'edit_request_approved': { page: 'Edit Requests', action: 'approved' },
  'edit_request_rejected': { page: 'Edit Requests', action: 'rejected' },
  'subscription_created': { page: 'Setup', action: 'added' },
  'subscription_cancelled': { page: 'Setup', action: 'removed' },
  'settings_changed': { page: 'Setup', action: 'updated' },
};

// Helper to get page name (handles legacy and new format)
const getPageName = (action: string): string => {
  if (LEGACY_ACTION_MAP[action]) {
    return LEGACY_ACTION_MAP[action].page;
  }
  return action;
};

// Helper to get action detail (handles legacy and new format)
const getActionFromLog = (action: string, details: Record<string, unknown> | null): string => {
  // New format: action detail is in details.action
  if (details?.action && typeof details.action === 'string') {
    return details.action;
  }
  // Legacy format: extract from action code
  if (LEGACY_ACTION_MAP[action]) {
    return LEGACY_ACTION_MAP[action].action;
  }
  return '';
};

export default function AdminActivityPage() {
  const { logAction } = useAdminLogger();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [adminFilter, setAdminFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 50;

  // Unique values for filter dropdowns
  const [uniqueAdmins, setUniqueAdmins] = useState<string[]>([]);
  const [uniqueActions, setUniqueActions] = useState<string[]>([]);

  // Redo section state
  const [showRedoSection, setShowRedoSection] = useState(false);
  const [redoableActions, setRedoableActions] = useState<ActivityLogEntry[]>([]);
  const [redoingId, setRedoingId] = useState<string | null>(null);

  // Clear history state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearDateFrom, setClearDateFrom] = useState('');
  const [clearDateTo, setClearDateTo] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  const fetchLogs = async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 0 : page;

      let query = supabase
        .from('admin_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      // Apply filters
      if (adminFilter) {
        query = query.eq('admin_email', adminFilter);
      }
      if (actionFilter) {
        query = query.eq('action', actionFilter);
      }
      if (entityTypeFilter) {
        query = query.eq('entity_type', entityTypeFilter);
      }
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      if (reset) {
        setLogs(data || []);
        setPage(0);
      } else {
        setLogs((prev) => [...prev, ...(data || [])]);
      }

      setHasMore((data?.length || 0) === pageSize);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Get unique admin emails
      const { data: adminData } = await supabase
        .from('admin_activity_log')
        .select('admin_email')
        .order('admin_email');

      if (adminData) {
        const unique = [...new Set(adminData.map((d) => d.admin_email))];
        setUniqueAdmins(unique);
      }

      // Get unique actions
      const { data: actionData } = await supabase
        .from('admin_activity_log')
        .select('action')
        .order('action');

      if (actionData) {
        const unique = [...new Set(actionData.map((d) => d.action))];
        setUniqueActions(unique);
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  useEffect(() => {
    fetchLogs(true);
    fetchFilterOptions();
    fetchRedoableActions();
  }, []);

  const fetchRedoableActions = async () => {
    try {
      // Fetch recent actions that can be redone (edits with before/after values)
      const { data, error: fetchError } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('entity_type', 'program')
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      // Filter to only actions with beforeValues (can be reverted)
      const redoable = (data || []).filter(log => {
        const details = log.details as Record<string, unknown> | null;
        const actionDetail = details?.action as string;
        return REDOABLE_ACTIONS.includes(actionDetail) && details?.beforeValues;
      });

      setRedoableActions(redoable);
    } catch (err) {
      console.error('Error fetching redoable actions:', err);
    }
  };

  const handleRedo = async (log: ActivityLogEntry) => {
    if (!log.entity_id || !log.details) return;

    const beforeValues = log.details.beforeValues as Record<string, unknown> | undefined;
    if (!beforeValues) {
      alert('Cannot redo: No previous values stored for this action.');
      return;
    }

    if (!confirm(`Are you sure you want to revert the changes made to "${log.entity_name}"? This will restore the previous values.`)) {
      return;
    }

    setRedoingId(log.id);

    try {
      // Revert the program to its previous state
      const { error: updateError } = await supabase
        .from('programs')
        .update(beforeValues)
        .eq('id', log.entity_id);

      if (updateError) throw updateError;

      // Log the redo action
      await logAction({
        action: 'Activity Log',
        entityType: 'program',
        entityId: log.entity_id,
        entityName: log.entity_name || undefined,
        details: {
          action: 'updated',
          revertedFrom: log.id,
          revertedAction: log.details.action,
          restoredFields: Object.keys(beforeValues),
        },
      });

      alert('✅ Changes reverted successfully!');
      fetchLogs(true);
      fetchRedoableActions();
    } catch (err) {
      console.error('Error reverting changes:', err);
      alert(`Failed to revert: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRedoingId(null);
    }
  };

  const handleClearHistory = async () => {
    if (!clearDateFrom || !clearDateTo) {
      alert('Please select both start and end dates.');
      return;
    }

    if (clearConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm.');
      return;
    }

    setClearing(true);

    try {
      const { error: deleteError, count } = await supabase
        .from('admin_activity_log')
        .delete()
        .gte('created_at', `${clearDateFrom}T00:00:00`)
        .lte('created_at', `${clearDateTo}T23:59:59`);

      if (deleteError) throw deleteError;

      alert(`✅ Successfully deleted ${count || 'matching'} log entries.`);
      setShowClearModal(false);
      setClearDateFrom('');
      setClearDateTo('');
      setClearConfirmText('');
      fetchLogs(true);
      fetchRedoableActions();
    } catch (err) {
      console.error('Error clearing history:', err);
      alert(`Failed to clear history: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setClearing(false);
    }
  };

  const handleApplyFilters = () => {
    fetchLogs(true);
  };

  const handleClearFilters = () => {
    setAdminFilter('');
    setActionFilter('');
    setEntityTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setTimeout(() => fetchLogs(true), 0);
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
    fetchLogs();
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

  const getPageColor = (action: string) => {
    return PAGE_COLORS[action] || 'bg-gray-100 text-gray-800';
  };

  const getActionDetailColor = (actionDetail: string) => {
    return ACTION_DETAIL_COLORS[actionDetail] || 'bg-gray-100 text-gray-800';
  };

  const getUpdatedFields = (details: Record<string, unknown> | null): string[] => {
    if (!details?.updatedFields || !Array.isArray(details.updatedFields)) {
      return [];
    }
    return details.updatedFields.filter((f): f is string => typeof f === 'string');
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <h2 className="font-bold mb-2">Error Loading Activity Log</h2>
          <p>{error}</p>
          {error.includes('does not exist') && (
            <div className="mt-4">
              <p className="text-sm mb-2">The activity log table needs to be created. Run this SQL in your Supabase dashboard:</p>
              <pre className="bg-red-100 p-3 rounded text-xs overflow-x-auto">
{`CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_activity_admin_email ON admin_activity_log(admin_email);
CREATE INDEX idx_admin_activity_action ON admin_activity_log(action);
CREATE INDEX idx_admin_activity_entity_type ON admin_activity_log(entity_type);
CREATE INDEX idx_admin_activity_created_at ON admin_activity_log(created_at DESC);`}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Activity Log</h1>
          <p className="text-gray-600 mt-1">Track all admin actions and changes</p>
        </div>
        <Link
          href="/admin"
          className="btn-secondary"
        >
          ← Back to Admin
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <h2 className="font-medium text-gray-900 mb-3">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Admin</label>
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Admins</option>
              {uniqueAdmins.map((admin) => (
                <option key={admin} value={admin}>
                  {admin}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Page</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Pages</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {getPageName(action)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Type</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="program">Program</option>
              <option value="subscription">Subscription</option>
              <option value="user">User</option>
              <option value="system">System</option>
            </select>
          </div>

          <DateInput
            label="From Date"
            value={dateFrom}
            onChange={setDateFrom}
            size="sm"
            pastMonths={12}
            futureMonths={1}
          />

          <DateInput
            label="To Date"
            value={dateTo}
            onChange={setDateTo}
            size="sm"
            pastMonths={12}
            futureMonths={1}
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Clear Filters
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowRedoSection(!showRedoSection)}
            className={`px-4 py-2 rounded-lg text-sm ${
              showRedoSection
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            {showRedoSection ? '↩ Hide Redo' : '↩ Show Redo'} ({redoableActions.length})
          </button>
          <button
            onClick={() => setShowClearModal(true)}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
          >
            🗑 Clear History
          </button>
        </div>
      </div>

      {/* Redo Section */}
      {showRedoSection && (
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 mb-6">
          <h2 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
            <span>↩</span> Redo Actions
            <span className="text-sm font-normal text-purple-600">
              (Revert recent edits to their previous state)
            </span>
          </h2>

          {redoableActions.length === 0 ? (
            <p className="text-purple-700 text-sm">
              No recent actions can be redone. Actions must have before/after values stored to be reversible.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {redoableActions.map((log) => {
                const actionDetail = (log.details?.action as string) || '';
                const beforeValues = log.details?.beforeValues as Record<string, unknown> | undefined;
                const changedFields = beforeValues ? Object.keys(beforeValues) : [];

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-lg border border-purple-200 p-3 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getActionDetailColor(actionDetail)}`}>
                          {ACTION_DETAIL_LABELS[actionDetail] || actionDetail}
                        </span>
                        <Link
                          href={log.entity_id ? `/programs/${log.entity_id}` : '#'}
                          className="font-medium text-gray-900 hover:text-primary-600"
                        >
                          {log.entity_name || 'Unknown Program'}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(log.created_at)} by {log.admin_email}
                        {changedFields.length > 0 && (
                          <span className="ml-2">
                            • Changed: {changedFields.slice(0, 3).map(f => f.replace(/_/g, ' ')).join(', ')}
                            {changedFields.length > 3 && ` +${changedFields.length - 3} more`}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRedo(log)}
                      disabled={redoingId === log.id}
                      className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                    >
                      {redoingId === log.id ? 'Reverting...' : 'Revert'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Activity Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date/Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Admin
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Page
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Program
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading activity logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No activity logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const pageName = getPageName(log.action);
                const actionDetail = getActionFromLog(log.action, log.details);
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.admin_email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPageColor(
                          pageName
                        )}`}
                      >
                        {pageName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.entity_id && log.entity_type === 'program' ? (
                        <Link
                          href={`/programs/${log.entity_id}`}
                          className="text-primary-600 hover:text-primary-700 hover:underline truncate max-w-xs block"
                        >
                          {log.entity_name || 'View Program'}
                        </Link>
                      ) : (
                        <div className="text-gray-900 truncate max-w-xs">
                          {log.entity_name || '—'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(() => {
                        const programType = log.details?.program_type as string | undefined;
                        if (programType && PROGRAM_TYPE_LABELS[programType]) {
                          const typeInfo = PROGRAM_TYPE_LABELS[programType];
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${typeInfo.color}`}>
                              <span>{typeInfo.emoji}</span>
                              <span>{typeInfo.label}</span>
                            </span>
                          );
                        }
                        return <span className="text-gray-400">—</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {actionDetail ? (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionDetailColor(
                            actionDetail
                          )}`}
                        >
                          {ACTION_DETAIL_LABELS[actionDetail] || actionDetail}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {/* Show changed fields for edits/updates */}
                      {(() => {
                        const fields = getUpdatedFields(log.details);
                        if (actionDetail !== 'edited' || fields.length === 0) return null;
                        return (
                          <div className="mt-1 text-xs text-gray-500">
                            Changed: {fields.slice(0, 4).map(f => f.replace(/_/g, ' ')).join(', ')}
                            {fields.length > 4 && ` +${fields.length - 4} more`}
                          </div>
                        );
                      })()}
                      {/* History links for edited/merged programs */}
                      {log.entity_id && log.entity_type === 'program' && (actionDetail === 'edited' || actionDetail === 'merged') && (
                        <div className="mt-1">
                          <Link
                            href={`/admin/program-history/${log.entity_id}?type=${actionDetail === 'edited' ? 'edits' : 'merges'}`}
                            className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            View {actionDetail === 'edited' ? 'Edit' : 'Merge'} History →
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {hasMore && logs.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500 text-center">
        Showing {logs.length} entries
      </div>

      {/* Clear History Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-red-500">🗑</span> Clear Activity History
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Permanently delete activity log entries within a date range.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> This action cannot be undone. Deleted entries will be permanently removed from the database.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <DateInput
                  label="From Date"
                  value={clearDateFrom}
                  onChange={setClearDateFrom}
                  size="sm"
                  pastMonths={12}
                  futureMonths={1}
                />
                <DateInput
                  label="To Date"
                  value={clearDateTo}
                  onChange={setClearDateTo}
                  size="sm"
                  pastMonths={12}
                  futureMonths={1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowClearModal(false);
                  setClearDateFrom('');
                  setClearDateTo('');
                  setClearConfirmText('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                disabled={clearing || clearConfirmText !== 'DELETE' || !clearDateFrom || !clearDateTo}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? 'Deleting...' : 'Delete Entries'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
