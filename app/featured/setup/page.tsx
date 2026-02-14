'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Program } from '@/types/database';
import type { PlanType } from '@/types/featured';

const SESSION_STORAGE_KEY = 'planmykids-add-program';

interface ProgramFormData {
  name: string;
  description: string;
  category: string[];
  neighborhood: string;
  address: string;
  website: string;
  contact_email: string;
  contact_phone: string;
}

function FeaturedSetupContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Program selection state
  const [existingPrograms, setExistingPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [isNewProgram, setIsNewProgram] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);

  // Form state
  const [programData, setProgramData] = useState<ProgramFormData>({
    name: '',
    description: '',
    category: [],
    neighborhood: '',
    address: '',
    website: '',
    contact_email: '',
    contact_phone: '',
  });

  // Subscription contact (for billing)
  const [subscriptionContactName, setSubscriptionContactName] = useState('');
  const [subscriptionContactEmail, setSubscriptionContactEmail] = useState('');
  const [subscriptionContactPhone, setSubscriptionContactPhone] = useState('');
  const [sameAsProgram, setSameAsProgram] = useState(true);
  const [hasExistingContactInfo, setHasExistingContactInfo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [planType, setPlanType] = useState<PlanType>('free_trial');

  // Program search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Load existing programs and check for localStorage data
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoadingPrograms(false);
        return;
      }

      // Load existing programs
      try {
        const { data: programs } = await supabase
          .from('programs')
          .select('*')
          .eq('status', 'active')
          .order('name');

        setExistingPrograms(programs || []);
      } catch (err) {
        console.error('Error loading programs:', err);
      }

      // Check for existing subscriptions (for free trial check and contact info)
      try {
        const { data: existingSubscriptions, error: subError } = await supabase
          .from('featured_subscriptions')
          .select('id, plan_type, status, contact_name, contact_email, contact_phone')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (subError) {
          console.error('Error checking subscriptions:', subError);
        }

        if (existingSubscriptions && existingSubscriptions.length > 0) {
          // User has any subscription (free trial or paid) - hide free trial option
          console.log('User has existing subscription(s), hiding free trial option');
          setHasUsedFreeTrial(true);
          // Only switch to weekly if currently on free_trial
          if (planType === 'free_trial') {
            setPlanType('weekly');
          }

          // Pre-fill contact info from most recent subscription
          const mostRecent = existingSubscriptions[0];
          if (mostRecent.contact_name) {
            setSubscriptionContactName(mostRecent.contact_name);
            setSubscriptionContactEmail(mostRecent.contact_email || '');
            setSubscriptionContactPhone(mostRecent.contact_phone || '');
            setHasExistingContactInfo(true);
            console.log('Pre-filled contact info from existing subscription');
          }
        }
      } catch (err) {
        console.error('Error checking subscription status:', err);
      }

      // Check for localStorage data (from add-provider flow)
      try {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // add-provider stores data as { formData: {...}, hasAutoFilled, scrapeUrl }
          const formData = parsed.formData || parsed;
          if (formData.name) {
            setProgramData({
              name: formData.name || '',
              description: formData.description || '',
              category: formData.category || [],
              neighborhood: formData.neighborhood || '',
              address: formData.address || '',
              website: formData.website || '',
              contact_email: formData.contact_email || '',
              contact_phone: formData.contact_phone || '',
            });
            setSubscriptionContactEmail(formData.contact_email || user.email || '');
            setIsNewProgram(true);
          } else {
            setSubscriptionContactEmail(user.email || '');
          }
        } else {
          setSubscriptionContactEmail(user.email || '');
        }
      } catch {
        setSubscriptionContactEmail(user.email || '');
      }

      setLoadingPrograms(false);
    };

    loadData();
  }, [user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?next=/featured/setup');
    }
  }, [user, authLoading, router]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter programs based on search query
  const filteredPrograms = searchQuery.trim()
    ? existingPrograms.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : existingPrograms;

  // Handle logo file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload logo to Supabase Storage
  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !user) return null;

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('program-logos')
        .upload(fileName, logoFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('program-logos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error('Logo upload error:', err);
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle program selection
  const handleProgramSelect = (programId: string) => {
    if (programId === 'new') {
      setSelectedProgramId(null);
      setIsNewProgram(true);
      setProgramData({
        name: '',
        description: '',
        category: [],
        neighborhood: '',
        address: '',
        website: '',
        contact_email: '',
        contact_phone: '',
      });
      setSameAsProgram(true);
    } else {
      setSelectedProgramId(programId);
      setIsNewProgram(false);
      const program = existingPrograms.find(p => p.id === programId);
      if (program) {
        // Get primary location or first location for address/neighborhood
        const primaryLocation = program.locations?.find(l => l.is_primary) || program.locations?.[0];
        const programContactEmail = program.contact_email || '';
        const programContactPhone = program.contact_phone || '';
        setProgramData({
          name: program.name,
          description: program.description || '',
          category: program.category || [],
          neighborhood: primaryLocation?.neighborhood || '',
          address: primaryLocation?.address || '',
          website: program.provider_website || '',
          contact_email: programContactEmail,
          contact_phone: programContactPhone,
        });
        // If program has contact info, pre-fill subscription contact
        if (programContactEmail) {
          setSubscriptionContactEmail(programContactEmail);
          setSubscriptionContactPhone(programContactPhone);
          setSameAsProgram(true);
        }
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Determine final subscription contact info
    const finalContactEmail = sameAsProgram ? programData.contact_email : subscriptionContactEmail;
    const finalContactPhone = sameAsProgram ? programData.contact_phone : subscriptionContactPhone;

    try {
      // Validate required fields
      if (!programData.name.trim()) {
        throw new Error('Program name is required');
      }
      if (!subscriptionContactName.trim()) {
        throw new Error('Your name is required for the subscription');
      }
      if (!programData.contact_email.trim()) {
        throw new Error('Program contact email is required');
      }
      if (!finalContactEmail.trim()) {
        throw new Error('Subscription contact email is required');
      }

      // Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      // Get current session token for auth
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      // Create checkout session
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentSession?.access_token && {
            'Authorization': `Bearer ${currentSession.access_token}`,
          }),
        },
        body: JSON.stringify({
          programId: selectedProgramId,
          programData: isNewProgram ? programData : {
            ...programData,
            // Always update program contact info
            contact_email: programData.contact_email,
            contact_phone: programData.contact_phone,
          },
          planType,
          contactName: subscriptionContactName,
          contactEmail: finalContactEmail,
          contactPhone: finalContactPhone || undefined,
          programLogoUrl: logoUrl || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Clear localStorage
      localStorage.removeItem(SESSION_STORAGE_KEY);

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loadingPrograms) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/featured"
          className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-block"
        >
          ← Back to Featured Businesses
        </Link>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Set Up Your Featured Listing</h1>
            <p className="mt-2 text-gray-600">
              Complete the form below to feature your business
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Program Selection */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Program</h2>
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={isNewProgram ? programData.name || 'New program' : selectedProgramId ? existingPrograms.find(p => p.id === selectedProgramId)?.name || '' : searchQuery}
                    onChange={(e) => {
                      if (isNewProgram || selectedProgramId) {
                        setIsNewProgram(false);
                        setSelectedProgramId(null);
                      }
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => {
                      if (!isNewProgram && !selectedProgramId) {
                        setShowDropdown(true);
                      }
                    }}
                    placeholder="Search for your program..."
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  />
                  {(isNewProgram || selectedProgramId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewProgram(false);
                        setSelectedProgramId(null);
                        setSearchQuery('');
                        setProgramData({ name: '', description: '', category: [], neighborhood: '', address: '', website: '', contact_email: '', contact_phone: '' });
                        setShowDropdown(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {showDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        handleProgramSelect('new');
                        setSearchQuery('');
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border-b border-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add a new program
                    </button>
                    {filteredPrograms.length > 0 ? (
                      filteredPrograms.map((program) => (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => {
                            handleProgramSelect(program.id);
                            setSearchQuery('');
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                        >
                          <span className="font-medium">{program.name}</span>
                          {program.category && program.category.length > 0 && (
                            <span className="block text-xs text-gray-400 mt-0.5">
                              {program.category.slice(0, 3).join(', ')}
                            </span>
                          )}
                        </button>
                      ))
                    ) : searchQuery.trim() ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No programs found for &ldquo;{searchQuery}&rdquo;
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            {/* Program Details (for new programs or editing) */}
            {(isNewProgram || selectedProgramId) && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Program Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Program Name *
                    </label>
                    <input
                      type="text"
                      value={programData.name}
                      onChange={(e) => setProgramData({ ...programData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={programData.description}
                      onChange={(e) => setProgramData({ ...programData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={programData.website}
                      onChange={(e) => setProgramData({ ...programData, website: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="https://"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Program Contact Information */}
            {(isNewProgram || selectedProgramId) && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Program Contact Information</h2>
                <p className="text-sm text-gray-500 mb-4">
                  This will be displayed on your program listing for families to contact you.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Program Email *
                    </label>
                    <input
                      type="email"
                      value={programData.contact_email}
                      onChange={(e) => setProgramData({ ...programData, contact_email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="contact@yourprogram.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Program Phone
                    </label>
                    <input
                      type="tel"
                      value={programData.contact_phone}
                      onChange={(e) => setProgramData({ ...programData, contact_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="(415) 555-0123"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Subscription Contact Information */}
            {hasExistingContactInfo ? (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Subscription Contact</h2>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-800">
                        <span className="font-medium">{subscriptionContactName}</span>
                        {subscriptionContactEmail && <span className="text-green-600 ml-2">({subscriptionContactEmail})</span>}
                      </p>
                      <p className="text-xs text-green-600 mt-1">Using your saved contact information</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasExistingContactInfo(false)}
                      className="text-sm text-green-700 hover:text-green-800 underline"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Subscription Contact</h2>
                <p className="text-sm text-gray-500 mb-4">
                  We&apos;ll use this to contact you about your subscription and billing.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      value={subscriptionContactName}
                      onChange={(e) => setSubscriptionContactName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  {(isNewProgram || selectedProgramId) && programData.contact_email && (
                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={sameAsProgram}
                        onChange={(e) => {
                          setSameAsProgram(e.target.checked);
                          if (e.target.checked) {
                            setSubscriptionContactEmail(programData.contact_email);
                            setSubscriptionContactPhone(programData.contact_phone);
                          }
                        }}
                        className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">
                        Same as program contact information
                      </span>
                    </label>
                  )}

                  {(!sameAsProgram || !programData.contact_email) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={subscriptionContactEmail}
                          onChange={(e) => setSubscriptionContactEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={subscriptionContactPhone}
                          onChange={(e) => setSubscriptionContactPhone(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          placeholder="(415) 555-0123"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Logo Upload */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Program Logo</h2>
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                      <span className="text-gray-400 text-3xl">📷</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Recommended: Square image, at least 200x200 pixels
                  </p>
                </div>
              </div>
            </section>

            {/* Plan Selection */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Your Plan</h2>
              <div className={`grid grid-cols-1 gap-4 ${hasUsedFreeTrial ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {!hasUsedFreeTrial && (
                  <label
                    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      planType === 'free_trial'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value="free_trial"
                      checked={planType === 'free_trial'}
                      onChange={() => setPlanType('free_trial')}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">Free Trial</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">$0</p>
                      <p className="text-sm text-gray-500">for 3 days</p>
                      <p className="text-xs text-gray-400 mt-2">Then $98/week</p>
                    </div>
                    {planType === 'free_trial' && (
                      <div className="absolute top-2 right-2 text-amber-500">✓</div>
                    )}
                  </label>
                )}

                <label
                  className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    planType === 'weekly'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="weekly"
                    checked={planType === 'weekly'}
                    onChange={() => setPlanType('weekly')}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Weekly</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">$98</p>
                    <p className="text-sm text-gray-500">per week</p>
                    <p className="text-xs text-gray-400 mt-2">Cancel anytime</p>
                  </div>
                  {planType === 'weekly' && (
                    <div className="absolute top-2 right-2 text-amber-500">✓</div>
                  )}
                </label>

                <label
                  className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    planType === 'monthly'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="monthly"
                    checked={planType === 'monthly'}
                    onChange={() => setPlanType('monthly')}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Monthly</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">$298</p>
                    <p className="text-sm text-gray-500">per month</p>
                    <p className="text-xs text-green-600 mt-2">Save 24%</p>
                  </div>
                  {planType === 'monthly' && (
                    <div className="absolute top-2 right-2 text-amber-500">✓</div>
                  )}
                </label>
              </div>

              {planType === 'free_trial' && !hasUsedFreeTrial && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-medium">How the free trial works:</p>
                  <ul className="mt-2 list-disc list-inside space-y-1 text-blue-700">
                    <li>Your card will be saved but not charged during the trial</li>
                    <li>Cancel anytime within 3 days to avoid charges</li>
                    <li>After 3 days, you&apos;ll be charged $98/week automatically</li>
                  </ul>
                </div>
              )}
            </section>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting || uploadingLogo || (!isNewProgram && !selectedProgramId)}
                className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : planType === 'free_trial' ? (
                  'Start Free Trial'
                ) : (
                  `Continue to Payment - $${planType === 'weekly' ? '98/week' : '298/month'}`
                )}
              </button>
              <p className="mt-3 text-center text-xs text-gray-500">
                You&apos;ll be redirected to Stripe for secure payment
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function FeaturedSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      }
    >
      <FeaturedSetupContent />
    </Suspense>
  );
}
