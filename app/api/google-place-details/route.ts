import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for place details (survives across warm invocations)
const detailsCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours -- place details rarely change

export async function POST(request: NextRequest) {
  try {
    const { placeId } = await request.json();

    if (!placeId) {
      return NextResponse.json(
        { error: 'Place ID is required' },
        { status: 400 }
      );
    }

    // Layer 1: In-memory cache (only use if it has full data including address)
    const memoryCached = detailsCache.get(placeId);
    if (memoryCached && Date.now() - memoryCached.ts < CACHE_TTL && memoryCached.data?.formatted_address) {
      return NextResponse.json({ result: memoryCached.data, status: 'OK', cached: true });
    }

    // Always call Google API for full data (address, geometry, hours, etc.)
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,rating,user_ratings_total,formatted_phone_number,website,opening_hours,geometry&key=${apiKey}`;

    const response = await fetch(detailsUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: `Google Places API error: ${data.status}` },
        { status: 500 }
      );
    }

    // Cache the result in memory
    detailsCache.set(placeId, { data: data.result, ts: Date.now() });

    return NextResponse.json({
      result: data.result,
      status: data.status
    });

  } catch (error) {
    console.error('Error in google-place-details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch place details' },
      { status: 500 }
    );
  }
}
