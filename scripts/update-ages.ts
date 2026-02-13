import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    });
  } catch (e) {
    console.error('Could not load .env.local');
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure .env.local is configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log('Checking for programs with age 5-18...\n');

  // Count programs to be updated
  const { count, error: countError } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })
    .eq('age_min', 5)
    .eq('age_max', 18);

  if (countError) {
    console.error('Error counting programs:', countError);
    process.exit(1);
  }

  console.log(`Found ${count} programs with age 5-18 that will be updated to 0-18\n`);

  if (count === 0) {
    console.log('No programs to update.');
    return;
  }

  // Update all programs
  const { data, error: updateError } = await supabase
    .from('programs')
    .update({ age_min: 0 })
    .eq('age_min', 5)
    .eq('age_max', 18)
    .select('id, name, provider_name');

  if (updateError) {
    console.error('Error updating programs:', updateError);
    process.exit(1);
  }

  console.log(`Successfully updated ${data?.length || 0} programs!\n`);

  if (data && data.length > 0) {
    console.log('Updated programs:');
    data.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} (${p.provider_name})`);
    });
  }
}

main().catch(console.error);
