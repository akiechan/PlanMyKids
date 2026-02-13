'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAdminLogger } from '@/hooks/useAdminLogger';
import { useRegion } from '@/contexts/RegionContext';

type TabType = 'manual' | 'scheduled' | 'history';

interface ScheduledJob {
  id: string;
  name: string;
  schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
  scheduled_time: string;
  next_run_at: string | null;
  max_pages: number;
  max_depth: number;
  only_missing: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  is_active: boolean;
  created_at: string;
}

interface ScrapeHistoryRecord {
  id: string;
  job_id: string | null;
  run_type: 'manual' | 'scheduled';
  started_at: string;
  completed_at: string | null;
  total_programs: number;
  programs_scraped: number;
  programs_updated: number;
  programs_failed: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error_message: string | null;
}

interface ScrapeProgress {
  historyId: string;
  status: string;
  progress: number;
  total: number;
  scraped: number;
  updated: number;
  failed: number;
  currentItem: { programName: string; providerName: string } | null;
  recentItems: Array<{
    programName: string;
    providerName: string;
    status: string;
    fieldsUpdated: Record<string, string> | null;
    error: string | null;
  }>;
}

interface HoursPerDay {
  [key: string]: { open: string; close: string } | undefined;
}

interface Program {
  id: string;
  name: string;
  provider_name: string;
  provider_website: string | null;
  description: string;
  category: string[];
  contact_email: string | null;
  contact_phone: string | null;
  registration_url: string | null;
  re_enrollment_date: string | null;
  new_registration_date: string | null;
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;
  operating_days: string[] | null;
  hours_per_day: HoursPerDay | null;
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number;
  updated_at: string;
  is_featured: boolean;
  program_type: 'program' | 'camp' | 'birthday_venue';
  address: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
}

const PROGRAM_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  program: { label: 'Program', emoji: '📚', color: 'bg-blue-100 text-blue-700' },
  camp: { label: 'Camp', emoji: '🏕️', color: 'bg-amber-100 text-amber-700' },
  birthday_venue: { label: 'Birthday', emoji: '🎂', color: 'bg-pink-100 text-pink-700' },
};

// Deduplicate programs by name - keep the one with best data quality
function deduplicateByName(programs: Program[]): Program[] {
  const seen = new Map<string, Program>();

  for (const program of programs) {
    const normalizedName = program.name.toLowerCase().trim();
    const existing = seen.get(normalizedName);

    if (!existing) {
      seen.set(normalizedName, program);
      continue;
    }

    // Compare and keep the better one (higher rating, more reviews, better data)
    const existingScore = getDataQualityScore(existing);
    const newScore = getDataQualityScore(program);

    if (newScore > existingScore) {
      seen.set(normalizedName, program);
    }
  }

  return Array.from(seen.values());
}

function getDataQualityScore(program: Program): number {
  let score = 0;
  if (program.google_rating) score += program.google_rating * 10;
  if (program.google_review_count) score += Math.min(program.google_review_count, 100);
  if (program.description && program.description.length > 50) score += 20;
  if (program.price_min != null) score += 10;
  if (program.contact_email) score += 15;
  if (program.contact_phone) score += 15;
  return score;
}

const DEFAULT_CATEGORIES = [
  'swimming', 'art', 'chess', 'soccer', 'music', 'dance',
  'martial-arts', 'technology', 'academic', 'science', 'creative', 'sports'
];

type SortField = 'name' | 'updated_at' | 'google_rating' | 'contact_email' | 'contact_phone' | 'provider_website' | 'is_featured' | 'price_min';
type SortDirection = 'asc' | 'desc';

// Track which value is selected for each field: 'new' = scraped/google value, 'current' = keep existing
type FieldSelection = 'new' | 'current';
type FieldSelections = Record<string, FieldSelection>;

interface ScrapedUpdate {
  programId: string;
  programName: string;
  original: Partial<Program>;
  scraped: Partial<Program>;
  changes: string[];
  status: 'pending' | 'approved' | 'rejected' | 'error';
  error?: string;
  source?: 'scrape' | 'google'; // Track where the update came from
  isFeatured?: boolean; // Track if this is a featured program
  fieldSelections?: FieldSelections; // Track which value to use for each field
}

