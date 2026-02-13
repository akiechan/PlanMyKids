import { NextRequest, NextResponse } from 'next/server';
import { getNeighborhoodAliases } from '@/lib/neighborhoods';
import { getRegionBySlug, getDefaultRegion, DEFAULT_REGION_SLUG } from '@/lib/regions';

// Extract neighborhood from Google Geocoding address_components using DB aliases
async function extractNeighborhood(addressComponents: any[], regionId: string): Promise<string | null> {
  const aliases = await getNeighborhoodAliases(regionId);

  const priorityTypes = [
    'neighborhood',
    'sublocality_level_1',
    'sublocality',
  ];

  for (const type of priorityTypes) {
    const component = addressComponents.find((c: any) =>
      c.types.includes(type)
    );
    if (component) {
      const lower = component.long_name.toLowerCase().trim();
      return aliases.get(lower) || component.long_name.trim();
    }
  }

  return null;
}

// GET - Lookup neighborhood for a single address
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  const regionSlug = request.nextUrl.searchParams.get('region') || DEFAULT_REGION_SLUG;

  if (!address) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  // Resolve region for neighborhood normalization
  const region = await getRegionBySlug(regionSlug) || await getDefaultRegion();

  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return NextResponse.json({ error: 'Address not found', status: data.status }, { status: 404 });
    }

    const result = data.results[0];
    const neighborhood = await extractNeighborhood(result.address_components, region.id);
    const location = result.geometry?.location;

    return NextResponse.json({
      neighborhood: neighborhood || null,
      formatted_address: result.formatted_address,
      latitude: location?.lat || null,
      longitude: location?.lng || null,
      address_components: result.address_components,
    });
  } catch (error) {
    console.error('Google Geocoding error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode address' },
      { status: 500 }
    );
  }
}
