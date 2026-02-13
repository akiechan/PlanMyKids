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
  const dryRun = searchParams.get('dryRun') !== 'false';

  const supabase = getSupabaseClient();

  // Find all camps with hours embedded in description
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, description')
    .eq('program_type', 'camp')
    .not('description', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pattern to match hours at end of description
  const hoursPattern = /\n\nHours:\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;

  const toClean = data?.filter(p => hoursPattern.test(p.description || '')) || [];

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      count: toClean.length,
      camps: toClean.map(p => ({
        id: p.id,
        name: p.name,
        currentDescription: p.description,
        cleanedDescription: p.description?.replace(hoursPattern, ''),
      })),
    });
  }

  // Actually clean the descriptions
  const results = [];
  for (const camp of toClean) {
    const cleanedDescription = camp.description?.replace(hoursPattern, '');
    const { error: updateError } = await supabase
      .from('programs')
      .update({ description: cleanedDescription })
      .eq('id', camp.id);

    results.push({
      id: camp.id,
      name: camp.name,
      success: !updateError,
      error: updateError?.message,
    });
  }

  return NextResponse.json({
    dryRun: false,
    count: results.length,
    results,
  });
}
