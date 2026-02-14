'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { DateRangePicker } from '@/components/DateInput';
import { useRegion } from '@/contexts/RegionContext';

interface CampFiltersProps {
  onFilterChange: (filters: CampFilterState) => void;
}

export interface CampFilterState {
  query: string;
  season: string[];
  daysFormat: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  neighborhood: string[];
  priceMin: number | null;
  priceMax: number | null;
  ageMin: number | null;
  ageMax: number | null;
  hoursStart: string | null;
  hoursEnd: string | null;
  includeExtendedCare: boolean;
  category: string[];
  address: string;
  distanceMiles: number;
  userLat?: number;
  userLng?: number;
  sfOnly: boolean;
  sfNeighborhoods: string[];
}

export const CAMP_SEASONS = [
  { value: 'summer', label: 'Summer', emoji: '☀️' },
  { value: 'spring', label: 'Spring Break', emoji: '🌸' },
  { value: 'fall', label: 'Fall Break', emoji: '🍂' },
  { value: 'winter', label: 'Winter Break', emoji: '❄️' },
];

export const DAYS_FORMATS = [
  { value: 'daily', label: 'Daily Drop-in', emoji: '📆' },
  { value: 'weekly', label: 'Week-by-Week', emoji: '📅' },
];

const STORAGE_KEY_PREFIX = 'camps-filters';

const defaultFilters: CampFilterState = {
  query: '',
  season: [],
  daysFormat: null,
  dateFrom: null,
  dateTo: null,
  neighborhood: [],
  priceMin: null,
  priceMax: null,
  ageMin: null,
  ageMax: null,
  hoursStart: null,
  hoursEnd: null,
  includeExtendedCare: true,
  category: [],
  address: '',
  distanceMiles: 5,
  sfOnly: true,
  sfNeighborhoods: [],
};

