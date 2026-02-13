'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { ScrapedProviderData } from '@/types/scraper';
import DateInput from '@/components/DateInput';
import { useRegion } from '@/contexts/RegionContext';

const SESSION_STORAGE_KEY = 'planmykids-add-program';

export default function AddProviderPage() {
  const router = useRouter();
  const { region } = useRegion();
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scrapedSuccess, setScrapedSuccess] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showSubmitButton, setShowSubmitButton] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lookingUpNeighborhood, setLookingUpNeighborhood] = useState(false);

  const defaultFormData = {
    name: '',
    category: [] as string[],
    description: '',
    neighborhood: '',
    address: '',
    price_min: null as number | null,
    price_max: null as number | null,
    price_unit: 'per class',
    website: '',
    contact_email: '',
    contact_phone: '',
    registration_url: '',
    re_enrollment_date: '',
    new_registration_date: '',
    // Location data (defaults from region)
    latitude: region.center_lat,
    longitude: region.center_lng,
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Load form data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) setFormData(parsed.formData);
        if (parsed.hasAutoFilled) setHasAutoFilled(parsed.hasAutoFilled);
        if (parsed.scrapeUrl) setScrapeUrl(parsed.scrapeUrl);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
    setIsInitialized(true);
  }, []);

  // Save form data to localStorage whenever it changes (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        formData,
        hasAutoFilled,
        scrapeUrl,
      }));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, [formData, hasAutoFilled, scrapeUrl, isInitialized]);

  // Clear all form data
  const handleClear = () => {
    setFormData(defaultFormData);
    setScrapeUrl('');
    setHasAutoFilled(false);
    setScrapedSuccess(false);
    setIsReadOnly(false);
    setShowSubmitButton(true);
    setError('');
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const handleScrape = async () => {
    if (!scrapeUrl) {
      setError('Please enter a website URL');
      return;
    }

    setScraping(true);
    setError('');

    try {
      // Use Playwright scraper
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

      // Pre-fill form with scraped data
      setFormData({
        ...formData,
        name: data.name || formData.name,
        description: data.description || formData.description,
        category: data.category || formData.category,
        address: data.address || formData.address,
        neighborhood: data.neighborhood || formData.neighborhood,
        contact_email: data.contact_email || formData.contact_email,
        contact_phone: data.contact_phone || formData.contact_phone,
        price_min: data.price_min ?? formData.price_min,
        price_max: data.price_max ?? formData.price_max,
        price_unit: data.price_unit || formData.price_unit,
        website: scrapeUrl,
        registration_url: data.registration_url || formData.registration_url,
        re_enrollment_date: data.re_enrollment_date || formData.re_enrollment_date,
        new_registration_date: data.new_registration_date || formData.new_registration_date,
      });

      setScrapedSuccess(true);
      setIsReadOnly(true);
      setShowSubmitButton(false);
      setHasAutoFilled(true);
      // Scroll to action buttons
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

  const lookupNeighborhood = async (address: string) => {
    if (!address || address.trim().length < 5) return;
    setLookingUpNeighborhood(true);
    try {
      const res = await fetch(`/api/google-neighborhood?address=${encodeURIComponent(address)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.neighborhood) {
        setFormData(prev => ({
          ...prev,
          neighborhood: data.neighborhood,
          latitude: data.latitude ?? prev.latitude,
          longitude: data.longitude ?? prev.longitude,
        }));
      }
    } catch (e) {
      console.error('Neighborhood lookup failed:', e);
    } finally {
      setLookingUpNeighborhood(false);
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

  const checkDuplicates = async () => {
    try {
      // Get all active programs (not merged)
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('status', 'active')
        .is('merged_into', null);

      if (error) throw error;

      const programNameLower = formData.name.toLowerCase().trim();

      // Multi-factor duplicate detection based on name and category
      const potentialDuplicates = (data || []).filter((program) => {
        const existingNameLower = program.name.toLowerCase().trim();
        const nameSimilarity = calculateSimilarity(programNameLower, existingNameLower);

        // Check category overlap
        const programCategories = new Set<string>(program.category || []);
        const formCategories = new Set<string>(formData.category || []);
        const categoryOverlap = [...programCategories].filter((c: string) => formCategories.has(c)).length;
        const categoryScore = categoryOverlap > 0 ? categoryOverlap / Math.max(programCategories.size, formCategories.size) : 0;

        // Check for common prefix
        const words1 = existingNameLower.split(/\s+/);
        const words2 = programNameLower.split(/\s+/);
        let commonPrefixWords = 0;
        for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
          if (words1[i] === words2[i]) {
            commonPrefixWords++;
          } else {
            break;
          }
        }
        const commonPrefix = words1.slice(0, commonPrefixWords).join(' ');
        const hasSignificantPrefix = commonPrefixWords >= 3 || commonPrefix.length >= 15;

        // Check containment
        const shorterName = programNameLower.length < existingNameLower.length ? programNameLower : existingNameLower;
        const longerName = programNameLower.length < existingNameLower.length ? existingNameLower : programNameLower;
        const containsMatch = longerName.includes(shorterName) || longerName.startsWith(shorterName);

        // Duplicate detection logic
        if (hasSignificantPrefix) return true;
        if (containsMatch && shorterName.length >= 10) {
          if (shorterName.length >= 15) return true;
          if (categoryScore > 0.3) return true;
        }
        if (nameSimilarity > 0.65 && categoryScore > 0.3) return true;
        if (nameSimilarity > 0.75) return true;

        return false;
      });

      return potentialDuplicates;
    } catch (err) {
      console.error('Error checking duplicates:', err);
      return [];
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validation
    if (!formData.name || !formData.description || formData.category.length === 0) {
      setError('Please fill in all required fields: Program Name, Description, and at least one Category');
      return;
    }

    setSubmitting(true);
    setError('');
    setScrapedSuccess(false);

    try {
      // Check for duplicates before submitting
      console.log('Checking for duplicates...');
      const foundDuplicates = await checkDuplicates();

      if (foundDuplicates.length > 0) {
        console.log(`Found ${foundDuplicates.length} potential duplicates`);
        setDuplicates(foundDuplicates);
        setShowDuplicates(true);
        setSubmitting(false);
        return;
      }

      console.log('No duplicates found, proceeding with submission');
      await submitProgram();
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit program');
      setSubmitting(false);
    }
  };

  const submitProgram = async (forcePending = false) => {
    try {
      console.log('Submitting program data:', formData);

      // Determine status: scraped data = 'active', manual data = 'pending'
      // If forcePending is true (duplicates found), always use 'pending'
      const status = forcePending ? 'pending' : (isReadOnly ? 'active' : 'pending');

      // First, insert the program
      const { data: insertedProgram, error: programError } = await supabase
        .from('programs')
        .insert([
          {
            name: formData.name,
            category: formData.category,
            description: formData.description,
            price_min: formData.price_min,
            price_max: formData.price_max,
            price_unit: formData.price_unit || null,
            website: formData.website || null,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            registration_url: formData.registration_url || null,
            re_enrollment_date: formData.re_enrollment_date || null,
            new_registration_date: formData.new_registration_date || null,
            status: status,
          },
        ])
        .select()
        .single();

      if (programError) {
        console.error('Program insert error:', programError);
        throw programError;
      }

      console.log('Program inserted:', insertedProgram);

      // Then, insert the location
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

      console.log('Location inserted successfully');

      // If this was a scraped submission (isReadOnly = true), fetch Google reviews
      if (isReadOnly && insertedProgram) {
        try {
          console.log('Fetching Google reviews for program:', insertedProgram.id);
          const reviewResponse = await fetch('/api/google-reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ programIds: [insertedProgram.id] }),
          });

          const reviewResult = await reviewResponse.json();

          if (reviewResponse.ok) {
            console.log('Google reviews retrieved successfully:', reviewResult);
          } else {
            console.error('Failed to retrieve Google reviews:', reviewResult.error);
            // Don't fail the whole submission if reviews fail
          }
        } catch (reviewErr) {
          console.error('Error fetching Google reviews:', reviewErr);
          // Don't fail the whole submission if reviews fail
        }
      }

      // Clear localStorage after successful submission
      localStorage.removeItem(SESSION_STORAGE_KEY);

      // Show success and redirect
      if (status === 'pending') {
        alert('✅ Program submitted successfully! It will appear on the site after admin review.');
      } else {
        alert('✅ Program submitted successfully and is now live!');
      }
      router.push('/');
    } catch (err) {
      console.error('Error submitting program:', err);
      setError(`Failed to submit program: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      <div className="flex justify-between items-start mb-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Add a New Program</h1>
        {(hasAutoFilled || formData.name) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-red-600 active:text-red-700 flex items-center gap-1 transition-colors min-h-[44px] sm:min-h-0 px-2"
          >
            <span>✕</span> Clear Form
          </button>
        )}
      </div>
      <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
        Help us grow the community by adding a new enrichment program! You can paste a
        website URL and we'll use AI to extract the information automatically.
      </p>

      {/* Auto-Fill from Website */}
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-primary-200">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center">
          <span className="mr-2">⚡</span>
          Auto-Fill from Website
        </h2>
        <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
          Enter a program provider's website URL, and we'll automatically extract program
          information to save you time.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
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
        <div id="action-buttons" className="bg-green-50 border-2 border-green-500 text-green-800 p-4 sm:p-6 rounded-lg mb-6">
          <div className="flex items-start">
            <span className="text-xl sm:text-2xl mr-2 sm:mr-3">✅</span>
            <div className="flex-1">
              <h3 className="font-bold text-base sm:text-lg mb-2">Data Extracted Successfully!</h3>
              <p className="text-sm sm:text-base mb-3 sm:mb-4">
                The form below has been filled with extracted data. Submit now or review/edit first.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn-primary w-full sm:w-auto"
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
                  className="btn-secondary w-full sm:w-auto"
                >
                  Let Me Review First
                </button>
                <Link
                  href="/featured"
                  className="px-4 py-3 sm:py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 active:from-amber-700 active:to-orange-700 transition-all shadow-md text-center flex items-center justify-center gap-1 min-h-[44px] sm:min-h-0"
                >
                  <span>⭐</span> Feature Your Program
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Form */}
      <form id="program-form" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Program Details</h2>

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
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {allCategories.map((cat: string) => (
              <button
                key={cat}
                type="button"
                disabled={isReadOnly}
                onClick={() => handleCategoryToggle(cat)}
                className={`px-4 py-2 sm:px-3 sm:py-1 rounded-full text-sm transition-colors disabled:cursor-not-allowed min-h-[44px] sm:min-h-0 ${
                  formData.category.includes(cat)
                    ? 'bg-primary-600 text-white active:bg-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
              >
                {cat}
              </button>
            ))}
            {/* Add custom category */}
            {!isReadOnly && (
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
              Address *
            </label>
            <input
              type="text"
              required
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., 123 Main St, San Francisco, CA"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              onBlur={(e) => {
                if (e.target.value && !formData.neighborhood) {
                  lookupNeighborhood(e.target.value);
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Neighborhood *
              {lookingUpNeighborhood && (
                <span className="ml-2 text-xs text-gray-400 font-normal">Looking up...</span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                disabled={isReadOnly}
                className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g., Mission District"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
              />
              {!isReadOnly && formData.address && !lookingUpNeighborhood && (
                <button
                  type="button"
                  onClick={() => lookupNeighborhood(formData.address)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  title="Auto-detect from address"
                >
                  Detect
                </button>
              )}
            </div>
          </div>
        </div>

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

        {/* Contact Info */}
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 pt-3 sm:pt-4">Contact Information</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            type="url"
            disabled={isReadOnly}
            className="input-field w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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
        {showSubmitButton && (
          <div className="pt-4 sm:pt-6 border-t border-gray-200">
            <div className={hasAutoFilled ? "flex flex-col sm:flex-row gap-2 sm:gap-3" : ""}>
              <button
                type="submit"
                disabled={submitting || formData.category.length === 0}
                className={`btn-primary disabled:opacity-50 disabled:cursor-not-allowed ${hasAutoFilled ? 'flex-1' : 'w-full'}`}
              >
                {submitting ? 'Submitting...' : 'Submit Program'}
              </button>
              {hasAutoFilled && (
                <Link
                  href="/featured"
                  className="px-4 py-3 sm:py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 active:from-amber-700 active:to-orange-700 transition-all shadow-md text-center flex items-center justify-center gap-1 min-h-[44px] sm:min-h-0"
                >
                  <span>⭐</span> Feature Your Program
                </Link>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 text-center mt-2">
              {isReadOnly
                ? 'This scraped data will be submitted as active (immediately visible).'
                : 'Your submission will be reviewed by an admin before appearing on the site.'}
            </p>
          </div>
        )}
      </form>

      {/* Duplicate Detection Modal */}
      {showDuplicates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">⚠️ Potential Duplicates Found</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                We found {duplicates.length} program(s) that might be similar to what you're submitting.
                Would you like to edit one of these existing programs instead?
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-3">
                {duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{dup.name}</h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{dup.description}</p>
                        <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-500">
                          <span>Provider: {dup.provider_name}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>Categories: {dup.category.join(', ')}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/programs/${dup.id}/edit`)}
                        className="w-full sm:w-auto sm:ml-4 px-4 py-3 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors whitespace-nowrap min-h-[44px] sm:min-h-0"
                      >
                        Edit This Program
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <button
                  onClick={() => {
                    setShowDuplicates(false);
                    setDuplicates([]);
                    setSubmitting(false);
                  }}
                  className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors min-h-[44px] sm:min-h-0"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowDuplicates(false);
                    // Submit as pending since it's potentially a duplicate
                    await submitProgram(true);
                  }}
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 active:bg-yellow-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
                >
                  Submit as New Program Anyway
                </button>
              </div>
              <p className="text-xs text-gray-500 text-center sm:text-right mt-2">
                Note: Submitting anyway will send your program to the review queue for admin approval
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
