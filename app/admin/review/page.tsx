'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Program } from '@/types/database';
import Link from 'next/link';
import { useAdminLogger } from '@/hooks/useAdminLogger';

export default function AdminReviewPage() {
  const [pendingPrograms, setPendingPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const { logAction } = useAdminLogger();

  const fetchPendingPrograms = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('programs')
        .select(`
          *,
          locations:program_locations(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPendingPrograms(data || []);
    } catch (err) {
      console.error('Error fetching pending programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pending programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPrograms();
  }, []);

  const approveProgram = async (id: string) => {
    setProcessingId(id);
    setError('');

    try {
      const program = pendingPrograms.find(p => p.id === id);

      const { error: updateError } = await supabase
        .from('programs')
        .update({ status: 'active' })
        .eq('id', id);

      if (updateError) throw updateError;

      // Log the action
      await logAction({
        action: 'Review Programs',
        entityType: 'program',
        entityId: id,
        entityName: program?.name,
        details: { action: 'approved', program_type: program?.program_type },
      });

      // Refresh the list
      await fetchPendingPrograms();
    } catch (err) {
      console.error('Error approving program:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve program');
    } finally {
      setProcessingId(null);
    }
  };

  const rejectProgram = async (id: string) => {
    setProcessingId(id);
    setError('');

    try {
      const program = pendingPrograms.find(p => p.id === id);

      const { error: updateError } = await supabase
        .from('programs')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (updateError) throw updateError;

      // Log the action
      await logAction({
        action: 'Review Programs',
        entityType: 'program',
        entityId: id,
        entityName: program?.name,
        details: { action: 'rejected', program_type: program?.program_type },
      });

      // Refresh the list
      await fetchPendingPrograms();
    } catch (err) {
      console.error('Error rejecting program:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject program');
    } finally {
      setProcessingId(null);
    }
  };

  const approveAll = async () => {
    if (!confirm(`Are you sure you want to approve all ${pendingPrograms.length} pending programs?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const count = pendingPrograms.length;
      const programNames = pendingPrograms.map(p => p.name);

      const { error: updateError } = await supabase
        .from('programs')
        .update({ status: 'active' })
        .eq('status', 'pending');

      if (updateError) throw updateError;

      // Log the bulk action
      await logAction({
        action: 'Review Programs',
        entityType: 'program',
        entityName: `Multiple programs (${count})`,
        details: { action: 'approved', count, programNames },
      });

      // Refresh the list
      await fetchPendingPrograms();
    } catch (err) {
      console.error('Error approving all programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve all programs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(pendingPrograms.map(p => p.id)));
      setSelectAll(true);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setSelectAll(newSelected.size === pendingPrograms.length);
  };

  const approveSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one program');
      return;
    }

    if (!confirm(`Are you sure you want to approve ${selectedIds.size} selected program(s)?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const selectedPrograms = pendingPrograms.filter(p => selectedIds.has(p.id));
      const programNames = selectedPrograms.map(p => p.name);

      const { error: updateError } = await supabase
        .from('programs')
        .update({ status: 'active' })
        .in('id', Array.from(selectedIds));

      if (updateError) throw updateError;

      // Log the bulk action
      await logAction({
        action: 'Review Programs',
        entityType: 'program',
        entityName: `Multiple programs (${selectedIds.size})`,
        details: { action: 'approved', count: selectedIds.size, programNames },
      });

      setSelectedIds(new Set());
      setSelectAll(false);
      await fetchPendingPrograms();
    } catch (err) {
      console.error('Error approving selected programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve selected programs');
    } finally {
      setLoading(false);
    }
  };

  const retrieveReviewsForSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one program');
      return;
    }

    if (!confirm(`Retrieve Google reviews for ${selectedIds.size} selected program(s)?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call API endpoint to fetch Google reviews
      const response = await fetch('/api/google-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programIds: Array.from(selectedIds) }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to retrieve reviews');
      }

      alert(`✅ Successfully retrieved reviews for ${selectedIds.size} program(s)`);
      setSelectedIds(new Set());
      setSelectAll(false);
      await fetchPendingPrograms();
    } catch (err) {
      console.error('Error retrieving reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve reviews');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin: Review Pending Programs</h1>
          <p className="text-gray-600">
            Review and approve or reject user-submitted programs.{' '}
            <Link href="/admin/search" className="text-primary-600 hover:underline">
              Search & Add Programs
            </Link>
          </p>
        </div>
        <Link href="/admin" className="btn-secondary">
          ← Back to Admin
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading && !error ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading pending programs...</p>
        </div>
      ) : pendingPrograms.length === 0 ? (
        <div className="bg-gray-50 text-gray-700 p-8 rounded-lg text-center">
          <p className="text-xl font-medium">✅ No pending programs</p>
          <p className="text-gray-600 mt-2">All submissions have been reviewed!</p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex gap-4">
            <button
              onClick={approveAll}
              disabled={loading || pendingPrograms.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✓ Approve All ({pendingPrograms.length})
            </button>
            <button
              onClick={approveSelected}
              disabled={loading || selectedIds.size === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✓ Approve Selected ({selectedIds.size})
            </button>
            <button
              onClick={retrieveReviewsForSelected}
              disabled={loading || selectedIds.size === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🌟 Retrieve Reviews ({selectedIds.size})
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Program
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingPrograms.map((program) => (
                    <tr key={program.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(program.id)}
                          onChange={() => handleToggleSelect(program.id)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {program.name}
                        </div>
                        {program.provider_name && (
                          <div className="text-xs text-gray-500">{program.provider_name}</div>
                        )}
                        {program.provider_website && (
                          <a href={program.provider_website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block truncate max-w-[150px]">
                            {program.provider_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {program.category.slice(0, 2).map((cat) => (
                            <span
                              key={cat}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
                            >
                              {cat}
                            </span>
                          ))}
                          {program.category.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{program.category.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {program.locations && program.locations.length > 0 ? (
                          <div>
                            <div className="font-medium text-gray-700">{program.locations[0].neighborhood}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[120px]" title={program.locations[0].address}>
                              {program.locations[0].address}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {program.price_min !== null || program.price_max !== null ? (
                          <div>
                            <span className="text-gray-900">
                              {program.price_min !== null && program.price_max !== null
                                ? `$${program.price_min} - $${program.price_max}`
                                : program.price_min !== null
                                ? `$${program.price_min}`
                                : `$${program.price_max}`}
                            </span>
                            {program.price_unit && (
                              <span className="text-xs text-gray-500 block">{program.price_unit}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {program.contact_email && (
                          <a href={`mailto:${program.contact_email}`} className="text-blue-600 hover:underline block truncate max-w-[120px]" title={program.contact_email}>
                            {program.contact_email}
                          </a>
                        )}
                        {program.contact_phone && (
                          <span className="text-gray-600 block">{program.contact_phone}</span>
                        )}
                        {!program.contact_email && !program.contact_phone && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {program.registration_url && (
                          <a href={program.registration_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">
                            Register →
                          </a>
                        )}
                        {program.new_registration_date && (
                          <span className="text-green-600 block">
                            New: {new Date(program.new_registration_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {program.re_enrollment_date && (
                          <span className="text-amber-600 block">
                            Re-enroll: {new Date(program.re_enrollment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {!program.registration_url && !program.new_registration_date && !program.re_enrollment_date && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {program.google_rating ? (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">⭐</span>
                            <span className="font-semibold">{program.google_rating}</span>
                            <span className="text-gray-400 text-xs">({program.google_review_count})</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(program.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/edit/${program.id}`}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => approveProgram(program.id)}
                            disabled={processingId === program.id}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === program.id ? '...' : '✓'}
                          </button>
                          <button
                            onClick={() => rejectProgram(program.id)}
                            disabled={processingId === program.id}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === program.id ? '...' : '✗'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
