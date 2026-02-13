'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FREE_PLAN_PROGRAM_LIMIT,
  FREE_PLAN_KID_LIMIT,
  FREE_PLAN_ADULT_LIMIT,
} from '@/lib/planner-limits';
import type {
  PlannerMigrationPayload,
  LegacyKid,
  LegacyAdult,
  LegacySavedProgram,
  LegacyTodo,
} from '@/types/planner';

// ═══════════════════════════════════════════════════════
// Dashboard-compatible interfaces (match existing inline types)
// ═══════════════════════════════════════════════════════

export interface Kid {
  id: string;
  name: string;
  birthday: string;
  age?: number;
  avatar: string;
  color: string;
}

export interface ResponsibleAdult {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  relationship: string;
  avatar: string;
}

export interface ScheduleTime {
  day: string;
  time: string;
  endTime?: string;
}

export interface SavedProgram {
  id: string;
  name: string;
  provider_name: string;
  category: string[];
  program_type?: string;
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;
  re_enrollment_date: string | null;
  new_registration_date: string | null;
  registration_url?: string | null;
  provider_website?: string | null;
  status: 'considering' | 'registered' | 'enrolled';
  assignedKids: string[];
  assignedAdult?: string;
  dropoffAdult?: string;
  pickupAdult?: string;
  dropoffTime?: string;
  pickupTime?: string;
  scheduleDays?: string[];
  scheduleTimes?: ScheduleTime[];
  enrollHoursStart?: string | null;
  enrollHoursEnd?: string | null;
  costPerSession?: number | null;
  priority?: number | null;
  sort_order?: number;
  savedAt?: string;
  sessionStartDate?: string | null;
  sessionEndDate?: string | null;
  original_re_enrollment_date?: string | null;
  original_new_registration_date?: string | null;
  original_registration_url?: string | null;
  hasPendingEdit?: boolean;
  // DB fields exposed for internal use
  _savedProgramId?: string; // planner_saved_programs.id (differs from program_id)
  _programId?: string | null; // planner_saved_programs.program_id
  _isCustom?: boolean;
  _sourceSavedProgramId?: string | null;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════
// Hook return type
// ═══════════════════════════════════════════════════════

export interface UsePlannerDataReturn {
  // State
  kids: Kid[];
  adults: ResponsibleAdult[];
  programs: SavedProgram[];
  todos: TodoItem[];
  reminders: Record<string, { registration?: boolean; re_enrollment?: boolean }>;
  subscription: { plan: 'free' | 'pro' | 'family' } | null;
  discrepancyDismissed: string[];
  preferences: {
    welcomeDismissed: boolean;
    reminderLeadTimeDays: number;
    reminderEmailEnabled: boolean;
  };
  loading: boolean;
  needsDowngrade: boolean;

  // Kid mutations
  addKid: (kid: Omit<Kid, 'id'>) => Promise<Kid | null>;
  updateKid: (kidId: string, updates: Partial<Kid>) => Promise<void>;
  removeKid: (kidId: string) => Promise<void>;

  // Adult mutations
  addAdult: (adult: Omit<ResponsibleAdult, 'id'>) => Promise<ResponsibleAdult | null>;
  updateAdult: (adultId: string, updates: Partial<ResponsibleAdult>) => Promise<void>;
  removeAdult: (adultId: string) => Promise<void>;

  // Program mutations
  saveProgram: (program: SaveProgramArgs) => Promise<SavedProgram | null>;
  updateProgram: (programId: string, updates: Partial<SavedProgram>) => Promise<void>;
  removeProgram: (programId: string) => Promise<void>;
  duplicateProgram: (program: SavedProgram) => Promise<SavedProgram | null>;
  reorderPrograms: (reorderedIds: string[], status: 'considering' | 'registered' | 'enrolled') => Promise<void>;

