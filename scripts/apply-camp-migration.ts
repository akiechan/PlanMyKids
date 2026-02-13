import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying camp fields migration...\n');

  // First, check if columns exist by trying to select them
  const { data: testData, error: testError } = await supabase
    .from('programs')
    .select('id, program_type, camp_season')
    .limit(1);

  if (testError && testError.message.includes('column')) {
    console.log('Columns do not exist yet. Please run the migration SQL in Supabase dashboard:');
    console.log('File: supabase/migrations/20260208000000_add_camp_fields.sql\n');
    return;
  }

  console.log('Columns exist! Updating data...\n');

  // Get all programs that have 'Summer Camp' in their category array
  const { data: camps, error: campsError } = await supabase
    .from('programs')
    .select('id, name, category')
    .filter('category', 'cs', '{"Summer Camp"}');

  if (campsError) {
    console.error('Error fetching camps:', campsError);
    return;
  }

  console.log(`Found ${camps?.length || 0} programs with "Summer Camp" category`);

  // Update them to be camps with summer season
  if (camps && camps.length > 0) {
    const campIds = camps.map(c => c.id);

    const { error: updateError } = await supabase
      .from('programs')
      .update({ program_type: 'camp', camp_season: 'summer' })
      .in('id', campIds);

    if (updateError) {
      console.error('Error updating camps:', updateError);
      return;
    }

    console.log(`Updated ${camps.length} programs to program_type='camp', camp_season='summer'`);
  }

  // Set remaining programs (without Summer Camp category) to program_type='program'
  const { data: programs, error: progsError } = await supabase
    .from('programs')
    .select('id')
    .is('program_type', null);

  if (programs && programs.length > 0) {
    const { error: updateProgsError } = await supabase
      .from('programs')
      .update({ program_type: 'program' })
      .is('program_type', null);

    if (updateProgsError) {
      console.error('Error updating programs:', updateProgsError);
      return;
    }

    console.log(`Updated ${programs.length} remaining entries to program_type='program'`);
  }

  console.log('\nMigration complete!');
}

applyMigration().catch(console.error);
