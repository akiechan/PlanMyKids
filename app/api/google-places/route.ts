import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchPlaceByAddress } from '@/lib/google-places';

// In-memory cache for place lookups (survives across warm invocations)
const placeCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days -- place data rarely changes

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    const cacheKey = address.toLowerCase().trim();

    // Layer 1: In-memory cache (only use if it has place_id)
    const memoryCached = placeCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.ts < CACHE_TTL && memoryCached.data?.place_id) {
      return NextResponse.json({ place: memoryCached.data, cached: true });
    }

    // Layer 2: Supabase database cache (only use if it has place_id)
    const supabase = getSupabaseClient();
    const sevenDaysAgo = new Date(Date.now() - CACHE_TTL).toISOString();

    const { data: cached } = await supabase
      .from('google_places_search_cache')
      .select('results')
      .eq('query', cacheKey)
      .gte('created_at', sevenDaysAgo)
      .limit(1)
      .single();

    if (cached?.results?.place_id) {
      // Warm the memory cache
      placeCache.set(cacheKey, { data: cached.results, ts: Date.now() });
      return NextResponse.json({ place: cached.results, cached: true });
    }

    // Cache miss: call Google API
    const place = await searchPlaceByAddress(address, apiKey);

    if (!place) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      );
    }

    // Store in both caches
    placeCache.set(cacheKey, { data: place, ts: Date.now() });
    // Write to DB cache (don't block response on failure)
    try {
      await supabase
        .from('google_places_search_cache')
        .upsert(
          { query: cacheKey, results: place, created_at: new Date().toISOString() },
          { onConflict: 'query' }
        );
    } catch (cacheErr) {
      console.error('Cache write error:', cacheErr);
    }

    return NextResponse.json({ place });
  } catch (error) {
    console.error('Google Places API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch place data',
      },
      { status: 500 }
    );
  }
}
