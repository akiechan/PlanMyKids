'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { CompareProvider } from '@/contexts/CompareContext';
import { RegionProvider } from '@/contexts/RegionContext';
import { ReactNode } from 'react';

// Migrate localStorage keys synchronously before any component reads them.
// Must run at module load time (not in useEffect) so Supabase auth and
// other consumers find the new keys on their first read.
if (typeof window !== 'undefined') {
  const MIGRATED_KEY = 'planmykids-migrated';
  if (!localStorage.getItem(MIGRATED_KEY)) {
    const oldPrefix = 'sf-enrichment-hub-';
    const newPrefix = 'planmykids-';
    const keysToMigrate: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(oldPrefix)) {
        keysToMigrate.push(key);
      }
    }

    for (const oldKey of keysToMigrate) {
      const newKey = newPrefix + oldKey.slice(oldPrefix.length);
      if (!localStorage.getItem(newKey)) {
        const value = localStorage.getItem(oldKey);
        if (value !== null) {
          localStorage.setItem(newKey, value);
        }
      }
      localStorage.removeItem(oldKey);
    }

    localStorage.setItem(MIGRATED_KEY, '1');
  }
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RegionProvider>
        <CompareProvider>
          {children}
        </CompareProvider>
      </RegionProvider>
    </AuthProvider>
  );
}
