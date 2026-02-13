import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // Find all Sunshine Art House entries
  const { data: programs, error } = await supabase
    .from('programs')
    .select('id, name, program_type, status, is_featured, merged_into, created_at')
    .ilike('name', '%sunshine art house%')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error querying programs:', error);
    return;
  }

  console.log(`Found ${programs?.length || 0} Sunshine Art House entries:`);
  programs?.forEach(p => {
    console.log(`  ID: ${p.id}, type: ${p.program_type}, status: ${p.status}, featured: ${p.is_featured}, merged: ${p.merged_into}`);
  });

  if (!programs || programs.length === 0) {
    console.log('No Sunshine Art House found.');
    return;
  }

  // Check for featured subscriptions on any of them
  const ids = programs.map(p => p.id);
  const { data: subs } = await supabase
    .from('featured_subscriptions')
    .select('id, program_id, status, plan_type')
    .in('program_id', ids);

  console.log(`\nFeatured subscriptions linked:`, subs || 'none');

  // Keep the first one (oldest), update it to program type
  const keepId = programs[0].id;
  const deleteIds = programs.slice(1).map(p => p.id);

  console.log(`\nKeeping: ${keepId} (${programs[0].name})`);
  if (deleteIds.length > 0) {
    console.log(`Deleting duplicates: ${deleteIds.join(', ')}`);
  }

  // Update the keeper to program_type = 'program'
  const { error: updateError } = await supabase
    .from('programs')
    .update({ program_type: 'program', updated_at: new Date().toISOString() })
    .eq('id', keepId);

  if (updateError) {
    console.error('Error updating program_type:', updateError);
  } else {
    console.log(`Updated ${keepId} to program_type = 'program'`);
  }

  // Delete duplicates if any
  if (deleteIds.length > 0) {
    // Move any featured subscriptions from duplicates to the keeper
    for (const dupId of deleteIds) {
      const { error: moveError } = await supabase
        .from('featured_subscriptions')
        .update({ program_id: keepId })
        .eq('program_id', dupId);

      if (moveError) {
        console.error(`Error moving subscriptions from ${dupId}:`, moveError);
      }
    }

    // Delete duplicate program locations first
    const { error: locError } = await supabase
      .from('program_locations')
      .delete()
      .in('program_id', deleteIds);

    if (locError) {
      console.error('Error deleting duplicate locations:', locError);
    }

    // Delete duplicate programs
    const { error: delError } = await supabase
      .from('programs')
      .delete()
      .in('id', deleteIds);

    if (delError) {
      console.error('Error deleting duplicates:', delError);
    } else {
      console.log(`Deleted ${deleteIds.length} duplicate(s)`);
    }
  }

  // Verify final state
  const { data: final } = await supabase
    .from('programs')
    .select('id, name, program_type, status, is_featured')
    .eq('id', keepId)
    .single();

  console.log('\nFinal state:', final);
}

main().catch(console.error);
