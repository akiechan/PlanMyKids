import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// Parse date string like "June 15 - August 21" into { start: "2026-06-15", end: "2026-08-21" }
function parseDateRange(dateStr: string, year: number = 2026): { start: string | null; end: string | null } {
  if (!dateStr || dateStr.toLowerCase().includes('register') || dateStr.toLowerCase().includes('vary')) {
    return { start: null, end: null };
  }

  const months: { [key: string]: string } = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12',
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  // Clean the string
  let cleaned = dateStr.toLowerCase().trim();

  // Handle multiple date ranges - take earliest start and latest end
  const ranges = cleaned.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;

  for (const range of ranges) {
    // Skip session labels
    const rangeClean = range.replace(/session\s*[a-z]?:?\s*/gi, '').trim();

    // Match patterns like "June 15 - August 21" or "6/29-7/3"
    const dashMatch = rangeClean.match(/([a-z]+)\s*(\d{1,2})\s*[-–]\s*([a-z]+)?\s*(\d{1,2})/i);

    if (dashMatch) {
      const startMonth = months[dashMatch[1].toLowerCase()];
      const startDay = dashMatch[2].padStart(2, '0');
      const endMonthName = dashMatch[3] || dashMatch[1]; // Use start month if end month not specified
      const endMonth = months[endMonthName.toLowerCase()];
      const endDay = dashMatch[4].padStart(2, '0');

      if (startMonth && endMonth) {
        const startDate = new Date(`${year}-${startMonth}-${startDay}`);
        const endDate = new Date(`${year}-${endMonth}-${endDay}`);

        if (!earliestStart || startDate < earliestStart) {
          earliestStart = startDate;
        }
        if (!latestEnd || endDate > latestEnd) {
          latestEnd = endDate;
        }
      }
    }
  }

  const formatDate = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    start: earliestStart ? formatDate(earliestStart) : null,
    end: latestEnd ? formatDate(latestEnd) : null,
  };
}

