import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('featured_subscriptions')
      .select(`
        id,
        program_id,
        user_id,
        plan_type,
        status,
        trial_start,
        trial_end,
        current_period_start,
        current_period_end,
        canceled_at,
        contact_name,
        contact_email,
        contact_phone,
        program_logo_url,
        program_data,
        created_at,
        updated_at,
        programs(name, provider_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching featured subscriptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscriptions: data || [] });
  } catch (error) {
    console.error('Featured subscriptions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
