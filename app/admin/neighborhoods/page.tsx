'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRegion } from '@/contexts/RegionContext';

interface ProgramRow {
  id: string;
  name: string;
  program_type: string;
  provider_website: string | null;
  category: string[];
  location_id: string | null;
  address: string | null;
  neighborhood: string | null;
}

export default function NeighborhoodsPage() {
  const { region } = useRegion();
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'missing' | 'generic'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'program' | 'camp'>('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ total: number; successful: number; failed: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<'name' | 'program_type' | 'category' | 'provider_website' | 'address' | 'neighborhood'>('neighborhood');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchPrograms = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/neighborhoods-list');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPrograms(data.programs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrograms(); }, []);

  const genericNeighborhoods = useMemo(() => {
    const lower = region.name.toLowerCase();
    const generics = ['', 'tbd'];
    if (lower.includes('san francisco')) {
      generics.push('san francisco', 'sf');
    } else if (lower.includes('los angeles')) {
      generics.push('los angeles', 'la');
    } else if (lower.includes('new york')) {
      generics.push('new york', 'nyc', 'ny');
    } else {
      generics.push(lower);
    }
    return generics;
  }, [region.name]);

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  };

  const filtered = programs
    .filter(p => {
      if (typeFilter !== 'all' && p.program_type !== typeFilter) return false;
      if (filter === 'missing' && p.neighborhood && p.neighborhood.trim() !== '') return false;
      if (filter === 'generic' && !genericNeighborhoods.includes((p.neighborhood || '').toLowerCase().trim())) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.neighborhood || '').toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (sortColumn === 'category') {
        aVal = (a.category || []).join(', ').toLowerCase();
        bVal = (b.category || []).join(', ').toLowerCase();
      } else {
        aVal = ((a[sortColumn] as string) || '').toLowerCase();
        bVal = ((b[sortColumn] as string) || '').toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const handleAutoDetect = async (program: ProgramRow) => {
    if (!program.address) {
      alert('No address to geocode');
      return;
    }
    setUpdatingId(program.location_id);
    try {
      const res = await fetch(`/api/google-neighborhood?address=${encodeURIComponent(program.address)}`);
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();

      if (!data.neighborhood) {
        alert(`Could not determine neighborhood for: ${program.address}`);
        return;
      }

      // Save to database
      const saveRes = await fetch('/api/admin/neighborhoods-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: program.location_id,
          neighborhood: data.neighborhood,
          latitude: data.latitude,
          longitude: data.longitude,
        }),
      });

      if (!saveRes.ok) throw new Error('Failed to save');

      setPrograms(prev => prev.map(p =>
        p.location_id === program.location_id ? { ...p, neighborhood: data.neighborhood } : p
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to detect neighborhood');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleManualSave = async (program: ProgramRow) => {
    if (!program.location_id) return;
    setUpdatingId(program.location_id);
    try {
      const res = await fetch('/api/admin/neighborhoods-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: program.location_id,
          neighborhood: editValue,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');

      setPrograms(prev => prev.map(p =>
        p.location_id === program.location_id ? { ...p, neighborhood: editValue } : p
      ));
      setEditingId(null);
    } catch (err) {
      alert('Failed to save');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkAutoDetect = async () => {
    const targets = filtered.filter(p => p.location_id && p.address && selectedIds.has(p.location_id!));
    if (targets.length === 0) {
      alert('No programs selected with addresses');
      return;
    }
    if (!confirm(`Auto-detect neighborhoods for ${targets.length} programs using Google? This will use API credits.`)) return;

    setBulkUpdating(true);
    setBulkResults(null);

    try {
      const res = await fetch('/api/admin/mass-update-neighborhoods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationIds: targets.map(t => t.location_id),
          dryRun: false,
        }),
      });
      if (!res.ok) throw new Error('Bulk update failed');
      const data = await res.json();
      setBulkResults({ total: data.total, successful: data.successful, failed: data.failed });

      // Update local state with results
      const resultMap = new Map(data.results?.map((r: any) => [r.locationId, r.newNeighborhood]) || []);
      setPrograms(prev => prev.map(p => {
        const newN = resultMap.get(p.location_id);
        return newN ? { ...p, neighborhood: newN as string } : p;
      }));
      setSelectedIds(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setBulkUpdating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.filter(p => p.location_id).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.filter(p => p.location_id).map(p => p.location_id!)));
    }
  };

  const toggleSelect = (locationId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };

  const stats = {
    total: programs.length,
    missing: programs.filter(p => !p.neighborhood || p.neighborhood.trim() === '').length,
    generic: programs.filter(p => genericNeighborhoods.includes((p.neighborhood || '').toLowerCase().trim())).length,
    programs: programs.filter(p => p.program_type === 'program').length,
    camps: programs.filter(p => p.program_type === 'camp').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">&larr; Admin</Link>
            <h1 className="text-2xl font-bold text-gray-900">Neighborhood Manager</h1>
            <p className="text-sm text-gray-500 mt-1">
              {stats.total} total &middot; {stats.missing} missing &middot; {stats.generic} generic &middot; {stats.programs} programs &middot; {stats.camps} camps
            </p>
          </div>
          <button
            onClick={fetchPrograms}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {bulkResults && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-4 text-sm flex items-center justify-between">
            <span>Bulk update: {bulkResults.successful}/{bulkResults.total} successful, {bulkResults.failed} failed</span>
            <button onClick={() => setBulkResults(null)} className="text-green-500 hover:text-green-700 text-xs">Dismiss</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {(['all', 'missing', 'generic'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'missing' ? 'Missing' : `Generic (${region.short_name}/TBD)`}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex gap-1">
              {(['all', 'program', 'camp'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    typeFilter === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t === 'program' ? 'Programs' : 'Camps'}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <input
              type="text"
              placeholder="Search name, neighborhood, address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white placeholder-gray-400"
            />
            <span className="text-xs text-gray-400">{filtered.length} shown</span>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">{selectedIds.size} selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                onClick={handleBulkAutoDetect}
                disabled={bulkUpdating}
                className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkUpdating ? 'Updating...' : `Auto-Detect ${selectedIds.size} Neighborhoods`}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(p => p.location_id).length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    {([
                      ['name', 'Name'],
                      ['program_type', 'Type'],
                      ['category', 'Category'],
                      ['provider_website', 'Website'],
                      ['address', 'Address'],
                      ['neighborhood', 'Neighborhood'],
                    ] as const).map(([col, label]) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 transition-colors"
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {sortColumn === col ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(program => (
                    <tr key={program.id + (program.location_id || '')} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2">
                        {program.location_id && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(program.location_id)}
                            onChange={() => toggleSelect(program.location_id!)}
                            className="rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate" title={program.name}>
                        {program.name}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          program.program_type === 'camp' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {program.program_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate" title={(program.category || []).join(', ')}>
                        {(program.category || []).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2 max-w-[150px] truncate">
                        {program.provider_website ? (
                          <a
                            href={program.provider_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs"
                            title={program.provider_website}
                          >
                            {program.provider_website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 30)}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate text-xs" title={program.address || ''}>
                        {program.address || <span className="text-gray-300">No address</span>}
                      </td>
                      <td className="px-3 py-2">
                        {editingId === program.location_id ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleManualSave(program); if (e.key === 'Escape') setEditingId(null); }}
                              className="w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                              autoFocus
                            />
                            <button
                              onClick={() => handleManualSave(program)}
                              disabled={updatingId === program.location_id}
                              className="px-1.5 py-1 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-1.5 py-1 text-[10px] text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`cursor-pointer text-xs ${
                              !program.neighborhood || program.neighborhood.trim() === ''
                                ? 'text-red-400 italic'
                                : genericNeighborhoods.includes(program.neighborhood.toLowerCase().trim())
                                  ? 'text-yellow-600'
                                  : 'text-gray-700'
                            }`}
                            onClick={() => {
                              if (program.location_id) {
                                setEditingId(program.location_id);
                                setEditValue(program.neighborhood || '');
                              }
                            }}
                            title="Click to edit"
                          >
                            {program.neighborhood || 'Missing'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {program.location_id && program.address && editingId !== program.location_id && (
                          <button
                            onClick={() => handleAutoDetect(program)}
                            disabled={updatingId === program.location_id}
                            className="px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                          >
                            {updatingId === program.location_id ? 'Detecting...' : 'Auto-Detect'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  {programs.length === 0 ? 'No programs found' : 'No matches for current filters'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
