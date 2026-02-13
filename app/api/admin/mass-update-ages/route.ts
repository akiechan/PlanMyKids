import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// POST - Update all programs with age_min=5, age_max=18 to age_min=0
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // First, count how many programs will be affected
    const { count, error: countError } = await supabase
      .from('programs')
      .select('*', { count: 'exact', head: true })
      .eq('age_min', 5)
      .eq('age_max', 18);

    if (countError) {
      console.error('Error counting programs:', countError);
      return NextResponse.json(
        { error: 'Failed to count programs' },
        { status: 500 }
      );
    }

    // Update all programs with age_min=5, age_max=18 to age_min=0
    const { data, error: updateError } = await supabase
      .from('programs')
      .update({ age_min: 0 })
      .eq('age_min', 5)
      .eq('age_max', 18)
      .select('id, name');

    if (updateError) {
      console.error('Error updating programs:', updateError);
      return NextResponse.json(
        { error: 'Failed to update programs' },
        { status: 500 }
      );
    }

    // Log the action
    try {
      await supabase.from('admin_activity_log').insert({
        action: 'mass_update_ages',
        details: {
          programs_updated: data?.length || 0,
          from: { age_min: 5, age_max: 18 },
          to: { age_min: 0, age_max: 18 },
        },
      });
    } catch (logError) {
      console.error('Error logging action:', logError);
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${data?.length || 0} programs from age 5-18 to 0-18`,
      updatedCount: data?.length || 0,
      programs: data,
    });
  } catch (error) {
    console.error('Mass update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Preview how many programs will be affected
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const { data, count, error } = await supabase
      .from('programs')
      .select('id, name, provider_name', { count: 'exact' })
      .eq('age_min', 5)
      .eq('age_max', 18)
      .limit(20);

    if (error) {
      console.error('Error fetching programs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch programs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      totalCount: count,
      preview: data,
      message: `${count} programs will be updated from age 5-18 to 0-18`,
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
