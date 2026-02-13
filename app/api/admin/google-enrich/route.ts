import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDefaultRegion } from '@/lib/regions';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    weekday_text?: string[];
  };
  url?: string; // Google Maps URL
}

// Search Google Places for a business
async function searchGooglePlaces(query: string, location?: string): Promise<GooglePlaceResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key not configured');
  }

  const defaultRegion = await getDefaultRegion();
  const searchQuery = location ? `${query} ${location}` : `${query} ${defaultRegion.short_name}`;

  // First, find the place
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key=${apiKey}`;

  const findResponse = await fetch(findUrl);
  const findData = await findResponse.json();

  if (findData.status !== 'OK' || !findData.candidates?.length) {
    return null;
  }

  const placeId = findData.candidates[0].place_id;

  // Get detailed place info
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,geometry,rating,user_ratings_total,formatted_phone_number,website,opening_hours,url&key=${apiKey}`;

  const detailsResponse = await fetch(detailsUrl);
  const detailsData = await detailsResponse.json();

  if (detailsData.status !== 'OK') {
    return findData.candidates[0];
  }

  return detailsData.result;
}

// Parse address into components
function parseAddress(formattedAddress: string): { address: string; city: string; state: string; zip: string } {
  // Format: "123 Main St, San Francisco, CA 94110, USA"
  const parts = formattedAddress.split(',').map(p => p.trim());

  if (parts.length >= 3) {
    const address = parts[0];
    const city = parts[1];
    const stateZip = parts[2].split(' ');
    const state = stateZip[0] || '';
    const zip = stateZip[1] || '';

    return { address, city, state, zip };
  }

  return { address: formattedAddress, city: '', state: '', zip: '' };
}

