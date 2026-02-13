'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAdminLogger } from '@/hooks/useAdminLogger';

interface Program {
  id: string;
  name: string;
  provider_name: string;
  provider_website: string | null;
  category: string[];
  status: string;
  is_featured: boolean;
  google_rating: number | null;
  google_review_count: number;
  updated_at: string;
  created_at: string;
  program_type: 'program' | 'camp' | 'birthday_venue';
}

const PROGRAM_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  program: { label: 'Program', emoji: '📚', color: 'bg-blue-100 text-blue-700' },
  camp: { label: 'Camp', emoji: '🏕️', color: 'bg-amber-100 text-amber-700' },
  birthday_venue: { label: 'Birthday', emoji: '🎂', color: 'bg-pink-100 text-pink-700' },
};

const DEFAULT_CATEGORIES = [
  'swimming', 'art', 'chess', 'soccer', 'music', 'dance',
  'martial-arts', 'technology', 'academic', 'science', 'creative', 'sports'
];

type SortField = 'name' | 'updated_at' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function AdminProgramsPage() {
  const { logAction } = useAdminLogger();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [programTypeFilter, setProgramTypeFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchPrograms();
  }, [statusFilter, programTypeFilter]);

  // Fetch unique categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from('programs')
          .select('category');

        if (data) {
          const allCats = data.flatMap(p => p.category || []);
          const uniqueCats = [...new Set(allCats)].filter(Boolean);
          const newCats = uniqueCats.filter(c => !DEFAULT_CATEGORIES.includes(c.toLowerCase()));
          setDbCategories(newCats);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('programs')
        .select('id, name, provider_name, provider_website, category, status, is_featured, google_rating, google_review_count, updated_at, created_at, program_type')
        .is('merged_into', null);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (programTypeFilter) {
        query = query.eq('program_type', programTypeFilter);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      setPrograms(data || []);
    } catch (err) {
      console.error('Error fetching programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (program: Program) => {
    const warningMessage = program.is_featured
      ? `⚠️ WARNING: "${program.name}" is a FEATURED PROGRAM!\n\nThis program is highlighted to users on the homepage. Deleting it will remove it from featured listings immediately.\n\nAre you sure you want to delete this featured program?\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${program.name}"?\n\nThis action cannot be undone.`;

    if (!confirm(warningMessage)) {
      return;
    }

    setDeleting(program.id);
    try {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', program.id);

      if (error) throw error;

      // Log the delete action
      await logAction({
        action: 'All Programs',
        entityType: 'program',
        entityId: program.id,
        entityName: program.name,
        details: { action: 'removed', program_type: program.program_type },
      });

      setPrograms(prev => prev.filter(p => p.id !== program.id));
      alert('Program deleted successfully');
    } catch (err) {
      console.error('Error deleting program:', err);
      alert('Failed to delete program');
    } finally {
      setDeleting(null);
    }
  };

  // Filter and sort programs
  const filteredPrograms = programs
    .filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(query) &&
            !p.provider_name.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (categoryFilter && !p.category.includes(categoryFilter)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      } else if (sortField === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Programs</h1>
          <p className="text-gray-600 mt-2">
            View, edit, and manage all programs in the database
          </p>
        </div>
        <Link href="/admin" className="btn-secondary">
          ← Back to Admin
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Type:</label>
            <select
              value={programTypeFilter}
              onChange={(e) => setProgramTypeFilter(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All Types</option>
              <option value="program">📚 Programs</option>
              <option value="camp">🏕️ Camps</option>
              <option value="birthday_venue">🎂 Birthday Venues</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All Categories</option>
              {[...DEFAULT_CATEGORIES, ...dbCategories].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort:</label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="input-field text-sm py-2"
            >
              <option value="updated_at">Last Updated</option>
              <option value="created_at">Created Date</option>
              <option value="name">Name</option>
            </select>
            <button
              onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredPrograms.length} of {programs.length} programs
        </div>
      </div>

      {/* Programs Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Program</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Categories</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Rating</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Updated</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPrograms.map(program => (
                <tr key={program.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {program.is_featured && (
                        <span className="text-amber-500" title="Featured">⭐</span>
                      )}
                      <div>
                        <Link
                          href={`/programs/${program.id}`}
                          className="font-medium text-gray-900 hover:text-primary-600"
                        >
                          {program.name}
                        </Link>
                        <div className="text-sm text-gray-500">{program.provider_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const typeInfo = PROGRAM_TYPE_LABELS[program.program_type] || PROGRAM_TYPE_LABELS.program;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${typeInfo.color}`}>
                          <span>{typeInfo.emoji}</span>
                          <span>{typeInfo.label}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {program.category.slice(0, 2).map(cat => (
                        <span key={cat} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {cat}
                        </span>
                      ))}
                      {program.category.length > 2 && (
                        <span className="text-xs text-gray-400">+{program.category.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      program.status === 'active' ? 'bg-green-100 text-green-800' :
                      program.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {program.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {program.google_rating ? (
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-medium">{program.google_rating}</span>
                        <span className="text-gray-500 text-xs">({program.google_review_count})</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {new Date(program.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/edit/${program.id}`}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/programs/${program.id}`}
                        target="_blank"
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(program)}
                        disabled={deleting === program.id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        {deleting === program.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPrograms.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No programs found matching your filters
          </div>
        )}
      </div>
    </div>
  );
}