  // Todo mutations
  addTodo: (text: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
  clearCompletedTodos: () => Promise<void>;

  // Reminder mutations
  toggleReminder: (programId: string, type: 'registration' | 're_enrollment') => Promise<void>;

  // Discrepancy
  dismissDiscrepancy: (programId: string, permanent: boolean) => Promise<void>;

  // Preferences
  dismissWelcome: () => Promise<void>;
  updatePreferences: (prefs: { reminderLeadTimeDays?: number; reminderEmailEnabled?: boolean }) => Promise<void>;

  // Downgrade
  confirmDowngrade: (keepKidIds: string[], keepAdultIds: string[], keepProgramIds: string[]) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

export interface SaveProgramArgs {
  programId?: string | null;
  customProgramData?: {
    name: string;
    provider_name?: string;
    category?: string[];
    program_type?: string;
    price_min?: number | null;
    price_max?: number | null;
    price_unit?: string | null;
    provider_website?: string | null;
    registration_url?: string | null;
    re_enrollment_date?: string | null;
    new_registration_date?: string | null;
  } | null;
  status?: 'considering' | 'registered' | 'enrolled';
  assignAllKids?: boolean;
  kidIds?: string[];
  // Full program data for optimistic update
  name: string;
  provider_name?: string;
  category?: string[];
  program_type?: string;
  price_min?: number | null;
  price_max?: number | null;
  price_unit?: string | null;
  re_enrollment_date?: string | null;
  new_registration_date?: string | null;
  registration_url?: string | null;
  provider_website?: string | null;
}

// ═══════════════════════════════════════════════════════
// localStorage keys (for migration detection)
// ═══════════════════════════════════════════════════════

const LS_KEYS = {
  PROGRAMS: 'planmykids-saved-programs',
  KIDS: 'planmykids-saved-kids',
  ADULTS: 'planmykids-saved-adults',
  TODOS: 'planmykids-todos',
  REMINDERS: 'planmykids-reminders',
  REMINDER_SETTINGS: 'planmykids-reminder-settings',
  SUBSCRIPTION: 'planmykids-subscription',
  DISCREPANCY_DISMISSED: 'planmykids-discrepancy-dismissed',
  DISCREPANCY_SNOOZED: 'planmykids-discrepancy-snoozed',
  WELCOME_DISMISSED: 'planmykids-welcome-dismissed',
};

// ═══════════════════════════════════════════════════════
// Hook implementation
// ═══════════════════════════════════════════════════════

export function usePlannerData(authUserId?: string | null): UsePlannerDataReturn {
  const [kids, setKids] = useState<Kid[]>([]);
  const [adults, setAdults] = useState<ResponsibleAdult[]>([]);
  const [programs, setPrograms] = useState<SavedProgram[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [reminders, setReminders] = useState<Record<string, { registration?: boolean; re_enrollment?: boolean }>>({});
  const [subscription, setSubscription] = useState<{ plan: 'free' | 'pro' | 'family' } | null>(null);
  const [discrepancyDismissed, setDiscrepancyDismissed] = useState<string[]>([]);
  const [preferences, setPreferences] = useState({
    welcomeDismissed: false,
    reminderLeadTimeDays: 7,
    reminderEmailEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [needsDowngrade, setNeedsDowngrade] = useState(false);

  const userIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  // ─────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;
    userIdRef.current = userId;

    // Check if user has any DB data
    const { count: programCount } = await supabase
      .from('planner_saved_programs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: kidCount } = await supabase
      .from('planner_kids')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const hasDbData = (programCount ?? 0) > 0 || (kidCount ?? 0) > 0;

    // Check for localStorage data to migrate
    if (!hasDbData && typeof window !== 'undefined') {
      const lsPrograms = localStorage.getItem(LS_KEYS.PROGRAMS);
      const lsKids = localStorage.getItem(LS_KEYS.KIDS);
      if (lsPrograms || lsKids) {
        await migrateFromLocalStorage();
      }
    }

    // Parallel fetch all planner data
    const [
      kidsRes,
      adultsRes,
      programsRes,
      todosRes,
      remindersRes,
      dismissedRes,
      prefsRes,
      subRes,
    ] = await Promise.all([
      supabase
        .from('planner_kids')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order'),
      supabase
        .from('planner_adults')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order'),
      supabase
        .from('planner_saved_programs')
        .select(`
          *,
          program:programs(
            name, provider_name, category, program_type,
            price_min, price_max, price_unit,
            re_enrollment_date, new_registration_date,
            registration_url, provider_website
          ),
          kids:planner_program_kids(kid_id)
        `)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('planner_todos')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order'),
      supabase
        .from('planner_reminders')
        .select('*')
        .eq('user_id', userId),
      supabase
        .from('planner_discrepancy_dismissed')
        .select('program_id')
        .eq('user_id', userId),
      supabase
        .from('planner_user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      fetch('/api/user/subscriptions').then(r => r.json()).catch(() => null),
    ]);

    // Transform kids
    const mappedKids: Kid[] = (kidsRes.data || []).map(k => ({
      id: k.id,
      name: k.name,
      birthday: k.birthday || '',
      avatar: k.avatar,
      color: k.color,
    }));

    // Transform adults
    const mappedAdults: ResponsibleAdult[] = (adultsRes.data || []).map(a => ({
      id: a.id,
      name: a.name,
      email: a.email || undefined,
      phone: a.phone || undefined,
      relationship: a.relationship,
      avatar: a.avatar,
    }));

    // Transform programs
    const mappedPrograms: SavedProgram[] = (programsRes.data || []).map(sp => {
      const prog = sp.program;
      const custom = sp.custom_program_data as SaveProgramArgs['customProgramData'];
      const isCustom = !sp.program_id && !!custom;

      // Build assignedKids array
      let assignedKids: string[] = [];
      if (sp.assign_all_kids) {
        assignedKids = ['all'];
      } else if (sp.kids?.length) {
        assignedKids = sp.kids.map((k: { kid_id: string }) => k.kid_id);
      }

      return {
        id: sp.program_id || sp.id, // Use program_id for compatibility, fall back to saved ID
        name: isCustom ? (custom?.name || 'Custom Program') : (prog?.name || 'Unknown'),
        provider_name: isCustom ? (custom?.provider_name || '') : (prog?.provider_name || ''),
        category: isCustom ? (custom?.category || []) : (prog?.category || []),
        program_type: isCustom ? (custom?.program_type) : (prog?.program_type),
        price_min: isCustom ? (custom?.price_min ?? null) : (prog?.price_min ?? null),
        price_max: isCustom ? (custom?.price_max ?? null) : (prog?.price_max ?? null),
        price_unit: isCustom ? (custom?.price_unit ?? null) : (prog?.price_unit ?? null),
        // For dates: use override if set, otherwise canonical from programs table
        re_enrollment_date: sp.override_re_enrollment_date || (prog?.re_enrollment_date ?? custom?.re_enrollment_date ?? null),
        new_registration_date: sp.override_new_registration_date || (prog?.new_registration_date ?? custom?.new_registration_date ?? null),
        registration_url: sp.override_registration_url || (prog?.registration_url ?? custom?.registration_url ?? null),
        provider_website: isCustom ? (custom?.provider_website ?? null) : (prog?.provider_website ?? null),
        status: sp.status,
        assignedKids,
        assignedAdult: sp.assigned_adult_id || undefined,
        dropoffAdult: sp.dropoff_adult_id || undefined,
        pickupAdult: sp.pickup_adult_id || undefined,
        dropoffTime: sp.dropoff_time || undefined,
        pickupTime: sp.pickup_time || undefined,
        scheduleDays: sp.schedule_days || [],
        scheduleTimes: sp.schedule_times || [],
        enrollHoursStart: sp.enroll_hours_start,
        enrollHoursEnd: sp.enroll_hours_end,
        costPerSession: sp.cost_per_session ? Number(sp.cost_per_session) : null,
        priority: sp.priority,
        sort_order: sp.sort_order ?? 0,
        savedAt: sp.saved_at,
        sessionStartDate: sp.session_start_date,
        sessionEndDate: sp.session_end_date,
        // Original canonical values for discrepancy detection
        original_re_enrollment_date: prog?.re_enrollment_date ?? null,
        original_new_registration_date: prog?.new_registration_date ?? null,
        original_registration_url: prog?.registration_url ?? null,
        hasPendingEdit: sp.has_pending_edit ?? false,
        // Internal DB references
        _savedProgramId: sp.id,
        _programId: sp.program_id,
        _isCustom: isCustom,
        _sourceSavedProgramId: sp.source_saved_program_id,
      };
    });

    // Transform todos
    const mappedTodos: TodoItem[] = (todosRes.data || []).map(t => ({
      id: t.id,
      text: t.text,
      completed: t.completed,
      createdAt: t.created_at,
    }));

    // Transform reminders into Record<savedProgramId, { registration?, re_enrollment? }>
    const mappedReminders: Record<string, { registration?: boolean; re_enrollment?: boolean }> = {};
    for (const r of (remindersRes.data || [])) {
      // Map back to program ID (or saved_program_id) for compatibility
      const savedProg = mappedPrograms.find(p => p._savedProgramId === r.saved_program_id);
      const key = savedProg?.id || r.saved_program_id;
      if (!mappedReminders[key]) mappedReminders[key] = {};
      if (r.reminder_type === 'registration') mappedReminders[key].registration = r.enabled;
      if (r.reminder_type === 're_enrollment') mappedReminders[key].re_enrollment = r.enabled;
    }

    // Dismissed discrepancies
    const mappedDismissed = (dismissedRes.data || []).map(d => d.program_id);

    // Preferences
    if (prefsRes.data) {
      setPreferences({
        welcomeDismissed: prefsRes.data.welcome_dismissed,
        reminderLeadTimeDays: prefsRes.data.reminder_lead_time_days,
        reminderEmailEnabled: prefsRes.data.reminder_email_enabled,
      });
    }

    // Subscription
    const subPlan = subRes?.familyPlanner?.plan || 'free';
    setSubscription({ plan: subPlan });

    // Set all state
    setKids(mappedKids);
    setAdults(mappedAdults);
    setPrograms(mappedPrograms);
    setTodos(mappedTodos);
    setReminders(mappedReminders);
    setDiscrepancyDismissed(mappedDismissed);

    // Detect downgrade needed
    if (subPlan === 'free') {
      const overLimit =
        mappedKids.length > FREE_PLAN_KID_LIMIT ||
        mappedAdults.length > FREE_PLAN_ADULT_LIMIT ||
        mappedPrograms.length > FREE_PLAN_PROGRAM_LIMIT;
      setNeedsDowngrade(overLimit);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // Skip data loading entirely if we know there's no user
    if (authUserId === null) {
      setLoading(false);
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadData();
    }
  }, [loadData, authUserId]);

  // ─────────────────────────────────────────────────
  // Helper: get saved_program_id from program.id
  // ─────────────────────────────────────────────────

  const getSavedProgramId = useCallback((programId: string): string | undefined => {
    const prog = programs.find(p => p.id === programId);
    return prog?._savedProgramId;
  }, [programs]);

  // ─────────────────────────────────────────────────
  // Kid mutations
  // ─────────────────────────────────────────────────

  const addKid = useCallback(async (kid: Omit<Kid, 'id'>): Promise<Kid | null> => {
    const tempId = `temp-${Date.now()}`;
    const newKid: Kid = { ...kid, id: tempId };

    // Optimistic update
    setKids(prev => [...prev, newKid]);

    try {
      const res = await fetch('/api/planner/kids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: kid.name,
          birthday: kid.birthday || null,
          avatar: kid.avatar,
          color: kid.color,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Rollback
        setKids(prev => prev.filter(k => k.id !== tempId));
        throw new Error(err.error || 'Failed to add kid');
      }

      const { data } = await res.json();
      // Replace temp with real
      const realKid: Kid = {
        id: data.id,
        name: data.name,
        birthday: data.birthday || '',
        avatar: data.avatar,
        color: data.color,
      };
      setKids(prev => prev.map(k => (k.id === tempId ? realKid : k)));
      return realKid;
    } catch (err) {
      setKids(prev => prev.filter(k => k.id !== tempId));
      throw err;
    }
  }, []);

  const updateKid = useCallback(async (kidId: string, updates: Partial<Kid>) => {
    const prev = kids;
    setKids(curr => curr.map(k => (k.id === kidId ? { ...k, ...updates } : k)));

    const { error } = await supabase
      .from('planner_kids')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.birthday !== undefined && { birthday: updates.birthday || null }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
        ...(updates.color !== undefined && { color: updates.color }),
      })
      .eq('id', kidId);

    if (error) {
      setKids(prev);
      throw new Error(error.message);
    }
  }, [kids]);

  const removeKid = useCallback(async (kidId: string) => {
    const prevKids = kids;
    const prevPrograms = programs;
    setKids(curr => curr.filter(k => k.id !== kidId));
    // Also unassign from programs optimistically
    setPrograms(curr =>
      curr.map(p => ({
        ...p,
        assignedKids: p.assignedKids.filter(k => k !== kidId),
      }))
    );

    try {
      const res = await fetch(`/api/planner/kids?id=${kidId}`, { method: 'DELETE' });
      if (!res.ok) {
        setKids(prevKids);
        setPrograms(prevPrograms);
        throw new Error('Failed to remove kid');
      }
    } catch (err) {
      setKids(prevKids);
      setPrograms(prevPrograms);
      throw err;
    }
  }, [kids, programs]);

  // ─────────────────────────────────────────────────
  // Adult mutations
  // ─────────────────────────────────────────────────

  const addAdult = useCallback(async (adult: Omit<ResponsibleAdult, 'id'>): Promise<ResponsibleAdult | null> => {
    const tempId = `temp-${Date.now()}`;
    const newAdult: ResponsibleAdult = { ...adult, id: tempId };

    setAdults(prev => [...prev, newAdult]);

    try {
      const res = await fetch('/api/planner/adults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adult.name,
          email: adult.email || null,
          phone: adult.phone || null,
          relationship: adult.relationship,
          avatar: adult.avatar,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setAdults(prev => prev.filter(a => a.id !== tempId));
        throw new Error(err.error || 'Failed to add adult');
      }

      const { data } = await res.json();
      const realAdult: ResponsibleAdult = {
        id: data.id,
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        relationship: data.relationship,
        avatar: data.avatar,
      };
      setAdults(prev => prev.map(a => (a.id === tempId ? realAdult : a)));
      return realAdult;
    } catch (err) {
      setAdults(prev => prev.filter(a => a.id !== tempId));
      throw err;
    }
  }, []);

  const updateAdult = useCallback(async (adultId: string, updates: Partial<ResponsibleAdult>) => {
    const prev = adults;
    setAdults(curr => curr.map(a => (a.id === adultId ? { ...a, ...updates } : a)));

    const { error } = await supabase
      .from('planner_adults')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.email !== undefined && { email: updates.email || null }),
        ...(updates.phone !== undefined && { phone: updates.phone || null }),
        ...(updates.relationship !== undefined && { relationship: updates.relationship }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
      })
      .eq('id', adultId);

    if (error) {
      setAdults(prev);
      throw new Error(error.message);
    }
  }, [adults]);

  const removeAdult = useCallback(async (adultId: string) => {
    const prevAdults = adults;
    const prevPrograms = programs;
    setAdults(curr => curr.filter(a => a.id !== adultId));
    // Clear adult assignments from programs
    setPrograms(curr =>
      curr.map(p => ({
        ...p,
        assignedAdult: p.assignedAdult === adultId ? undefined : p.assignedAdult,
        dropoffAdult: p.dropoffAdult === adultId ? undefined : p.dropoffAdult,
        pickupAdult: p.pickupAdult === adultId ? undefined : p.pickupAdult,
      }))
    );

    try {
      const res = await fetch(`/api/planner/adults?id=${adultId}`, { method: 'DELETE' });
      if (!res.ok) {
        setAdults(prevAdults);
        setPrograms(prevPrograms);
        throw new Error('Failed to remove adult');
      }
    } catch (err) {
      setAdults(prevAdults);
      setPrograms(prevPrograms);
      throw err;
    }
  }, [adults, programs]);

  // ─────────────────────────────────────────────────
  // Program mutations
  // ─────────────────────────────────────────────────

  const saveProgram = useCallback(async (args: SaveProgramArgs): Promise<SavedProgram | null> => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: SavedProgram = {
      id: args.programId || tempId,
      name: args.name,
      provider_name: args.provider_name || '',
      category: args.category || [],
      program_type: args.program_type,
      price_min: args.price_min ?? null,
      price_max: args.price_max ?? null,
      price_unit: args.price_unit ?? null,
      re_enrollment_date: args.re_enrollment_date ?? null,
      new_registration_date: args.new_registration_date ?? null,
      registration_url: args.registration_url ?? null,
      provider_website: args.provider_website ?? null,
      status: args.status || 'considering',
      assignedKids: args.assignAllKids ? ['all'] : (args.kidIds || []),
      sort_order: 0,
      savedAt: new Date().toISOString(),
      _savedProgramId: tempId,
      _programId: args.programId,
      _isCustom: !args.programId,
    };

    setPrograms(prev => [optimistic, ...prev]);

    try {
      const res = await fetch('/api/planner/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: args.programId || null,
          custom_program_data: args.customProgramData || null,
          status: args.status || 'considering',
          assign_all_kids: args.assignAllKids || false,
          kid_ids: args.kidIds || [],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setPrograms(prev => prev.filter(p => p._savedProgramId !== tempId));
        throw new Error(err.error || 'Failed to save program');
      }

      const { data } = await res.json();
      // Update with real saved_program_id
      setPrograms(prev =>
        prev.map(p =>
          p._savedProgramId === tempId ? { ...p, _savedProgramId: data.id } : p
        )
      );
      return { ...optimistic, _savedProgramId: data.id };
    } catch (err) {
      setPrograms(prev => prev.filter(p => p._savedProgramId !== tempId));
      throw err;
    }
  }, []);

  const updateProgram = useCallback(async (programId: string, updates: Partial<SavedProgram>) => {
    const prog = programs.find(p => p.id === programId);
    if (!prog?._savedProgramId) return;

    const prevPrograms = programs;
    setPrograms(curr => curr.map(p => (p.id === programId ? { ...p, ...updates } : p)));

    // Build DB update payload
    const dbUpdates: Record<string, unknown> = {};

    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.scheduleDays !== undefined) dbUpdates.schedule_days = updates.scheduleDays;
    if (updates.scheduleTimes !== undefined) dbUpdates.schedule_times = updates.scheduleTimes;
    if (updates.sessionStartDate !== undefined) dbUpdates.session_start_date = updates.sessionStartDate || null;
    if (updates.sessionEndDate !== undefined) dbUpdates.session_end_date = updates.sessionEndDate || null;
    if (updates.enrollHoursStart !== undefined) dbUpdates.enroll_hours_start = updates.enrollHoursStart || null;
    if (updates.enrollHoursEnd !== undefined) dbUpdates.enroll_hours_end = updates.enrollHoursEnd || null;
    if (updates.costPerSession !== undefined) dbUpdates.cost_per_session = updates.costPerSession;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.sort_order !== undefined) dbUpdates.sort_order = updates.sort_order;
    if (updates.dropoffTime !== undefined) dbUpdates.dropoff_time = updates.dropoffTime || null;
    if (updates.pickupTime !== undefined) dbUpdates.pickup_time = updates.pickupTime || null;
    if (updates.hasPendingEdit !== undefined) dbUpdates.has_pending_edit = updates.hasPendingEdit;

    // Date/URL overrides
    if (updates.re_enrollment_date !== undefined) {
      dbUpdates.override_re_enrollment_date =
        updates.re_enrollment_date !== prog.original_re_enrollment_date
          ? updates.re_enrollment_date
          : null;
    }
    if (updates.new_registration_date !== undefined) {
      dbUpdates.override_new_registration_date =
        updates.new_registration_date !== prog.original_new_registration_date
          ? updates.new_registration_date
          : null;
    }
    if (updates.registration_url !== undefined) {
      dbUpdates.override_registration_url =
        updates.registration_url !== prog.original_registration_url
          ? updates.registration_url
          : null;
    }

    // Adult assignments
    if (updates.assignedAdult !== undefined) dbUpdates.assigned_adult_id = updates.assignedAdult || null;
    if (updates.dropoffAdult !== undefined) dbUpdates.dropoff_adult_id = updates.dropoffAdult || null;
    if (updates.pickupAdult !== undefined) dbUpdates.pickup_adult_id = updates.pickupAdult || null;

    // Kid assignments handled separately
    if (updates.assignedKids !== undefined) {
      const isAll = updates.assignedKids.length === 1 && updates.assignedKids[0] === 'all';
      dbUpdates.assign_all_kids = isAll;

      // Update junction table
      await supabase
        .from('planner_program_kids')
        .delete()
        .eq('saved_program_id', prog._savedProgramId);

      if (!isAll && updates.assignedKids.length > 0) {
        await supabase.from('planner_program_kids').insert(
          updates.assignedKids.map(kid_id => ({
            saved_program_id: prog._savedProgramId!,
            kid_id,
          }))
        );
      }
    }

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase
        .from('planner_saved_programs')
        .update(dbUpdates)
        .eq('id', prog._savedProgramId);

      if (error) {
        setPrograms(prevPrograms);
        throw new Error(error.message);
      }
    }
  }, [programs]);

  const removeProgram = useCallback(async (programId: string) => {
    const prog = programs.find(p => p.id === programId);
    if (!prog?._savedProgramId) return;

    const prevPrograms = programs;
    setPrograms(curr => curr.filter(p => p.id !== programId));

    try {
      const res = await fetch(`/api/planner/programs?id=${prog._savedProgramId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setPrograms(prevPrograms);
        throw new Error('Failed to remove program');
      }
    } catch (err) {
      setPrograms(prevPrograms);
      throw err;
    }
  }, [programs]);

  const duplicateProgram = useCallback(async (program: SavedProgram): Promise<SavedProgram | null> => {
    if (!program._savedProgramId) return null;

    const tempId = `temp-dup-${Date.now()}`;
    const duplicate: SavedProgram = {
      ...program,
      id: `${program.id}-dup-${Date.now()}`,
      _savedProgramId: tempId,
      _sourceSavedProgramId: program._savedProgramId,
      savedAt: new Date().toISOString(),
      status: 'considering',
      assignedKids: [],
    };

    setPrograms(prev => [...prev, duplicate]);

    try {
      // Insert duplicate via service client (through direct Supabase with RLS)
      const { data, error } = await supabase
        .from('planner_saved_programs')
        .insert({
          user_id: userIdRef.current,
          program_id: program._programId || null,
          source_saved_program_id: program._savedProgramId,
          status: 'considering',
          custom_program_data: program._isCustom
            ? {
                name: program.name,
                provider_name: program.provider_name,
                category: program.category,
                program_type: program.program_type,
                price_min: program.price_min,
                price_max: program.price_max,
                price_unit: program.price_unit,
              }
            : null,
          saved_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        setPrograms(prev => prev.filter(p => p._savedProgramId !== tempId));
        throw new Error(error.message);
      }

      setPrograms(prev =>
        prev.map(p =>
          p._savedProgramId === tempId ? { ...p, _savedProgramId: data.id } : p
        )
      );
      return { ...duplicate, _savedProgramId: data.id };
    } catch (err) {
      setPrograms(prev => prev.filter(p => p._savedProgramId !== tempId));
      throw err;
    }
  }, [programs]);

  const reorderPrograms = useCallback(async (reorderedIds: string[], status: 'considering' | 'registered' | 'enrolled') => {
    const prevPrograms = programs;

    // Optimistic update: reorder programs in state
    setPrograms(curr => {
      const statusPrograms = curr.filter(p => p.status === status);
      const otherPrograms = curr.filter(p => p.status !== status);
      const reordered = reorderedIds
        .map(id => statusPrograms.find(p => p.id === id))
        .filter(Boolean) as SavedProgram[];
      // Update sort_order on each
      const withOrder = reordered.map((p, i) => ({ ...p, sort_order: i }));
      return [...otherPrograms, ...withOrder];
    });

    // Batch DB update
    try {
      const updates = reorderedIds.map((id, index) => {
        const prog = programs.find(p => p.id === id);
        return prog?._savedProgramId
          ? supabase
              .from('planner_saved_programs')
              .update({ sort_order: index })
              .eq('id', prog._savedProgramId)
          : null;
      }).filter(Boolean);

      await Promise.all(updates);
    } catch {
      setPrograms(prevPrograms);
    }
  }, [programs]);

  // ─────────────────────────────────────────────────
  // Todo mutations
  // ─────────────────────────────────────────────────

  const addTodo = useCallback(async (text: string) => {
    const tempId = `temp-${Date.now()}`;
    const newTodo: TodoItem = {
      id: tempId,
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTodos(prev => [...prev, newTodo]);

    const { data, error } = await supabase
      .from('planner_todos')
      .insert({
        user_id: userIdRef.current,
        text,
        completed: false,
        sort_order: todos.length,
      })
      .select('id, created_at')
      .single();

    if (error) {
      setTodos(prev => prev.filter(t => t.id !== tempId));
      throw new Error(error.message);
    }

    setTodos(prev =>
      prev.map(t =>
        t.id === tempId ? { ...t, id: data.id, createdAt: data.created_at } : t
      )
    );
  }, [todos.length]);

  const toggleTodo = useCallback(async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    setTodos(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));

    const { error } = await supabase
      .from('planner_todos')
      .update({ completed: !todo.completed })
      .eq('id', id);

    if (error) {
      setTodos(prev => prev.map(t => (t.id === id ? { ...t, completed: todo.completed } : t)));
    }
  }, [todos]);

  const removeTodo = useCallback(async (id: string) => {
    const prev = todos;
    setTodos(curr => curr.filter(t => t.id !== id));

    const { error } = await supabase
      .from('planner_todos')
      .delete()
      .eq('id', id);

    if (error) setTodos(prev);
  }, [todos]);

  const clearCompletedTodos = useCallback(async () => {
    const completedIds = todos.filter(t => t.completed).map(t => t.id);
    if (completedIds.length === 0) return;

    const prev = todos;
    setTodos(curr => curr.filter(t => !t.completed));

    const { error } = await supabase
      .from('planner_todos')
      .delete()
      .in('id', completedIds);

    if (error) setTodos(prev);
  }, [todos]);

  // ─────────────────────────────────────────────────
  // Reminder mutations
  // ─────────────────────────────────────────────────

  const toggleReminder = useCallback(async (programId: string, type: 'registration' | 're_enrollment') => {
    const savedProgramId = getSavedProgramId(programId);
    if (!savedProgramId) return;

    const current = reminders[programId]?.[type] ?? false;
    const newVal = !current;

    setReminders(prev => ({
      ...prev,
      [programId]: { ...prev[programId], [type]: newVal },
    }));

    if (newVal) {
      // Upsert enabled reminder
      await supabase.from('planner_reminders').upsert(
        {
          user_id: userIdRef.current!,
          saved_program_id: savedProgramId,
          reminder_type: type,
          enabled: true,
        },
        { onConflict: 'user_id,saved_program_id,reminder_type' }
      );
    } else {
      // Delete the reminder row
      await supabase
        .from('planner_reminders')
        .delete()
        .eq('user_id', userIdRef.current!)
        .eq('saved_program_id', savedProgramId)
        .eq('reminder_type', type);
    }
  }, [reminders, getSavedProgramId]);

  // ─────────────────────────────────────────────────
  // Discrepancy
  // ─────────────────────────────────────────────────

  const dismissDiscrepancy = useCallback(async (programId: string, permanent: boolean) => {
    setDiscrepancyDismissed(prev => [...prev, programId]);

    if (permanent) {
      await supabase.from('planner_discrepancy_dismissed').upsert({
        user_id: userIdRef.current!,
        program_id: programId,
      });
    }
  }, []);

  // ─────────────────────────────────────────────────
  // Preferences
  // ─────────────────────────────────────────────────

  const dismissWelcome = useCallback(async () => {
    setPreferences(prev => ({ ...prev, welcomeDismissed: true }));

    await supabase.from('planner_user_preferences').upsert({
      user_id: userIdRef.current!,
      welcome_dismissed: true,
    });
  }, []);

  const updatePreferences = useCallback(async (prefs: { reminderLeadTimeDays?: number; reminderEmailEnabled?: boolean }) => {
    setPreferences(prev => ({ ...prev, ...prefs }));

    await supabase.from('planner_user_preferences').upsert({
      user_id: userIdRef.current!,
      ...(prefs.reminderLeadTimeDays !== undefined && { reminder_lead_time_days: prefs.reminderLeadTimeDays }),
      ...(prefs.reminderEmailEnabled !== undefined && { reminder_email_enabled: prefs.reminderEmailEnabled }),
    });
  }, []);

  // ─────────────────────────────────────────────────
  // Downgrade
  // ─────────────────────────────────────────────────

  const confirmDowngrade = useCallback(async (
    keepKidIds: string[],
    keepAdultIds: string[],
    keepProgramIds: string[],
  ) => {
    // Map keepProgramIds to saved_program_ids
    const keepSavedIds = keepProgramIds
      .map(pid => programs.find(p => p.id === pid)?._savedProgramId)
      .filter(Boolean) as string[];

    const res = await fetch('/api/planner/downgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keepKidIds,
        keepAdultIds,
        keepProgramIds: keepSavedIds,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Downgrade failed');
    }

    setNeedsDowngrade(false);
    await loadData(); // Refresh all data
  }, [programs, loadData]);

  // ─────────────────────────────────────────────────
  // localStorage migration
  // ─────────────────────────────────────────────────

  const migrateFromLocalStorage = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      const lsKids: LegacyKid[] = JSON.parse(localStorage.getItem(LS_KEYS.KIDS) || '[]');
      const lsAdults: LegacyAdult[] = JSON.parse(localStorage.getItem(LS_KEYS.ADULTS) || '[]');
      const lsPrograms: LegacySavedProgram[] = JSON.parse(localStorage.getItem(LS_KEYS.PROGRAMS) || '[]');
      const lsTodos: LegacyTodo[] = JSON.parse(localStorage.getItem(LS_KEYS.TODOS) || '[]');
      const lsReminders = JSON.parse(localStorage.getItem(LS_KEYS.REMINDERS) || '{}');
      const lsDismissed: string[] = JSON.parse(localStorage.getItem(LS_KEYS.DISCREPANCY_DISMISSED) || '[]');
      const welcomeDismissed = localStorage.getItem(LS_KEYS.WELCOME_DISMISSED) === 'true';
      const reminderSettings = JSON.parse(localStorage.getItem(LS_KEYS.REMINDER_SETTINGS) || '{}');

      const payload: PlannerMigrationPayload = {
        kids: lsKids,
        adults: lsAdults,
        programs: lsPrograms,
        todos: lsTodos,
        reminders: lsReminders,
        dismissedDiscrepancies: lsDismissed,
        welcomeDismissed,
        reminderSettings: {
          leadTimeDays: reminderSettings.leadTimeDays ?? 7,
          emailEnabled: reminderSettings.emailEnabled ?? false,
        },
      };

      const res = await fetch('/api/planner/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.migrated) {
          // Clear all localStorage keys
          Object.values(LS_KEYS).forEach(key => localStorage.removeItem(key));
        }
      }
    } catch {
      // Migration failed silently — user will keep using localStorage
      // until next load attempt
    }
  }, []);

  return {
    kids,
    adults,
    programs,
    todos,
    reminders,
    subscription,
    discrepancyDismissed,
    preferences,
    loading,
    needsDowngrade,
    addKid,
    updateKid,
    removeKid,
    addAdult,
    updateAdult,
    removeAdult,
    saveProgram,
    updateProgram,
    removeProgram,
    duplicateProgram,
    reorderPrograms,
    addTodo,
    toggleTodo,
    removeTodo,
    clearCompletedTodos,
    toggleReminder,
    dismissDiscrepancy,
    dismissWelcome,
    updatePreferences,
    confirmDowngrade,
    refresh: loadData,
  };
}
