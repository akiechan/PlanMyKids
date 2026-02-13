import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCampsCache, setCampsCache } from '@/lib/api-cache';
import { getRegionBySlug, DEFAULT_REGION_SLUG } from '@/lib/regions';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: {
      fetch: (url: any, options: any = {}) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const regionSlug = request.nextUrl.searchParams.get('region') || DEFAULT_REGION_SLUG;

    // In-memory cache keyed by region
    const cached = getCampsCache(regionSlug);
    if (cached) {
      const response = NextResponse.json({ camps: cached });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    const supabase = getSupabaseClient();
    const region = await getRegionBySlug(regionSlug);

    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
        program_locations(*)
      `)
      .eq('status', 'active')
      .eq('program_type', 'camp')
      .is('merged_into', null)
      .order('google_rating', { ascending: false });

    if (error) {
      console.error('Error fetching camps:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by region: only include programs with at least one location in the region
    // Skip if region has no valid ID (e.g., fallback region when regions table doesn't exist)
    let camps = data || [];
    if (region && region.id) {
      camps = camps.filter((camp: any) =>
        camp.program_locations?.some((loc: any) => loc.region_id === region.id)
      );
    }

    setCampsCache(camps, regionSlug);

    const response = NextResponse.json({ camps });
    // Vercel Edge CDN cache -- 5 min fresh, 10 min stale-while-revalidate
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.headers.set('X-Cache', 'MISS');
    return response;
  } catch (error) {
    console.error('Error in camps API:', error);
    return NextResponse.json({ error: 'Failed to fetch camps' }, { status: 500 });
  }
}
