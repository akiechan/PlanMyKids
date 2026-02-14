'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Program, ProgramLocation } from '@/types/database';
import CampCard from '@/components/CampCard';
import CampFilters, { CampFilterState } from '@/components/CampFilters';
import { useAuth } from '@/contexts/AuthContext';
import { useRegion } from '@/contexts/RegionContext';
import { campsFetcher } from '@/lib/fetchers';
import { useGridColumns } from '@/hooks/useGridColumns';
import GridSizeControl from '@/components/GridSizeControl';

// Extended type for camps with location data from Supabase join
type CampWithLocations = Program & {
  program_locations?: ProgramLocation[];
};

// Deduplicate camps by name - keep the one with best data quality
// Priority: highest rating > most reviews > has locations > first found
function deduplicateByName(camps: CampWithLocations[]): CampWithLocations[] {
  const seen = new Map<string, CampWithLocations>();

  for (const camp of camps) {
    const normalizedName = camp.name.toLowerCase().trim();
    const existing = seen.get(normalizedName);

    if (!existing) {
      seen.set(normalizedName, camp);
      continue;
    }

    // Compare and keep the better one
    const existingScore = getDataQualityScore(existing);
    const newScore = getDataQualityScore(camp);

    if (newScore > existingScore) {
      seen.set(normalizedName, camp);
    }
  }

  return Array.from(seen.values());
}

// Score a camp based on data completeness
function getDataQualityScore(camp: CampWithLocations): number {
  let score = 0;
  if (camp.google_rating) score += camp.google_rating * 10;
  if (camp.google_review_count) score += Math.min(camp.google_review_count, 100);
  if (camp.program_locations && camp.program_locations.length > 0) score += 50;
  if (camp.description && camp.description.length > 50) score += 20;
  if (camp.price_min != null) score += 10;
  if (camp.age_min != null) score += 10;
  return score;
}

// Calculate distance between two coordinates in miles using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Pure filter function — no side effects, no setState
function filterCamps(camps: CampWithLocations[], filters: CampFilterState): CampWithLocations[] {
  let filtered = camps;

  // Text search
  if (filters.query) {
    const query = filters.query.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
    );
  }

  // Season filter
  if (filters.season.length > 0) {
    filtered = filtered.filter((c) =>
      c.camp_season && filters.season.includes(c.camp_season)
    );
  }

  // Days format filter - include camps with null format (they haven't been categorized yet)
  if (filters.daysFormat) {
    filtered = filtered.filter((c) =>
      c.camp_days_format === filters.daysFormat || c.camp_days_format === null
    );
  }

  // Category filter
  if (filters.category && filters.category.length > 0) {
    filtered = filtered.filter((c) => {
      if (!c.category || c.category.length === 0) return false;
      return c.category.some((cat: string) => filters.category.includes(cat));
    });
  }

  // Date range filter — camp must overlap with the user's from/to range
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const to = filters.dateTo ? new Date(filters.dateTo + 'T00:00:00') : null;

    filtered = filtered.filter((c) => {
      const campStart = c.start_date ? new Date(c.start_date + 'T00:00:00') : null;
      const campEnd = c.end_date ? new Date(c.end_date + 'T00:00:00') : null;

      // Camp must overlap with the user's date range
      if (from && campEnd && campEnd < from) return false;
      if (to && campStart && campStart > to) return false;

      return true;
    });
  }

  // SF Only + Neighborhood filter
  if (filters.sfOnly && filters.sfNeighborhoods && filters.sfNeighborhoods.length > 0) {
    const allowed = filters.neighborhood.length > 0
      ? filters.neighborhood
      : filters.sfNeighborhoods;
    filtered = filtered.filter((c) => {
      if (!c.program_locations || c.program_locations.length === 0) return false;
      return c.program_locations.some((loc) => allowed.includes(loc.neighborhood));
    });
  } else if (filters.neighborhood.length > 0) {
    filtered = filtered.filter((c) => {
      if (!c.program_locations || c.program_locations.length === 0) return false;
      return c.program_locations.some((loc) =>
        filters.neighborhood.includes(loc.neighborhood)
      );
    });
  }

  // Price range filter
  if (filters.priceMin !== null || filters.priceMax !== null) {
    filtered = filtered.filter((c) => {
      const campMin = c.price_min ?? 0;
      const campMax = c.price_max ?? c.price_min ?? 0;

      if (filters.priceMin !== null && filters.priceMax !== null) {
        return campMin <= filters.priceMax && campMax >= filters.priceMin;
      } else if (filters.priceMin !== null) {
        return campMax >= filters.priceMin;
      } else if (filters.priceMax !== null) {
        return campMin <= filters.priceMax;
      }
      return true;
    });
  }

  // Age range filter
  if (filters.ageMin !== null || filters.ageMax !== null) {
    filtered = filtered.filter((c) => {
      const campAgeMin = c.age_min ?? 0;
      const campAgeMax = c.age_max ?? 18;

      if (filters.ageMin !== null && filters.ageMax !== null) {
        return campAgeMin <= filters.ageMax && campAgeMax >= filters.ageMin;
      } else if (filters.ageMin !== null) {
        return campAgeMax >= filters.ageMin;
      } else if (filters.ageMax !== null) {
        return campAgeMin <= filters.ageMax;
      }
      return true;
    });
  }

  // Hours filter - "care starting at or after" and "care ending at or after" semantics
  if (filters.hoursStart || filters.hoursEnd) {
    filtered = filtered.filter((c) => {
      if (!c.hours_start || !c.hours_end) return true; // Include if no hours set

      const effectiveStart = filters.includeExtendedCare && c.before_care && c.before_care_start
        ? c.before_care_start
        : c.hours_start;
      const effectiveEnd = filters.includeExtendedCare && c.after_care && c.after_care_end
        ? c.after_care_end
        : c.hours_end;

      if (filters.hoursStart && filters.hoursEnd) {
        return effectiveStart >= filters.hoursStart && effectiveEnd >= filters.hoursEnd;
      } else if (filters.hoursStart) {
        return effectiveStart >= filters.hoursStart;
      } else if (filters.hoursEnd) {
        return effectiveEnd >= filters.hoursEnd;
      }
      return true;
    });
  }

  // Location-based filter
  if (filters.userLat && filters.userLng) {
    filtered = filtered.filter((c) => {
      if (!c.program_locations || c.program_locations.length === 0) return false;

      return c.program_locations.some((location) => {
        const distance = calculateDistance(
          filters.userLat!,
          filters.userLng!,
          location.latitude,
          location.longitude
        );
        return distance <= filters.distanceMiles;
      });
    });
  }

  return filtered;
}

