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
  console.log('Checking for pending subscriptions...\n');

  // Fetch all pending subscriptions
  const { data: pending, error } = await supabase
    .from('featured_subscriptions')
    .select('*')
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching subscriptions:', error);
    process.exit(1);
  }

  if (!pending || pending.length === 0) {
    console.log('No pending subscriptions found.');
    return;
  }

  console.log(`Found ${pending.length} pending subscription(s):\n`);

  pending.forEach((sub, i) => {
    console.log(`${i + 1}. ID: ${sub.id}`);
    console.log(`   Program ID: ${sub.program_id || 'None (new program)'}`);
    console.log(`   Plan: ${sub.plan_type}`);
    console.log(`   Contact: ${sub.contact_email}`);
    console.log(`   Created: ${sub.created_at}`);
    console.log('');
  });

  // Ask to delete (in script mode, just list them)
  const deleteArg = process.argv[2];

  if (deleteArg === '--delete-all') {
    console.log('Deleting all pending subscriptions...\n');

    const { error: deleteError } = await supabase
      .from('featured_subscriptions')
      .delete()
      .eq('status', 'pending');

    if (deleteError) {
      console.error('Error deleting subscriptions:', deleteError);
      process.exit(1);
    }

    console.log(`Deleted ${pending.length} pending subscription(s).`);
  } else if (deleteArg) {
    // Delete specific ID
    const subToDelete = pending.find(s => s.id === deleteArg);
    if (!subToDelete) {
      console.log(`Subscription with ID ${deleteArg} not found or not pending.`);
      return;
    }

    const { error: deleteError } = await supabase
      .from('featured_subscriptions')
      .delete()
      .eq('id', deleteArg);

    if (deleteError) {
      console.error('Error deleting subscription:', deleteError);
      process.exit(1);
    }

    console.log(`Deleted subscription ${deleteArg}.`);
  } else {
    console.log('To delete all pending subscriptions, run:');
    console.log('  npx tsx scripts/cleanup-pending-subscriptions.ts --delete-all\n');
    console.log('To delete a specific subscription, run:');
    console.log('  npx tsx scripts/cleanup-pending-subscriptions.ts <subscription-id>');
  }
}

main().catch(console.error);
