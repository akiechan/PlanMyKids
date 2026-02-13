import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('programs')
      .select(`*, program_locations(*)`)
      .eq('id', id)
      .eq('program_type', 'camp')
      .single();

    if (error) {
      console.error('Error fetching camp:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
    }

    return NextResponse.json({ camp: data });
  } catch (error) {
    console.error('Error in camp detail API:', error);
    return NextResponse.json({ error: 'Failed to fetch camp' }, { status: 500 });
  }
}
