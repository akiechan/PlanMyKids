import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  // Find camps with duplicate names
  const { data: camps, error } = await supabase
    .from('programs')
    .select('id, name, provider_name, status, merged_into, program_type')
    .eq('program_type', 'camp')
    .eq('status', 'active')
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by name
  const nameCount: Record<string, any[]> = {};
  camps?.forEach(camp => {
    if (!nameCount[camp.name]) {
      nameCount[camp.name] = [];
    }
    nameCount[camp.name].push(camp);
  });

  // Find duplicates (more than 1 entry with same name)
  console.log('\n=== Duplicate Camps (same name, active, not merged) ===\n');
  let duplicateCount = 0;
  Object.entries(nameCount)
    .filter(([_, entries]) => entries.length > 1)
    .forEach(([name, entries]) => {
      console.log(`"${name}" - ${entries.length} entries:`);
      entries.forEach(e => {
        console.log(`  ID: ${e.id}, Provider: ${e.provider_name}, merged_into: ${e.merged_into}`);
      });
      console.log('');
      duplicateCount += entries.length - 1;
    });

  console.log(`Total duplicate entries: ${duplicateCount}`);
}

checkDuplicates();
