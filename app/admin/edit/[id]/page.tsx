'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Program } from '@/types/database';
import Link from 'next/link';
import { useAdminLogger } from '@/hooks/useAdminLogger';
import DateInput from '@/components/DateInput';
import { DateRangePicker } from '@/components/DateInput';
import { useRegion } from '@/contexts/RegionContext';

interface DeleteInfo {
  warnings: string[];
  relatedData: {
    activeSubscriptions: number;
    reviewCount: number;
    pendingEditRequests: number;
  };
}

export default function EditProgramPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { logAction } = useAdminLogger();
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: [] as string[],
    description: '',
    neighborhood: '',
    address: '',
    age_min: 0,
    age_max: 18,
    age_description: '',
    provider_website: '',
    contact_email: '',
    contact_phone: '',
    registration_url: '',
    re_enrollment_date: '',
    new_registration_date: '',
    latitude: region.center_lat,
    longitude: region.center_lng,
    is_featured: false,
    // Camp-specific fields
    program_type: 'program' as 'program' | 'camp',
    camp_season: '' as string,
    camp_days_format: '' as string,
    hours_start: '',
    hours_end: '',
    start_date: '',
    end_date: '',
    price_min: null as number | null,
    price_max: null as number | null,
    price_unit: '',
    // Before/After Care
    before_care: false,
    before_care_start: '',
    after_care: false,
    after_care_end: '',
  });

  useEffect(() => {
    fetchProgram();
  }, [params.id]);

  const fetchProgram = async () => {
    try {
      const { data: program, error: fetchError } = await supabase
        .from('programs')
        .select(`
          *,
          locations:program_locations(*)
        `)
        .eq('id', params.id)
        .single();

      if (fetchError) throw fetchError;

      if (program) {
        const location = program.locations?.[0];
        setFormData({
          name: program.name || '',
          category: program.category || [],
          description: program.description || '',
          neighborhood: location?.neighborhood || '',
          address: location?.address || '',
          age_min: program.age_min ?? 0,
          age_max: program.age_max ?? 18,
          age_description: program.age_description || '',
          provider_website: program.provider_website || '',
          contact_email: program.contact_email || '',
          contact_phone: program.contact_phone || '',
          registration_url: program.registration_url || '',
          re_enrollment_date: program.re_enrollment_date || '',
          new_registration_date: program.new_registration_date || '',
          latitude: location?.latitude || region.center_lat,
          longitude: location?.longitude || region.center_lng,
          is_featured: program.is_featured || false,
          // Camp-specific fields
          program_type: program.program_type || 'program',
          camp_season: program.camp_season || '',
          camp_days_format: program.camp_days_format || '',
          hours_start: program.hours_start || '',
          hours_end: program.hours_end || '',
          start_date: program.start_date || '',
          end_date: program.end_date || '',
          price_min: program.price_min ?? null,
          price_max: program.price_max ?? null,
          price_unit: program.price_unit || '',
          // Before/After Care
          before_care: program.before_care || false,
          before_care_start: program.before_care_start || '',
          after_care: program.after_care || false,
          after_care_end: program.after_care_end || '',
        });
      }
    } catch (err) {
      console.error('Error fetching program:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch program');
    } finally {
      setLoading(false);
    }
  };

  // Save and Approve function
  const handleSaveAndApprove = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Update program via API route (uses service role key to bypass RLS)
      const response = await fetch(`/api/admin/programs/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programData: {
            name: formData.name,
            category: formData.category,
            description: formData.description,
            age_min: formData.age_min,
            age_max: formData.age_max,
            age_description: formData.age_description || null,
            provider_website: formData.provider_website || null,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            registration_url: formData.registration_url || null,
            re_enrollment_date: formData.re_enrollment_date || null,
            new_registration_date: formData.new_registration_date || null,
            is_featured: formData.is_featured,
            status: 'active', // Approve the program
            // Camp-specific fields
            program_type: formData.program_type,
            camp_season: formData.program_type === 'camp' ? (formData.camp_season || null) : null,
            camp_days_format: formData.program_type === 'camp' ? (formData.camp_days_format || null) : null,
            hours_start: formData.hours_start || null,
            hours_end: formData.hours_end || null,
            start_date: formData.program_type === 'camp' ? (formData.start_date || null) : null,
            end_date: formData.program_type === 'camp' ? (formData.end_date || null) : null,
            price_min: formData.price_min,
            price_max: formData.price_max,
            price_unit: formData.price_unit || null,
            // Before/After Care
            before_care: formData.before_care,
            before_care_start: formData.before_care ? (formData.before_care_start || null) : null,
            after_care: formData.after_care,
            after_care_end: formData.after_care ? (formData.after_care_end || null) : null,
          },
          locationData: {
            address: formData.address,
            neighborhood: formData.neighborhood,
            latitude: formData.latitude,
            longitude: formData.longitude,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save program');
      }

      // Log the action
      await logAction({
        action: 'All Programs',
        entityType: 'program',
        entityId: params.id,
        entityName: formData.name,
        details: { action: 'approved', program_type: formData.program_type },
      });

      router.push('/admin/review');
    } catch (err) {
      console.error('Save error:', err);
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setFormData({
      ...formData,
      category: formData.category.includes(category)
        ? formData.category.filter((c) => c !== category)
        : [...formData.category, category],
    });
  };

  const handleDeleteClick = async () => {
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/admin/programs/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check program');
      }

      setDeleteInfo(data);
      setShowDeleteModal(true);
    } catch (err) {
      console.error('Error checking program:', err);
      setError(err instanceof Error ? err.message : 'Failed to check program');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (confirmText !== formData.name) {
      setError('Please type the program name exactly to confirm deletion');
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/admin/programs/${params.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete program');
      }

      // Log the delete action
      await logAction({
        action: 'All Programs',
        entityType: 'program',
        entityId: params.id,
        entityName: formData.name,
        details: {
          action: 'removed',
          program_type: formData.program_type,
        },
      });

      alert(`Program "${formData.name}" has been deleted`);
      router.push('/admin/review');
    } catch (err) {
      console.error('Error deleting program:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete program');
    } finally {
      setDeleteLoading(false);
    }
  };

  const DEFAULT_CATEGORIES = [
    'swimming', 'art', 'chess', 'soccer', 'music', 'dance',
    'martial-arts', 'technology', 'academic', 'science', 'creative', 'sports'
  ];

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');

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

  const allCategories = [...DEFAULT_CATEGORIES, ...dbCategories, ...customCategories].filter(
    (cat, idx, arr) => arr.indexOf(cat) === idx
  );

  const addCustomCategory = () => {
    const trimmed = newCategoryInput.trim().toLowerCase();
    if (trimmed && !allCategories.includes(trimmed)) {
      setCustomCategories([...customCategories, trimmed]);
      setNewCategoryInput('');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
        <p className="mt-2 text-gray-600">Loading program...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Edit Program</h1>
          <p className="text-gray-600">
            Make changes to the program details.{' '}
            <Link href="/admin/review" className="text-primary-600 hover:underline">
              Back to Review
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

      <div className="bg-white rounded-xl shadow-md p-8 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Program Details</h2>

        {/* Featured Toggle */}
        <div className={`p-4 rounded-lg border-2 ${formData.is_featured ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-gray-200'}`}>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{formData.is_featured ? '⭐' : '☆'}</span>
              <div>
                <p className="font-semibold text-gray-900">Featured Program</p>
                <p className="text-sm text-gray-600">
                  {formData.is_featured
                    ? 'This program appears at the top with special styling'
                    : 'Enable to show at top of search results'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_featured: !formData.is_featured })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_featured ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_featured ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>

        {/* Program Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type *
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, program_type: 'program' })}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                formData.program_type === 'program'
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl mb-1">📚</span>
              <p className="font-semibold">Program</p>
              <p className="text-xs text-gray-500">Ongoing classes & activities</p>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, program_type: 'camp', camp_season: formData.camp_season || 'summer' })}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                formData.program_type === 'camp'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl mb-1">🏕️</span>
              <p className="font-semibold">Camp</p>
              <p className="text-xs text-gray-500">Seasonal camps & breaks</p>
            </button>
          </div>
        </div>

        {/* Camp-Specific Fields */}
        {formData.program_type === 'camp' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-green-800 flex items-center gap-2">
              <span>🏕️</span> Camp Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Season */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Season *
                </label>
                <select
                  className="input-field w-full"
                  value={formData.camp_season}
                  onChange={(e) => setFormData({ ...formData, camp_season: e.target.value })}
                >
                  <option value="summer">☀️ Summer</option>
                  <option value="spring">🌸 Spring Break</option>
                  <option value="fall">🍂 Fall Break</option>
                  <option value="winter">❄️ Winter Break</option>
                </select>
              </div>

              {/* Days Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Days Format
                </label>
                <select
                  className="input-field w-full"
                  value={formData.camp_days_format}
                  onChange={(e) => setFormData({ ...formData, camp_days_format: e.target.value })}
                >
                  <option value="">Not specified</option>
                  <option value="weekly">📅 Week-by-Week</option>
                  <option value="daily">📆 Daily Drop-in</option>
                </select>
              </div>
            </div>

            {/* Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  className="input-field w-full"
                  value={formData.hours_start}
                  onChange={(e) => setFormData({ ...formData, hours_start: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  className="input-field w-full"
                  value={formData.hours_end}
                  onChange={(e) => setFormData({ ...formData, hours_end: e.target.value })}
                />
              </div>
            </div>

            {/* Camp Dates */}
            <DateRangePicker
              startValue={formData.start_date}
              endValue={formData.end_date}
              onStartChange={(v) => setFormData({ ...formData, start_date: v })}
              onEndChange={(v) => setFormData({ ...formData, end_date: v })}
              startLabel="Start Date"
              endLabel="End Date"
            />

            {/* Before/After Care */}
            <div className="border-t border-green-200 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-green-700 mb-3">Extended Care Options</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before Care */}
                <div className={`p-3 rounded-lg border ${formData.before_care ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={formData.before_care}
                      onChange={(e) => setFormData({ ...formData, before_care: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-700">Before Care</span>
                  </label>
                  {formData.before_care && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Starts at:</label>
                      <input
                        type="time"
                        className="input-field w-full text-sm"
                        value={formData.before_care_start}
                        onChange={(e) => setFormData({ ...formData, before_care_start: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                {/* After Care */}
                <div className={`p-3 rounded-lg border ${formData.after_care ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={formData.after_care}
                      onChange={(e) => setFormData({ ...formData, after_care: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="font-medium text-gray-700">After Care</span>
                  </label>
                  {formData.after_care && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ends at:</label>
                      <input
                        type="time"
                        className="input-field w-full text-sm"
                        value={formData.after_care_end}
                        onChange={(e) => setFormData({ ...formData, after_care_end: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pricing
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-field w-full"
                placeholder="0"
                value={formData.price_min ?? ''}
                onChange={(e) => setFormData({ ...formData, price_min: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-field w-full"
                placeholder="0"
                value={formData.price_max ?? ''}
                onChange={(e) => setFormData({ ...formData, price_max: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Price Unit</label>
              <select
                className="input-field w-full"
                value={formData.price_unit}
                onChange={(e) => setFormData({ ...formData, price_unit: e.target.value })}
              >
                <option value="">Select...</option>
                <option value="/week">/week</option>
                <option value="/day">/day</option>
                <option value="/month">/month</option>
                <option value="/session">/session</option>
                <option value="/class">/class</option>
              </select>
            </div>
          </div>
        </div>

        {/* Program Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {formData.program_type === 'camp' ? 'Camp' : 'Program'} Name
          </label>
          <input
            type="text"
            className="input-field w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat: string) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryToggle(cat)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  formData.category.includes(cat)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
            {/* Add custom category */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Add category..."
                className="px-2 py-1 text-sm border border-gray-300 rounded-full w-32 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomCategory();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomCategory}
                className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={4}
            className="input-field w-full"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Neighborhood
            </label>
            <input
              type="text"
              className="input-field w-full"
              placeholder="e.g., Mission District"
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              className="input-field w-full"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
        </div>

        {/* Age Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Age
            </label>
            <input
              type="number"
              min="0"
              max="18"
              className="input-field w-full"
              value={formData.age_min}
              onChange={(e) => setFormData({ ...formData, age_min: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Age
            </label>
            <input
              type="number"
              min="0"
              max="18"
              className="input-field w-full"
              value={formData.age_max}
              onChange={(e) => setFormData({ ...formData, age_max: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age Description
            </label>
            <input
              type="text"
              className="input-field w-full"
              placeholder="e.g., K-6th grade"
              value={formData.age_description}
              onChange={(e) => setFormData({ ...formData, age_description: e.target.value })}
            />
          </div>
        </div>

        {/* Provider Info */}
        <h3 className="text-xl font-bold text-gray-900 pt-4">Provider Information</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            type="url"
            className="input-field w-full"
            value={formData.provider_website}
            onChange={(e) => setFormData({ ...formData, provider_website: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              className="input-field w-full"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Phone
            </label>
            <input
              type="tel"
              className="input-field w-full"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            />
          </div>
        </div>

        {/* Registration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Registration URL
          </label>
          <input
            type="url"
            className="input-field w-full"
            placeholder="https://example.com/register"
            value={formData.registration_url}
            onChange={(e) => setFormData({ ...formData, registration_url: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DateInput
            label="Re-enrollment Date (Current Students)"
            value={formData.re_enrollment_date}
            onChange={(v) => setFormData({ ...formData, re_enrollment_date: v })}
            size="sm"
            futureMonths={18}
          />
          <DateInput
            label="New Registration Date (New Students)"
            value={formData.new_registration_date}
            onChange={(v) => setFormData({ ...formData, new_registration_date: v })}
            size="sm"
            futureMonths={18}
          />
        </div>

        {/* Actions */}
        <div className="pt-6 border-t border-gray-200 flex items-center justify-between gap-4">
          <Link
            href="/admin/review"
            className="btn-secondary"
          >
            ← Cancel
          </Link>
          <button
            type="button"
            onClick={handleSaveAndApprove}
            disabled={submitting}
            className="btn-primary px-6 py-3 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Saving...
              </>
            ) : (
              <>✓ Save and Approve</>
            )}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <h3 className="text-xl font-bold text-red-800 mb-2">Danger Zone</h3>
        <p className="text-red-700 text-sm mb-4">
          Deleting a program is permanent and cannot be undone. All associated reviews and data will be removed.
        </p>
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={deleteLoading}
          className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {deleteLoading ? 'Checking...' : 'Delete This Program'}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Delete Program</h2>
                  <p className="text-gray-600 text-sm">This action cannot be undone</p>
                </div>
              </div>

              {/* Warnings */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-amber-800 mb-2">Warnings:</h4>
                <ul className="space-y-2">
                  {deleteInfo.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="mt-0.5">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Related Data Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-700 mb-2">Related Data:</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{deleteInfo.relatedData.reviewCount}</p>
                    <p className="text-xs text-gray-600">Reviews</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{deleteInfo.relatedData.activeSubscriptions}</p>
                    <p className="text-xs text-gray-600">Subscriptions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{deleteInfo.relatedData.pendingEditRequests}</p>
                    <p className="text-xs text-gray-600">Edit Requests</p>
                  </div>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-bold text-red-600">{formData.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Enter program name"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading || confirmText !== formData.name}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteInfo(null);
                    setConfirmText('');
                  }}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
