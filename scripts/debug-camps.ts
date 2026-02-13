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

async function debug() {
  // Check camp_days_format distribution
  const { data: camps } = await supabase
    .from('programs')
    .select('id, name, camp_days_format, camp_season, hours_start, hours_end')
    .eq('program_type', 'camp')
    .eq('status', 'active')
    .limit(10);

  console.log('Sample camps with format/hours:');
  console.log(JSON.stringify(camps, null, 2));

  // Count by days_format
  const { data: allCamps } = await supabase
    .from('programs')
    .select('camp_days_format')
    .eq('program_type', 'camp')
    .eq('status', 'active');

  const formatCounts: Record<string, number> = {};
  allCamps?.forEach(c => {
    const fmt = c.camp_days_format || 'null';
    formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
  });
  console.log('\nDays format distribution:', formatCounts);

  // Check if merged_into filter affects things
  const { count: withMerged } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })
    .eq('program_type', 'camp')
    .eq('status', 'active')
    .is('merged_into', null);

  console.log('\nCamps with merged_into=null:', withMerged);
}

debug();
