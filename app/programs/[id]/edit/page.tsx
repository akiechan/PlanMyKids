'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Program, ProgramLocation } from '@/types/database';
import DateInput from '@/components/DateInput';

const DEFAULT_CATEGORIES = [
  'swimming', 'art', 'chess', 'soccer', 'music', 'dance',
  'martial-arts', 'technology', 'academic', 'science', 'creative', 'sports'
];

const LOCAL_STORAGE_KEY = 'planmykids-add-program';


type ProgramWithLocations = Program & {
  program_locations?: ProgramLocation[];
};

export default function EditProgramPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [program, setProgram] = useState<ProgramWithLocations | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: [] as string[],
    description: '',
    price_min: null as number | null,
    price_max: null as number | null,
    price_unit: '',
    provider_name: '',
    provider_website: '',
    contact_email: '',
    contact_phone: '',
    registration_url: '',
    re_enrollment_date: '',
    new_registration_date: '',
    location_address: '',
    location_neighborhood: '',
  });

  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showFeatureModal, setShowFeatureModal] = useState(false);

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

  useEffect(() => {
    fetchProgram();
  }, []);

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

  const fetchProgram = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select(`
          *,
          program_locations(*)
        `)
        .eq('id', programId)
        .single();

      if (error) throw error;

      setProgram(data);

      // Pre-populate form
      setFormData({
        name: data.name || '',
        category: data.category || [],
        description: data.description || '',
        price_min: data.price_min,
        price_max: data.price_max,
        price_unit: data.price_unit || '',
        provider_name: data.provider_name || '',
        provider_website: data.provider_website || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        registration_url: data.registration_url || '',
        re_enrollment_date: data.re_enrollment_date || '',
        new_registration_date: data.new_registration_date || '',
        location_address: data.program_locations?.[0]?.address || '',
        location_neighborhood: data.program_locations?.[0]?.neighborhood || '',
      });
    } catch (err) {
      console.error('Error fetching program:', err);
      setError(err instanceof Error ? err.message : 'Failed to load program');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      category: prev.category.includes(category)
        ? prev.category.filter(c => c !== category)
        : [...prev.category, category]
    }));
  };

  const handleFeatureProgram = () => {
    // Save current form data to localStorage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      formData: {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        neighborhood: formData.location_neighborhood,
        address: formData.location_address,
        provider_name: formData.provider_name,
        provider_website: formData.provider_website,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        price_min: formData.price_min,
        price_max: formData.price_max,
        price_unit: formData.price_unit,
      },
      hasAutoFilled: true,
    }));
    // Navigate to featured page
    router.push('/featured');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Program name is required');
      }
      if (formData.category.length === 0) {
        throw new Error('Please select at least one category');
      }
      if (!submitterEmail.trim()) {
        throw new Error('Your email is required');
      }

      // Prepare edited data
      const editedData: any = {
        ...program,
        name: formData.name,
        category: formData.category,
        description: formData.description,
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
        _location: {
          address: formData.location_address,
          neighborhood: formData.location_neighborhood,
        }
      };

      // Submit edit request
      const { error: submitError } = await supabase
        .from('program_edit_requests')
        .insert([{
          program_id: programId,
          status: 'pending',
          edited_data: editedData,
          submitted_by_email: submitterEmail,
          submitted_by_name: submitterName || null,
          edit_notes: editNotes || null,
        }]);

      if (submitError) throw submitError;

      setSuccess(true);

      // Redirect after short delay
      setTimeout(() => {
        router.push(`/programs/${programId}`);
      }, 2000);

    } catch (err) {
      console.error('Error submitting edit:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit edit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-8 w-1/2 rounded" />
          <div className="bg-gray-200 h-64 w-full rounded" />
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Program Not Found</h1>
        <Link href="/programs" className="text-primary-600 hover:underline">
          ← Back to all programs
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Edit Submitted Successfully!</h2>
          <p className="text-gray-600 mb-4">
            Your edit request has been submitted for admin review. You'll be redirected back to the program page.
          </p>
          <Link href={`/programs/${programId}`} className="text-primary-600 hover:underline">
            Return to program page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      <Link
        href={`/programs/${programId}`}
        className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4 sm:mb-6 min-h-[44px] sm:min-h-0"
      >
        ← Back to program
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Suggest Edit</h1>
      <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
        Submit corrections or updates to this program. Your changes will be reviewed by an admin before being published.
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Basic Information</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Program Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categories * (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {allCategories.map((cat: string) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-4 py-2 sm:px-3 sm:py-1 rounded-full text-sm transition-colors min-h-[44px] sm:min-h-0 ${
                    formData.category.includes(cat)
                      ? 'bg-primary-600 text-white active:bg-primary-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {/* Add custom category */}
              <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                <input
                  type="text"
                  placeholder="Add category..."
                  className="px-3 py-2 sm:px-2 sm:py-1 text-sm border border-gray-300 rounded-full flex-1 sm:w-32 focus:outline-none focus:ring-1 focus:ring-primary-500 min-h-[44px] sm:min-h-0"
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
                  className="px-4 py-2 sm:px-2 sm:py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 active:bg-gray-300 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Pricing</h2>
          <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
            Leave both fields empty if the program is free. Specify the price range and whether it's per month or not.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Price Min ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave empty if free"
                value={formData.price_min || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, price_min: e.target.value ? parseFloat(e.target.value) : null }))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Price Max ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave empty if free"
                value={formData.price_max || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, price_max: e.target.value ? parseFloat(e.target.value) : null }))}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Price Unit (e.g., "per month", "per session", "one-time")
            </label>
            <input
              type="text"
              placeholder="per month"
              value={formData.price_unit}
              onChange={(e) => setFormData(prev => ({ ...prev, price_unit: e.target.value }))}
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Provider Information */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Provider Information</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Provider Name
            </label>
            <input
              type="text"
              value={formData.provider_name}
              onChange={(e) => setFormData(prev => ({ ...prev, provider_name: e.target.value }))}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Website
            </label>
            <input
              type="url"
              placeholder="https://"
              value={formData.provider_website}
              onChange={(e) => setFormData(prev => ({ ...prev, provider_website: e.target.value }))}
              className="input-field w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contact Phone
              </label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Registration URL
            </label>
            <input
              type="url"
              placeholder="https://example.com/register"
              value={formData.registration_url}
              onChange={(e) => setFormData(prev => ({ ...prev, registration_url: e.target.value }))}
              className="input-field w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <DateInput
              label="Re-enrollment Date (Current Students)"
              value={formData.re_enrollment_date}
              onChange={(v) => setFormData(prev => ({ ...prev, re_enrollment_date: v }))}
              size="sm"
              futureMonths={18}
            />
            <DateInput
              label="New Registration Date (New Students)"
              value={formData.new_registration_date}
              onChange={(v) => setFormData(prev => ({ ...prev, new_registration_date: v }))}
              size="sm"
              futureMonths={18}
            />
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Location</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              value={formData.location_address}
              onChange={(e) => setFormData(prev => ({ ...prev, location_address: e.target.value }))}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Neighborhood
            </label>
            <input
              type="text"
              value={formData.location_neighborhood}
              onChange={(e) => setFormData(prev => ({ ...prev, location_neighborhood: e.target.value }))}
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Submitter Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Your Information</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Email * (so we can contact you if needed)
            </label>
            <input
              type="email"
              required
              value={submitterEmail}
              onChange={(e) => setSubmitterEmail(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Name (optional)
            </label>
            <input
              type="text"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What did you change and why? (optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Updated phone number, corrected operating hours..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-none"
          >
            {submitting ? 'Submitting...' : 'Submit Edit Request'}
          </button>
          <Link
            href={`/programs/${programId}`}
            className="btn-secondary text-center order-2 sm:order-none"
          >
            Cancel
          </Link>
        </div>

        {/* Feature Your Program CTA */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl">⭐</span>
              <div>
                <p className="font-medium text-sm sm:text-base text-amber-800">Want more visibility?</p>
                <p className="text-xs sm:text-sm text-amber-700">Feature your program at the top of search results</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFeatureModal(true)}
              className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 active:from-amber-700 active:to-orange-700 transition-all shadow-md text-sm min-h-[44px] sm:min-h-0"
            >
              Feature Your Program
            </button>
          </div>
        </div>
      </form>

      {/* Feature Program Modal */}
      {showFeatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-2xl sm:text-3xl">⭐</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Feature Your Program</h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Your current edits will be saved and used for your featured listing setup.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Program to feature:</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{formData.name || 'Unnamed Program'}</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowFeatureModal(false)}
                className="flex-1 py-3 sm:py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px] sm:min-h-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFeatureProgram}
                className="flex-1 py-3 sm:py-2 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 active:from-amber-700 active:to-orange-700 transition-all min-h-[44px] sm:min-h-0"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
