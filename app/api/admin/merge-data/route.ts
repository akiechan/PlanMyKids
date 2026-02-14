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

// Fetch known distinct neighborhoods from DB to prevent incorrect merges
async function getDistinctNeighborhoods(): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('neighborhoods')
    .select('name, aliases')
    .eq('is_canonical', true);

  const names = new Set<string>();
  for (const row of data || []) {
    names.add(row.name.toLowerCase());
    if (row.aliases) {
      for (const alias of row.aliases) {
        names.add(alias.toLowerCase());
      }
    }
  }
  return names;
}

// Normalize string for comparison
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Check if two strings are distinct neighborhoods
function areDistinctNeighborhoods(s1: string, s2: string, distinctSet: Set<string>): boolean {
  const n1 = normalize(s1);
  const n2 = normalize(s2);

  // Both are in the distinct set - don't merge them
  if (distinctSet.has(n1) && distinctSet.has(n2)) {
    return true;
  }

  // One contains the other but they're different
  // e.g., "Mission" vs "Mission Bay" - these should NOT be merged
  const shorter = n1.length < n2.length ? n1 : n2;
  const longer = n1.length < n2.length ? n2 : n1;

  if (longer !== shorter && longer.startsWith(shorter + ' ')) {
    return true; // e.g., "mission" vs "mission bay"
  }

  return false;
}

// Calculate similarity between two strings
function similarity(s1: string, s2: string, distinctSet: Set<string>): number {
  const n1 = normalize(s1).replace(/\s/g, '');
  const n2 = normalize(s2).replace(/\s/g, '');

  if (n1 === n2) return 1;

  // Check if these are distinct neighborhoods first
  if (areDistinctNeighborhoods(s1, s2, distinctSet)) {
    return 0; // Don't suggest merging
  }

  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;

  if (longer.length === 0) return 1;

  // Levenshtein distance for typo detection
  const costs: number[] = [];
  for (let i = 0; i <= n1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= n2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (n1.charAt(i - 1) !== n2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[n2.length] = lastValue;
  }

  return (longer.length - costs[n2.length]) / longer.length;
}

// Find potential merge groups
function findMergeGroups(items: { value: string; count: number }[], distinctSet: Set<string>, threshold = 0.7): { canonical: string; variants: string[]; counts: Record<string, number> }[] {
  const groups: { canonical: string; variants: string[]; counts: Record<string, number> }[] = [];
  const processed = new Set<string>();

  // Sort by count descending so the most common becomes canonical
  const sorted = [...items].sort((a, b) => b.count - a.count);

  for (const item of sorted) {
    if (processed.has(item.value)) continue;

    const group = {
      canonical: item.value,
      variants: [] as string[],
      counts: { [item.value]: item.count },
    };

    processed.add(item.value);

    for (const other of sorted) {
      if (processed.has(other.value)) continue;

      const sim = similarity(item.value, other.value, distinctSet);
      if (sim >= threshold) {
        group.variants.push(other.value);
        group.counts[other.value] = other.count;
        processed.add(other.value);
      }
    }

    // Only include groups with variants
    if (group.variants.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'all';
  const programType = searchParams.get('programType') || 'all'; // 'all', 'program', 'camp'

  const supabase = getSupabaseClient();
  const result: Record<string, unknown> = {};
  const distinctSet = await getDistinctNeighborhoods();

  // Get neighborhoods
  if (type === 'all' || type === 'neighborhoods') {
    let query = supabase
      .from('program_locations')
      .select('neighborhood, programs!inner(program_type, status)')
      .eq('programs.status', 'active');

    if (programType !== 'all') {
      query = query.eq('programs.program_type', programType);
    } else {
      query = query.in('programs.program_type', ['program', 'camp']);
    }

    const { data: locations } = await query;

    const neighborhoodCounts: Record<string, number> = {};
    locations?.forEach((loc: any) => {
      if (loc.neighborhood) {
        neighborhoodCounts[loc.neighborhood] = (neighborhoodCounts[loc.neighborhood] || 0) + 1;
      }
    });

    const neighborhoods = Object.entries(neighborhoodCounts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const neighborhoodMerges = findMergeGroups(neighborhoods, distinctSet, 0.80);

    result.neighborhoods = {
      total: neighborhoods.length,
      items: neighborhoods,
      suggestedMerges: neighborhoodMerges,
    };
  }

  // Get categories
  if (type === 'all' || type === 'categories') {
    let query = supabase
      .from('programs')
      .select('category')
      .eq('status', 'active');

    if (programType !== 'all') {
      query = query.eq('program_type', programType);
    } else {
      query = query.in('program_type', ['program', 'camp']);
    }

    const { data: programs } = await query;

    const categoryCounts: Record<string, number> = {};
    programs?.forEach(prog => {
      if (prog.category && Array.isArray(prog.category)) {
        prog.category.forEach((cat: string) => {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
      }
    });

    const categories = Object.entries(categoryCounts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const categoryMerges = findMergeGroups(categories, distinctSet, 0.75);

    result.categories = {
      total: categories.length,
      items: categories,
      suggestedMerges: categoryMerges,
    };
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await verifyCriticalAdmin(request);
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const { type, canonical, variants } = body;

  if (!type || !canonical || !variants || !Array.isArray(variants)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const results: { variant: string; updated: number; error?: string }[] = [];

  if (type === 'neighborhood') {
    // Update all program_locations with variant neighborhoods to use canonical
    for (const variant of variants) {
      const { data, error } = await supabase
        .from('program_locations')
        .update({ neighborhood: canonical })
        .eq('neighborhood', variant)
        .select('id');

      results.push({
        variant,
        updated: data?.length || 0,
        error: error?.message,
      });
    }
  } else if (type === 'category') {
    // For categories, we need to update the array field
    // Find all programs with variant categories and replace them
    for (const variant of variants) {
      const { data: programs, error: fetchError } = await supabase
        .from('programs')
        .select('id, category')
        .contains('category', [variant]);

      if (fetchError) {
        results.push({ variant, updated: 0, error: fetchError.message });
        continue;
      }

      let updated = 0;
      for (const prog of programs || []) {
        const newCategories = prog.category.map((c: string) =>
          c === variant ? canonical : c
        );
        // Remove duplicates
        const uniqueCategories = [...new Set(newCategories)];

        const { error: updateError } = await supabase
          .from('programs')
          .update({ category: uniqueCategories })
          .eq('id', prog.id);

        if (!updateError) updated++;
      }

      results.push({ variant, updated });
    }
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    type,
    canonical,
    results,
    totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
  });
}
