import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/admin-auth';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// GET - Get progress for a running scrape
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const historyId = searchParams.get('historyId');

    if (!historyId) {
      return NextResponse.json(
        { error: 'History ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get history record
    const { data: history, error: historyError } = await supabase
      .from('scrape_history')
      .select('*')
      .eq('id', historyId)
      .single();

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return NextResponse.json(
        { error: 'Failed to fetch progress' },
        { status: 500 }
      );
    }

    // Get items summary
    const { data: items, error: itemsError } = await supabase
      .from('scrape_history_items')
      .select('id, program_id, program_name, provider_name, status, fields_updated, error_message, completed_at')
      .eq('history_id', historyId)
      .order('completed_at', { ascending: false, nullsFirst: false });

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    }

    // Calculate progress
    const total = history.total_programs || 0;
    const completed = (history.programs_scraped || 0) + (history.programs_failed || 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Get current item being processed
    const currentItem = items?.find((i) => i.status === 'running');
    const recentItems = items?.slice(0, 5) || [];

    return NextResponse.json({
      historyId: history.id,
      status: history.status,
      progress,
      total: history.total_programs,
      scraped: history.programs_scraped,
      updated: history.programs_updated,
      failed: history.programs_failed,
      startedAt: history.started_at,
      completedAt: history.completed_at,
      currentItem: currentItem ? {
        programName: currentItem.program_name,
        providerName: currentItem.provider_name,
      } : null,
      recentItems: recentItems.map((i) => ({
        programName: i.program_name,
        providerName: i.provider_name,
        status: i.status,
        fieldsUpdated: i.fields_updated,
        error: i.error_message,
      })),
    });
  } catch (error) {
    console.error('Progress GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
