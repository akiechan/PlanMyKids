// Shared region utilities for multi-region support

import { createClient } from '@supabase/supabase-js';

export const DEFAULT_REGION_SLUG = 'sf-bay-area';

export interface Region {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  is_active: boolean;
}

// Default SF region used as fallback when DB is unavailable
export const SF_REGION: Region = {
  id: '',
  slug: 'sf-bay-area',
  name: 'San Francisco Bay Area',
  short_name: 'SF Bay Area',
  center_lat: 37.7749,
  center_lng: -122.4194,
  default_zoom: 12,
  is_active: true,
};

// In-memory cache for regions (they rarely change)
let regionsCache: { data: Region[]; ts: number } | null = null;
const REGIONS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url: any, options: any = {}) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}

export async function getActiveRegions(): Promise<Region[]> {
  if (regionsCache && Date.now() - regionsCache.ts < REGIONS_CACHE_TTL) {
    return regionsCache.data;
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('regions')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error || !data) {
      console.error('[Regions] Failed to fetch:', error);
      return [SF_REGION];
    }

    regionsCache = { data, ts: Date.now() };
    return data;
  } catch {
    return [SF_REGION];
  }
}

export async function getRegionBySlug(slug: string): Promise<Region | null> {
  const regions = await getActiveRegions();
  return regions.find(r => r.slug === slug) || null;
}

export async function getRegionById(id: string): Promise<Region | null> {
  const regions = await getActiveRegions();
  return regions.find(r => r.id === id) || null;
}

export async function getDefaultRegion(): Promise<Region> {
  const region = await getRegionBySlug(DEFAULT_REGION_SLUG);
  return region || SF_REGION;
}

export function getDefaultCoords(region: Region): { lat: number; lng: number } {
  return { lat: region.center_lat, lng: region.center_lng };
}
