import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// One-time setup endpoint to create the admin_activity_log table
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Try to query the table first
    const { error: checkError } = await supabase
      .from('admin_activity_log')
      .select('id')
      .limit(1);

    if (checkError?.code === 'PGRST116' || checkError?.message?.includes('does not exist')) {
      // Table doesn't exist, return SQL for manual creation
      return NextResponse.json({
        error: 'Table does not exist',
        message: 'Please run this SQL in your Supabase dashboard SQL editor:',
        sql: `
CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_activity_admin_email ON admin_activity_log(admin_email);
CREATE INDEX idx_admin_activity_action ON admin_activity_log(action);
CREATE INDEX idx_admin_activity_entity_type ON admin_activity_log(entity_type);
CREATE INDEX idx_admin_activity_created_at ON admin_activity_log(created_at DESC);
        `.trim(),
      });
    }

    return NextResponse.json({ success: true, message: 'Table already exists' });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
