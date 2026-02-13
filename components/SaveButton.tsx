'use client';

import { useState, useEffect, useRef } from 'react';
import { Program, ProgramLocation } from '@/types/database';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FREE_PLAN_PROGRAM_LIMIT } from '@/lib/planner-limits';

interface SaveButtonProps {
  program: Program & { program_locations?: ProgramLocation[] };
  variant?: 'card' | 'detail';
}

export default function SaveButton({ program, variant = 'card' }: SaveButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [hasSavedPrograms, setHasSavedPrograms] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const savedProgramIdRef = useRef<string | null>(null); // DB row id for DELETE

  useEffect(() => {
    setMounted(true);
    if (!user) return;

    // Check saved state from Supabase
    const checkSaved = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // Check if this specific program is saved
      const { data: saved } = await supabase
        .from('planner_saved_programs')
        .select('id')
        .eq('user_id', userId)
        .eq('program_id', program.id)
        .maybeSingle();

      if (saved) {
        setIsSaved(true);
        savedProgramIdRef.current = saved.id;
      }

      // Check total count for limit + "has saved" flag
      const { count } = await supabase
        .from('planner_saved_programs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      const totalSaved = count ?? 0;
      setHasSavedPrograms(totalSaved > 0);

      // Limit check done server-side, but show UI hint
      // We don't know subscription status here without another call,
      // so we'll let the API handle 403 on save attempts
    };

    checkSaved();
  }, [program.id, user]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isSaved && savedProgramIdRef.current) {
        // Remove from saved via API
        const res = await fetch(`/api/planner/programs?id=${savedProgramIdRef.current}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setIsSaved(false);
          savedProgramIdRef.current = null;
        }
      } else {
        // Save via API (limit check happens server-side)
        const res = await fetch('/api/planner/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: program.id,
            status: 'considering',
          }),
        });

        if (res.ok) {
          const { data } = await res.json();
          setIsSaved(true);
          setHasSavedPrograms(true);
          savedProgramIdRef.current = data.id;
          setShowTooltip(true);
          setTimeout(() => setShowTooltip(false), 2000);
        } else if (res.status === 403) {
          alert(`Free plan is limited to ${FREE_PLAN_PROGRAM_LIMIT} programs. Upgrade to Pro for unlimited programs!`);
          router.push('/familyplanning/billing');
        } else if (res.status === 409) {
          // Already saved
          setIsSaved(true);
        }
      }
    } catch {
      // Network error — silently ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSaved = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push('/familyplanning/dashboard');
  };

  if (!mounted) return null;

  if (variant === 'card') {
    // Show prominent button when user has saved programs (to encourage adding more)
    if (hasSavedPrograms && !isSaved) {
      return (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
          <button
            onClick={handleClick}
            disabled={isLoading}
            className={`h-11 w-11 sm:h-8 sm:w-auto sm:px-2 rounded-full transition-all flex items-center justify-center gap-1 text-sm sm:text-xs font-medium shadow-md bg-green-500 text-white hover:bg-green-600 active:bg-green-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Add to Family Planner"
          >
            <span>📋</span>
            <span className="hidden sm:inline">+</span>
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-12 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50">
              Added to Planner!{' '}
              <button
                onClick={handleViewSaved}
                className="underline hover:text-blue-300 cursor-pointer"
                type="button"
              >
                View Dashboard
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
        <button
          onClick={handleClick}
          disabled={isLoading}
          className={`w-11 h-11 sm:w-8 sm:h-8 rounded-full transition-all flex items-center justify-center text-lg shadow-md ${
            isSaved
              ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
              : 'bg-white text-gray-600 hover:bg-blue-100 hover:text-blue-600 active:bg-blue-200 border border-gray-200'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isSaved ? 'Saved to Family Planning' : 'Save to Family Planning'}
        >
          {isSaved ? '✓' : '📋'}
        </button>
        {showTooltip && (
          <div className="absolute right-0 top-12 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50">
            Saved!{' '}
            <button
              onClick={handleViewSaved}
              className="underline hover:text-blue-300 cursor-pointer"
              type="button"
            >
              View Dashboard
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${
          isSaved
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-white text-gray-700 hover:bg-blue-100 border border-gray-200'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span>{isSaved ? '💾' : '📋'}</span>
        {isLoading ? 'Saving...' : isSaved ? 'Saved' : 'Save to Family Planning'}
      </button>
      {showTooltip && (
        <div className="absolute left-0 top-14 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50">
          Saved!{' '}
          <button
            onClick={handleViewSaved}
            className="underline hover:text-blue-300 cursor-pointer"
            type="button"
          >
            View Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