// Format time for display
const formatTimeDisplay = (time: string | null) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`;
};

export default function CampFilters({ onFilterChange }: CampFiltersProps) {
  const { region } = useRegion();
  const STORAGE_KEY = `${region.slug}-${STORAGE_KEY_PREFIX}`;
  const [filters, setFilters] = useState<CampFilterState>(defaultFilters);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [sfNeighborhoodNames, setSfNeighborhoodNames] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [sheetDragY, setSheetDragY] = useState(0);

  // Fetch unique neighborhoods from the database (scoped to current region)
  useEffect(() => {
    const fetchNeighborhoods = async () => {
      try {
        let query = supabase
          .from('program_locations')
          .select('neighborhood, programs!inner(program_type, status)')
          .eq('programs.program_type', 'camp')
          .eq('programs.status', 'active');
        if (region.id) {
          query = query.eq('region_id', region.id);
        }
        const { data, error } = await query;

        if (error) throw error;

        // Extract unique neighborhoods and sort them
        const uniqueNeighborhoods = [...new Set(
          (data || [])
            .map((loc: { neighborhood: string }) => loc.neighborhood)
            .filter((n: string) => n && n.trim() !== '')
        )].sort();

        setNeighborhoods(uniqueNeighborhoods);
      } catch (err) {
        console.error('Error fetching neighborhoods:', err);
      }
    };

    fetchNeighborhoods();

    // SF neighborhoods via coordinate bounding box (neighborhoods table city column is unreliable)
    const fetchSfNeighborhoods = async () => {
      try {
        let query = supabase
          .from('program_locations')
          .select('neighborhood')
          .gte('latitude', 37.70)
          .lte('latitude', 37.84)
          .gte('longitude', -122.52)
          .lte('longitude', -122.35);
        if (region.id) {
          query = query.eq('region_id', region.id);
        }
        const { data, error } = await query;
        if (error) throw error;
        const names = [...new Set(
          (data || [])
            .map((loc: { neighborhood: string }) => loc.neighborhood)
            .filter((n: string) => n && n.trim() !== '')
        )].sort();
        setSfNeighborhoodNames(names);
      } catch (err) {
        console.error('Error fetching SF neighborhoods:', err);
      }
    };
    fetchSfNeighborhoods();

    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('programs')
          .select('category')
          .eq('program_type', 'camp')
          .eq('status', 'active')
          .is('merged_into', null);

        if (error) throw error;

        const uniqueCats = [...new Set(
          (data || [])
            .flatMap((p: { category: string[] }) => p.category || [])
            .filter((c: string) => c && c.trim() !== '')
        )].sort();

        setCategories(uniqueCats);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };

    fetchCategories();
  }, [region.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load cached filters from localStorage on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CampFilterState;
        const validSeasons = CAMP_SEASONS.map(s => s.value);
        const sanitized: CampFilterState = {
          ...defaultFilters,
          ...parsed,
          season: (parsed.season || []).filter(s => validSeasons.includes(s)),
          daysFormat: parsed.daysFormat && ['daily', 'weekly'].includes(parsed.daysFormat) ? parsed.daysFormat : null,
        };
        setFilters(sanitized);
        onFilterChange(sanitized);
      }
    } catch (err) {
      console.error('Error loading cached filters:', err);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [onFilterChange]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (!initialLoadDone.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (err) {
      console.error('Error saving filters:', err);
    }
  }, [filters]);

  // Push SF neighborhood names into filter state so the page filter function can use them
  useEffect(() => {
    if (sfNeighborhoodNames.length === 0) return;
    setFilters(prev => {
      const updated = { ...prev, sfNeighborhoods: sfNeighborhoodNames };
      onFilterChange(updated);
      return updated;
    });
  }, [sfNeighborhoodNames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close sheet on outside click
  useEffect(() => {
    if (!isSheetOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        setIsSheetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSheetOpen]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSheetOpen]);

  const updateFilters = (updates: Partial<CampFilterState>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Drag-to-close handlers for the mobile sheet
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setSheetDragY(dy); // only allow dragging down
  };
  const handleTouchEnd = () => {
    if (sheetDragY > 120) {
      setIsSheetOpen(false);
    }
    setSheetDragY(0);
    dragStartY.current = null;
  };

  const toggleSeason = (season: string) => {
    const newSeasons = filters.season.includes(season)
      ? filters.season.filter(s => s !== season)
      : [...filters.season, season];
    updateFilters({ season: newSeasons });
  };

  const toggleSfOnly = () => {
    updateFilters({ sfOnly: !filters.sfOnly, neighborhood: [] });
  };

  const toggleNeighborhood = (neighborhood: string) => {
    const newNeighborhoods = filters.neighborhood.includes(neighborhood)
      ? filters.neighborhood.filter(n => n !== neighborhood)
      : [...filters.neighborhood, neighborhood];
    updateFilters({ neighborhood: newNeighborhoods });
  };

  // Filter displayed neighborhoods based on SF Only toggle
  const displayedNeighborhoods = filters.sfOnly
    ? neighborhoods.filter(n => sfNeighborhoodNames.includes(n))
    : neighborhoods;

  const toggleCategory = (cat: string) => {
    const newCats = filters.category.includes(cat)
      ? filters.category.filter(c => c !== cat)
      : [...filters.category, cat];
    updateFilters({ category: newCats });
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
    localStorage.removeItem(STORAGE_KEY);
  };

  const geocodeAddress = async (address: string) => {
    if (!address.trim()) {
      updateFilters({ address: '', userLat: undefined, userLng: undefined });
      return;
    }

    setGeocoding(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey) return;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${address}, ${region.name}`)}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results?.length > 0) {
        const location = data.results[0].geometry.location;
        updateFilters({ address, userLat: location.lat, userLng: location.lng });
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  // Calculate active filter count
  const activeFilterCount =
    filters.season.length +
    (filters.daysFormat ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    filters.neighborhood.length +
    filters.category.length +
    (filters.priceMin !== null ? 1 : 0) +
    (filters.priceMax !== null ? 1 : 0) +
    (filters.ageMin !== null ? 1 : 0) +
    (filters.ageMax !== null ? 1 : 0) +
    (filters.hoursStart !== null ? 1 : 0) +
    (filters.hoursEnd !== null ? 1 : 0) +
    (filters.userLat ? 1 : 0);

  return (
    <>
      {/* Compact Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-3 sm:p-4">
        {/* Search Input */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search camps..."
            className="w-full pl-10 pr-10 py-3 bg-green-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
            value={filters.query}
            onChange={(e) => updateFilters({ query: e.target.value })}
          />
          {filters.query && (
            <button
              onClick={() => updateFilters({ query: '' })}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Quick Filter Pills & Filter Button */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* Filter Button */}
          <button
            onClick={() => setIsSheetOpen(true)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeFilterCount > 0
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-green-600 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px]">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* SF Only Toggle */}
          <button
            onClick={toggleSfOnly}
            className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-all ${
              filters.sfOnly
                ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            SF Only
          </button>

          {/* Days Format Pills */}
          {DAYS_FORMATS.map((format) => (
            <button
              key={format.value}
              onClick={() => updateFilters({ daysFormat: filters.daysFormat === format.value ? null : format.value })}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                filters.daysFormat === format.value
                  ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {format.label}
            </button>
          ))}

          {/* Price Range Pill */}
          <button
            onClick={() => { setIsSheetOpen(true); setExpandedSections(prev => new Set([...prev, 'price'])); }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
              filters.priceMin !== null || filters.priceMax !== null
                ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filters.priceMin !== null || filters.priceMax !== null
              ? `$${filters.priceMin ?? 0}–$${filters.priceMax ?? '∞'}`
              : 'Price Range'}
          </button>
        </div>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-green-100">
            {filters.season.map((s) => {
              const season = CAMP_SEASONS.find(cs => cs.value === s);
              return (
                <span key={s} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                  {season?.emoji} {season?.label}
                  <button onClick={() => toggleSeason(s)} className="hover:text-green-900">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
            {filters.daysFormat && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                {DAYS_FORMATS.find(f => f.value === filters.daysFormat)?.emoji} {DAYS_FORMATS.find(f => f.value === filters.daysFormat)?.label}
                <button onClick={() => updateFilters({ daysFormat: null })} className="hover:text-green-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {(filters.dateFrom || filters.dateTo) && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                {filters.dateFrom && new Date(filters.dateFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {filters.dateFrom && filters.dateTo && ' – '}
                {filters.dateTo && new Date(filters.dateTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                <button onClick={() => updateFilters({ dateFrom: null, dateTo: null })} className="hover:text-green-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filters.neighborhood.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                📍 {n}
                <button onClick={() => toggleNeighborhood(n)} className="hover:text-blue-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {filters.category.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                {cat}
                <button onClick={() => toggleCategory(cat)} className="hover:text-purple-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {(filters.ageMin !== null || filters.ageMax !== null) && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                👶 Ages {filters.ageMin || 0} - {filters.ageMax || 18}
                <button onClick={() => updateFilters({ ageMin: null, ageMax: null })} className="hover:text-purple-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {(filters.hoursStart !== null || filters.hoursEnd !== null) && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                🕐 {formatTimeDisplay(filters.hoursStart)} - {formatTimeDisplay(filters.hoursEnd)}
                <button onClick={() => updateFilters({ hoursStart: null, hoursEnd: null })} className="hover:text-orange-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {filters.userLat && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                📍 {filters.distanceMiles}mi away
                <button onClick={() => updateFilters({ address: '', userLat: undefined, userLng: undefined })} className="hover:text-orange-900">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-red-600 font-medium ml-auto">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sheet Overlay */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:max-h-[85vh]"
            style={sheetDragY > 0 ? { transform: `translateY(${sheetDragY}px)`, transition: 'none' } : undefined}
          >
            {/* Handle Bar — drag to close on mobile */}
            <div
              className="sm:hidden flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Camp Filters</h2>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-sm text-red-600 font-medium hover:text-red-700">
                    Clear all
                  </button>
                )}
                <button onClick={() => setIsSheetOpen(false)} className="p-2 -m-2 text-gray-500 hover:text-gray-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
              {/* Season */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Season</h3>
                <div className="flex flex-wrap gap-2">
                  {CAMP_SEASONS.map((season) => (
                    <button
                      key={season.value}
                      onClick={() => toggleSeason(season.value)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        filters.season.includes(season.value)
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {season.emoji} {season.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Days Format */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Schedule Format</h3>
                <div className="flex flex-wrap gap-2">
                  {DAYS_FORMATS.map((format) => (
                    <button
                      key={format.value}
                      onClick={() => updateFilters({ daysFormat: filters.daysFormat === format.value ? null : format.value })}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        filters.daysFormat === format.value
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {format.emoji} {format.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category (collapsible) */}
              {categories.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleSection('category')}
                    className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 mb-2"
                  >
                    <span>
                      Category
                      {filters.category.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {filters.category.length}
                        </span>
                      )}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has('category') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSections.has('category') && (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => toggleCategory(cat)}
                          className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            filters.category.includes(cat)
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Date Range */}
              <div>
                <DateRangePicker
                  startLabel="From"
                  endLabel="To"
                  startPlaceholder="Start date"
                  endPlaceholder="End date"
                  startValue={filters.dateFrom ?? ''}
                  endValue={filters.dateTo ?? ''}
                  onStartChange={(v) => updateFilters({ dateFrom: v || null })}
                  onEndChange={(v) => updateFilters({ dateTo: v || null })}
                  pastMonths={1}
                  futureMonths={12}
                />
              </div>

              {/* Hours & Care */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Hours</h3>
                  <button
                    onClick={() => updateFilters({ includeExtendedCare: !filters.includeExtendedCare })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filters.includeExtendedCare
                        ? 'bg-green-100 text-green-700 ring-1 ring-green-400'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {filters.includeExtendedCare ? '✓ ' : ''}Before / After Care
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Drop-off</label>
                    <input
                      type="time"
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                      value={filters.hoursStart ?? ''}
                      onChange={(e) => updateFilters({ hoursStart: e.target.value || null })}
                    />
                  </div>
                  <span className="text-gray-400 pt-5">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Pick-up</label>
                    <input
                      type="time"
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                      value={filters.hoursEnd ?? ''}
                      onChange={(e) => updateFilters({ hoursEnd: e.target.value || null })}
                    />
                  </div>
                </div>
              </div>

              {/* Age Range */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Age Range</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Min Age</label>
                    <input
                      type="number"
                      min="0"
                      max="18"
                      placeholder="0"
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                      value={filters.ageMin ?? ''}
                      onChange={(e) => updateFilters({ ageMin: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                  <span className="text-gray-400 pt-5">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Max Age</label>
                    <input
                      type="number"
                      min="0"
                      max="18"
                      placeholder="18"
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                      value={filters.ageMax ?? ''}
                      onChange={(e) => updateFilters({ ageMax: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </div>
              </div>

              {/* Price Range */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Price Range</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => updateFilters({ priceMin: 0, priceMax: 0 })}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      filters.priceMin === 0 && filters.priceMax === 0
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Free
                  </button>
                  <button
                    onClick={() => updateFilters({ priceMin: null, priceMax: 500 })}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      filters.priceMax === 500
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Under $500
                  </button>
                  <button
                    onClick={() => updateFilters({ priceMin: null, priceMax: 1000 })}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      filters.priceMax === 1000
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Under $1000
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Min</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                        value={filters.priceMin ?? ''}
                        onChange={(e) => updateFilters({ priceMin: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                  </div>
                  <span className="text-gray-400 pt-5">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Max</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Any"
                        className="w-full pl-7 pr-3 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                        value={filters.priceMax ?? ''}
                        onChange={(e) => updateFilters({ priceMax: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Near an Address</h3>
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Enter address or zip code..."
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                    value={filters.address}
                    onChange={(e) => updateFilters({ address: e.target.value })}
                    onBlur={(e) => geocodeAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && geocodeAddress(filters.address)}
                  />
                  {geocoding && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-5 w-5 border-2 border-green-600 border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 3, 5, 10].map((miles) => (
                    <button
                      key={miles}
                      onClick={() => updateFilters({ distanceMiles: miles })}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        filters.distanceMiles === miles
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {miles} mile{miles !== 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Neighborhoods */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => toggleSection('neighborhood')}
                    className="flex items-center gap-1 text-sm font-semibold text-gray-900"
                  >
                    <span>
                      Neighborhoods
                      {filters.neighborhood.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {filters.neighborhood.length}
                        </span>
                      )}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has('neighborhood') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={toggleSfOnly}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filters.sfOnly
                        ? 'bg-green-100 text-green-700 ring-1 ring-green-400'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {filters.sfOnly ? '\u2713 ' : ''}SF Only
                  </button>
                </div>
                {expandedSections.has('neighborhood') && (
                  displayedNeighborhoods.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Loading neighborhoods...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {displayedNeighborhoods.map((n) => (
                        <button
                          key={n}
                          onClick={() => toggleNeighborhood(n)}
                          className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${
                            filters.neighborhood.includes(n)
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

            </div>

            {/* Footer — extra bottom padding on mobile to clear the bottom nav */}
            <div className="flex-shrink-0 px-5 pt-4 pb-20 sm:pb-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setIsSheetOpen(false)}
                className="w-full py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg"
              >
                Show Camps
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
