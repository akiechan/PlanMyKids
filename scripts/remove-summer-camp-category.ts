import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function removeSummerCampCategory() {
  console.log('Removing "Summer Camp" from category arrays...\n');

  // Get all programs with Summer Camp in category
  const { data: programs, error: fetchError } = await supabase
    .from('programs')
    .select('id, name, category')
    .filter('category', 'cs', '{"Summer Camp"}');

  if (fetchError) {
    console.error('Error fetching programs:', fetchError);
    return;
  }

  console.log(`Found ${programs?.length || 0} programs with "Summer Camp" category`);

  let updated = 0;
  for (const program of programs || []) {
    const newCategory = (program.category as string[]).filter(c => c !== 'Summer Camp');

    const { error: updateError } = await supabase
      .from('programs')
      .update({ category: newCategory })
      .eq('id', program.id);

    if (updateError) {
      console.error(`Error updating ${program.name}:`, updateError);
    } else {
      updated++;
    }
  }

  console.log(`\nUpdated ${updated} programs - removed "Summer Camp" from category`);
}

removeSummerCampCategory();
