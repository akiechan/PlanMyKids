// DB-backed neighborhood alias lookup
// Replaces hardcoded SF_NEIGHBORHOOD_ALIASES maps

import { createClient } from '@supabase/supabase-js';

// In-memory cache keyed by region_id
const aliasCache = new Map<string, { data: Map<string, string>; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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

/**
 * Fetches neighborhood aliases for a region from the neighborhoods table.
 * Returns a Map<lowercase_alias_or_name, canonical_name>
 */
export async function getNeighborhoodAliases(regionId: string): Promise<Map<string, string>> {
  const cached = aliasCache.get(regionId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const aliasMap = new Map<string, string>();

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('neighborhoods')
      .select('name, aliases')
      .eq('region_id', regionId)
      .eq('is_canonical', true);

    if (error || !data) {
      console.error('[Neighborhoods] Failed to fetch aliases:', error);
      return aliasMap;
    }

    for (const row of data) {
      // Map canonical name (lowercased) to itself
      aliasMap.set(row.name.toLowerCase(), row.name);

      // Map each alias (lowercased) to canonical name
      if (row.aliases && Array.isArray(row.aliases)) {
        for (const alias of row.aliases) {
          aliasMap.set(alias.toLowerCase(), row.name);
        }
      }
    }

    aliasCache.set(regionId, { data: aliasMap, ts: Date.now() });
  } catch (err) {
    console.error('[Neighborhoods] Error fetching aliases:', err);
  }

  return aliasMap;
}

/**
 * Normalize a raw neighborhood string using DB aliases for a given region.
 * Falls back to the raw string if no match found.
 */
export async function normalizeNeighborhood(raw: string, regionId: string): Promise<string> {
  const aliases = await getNeighborhoodAliases(regionId);
  const lower = raw.toLowerCase().trim();
  return aliases.get(lower) || raw.trim();
}

/**
 * Get the list of "generic" neighborhood names for a region
 * (names that indicate the location wasn't properly geocoded).
 */
export function getGenericNeighborhoodNames(regionName: string): string[] {
  const lower = regionName.toLowerCase();
  // Always include empty/tbd, plus the region's city name variations
  const generics = ['', 'tbd'];

  // Add common abbreviations based on region
  if (lower.includes('san francisco')) {
    generics.push('san francisco', 'sf');
  } else if (lower.includes('los angeles')) {
    generics.push('los angeles', 'la');
  } else if (lower.includes('new york')) {
    generics.push('new york', 'nyc', 'ny');
  } else {
    // For any other region, add the full name lowercased
    generics.push(lower);
  }

  return generics;
}
