'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { Program, ProgramLocation } from '@/types/database';
import { ComparisonProgram, CompareState, ComparisonCustomization } from '@/types/comparison';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'planmykids-compare';
const MAX_PROGRAMS_FREE = 3;
const MAX_PROGRAMS_PRO = 10; // Pro users can compare more programs

interface CompareContextType {
  programs: ComparisonProgram[];
  count: number;
  isFull: boolean;
  maxPrograms: number;
  userTier: 'free' | 'pro';
  addProgram: (program: Program & { program_locations?: ProgramLocation[] }) => boolean;
  removeProgram: (programId: string) => void;
  duplicateProgram: (programId: string) => boolean;
  clearAll: () => void;
  isSelected: (programId: string) => boolean;
  updateCustomization: (programId: string, customization: Partial<ComparisonCustomization>) => void;
  getCustomization: (programId: string) => ComparisonCustomization | undefined;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<ComparisonProgram[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'pro'>('free');
  const { user, loading: authLoading } = useAuth();

  // Check user subscription tier from API
  useEffect(() => {
    if (!user) {
      setUserTier('free');
      return;
    }

    fetch('/api/user/subscriptions')
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        if (result?.familyPlanner?.plan === 'pro' || result?.familyPlanner?.plan === 'family') {
          setUserTier('pro');
        } else {
          setUserTier('free');
        }
      })
      .catch(() => setUserTier('free'));
  }, [user]);

  // Calculate max programs based on user tier
  const maxPrograms = userTier === 'pro' ? MAX_PROGRAMS_PRO : MAX_PROGRAMS_FREE;

  // Guard: only validate once per session, not on every remount
  const hasValidated = useRef(false);

  // Load from localStorage on mount and validate programs still exist
  useEffect(() => {
    const loadAndValidate = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: CompareState = JSON.parse(stored);
          const storedPrograms = parsed.programs || [];

          if (storedPrograms.length > 0) {
            // If already validated this session, just load from localStorage without DB query
            if (hasValidated.current) {
              setPrograms(storedPrograms);
              setIsInitialized(true);
              return;
            }

            // Get IDs of stored programs (filter out duplicates which have _dup_ in ID)
            const originalIds = storedPrograms
              .map(p => p.program.id)
              .filter(id => !id.includes('_dup_'));

            // Check which programs still exist in database
            const { data: existingPrograms } = await supabase
              .from('programs')
              .select('id')
              .in('id', originalIds)
              .eq('status', 'active');

            const existingIds = new Set(existingPrograms?.map(p => p.id) || []);

            // Filter out deleted programs (keep duplicates if original exists)
            const validPrograms = storedPrograms.filter(p => {
              const originalId = p.program.id.split('_dup_')[0];
              return existingIds.has(originalId);
            });

            setPrograms(validPrograms);
            hasValidated.current = true;
          }
        }
      } catch (error) {
        console.error('Error loading comparison state:', error);
      }
      setIsInitialized(true);
    };

    loadAndValidate();
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (isInitialized) {
      const state: CompareState = {
        programs,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [programs, isInitialized]);

  const addProgram = useCallback((program: Program & { program_locations?: ProgramLocation[] }): boolean => {
    if (programs.length >= maxPrograms) return false;
    if (programs.some(p => p.program.id === program.id)) return false;

    const newEntry: ComparisonProgram = {
      program,
      customization: {
        costPerSession: program.price_min,
        selectedDays: [],
        assignedKids: [],
        registrationDate: program.new_registration_date || null,
        priority: null,
      },
    };

    setPrograms(prev => [...prev, newEntry]);
    return true;
  }, [programs, maxPrograms]);

  const duplicateProgram = useCallback((programId: string): boolean => {
    if (programs.length >= maxPrograms) return false;

    const existing = programs.find(p => p.program.id === programId);
    if (!existing) return false;

    // Create a duplicate with a unique ID (add timestamp suffix)
    const duplicateId = `${programId}_dup_${Date.now()}`;
    const duplicate: ComparisonProgram = {
      program: {
        ...existing.program,
        id: duplicateId,
        name: `${existing.program.name} (Copy)`,
      },
      customization: {
        costPerSession: existing.customization.costPerSession,
        selectedDays: [...existing.customization.selectedDays],
        assignedKids: [], // Start fresh for kid assignment
        registrationDate: existing.customization.registrationDate,
        priority: null, // Different priority
      },
    };

    setPrograms(prev => [...prev, duplicate]);
    return true;
  }, [programs, maxPrograms]);

  const removeProgram = useCallback((programId: string) => {
    setPrograms(prev => prev.filter(p => p.program.id !== programId));
  }, []);

  const clearAll = useCallback(() => {
    setPrograms([]);
  }, []);

  const isSelected = useCallback((programId: string): boolean => {
    return programs.some(p => p.program.id === programId);
  }, [programs]);

  const updateCustomization = useCallback((
    programId: string,
    customization: Partial<ComparisonCustomization>
  ) => {
    setPrograms(prev => prev.map(p =>
      p.program.id === programId
        ? { ...p, customization: { ...p.customization, ...customization } }
        : p
    ));
  }, []);

  const getCustomization = useCallback((programId: string) => {
    return programs.find(p => p.program.id === programId)?.customization;
  }, [programs]);

  return (
    <CompareContext.Provider value={{
      programs,
      count: programs.length,
      isFull: programs.length >= maxPrograms,
      maxPrograms,
      userTier,
      addProgram,
      removeProgram,
      duplicateProgram,
      clearAll,
      isSelected,
      updateCustomization,
      getCustomization,
    }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}
