import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

// Admin page/card names that represent where the action was taken
export type AdminPage =
  | 'Review Programs'
  | 'Edit Requests'
  | 'All Programs'
  | 'Search & Add'
  | 'Find & Merge Duplicates'
  | 'Mass Update'
  | 'Activity Log'
  | 'Setup';

// Action details - what was actually done
export type ActionDetail = 'added' | 'edited' | 'removed' | 'approved' | 'rejected' | 'merged' | 'updated';

export type EntityType = 'program' | 'subscription' | 'user' | 'system';

interface LogOptions {
  action: AdminPage;
  entityType: EntityType;
  entityId?: string;
  entityName?: string; // Program name or "Multiple programs (X)" for bulk
  details?: Record<string, unknown> & { action?: ActionDetail };
}

export function useAdminLogger() {
  const { user } = useAuth();

  const logAction = useCallback(
    async (options: LogOptions) => {
      // Use user email if logged in, otherwise use a default for development
      const adminEmail = user?.email || 'admin@dev.local';

      try {
        await fetch('/api/admin/log-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            admin_email: adminEmail,
            action: options.action,
            entity_type: options.entityType,
            entity_id: options.entityId,
            entity_name: options.entityName,
            details: options.details,
          }),
        });
      } catch (error) {
        console.error('Failed to log admin action:', error);
      }
    },
    [user?.email]
  );

  return { logAction };
}