// Sort: featured first, then by rating
function sortCamps(camps: CampWithLocations[]): CampWithLocations[] {
  return [...camps].sort((a, b) => {
    const aFeatured = a.is_featured === true;
    const bFeatured = b.is_featured === true;
    if (aFeatured && !bFeatured) return -1;
    if (!aFeatured && bFeatured) return 1;
    return (b.google_rating || 0) - (a.google_rating || 0);
  });
}

export default function CampsPage() {
  const { user } = useAuth();
  const { region } = useRegion();
  const { columns, increment, decrement, canIncrement, canDecrement, gridStyle } = useGridColumns('camps');
  // Only true user input lives in state — filter selections
  const [currentFilters, setCurrentFilters] = useState<CampFilterState | null>(null);

  // SWR: single source of truth for server data (region-aware URL)
  const campsUrl = region.slug ? `/api/camps?region=${region.slug}` : '/api/camps';
  const { data: rawCamps, isLoading: loading } = useSWR(
    campsUrl,
    campsFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    }
  );

  // Derived: deduplicate
  const camps = useMemo(() => {
    if (!rawCamps) return [];
    return deduplicateByName(rawCamps as CampWithLocations[]);
  }, [rawCamps]);

  // Derived: filter + sort — recomputes synchronously when either input changes.
  // No race condition possible (unlike the old setState + useEffect approach).
  const displayCamps = useMemo(() => {
    const base = currentFilters ? filterCamps(camps, currentFilters) : camps;
    return sortCamps(base);
  }, [camps, currentFilters]);

  // Derived: split featured / regular
  const { featuredCamps, regularCamps } = useMemo(() => {
    const featured = displayCamps.filter(c => c.is_featured === true);
    const regular = displayCamps.filter(c => c.is_featured !== true);
    return { featuredCamps: featured, regularCamps: regular };
  }, [displayCamps]);

  return (
    <div className="bg-gradient-to-b from-green-50 to-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
            Camps
          </h1>
        </div>

        {/* Filters */}
        <CampFilters onFilterChange={setCurrentFilters} />

        {/* Results Count */}
        <div className="mt-8 flex items-center justify-between">
          <p className="text-gray-600">
            {loading ? (
              'Loading camps...'
            ) : (
              <>
                <span className="font-semibold text-gray-900">
                  {displayCamps.length}
                </span>{' '}
                camp{displayCamps.length !== 1 ? 's' : ''} found
              </>
            )}
          </p>
          <GridSizeControl
            columns={columns}
            onIncrement={increment}
            onDecrement={decrement}
            canIncrement={canIncrement}
            canDecrement={canDecrement}
          />
        </div>

        {loading ? (
          // Loading skeletons with green tint
          <div className="mt-8 grid gap-6 pb-12" style={gridStyle}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-96 animate-pulse">
                <div className="bg-green-100 h-48 w-full" />
                <div className="p-6 space-y-3">
                  <div className="bg-green-100 h-4 w-3/4 rounded" />
                  <div className="bg-green-100 h-4 w-full rounded" />
                  <div className="bg-green-100 h-4 w-5/6 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayCamps.length === 0 ? (
          <div className="mt-8 text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🏕️</span>
            </div>
            <p className="text-xl text-gray-600 mb-4">
              No camps found matching your criteria.
            </p>
            <p className="text-gray-500">
              Try adjusting your filters or check back soon for new camps!
            </p>
          </div>
        ) : (
          <div className="mt-8 pb-12 space-y-6">
            {/* Featured Camps Row */}
            {featuredCamps.length > 0 && (
              <div className="grid gap-6" style={gridStyle}>
                {featuredCamps.map((camp) => (
                  <CampCard key={camp.id} program={camp} />
                ))}
              </div>
            )}

            {/* Regular Camps Grid */}
            {regularCamps.length > 0 && (
              <div className="grid gap-6" style={gridStyle}>
                {regularCamps.map((camp) => (
                  <CampCard key={camp.id} program={camp} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
