import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// GET - List scrape history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeItems = searchParams.get('includeItems') === 'true';

    const supabase = getSupabaseClient();

    let query = supabase
      .from('scrape_history')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching scrape history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scrape history' },
        { status: 500 }
      );
    }

    // Optionally fetch items for each history entry
    let historyWithItems = data;
    if (includeItems && data && data.length > 0) {
      const historyIds = data.map((h) => h.id);
      const { data: items, error: itemsError } = await supabase
        .from('scrape_history_items')
        .select('*')
        .in('history_id', historyIds)
        .order('created_at', { ascending: true });

      if (!itemsError && items) {
        const itemsByHistory = items.reduce((acc: Record<string, typeof items>, item) => {
          if (!acc[item.history_id]) acc[item.history_id] = [];
          acc[item.history_id].push(item);
          return acc;
        }, {});

        historyWithItems = data.map((h) => ({
          ...h,
          items: itemsByHistory[h.id] || [],
        }));
      }
    }

    // Get total count
    const { count } = await supabase
      .from('scrape_history')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      history: historyWithItems,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('History GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET single history entry with items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { historyId } = body;

    if (!historyId) {
      return NextResponse.json(
        { error: 'History ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Get history entry
    const { data: history, error: historyError } = await supabase
      .from('scrape_history')
      .select('*')
      .eq('id', historyId)
      .single();

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('scrape_history_items')
      .select('*')
      .eq('history_id', historyId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Error fetching history items:', itemsError);
      return NextResponse.json(
        { error: 'Failed to fetch history items' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      history: {
        ...history,
        items: items || [],
      },
    });
  } catch (error) {
    console.error('History POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
