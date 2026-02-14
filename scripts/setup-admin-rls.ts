// Run with: npx tsx --env-file=.env.local scripts/setup-admin-rls.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const ADMIN_EMAIL = 'piraky3@gmail.com';

async function main() {
  // 1. Set admin role in app_metadata for the admin user
  console.log(`\nSetting admin role for ${ADMIN_EMAIL}...`);

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }

  const adminUser = users.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL
  );

  if (adminUser) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      { app_metadata: { ...adminUser.app_metadata, role: 'admin' } }
    );
    if (updateError) {
      console.error('Error updating user metadata:', updateError.message);
    } else {
      console.log(`Set app_metadata.role = 'admin' for ${ADMIN_EMAIL} (uid: ${adminUser.id})`);
    }
  } else {
    console.log(`User ${ADMIN_EMAIL} not found. Role will need to be set after they sign in.`);
  }

  // 2. Note: RLS SQL is now managed via supabase/migrations/20260213000003_admin_rls.sql
  // Push with: supabase db push
  const rlsNote = `RLS migration is at supabase/migrations/20260213000003_admin_rls.sql
Run "supabase db push" to apply it.`;

  console.log('\n========================================');
  console.log(rlsNote);
  console.log('========================================');
}

main().catch(console.error);
