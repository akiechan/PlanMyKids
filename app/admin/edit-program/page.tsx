'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ScrapedProviderData } from '@/types/scraper';
import HoursPerDayInput from '@/components/HoursPerDayInput';
import DateInput from '@/components/DateInput';
import type { HoursPerDay } from '@/types/database';
import { useAdminLogger } from '@/hooks/useAdminLogger';
import { useRegion } from '@/contexts/RegionContext';
import { useReauthAction } from '@/hooks/useReauthAction';
import { ReauthDialog } from '@/components/ReauthDialog';

interface ExistingProgram {
  id: string;
  name: string;
  provider_name: string;
  is_featured: boolean;
}

interface DeleteInfo {
  warnings: string[];
  relatedData: {
    activeSubscriptions: number;
    reviewCount: number;
    pendingEditRequests: number;
  };
}

export default function AdminAddProgramPage() {
  const router = useRouter();
  const { logAction } = useAdminLogger();
  const { region } = useRegion();
  const { executeWithReauth, needsReauth, reauthMessage, handleReauth, dismissReauth } = useReauthAction();
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scrapedSuccess, setScrapedSuccess] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showSubmitButton, setShowSubmitButton] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  // Edit mode state
  const [mode, setMode] = useState<'add' | 'edit' | 'delete'>('add');
  const [existingPrograms, setExistingPrograms] = useState<ExistingProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingProgram, setLoadingProgram] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const defaultFormData = {
    name: '',
    category: [] as string[],
    description: '',
    neighborhood: '',
    address: '',
    operating_days: [] as string[],
    hours_per_day: {} as HoursPerDay,
    price_min: null as number | null,
    price_max: null as number | null,
    price_unit: 'per class',
    provider_name: '',
    provider_website: '',
    contact_email: '',
    contact_phone: '',
    registration_url: '',
    re_enrollment_date: '',
    new_registration_date: '',
    latitude: region.center_lat,
    longitude: region.center_lng,
    is_featured: false,
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Load existing programs for edit mode
  useEffect(() => {
    const loadPrograms = async () => {
      try {
        const { data, error } = await supabase
          .from('programs')
          .select('id, name, provider_name, is_featured')
          .eq('status', 'active')
          .is('merged_into', null)
          .order('name');

        if (error) throw error;
        setExistingPrograms(data || []);
      } catch (err) {
        console.error('Error loading programs:', err);
      } finally {
        setLoadingPrograms(false);
      }
    };
    loadPrograms();
  }, []);

  // Load selected program data
  const loadProgramData = async (programId: string) => {
    if (!programId) return;

    setLoadingProgram(true);
    setError('');

    try {
      const { data: program, error: programError } = await supabase
        .from('programs')
        .select(`
          *,
          program_locations(*)
        `)
        .eq('id', programId)
        .single();

      if (programError) throw programError;

      const location = program.program_locations?.[0];
      setFormData({
        name: program.name || '',
        category: program.category || [],
        description: program.description || '',
        neighborhood: location?.neighborhood || '',
        address: location?.address || '',
        operating_days: program.operating_days || [],
        hours_per_day: program.hours_per_day || {},
        price_min: program.price_min,
        price_max: program.price_max,
        price_unit: program.price_unit || 'per class',
        provider_name: program.provider_name || '',
        provider_website: program.provider_website || '',
        contact_email: program.contact_email || '',
        contact_phone: program.contact_phone || '',
        registration_url: program.registration_url || '',
        re_enrollment_date: program.re_enrollment_date || '',
        new_registration_date: program.new_registration_date || '',
        latitude: location?.latitude || region.center_lat,
        longitude: location?.longitude || region.center_lng,
        is_featured: program.is_featured || false,
      });

      if (program.provider_website) {
        setScrapeUrl(program.provider_website);
      }
    } catch (err) {
      console.error('Error loading program:', err);
      setError('Failed to load program data');
    } finally {
      setLoadingProgram(false);
    }
  };

  const handleClear = () => {
    setFormData(defaultFormData);
    setScrapeUrl('');
    setScrapedSuccess(false);
    setIsReadOnly(false);
    setShowSubmitButton(true);
    setError('');
    setSelectedProgramId('');
    setMode('add');
  };

  const handleScrape = async () => {
    if (!scrapeUrl) {
      setError('Please enter a website URL');
      return;
    }

    setScraping(true);
    setError('');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: scrapeUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to scrape website');
      }

      const data: ScrapedProviderData = result.data;

      setFormData({
        ...formData,
        name: data.name || formData.name,
        description: data.description || formData.description,
        category: data.category || formData.category,
        address: data.address || formData.address,
        neighborhood: data.neighborhood || formData.neighborhood,
        contact_email: data.contact_email || formData.contact_email,
        contact_phone: data.contact_phone || formData.contact_phone,
        operating_days: data.operating_days || formData.operating_days,
        hours_per_day: data.hours_per_day || formData.hours_per_day,
        price_min: data.price_min ?? formData.price_min,
        price_max: data.price_max ?? formData.price_max,
        price_unit: data.price_unit || formData.price_unit,
        provider_name: data.name || formData.provider_name,
        provider_website: scrapeUrl,
        registration_url: data.registration_url || formData.registration_url,
        re_enrollment_date: data.re_enrollment_date || formData.re_enrollment_date,
        new_registration_date: data.new_registration_date || formData.new_registration_date,
      });

      setScrapedSuccess(true);
      setIsReadOnly(true);
      setShowSubmitButton(false);

      // Auto-geocode if an address was found
      const scrapedAddress = data.address || '';
      if (scrapedAddress && scrapedAddress.length > 5) {
        geocodeAddress(scrapedAddress);
      }

      setTimeout(() => {
        document.getElementById('action-buttons')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err) {
      console.error('Scraping error:', err);
      setError(err instanceof Error ? err.message : 'Failed to scrape website');
    } finally {
      setScraping(false);
    }
  };

  const geocodeAddress = async (address: string) => {
    if (!address || address.length < 5) return;
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const res = await fetch(`/api/google-neighborhood?address=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error('Geocoding failed');
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setFormData(prev => ({
          ...prev,
          latitude: data.latitude,
          longitude: data.longitude,
          neighborhood: data.neighborhood || prev.neighborhood,
          address: data.formatted_address || prev.address,
        }));
        setGeocodeResult(`Resolved: ${data.formatted_address || address}`);
      } else {
        setGeocodeResult('Could not resolve address coordinates');
      }
    } catch {
      setGeocodeResult('Geocoding failed — enter coordinates manually or use Google Enrichment');
    } finally {
      setGeocoding(false);
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.name || !formData.description || formData.category.length === 0) {
      setError('Please fill in all required fields: Program Name, Description, and at least one Category');
      return;
    }

    setSubmitting(true);
    setError('');
    setScrapedSuccess(false);

    try {
      const programData = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        operating_days: formData.operating_days,
        hours_per_day: formData.hours_per_day,
        price_min: formData.price_min,
        price_max: formData.price_max,
        price_unit: formData.price_unit || null,
        provider_name: formData.provider_name,
        provider_website: formData.provider_website || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        registration_url: formData.registration_url || null,
        re_enrollment_date: formData.re_enrollment_date || null,
        new_registration_date: formData.new_registration_date || null,
        is_featured: formData.is_featured,
        status: 'active',
      };

      if (mode === 'edit' && selectedProgramId) {
        // Update existing program
        const { error: programError } = await supabase
          .from('programs')
          .update(programData)
          .eq('id', selectedProgramId);

        if (programError) {
          console.error('Program update error:', programError);
          throw programError;
        }

        // Update location
        const { error: locationError } = await supabase
          .from('program_locations')
          .update({
            address: formData.address,
            neighborhood: formData.neighborhood,
            latitude: formData.latitude,
            longitude: formData.longitude,
          })
          .eq('program_id', selectedProgramId)
          .eq('is_primary', true);

        if (locationError) {
          console.error('Location update error:', locationError);
          throw locationError;
        }

        await logAction({
          action: 'All Programs',
          entityType: 'program',
          entityId: selectedProgramId,
          entityName: formData.name,
          details: { action: 'edited' },
        });
        alert('✅ Program updated successfully!');
      } else {
        // Insert new program
        const { data: insertedProgram, error: programError } = await supabase
          .from('programs')
          .insert([programData])
          .select()
          .single();

        if (programError) {
          console.error('Program insert error:', programError);
          throw programError;
        }

        // Insert the location
        const { error: locationError } = await supabase
          .from('program_locations')
          .insert([
            {
              program_id: insertedProgram.id,
              name: null,
              address: formData.address,
              neighborhood: formData.neighborhood,
              latitude: formData.latitude,
              longitude: formData.longitude,
              is_primary: true,
            },
          ]);

        if (locationError) {
          console.error('Location insert error:', locationError);
          throw locationError;
        }

        // Fetch Google reviews for the new program
        if (insertedProgram) {
          try {
            const reviewResponse = await fetch('/api/google-reviews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ programIds: [insertedProgram.id] }),
            });

            if (reviewResponse.ok) {
              console.log('Google reviews retrieved successfully');
            }
          } catch (reviewErr) {
            console.error('Error fetching Google reviews:', reviewErr);
          }
        }

        await logAction({
          action: 'All Programs',
          entityType: 'program',
          entityId: insertedProgram.id,
          entityName: formData.name,
          details: { action: 'added' },
        });
        alert('✅ Program added successfully and is now live!');
      }

      // Clear server-side camps cache so listing reflects changes immediately
      fetch('/api/admin/clear-cache', { method: 'POST' }).catch(() => {});

      router.push('/admin/edit-program');
    } catch (err) {
      console.error('Error submitting program:', err);
      setError(`Failed to submit program: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDayToggle = (day: string) => {
    setFormData({
      ...formData,
      operating_days: formData.operating_days.includes(day)
        ? formData.operating_days.filter((d) => d !== day)
        : [...formData.operating_days, day],
    });
  };

  const handleDeleteClick = async () => {
    if (!selectedProgramId) {
      setError('Please select a program to delete');
      return;
    }

    setDeleteLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/programs/${selectedProgramId}`);
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
      const response = await executeWithReauth(() => fetch(`/api/admin/programs/${selectedProgramId}`, {
        method: 'DELETE',
      }));
      if (!response) return; // re-auth dialog is showing
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete program');
      }

      await logAction({
        action: 'All Programs',
        entityType: 'program',
        entityId: selectedProgramId,
        entityName: formData.name,
        details: { action: 'removed' },
      });
      alert(`Program "${formData.name}" has been deleted`);
      fetch('/api/admin/clear-cache', { method: 'POST' }).catch(() => {});
      setShowDeleteModal(false);
      setDeleteInfo(null);
      setConfirmText('');
      setSelectedProgramId('');
      setFormData(defaultFormData);
      setMode('add');
      // Reload programs list
      const { data: refreshedPrograms } = await supabase
        .from('programs')
        .select('id, name, provider_name, is_featured')
        .eq('status', 'active')
        .is('merged_into', null)
        .order('name');
      setExistingPrograms(refreshedPrograms || []);
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Link href="/admin" className="btn-secondary text-sm mb-2 inline-block">
            ← Back to Admin
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">
            {mode === 'edit' ? 'Edit Program' : mode === 'delete' ? 'Delete Program' : 'Add New Program'}
          </h1>
        </div>
        {(formData.name || mode === 'edit') && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <span>✕</span> {mode === 'edit' ? 'Start Fresh' : 'Clear Form'}
          </button>
        )}
      </div>
      <p className="text-gray-600 mb-8">
        {mode === 'edit' ? 'Update an existing program.' : mode === 'delete' ? 'Permanently remove a program from the database.' : 'Add a new program directly to the site. Programs added here go live immediately.'}
      </p>

      {/* Add/Edit/Delete Mode Selector */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => { setMode('add'); setSelectedProgramId(''); setFormData(defaultFormData); }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'add'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ➕ Add New
          </button>
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'edit'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ✏️ Edit Existing
          </button>
          <button
            type="button"
            onClick={() => setMode('delete')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'delete'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🗑️ Delete Program
          </button>
        </div>

        {(mode === 'edit' || mode === 'delete') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Program to {mode === 'edit' ? 'Edit' : 'Delete'}
            </label>
            {loadingPrograms ? (
              <p className="text-gray-500">Loading programs...</p>
            ) : (
              <select
                value={selectedProgramId}
                onChange={(e) => {
                  setSelectedProgramId(e.target.value);
                  if (e.target.value) {
                    loadProgramData(e.target.value);
                  } else {
                    setFormData(defaultFormData);
                  }
                }}
                className="input-field w-full"
              >
                <option value="">-- Select a program --</option>
                {existingPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_featured ? '⭐' : ''} ({p.provider_name})
                  </option>
                ))}
              </select>
            )}
            {loadingProgram && (
              <p className="text-sm text-gray-500 mt-2">Loading program data...</p>
            )}

            {/* Delete Button */}
            {mode === 'delete' && selectedProgramId && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm mb-3">
                  <strong>Warning:</strong> Deleting a program is permanent and cannot be undone.
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
            )}
          </div>
        )}
      </div>

      {/* Auto-Fill from Website */}
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-6 mb-8 border-2 border-primary-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">⚡</span>
          Auto-Fill from Website
        </h2>
        <p className="text-gray-700 mb-4">
          Enter a program provider's website URL, and we'll automatically extract program
          information to save you time.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://example.com"
            className="input-field flex-1"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
          />
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {scraping ? 'Auto Filling...' : 'Auto Fill Forms'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {scrapedSuccess && (
        <div id="action-buttons" className="bg-green-50 border-2 border-green-500 text-green-800 p-6 rounded-lg mb-6">
          <div className="flex items-start">
            <span className="text-2xl mr-3">✅</span>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">Data Extracted Successfully!</h3>
              <p className="mb-4">
                The form below has been filled with extracted data. Submit now or review/edit first.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn-primary"
                >
                  Submit Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReadOnly(false);
                    setShowSubmitButton(true);
                    setScrapedSuccess(false);
                  }}
                  className="btn-secondary"
                >
                  Let Me Review First
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Form */}
      <form id="program-form" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-8 space-y-6">
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
              disabled={isReadOnly}
              onClick={() => setFormData({ ...formData, is_featured: !formData.is_featured })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
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

        {/* Program Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Program Name *
          </label>
          <input
            type="text"
            required
            disabled={isReadOnly}
            className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category * (select at least one)
          </label>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat: string) => (
              <button
                key={cat}
                type="button"
                disabled={isReadOnly}
                onClick={() => handleCategoryToggle(cat)}
                className={`px-3 py-1 rounded-full text-sm transition-colors disabled:cursor-not-allowed ${
                  formData.category.includes(cat)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
            {!isReadOnly && (
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
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            required
            disabled={isReadOnly}
            rows={4}
            className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Neighborhood *
            </label>
            <input
              type="text"
              required
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., Mission District"
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                disabled={isReadOnly}
                className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => geocodeAddress(formData.address)}
                  disabled={geocoding || !formData.address}
                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {geocoding ? 'Looking up...' : 'Lookup'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Geocode result + coordinates display */}
        {(geocodeResult || formData.latitude !== region.center_lat || formData.longitude !== region.center_lng) && (
          <div className="flex items-center gap-4 text-xs text-gray-500 -mt-2">
            {geocodeResult && (
              <span className={geocodeResult.startsWith('Resolved') ? 'text-green-600' : 'text-orange-600'}>
                {geocodeResult}
              </span>
            )}
            <span>
              Lat: {formData.latitude.toFixed(6)}, Lng: {formData.longitude.toFixed(6)}
              {formData.latitude === region.center_lat && formData.longitude === region.center_lng && (
                <span className="text-orange-500 ml-1">(default — not geocoded)</span>
              )}
            </span>
          </div>
        )}

        {/* Operating Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Operating Days
          </label>
          <div className="grid grid-cols-7 gap-2">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
              <button
                key={day}
                type="button"
                disabled={isReadOnly}
                onClick={() => handleDayToggle(day)}
                className={`
                  px-3 py-3 rounded-lg text-sm font-semibold
                  transition-all duration-150 ease-in-out
                  border-2 disabled:cursor-not-allowed
                  ${formData.operating_days.includes(day)
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                  }
                `}
              >
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Hours Per Day */}
        <HoursPerDayInput
          selectedDays={formData.operating_days}
          hours={formData.hours_per_day}
          onChange={(hours) => setFormData({ ...formData, hours_per_day: hours })}
          disabled={isReadOnly}
        />

        {/* Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price Min ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="0 for free"
              value={formData.price_min ?? ''}
              onChange={(e) => setFormData({ ...formData, price_min: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price Max ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Leave empty if same as min"
              value={formData.price_max ?? ''}
              onChange={(e) => setFormData({ ...formData, price_max: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price Unit
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., per month, per session"
              value={formData.price_unit}
              onChange={(e) => setFormData({ ...formData, price_unit: e.target.value })}
            />
          </div>
        </div>

        {/* Provider Info */}
        <h3 className="text-xl font-bold text-gray-900 pt-4">Provider Information</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider Name *
          </label>
          <input
            type="text"
            required
            disabled={isReadOnly}
            className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={formData.provider_name}
            onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            type="url"
            disabled={isReadOnly}
            className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            disabled={isReadOnly}
            className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
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

        {/* Submit */}
        {showSubmitButton && mode !== 'delete' && (
          <div className="pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting || formData.category.length === 0 || (mode === 'edit' && !selectedProgramId)}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? (mode === 'edit' ? 'Updating Program...' : 'Adding Program...')
                : (mode === 'edit' ? 'Update Program' : 'Add Program')}
            </button>
            <p className="text-sm text-gray-500 text-center mt-2">
              {mode === 'edit'
                ? 'Changes will be applied immediately.'
                : 'Program will be added as active and immediately visible on the site.'}
            </p>
          </div>
        )}
      </form>

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
                    <div className="text-2xl font-bold text-gray-900">
                      {deleteInfo.relatedData.activeSubscriptions}
                    </div>
                    <div className="text-xs text-gray-500">Active Subscriptions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {deleteInfo.relatedData.reviewCount}
                    </div>
                    <div className="text-xs text-gray-500">Reviews</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {deleteInfo.relatedData.pendingEditRequests}
                    </div>
                    <div className="text-xs text-gray-500">Edit Requests</div>
                  </div>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-bold text-red-600">{formData.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="input-field w-full"
                  placeholder="Type program name here"
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
      <ReauthDialog isOpen={needsReauth} message={reauthMessage} onReauth={handleReauth} onCancel={dismissReauth} />
    </div>
  );
}
