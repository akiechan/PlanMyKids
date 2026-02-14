'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ReauthState {
  needsReauth: boolean;
  reauthMessage: string;
}

export function useReauthAction() {
  const { signInWithGoogle } = useAuth();
  const [reauthState, setReauthState] = useState<ReauthState>({
    needsReauth: false,
    reauthMessage: '',
  });

  /**
   * Execute a fetch action. If it returns reauthentication_required,
   * set state to show the re-auth dialog.
   * Returns the Response on success, or null if re-auth is needed.
   */
  const executeWithReauth = useCallback(
    async (action: () => Promise<Response>): Promise<Response | null> => {
      const response = await action();

      if (response.status === 403) {
        const data = await response.clone().json().catch(() => null);
        if (data?.error === 'reauthentication_required') {
          setReauthState({
            needsReauth: true,
            reauthMessage: data.message || 'Please sign in again to perform this action.',
          });
          return null;
        }
      }

      return response;
    },
    []
  );

  const handleReauth = useCallback(async () => {
    const currentPath = window.location.pathname;
    await signInWithGoogle(currentPath);
  }, [signInWithGoogle]);

  const dismissReauth = useCallback(() => {
    setReauthState({ needsReauth: false, reauthMessage: '' });
  }, []);

  return {
    executeWithReauth,
    needsReauth: reauthState.needsReauth,
    reauthMessage: reauthState.reauthMessage,
    handleReauth,
    dismissReauth,
  };
}
