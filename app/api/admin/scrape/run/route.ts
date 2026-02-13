import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// POST - Start a scrape run (returns history ID for progress tracking)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      programIds,
      maxPages = 5,
      maxDepth = 1,
      onlyMissing = false,
      jobId = null,
      runType = 'manual',
    } = body;

    const supabase = getSupabaseClient();

    // Get programs to scrape
    let query = supabase
      .from('programs')
      .select('id, name, provider_name, provider_website, registration_url, re_enrollment_date, new_registration_date')
      .not('provider_website', 'is', null);

    if (programIds && programIds.length > 0) {
      query = query.in('id', programIds);
    }

    if (onlyMissing) {
      query = query.or('registration_url.is.null,re_enrollment_date.is.null,new_registration_date.is.null');
    }

    const { data: programs, error: programsError } = await query;

    if (programsError) {
      console.error('Error fetching programs:', programsError);
      return NextResponse.json(
        { error: 'Failed to fetch programs' },
        { status: 500 }
      );
    }

    if (!programs || programs.length === 0) {
      return NextResponse.json(
        { error: 'No programs found to scrape' },
        { status: 400 }
      );
    }

    // Create history record
    const { data: history, error: historyError } = await supabase
      .from('scrape_history')
      .insert([
        {
          job_id: jobId,
          run_type: runType,
          total_programs: programs.length,
          status: 'running',
        },
      ])
      .select()
      .single();

    if (historyError) {
      console.error('Error creating history:', historyError);
      return NextResponse.json(
        { error: 'Failed to create history record' },
        { status: 500 }
      );
    }

    // Create history items for each program
    const historyItems = programs.map((p) => ({
      history_id: history.id,
      program_id: p.id,
      program_name: p.name,
      provider_name: p.provider_name,
      status: 'pending',
    }));

    const { error: itemsError } = await supabase
      .from('scrape_history_items')
      .insert(historyItems);

    if (itemsError) {
      console.error('Error creating history items:', itemsError);
    }

    // Start the scraping process in the background
    processScrapeRun(history.id, programs, maxPages, maxDepth, supabase);

    return NextResponse.json({
      historyId: history.id,
      totalPrograms: programs.length,
      message: 'Scrape run started',
    });
  } catch (error) {
    console.error('Run POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface Program {
  id: string;
  name: string;
  provider_name: string;
  provider_website: string;
  registration_url: string | null;
  re_enrollment_date: string | null;
  new_registration_date: string | null;
}

async function processScrapeRun(
  historyId: string,
  programs: Program[],
  maxPages: number,
  maxDepth: number,
  supabase: ReturnType<typeof getSupabaseClient>
) {
  let scraped = 0;
  let updated = 0;
  let failed = 0;

  const scraperPath = path.join(process.cwd(), 'scraper', 'scrape_program.py');

  for (const program of programs) {
    const website = program.provider_website;
    if (!website) {
      failed++;
      continue;
    }

    // Ensure URL has protocol
    const url = website.startsWith('http') ? website : `https://${website}`;

    // Update item status to running
    await supabase
      .from('scrape_history_items')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('history_id', historyId)
      .eq('program_id', program.id);

    try {
      const command = `python3 "${scraperPath}" "${url}" --max-pages ${maxPages} --max-depth ${maxDepth}`;

      const { stdout } = await execAsync(command, {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      const scrapedData = JSON.parse(stdout);
      scraped++;

      // Prepare updates (only update if we found new info)
      const updates: Record<string, string> = {};
      const fieldsUpdated: Record<string, string> = {};

      if (scrapedData.registration_url && !program.registration_url) {
        updates.registration_url = scrapedData.registration_url;
        fieldsUpdated.registration_url = `null -> ${scrapedData.registration_url}`;
      }
      if (scrapedData.re_enrollment_date && !program.re_enrollment_date) {
        updates.re_enrollment_date = scrapedData.re_enrollment_date;
        fieldsUpdated.re_enrollment_date = `null -> ${scrapedData.re_enrollment_date}`;
      }
      if (scrapedData.new_registration_date && !program.new_registration_date) {
        updates.new_registration_date = scrapedData.new_registration_date;
        fieldsUpdated.new_registration_date = `null -> ${scrapedData.new_registration_date}`;
      }

      // Update program in database if we have updates
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('programs')
          .update(updates)
          .eq('id', program.id);
        updated++;
      }

      // Update history item
      await supabase
        .from('scrape_history_items')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          registration_url_found: scrapedData.registration_url || null,
          re_enrollment_date_found: scrapedData.re_enrollment_date || null,
          new_registration_date_found: scrapedData.new_registration_date || null,
          pages_crawled: scrapedData.crawled_pages?.length || 1,
          fields_updated: Object.keys(fieldsUpdated).length > 0 ? fieldsUpdated : null,
        })
        .eq('history_id', historyId)
        .eq('program_id', program.id);

    } catch (error) {
      failed++;
      console.error(`Error scraping ${program.provider_name}:`, error);

      // Update history item with error
      await supabase
        .from('scrape_history_items')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('history_id', historyId)
        .eq('program_id', program.id);
    }

    // Update history progress
    await supabase
      .from('scrape_history')
      .update({
        programs_scraped: scraped,
        programs_updated: updated,
        programs_failed: failed,
      })
      .eq('id', historyId);

    // Small delay between scrapes to be respectful
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Mark history as completed
  await supabase
    .from('scrape_history')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      programs_scraped: scraped,
      programs_updated: updated,
      programs_failed: failed,
    })
    .eq('id', historyId);
}
