import { createClient } from '@supabase/supabase-js';

export interface AdminLogEntry {
  admin_email: string;
  action: string;
  entity_type: 'program' | 'subscription' | 'user' | 'system';
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}

// Server-side only - uses service role key
export async function logAdminAction(entry: AdminLogEntry): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for admin logging');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from('admin_activity_log').insert([entry]);

    if (error) {
      console.error('Failed to log admin action:', error);
    }
  } catch (error) {
    console.error('Admin logging error:', error);
  }
}

// Action types for consistency
export const AdminActions = {
  // Program actions
  PROGRAM_APPROVED: 'program_approved',
  PROGRAM_REJECTED: 'program_rejected',
  PROGRAM_EDITED: 'program_edited',
  PROGRAM_MERGED: 'program_merged',
  PROGRAM_DELETED: 'program_deleted',
  PROGRAM_STATUS_CHANGED: 'program_status_changed',

  // Edit request actions
  EDIT_REQUEST_APPROVED: 'edit_request_approved',
  EDIT_REQUEST_REJECTED: 'edit_request_rejected',

  // Subscription actions
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',

  // User actions
  USER_DELETED: 'user_deleted',

  // System actions
  ADMIN_LOGIN: 'admin_login',
  SETTINGS_CHANGED: 'settings_changed',
} as const;

export type AdminAction = typeof AdminActions[keyof typeof AdminActions];