export default function MassUpdatePage() {
  const { logAction } = useAdminLogger();
  const { region } = useRegion();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapedUpdates, setScrapedUpdates] = useState<ScrapedUpdate[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0, currentProgram: '' });
  const [updatingReviews, setUpdatingReviews] = useState(false);
  const [reviewsProgress, setReviewsProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [programTypeFilter, setProgramTypeFilter] = useState<string>('');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [updatingFeatured, setUpdatingFeatured] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  // Scheduling state
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [newSchedule, setNewSchedule] = useState<{
    name: string;
    schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
    scheduled_time: string;
    max_pages: number;
    max_depth: number;
    only_missing: boolean;
  }>({
    name: 'Scheduled Provider Update',
    schedule_type: 'once',
    scheduled_time: '',
    max_pages: 10,
    max_depth: 2,
    only_missing: false,
  });
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  // History state
  const [history, setHistory] = useState<ScrapeHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Real-time progress state
  const [runningHistoryId, setRunningHistoryId] = useState<string | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(null);

  useEffect(() => {
    fetchPrograms();
    if (activeTab === 'scheduled') {
      fetchScheduledJobs();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

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

  // Poll for progress when running
  useEffect(() => {
    if (!runningHistoryId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/scrape/progress?historyId=${runningHistoryId}`);
        if (response.ok) {
          const data = await response.json();
          setScrapeProgress(data);

          if (data.status === 'completed' || data.status === 'failed') {
            setRunningHistoryId(null);
            setScraping(false);
            fetchHistory();
          }
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runningHistoryId]);

  const fetchScheduledJobs = async () => {
    try {
      const response = await fetch('/api/admin/scrape/schedule');
      if (response.ok) {
        const data = await response.json();
        setScheduledJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Error fetching scheduled jobs:', err);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/admin/scrape/history?limit=20');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const createScheduledJob = async () => {
    if (!newSchedule.scheduled_time) {
      alert('Please select a date and time');
      return;
    }

    setCreatingSchedule(true);
    try {
      const response = await fetch('/api/admin/scrape/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule),
      });

      if (response.ok) {
        alert('Scheduled job created successfully');
        fetchScheduledJobs();
        setNewSchedule({
          name: 'Scheduled Provider Update',
          schedule_type: 'once',
          scheduled_time: '',
          max_pages: 10,
          max_depth: 2,
          only_missing: false,
        });
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error creating scheduled job:', err);
      alert('Failed to create scheduled job');
    } finally {
      setCreatingSchedule(false);
    }
  };

  const deleteScheduledJob = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled job?')) return;

    try {
      const response = await fetch('/api/admin/scrape/schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        fetchScheduledJobs();
      }
    } catch (err) {
      console.error('Error deleting scheduled job:', err);
    }
  };

  const runScrapeNow = useCallback(async (programIds?: string[]) => {
    setScraping(true);
    setScrapeProgress(null);

    try {
      const response = await fetch('/api/admin/scrape/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programIds: programIds || Array.from(selectedPrograms),
          maxPages: 10,
          maxDepth: 2,
          onlyMissing: false,
          runType: 'manual',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRunningHistoryId(data.historyId);
        setActiveTab('history');
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
        setScraping(false);
      }
    } catch (err) {
      console.error('Error starting scrape:', err);
      alert('Failed to start scrape');
      setScraping(false);
    }
  }, [selectedPrograms]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, provider_name, provider_website, description, category, contact_email, contact_phone, registration_url, re_enrollment_date, new_registration_date, price_min, price_max, price_unit, operating_days, hours_per_day, google_place_id, google_rating, google_review_count, updated_at, is_featured, program_type, program_locations(address, neighborhood, latitude, longitude)')
        .not('provider_website', 'is', null)
        .neq('provider_website', '')
        .eq('status', 'active')
        .is('merged_into', null)
        .order('name');

      if (error) throw error;
      // Flatten address/location from program_locations join
      const withAddress = (data || []).map((p: any) => ({
        ...p,
        address: p.program_locations?.[0]?.address || null,
        neighborhood: p.program_locations?.[0]?.neighborhood || null,
        latitude: p.program_locations?.[0]?.latitude ? parseFloat(p.program_locations[0].latitude) : null,
        longitude: p.program_locations?.[0]?.longitude ? parseFloat(p.program_locations[0].longitude) : null,
        program_locations: undefined,
      }));
      // Deduplicate by name to avoid showing duplicate entries
      const deduplicated = deduplicateByName(withAddress);
      setPrograms(deduplicated);
    } catch (err) {
      console.error('Error fetching programs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort programs
  const filteredPrograms = programs
    .filter(p => !programTypeFilter || p.program_type === programTypeFilter)
    .filter(p => !categoryFilter || (p.category && p.category.includes(categoryFilter)))
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      } else if (sortField === 'google_rating') {
        comparison = (a.google_rating || 0) - (b.google_rating || 0);
      } else if (sortField === 'contact_email') {
        comparison = (a.contact_email || '').localeCompare(b.contact_email || '');
      } else if (sortField === 'contact_phone') {
        comparison = (a.contact_phone || '').localeCompare(b.contact_phone || '');
      } else if (sortField === 'provider_website') {
        comparison = (a.provider_website || '').localeCompare(b.provider_website || '');
      } else if (sortField === 'is_featured') {
        comparison = (a.is_featured ? 1 : 0) - (b.is_featured ? 1 : 0);
      } else if (sortField === 'price_min') {
        comparison = (a.price_min || 0) - (b.price_min || 0);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const toggleSelectAll = () => {
    if (selectedPrograms.size === filteredPrograms.length) {
      setSelectedPrograms(new Set());
    } else {
      setSelectedPrograms(new Set(filteredPrograms.map(p => p.id)));
    }
  };

  const handleColumnSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-3 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleColumnSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedPrograms);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPrograms(newSelected);
  };

  const scrapeSelectedPrograms = async () => {
    const selected = programs.filter(p => selectedPrograms.has(p.id));
    if (selected.length === 0) return;

    setScraping(true);
    setScrapedUpdates([]);
    setProgress({ current: 0, total: selected.length, success: 0, failed: 0, currentProgram: '' });

    const updates: ScrapedUpdate[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const program = selected[i];
      setProgress({ current: i + 1, total: selected.length, success: successCount, failed: failedCount, currentProgram: program.name });

      try {
        if (!program.provider_website) {
          updates.push({
            programId: program.id,
            programName: program.name,
            original: {},
            scraped: {},
            changes: [],
            status: 'error',
            error: 'No website URL',
          });
          continue;
        }

        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ websiteUrl: program.provider_website }),
        });

        if (!response.ok) {
          throw new Error('Scrape failed');
        }

        const result = await response.json();
        const scraped = result.data;

        // Compare and find changes
        const changes: string[] = [];
        const original: Partial<Program> = {};
        const scrapedData: Partial<Program> = {};

        // Check each field for changes
        const fieldsToCheck: (keyof Program)[] = [
          'description', 'contact_email', 'contact_phone',
          'registration_url', 'price_min', 'price_max', 'price_unit',
          'address'
        ];

        for (const field of fieldsToCheck) {
          const originalValue = program[field];
          const scrapedValue = scraped[field];

          if (scrapedValue && scrapedValue !== originalValue) {
            changes.push(field);
            original[field] = originalValue as any;
            scrapedData[field] = scrapedValue;
          }
        }

        // Check category separately (array comparison)
        if (scraped.category && Array.isArray(scraped.category) && scraped.category.length > 0) {
          const existingCats = JSON.stringify((program.category || []).sort());
          const scrapedCats = JSON.stringify([...scraped.category].sort());
          if (existingCats !== scrapedCats) {
            changes.push('category');
            original.category = program.category;
            scrapedData.category = scraped.category;
          }
        }

        // Check registration dates separately (format differences)
        if (scraped.re_enrollment_date && scraped.re_enrollment_date !== program.re_enrollment_date) {
          changes.push('re_enrollment_date');
          original.re_enrollment_date = program.re_enrollment_date;
          scrapedData.re_enrollment_date = scraped.re_enrollment_date;
        }
        if (scraped.new_registration_date && scraped.new_registration_date !== program.new_registration_date) {
          changes.push('new_registration_date');
          original.new_registration_date = program.new_registration_date;
          scrapedData.new_registration_date = scraped.new_registration_date;
        }

        // Auto-geocode if address was found by scraper
        const scrapedAddress = scraped.address || scrapedData.address;
        if (scrapedAddress && typeof scrapedAddress === 'string' && scrapedAddress.length > 5) {
          try {
            const geocodeRes = await fetch(`/api/google-neighborhood?address=${encodeURIComponent(scrapedAddress)}`);
            if (geocodeRes.ok) {
              const geo = await geocodeRes.json();
              if (geo.latitude && geo.longitude) {
                // Add geocoded fields as changes
                if (geo.latitude !== program.latitude) {
                  changes.push('latitude');
                  original.latitude = program.latitude;
                  scrapedData.latitude = geo.latitude;
                }
                if (geo.longitude !== program.longitude) {
                  changes.push('longitude');
                  original.longitude = program.longitude;
                  scrapedData.longitude = geo.longitude;
                }
                if (geo.neighborhood && geo.neighborhood !== program.neighborhood) {
                  changes.push('neighborhood');
                  original.neighborhood = program.neighborhood;
                  scrapedData.neighborhood = geo.neighborhood;
                }
                // Use the formatted address from Google if available
                if (geo.formatted_address && geo.formatted_address !== program.address) {
                  if (!changes.includes('address')) {
                    changes.push('address');
                    original.address = program.address;
                  }
                  scrapedData.address = geo.formatted_address;
                }
              }
            }
          } catch (geoErr) {
            console.error(`[${program.name}] Geocode error:`, geoErr);
          }
        }

        // Initialize field selections - default to 'new' (use scraped value)
        const fieldSelections: FieldSelections = {};
        changes.forEach(field => { fieldSelections[field] = 'new'; });

        updates.push({
          programId: program.id,
          programName: program.name,
          original,
          scraped: scrapedData,
          changes,
          status: changes.length > 0 ? 'pending' : 'approved', // No changes = auto-approved (nothing to do)
          source: 'scrape',
          isFeatured: program.is_featured,
          fieldSelections,
        });
        successCount++;

      } catch (err) {
        updates.push({
          programId: program.id,
          programName: program.name,
          original: {},
          scraped: {},
          changes: [],
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          isFeatured: program.is_featured,
        });
        failedCount++;
      }

      // Update state after each program - merge with existing state to preserve user modifications
      setScrapedUpdates(prev => {
        const newUpdate = updates[updates.length - 1]; // Get the latest update we just added
        const existingIndex = prev.findIndex(u => u.programId === newUpdate.programId);

        if (existingIndex >= 0) {
          // Update existing entry but preserve user's status/fieldSelections if they modified it
          const existing = prev[existingIndex];
          const wasModifiedByUser = existing.status !== 'pending' ||
            (existing.fieldSelections && Object.values(existing.fieldSelections).some(v => v === 'current'));

          if (wasModifiedByUser) {
            // Preserve user modifications
            return prev;
          }
          // Replace with new data
          const updated = [...prev];
          updated[existingIndex] = newUpdate;
          return updated;
        }
        // Add new entry
        return [...prev, newUpdate];
      });
      setProgress({ current: i + 1, total: selected.length, success: successCount, failed: failedCount, currentProgram: '' });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setScraping(false);
    setProgress({ current: 0, total: 0, success: 0, failed: 0, currentProgram: '' });
  };

  const approveUpdate = (programId: string) => {
    setScrapedUpdates(prev =>
      prev.map(u => u.programId === programId ? { ...u, status: 'approved' as const } : u)
    );
  };

  const rejectUpdate = (programId: string) => {
    setScrapedUpdates(prev =>
      prev.map(u => u.programId === programId ? { ...u, status: 'rejected' as const } : u)
    );
  };

  const approveAll = () => {
    setScrapedUpdates(prev =>
      prev.map(u => u.status === 'pending' ? { ...u, status: 'approved' as const } : u)
    );
  };

  const rejectAll = () => {
    setScrapedUpdates(prev =>
      prev.map(u => u.status === 'pending' ? { ...u, status: 'rejected' as const } : u)
    );
  };

  const toggleFieldSelection = (programId: string, field: string) => {
    setScrapedUpdates(prev =>
      prev.map(update => {
        if (update.programId !== programId) return update;
        const currentSelection = update.fieldSelections?.[field] || 'new';
        const newSelection = currentSelection === 'new' ? 'current' : 'new';
        return {
          ...update,
          fieldSelections: {
            ...update.fieldSelections,
            [field]: newSelection,
          },
        };
      })
    );
  };

  const applyApprovedUpdates = async () => {
    const approved = scrapedUpdates.filter(u => u.status === 'approved' && u.changes.length > 0);
    if (approved.length === 0) return;

    setApplying(true);
    let successCount = 0;

    for (const update of approved) {
      try {
        // Build update object based on field selections
        const updateData: Partial<Program> = {};

        // Info-only fields that shouldn't be written to DB
        const infoOnlyFields = new Set(['google_matched_name']);
        // Location fields go to program_locations table, not programs
        const locationFields = new Set(['address', 'neighborhood', 'latitude', 'longitude']);
        const locationData: Record<string, any> = {};

        for (const field of update.changes) {
          if (infoOnlyFields.has(field)) continue;
          const selection = update.fieldSelections?.[field] || 'new';
          // 'new' means use the scraped/google value, 'current' means keep original (don't update)
          if (selection === 'new') {
            if (locationFields.has(field)) {
              locationData[field] = update.scraped[field as keyof Program];
            } else {
              updateData[field as keyof Program] = update.scraped[field as keyof Program] as any;
            }
          }
          // If 'current' is selected, we skip this field (keep existing value)
        }

        // Only update if there are fields to update
        const hasProgramUpdates = Object.keys(updateData).length > 0;
        const hasLocationUpdates = Object.keys(locationData).length > 0;

        if (!hasProgramUpdates && !hasLocationUpdates) {
          console.log(`Skipping ${update.programName} - all fields kept current values`);
          continue;
        }

        if (hasProgramUpdates) {
          const { error } = await supabase
            .from('programs')
            .update(updateData)
            .eq('id', update.programId);
          if (error) throw error;
        }

        // Write location fields to program_locations
        if (hasLocationUpdates) {
          console.log(`[${update.programName}] Location update data:`, locationData);
          // Check if a program_location already exists
          const { data: existingLoc, error: locQueryError } = await supabase
            .from('program_locations')
            .select('id')
            .eq('program_id', update.programId)
            .limit(1)
            .single();

          console.log(`[${update.programName}] Existing location:`, existingLoc, 'Query error:', locQueryError);

          if (existingLoc) {
            // Update existing location
            const { error: locError } = await supabase
              .from('program_locations')
              .update(locationData)
              .eq('id', existingLoc.id);
            if (locError) {
              console.error(`Error updating location for ${update.programName}:`, locError);
            } else {
              console.log(`[${update.programName}] Location updated successfully`);
            }
          } else if (locationData.address && locationData.latitude && locationData.longitude) {
            // Create new location (need at least address + coords)
            const { error: locError } = await supabase
              .from('program_locations')
              .insert({
                program_id: update.programId,
                address: locationData.address,
                neighborhood: locationData.neighborhood || '',
                latitude: locationData.latitude,
                longitude: locationData.longitude,
              });
            if (locError) {
              console.error(`Error creating location for ${update.programName}:`, locError);
            } else {
              console.log(`[${update.programName}] Location created successfully`);
            }
          } else {
            console.log(`[${update.programName}] Skipping location - missing required fields. Has:`, Object.keys(locationData));
          }
        }

        successCount++;
      } catch (err) {
        console.error(`Error updating ${update.programName}:`, err);
      }
    }

    // Log the mass update action
    const programNames = approved.map(u => u.programName);
    await logAction({
      action: 'Mass Update',
      entityType: 'program',
      entityName: successCount === 1 ? programNames[0] : `${successCount} programs`,
      details: {
        action: 'updated',
        count: successCount,
        programNames: programNames.slice(0, 10), // Limit to first 10 for brevity
        totalPrograms: programNames.length,
      },
    });

    setApplying(false);
    alert(`Applied updates to ${successCount} program(s)`);

    // Clear server-side camps cache
    fetch('/api/admin/clear-cache', { method: 'POST' }).catch(() => {});

    // Refresh
    setScrapedUpdates([]);
    setSelectedPrograms(new Set());
    fetchPrograms();
  };

  const toggleFeatured = async (makeFeatured: boolean) => {
    const selected = programs.filter(p => selectedPrograms.has(p.id));
    if (selected.length === 0) return;

    setUpdatingFeatured(true);

    try {
      const { error } = await supabase
        .from('programs')
        .update({ is_featured: makeFeatured })
        .in('id', selected.map(p => p.id));

      if (error) throw error;

      alert(`✅ ${selected.length} program(s) ${makeFeatured ? 'marked as featured' : 'unmarked from featured'}`);
      // Clear server-side camps cache
      fetch('/api/admin/clear-cache', { method: 'POST' }).catch(() => {});
      setSelectedPrograms(new Set());
      fetchPrograms();
    } catch (err) {
      console.error('Error updating featured status:', err);
      alert('Failed to update featured status');
    } finally {
      setUpdatingFeatured(false);
    }
  };

  // Helper to parse Google Places opening_hours to our HoursPerDay format
  const parseGoogleHours = (openingHours?: { weekday_text?: string[] }): {
    operating_days: string[];
    hours_per_day: HoursPerDay;
  } => {
    const result: { operating_days: string[]; hours_per_day: HoursPerDay } = {
      operating_days: [],
      hours_per_day: {},
    };

    if (!openingHours?.weekday_text) return result;

    const dayMap: Record<string, string> = {
      Monday: 'monday',
      Tuesday: 'tuesday',
      Wednesday: 'wednesday',
      Thursday: 'thursday',
      Friday: 'friday',
      Saturday: 'saturday',
      Sunday: 'sunday',
    };

    const convertTo24Hour = (time: string): string => {
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return '09:00';

      let hours = parseInt(match[1]);
      const minutes = match[2];
      const period = match[3].toUpperCase();

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    };

    for (const line of openingHours.weekday_text) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const dayName = line.substring(0, colonIndex).trim();
      const hoursText = line.substring(colonIndex + 1).trim();
      const dayKey = dayMap[dayName];

      if (!dayKey) continue;
      if (hoursText.toLowerCase() === 'closed') continue;

      const timeMatch = hoursText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[–\-—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (timeMatch) {
        result.operating_days.push(dayKey);
        result.hours_per_day[dayKey] = {
          open: convertTo24Hour(timeMatch[1]),
          close: convertTo24Hour(timeMatch[2]),
        };
      }
    }

    return result;
  };

  const updateWithGoogle = async () => {
    const selected = programs.filter(p => selectedPrograms.has(p.id));
    if (selected.length === 0) return;

    setUpdatingReviews(true);
    setScrapedUpdates([]);
    setReviewsProgress({ current: 0, total: selected.length, success: 0, failed: 0 });

    const updates: ScrapedUpdate[] = [];
    let successCount = 0;
    let failedCount = 0;

    // Process one at a time to get full details including hours
    for (let i = 0; i < selected.length; i++) {
      const program = selected[i];

      setReviewsProgress({
        current: i + 1,
        total: selected.length,
        success: successCount,
        failed: failedCount,
      });

      try {
        // If program has a google_place_id, fetch full details
        if (program.google_place_id) {
          const detailsResponse = await fetch('/api/google-place-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeId: program.google_place_id }),
          });

          if (detailsResponse.ok) {
            const { result: details } = await detailsResponse.json();
            if (details) {
              // Parse hours from Google
              const parsedHours = parseGoogleHours(details.opening_hours);
              console.log(`[${program.name}] Google opening_hours:`, details.opening_hours);
              console.log(`[${program.name}] Parsed hours:`, parsedHours);

              // Build changes list — always show what Google found
              const changes: string[] = [];
              const original: Partial<Program> = {};
              const googleData: Partial<Program> = {};

              // Always show Google matched name so admin can verify correct match
              if (details.name) {
                changes.push('google_matched_name');
                (original as any).google_matched_name = null;
                (googleData as any).google_matched_name = details.name;
              }

              // Always show rating/reviews if Google has them
              if (details.rating) {
                changes.push('google_rating');
                original.google_rating = program.google_rating;
                googleData.google_rating = details.rating;
              }
              if (details.user_ratings_total) {
                changes.push('google_review_count');
                original.google_review_count = program.google_review_count;
                googleData.google_review_count = details.user_ratings_total;
              }

              // Check operating hours
              const existingHasHours = (program.operating_days && program.operating_days.length > 0) ||
                (program.hours_per_day && Object.keys(program.hours_per_day).length > 0);
              const googleHasHours = parsedHours.operating_days.length > 0;

              if (existingHasHours || googleHasHours) {
                const existingDays = JSON.stringify(program.operating_days || []);
                const newDays = JSON.stringify(parsedHours.operating_days);
                const existingHours = JSON.stringify(program.hours_per_day || {});
                const newHours = JSON.stringify(parsedHours.hours_per_day);

                if (existingDays !== newDays || existingHours !== newHours) {
                  changes.push('operating_days');
                  changes.push('hours_per_day');
                  original.operating_days = program.operating_days;
                  original.hours_per_day = program.hours_per_day;
                  googleData.operating_days = googleHasHours ? parsedHours.operating_days : null;
                  googleData.hours_per_day = googleHasHours ? parsedHours.hours_per_day : null;
                }
              }

              // Check address and coordinates from Google
              if (details.formatted_address && details.formatted_address !== program.address) {
                changes.push('address');
                original.address = program.address;
                googleData.address = details.formatted_address;
              }
              if (details.geometry?.location) {
                const gLat = details.geometry.location.lat;
                const gLng = details.geometry.location.lng;
                if (gLat && gLat !== program.latitude) {
                  changes.push('latitude');
                  original.latitude = program.latitude;
                  googleData.latitude = gLat;
                }
                if (gLng && gLng !== program.longitude) {
                  changes.push('longitude');
                  original.longitude = program.longitude;
                  googleData.longitude = gLng;
                }
              }

              // Resolve neighborhood from address via geocoding
              const googleAddress = details.formatted_address || program.address;
              if (googleAddress) {
                try {
                  const nRes = await fetch(`/api/google-neighborhood?address=${encodeURIComponent(googleAddress)}`);
                  if (nRes.ok) {
                    const nData = await nRes.json();
                    if (nData.neighborhood && nData.neighborhood !== program.neighborhood) {
                      changes.push('neighborhood');
                      original.neighborhood = program.neighborhood;
                      googleData.neighborhood = nData.neighborhood;
                    }
                  }
                } catch (nErr) {
                  console.error(`[${program.name}] Neighborhood lookup error:`, nErr);
                }
              }

              // Check phone
              if (details.formatted_phone_number) {
                changes.push('contact_phone');
                original.contact_phone = program.contact_phone;
                googleData.contact_phone = details.formatted_phone_number;
              }

              // Check website
              if (details.website) {
                changes.push('provider_website');
                original.provider_website = program.provider_website;
                googleData.provider_website = details.website;
              }

              // Optionally scrape website for additional info (description, email, etc.)
              const websiteUrl = details.website || program.provider_website;
              if (websiteUrl) {
                try {
                  console.log(`[${program.name}] Scraping website: ${websiteUrl}`);
                  const scrapeResponse = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      websiteUrl,
                      crawl: true,
                      maxPages: 3,
                      maxDepth: 1,
                    }),
                  });

                  if (scrapeResponse.ok) {
                    const scrapeResult = await scrapeResponse.json();
                    if (scrapeResult.data) {
                      console.log(`[${program.name}] Scraped data:`, scrapeResult.data);

                      // Check description
                      if (scrapeResult.data.description && scrapeResult.data.description !== program.description) {
                        changes.push('description');
                        original.description = program.description;
                        googleData.description = scrapeResult.data.description;
                      }

                      // Check email if missing
                      if (scrapeResult.data.contact_email && scrapeResult.data.contact_email !== program.contact_email) {
                        changes.push('contact_email');
                        original.contact_email = program.contact_email;
                        googleData.contact_email = scrapeResult.data.contact_email;
                      }

                      // Check registration URL
                      if (scrapeResult.data.registration_url && scrapeResult.data.registration_url !== program.registration_url) {
                        changes.push('registration_url');
                        original.registration_url = program.registration_url;
                        googleData.registration_url = scrapeResult.data.registration_url;
                      }

                      // Check price
                      if (scrapeResult.data.price_min !== null && scrapeResult.data.price_min !== program.price_min) {
                        changes.push('price_min');
                        original.price_min = program.price_min;
                        googleData.price_min = scrapeResult.data.price_min;
                      }
                      if (scrapeResult.data.price_max !== null && scrapeResult.data.price_max !== program.price_max) {
                        changes.push('price_max');
                        original.price_max = program.price_max;
                        googleData.price_max = scrapeResult.data.price_max;
                      }
                      if (scrapeResult.data.price_unit && scrapeResult.data.price_unit !== program.price_unit) {
                        changes.push('price_unit');
                        original.price_unit = program.price_unit;
                        googleData.price_unit = scrapeResult.data.price_unit;
                      }
                    }
                  }
                } catch (scrapeErr) {
                  console.error(`[${program.name}] Scrape error:`, scrapeErr);
                }
              }

              // Initialize field selections - default to 'new' (use Google/scraped value)
              const uniqueChanges = [...new Set(changes)];
              const fieldSelections: FieldSelections = {};
              uniqueChanges.forEach(field => { fieldSelections[field] = 'new'; });

              updates.push({
                programId: program.id,
                programName: program.name,
                original,
                scraped: googleData,
                changes: uniqueChanges,
                status: uniqueChanges.length > 0 ? 'pending' : 'approved',
                source: 'google',
                isFeatured: program.is_featured,
                fieldSelections,
              });
              successCount++;
            } else {
              updates.push({
                programId: program.id,
                programName: program.name,
                original: {},
                scraped: {},
                changes: [],
                status: 'error',
                error: 'No Google details found',
                source: 'google',
                isFeatured: program.is_featured,
              });
              failedCount++;
            }
          } else {
            updates.push({
              programId: program.id,
              programName: program.name,
              original: {},
              scraped: {},
              changes: [],
              status: 'error',
              error: 'Failed to fetch Google details',
              source: 'google',
              isFeatured: program.is_featured,
            });
            failedCount++;
          }
        } else {
          // No google_place_id — find via Google Places with multiple search strategies
          try {
            // Build search queries in order of specificity, deduplicated
            const searchQueriesSet = new Set<string>();
            const searchQueries: string[] = [];
            const addQuery = (q: string) => {
              const key = q.toLowerCase().trim();
              if (!searchQueriesSet.has(key)) {
                searchQueriesSet.add(key);
                searchQueries.push(q);
              }
            };
            const regionCity = region.name;
            const regionShort = region.short_name;
            // Most specific first: name + full address
            if (program.address && program.address !== `${regionShort}, CA`) {
              addQuery(program.name + ' ' + program.address);
            }
            // Provider name + address (if different from program name)
            if (program.provider_name && program.provider_name !== program.name) {
              addQuery(program.provider_name + (program.address && program.address !== `${regionShort}, CA` ? ' ' + program.address : ` ${regionShort}, CA`));
            }
            // Name + city
            addQuery(program.name + ` ${regionShort}, CA`);
            // Provider name + city (if different)
            if (program.provider_name && program.provider_name !== program.name) {
              addQuery(program.provider_name + ` ${regionShort}, CA`);
            }
            // Just the provider name alone (catches well-known businesses)
            if (program.provider_name) {
              addQuery(program.provider_name + ` ${regionShort}`);
            }
            // Just the program name alone
            addQuery(program.name + ` ${regionShort}`);

            // Try each query until we find a result
            console.log(`[${program.name}] Trying ${searchQueries.length} queries:`, searchQueries);
            let place: any = null;
            for (const query of searchQueries) {
              try {
                const resp = await fetch('/api/google-places', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ address: query }),
                });
                if (resp.ok) {
                  const data = await resp.json();
                  if (data.place?.place_id) {
                    place = data.place;
                    console.log(`[${program.name}] Found via query: "${query}" → ${data.place.name}`);
                    break;
                  }
                } else {
                  console.log(`[${program.name}] Query "${query}" → ${resp.status}`);
                }
              } catch (err) {
                console.log(`[${program.name}] Query "${query}" → error:`, err);
              }
            }

            if (place?.place_id) {
                // Use the place data directly — /api/google-places already returns full details
                const parsedHours = parseGoogleHours(place.opening_hours);
                const changes: string[] = [];
                const original: Partial<Program> = {};
                const googleData: Partial<Program> = {};

                // Always show place_id as a new field found
                changes.push('google_place_id');
                original.google_place_id = null;
                googleData.google_place_id = place.place_id;

                // Always show rating/reviews if Google has them
                if (place.rating) {
                  changes.push('google_rating');
                  original.google_rating = program.google_rating;
                  googleData.google_rating = place.rating;
                }
                if (place.user_ratings_total) {
                  changes.push('google_review_count');
                  original.google_review_count = program.google_review_count;
                  googleData.google_review_count = place.user_ratings_total;
                }
                // Always show name Google matched to
                if (place.name) {
                  changes.push('google_matched_name');
                  (original as any).google_matched_name = null;
                  (googleData as any).google_matched_name = place.name;
                }
                // Check address and coordinates
                if (place.formatted_address && place.formatted_address !== program.address) {
                  changes.push('address');
                  original.address = program.address;
                  googleData.address = place.formatted_address;
                }
                if (place.geometry?.location) {
                  const gLat = place.geometry.location.lat;
                  const gLng = place.geometry.location.lng;
                  if (gLat && gLat !== program.latitude) {
                    changes.push('latitude');
                    original.latitude = program.latitude;
                    googleData.latitude = gLat;
                  }
                  if (gLng && gLng !== program.longitude) {
                    changes.push('longitude');
                    original.longitude = program.longitude;
                    googleData.longitude = gLng;
                  }
                }

                // Resolve neighborhood from address via geocoding
                const placeAddress = place.formatted_address || program.address;
                if (placeAddress) {
                  try {
                    const nRes = await fetch(`/api/google-neighborhood?address=${encodeURIComponent(placeAddress)}`);
                    if (nRes.ok) {
                      const nData = await nRes.json();
                      if (nData.neighborhood && nData.neighborhood !== program.neighborhood) {
                        changes.push('neighborhood');
                        original.neighborhood = program.neighborhood;
                        googleData.neighborhood = nData.neighborhood;
                      }
                    }
                  } catch (nErr) {
                    console.error(`[${program.name}] Neighborhood lookup error:`, nErr);
                  }
                }

                if (place.formatted_phone_number) {
                  changes.push('contact_phone');
                  original.contact_phone = program.contact_phone;
                  googleData.contact_phone = place.formatted_phone_number;
                }
                if (place.website) {
                  changes.push('provider_website');
                  original.provider_website = program.provider_website;
                  googleData.provider_website = place.website;
                }

                const googleHasHours = parsedHours.operating_days.length > 0;
                if (googleHasHours) {
                  changes.push('operating_days');
                  changes.push('hours_per_day');
                  original.operating_days = program.operating_days;
                  original.hours_per_day = program.hours_per_day;
                  googleData.operating_days = parsedHours.operating_days;
                  googleData.hours_per_day = parsedHours.hours_per_day;
                }

                const uniqueChanges = [...new Set(changes)];
                const fieldSelections: FieldSelections = {};
                uniqueChanges.forEach(field => { fieldSelections[field] = 'new'; });

                updates.push({
                  programId: program.id,
                  programName: program.name,
                  original,
                  scraped: googleData,
                  changes: uniqueChanges,
                  status: 'pending',
                  source: 'google',
                  isFeatured: program.is_featured,
                  fieldSelections,
                });
                successCount++;
            } else {
              updates.push({
                programId: program.id, programName: program.name,
                original: {}, scraped: {}, changes: [], status: 'error',
                error: 'No Google Place ID found', isFeatured: program.is_featured, source: 'google',
              });
              failedCount++;
            }
          } catch (searchErr) {
            updates.push({
              programId: program.id, programName: program.name,
              original: {}, scraped: {}, changes: [], status: 'error',
              error: 'Place ID search failed', isFeatured: program.is_featured, source: 'google',
            });
            failedCount++;
          }
        }
      } catch (err) {
        console.error('Error fetching Google data for program:', err);
        updates.push({
          programId: program.id,
          programName: program.name,
          original: {},
          scraped: {},
          changes: [],
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          source: 'google',
          isFeatured: program.is_featured,
        });
        failedCount++;
      }

      // Update state after each program - merge with existing state to preserve user modifications
      setScrapedUpdates(prev => {
        const newUpdate = updates[updates.length - 1]; // Get the latest update we just added
        const existingIndex = prev.findIndex(u => u.programId === newUpdate.programId);

        if (existingIndex >= 0) {
          // Update existing entry but preserve user's status/fieldSelections if they modified it
          const existing = prev[existingIndex];
          const wasModifiedByUser = existing.status !== 'pending' ||
            (existing.fieldSelections && Object.values(existing.fieldSelections).some(v => v === 'current'));

          if (wasModifiedByUser) {
            // Preserve user modifications
            return prev;
          }
          // Replace with new data
          const updated = [...prev];
          updated[existingIndex] = newUpdate;
          return updated;
        }
        // Add new entry
        return [...prev, newUpdate];
      });
      setReviewsProgress({
        current: i + 1,
        total: selected.length,
        success: successCount,
        failed: failedCount,
      });

      // Small delay to avoid rate limiting
      if (i < selected.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setUpdatingReviews(false);
  };

  const pendingCount = scrapedUpdates.filter(u => u.status === 'pending').length;
  const approvedCount = scrapedUpdates.filter(u => u.status === 'approved' && u.changes.length > 0).length;
  const rejectedCount = scrapedUpdates.filter(u => u.status === 'rejected').length;
  const errorCount = scrapedUpdates.filter(u => u.status === 'error').length;
  const featuredPendingCount = scrapedUpdates.filter(u => u.status === 'pending' && u.isFeatured).length;
  const featuredApprovedCount = scrapedUpdates.filter(u => u.status === 'approved' && u.changes.length > 0 && u.isFeatured).length;
  const noChangesCount = scrapedUpdates.filter(u => u.status === 'approved' && u.changes.length === 0).length;

  const formatFieldName = (field: string) => {
    const labels: Record<string, string> = {
      google_place_id: 'Google Place ID',
      google_rating: 'Google Rating',
      google_review_count: 'Google Reviews',
      google_matched_name: 'Google Matched Name',
      contact_phone: 'Phone',
      contact_email: 'Email',
      provider_website: 'Website',
      operating_days: 'Operating Days',
      hours_per_day: 'Hours',
      registration_url: 'Registration URL',
      re_enrollment_date: 'Re-enrollment Date',
      new_registration_date: 'New Registration Date',
      price_min: 'Min Price',
      price_max: 'Max Price',
      price_unit: 'Price Unit',
      category: 'Category',
      address: 'Address',
      neighborhood: 'Neighborhood',
      latitude: 'Latitude',
      longitude: 'Longitude',
    };
    return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatHoursPerDay = (hours: HoursPerDay | null | undefined) => {
    if (!hours || Object.keys(hours).length === 0) {
      return <span className="text-gray-400 italic">No hours set</span>;
    }

    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayAbbrev: Record<string, string> = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
    };

    return (
      <div className="space-y-0.5 text-xs">
        {dayOrder.map(day => {
          const h = hours[day];
          if (!h) return null;
          return (
            <div key={day} className="flex items-center gap-2">
              <span className="font-medium w-8">{dayAbbrev[day]}:</span>
              <span>{h.open} - {h.close}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const formatOperatingDays = (days: string[] | null | undefined) => {
    if (!days || days.length === 0) {
      return <span className="text-gray-400 italic">No days set</span>;
    }

    const dayAbbrev: Record<string, string> = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
    };

    return (
      <div className="flex flex-wrap gap-1">
        {days.map(day => (
          <span key={day} className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-xs">
            {dayAbbrev[day] || day}
          </span>
        ))}
      </div>
    );
  };

  const formatValue = (value: any, field?: string) => {
    if (value === null || value === undefined) return <span className="text-gray-400 italic">empty</span>;

    // Special handling for hours_per_day
    if (field === 'hours_per_day' && typeof value === 'object') {
      return formatHoursPerDay(value as HoursPerDay);
    }

    // Special handling for operating_days
    if (field === 'operating_days' && Array.isArray(value)) {
      return formatOperatingDays(value);
    }

    // Special handling for category
    if (field === 'category' && Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400 italic">none</span>;
      return value.join(', ');
    }

    if (typeof value === 'string' && value.length > 100) return value.substring(0, 100) + '...';
    return String(value);
  };

  const updateScrapedValue = (programId: string, field: string, value: string) => {
    setScrapedUpdates(prev => prev.map(update => {
      if (update.programId !== programId) return update;

      const newScraped = { ...update.scraped };
      // Handle different field types
      if (field === 'price_min' || field === 'price_max') {
        (newScraped as any)[field] = value ? parseFloat(value) : null;
      } else {
        (newScraped as any)[field] = value || null;
      }

      return { ...update, scraped: newScraped };
    }));
  };

  const getInputType = (field: string) => {
    if (field === 'price_min' || field === 'price_max') return 'number';
    if (field === 're_enrollment_date' || field === 'new_registration_date') return 'date';
    if (field === 'registration_url') return 'url';
    return 'text';
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Mass Update Programs</h1>
          <p className="text-gray-600 mt-2">
            Scrape websites to find updated information for multiple programs at once
          </p>
        </div>
        <Link href="/admin" className="btn-secondary">
          ← Back to Admin
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manual'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Manual Update
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scheduled'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Scheduled Updates
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            History
            {runningHistoryId && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Scrape in progress"></span>
            )}
          </button>
        </nav>
      </div>

      {/* Real-time Progress Banner */}
      {scrapeProgress && scrapeProgress.status === 'running' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="font-medium text-blue-900">Scraping in progress...</span>
            </div>
            <span className="text-blue-700 font-medium">{scrapeProgress.progress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${scrapeProgress.progress}%` }}
            ></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-blue-800">
            <span>Total: {scrapeProgress.total}</span>
            <span>Scraped: {scrapeProgress.scraped}</span>
            <span className="text-green-700">Updated: {scrapeProgress.updated}</span>
            <span className="text-red-700">Failed: {scrapeProgress.failed}</span>
          </div>
          {scrapeProgress.currentItem && (
            <div className="mt-2 text-sm text-blue-700">
              Currently processing: <span className="font-medium">{scrapeProgress.currentItem.programName}</span>
              <span className="text-blue-500"> ({scrapeProgress.currentItem.providerName})</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Update Tab */}
      {activeTab === 'manual' && scrapedUpdates.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Step 1: Select Programs to Update
          </h2>
          <p className="text-gray-600 mb-4">
            {programs.length} programs have website URLs.{' '}
            {(programTypeFilter || categoryFilter) && `Showing ${filteredPrograms.length}`}
            {programTypeFilter && ` ${PROGRAM_TYPE_LABELS[programTypeFilter]?.label || programTypeFilter}s`}
            {categoryFilter && ` in "${categoryFilter}"`}
            {(programTypeFilter || categoryFilter) && '.'}
          </p>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex gap-1">
              {([
                { value: '', label: 'All' },
                { value: 'program', label: 'Programs' },
                { value: 'camp', label: 'Camps' },
                { value: 'birthday_venue', label: 'Birthday' },
              ] as const).map(t => (
                <button
                  key={t.value}
                  onClick={() => { setProgramTypeFilter(t.value as string); setSelectedPrograms(new Set()); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    programTypeFilter === t.value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => { setCategoryFilter(''); setSelectedPrograms(new Set()); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  !categoryFilter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Categories
              </button>
              {[...DEFAULT_CATEGORIES, ...dbCategories].map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); setSelectedPrograms(new Set()); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    categoryFilter === cat
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-xs text-gray-400">{filteredPrograms.length} shown</span>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={toggleSelectAll}
              className="btn-secondary text-sm"
            >
              {selectedPrograms.size === filteredPrograms.length && filteredPrograms.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-gray-600">
              {selectedPrograms.size} selected
            </span>
            <button
              onClick={scrapeSelectedPrograms}
              disabled={selectedPrograms.size === 0 || scraping || updatingReviews}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scraping ? `Scraping ${progress.current}/${progress.total}...` : 'Scrape Websites'}
            </button>
            <button
              onClick={updateWithGoogle}
              disabled={selectedPrograms.size === 0 || scraping || updatingReviews || updatingFeatured}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingReviews ? `Updating ${reviewsProgress.current}/${reviewsProgress.total}...` : 'Update with Google'}
            </button>
            <button
              onClick={() => toggleFeatured(true)}
              disabled={selectedPrograms.size === 0 || scraping || updatingReviews || updatingFeatured}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              ⭐ Mark Featured
            </button>
            <button
              onClick={() => toggleFeatured(false)}
              disabled={selectedPrograms.size === 0 || scraping || updatingReviews || updatingFeatured}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              ☆ Unmark Featured
            </button>
          </div>

          {/* Scraping Progress */}
          {scraping && progress.total > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium text-blue-900">Scraping websites...</span>
                </div>
                <span className="text-blue-700 font-medium">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-blue-800">
                <span>Progress: {progress.current}/{progress.total}</span>
                <span className="text-green-700">Success: {progress.success}</span>
                <span className="text-red-700">Failed: {progress.failed}</span>
              </div>
              {progress.currentProgram && (
                <div className="mt-2 text-sm text-blue-700">
                  Currently scraping: <span className="font-medium">{progress.currentProgram}</span>
                </div>
              )}
            </div>
          )}

          <div className="max-h-[600px] overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedPrograms.size === filteredPrograms.length && filteredPrograms.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <SortableHeader field="name">Program</SortableHeader>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Address</th>
                  <SortableHeader field="provider_website">Website</SortableHeader>
                  <SortableHeader field="contact_email">Email</SortableHeader>
                  <SortableHeader field="contact_phone">Phone</SortableHeader>
                  <SortableHeader field="price_min">Price</SortableHeader>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Registration</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Hours</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Categories</th>
                  <SortableHeader field="is_featured">Featured</SortableHeader>
                  <SortableHeader field="updated_at">Updated</SortableHeader>
                  <SortableHeader field="google_rating">Rating</SortableHeader>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Place ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPrograms.map(program => (
                  <tr key={program.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPrograms.has(program.id)}
                        onChange={() => toggleSelect(program.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 max-w-[180px] truncate" title={program.name}>{program.name}</div>
                      <div className="text-sm text-gray-500 max-w-[180px] truncate" title={program.provider_name}>{program.provider_name}</div>
                    </td>
                    <td className="px-3 py-3">
                      {program.address ? (
                        <span className="text-gray-700 text-sm block truncate max-w-[180px]" title={program.address}>{program.address}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {program.provider_website ? (
                        <a
                          href={program.provider_website.startsWith('http') ? program.provider_website : `https://${program.provider_website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm max-w-[150px] truncate block"
                          title={program.provider_website}
                        >
                          {program.provider_website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {program.contact_email ? (
                        <a href={`mailto:${program.contact_email}`} className="text-blue-600 hover:text-blue-800 text-sm block truncate max-w-[150px]" title={program.contact_email}>
                          {program.contact_email}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {program.contact_phone ? (
                        <span className="text-gray-700 text-sm block truncate max-w-[120px]" title={program.contact_phone}>{program.contact_phone}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {(program.price_min || program.price_max) ? (
                        <div className="text-sm text-gray-700">
                          {program.price_min && program.price_max ? (
                            <span>${program.price_min} - ${program.price_max}</span>
                          ) : program.price_min ? (
                            <span>From ${program.price_min}</span>
                          ) : (
                            <span>Up to ${program.price_max}</span>
                          )}
                          {program.price_unit && (
                            <span className="text-gray-500 text-xs block">/{program.price_unit}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm space-y-0.5">
                        {program.registration_url && (
                          <a
                            href={program.registration_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs block"
                          >
                            Register →
                          </a>
                        )}
                        {program.new_registration_date && (
                          <span className="text-green-600 text-xs block" title="New registration date">
                            New: {new Date(program.new_registration_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {program.re_enrollment_date && (
                          <span className="text-amber-600 text-xs block" title="Re-enrollment date">
                            Re-enroll: {new Date(program.re_enrollment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {!program.registration_url && !program.new_registration_date && !program.re_enrollment_date && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {program.operating_days && program.operating_days.length > 0 ? (
                        <div className="text-xs text-gray-600">
                          <div className="flex flex-wrap gap-0.5">
                            {program.operating_days.slice(0, 3).map(day => (
                              <span key={day} className="px-1 py-0.5 bg-primary-50 text-primary-700 rounded capitalize">
                                {day.slice(0, 3)}
                              </span>
                            ))}
                            {program.operating_days.length > 3 && (
                              <span className="text-gray-400">+{program.operating_days.length - 3}</span>
                            )}
                          </div>
                          {program.hours_per_day && Object.keys(program.hours_per_day).length > 0 && (
                            <span className="text-green-600 text-[10px]" title="Has hours">✓ times</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
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
                    <td className="px-3 py-3 text-center">
                      {program.is_featured ? (
                        <span className="text-amber-500 text-lg" title="Featured">⭐</span>
                      ) : (
                        <span className="text-gray-300 text-lg" title="Not featured">☆</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-600">
                        {new Date(program.updated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-3">
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
                    <td className="px-3 py-3 text-center">
                      {program.google_place_id ? (
                        <span className="text-green-500 text-sm" title={program.google_place_id}>✓</span>
                      ) : (
                        <span className="text-red-400 text-sm" title="No Place ID">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 2: Review Changes */}
      {activeTab === 'manual' && scrapedUpdates.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Step 2: Review Scraped Changes
          </h2>

          {/* Scraping Progress - shown while still scraping */}
          {scraping && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-800">
                  🔄 Scraping in progress... ({progress.current} / {progress.total})
                </span>
                <span className="text-sm text-blue-600">
                  ✓ {progress.success} success, ✗ {progress.failed} failed
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              {progress.currentProgram && (
                <p className="text-sm text-blue-700 mt-2">
                  Currently scraping: <span className="font-medium">{progress.currentProgram}</span>
                </p>
              )}
              <p className="text-xs text-blue-600 mt-1">
                You can approve/reject items below while scraping continues
              </p>
            </div>
          )}

          {/* Google Update Progress - shown while fetching Google data */}
          {updatingReviews && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-yellow-800">
                  🔄 Fetching Google data... ({reviewsProgress.current} / {reviewsProgress.total})
                </span>
                <span className="text-sm text-yellow-600">
                  ✓ {reviewsProgress.success} success, ✗ {reviewsProgress.failed} failed
                </span>
              </div>
              <div className="w-full bg-yellow-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${reviewsProgress.total > 0 ? (reviewsProgress.current / reviewsProgress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                You can approve/reject items below while fetching continues
              </p>
            </div>
          )}

          {/* Featured Programs Warning */}
          {(featuredPendingCount > 0 || featuredApprovedCount > 0) && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
              <span className="text-amber-500 text-lg">⚠️</span>
              <div>
                <p className="font-medium text-amber-800">
                  Featured Programs Detected
                </p>
                <p className="text-sm text-amber-700">
                  {featuredPendingCount > 0 && (
                    <span><strong>{featuredPendingCount}</strong> featured program{featuredPendingCount !== 1 ? 's' : ''} pending review. </span>
                  )}
                  {featuredApprovedCount > 0 && (
                    <span><strong>{featuredApprovedCount}</strong> featured program{featuredApprovedCount !== 1 ? 's' : ''} approved for update. </span>
                  )}
                  Changes to featured programs are visible to all users.
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg">
              <span className="font-bold">{pendingCount}</span> pending review
            </div>
            <div className="bg-green-50 text-green-800 px-4 py-2 rounded-lg">
              <span className="font-bold">{approvedCount}</span> approved
            </div>
            <div className="bg-red-50 text-red-800 px-4 py-2 rounded-lg">
              <span className="font-bold">{rejectedCount}</span> rejected
            </div>
            <div className="bg-gray-50 text-gray-800 px-4 py-2 rounded-lg">
              <span className="font-bold">{noChangesCount}</span> no changes
            </div>
            {errorCount > 0 && (
              <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg">
                <span className="font-bold">{errorCount}</span> errors
              </div>
            )}
          </div>

          {/* Changes List */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {scrapedUpdates
              .filter(u => u.changes.length > 0 || u.status === 'error')
              .map(update => (
                <div
                  key={update.programId}
                  className={`border rounded-lg p-4 ${
                    update.status === 'approved' ? 'border-green-300 bg-green-50' :
                    update.status === 'rejected' ? 'border-red-300 bg-red-50' :
                    update.status === 'error' ? 'border-red-300 bg-red-50' :
                    'border-yellow-300 bg-yellow-50'
                  }`}
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{update.programName}</h3>
                      {update.isFeatured && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                          ⭐ Featured
                        </span>
                      )}
                    </div>
                    {update.isFeatured && update.status === 'pending' && (
                      <p className="text-amber-600 text-xs mt-1">
                        ⚠️ This is a featured program - changes will be visible to all users
                      </p>
                    )}
                    {update.status === 'error' && (
                      <p className="text-red-600 text-sm">{update.error}</p>
                    )}
                  </div>

                  {update.changes.length > 0 && (
                    <div className="space-y-3">
                      {update.changes.map(field => {
                        // Always: Current on left, New/Google on right
                        const isGoogle = update.source === 'google';
                        const leftLabel = 'Current:';
                        const rightLabel = isGoogle ? 'Google:' : 'New:';
                        const leftValue = update.original[field as keyof Program];
                        const rightValue = update.scraped[field as keyof Program];

                        // Determine which value is currently selected
                        const fieldSelection = update.fieldSelections?.[field] || 'new';
                        const leftSelected = fieldSelection === 'current';
                        const rightSelected = fieldSelection === 'new';

                        // Check if this is a "data loss" scenario (we have data, Google doesn't)
                        const isDataLoss = isGoogle &&
                          (field === 'hours_per_day' || field === 'operating_days') &&
                          update.original[field as keyof Program] &&
                          !update.scraped[field as keyof Program];

                        const canToggle = update.status === 'pending';

                        return (
                          <div key={field} className="text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700">{formatFieldName(field)}:</span>
                              {isGoogle && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Google</span>
                              )}
                              {isDataLoss && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">⚠️ Would lose data</span>
                              )}
                              {canToggle && (
                                <span className="text-gray-400 text-xs ml-auto">Click to select value</span>
                              )}
                            </div>
                            <div className="ml-4 grid grid-cols-2 gap-4 mt-1">
                              {/* Left column */}
                              <div
                                onClick={() => canToggle && toggleFieldSelection(update.programId, field)}
                                className={`p-2 rounded border-2 transition-all ${
                                  canToggle ? 'cursor-pointer hover:shadow-md' : ''
                                } ${
                                  leftSelected
                                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                    : 'border-transparent bg-gray-50 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500 text-xs">{leftLabel}</span>
                                  {leftSelected && (
                                    <span className="text-green-600 text-xs font-medium">✓ Selected</span>
                                  )}
                                </div>
                                <div className={leftSelected ? 'text-green-700 font-medium' : 'text-gray-500'}>
                                  {formatValue(leftValue, field)}
                                </div>
                              </div>
                              {/* Right column */}
                              <div
                                onClick={() => canToggle && toggleFieldSelection(update.programId, field)}
                                className={`p-2 rounded border-2 transition-all ${
                                  canToggle ? 'cursor-pointer hover:shadow-md' : ''
                                } ${
                                  rightSelected
                                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                    : 'border-transparent bg-gray-50 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500 text-xs">{rightLabel}</span>
                                  {rightSelected && (
                                    <span className="text-green-600 text-xs font-medium">✓ Selected</span>
                                  )}
                                </div>
                                {!isGoogle && update.status === 'pending' && field !== 'hours_per_day' && field !== 'operating_days' ? (
                                  field === 'description' ? (
                                    <textarea
                                      value={String(update.scraped[field as keyof Program] ?? '')}
                                      onChange={(e) => updateScrapedValue(update.programId, field, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                      rows={3}
                                    />
                                  ) : (
                                    <input
                                      type={getInputType(field)}
                                      value={String(update.scraped[field as keyof Program] ?? '')}
                                      onChange={(e) => updateScrapedValue(update.programId, field, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                    />
                                  )
                                ) : (
                                  <div className={rightSelected ? 'text-green-700 font-medium' : 'text-gray-500'}>
                                    {formatValue(rightValue, field)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200">
                    {update.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveUpdate(update.programId)}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium text-sm"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => rejectUpdate(update.programId)}
                          className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium text-sm"
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {update.status === 'approved' && update.changes.length > 0 && (
                      <span className="text-green-600 font-medium text-sm">✓ Approved</span>
                    )}
                    {update.status === 'rejected' && (
                      <span className="text-red-600 font-medium text-sm">✗ Rejected</span>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={approveAll}
              disabled={pendingCount === 0}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Approve All Pending
            </button>
            <button
              onClick={rejectAll}
              disabled={pendingCount === 0}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Reject All Pending
            </button>
            <button
              onClick={applyApprovedUpdates}
              disabled={approvedCount === 0 || applying}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {applying ? 'Applying...' : `Apply ${approvedCount} Approved Updates`}
            </button>
            <button
              onClick={() => {
                setScrapedUpdates([]);
                setSelectedPrograms(new Set());
              }}
              className="text-gray-600 hover:text-gray-800"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Scheduled Updates Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-6">
          {/* Create New Schedule */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Create Scheduled Update
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newSchedule.name}
                  onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                  className="input-field w-full"
                  placeholder="Scheduled Provider Update"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Type</label>
                <select
                  value={newSchedule.schedule_type}
                  onChange={(e) => setNewSchedule({ ...newSchedule, schedule_type: e.target.value as 'once' | 'daily' | 'weekly' | 'monthly' })}
                  className="input-field w-full"
                >
                  <option value="once">Run Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={newSchedule.scheduled_time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, scheduled_time: e.target.value })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Pages to Crawl</label>
                <input
                  type="number"
                  value={newSchedule.max_pages}
                  onChange={(e) => setNewSchedule({ ...newSchedule, max_pages: parseInt(e.target.value) || 10 })}
                  className="input-field w-full"
                  min="1"
                  max="50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Crawl Depth</label>
                <input
                  type="number"
                  value={newSchedule.max_depth}
                  onChange={(e) => setNewSchedule({ ...newSchedule, max_depth: parseInt(e.target.value) || 2 })}
                  className="input-field w-full"
                  min="1"
                  max="5"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSchedule.only_missing}
                    onChange={(e) => setNewSchedule({ ...newSchedule, only_missing: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Only scrape programs with missing info</span>
                </label>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={createScheduledJob}
                disabled={creatingSchedule || !newSchedule.scheduled_time}
                className="btn-primary disabled:opacity-50"
              >
                {creatingSchedule ? 'Creating...' : 'Create Scheduled Job'}
              </button>
            </div>
          </div>

          {/* Scheduled Jobs List */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Scheduled Jobs
            </h2>
            {scheduledJobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No scheduled jobs yet. Create one above.</p>
            ) : (
              <div className="space-y-4">
                {scheduledJobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{job.name}</h3>
                      <div className="text-sm text-gray-500 mt-1">
                        <span className="capitalize">{job.schedule_type}</span>
                        {' • '}
                        {job.next_run_at && (
                          <>
                            Next run: {new Date(job.next_run_at).toLocaleString()}
                          </>
                        )}
                        {' • '}
                        Max {job.max_pages} pages, depth {job.max_depth}
                        {job.only_missing && ' • Only missing'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        job.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {job.status}
                      </span>
                      <button
                        onClick={() => runScrapeNow()}
                        disabled={scraping}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Run Now
                      </button>
                      <button
                        onClick={() => deleteScheduledJob(job.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Update History
            </h2>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="btn-secondary text-sm"
            >
              {loadingHistory ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No scrape history yet.</p>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div
                  key={record.id}
                  className={`border rounded-lg p-4 ${
                    record.id === runningHistoryId ? 'border-blue-300 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          record.status === 'running' ? 'bg-blue-100 text-blue-800' :
                          record.status === 'completed' ? 'bg-green-100 text-green-800' :
                          record.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.status}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{record.run_type}</span>
                        {record.id === runningHistoryId && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Started: {new Date(record.started_at).toLocaleString()}
                        {record.completed_at && (
                          <> • Completed: {new Date(record.completed_at).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-gray-600">Total: {record.total_programs}</span>
                    <span className="text-gray-600">Scraped: {record.programs_scraped}</span>
                    <span className="text-green-600">Updated: {record.programs_updated}</span>
                    <span className="text-red-600">Failed: {record.programs_failed}</span>
                  </div>
                  {record.status === 'running' && scrapeProgress && record.id === runningHistoryId && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${scrapeProgress.progress}%` }}
                        ></div>
                      </div>
                      {scrapeProgress.recentItems && scrapeProgress.recentItems.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Recent: {scrapeProgress.recentItems.slice(0, 3).map((item, i) => (
                            <span key={i} className={item.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                              {i > 0 && ', '}
                              {item.programName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {record.error_message && (
                    <p className="text-red-600 text-sm mt-2">{record.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
