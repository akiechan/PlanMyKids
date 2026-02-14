import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin, verifyCriticalAdmin } from '@/lib/admin-auth';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// GET: Preview what will be updated
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // Get all camps
    const { data: camps, error } = await supabase
      .from('programs')
      .select('id, name, status, program_type, start_date, end_date')
      .eq('program_type', 'camp');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const toActivate: { id: string; name: string; reason: string; currentStatus: string }[] = [];
    const alreadyActive: { id: string; name: string }[] = [];
    const pastCamps: { id: string; name: string; end_date: string }[] = [];

    for (const camp of camps || []) {
      const endDate = camp.end_date;
      const isFutureOrNull = !endDate || endDate >= today;

      if (isFutureOrNull) {
        if (camp.status === 'active') {
          alreadyActive.push({ id: camp.id, name: camp.name });
        } else {
          toActivate.push({
            id: camp.id,
            name: camp.name,
            reason: endDate ? `End date ${endDate} is in the future` : 'No end date set',
            currentStatus: camp.status || 'unknown',
          });
        }
      } else {
        pastCamps.push({ id: camp.id, name: camp.name, end_date: endDate });
      }
    }

    return NextResponse.json({
      today,
      summary: {
        total: camps?.length || 0,
        alreadyActive: alreadyActive.length,
        toActivate: toActivate.length,
        pastCamps: pastCamps.length,
      },
      toActivate,
      alreadyActive,
      pastCamps,
    });
  } catch (error) {
    console.error('Error checking camp status:', error);
    return NextResponse.json({ error: 'Failed to check camp status' }, { status: 500 });
  }
}

// POST: Actually update statuses
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyCriticalAdmin(request);
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // Get all camps that are not active and have future or null end dates
    const { data: camps, error } = await supabase
      .from('programs')
      .select('id, name, status, end_date')
      .eq('program_type', 'camp')
      .neq('status', 'active');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = {
      activated: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
    };

    for (const camp of camps || []) {
      const endDate = camp.end_date;
      const isFutureOrNull = !endDate || endDate >= today;

      if (isFutureOrNull) {
        const { error: updateError } = await supabase
          .from('programs')
          .update({ status: 'active' })
          .eq('id', camp.id);

        if (updateError) {
          results.errors.push(`${camp.name}: ${updateError.message}`);
        } else {
          results.activated.push(camp.name);
        }
      } else {
        results.skipped.push(`${camp.name} (ended ${endDate})`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error updating camp status:', error);
    return NextResponse.json({ error: 'Failed to update camp status' }, { status: 500 });
  }
}
