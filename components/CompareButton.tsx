'use client';

import { useCompare } from '@/contexts/CompareContext';
import { useAuth } from '@/contexts/AuthContext';
import { Program, ProgramLocation } from '@/types/database';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface CompareButtonProps {
  program: Program & { program_locations?: ProgramLocation[] };
  variant?: 'card' | 'detail';
}

export default function CompareButton({ program, variant = 'card' }: CompareButtonProps) {
  const { addProgram, removeProgram, isSelected, isFull } = useCompare();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isInPlanner, setIsInPlanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const savedProgramIdRef = useRef<string | null>(null);

  // Check if program is in family planner via Supabase
  useEffect(() => {
    setMounted(true);
    if (!user) return;

    const checkPlanner = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('planner_saved_programs')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('program_id', program.id)
        .maybeSingle();

      if (data) {
        setIsInPlanner(true);
        savedProgramIdRef.current = data.id;
      }
    };

    checkPlanner();
  }, [user, program.id]);

  const selected = mounted ? (user ? isInPlanner : isSelected(program.id)) : false;
  const full = mounted ? isFull : false;

  const addToFamilyPlanner = async () => {
    setIsLoading(true);
    try {
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
        setIsInPlanner(true);
        savedProgramIdRef.current = data.id;
      } else if (res.status === 409) {
        setIsInPlanner(true);
      }
    } catch (e) {
      console.error('Error adding to family planner:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromFamilyPlanner = async () => {
    if (!savedProgramIdRef.current) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/planner/programs?id=${savedProgramIdRef.current}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIsInPlanner(false);
        savedProgramIdRef.current = null;
      }
    } catch (e) {
      console.error('Error removing from family planner:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;

    if (user) {
      // For signed-in users, add directly to family planner
      if (isInPlanner) {
        removeFromFamilyPlanner();
      } else {
        addToFamilyPlanner();
      }
    } else {
      // For non-signed-in users, use compare functionality
      if (selected) {
        removeProgram(program.id);
      } else {
        addProgram(program);
      }
    }
  };

  // Different label based on auth state
  const getButtonText = () => {
    if (user) {
      return isInPlanner ? 'Remove from Planner' : 'Add to Planner';
    }
    return selected ? 'Remove from Compare' : full ? 'Compare Full (3 max)' : 'Add to Compare';
  };

  const getTitle = () => {
    if (user) {
      return isInPlanner ? 'Remove from Family Planner' : 'Add to Family Planner';
    }
    return selected ? 'Remove from comparison' : full ? 'Maximum 3 programs' : 'Add to comparison';
  };

  if (variant === 'card') {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading || (!user && !selected && full)}
        className={`absolute top-3 right-3 sm:top-4 sm:right-4 w-11 h-11 sm:w-8 sm:h-8 rounded-full transition-all z-10 flex items-center justify-center text-lg font-bold shadow-md ${
          selected
            ? user
              ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
              : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
            : (!user && full)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : user
                ? 'bg-white text-green-600 hover:bg-green-100 hover:text-green-700 active:bg-green-200 border border-green-200'
                : 'bg-white text-gray-600 hover:bg-primary-100 hover:text-primary-600 active:bg-primary-200 border border-gray-200'
        }`}
        title={getTitle()}
      >
        {selected ? '✓' : '+'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || (!user && !selected && full)}
      className={`px-4 py-3 sm:py-2 rounded-lg transition-colors font-medium min-h-[44px] sm:min-h-0 ${
        selected
          ? user
            ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
            : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
          : (!user && full)
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : user
              ? 'bg-white text-green-700 hover:bg-green-100 active:bg-green-200 border border-green-200'
              : 'bg-white text-gray-700 hover:bg-primary-100 active:bg-primary-200 border border-gray-200'
      }`}
    >
      {getButtonText()}
    </button>
  );
}
