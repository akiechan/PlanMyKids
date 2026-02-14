import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getNeighborhoodAliases, getGenericNeighborhoodNames } from '@/lib/neighborhoods';
import { getDefaultRegion } from '@/lib/regions';
import { verifyAdmin, verifyCriticalAdmin } from '@/lib/admin-auth';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getNeighborhoodFromAddress(address: string, apiKey: string, regionId: string): Promise<{
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
}> {
  const aliases = await getNeighborhoodAliases(regionId);

  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const response = await fetch(geocodeUrl);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) {
    return { neighborhood: null, latitude: null, longitude: null };
  }

  const result = data.results[0];
  const components = result.address_components || [];

  // Look for neighborhood in address_components
  const priorityTypes = ['neighborhood', 'sublocality_level_1', 'sublocality'];
  let neighborhood: string | null = null;

  for (const type of priorityTypes) {
    const component = components.find((c: any) => c.types.includes(type));
    if (component) {
      const lower = component.long_name.toLowerCase().trim();
      neighborhood = aliases.get(lower) || component.long_name.trim();
      break;
    }
  }

  const location = result.geometry?.location;
  return {
    neighborhood,
    latitude: location?.lat || null,
    longitude: location?.lng || null,
  };
}

// GET: List locations that need neighborhood updates
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const programType = request.nextUrl.searchParams.get('programType') || 'program';
  const filter = request.nextUrl.searchParams.get('filter') || 'missing'; // 'missing', 'generic', 'all'

  const supabase = getSupabaseClient();
  const region = await getDefaultRegion();

  const { data: locations, error } = await supabase
    .from('program_locations')
    .select('id, address, neighborhood, latitude, longitude, program_id, programs!inner(name, status, program_type)')
    .eq('programs.status', 'active')
    .eq('programs.program_type', programType);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const genericNeighborhoods = getGenericNeighborhoodNames(region.name);

  const needsUpdate = (locations || []).filter((loc: any) => {
    if (filter === 'missing') {
      return !loc.neighborhood || loc.neighborhood.trim() === '';
    }
    if (filter === 'generic') {
      return genericNeighborhoods.includes((loc.neighborhood || '').toLowerCase().trim());
    }
    // 'all' — update everything that has an address
    return loc.address && loc.address.trim() !== '';
  });

  return NextResponse.json({
    total: locations?.length || 0,
    needsUpdate: needsUpdate.length,
    filter,
    locations: needsUpdate.slice(0, 200).map((loc: any) => ({
      id: loc.id,
      program_id: loc.program_id,
      program_name: loc.programs?.name,
      address: loc.address,
      currentNeighborhood: loc.neighborhood,
      hasCoordinates: !!(loc.latitude && loc.longitude),
    })),
  });
}

// POST: Update neighborhoods from Google Geocoding
export async function POST(request: NextRequest) {
  const auth = await verifyCriticalAdmin(request);
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const { locationIds, dryRun = true } = body;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  const supabase = getSupabaseClient();

  // If no specific IDs, get all that need updating
  let idsToProcess = locationIds;

  const region = await getDefaultRegion();

  if (!idsToProcess || !Array.isArray(idsToProcess) || idsToProcess.length === 0) {
    const filter = body.filter || 'generic';
    const programType = body.programType || 'program';
    const genericNeighborhoods = getGenericNeighborhoodNames(region.name);

    const { data: locations, error } = await supabase
      .from('program_locations')
      .select('id, address, neighborhood, programs!inner(status, program_type)')
      .eq('programs.status', 'active')
      .eq('programs.program_type', programType);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    idsToProcess = (locations || [])
      .filter((loc: any) => {
        if (!loc.address || loc.address.trim() === '') return false;
        if (filter === 'missing') return !loc.neighborhood || loc.neighborhood.trim() === '';
        if (filter === 'generic') return genericNeighborhoods.includes((loc.neighborhood || '').toLowerCase().trim());
        return true; // 'all'
      })
      .map((loc: any) => loc.id);
  }

  const results: Array<{
    locationId: string;
    address: string;
    oldNeighborhood: string | null;
    newNeighborhood: string | null;
    coordinatesUpdated: boolean;
    success: boolean;
    error?: string;
  }> = [];

  for (const locationId of idsToProcess) {
    try {
      const { data: loc, error: fetchError } = await supabase
        .from('program_locations')
        .select('id, address, neighborhood, latitude, longitude, program_id')
        .eq('id', locationId)
        .single();

      if (fetchError || !loc) {
        results.push({
          locationId,
          address: '',
          oldNeighborhood: null,
          newNeighborhood: null,
          coordinatesUpdated: false,
          success: false,
          error: 'Location not found',
        });
        continue;
      }

      if (!loc.address || loc.address.trim() === '') {
        results.push({
          locationId,
          address: '',
          oldNeighborhood: loc.neighborhood,
          newNeighborhood: null,
          coordinatesUpdated: false,
          success: false,
          error: 'No address to geocode',
        });
        continue;
      }

      const googleData = await getNeighborhoodFromAddress(loc.address, apiKey, region.id);

      if (!googleData.neighborhood) {
        results.push({
          locationId,
          address: loc.address,
          oldNeighborhood: loc.neighborhood,
          newNeighborhood: null,
          coordinatesUpdated: false,
          success: false,
          error: 'Google could not determine neighborhood',
        });
        continue;
      }

      const updates: Record<string, any> = {
        neighborhood: googleData.neighborhood,
      };

      // Also update coordinates if missing
      let coordinatesUpdated = false;
      if ((!loc.latitude || !loc.longitude) && googleData.latitude && googleData.longitude) {
        updates.latitude = googleData.latitude;
        updates.longitude = googleData.longitude;
        coordinatesUpdated = true;
      }

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('program_locations')
          .update(updates)
          .eq('id', locationId);

        if (updateError) {
          results.push({
            locationId,
            address: loc.address,
            oldNeighborhood: loc.neighborhood,
            newNeighborhood: googleData.neighborhood,
            coordinatesUpdated: false,
            success: false,
            error: updateError.message,
          });
          continue;
        }
      }

      results.push({
        locationId,
        address: loc.address,
        oldNeighborhood: loc.neighborhood,
        newNeighborhood: googleData.neighborhood,
        coordinatesUpdated,
        success: true,
      });

      // Rate limit: 100ms between geocoding calls
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      results.push({
        locationId,
        address: '',
        oldNeighborhood: null,
        newNeighborhood: null,
        coordinatesUpdated: false,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    dryRun,
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
}
