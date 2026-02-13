import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// GET - List all scheduled jobs
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('scheduled_scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scheduled jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled jobs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ jobs: data });
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new scheduled job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      schedule_type = 'once',
      scheduled_time,
      max_pages = 10,
      max_depth = 2,
      only_missing = false,
      program_filter = null,
      created_by,
    } = body;

    if (!scheduled_time) {
      return NextResponse.json(
        { error: 'Scheduled time is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Calculate next_run_at based on schedule type
    const scheduledDate = new Date(scheduled_time);
    const next_run_at = scheduledDate.toISOString();

    const { data, error } = await supabase
      .from('scheduled_scrape_jobs')
      .insert([
        {
          name: name || 'Scheduled Provider Update',
          schedule_type,
          scheduled_time: scheduledDate.toISOString(),
          next_run_at,
          max_pages,
          max_depth,
          only_missing,
          program_filter: program_filter ? JSON.stringify(program_filter) : null,
          created_by,
          status: 'pending',
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating scheduled job:', error);
      return NextResponse.json(
        { error: 'Failed to create scheduled job' },
        { status: 500 }
      );
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a scheduled job by ID (passed in body)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('scheduled_scrape_jobs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting scheduled job:', error);
      return NextResponse.json(
        { error: 'Failed to delete scheduled job' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
