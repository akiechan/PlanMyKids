'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Program, ProgramLocation } from '@/types/database';
import ProgramCard from '@/components/ProgramCard';
import SearchFilters, { FilterState } from '@/components/SearchFilters';
import { useAuth } from '@/contexts/AuthContext';
import { useRegion } from '@/contexts/RegionContext';
import { programsFetcher } from '@/lib/fetchers';
import { useGridColumns } from '@/hooks/useGridColumns';
import GridSizeControl from '@/components/GridSizeControl';

// Extended type for programs with location data from Supabase join
type ProgramWithLocations = Program & {
  program_locations?: ProgramLocation[];
};

// Deduplicate programs by name - keep the one with best data quality
function deduplicateByName(programs: ProgramWithLocations[]): ProgramWithLocations[] {
  const seen = new Map<string, ProgramWithLocations>();

  for (const program of programs) {
    const normalizedName = program.name.toLowerCase().trim();
    const existing = seen.get(normalizedName);

    if (!existing) {
      seen.set(normalizedName, program);
      continue;
    }

    // Compare and keep the better one
    const existingScore = getDataQualityScore(existing);
    const newScore = getDataQualityScore(program);

    if (newScore > existingScore) {
      seen.set(normalizedName, program);
    }
  }

  return Array.from(seen.values());
}

function getDataQualityScore(program: ProgramWithLocations): number {
  let score = 0;
  if (program.google_rating) score += program.google_rating * 10;
  if (program.google_review_count) score += Math.min(program.google_review_count, 100);
  if (program.program_locations && program.program_locations.length > 0) score += 50;
  if (program.description && program.description.length > 50) score += 20;
  if (program.price_min != null) score += 10;
  if (program.age_min != null) score += 10;
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
function filterPrograms(programs: ProgramWithLocations[], filters: FilterState): ProgramWithLocations[] {
  let filtered = programs;

  // Text search
  if (filters.query) {
    const query = filters.query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  }

  // Category filter
  if (filters.category.length > 0) {
    filtered = filtered.filter((p) =>
      p.category.some((cat) => filters.category.includes(cat))
    );
  }

  // Neighborhood filter
  if (filters.neighborhood.length > 0) {
    filtered = filtered.filter((p) => {
      if (!p.program_locations || p.program_locations.length === 0) return false;
      return p.program_locations.some((loc) =>
        filters.neighborhood.includes(loc.neighborhood)
      );
    });
  }

  // Price range filter
  if (filters.priceMin !== null || filters.priceMax !== null) {
    filtered = filtered.filter((p) => {
      const programMin = p.price_min ?? 0;
      const programMax = p.price_max ?? p.price_min ?? 0;

      if (filters.priceMin !== null && filters.priceMax !== null) {
        return programMin <= filters.priceMax && programMax >= filters.priceMin;
      } else if (filters.priceMin !== null) {
        return programMax >= filters.priceMin;
      } else if (filters.priceMax !== null) {
        return programMin <= filters.priceMax;
      }
      return true;
    });
  }

  // Rating filter
  if (filters.minRating !== null && filters.minRating !== undefined) {
    filtered = filtered.filter((p) =>
      p.google_rating !== null && p.google_rating >= filters.minRating!
    );
  }

  // Location-based filter
  if (filters.userLat && filters.userLng) {
    filtered = filtered.filter((p) => {
      if (!p.program_locations || p.program_locations.length === 0) return false;

      return p.program_locations.some((location) => {
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
function sortPrograms(programs: ProgramWithLocations[]): ProgramWithLocations[] {
  return [...programs].sort((a, b) => {
    const aFeatured = a.is_featured === true;
    const bFeatured = b.is_featured === true;
    if (aFeatured && !bFeatured) return -1;
    if (!aFeatured && bFeatured) return 1;
    return (b.google_rating || 0) - (a.google_rating || 0);
  });
}

export default function ProgramsPage() {
  const { user } = useAuth();
  const { region } = useRegion();
  const { columns, increment, decrement, canIncrement, canDecrement, gridStyle } = useGridColumns('programs');
  // Only true user input lives in state — filter selections
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(null);

  // SWR: single source of truth for server data (region-aware key)
  const { data: rawPrograms, isLoading: loading } = useSWR(
    region.id ? `programs-active-list-${region.slug}` : 'programs-active-list',
    () => programsFetcher(`programs-active-list-${region.slug}`, region.id || undefined),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    }
  );

  // Derived: deduplicate
  const programs = useMemo(() => {
    if (!rawPrograms) return [];
    return deduplicateByName(rawPrograms as ProgramWithLocations[]);
  }, [rawPrograms]);

  // Derived: filter + sort — recomputes synchronously when either input changes.
  // No race condition possible (unlike the old setState + useEffect approach).
  const displayPrograms = useMemo(() => {
    const base = currentFilters ? filterPrograms(programs, currentFilters) : programs;
    return sortPrograms(base);
  }, [programs, currentFilters]);

  // Derived: split featured / regular
  const { featuredPrograms, regularPrograms } = useMemo(() => {
    const featured = displayPrograms.filter(p => p.is_featured === true);
    const regular = displayPrograms.filter(p => p.is_featured !== true);
    return { featuredPrograms: featured, regularPrograms: regular };
  }, [displayPrograms]);

  return (
    <div className="bg-gradient-to-b from-primary-50 to-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
            Kids' Programs
          </h1>
        </div>

        {/* Filters */}
        <SearchFilters onFilterChange={setCurrentFilters} />

        {/* Results Count */}
        <div className="mt-8 flex items-center justify-between">
          <p className="text-gray-600">
            {loading ? (
              'Loading programs...'
            ) : (
              <>
                <span className="font-semibold text-gray-900">
                  {displayPrograms.length}
                </span>{' '}
                program{displayPrograms.length !== 1 ? 's' : ''} found
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
          // Loading skeletons
          <div className="mt-8 grid gap-6 pb-12" style={gridStyle}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-96 animate-pulse">
                <div className="bg-gray-200 h-48 w-full" />
                <div className="p-6 space-y-3">
                  <div className="bg-gray-200 h-4 w-3/4 rounded" />
                  <div className="bg-gray-200 h-4 w-full rounded" />
                  <div className="bg-gray-200 h-4 w-5/6 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayPrograms.length === 0 ? (
          <div className="mt-8 text-center py-12">
            <p className="text-xl text-gray-600">
              No programs found matching your criteria. Try adjusting your filters!
            </p>
          </div>
        ) : (
          <div className="mt-8 pb-12 space-y-6">
            {/* Featured Programs Row */}
            {featuredPrograms.length > 0 && (
              <div className="grid gap-6" style={gridStyle}>
                {featuredPrograms.map((program) => (
                  <ProgramCard key={program.id} program={program} />
                ))}
              </div>
            )}

            {/* Regular Programs Grid */}
            {regularPrograms.length > 0 && (
              <div className="grid gap-6" style={gridStyle}>
                {regularPrograms.map((program) => (
                  <ProgramCard key={program.id} program={program} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
