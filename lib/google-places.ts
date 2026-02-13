// Shared Google Places & Geocoding API utilities
// Consolidates API calls used across: google-reviews, google-place-details,
// google-neighborhood, admin/google-enrich routes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  reviews?: GoogleReview[];
  opening_hours?: {
    weekday_text: string[];
  };
  formatted_phone_number?: string;
  website?: string;
  url?: string; // Google Maps URL
}

export interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number; // Unix timestamp
  relative_time_description: string;
}

export interface GeocodeResult {
  formatted_address: string;
  latitude: number;
  longitude: number;
  neighborhood: string | null;
  address_components: { long_name: string; short_name: string; types: string[] }[];
}

// ---------------------------------------------------------------------------
// In-memory cache (survives across requests in same process)
// ---------------------------------------------------------------------------

const detailsCache = new Map<string, { data: GooglePlace; ts: number }>();
const geocodeCache = new Map<string, { data: GeocodeResult; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached<T>(cache: Map<string, { data: T; ts: number }>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setCache<T>(cache: Map<string, { data: T; ts: number }>, key: string, data: T) {
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Core: Place Details (by place_id)
// ---------------------------------------------------------------------------

const DEFAULT_DETAIL_FIELDS = [
  'place_id', 'name', 'formatted_address', 'geometry',
  'rating', 'user_ratings_total', 'formatted_phone_number',
  'website', 'opening_hours', 'url',
].join(',');

export async function getPlaceDetails(
  placeId: string,
  apiKey: string,
  options?: { fields?: string; skipCache?: boolean }
): Promise<GooglePlace | null> {
  const fields = options?.fields || DEFAULT_DETAIL_FIELDS;
  const cacheKey = `${placeId}:${fields}`;

  if (!options?.skipCache) {
    const cached = getCached(detailsCache, cacheKey);
    if (cached) return cached;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error(`[Google Places] Details failed for ${placeId}: ${data.status}`);
      return null;
    }

    const result = data.result as GooglePlace;
    if (!result.place_id) result.place_id = placeId;

    setCache(detailsCache, cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Google Places] Details API error:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core: Find Place (text query → place_id)
// ---------------------------------------------------------------------------

export async function findPlaceId(
  query: string,
  apiKey: string
): Promise<string | null> {
  try {
    // Try Find Place first (cheaper)
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${apiKey}`;
    const findResponse = await fetch(findUrl);
    const findData = await findResponse.json();

    if (findData.candidates?.length > 0) {
      return findData.candidates[0].place_id;
    }

    // Fallback: Text Search (more flexible matching)
    const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const textResponse = await fetch(textUrl);
    const textData = await textResponse.json();

    if (textData.results?.length > 0) {
      return textData.results[0].place_id;
    }

    return null;
  } catch (error) {
    console.error('[Google Places] Find Place error:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Combined: Search by address → full details
// ---------------------------------------------------------------------------

export async function searchPlaceByAddress(
  address: string,
  apiKey: string
): Promise<GooglePlace | null> {
  const placeId = await findPlaceId(address, apiKey);
  if (!placeId) return null;

  return getPlaceDetails(placeId, apiKey, {
    fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,reviews,opening_hours,formatted_phone_number,website',
  });
}

// ---------------------------------------------------------------------------
// Geocoding: Address → lat/lng + neighborhood
// ---------------------------------------------------------------------------

import { getNeighborhoodAliases } from '@/lib/neighborhoods';

async function normalizeNeighborhoodWithRegion(raw: string, regionId?: string): Promise<string> {
  if (regionId) {
    const aliases = await getNeighborhoodAliases(regionId);
    const lower = raw.toLowerCase().trim();
    return aliases.get(lower) || raw.trim();
  }
  return raw.trim();
}

export async function geocodeAddress(
  address: string,
  apiKey: string,
  regionId?: string
): Promise<GeocodeResult | null> {
  const cacheKey = address.toLowerCase().trim();
  const cached = getCached(geocodeCache, cacheKey);
  if (cached) return cached;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return null;
    }

    const result = data.results[0];
    const components = result.address_components || [];

    // Extract neighborhood from address components
    let neighborhood: string | null = null;
    for (const comp of components) {
      if (comp.types.includes('neighborhood')) {
        neighborhood = await normalizeNeighborhoodWithRegion(comp.long_name, regionId);
        break;
      }
      if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
        neighborhood = await normalizeNeighborhoodWithRegion(comp.long_name, regionId);
        // Don't break — prefer 'neighborhood' type if it comes later
      }
    }

    const geocodeResult: GeocodeResult = {
      formatted_address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      neighborhood,
      address_components: components,
    };

    setCache(geocodeCache, cacheKey, geocodeResult);
    return geocodeResult;
  } catch (error) {
    console.error('[Google Geocoding] Error:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractHoursOfOperation(weekdayText?: string[]): string {
  if (!weekdayText || weekdayText.length === 0) return '';
  return weekdayText.join(', ').replace(/:\s*/g, ' ');
}

export function getApiKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}
