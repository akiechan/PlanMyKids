import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

async function runMigration() {
  console.log('Adding camp fields to database...');

  // Add program_type column
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'program'`
  });

  // Since rpc might not work, let's try direct queries
  // We'll use a workaround - insert and update operations

  // Check if columns exist by trying a select
  const { data: testData, error: testError } = await supabase
    .from('programs')
    .select('id')
    .limit(1);

  if (testError) {
    console.error('Cannot connect to database:', testError.message);
    return;
  }

  console.log('Database connection successful.');
  console.log('Note: Column additions require direct SQL access.');
  console.log('Please run the following SQL in your Supabase dashboard:');
  console.log('');
  console.log(`
-- Add camp-specific fields to programs table
ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'program';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS camp_season TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS camp_days_format TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS hours_start TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS hours_end TEXT;
  `);
}

runMigration().catch(console.error);
