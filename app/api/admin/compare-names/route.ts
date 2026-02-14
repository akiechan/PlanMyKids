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

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseClient();

    // Read CSV
    const fs = await import('fs/promises');
    const path = await import('path');
    const csvPath = path.join(process.cwd(), 'data', 'camps-2026.csv');
    const csvContent = await fs.readFile(csvPath, 'utf-8');

    // Parse CSV
    const lines = csvContent.split('\n');
    const csvCamps: { name: string; website: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

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

      const campName = fields[1]?.trim();
      const website = fields[9]?.trim();
      if (campName && campName !== 'Camp Name' && !campName.includes('Please Note')) {
        csvCamps.push({ name: campName, website: website || '' });
      }
    }

    // Get all programs from database
    const { data: dbCamps, error } = await supabase
      .from('programs')
      .select('id, name, provider_name, provider_website');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create maps for matching
    const websiteMap = new Map<string, { id: string; name: string; provider_website: string | null }>();
    const nameMap = new Map<string, { id: string; name: string; provider_website: string | null }>();

    for (const camp of dbCamps || []) {
      if (camp.provider_website) {
        websiteMap.set(normalizeWebsite(camp.provider_website), camp);
      }
      nameMap.set(normalizeName(camp.name), camp);
    }

    // Compare
    const results: {
      csvName: string;
      csvWebsite: string;
      dbName: string | null;
      dbId: string | null;
      matchType: 'website' | 'exact' | 'partial' | 'not_found';
    }[] = [];

    for (const csvCamp of csvCamps) {
      const { name: csvName, website: csvWebsite } = csvCamp;
      const normalizedCsvName = normalizeName(csvName);

      let match: { id: string; name: string; provider_website: string | null } | undefined;
      let matchType: 'website' | 'exact' | 'partial' | 'not_found' = 'not_found';

      // Priority 1: Match by website
      if (csvWebsite) {
        match = websiteMap.get(normalizeWebsite(csvWebsite));
        if (match) {
          matchType = 'website';
        }
      }

      // Priority 2: Exact name match
      if (!match) {
        match = nameMap.get(normalizedCsvName);
        if (match) {
          matchType = 'exact';
        }
      }

      // Priority 3: Partial name match
      if (!match) {
        for (const [key, value] of nameMap.entries()) {
          if (key.includes(normalizedCsvName) || normalizedCsvName.includes(key)) {
            match = value;
            matchType = 'partial';
            break;
          }
          const csvWords = normalizedCsvName.split(' ');
          const dbWords = key.split(' ');
          if (csvWords[0] === dbWords[0] && csvWords.length >= 1 && dbWords.length >= 1) {
            match = value;
            matchType = 'partial';
            break;
          }
        }
      }

      if (match) {
        // For website matches, check if names are different
        if (matchType === 'website' && normalizeName(match.name) === normalizedCsvName) {
          matchType = 'exact'; // Website matched and names are same = exact
        }
        results.push({
          csvName,
          csvWebsite,
          dbName: match.name,
          dbId: match.id,
          matchType,
        });
      } else {
        results.push({
          csvName,
          csvWebsite,
          dbName: null,
          dbId: null,
          matchType: 'not_found',
        });
      }
    }

    // Sort: website matches with name diff first, then partial, then not found, then exact
    results.sort((a, b) => {
      const order = { website: 0, partial: 1, not_found: 2, exact: 3 };
      return order[a.matchType] - order[b.matchType];
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error comparing names:', error);
    return NextResponse.json({ error: 'Failed to compare names' }, { status: 500 });
  }
}