// Parse time string like "9:00am" or "3:15pm" into 24h format "09:00" or "15:15"
function parseTime(timeStr: string): string | null {
  if (!timeStr) return null;

  const match = timeStr.trim().toLowerCase().match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Parse hours range like "9:00am - 3:15pm" into { start: "09:00", end: "15:15" }
function parseHoursRange(hoursStr: string): { start: string | null; end: string | null } {
  if (!hoursStr || hoursStr.toLowerCase() === 'varies' || hoursStr.toLowerCase().includes('contact')) {
    return { start: null, end: null };
  }

  // Match pattern like "9:00am - 3:15pm" or "8:30am-4:00pm"
  const match = hoursStr.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
  if (!match) return { start: null, end: null };

  return {
    start: parseTime(match[1]),
    end: parseTime(match[2]),
  };
}

// Normalize camp name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize website URL for matching
function normalizeWebsite(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { csvData } = body;

    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json({ error: 'Invalid CSV data' }, { status: 400 });
    }

    // Get all programs from the database (search all, not just camps)
    const { data: camps, error: fetchError } = await supabase
      .from('programs')
      .select('id, name, program_type, provider_website');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const results: { matched: string[]; updated: string[]; notFound: string[]; errors: string[] } = {
      matched: [],
      updated: [],
      notFound: [],
      errors: [],
    };

    // Create maps for matching
    const websiteMap = new Map<string, { id: string; name: string; provider_website: string | null }>();
    const nameMap = new Map<string, { id: string; name: string; provider_website: string | null }>();

    for (const camp of camps || []) {
      // Map by normalized website
      if (camp.provider_website) {
        websiteMap.set(normalizeWebsite(camp.provider_website), camp);
      }
      // Map by normalized name
      nameMap.set(normalizeName(camp.name), camp);
    }

    // Process each row from CSV
    for (const row of csvData) {
      const campName = row.name?.trim();
      const dateStr = row.dates?.trim();
      const csvWebsite = row.website?.trim();

      if (!campName) continue;

      let matchedCamp: { id: string; name: string; provider_website: string | null } | undefined;
      let matchMethod = '';

      // Priority 1: Match by website URL (most reliable)
      if (csvWebsite) {
        const normalizedCsvWebsite = normalizeWebsite(csvWebsite);
        matchedCamp = websiteMap.get(normalizedCsvWebsite);
        if (matchedCamp) {
          matchMethod = 'website';
        }
      }

      // Priority 2: Match by exact name
      if (!matchedCamp) {
        const normalizedName = normalizeName(campName);
        matchedCamp = nameMap.get(normalizedName);
        if (matchedCamp) {
          matchMethod = 'exact name';
        }
      }

      // Priority 3: Partial name matching
      if (!matchedCamp) {
        const normalizedName = normalizeName(campName);
        for (const [key, value] of nameMap.entries()) {
          if (key.includes(normalizedName) || normalizedName.includes(key)) {
            matchedCamp = value;
            matchMethod = 'partial name';
            break;
          }
          const csvWords = normalizedName.split(' ');
          const dbWords = key.split(' ');
          if (csvWords[0] === dbWords[0] && csvWords.length >= 1 && dbWords.length >= 1) {
            matchedCamp = value;
            matchMethod = 'first word';
            break;
          }
        }
      }

      if (!matchedCamp) {
        results.notFound.push(campName);
        continue;
      }

      results.matched.push(`${campName} → ${matchedCamp.name} (${matchMethod})`);

      const { start, end } = parseDateRange(dateStr);
      const hoursStr = row.hours?.trim();
      const { start: hoursStart, end: hoursEnd } = parseHoursRange(hoursStr || '');

      // Build update object with available data
      const updateData: Record<string, string | null> = {};
      if (start) updateData.start_date = start;
      if (end) updateData.end_date = end;
      if (hoursStart) updateData.hours_start = hoursStart;
      if (hoursEnd) updateData.hours_end = hoursEnd;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('programs')
          .update(updateData)
          .eq('id', matchedCamp.id);

        if (updateError) {
          results.errors.push(`${campName}: ${updateError.message}`);
        } else {
          const details = [];
          if (start || end) details.push(`dates: ${start || '?'} - ${end || '?'}`);
          if (hoursStart || hoursEnd) details.push(`hours: ${hoursStart || '?'} - ${hoursEnd || '?'}`);
          results.updated.push(`${campName}: ${details.join(', ')}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error importing camp dates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to fetch parsed CSV data for preview
export async function GET() {
  try {
    // Read and parse the CSV file
    const fs = await import('fs/promises');
    const path = await import('path');

    const csvPath = path.join(process.cwd(), 'data', 'camps-2026.csv');
    const csvContent = await fs.readFile(csvPath, 'utf-8');

    // Simple CSV parsing
    const lines = csvContent.split('\n');
    const camps: {
      name: string;
      dates: string;
      hours: string;
      website: string;
      parsedStart: string | null;
      parsedEnd: string | null;
      parsedHoursStart: string | null;
      parsedHoursEnd: string | null;
    }[] = [];

    for (let i = 1; i < lines.length; i++) { // Skip header row (row 0)
      const line = lines[i];
      if (!line.trim()) continue;

      // Split by comma but respect quoted fields
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim().replace(/^"|"$/g, ''));

      // CSV columns: 0=last checked, 1=Camp Name, 2=Status, 3=Location, 4=Age, 5=2026 Dates, 6=Description, 7=Hours, 8=Pricing, 9=Website
      const campName = fields[1]?.trim();
      const dates = fields[5]?.trim();
      const hours = fields[7]?.trim();
      const website = fields[9]?.trim();

      if (campName && campName !== 'Camp Name' && !campName.includes('Please Note')) {
        const { start, end } = parseDateRange(dates);
        const { start: hoursStart, end: hoursEnd } = parseHoursRange(hours || '');
        camps.push({
          name: campName,
          dates: dates || '',
          hours: hours || '',
          website: website || '',
          parsedStart: start,
          parsedEnd: end,
          parsedHoursStart: hoursStart,
          parsedHoursEnd: hoursEnd,
        });
      }
    }

    return NextResponse.json({ camps });
  } catch (error) {
    console.error('Error reading CSV:', error);
    return NextResponse.json({ error: 'Failed to read CSV file' }, { status: 500 });
  }
}
