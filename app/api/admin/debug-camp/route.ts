import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name') || 'acrosports';

  const supabase = getSupabaseClient();

  // Search by name (case insensitive)
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .ilike('name', `%${name}%`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    count: data?.length || 0,
    programs: data?.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      program_type: p.program_type,
      merged_into: p.merged_into,
      provider_name: p.provider_name,
      provider_website: p.provider_website,
      start_date: p.start_date,
      end_date: p.end_date,
      hours_start: p.hours_start,
      hours_end: p.hours_end,
      camp_season: p.camp_season,
      camp_days_format: p.camp_days_format,
      description: p.description,
    })),
  });
}