// GET: List programs needing address enrichment or preview a single lookup
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'list';
  const programId = searchParams.get('programId');
  const programType = searchParams.get('programType') || 'camp';
  const filter = searchParams.get('filter') || 'address'; // 'address', 'reviews', 'all'

  const supabase = getSupabaseClient();

  if (action === 'list') {
    // Find programs missing data
    const { data: programs, error } = await supabase
      .from('programs')
      .select(`
        id,
        name,
        provider_name,
        program_type,
        google_rating,
        google_review_count,
        contact_phone,
        provider_website,
        program_locations (
          id,
          address,
          neighborhood,
          latitude,
          longitude
        )
      `)
      .eq('program_type', programType)
      .eq('status', 'active');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Helper functions
    const hasMissingAddress = (p: typeof programs[0]) => {
      const loc = p.program_locations?.[0];
      return !loc || !loc.address || loc.address === 'TBD' || !loc.latitude || !loc.longitude;
    };

    const hasMissingReviews = (p: typeof programs[0]) => !p.google_rating;

    // Filter based on what's missing
    const needsEnrichment = programs?.filter(p => {
      if (filter === 'address') return hasMissingAddress(p);
      if (filter === 'reviews') return hasMissingReviews(p);
      if (filter === 'all') return hasMissingAddress(p) || hasMissingReviews(p);
      return false;
    }) || [];

    const missingAddress = programs?.filter(hasMissingAddress) || [];
    const missingReviews = programs?.filter(hasMissingReviews) || [];
    const fullyComplete = programs?.filter(p => !hasMissingAddress(p) && !hasMissingReviews(p)) || [];

    return NextResponse.json({
      total: programs?.length || 0,
      needsEnrichment: needsEnrichment.length,
      complete: fullyComplete.length,
      missingAddress: missingAddress.length,
      missingReviews: missingReviews.length,
      filter,
      programs: needsEnrichment.slice(0, 100).map(p => ({
        id: p.id,
        name: p.name,
        provider_name: p.provider_name,
        currentAddress: p.program_locations?.[0]?.address || null,
        hasLocation: !!p.program_locations?.[0],
        hasRating: !!p.google_rating,
        rating: p.google_rating,
      })),
    });
  }

  if (action === 'preview' && programId) {
    // Preview Google lookup for a single program
    const { data: program, error } = await supabase
      .from('programs')
      .select(`
        id,
        name,
        provider_name,
        program_locations (*)
      `)
      .eq('id', programId)
      .single();

    if (error || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const searchQuery = program.provider_name || program.name;
    const googleResult = await searchGooglePlaces(searchQuery);

    return NextResponse.json({
      program: {
        id: program.id,
        name: program.name,
        provider_name: program.provider_name,
        currentLocation: program.program_locations?.[0] || null,
      },
      googleResult: googleResult ? {
        name: googleResult.name,
        address: googleResult.formatted_address,
        parsedAddress: parseAddress(googleResult.formatted_address),
        coordinates: googleResult.geometry?.location,
        rating: googleResult.rating,
        reviewCount: googleResult.user_ratings_total,
        phone: googleResult.formatted_phone_number,
        website: googleResult.website,
        googleMapsUrl: googleResult.url,
      } : null,
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// POST: Apply Google enrichment to programs
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { programIds, dryRun = true } = body;

  if (!programIds || !Array.isArray(programIds)) {
    return NextResponse.json({ error: 'programIds array required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const results: Array<{
    programId: string;
    name: string;
    success: boolean;
    googleFound: boolean;
    updates?: Record<string, unknown>;
    error?: string;
  }> = [];

  for (const programId of programIds) {
    try {
      // Get program details
      const { data: program, error: fetchError } = await supabase
        .from('programs')
        .select(`
          id,
          name,
          provider_name,
          google_rating,
          google_review_count,
          google_reviews_url,
          contact_phone,
          provider_website,
          program_locations (*)
        `)
        .eq('id', programId)
        .single();

      if (fetchError || !program) {
        results.push({
          programId,
          name: 'Unknown',
          success: false,
          googleFound: false,
          error: 'Program not found',
        });
        continue;
      }

      // Search Google Places
      const searchQuery = program.provider_name || program.name;
      const googleResult = await searchGooglePlaces(searchQuery);

      if (!googleResult) {
        results.push({
          programId,
          name: program.name,
          success: false,
          googleFound: false,
          error: 'No Google result found',
        });
        continue;
      }

      const parsed = parseAddress(googleResult.formatted_address);
      const updates: Record<string, unknown> = {};
      const locationUpdates: Record<string, unknown> = {};

      // Determine what to update (only fill in missing data)
      if (!program.google_rating && googleResult.rating) {
        updates.google_rating = googleResult.rating;
      }
      if (!program.google_review_count && googleResult.user_ratings_total) {
        updates.google_review_count = googleResult.user_ratings_total;
      }
      if (!program.google_reviews_url && googleResult.url) {
        updates.google_reviews_url = googleResult.url;
      }
      if (!program.contact_phone && googleResult.formatted_phone_number) {
        updates.contact_phone = googleResult.formatted_phone_number;
      }
      if (!program.provider_website && googleResult.website) {
        updates.provider_website = googleResult.website;
      }

      // Location updates
      const currentLoc = program.program_locations?.[0];
      if (!currentLoc?.address || currentLoc.address === 'TBD') {
        locationUpdates.address = parsed.address;
      }
      if (!currentLoc?.latitude && googleResult.geometry?.location) {
        locationUpdates.latitude = googleResult.geometry.location.lat;
        locationUpdates.longitude = googleResult.geometry.location.lng;
      }

      if (dryRun) {
        results.push({
          programId,
          name: program.name,
          success: true,
          googleFound: true,
          updates: { ...updates, location: locationUpdates },
        });
        continue;
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('programs')
          .update(updates)
          .eq('id', programId);
      }

      if (Object.keys(locationUpdates).length > 0 && currentLoc?.id) {
        await supabase
          .from('program_locations')
          .update(locationUpdates)
          .eq('id', currentLoc.id);
      } else if (Object.keys(locationUpdates).length > 0 && !currentLoc) {
        // Create new location entry
        await supabase
          .from('program_locations')
          .insert({
            program_id: programId,
            ...locationUpdates,
            neighborhood: defaultRegion.short_name,
          });
      }

      results.push({
        programId,
        name: program.name,
        success: true,
        googleFound: true,
        updates: { ...updates, location: locationUpdates },
      });

      // Rate limiting - wait 200ms between API calls
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      results.push({
        programId,
        name: 'Unknown',
        success: false,
        googleFound: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    dryRun,
    total: results.length,
    successful: results.filter(r => r.success).length,
    googleFound: results.filter(r => r.googleFound).length,
    results,
  });
}
