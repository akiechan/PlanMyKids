import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// GET: List all active programs/camps with their location data
export async function GET() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('programs')
    .select(`
      id,
      name,
      program_type,
      provider_website,
      category,
      status,
      program_locations (
        id,
        address,
        neighborhood,
        latitude,
        longitude
      )
    `)
    .eq('status', 'active')
    .in('program_type', ['program', 'camp'])
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const programs = (data || []).map((p: any) => {
    const loc = p.program_locations?.[0];
    return {
      id: p.id,
      name: p.name,
      program_type: p.program_type,
      provider_website: p.provider_website,
      category: p.category || [],
      location_id: loc?.id || null,
      address: loc?.address || null,
      neighborhood: loc?.neighborhood || null,
    };
  });

  return NextResponse.json({ programs });
}

// PATCH: Update a single location's neighborhood
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { locationId, neighborhood, latitude, longitude } = body;

  if (!locationId || !neighborhood) {
    return NextResponse.json({ error: 'locationId and neighborhood are required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const updates: Record<string, any> = { neighborhood };
  if (latitude != null && longitude != null) {
    updates.latitude = latitude;
    updates.longitude = longitude;
  }

  const { error } = await supabase
    .from('program_locations')
    .update(updates)
    .eq('id', locationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
