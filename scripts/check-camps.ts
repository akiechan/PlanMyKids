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

async function check() {
  // Check camps
  const { data: camps, error: campsError } = await supabase
    .from('programs')
    .select('id, name, program_type, camp_season, status')
    .eq('program_type', 'camp')
    .eq('status', 'active')
    .limit(5);

  console.log('Sample camps (program_type=camp, status=active):');
  console.log(JSON.stringify(camps, null, 2));
  if (campsError) console.log('Error:', campsError);

  // Count all camps
  const { count: campCount } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })
    .eq('program_type', 'camp')
    .eq('status', 'active');

  console.log('\nTotal active camps:', campCount);

  // Check all program_types
  const { data: types } = await supabase
    .from('programs')
    .select('program_type')
    .eq('status', 'active');

  const typeCounts: Record<string, number> = {};
  types?.forEach(t => {
    const type = t.program_type || 'null';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  console.log('\nProgram types distribution:', typeCounts);
}

check();
