import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();

  // Update all camps to be summer, weekly
  const { data, error } = await supabase
    .from('programs')
    .update({
      camp_season: 'summer',
      camp_days_format: 'weekly',
    })
    .eq('program_type', 'camp')
    .select('id, name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    updated: data?.length || 0,
    message: `Updated ${data?.length || 0} camps to summer season, weekly format`,
  });
}
