import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { query, pageToken, fetchAll } = await request.json();

    if (!query && !pageToken) {
      return NextResponse.json(
        { error: 'Search query or page token is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // If fetching next page with token
    if (pageToken) {
      console.log('Fetching next page with token');
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${apiKey}`;

      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places API error:', data.status, data.error_message);
        return NextResponse.json(
          { error: `Google Places API error: ${data.status}` },
          { status: 500 }
        );
      }

      console.log(`Found ${data.results?.length || 0} additional results`);

      return NextResponse.json({
        results: data.results || [],
        nextPageToken: data.next_page_token || null,
        status: data.status,
        cached: false
      });
    }

    // Check cache first (only for initial search, not pagination)
    const { data: cachedResult } = await supabase
      .from('google_places_search_cache')
      .select('results, next_page_token, created_at')
      .eq('search_query', query.trim().toLowerCase())
      .single();

    // If cache exists and is less than 7 days old, return cached results
    if (cachedResult && !fetchAll) {
      const cacheAge = Date.now() - new Date(cachedResult.created_at).getTime();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

      if (cacheAge < sevenDaysInMs) {
        console.log('Returning cached results for:', query);
        return NextResponse.json({
          results: cachedResult.results || [],
          nextPageToken: cachedResult.next_page_token || null,
          status: 'OK',
          cached: true
        });
      }
    }

    // Use Google Places Text Search API
    let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

    console.log('Searching Google Places for:', query);

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: `Google Places API error: ${data.status}` },
        { status: 500 }
      );
    }

    let allResults = data.results || [];
    let nextPageToken = data.next_page_token || null;

    // If fetchAll is true, get all pages (up to 60 results)
    if (fetchAll && nextPageToken) {
      console.log('Fetching all pages...');

      for (let page = 2; page <= 3 && nextPageToken; page++) {
        // Google requires a short delay before using next_page_token
        await new Promise(resolve => setTimeout(resolve, 2000));

        const nextUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${apiKey}`;
        const nextResponse = await fetch(nextUrl);
        const nextData = await nextResponse.json();

        if (nextData.status === 'OK') {
          allResults = [...allResults, ...(nextData.results || [])];
          nextPageToken = nextData.next_page_token || null;
          console.log(`Page ${page}: Found ${nextData.results?.length || 0} results`);
        } else {
          break;
        }
      }
    }

    console.log(`Total results: ${allResults.length}`);

    // Cache the results
    if (allResults.length > 0) {
      await supabase
        .from('google_places_search_cache')
        .upsert({
          search_query: query.trim().toLowerCase(),
          results: allResults,
          next_page_token: nextPageToken,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'search_query'
        });
    }

    return NextResponse.json({
      results: allResults,
      nextPageToken: nextPageToken,
      status: data.status,
      cached: false
    });

  } catch (error) {
    console.error('Error in google-places-search:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search' },
      { status: 500 }
    );
  }
}
