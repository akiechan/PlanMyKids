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

// Normalize name for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Count non-null fields to determine "richness" of data
function countNonNullFields(record: Record<string, unknown>): number {
  let count = 0;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        if (value.length > 0) count++;
      } else {
        count++;
      }
    }
  }
  return count;
}

// GET: Preview duplicates
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseClient();

    const { data: programs, error } = await supabase
      .from('programs')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by normalized name + program_type
    const groups = new Map<string, typeof programs>();

    for (const program of programs || []) {
      const key = `${normalizeName(program.name)}::${program.program_type || 'unknown'}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(program);
    }

    // Find duplicates (groups with more than 1 entry)
    const duplicates: {
      name: string;
      program_type: string;
      count: number;
      keep: { id: string; name: string; fieldCount: number };
      remove: { id: string; name: string; fieldCount: number }[];
    }[] = [];

    for (const [key, group] of groups.entries()) {
      if (group.length > 1) {
        // Sort by field count (most data first)
        const sorted = group
          .map(p => ({ ...p, fieldCount: countNonNullFields(p) }))
          .sort((a, b) => b.fieldCount - a.fieldCount);

        const [programType] = key.split('::').slice(-1);

        duplicates.push({
          name: sorted[0].name,
          program_type: programType,
          count: group.length,
          keep: {
            id: sorted[0].id,
            name: sorted[0].name,
            fieldCount: sorted[0].fieldCount,
          },
          remove: sorted.slice(1).map(p => ({
            id: p.id,
            name: p.name,
            fieldCount: p.fieldCount,
          })),
        });
      }
    }

    return NextResponse.json({
      totalPrograms: programs?.length || 0,
      duplicateGroups: duplicates.length,
      toRemove: duplicates.reduce((sum, d) => sum + d.remove.length, 0),
      duplicates,
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json({ error: 'Failed to find duplicates' }, { status: 500 });
  }
}

// POST: Actually remove duplicates
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyCriticalAdmin(request);
    if ('error' in auth) return auth.error;

    const supabase = getSupabaseClient();
    const body = await request.json();
    const { confirm } = body;

    if (confirm !== true) {
      return NextResponse.json({ error: 'Must confirm deletion with { confirm: true }' }, { status: 400 });
    }

    const { data: programs, error } = await supabase
      .from('programs')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by normalized name + program_type
    const groups = new Map<string, typeof programs>();

    for (const program of programs || []) {
      const key = `${normalizeName(program.name)}::${program.program_type || 'unknown'}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(program);
    }

    const results = {
      removed: [] as string[],
      kept: [] as string[],
      errors: [] as string[],
    };

    for (const [, group] of groups.entries()) {
      if (group.length > 1) {
        // Sort by field count (most data first)
        const sorted = group
          .map(p => ({ ...p, fieldCount: countNonNullFields(p) }))
          .sort((a, b) => b.fieldCount - a.fieldCount);

        // Keep the first one (most data)
        results.kept.push(`${sorted[0].name} (${sorted[0].program_type}, ${sorted[0].fieldCount} fields)`);

        // Delete the rest
        for (const toRemove of sorted.slice(1)) {
          const { error: deleteError } = await supabase
            .from('programs')
            .delete()
            .eq('id', toRemove.id);

          if (deleteError) {
            results.errors.push(`Failed to delete ${toRemove.name}: ${deleteError.message}`);
          } else {
            results.removed.push(`${toRemove.name} (${toRemove.program_type}, ${toRemove.fieldCount} fields)`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error removing duplicates:', error);
    return NextResponse.json({ error: 'Failed to remove duplicates' }, { status: 500 });
  }
}
