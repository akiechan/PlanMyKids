'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DateInput from '@/components/DateInput';
import { DateRangePicker } from '@/components/DateInput';
import {
  usePlannerData,
  type Kid,
  type ResponsibleAdult,
  type ScheduleTime,
  type SavedProgram,
  type TodoItem,
} from '@/hooks/usePlannerData';
import { FREE_PLAN_PROGRAM_LIMIT } from '@/lib/planner-limits';
import { useGridColumns } from '@/hooks/useGridColumns';
import GridSizeControl from '@/components/GridSizeControl';
import SortableCardList from '@/components/SortableCardList';
import SortableCard from '@/components/SortableCard';
import { generateRegistrationEvent, generateRecurringEvents, downloadICS } from '@/lib/calendar-export';

const getAgeFromBirthday = (birthday: string): number => {
  if (!birthday) return 0;
  const today = new Date();
  const birth = new Date(birthday);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

const getKidAge = (kid: Kid): number => {
  if (kid.birthday) return getAgeFromBirthday(kid.birthday);
  return kid.age || 0;
};

// Kid, ResponsibleAdult, ScheduleTime, SavedProgram, TodoItem imported from usePlannerData

interface CalendarEvent {
  id: string;
  programId: string;
  programName: string;
  type: 'registration' | 're-enrollment' | 'activity' | 'subscription';
  date: string;
  time?: string;
  assignedKids: string[];
  category?: string;
}

// Plan limits imported from @/lib/planner-limits

const CATEGORY_ICONS: Record<string, string> = {
  chess: '♟️',
  swimming: '🏊',
  art: '🎨',
  creative: '🎨',
  music: '🎵',
  soccer: '⚽',
  sports: '⚽',
  dance: '💃',
  'martial-arts': '🥋',
  technology: '💻',
  academic: '📚',
  science: '🔬',
};

// Card color theme by program type
const PROGRAM_TYPE_COLORS: Record<string, { bg: string; border: string; borderHover: string; registeredBorder: string }> = {
  program: { bg: 'bg-blue-50', border: 'border-blue-200', borderHover: 'hover:border-blue-300', registeredBorder: 'border-blue-300' },
  camp: { bg: 'bg-green-50', border: 'border-green-200', borderHover: 'hover:border-green-300', registeredBorder: 'border-green-300' },
  birthday_venue: { bg: 'bg-pink-50', border: 'border-pink-200', borderHover: 'hover:border-pink-300', registeredBorder: 'border-pink-300' },
};

const getCardColors = (programType?: string) => {
  return PROGRAM_TYPE_COLORS[programType || 'program'] || PROGRAM_TYPE_COLORS.program;
};

// Small animals for kids, large animals for adults
const KID_AVATARS = ['🐣', '🐰', '🐱', '🐹', '🐥', '🐨', '🦊', '🐻‍❄️'];
const ADULT_AVATARS = ['🦁', '🐘', '🦅', '🐻', '🐺', '🦬', '🦈', '🐎'];

// Day mapping to handle format differences between compare page and dashboard
const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

// Helper to normalize day format (handles both 'Mon' and 'monday' formats)
const normalizeDayKey = (day: string): string => {
  const lower = day.toLowerCase();
  const found = DAYS_OF_WEEK.find(d => d.key === lower || d.label.toLowerCase() === lower);
  return found ? found.key : lower;
};

const getDayLabel = (day: string): string => {
  const lower = day.toLowerCase();
  const found = DAYS_OF_WEEK.find(d => d.key === lower || d.label.toLowerCase() === lower);
  return found ? found.label : day;
};

// Check if a program is a duplicate (created via duplicate button)
// Duplicates have format: originalId-timestamp (13 digit timestamp at the end)
// Exclude custom programs which have format: custom-timestamp
const isDuplicateProgram = (programId: string): boolean => {
  if (programId.startsWith('custom-')) return false;
  const parts = programId.split('-');
  if (parts.length < 2) return false;
  const lastPart = parts[parts.length - 1];
  // Check if last part is a 13-digit timestamp (milliseconds since epoch)
  return /^\d{13}$/.test(lastPart);
};

// Get the base ID of a program (strips duplicate timestamp suffix)
const getBaseId = (programId: string): string => {
  if (isDuplicateProgram(programId)) {
    const parts = programId.split('-');
    parts.pop(); // Remove the timestamp
    return parts.join('-');
  }
  return programId;
};

// Count how many programs share the same base ID (original + duplicates)
const getRelatedProgramCount = (programs: SavedProgram[], programId: string): number => {
  const baseId = getBaseId(programId);
  return programs.filter(p => getBaseId(p.id) === baseId).length;
};

export default function SaveDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const plannerData = usePlannerData(authLoading ? undefined : (user?.id ?? null));
  const {
    kids, adults, programs, todos, reminders, subscription,
    discrepancyDismissed, preferences, loading: plannerLoading, needsDowngrade,
    refresh: refreshPlannerData,
    addKid: hookAddKid, updateKid: hookUpdateKid, removeKid: hookRemoveKid,
    addAdult: hookAddAdult, updateAdult: hookUpdateAdult, removeAdult: hookRemoveAdult,
    saveProgram: hookSaveProgram, updateProgram: hookUpdateProgram,
    removeProgram: hookRemoveProgram, duplicateProgram: hookDuplicateProgram,
    reorderPrograms: hookReorderPrograms,
    addTodo: hookAddTodo, toggleTodo: hookToggleTodo,
    removeTodo: hookRemoveTodo, clearCompletedTodos: hookClearCompletedTodos,
    toggleReminder: hookToggleReminder, dismissDiscrepancy: hookDismissDiscrepancy,
    dismissWelcome: hookDismissWelcome,
  } = plannerData;
  const consideringGrid = useGridColumns('considering');
  const enrolledGrid = useGridColumns('enrolled');
  const [mounted, setMounted] = useState(false);
  const [showAddKid, setShowAddKid] = useState(false);
  const [showAddAdult, setShowAddAdult] = useState(false);
  const [newKidName, setNewKidName] = useState('');
  const [newKidBirthday, setNewKidBirthday] = useState('');
  const [newKidAvatar, setNewKidAvatar] = useState('');
  const [newAdultName, setNewAdultName] = useState('');
  const [newAdultRelationship, setNewAdultRelationship] = useState('Parent');
  const [newAdultPhone, setNewAdultPhone] = useState('');
  const [newAdultAvatar, setNewAdultAvatar] = useState('');
  const [selectedView, setSelectedView] = useState<'list' | 'calendar'>('list');
  const [upcomingFilter, setUpcomingFilter] = useState<'dates' | 'activities' | 'all'>('dates');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [calendarKidFilter, setCalendarKidFilter] = useState<string[]>([]); // empty = all kids, or array of kid IDs
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<string[]>(['considering', 'registered']);
  const [programTypeFilter, setProgramTypeFilter] = useState<string[]>(['program', 'camp']);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [lastScrollTime, setLastScrollTime] = useState(0);
  const [editingProgram, setEditingProgram] = useState<string | null>(null);
  const [editSubmitNotification, setEditSubmitNotification] = useState<string | null>(null);
  const [editingKid, setEditingKid] = useState<string | null>(null);
  const [editKidForm, setEditKidForm] = useState({ name: '', birthday: '', color: 'blue', avatar: '' });
  const [editingAdult, setEditingAdult] = useState<string | null>(null);
  const [editAdultForm, setEditAdultForm] = useState({ name: '', relationship: 'Parent', phone: '', avatar: '' });
  const [showSearchPrograms, setShowSearchPrograms] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // Quick search popup state
  const [quickSearchType, setQuickSearchType] = useState<'program' | 'camp' | null>(null);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [quickSearchResults, setQuickSearchResults] = useState<any[]>([]);
  const [quickSearchLoading, setQuickSearchLoading] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customProgramForm, setCustomProgramForm] = useState({
    name: '',
    website: '',
    registration_url: '',
    re_enrollment_date: '',
    new_registration_date: '',
    costPerSession: null as number | null,
    campStartDate: '',
    campEndDate: '',
  });
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [featuredSubs, setFeaturedSubs] = useState<{ id: string; program_name: string; status: string; created_at: string; current_period_end: string | null; canceled_at: string | null }[]>([]);
  const [familyPlannerDetails, setFamilyPlannerDetails] = useState<{ plan: string; nextBillingDate: string | null; status: string; cancelAtPeriodEnd?: boolean } | null>(null);
  // Track discrepancies between user's dates and database dates (for family plan users)
  const [programDiscrepancies, setProgramDiscrepancies] = useState<Record<string, {
    db_new_registration_date: string | null;
    db_re_enrollment_date: string | null;
    db_registration_url: string | null;
  }>>({});
  const [editForm, setEditForm] = useState<{
    re_enrollment_date: string;
    new_registration_date: string;
    registration_url: string;
    scheduleDays: string[];
    scheduleTimes: ScheduleTime[];
    costPerSession: number | null;
    assignedKids: string[];
    priority: number | null;
    sessionStartDate: string;
    sessionEndDate: string;
  }>({
    re_enrollment_date: '',
    new_registration_date: '',
    registration_url: '',
    scheduleDays: [],
    scheduleTimes: [],
    costPerSession: null,
    assignedKids: [],
    priority: null,
    sessionStartDate: '',
    sessionEndDate: '',
  });

  // Enrollment modal state
  const [enrollingProgram, setEnrollingProgram] = useState<SavedProgram | null>(null);
  const [enrollForm, setEnrollForm] = useState({
    sessionStartDate: '',
    sessionEndDate: '',
    assignedKids: [] as string[],
    scheduleDays: [] as string[],
    scheduleTimes: [] as ScheduleTime[],
    hoursStart: '' as string,
    hoursEnd: '' as string,
    showCost: false,
    dropoffAdult: '' as string,
    pickupAdult: '' as string,
    costPerSession: null as number | null,
  });

  // reminders state provided by usePlannerData hook
  const [reminderTooltip, setReminderTooltip] = useState<string | null>(null); // programId-type

  // Welcome modal for new users with no kids
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [welcomeKidName, setWelcomeKidName] = useState('');
  const [welcomeKidBirthday, setWelcomeKidBirthday] = useState('');
  const [welcomeKidAvatar, setWelcomeKidAvatar] = useState('');

  // Filter state for current activities
  const [mobileUpcomingOpen, setMobileUpcomingOpen] = useState(false);
  const [mobileKidsOpen, setMobileKidsOpen] = useState(false);
  const [mobileAdultsOpen, setMobileAdultsOpen] = useState(false);
  const [mobileTodosOpen, setMobileTodosOpen] = useState(false);
  // todos state provided by usePlannerData hook
  const [newTodoText, setNewTodoText] = useState('');
  const [mobileConsideringExpanded, setMobileConsideringExpanded] = useState(true);
  const [mobileRegisteredExpanded, setMobileRegisteredExpanded] = useState(true);
  const [activityFilters, setActivityFilters] = useState({
    kidId: '' as string,
    category: '' as string,
    dateRange: 'all' as 'all' | 'active' | 'upcoming' | 'past',
  });

  // Guest state (no modal needed — we show a full landing page instead)

  // Data hydration handled by usePlannerData hook (loads from Supabase, auto-migrates localStorage)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Subscription fetched by usePlannerData hook
  // Still fetch featured subs + family planner details separately (billing UI only)
  useEffect(() => {
    if (!user) return;
    fetch('/api/user/subscriptions')
      .then(response => {
        if (!response.ok) throw new Error('API failed');
        return response.json();
      })
      .then(result => {
        if (result.featuredSubscriptions) {
          setFeaturedSubs(result.featuredSubscriptions);
        }
        if (result.familyPlanner) {
          setFamilyPlannerDetails({
            plan: result.familyPlanner.plan,
            nextBillingDate: result.familyPlanner.nextBillingDate || null,
            status: result.familyPlanner.status || 'active',
            cancelAtPeriodEnd: result.familyPlanner.cancelAtPeriodEnd || false,
          });
        }
      })
      .catch(() => {});
  }, [user]);

  // Check for upgrade success redirect — re-fetch subscription so Pro features work immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      setShowUpgradeBanner(true);
      window.history.replaceState({}, '', '/familyplanning/dashboard');
      refreshPlannerData();
    }
  }, []);

  // Show welcome modal if no kids after loading (only for authenticated users)
  useEffect(() => {
    if (user && mounted && !plannerLoading && kids.length === 0 && !preferences.welcomeDismissed) {
      setShowWelcomeModal(true);
    }
  }, [user, mounted, plannerLoading, kids.length, preferences.welcomeDismissed]);

  // Persistence handled by usePlannerData hook (writes to Supabase)
  // discrepancyDismissed provided by hook

  // Check for discrepancies between user's dates and database dates
  // Debounced: only runs once after programs stabilize (prevents burst queries)
  const discrepancyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedIdsRef = useRef<string>('');
  const [discrepancySnoozed, setDiscrepancySnoozed] = useState<string[]>([]);

  // Refs to avoid stale closures in the debounced setTimeout
  const discrepancyDismissedRef = useRef(discrepancyDismissed);
  discrepancyDismissedRef.current = discrepancyDismissed;
  const discrepancySnoozedRef = useRef(discrepancySnoozed);
  discrepancySnoozedRef.current = discrepancySnoozed;
  const programsRef = useRef(programs);
  programsRef.current = programs;

  useEffect(() => {
    if (!mounted || programs.length === 0) return;

    // Get unique base program IDs (not duplicates, not custom)
    const programIds = [...new Set(programs
      .filter(p => !isDuplicateProgram(p.id) && !p.id.startsWith('custom-'))
      .map(p => p.id))];

    if (programIds.length === 0) return;

    // Skip if we already checked these exact program IDs
    const idsKey = programIds.sort().join(',');
    if (idsKey === lastCheckedIdsRef.current) return;

    // Debounce: wait 2s after last programs.length change before querying
    if (discrepancyTimerRef.current) clearTimeout(discrepancyTimerRef.current);

    discrepancyTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('programs')
          .select('id, new_registration_date, re_enrollment_date, registration_url')
          .in('id', programIds);

        if (error) throw error;

        lastCheckedIdsRef.current = idsKey;

        const dismissed = discrepancyDismissedRef.current;
        const snoozed = discrepancySnoozedRef.current;
        const currentPrograms = programsRef.current;

        const discrepancies: Record<string, any> = {};
        (data || []).forEach(dbProgram => {
          // Skip permanently dismissed (from DB) or snoozed (session-only) programs
          if (dismissed.includes(dbProgram.id) || snoozed.includes(dbProgram.id)) return;

          const savedProgram = currentPrograms.find(p => getBaseId(p.id) === dbProgram.id);
          if (!savedProgram) return;

          // Check if dates differ between local and database
          const regDateDiffers = dbProgram.new_registration_date !== savedProgram.new_registration_date &&
            (dbProgram.new_registration_date || savedProgram.new_registration_date);
          const reEnrollDateDiffers = dbProgram.re_enrollment_date !== savedProgram.re_enrollment_date &&
            (dbProgram.re_enrollment_date || savedProgram.re_enrollment_date);

          if (regDateDiffers || reEnrollDateDiffers) {
            discrepancies[dbProgram.id] = {
              db_new_registration_date: dbProgram.new_registration_date,
              db_re_enrollment_date: dbProgram.re_enrollment_date,
              db_registration_url: dbProgram.registration_url,
            };
          }
        });

        setProgramDiscrepancies(discrepancies);
      } catch (err) {
        console.error('Error checking for discrepancies:', err);
      }
    }, 2000);

    return () => {
      if (discrepancyTimerRef.current) clearTimeout(discrepancyTimerRef.current);
    };
  }, [mounted, programs.length]);

  const { consideringPrograms, registeredPrograms } = useMemo(() => {
    const considering = programs.filter(p => p.status === 'considering' && programTypeFilter.includes(p.program_type || 'program'));
    const registered = programs.filter(p => (p.status === 'registered' || p.status === 'enrolled') && programTypeFilter.includes(p.program_type || 'program'));
    return { consideringPrograms: considering, registeredPrograms: registered };
  }, [programs, programTypeFilter]);

  // Helper to check if user has entered/modified a date
  const isUserEnteredDate = (program: SavedProgram, field: 'registration' | 're-enrollment'): boolean => {
    if (field === 'registration') {
      // User entered if: date exists AND (original was null/empty OR date differs from original)
      return !!program.new_registration_date && (
        !program.original_new_registration_date ||
        program.new_registration_date !== program.original_new_registration_date
      );
    } else {
      return !!program.re_enrollment_date && (
        !program.original_re_enrollment_date ||
        program.re_enrollment_date !== program.original_re_enrollment_date
      );
    }
  };

  // Generate calendar events from programs
  // Registered: show deadline if date is populated
  // Considering: only show if user has entered/modified the date
  const calendarEvents: CalendarEvent[] = useMemo(() => {
  const events: CalendarEvent[] = programs.flatMap(program => {
    const programEvents: CalendarEvent[] = [];

    const showRegDate = program.new_registration_date && (
      program.status === 'registered' || program.status === 'enrolled' || isUserEnteredDate(program, 'registration')
    );
    if (showRegDate) {
      programEvents.push({
        id: `${program.id}-reg`,
        programId: program.id,
        programName: program.name,
        type: 'registration',
        date: program.new_registration_date!,
        assignedKids: program.assignedKids || [],
        category: program.category?.[0],
      });
    }

    const showReEnrollDate = program.re_enrollment_date && (
      program.status === 'registered' || program.status === 'enrolled' || isUserEnteredDate(program, 're-enrollment')
    );
    if (showReEnrollDate) {
      programEvents.push({
        id: `${program.id}-reenroll`,
        programId: program.id,
        programName: program.name,
        type: 're-enrollment',
        date: program.re_enrollment_date!,
        assignedKids: program.assignedKids || [],
        category: program.category?.[0],
      });
    }

    // Add recurring activity events for current programs with schedule
    if ((program.status === 'registered' || program.status === 'enrolled') && program.scheduleTimes && program.scheduleTimes.length > 0) {
      // Generate events for the next 8 weeks
      const today = new Date();
      for (let weekOffset = 0; weekOffset < 8; weekOffset++) {
        program.scheduleTimes.forEach(st => {
          const dayIndex = DAYS_OF_WEEK.findIndex(d => d.key === normalizeDayKey(st.day));
          if (dayIndex === -1) return;

          // Calculate the date for this day in this week
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
          const eventDate = new Date(weekStart);
          eventDate.setDate(weekStart.getDate() + dayIndex);

          // Only add future events or today's events
          if (eventDate >= new Date(today.setHours(0, 0, 0, 0))) {
            const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
            // Include time range in the event
            const timeDisplay = st.endTime ? `${st.time} - ${st.endTime}` : st.time;
            programEvents.push({
              id: `${program.id}-activity-${dateStr}-${st.day}`,
              programId: program.id,
              programName: program.name,
              type: 'activity',
              date: dateStr,
              time: timeDisplay,
              assignedKids: program.assignedKids || [],
              category: program.category?.[0],
            });
          }
        });
      }
    }
    return programEvents;
  });

  // Add subscription calendar events (subscribe date + renewal dates)
  featuredSubs.forEach(sub => {
    if (sub.created_at) {
      events.push({
        id: `sub-${sub.id}-start`,
        programId: sub.id,
        programName: `Featured: ${sub.program_name}`,
        type: 'subscription',
        date: sub.created_at.split('T')[0],
        assignedKids: [],
      });
    }
    if (sub.current_period_end && (sub.status === 'active' || sub.status === 'trialing')) {
      events.push({
        id: `sub-${sub.id}-renew`,
        programId: sub.id,
        programName: `Renewal: ${sub.program_name}`,
        type: 'subscription',
        date: sub.current_period_end.split('T')[0],
        assignedKids: [],
      });
    }
    if (sub.canceled_at) {
      events.push({
        id: `sub-${sub.id}-canceled`,
        programId: sub.id,
        programName: `Canceled: ${sub.program_name}`,
        type: 'subscription',
        date: sub.canceled_at.split('T')[0],
        assignedKids: [],
      });
    }
  });

  if (familyPlannerDetails?.plan === 'pro' && familyPlannerDetails.nextBillingDate) {
    const isExpiring = familyPlannerDetails.status === 'cancelling';
    events.push({
      id: 'planner-renew',
      programId: 'family-planner',
      programName: isExpiring ? 'Family Planner Pro Expires' : 'Family Planner Pro Renewal',
      type: 'subscription',
      date: familyPlannerDetails.nextBillingDate.split('T')[0],
      assignedKids: [],
    });
  }

  return events;
  }, [programs, featuredSubs, familyPlannerDetails]);

  // Apply calendar filters to events
  const filteredCalendarEvents = useMemo(() => calendarEvents.filter(event => {
    // Subscription events always pass all filters
    if (event.type === 'subscription') return true;

    // Filter by kid (multi-select: empty array = show all)
    if (calendarKidFilter.length > 0) {
      if (!event.assignedKids.includes('all') && !calendarKidFilter.some(kf => event.assignedKids.includes(kf))) {
        return false;
      }
    }

    // Filter by status (considering vs registered)
    {
      const program = programs.find(p => p.id === event.programId);
      if (!program) return false;
      const programStatus = (program.status === 'registered' || program.status === 'enrolled') ? 'registered' : program.status;
      if (!calendarStatusFilter.includes(programStatus || 'considering')) return false;
    }

    // Filter by program type
    {
      const program = programs.find(p => p.id === event.programId);
      if (!program) return false;
      if (!programTypeFilter.includes(program.program_type || 'program')) return false;
    }

    return true;
  }), [calendarEvents, calendarKidFilter, calendarStatusFilter, programTypeFilter, programs]);

  const openEnrollmentModal = (program: SavedProgram) => {
    setEnrollingProgram(program);
    setEnrollForm({
      sessionStartDate: program.sessionStartDate || '',
      sessionEndDate: program.sessionEndDate || '',
      assignedKids: program.assignedKids.length > 0 ? [...program.assignedKids] : [],
      scheduleDays: program.scheduleDays ? [...program.scheduleDays] : [],
      scheduleTimes: program.scheduleTimes ? [...program.scheduleTimes] : [],
      hoursStart: program.enrollHoursStart || '',
      hoursEnd: program.enrollHoursEnd || '',
      showCost: program.costPerSession != null,
      dropoffAdult: program.dropoffAdult || '',
      pickupAdult: program.pickupAdult || '',
      costPerSession: program.costPerSession ?? null,
    });
  };

  const [enrollValidationError, setEnrollValidationError] = useState('');

  const resetEnrollForm = () => {
    setEnrollForm({ sessionStartDate: '', sessionEndDate: '', assignedKids: [], scheduleDays: [], scheduleTimes: [], hoursStart: '', hoursEnd: '', showCost: false, dropoffAdult: '', pickupAdult: '', costPerSession: null });
  };

  const confirmEnrollment = async () => {
    if (!enrollingProgram) return;
    const isCamp = enrollingProgram.program_type === 'camp';

    // Validate: kids must be assigned
    if (kids.length > 0 && enrollForm.assignedKids.length === 0) {
      setEnrollValidationError('Please assign at least one kid to this program.');
      return;
    }

    // Session dates are mandatory
    if (!enrollForm.sessionStartDate || !enrollForm.sessionEndDate) {
      setEnrollValidationError('Please set both session start and end dates.');
      return;
    }

    // For programs: at least one schedule day must be selected
    if (!isCamp && enrollForm.scheduleDays.length === 0) {
      setEnrollValidationError('Please select at least one scheduled day.');
      return;
    }

    setEnrollValidationError('');
    try {
      await hookUpdateProgram(enrollingProgram.id, {
        status: 'enrolled' as const,
        sessionStartDate: enrollForm.sessionStartDate || null,
        sessionEndDate: enrollForm.sessionEndDate || null,
        assignedKids: enrollForm.assignedKids,
        scheduleDays: isCamp ? [] : enrollForm.scheduleDays,
        scheduleTimes: isCamp ? [] : enrollForm.scheduleTimes,
        enrollHoursStart: isCamp ? (enrollForm.hoursStart || null) : null,
        enrollHoursEnd: isCamp ? (enrollForm.hoursEnd || null) : null,
        dropoffAdult: enrollForm.dropoffAdult || undefined,
        pickupAdult: enrollForm.pickupAdult || undefined,
        costPerSession: enrollForm.costPerSession,
      });
      setEnrollingProgram(null);
      resetEnrollForm();
    } catch {
      alert('Failed to save enrollment. Please try again.');
    }
  };

  const moveToConsidering = async (programId: string) => {
    try {
      await hookUpdateProgram(programId, { status: 'considering' as const });
    } catch {
      alert('Failed to update program status.');
    }
  };

  const toggleReminder = (programId: string, type: 'registration' | 're_enrollment') => {
    hookToggleReminder(programId, type);
    // Show tooltip
    const tooltipKey = `${programId}-${type}`;
    setReminderTooltip(tooltipKey);
    setTimeout(() => setReminderTooltip(prev => prev === tooltipKey ? null : prev), 2000);
  };

  const removeProgram = async (programId: string) => {
    const program = programs.find(p => p.id === programId);
    if (!confirm(`Remove "${program?.name || 'this program'}" from your planner?`)) return;
    try {
      await hookRemoveProgram(programId);
    } catch {
      alert('Failed to remove program.');
    }
  };

  const duplicateProgram = async (program: SavedProgram) => {
    try {
      await hookDuplicateProgram(program);
    } catch {
      alert('Failed to duplicate program.');
    }
  };

  const toggleKidAssignment = async (programId: string, kidId: string) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    // Normalize: convert ['all'] to all kid IDs for multi-select
    let currentKids = program.assignedKids.includes('all')
      ? kids.map(k => k.id)
      : [...program.assignedKids];

    const hasKid = currentKids.includes(kidId);
    try {
      if (hasKid) {
        // Don't deselect the last one
        if (currentKids.length <= 1) return;
        await hookUpdateProgram(programId, { assignedKids: currentKids.filter(k => k !== kidId) });
      } else {
        const newKids = [...currentKids, kidId];
        // If all kids are now selected, store as ['all']
        if (kids.length > 0 && newKids.length >= kids.length) {
          await hookUpdateProgram(programId, { assignedKids: ['all'] });
        } else {
          await hookUpdateProgram(programId, { assignedKids: newKids });
        }
      }
    } catch {
      alert('Failed to update kid assignment.');
    }
  };

  const startEditing = (program: SavedProgram) => {
    setEditingProgram(program.id);
    setEditForm({
      re_enrollment_date: program.re_enrollment_date || '',
      new_registration_date: program.new_registration_date || '',
      registration_url: program.registration_url || '',
      scheduleDays: program.scheduleDays || [],
      scheduleTimes: program.scheduleTimes || [],
      costPerSession: program.costPerSession ?? program.price_min ?? program.price_max ?? null,
      assignedKids: program.assignedKids || [],
      priority: program.priority || null,
      sessionStartDate: program.sessionStartDate || '',
      sessionEndDate: program.sessionEndDate || '',
    });
  };

  const saveEdit = async (programId: string) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;

    // Get base program ID (strip duplicate suffix for database lookup)
    const baseProgramId = getBaseId(programId);

    // Check if user has made changes to program data fields (that should go to admin queue)
    // Only send to admin if user is ADDING a new value, not removing an existing one
    const originalRegDate = program.original_new_registration_date ?? '';
    const originalReEnrollDate = program.original_re_enrollment_date ?? '';
    const originalRegUrl = program.original_registration_url ?? '';

    // Has a new value that's different from original (excluding removals)
    const hasNewRegistrationDate =
      editForm.new_registration_date &&
      editForm.new_registration_date !== originalRegDate;
    const hasNewReEnrollmentDate =
      editForm.re_enrollment_date &&
      editForm.re_enrollment_date !== originalReEnrollDate;
    const hasNewRegistrationUrl =
      editForm.registration_url &&
      editForm.registration_url !== originalRegUrl;

    // Only send to admin queue if there are NEW values added (not removals)
    const hasProgramDataChanges = hasNewRegistrationDate || hasNewReEnrollmentDate || hasNewRegistrationUrl;

    // If user made changes to program data (added new values), submit edit request to admin queue
    if (hasProgramDataChanges && !isDuplicateProgram(programId)) {
      try {
        // Build edited data for the edit request - only include fields with new values
        const editedData: Record<string, string | null> = {};
        if (hasNewRegistrationDate) {
          editedData.new_registration_date = editForm.new_registration_date;
        }
        if (hasNewReEnrollmentDate) {
          editedData.re_enrollment_date = editForm.re_enrollment_date;
        }
        if (hasNewRegistrationUrl) {
          editedData.registration_url = editForm.registration_url;
        }

        // Submit to program_edit_requests table
        const { error } = await supabase
          .from('program_edit_requests')
          .insert([{
            program_id: baseProgramId,
            status: 'pending',
            edited_data: editedData,
            submitted_by_email: user?.email || 'anonymous',
            submitted_by_name: user?.user_metadata?.full_name || user?.user_metadata?.name || null,
            edit_notes: `User suggested updates from Family Planner dashboard: ${[
              hasNewRegistrationDate ? 'Registration date' : null,
              hasNewReEnrollmentDate ? 'Re-enrollment date' : null,
              hasNewRegistrationUrl ? 'Registration URL' : null,
            ].filter(Boolean).join(', ')}`,
          }]);

        if (error) {
          console.error('Error submitting edit request:', error);
        } else {
          // Show notification
          setEditSubmitNotification(`Your suggested changes for "${program.name}" have been submitted for review!`);
          setTimeout(() => setEditSubmitNotification(null), 5000);
        }
      } catch (err) {
        console.error('Error submitting edit request:', err);
      }
    }

    // Update via hook (optimistic update + DB write)
    try {
      await hookUpdateProgram(programId, {
        re_enrollment_date: editForm.re_enrollment_date || null,
        new_registration_date: editForm.new_registration_date || null,
        registration_url: editForm.registration_url || null,
        scheduleDays: editForm.scheduleDays,
        scheduleTimes: editForm.scheduleTimes,
        costPerSession: editForm.costPerSession,
        assignedKids: editForm.assignedKids,
        priority: editForm.priority,
        sessionStartDate: editForm.sessionStartDate || null,
        sessionEndDate: editForm.sessionEndDate || null,
        hasPendingEdit: Boolean(hasProgramDataChanges && !isDuplicateProgram(programId)),
      });
      setEditingProgram(null);
    } catch {
      alert('Failed to save changes. Please try again.');
    }
  };

  const toggleEditKid = (kidId: string) => {
    setEditForm(prev => {
      // Normalize: convert ['all'] to all kid IDs
      let currentKids = prev.assignedKids.includes('all')
        ? kids.map(k => k.id)
        : [...prev.assignedKids];

      const hasKid = currentKids.includes(kidId);
      if (hasKid) {
        if (currentKids.length <= 1) return prev;
        return { ...prev, assignedKids: currentKids.filter(k => k !== kidId) };
      } else {
        const newKids = [...currentKids, kidId];
        if (kids.length > 0 && newKids.length >= kids.length) {
          return { ...prev, assignedKids: ['all'] };
        }
        return { ...prev, assignedKids: newKids };
      }
    });
  };

  const toggleScheduleDay = (dayKey: string) => {
    const normalizedKey = normalizeDayKey(dayKey);
    setEditForm(prev => {
      // Check if any variant of this day is already selected
      const isSelected = prev.scheduleDays.some(d => normalizeDayKey(d) === normalizedKey);
      if (isSelected) {
        // Remove day and its schedule time
        return {
          ...prev,
          scheduleDays: prev.scheduleDays.filter(d => normalizeDayKey(d) !== normalizedKey),
          scheduleTimes: prev.scheduleTimes.filter(st => normalizeDayKey(st.day) !== normalizedKey),
        };
      } else {
        // Add day with default time (5pm-6pm)
        return {
          ...prev,
          scheduleDays: [...prev.scheduleDays, normalizedKey],
          scheduleTimes: [...prev.scheduleTimes, { day: normalizedKey, time: '17:00', endTime: '18:00' }],
        };
      }
    });
  };

  const updateScheduleTime = (dayKey: string, field: 'time' | 'endTime', value: string) => {
    const normalizedKey = normalizeDayKey(dayKey);
    setEditForm(prev => ({
      ...prev,
      scheduleTimes: prev.scheduleTimes.map(st =>
        normalizeDayKey(st.day) === normalizedKey ? { ...st, [field]: value } : st
      ),
    }));
  };

  // Sync user's dates with database values (for family plan discrepancy resolution)
  const syncWithDatabaseDates = (programId: string) => {
    const baseId = getBaseId(programId);
    const discrepancy = programDiscrepancies[baseId];
    if (!discrepancy) return;

    // Update all programs sharing this base ID
    programs
      .filter(p => getBaseId(p.id) === baseId)
      .forEach(p => {
        hookUpdateProgram(p.id, {
          new_registration_date: discrepancy.db_new_registration_date,
          re_enrollment_date: discrepancy.db_re_enrollment_date,
          registration_url: discrepancy.db_registration_url,
        });
      });

    // Remove the discrepancy from state
    setProgramDiscrepancies(prev => {
      const updated = { ...prev };
      delete updated[baseId];
      return updated;
    });
  };

  // Dismiss discrepancy: keep user's dates (just hides for this session)
  const dismissDiscrepancy = (programId: string) => {
    const baseId = getBaseId(programId);
    setProgramDiscrepancies(prev => {
      const updated = { ...prev };
      delete updated[baseId];
      return updated;
    });
  };

  // Snooze discrepancy: remind me later (hides for this session, shows next session)
  const snoozeDiscrepancy = (programId: string) => {
    const baseId = getBaseId(programId);
    setDiscrepancySnoozed(prev => [...prev, baseId]);
    dismissDiscrepancy(programId);
  };

  // Permanently dismiss: don't remind me again
  const permanentlyDismissDiscrepancy = (programId: string) => {
    hookDismissDiscrepancy(programId, true);
    dismissDiscrepancy(programId);
  };

  const addKid = async () => {
    if (!newKidName.trim()) return;
    const colors = ['blue', 'green', 'purple', 'pink', 'orange'];
    try {
      await hookAddKid({
        name: newKidName,
        birthday: newKidBirthday,
        avatar: newKidAvatar || KID_AVATARS[kids.length % KID_AVATARS.length],
        color: colors[kids.length % colors.length],
      });
      setNewKidName('');
      setNewKidBirthday('');
      setNewKidAvatar('');
      setShowAddKid(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add kid');
    }
  };

  const addKidFromWelcome = async () => {
    if (!welcomeKidName.trim()) return;
    const colors = ['blue', 'green', 'purple', 'pink', 'orange'];
    try {
      await hookAddKid({
        name: welcomeKidName,
        birthday: welcomeKidBirthday,
        avatar: welcomeKidAvatar || KID_AVATARS[kids.length % KID_AVATARS.length],
        color: colors[kids.length % colors.length],
      });
      setWelcomeKidName('');
      setWelcomeKidBirthday('');
      setWelcomeKidAvatar('');
      hookDismissWelcome();
      setShowWelcomeModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add kid');
    }
  };

  const dismissWelcomeModal = () => {
    hookDismissWelcome();
    setShowWelcomeModal(false);
  };

  const removeKid = async (kidId: string) => {
    const kid = kids.find(k => k.id === kidId);
    if (!confirm(`Remove ${kid?.name || 'this kid'}? They will be unassigned from all programs.`)) return;
    try {
      await hookRemoveKid(kidId);
    } catch {
      alert('Failed to remove kid.');
    }
  };

  const addAdult = async () => {
    if (!newAdultName.trim()) return;
    try {
      await hookAddAdult({
        name: newAdultName.trim(),
        relationship: newAdultRelationship,
        phone: newAdultPhone || undefined,
        avatar: newAdultAvatar || ADULT_AVATARS[adults.length % ADULT_AVATARS.length],
      });
      setNewAdultName('');
      setNewAdultRelationship('Parent');
      setNewAdultPhone('');
      setNewAdultAvatar('');
      setShowAddAdult(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add adult');
    }
  };

  const removeAdult = async (adultId: string) => {
    const adult = adults.find(a => a.id === adultId);
    if (!confirm(`Remove ${adult?.name || 'this adult'}?`)) return;
    try {
      await hookRemoveAdult(adultId);
    } catch {
      alert('Failed to remove adult.');
    }
  };

  const startEditingAdult = (adult: ResponsibleAdult) => {
    setEditingAdult(adult.id);
    setEditAdultForm({ name: adult.name, relationship: adult.relationship, phone: adult.phone || '', avatar: adult.avatar });
  };

  const saveAdultEdit = async (adultId: string) => {
    if (!editAdultForm.name.trim()) return;
    try {
      await hookUpdateAdult(adultId, {
        name: editAdultForm.name.trim(),
        relationship: editAdultForm.relationship,
        phone: editAdultForm.phone || undefined,
        avatar: editAdultForm.avatar,
      });
      setEditingAdult(null);
      setEditAdultForm({ name: '', relationship: 'Parent', phone: '', avatar: '' });
    } catch {
      alert('Failed to save changes.');
    }
  };

  // Todo functions
  const addTodo = async () => {
    const text = newTodoText.trim();
    if (!text) return;
    setNewTodoText('');
    try {
      await hookAddTodo(text);
    } catch {
      alert('Failed to add todo.');
    }
  };

  const toggleTodo = async (id: string) => {
    try {
      await hookToggleTodo(id);
    } catch {
      // Silently handled — optimistic rollback in hook
    }
  };

  const removeTodo = async (id: string) => {
    try {
      await hookRemoveTodo(id);
    } catch {
      // Silently handled — optimistic rollback in hook
    }
  };

  const clearCompletedTodos = async () => {
    try {
      await hookClearCompletedTodos();
    } catch {
      // Silently handled — optimistic rollback in hook
    }
  };

  const updateProgramAdult = async (programId: string, adultId: string | undefined) => {
    try {
      await hookUpdateProgram(programId, { assignedAdult: adultId });
    } catch {
      alert('Failed to update adult assignment.');
    }
  };

  const updateProgramTransportAdult = async (programId: string, role: 'dropoffAdult' | 'pickupAdult', adultId: string | undefined) => {
    try {
      await hookUpdateProgram(programId, { [role]: adultId });
    } catch {
      alert('Failed to update transport assignment.');
    }
  };

  const startEditingKid = (kid: Kid) => {
    setEditingKid(kid.id);
    setEditKidForm({ name: kid.name, birthday: kid.birthday || '', color: kid.color, avatar: kid.avatar });
  };

  const saveKidEdit = async (kidId: string) => {
    if (!editKidForm.name.trim()) return;
    try {
      await hookUpdateKid(kidId, {
        name: editKidForm.name.trim(),
        birthday: editKidForm.birthday,
        color: editKidForm.color,
        avatar: editKidForm.avatar,
      });
      setEditingKid(null);
      setEditKidForm({ name: '', birthday: '', color: 'blue', avatar: '' });
    } catch {
      alert('Failed to save changes.');
    }
  };

  // Available colors for kids
  const kidColors = [
    { name: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700' },
    { name: 'green', bg: 'bg-green-500', light: 'bg-green-100', text: 'text-green-700' },
    { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
    { name: 'pink', bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700' },
    { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700' },
    { name: 'red', bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-700' },
    { name: 'yellow', bg: 'bg-yellow-500', light: 'bg-yellow-100', text: 'text-yellow-700' },
    { name: 'teal', bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700' },
  ];

  const getKidColor = (colorName: string) => {
    return kidColors.find(c => c.name === colorName) || kidColors[0];
  };

  const getAdultColor = (adultId: string) => {
    const idx = adults.findIndex(a => a.id === adultId);
    // Use purple/teal/orange range to distinguish from kid colors
    const adultColors = [
      { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700', pill: 'bg-purple-500 text-white' },
      { bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700', pill: 'bg-teal-500 text-white' },
      { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', pill: 'bg-amber-500 text-white' },
      { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700', pill: 'bg-rose-500 text-white' },
    ];
    return adultColors[Math.max(0, idx) % adultColors.length];
  };

  const searchExistingPrograms = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('programs')
        .select(`*, program_locations(*)`)
        .eq('status', 'active')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.cs.{${query.toLowerCase()}}`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching programs:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Check if user has reached the free plan limit
  const isAtProgramLimit = () => {
    if (!subscription || subscription.plan !== 'free') return false;
    return programs.length >= FREE_PLAN_PROGRAM_LIMIT;
  };

  const addProgramToPlanner = async (program: any) => {
    // Check if already added
    if (programs.some(p => p.id === program.id)) {
      return;
    }

    try {
      await hookSaveProgram({
        programId: program.id,
        name: program.name,
        provider_name: program.provider_name,
        category: program.category || [],
        program_type: program.program_type || 'program',
        price_min: program.price_min,
        price_max: program.price_max,
        price_unit: program.price_unit,
        re_enrollment_date: program.re_enrollment_date,
        new_registration_date: program.new_registration_date,
        registration_url: program.registration_url,
        provider_website: program.provider_website,
      });
      setShowSearchPrograms(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      alert(err.message || 'Failed to save program');
    }
  };

  // Quick search for the popup
  const quickSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runQuickSearch = (query: string, type: 'program' | 'camp') => {
    setQuickSearchQuery(query);
    if (!query.trim()) {
      setQuickSearchResults([]);
      return;
    }
    if (quickSearchDebounceRef.current) clearTimeout(quickSearchDebounceRef.current);
    quickSearchDebounceRef.current = setTimeout(async () => {
      setQuickSearchLoading(true);
      try {
        const programType = type === 'camp' ? 'camp' : 'program';
        const { data, error } = await supabase
          .from('programs')
          .select(`*, program_locations(*)`)
          .eq('status', 'active')
          .eq('program_type', programType)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.cs.{${query.toLowerCase()}}`)
          .limit(8);
        if (error) throw error;
        setQuickSearchResults(data || []);
      } catch (err) {
        console.error('Quick search error:', err);
        setQuickSearchResults([]);
      } finally {
        setQuickSearchLoading(false);
      }
    }, 300);
  };

  const openQuickSearch = (type: 'program' | 'camp') => {
    setQuickSearchType(type);
    setQuickSearchQuery('');
    setQuickSearchResults([]);
    setShowCreateCustom(false);
    setCustomProgramForm({ name: '', website: '', registration_url: '', re_enrollment_date: '', new_registration_date: '', costPerSession: null, campStartDate: '', campEndDate: '' });
  };

  const closeQuickSearch = () => {
    setQuickSearchType(null);
    setQuickSearchQuery('');
    setQuickSearchResults([]);
    setShowCreateCustom(false);
    setCustomProgramForm({ name: '', website: '', registration_url: '', re_enrollment_date: '', new_registration_date: '', costPerSession: null, campStartDate: '', campEndDate: '' });
  };

  const addFromQuickSearch = async (program: any) => {
    if (programs.some(p => p.id === program.id)) return;
    try {
      await hookSaveProgram({
        programId: program.id,
        name: program.name,
        provider_name: program.provider_name,
        category: program.category || [],
        program_type: program.program_type || (quickSearchType === 'camp' ? 'camp' : 'program'),
        price_min: program.price_min,
        price_max: program.price_max,
        price_unit: program.price_unit,
        re_enrollment_date: program.re_enrollment_date,
        new_registration_date: program.new_registration_date,
        registration_url: program.registration_url,
        provider_website: program.provider_website,
      });
      closeQuickSearch();
    } catch (err: any) {
      alert(err.message || 'Failed to save program');
    }
  };

  const addCustomProgram = async () => {
    if (!customProgramForm.name.trim()) return;

    const type = quickSearchType === 'camp' ? 'camp' : 'program';

    // Submit to programs table as pending for admin review
    setCustomSubmitting(true);
    try {
      const { data: insertedProgram, error } = await supabase
        .from('programs')
        .insert([{
          name: customProgramForm.name.trim(),
          category: [],
          description: '',
          age_min: 0,
          age_max: 18,
          provider_name: customProgramForm.name.trim(),
          provider_website: customProgramForm.website || null,
          registration_url: customProgramForm.registration_url || null,
          re_enrollment_date: customProgramForm.re_enrollment_date || null,
          new_registration_date: customProgramForm.new_registration_date || null,
          start_date: customProgramForm.campStartDate || null,
          end_date: customProgramForm.campEndDate || null,
          price_min: customProgramForm.costPerSession,
          price_max: customProgramForm.costPerSession,
          program_type: type,
          status: 'pending',
        }])
        .select('id')
        .single();

      if (error) {
        console.error('Error submitting program for review:', error);
        alert(`Failed to submit for review: ${error.message}`);
        return;
      }

      // Save to planner via hook (with the real program ID from DB)
      await hookSaveProgram({
        programId: insertedProgram?.id || null,
        customProgramData: !insertedProgram ? {
          name: customProgramForm.name.trim(),
          provider_website: customProgramForm.website || null,
          registration_url: customProgramForm.registration_url || null,
          re_enrollment_date: customProgramForm.re_enrollment_date || null,
          new_registration_date: customProgramForm.new_registration_date || null,
        } : undefined,
        name: customProgramForm.name.trim(),
        program_type: type,
        re_enrollment_date: customProgramForm.re_enrollment_date || null,
        new_registration_date: customProgramForm.new_registration_date || null,
        registration_url: customProgramForm.registration_url || null,
        provider_website: customProgramForm.website || null,
      });
    } catch (err: any) {
      console.error('Error submitting program for review:', err);
      alert(err.message || 'Failed to save program');
    } finally {
      setCustomSubmitting(false);
    }

    closeQuickSearch();
  };

  const formatPrice = (min: number | null, max: number | null, unit: string | null) => {
    if (!min && !max) return 'Price TBD';
    if (min === max) return `$${min}${unit ? `/${unit.replace('per ', '')}` : ''}`;
    return `$${min}-$${max}${unit ? `/${unit.replace('per ', '')}` : ''}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return calendarEvents
      .filter(e => {
        if (new Date(e.date + 'T00:00:00') < today) return false;
        if (upcomingFilter === 'dates') return e.type === 'registration' || e.type === 're-enrollment' || e.type === 'subscription';
        if (upcomingFilter === 'activities') return e.type === 'activity';
        return true; // 'all'
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 8);
  }, [calendarEvents, upcomingFilter]);

  const getAssignedKidsDisplay = (program: SavedProgram) => {
    if (program.assignedKids.includes('all')) {
      return kids.length === 1 ? kids[0].name : 'All kids';
    }
    if (program.assignedKids.length === 0) {
      return 'Not assigned';
    }
    return program.assignedKids
      .map(kidId => kids.find(k => k.id === kidId)?.name)
      .filter(Boolean)
      .join(', ');
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredCalendarEvents.filter(e => e.date === dateStr);
  };

  const getEventsForDateStr = (dateStr: string) => {
    return filteredCalendarEvents.filter(e => e.date === dateStr);
  };

  // Get week dates for a given date
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  // Format date to YYYY-MM-DD
  const formatDateStr = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Format time for display
  const formatTime = (time: string | undefined) => {
    if (!time) return '';
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return time;
    }
  };

  // Get kid avatars for an event
  const getEventKidAvatars = (event: CalendarEvent) => {
    if (event.assignedKids.includes('all')) {
      return kids.map(k => ({ avatar: k.avatar, name: k.name, color: k.color }));
    }
    return event.assignedKids
      .map(kidId => kids.find(k => k.id === kidId))
      .filter(Boolean)
      .map(k => ({ avatar: k!.avatar, name: k!.name, color: k!.color }));
  };

  // Navigate calendar
  const navigateCalendar = (direction: 'prev' | 'next') => {
    if (calendarViewMode === 'month') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + (direction === 'next' ? 1 : -1), 1));
    } else if (calendarViewMode === 'week') {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
      setSelectedDate(newDate);
      setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    } else {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
      setSelectedDate(newDate);
      setCurrentMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    }
  };

  // Handle scroll on calendar with throttling
  const handleCalendarScroll = (e: React.WheelEvent) => {
    const now = Date.now();
    // Throttle: only allow scroll navigation every 300ms
    if (now - lastScrollTime < 300) return;
    setLastScrollTime(now);

    if (e.deltaY > 0) {
      navigateCalendar('next');
    } else {
      navigateCalendar('prev');
    }
  };

  // Zoom into a specific date
  const zoomToDate = (date: Date) => {
    setSelectedDate(date);
    if (calendarViewMode === 'month') {
      setCalendarViewMode('week');
    } else if (calendarViewMode === 'week') {
      setCalendarViewMode('day');
    }
  };

  // Time slots for week/day view
  const timeSlots = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Show loading while checking auth
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Landing page for non-authenticated visitors (no need to wait for plannerLoading)
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50">
        {/* Hero */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-10">
          <div className="text-center mb-10 sm:mb-14">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">📋</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">Family Planner</h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              Your all-in-one dashboard to organize kids&apos; activities, camps, and programs across San Francisco.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login?next=/familyplanning/dashboard"
                className="px-8 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-md"
              >
                Sign In to Get Started
              </Link>
              <p className="text-sm text-gray-500">Free to use &middot; No credit card required</p>
            </div>
          </div>

          {/* Preview mockup */}
          <div className="mb-14">
            <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Here&apos;s what your dashboard looks like</h2>

            {/* Desktop preview — hidden on mobile */}
            <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              {/* Mock header */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">My Saved Programs</h3>
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm">
                    <div className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium">List</div>
                    <div className="px-3 py-1.5 text-gray-500 text-xs font-medium">Calendar</div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-4 gap-6">
                  {/* Sidebar */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">My Kids</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                          <span className="text-lg">🐣</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Emma</p>
                            <p className="text-xs text-gray-500">Age 7</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                          <span className="text-lg">🐰</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Liam</p>
                            <p className="text-xs text-gray-500">Age 5</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Dates</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-500">&#9679;</span>
                          <span className="text-gray-600">Chess registration <strong>Feb 15</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-500">&#9679;</span>
                          <span className="text-gray-600">Swim re-enroll <strong>Mar 1</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="col-span-3 space-y-4">
                    <h4 className="text-sm font-semibold text-green-700">Considering (3)</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-gray-900 text-sm">Chess Academy SF</p>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Program</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Bay Area Chess</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>🐣</span><span>Emma</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Mon, Wed &middot; 3:30 - 4:30 PM</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-gray-900 text-sm">Summer Swim Camp</p>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Camp</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">YMCA SF</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>🐣</span><span>Emma</span>
                          <span className="ml-1">🐰</span><span>Liam</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Jun 15 - Jul 12</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-gray-900 text-sm">Art Studio Kids</p>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Program</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Creative Arts Center</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>🐰</span><span>Liam</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Sat &middot; 10:00 - 11:30 AM</p>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-blue-700 mt-6">Enrolled (1)</h4>
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-gray-900 text-sm">Soccer League</p>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Program</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">SF Youth Soccer</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>🐣</span><span>Emma</span>
                        </div>
                        <span>Tue, Thu &middot; 4:00 - 5:00 PM</span>
                        <span className="text-green-600 font-medium">$45/session</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile preview — hidden on desktop */}
            <div className="lg:hidden bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              {/* Mock header */}
              <div className="bg-gray-50 border-b border-gray-200 px-3 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">My Saved Programs</h3>
                  <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 shadow-sm">
                    <div className="px-2 py-1 bg-blue-500 text-white rounded-md text-xs font-medium">List</div>
                    <div className="px-2 py-1 text-gray-500 text-xs font-medium">Calendar</div>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2">
                {/* Collapsible Kids accordion */}
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-gray-700">My Kids</h4>
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 flex-1">
                      <span className="text-sm">🐣</span>
                      <div>
                        <p className="text-xs font-medium text-gray-900">Emma</p>
                        <p className="text-[10px] text-gray-500">Age 7</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 flex-1">
                      <span className="text-sm">🐰</span>
                      <div>
                        <p className="text-xs font-medium text-gray-900">Liam</p>
                        <p className="text-[10px] text-gray-500">Age 5</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Upcoming accordion */}
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-gray-700">Upcoming Dates</h4>
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="space-y-1.5 mt-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-orange-500">&#9679;</span>
                      <span className="text-gray-600">Chess registration <strong>Feb 15</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-blue-500">&#9679;</span>
                      <span className="text-gray-600">Swim re-enroll <strong>Mar 1</strong></span>
                    </div>
                  </div>
                </div>

                {/* Considering section */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-green-700">Considering (3)</h4>
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                      <p className="font-medium text-gray-900 text-xs mb-1">Chess Academy SF</p>
                      <p className="text-[10px] text-gray-500 mb-1">Bay Area Chess</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span>🐣</span><span>Emma</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Mon, Wed</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                      <p className="font-medium text-gray-900 text-xs mb-1">Summer Swim Camp</p>
                      <p className="text-[10px] text-gray-500 mb-1">YMCA SF</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span>🐣</span><span>Emma</span>
                        <span className="ml-0.5">🐰</span><span>Liam</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Jun 15 - Jul 12</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                      <p className="font-medium text-gray-900 text-xs mb-1">Art Studio Kids</p>
                      <p className="text-[10px] text-gray-500 mb-1">Creative Arts Center</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span>🐰</span><span>Liam</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Sat &middot; 10-11:30 AM</p>
                    </div>
                  </div>
                </div>

                {/* Enrolled section */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-blue-700">Enrolled (1)</h4>
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-2.5">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-gray-900 text-xs">Soccer League</p>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Program</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-1">SF Youth Soccer</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <div className="flex items-center gap-1">
                        <span>🐣</span><span>Emma</span>
                      </div>
                      <span>Tue, Thu</span>
                      <span className="text-green-600 font-medium">$45/session</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-xl">👧</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Add your kids</h3>
              <p className="text-sm text-gray-500">Create profiles for each child with birthday, avatar, and interests. Assign programs to specific kids.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-xl">🔍</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Save &amp; compare programs</h3>
              <p className="text-sm text-gray-500">Browse hundreds of programs and camps, then save the ones you like here to compare side-by-side.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-xl">📅</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Track schedules</h3>
              <p className="text-sm text-gray-500">See your family&apos;s weekly schedule at a glance. Track days, times, and session dates for each activity.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-xl">💰</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Track costs</h3>
              <p className="text-sm text-gray-500">See monthly cost estimates across all enrolled programs. Know exactly what you&apos;re spending.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-xl">🔔</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Get reminders</h3>
              <p className="text-sm text-gray-500">Never miss a registration deadline or re-enrollment date. Get notified before spots fill up.</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-xl">👨‍👩‍👧‍👦</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Manage your family</h3>
              <p className="text-sm text-gray-500">Add responsible adults for dropoff/pickup. Keep everything organized in one place.</p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center pb-10">
            <Link
              href="/login?next=/familyplanning/dashboard"
              className="inline-block px-10 py-3.5 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-md"
            >
              Sign In to Get Started
            </Link>
            <p className="text-sm text-gray-500 mt-3">
              Already browsing programs? Save them from any program page with one click.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome Modal — shown when no kids are set up */}
      {showWelcomeModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👨‍👩‍👧‍👦</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Family Planner!</h2>
              <p className="text-gray-600 text-sm">Add your first child to get started. You can assign programs, track schedules, and manage activities for each child.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Child&apos;s Name</label>
                <input
                  type="text"
                  placeholder="e.g. Emma"
                  value={welcomeKidName}
                  onChange={e => setWelcomeKidName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && addKidFromWelcome()}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <DateInput label="Birthday" value={welcomeKidBirthday} onChange={v => setWelcomeKidBirthday(v)} size="sm" pastMonths={216} futureMonths={1} fixedPosition />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Avatar</label>
                  <div className="flex flex-wrap gap-1">
                    {KID_AVATARS.map(a => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setWelcomeKidAvatar(a)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all ${
                          (welcomeKidAvatar || KID_AVATARS[0]) === a
                            ? 'bg-green-100 ring-2 ring-green-400 scale-110'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={dismissWelcomeModal}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={addKidFromWelcome}
                disabled={!welcomeKidName.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Child
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Search Popup */}
      {quickSearchType && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[75vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {showCreateCustom
                  ? `Add New ${quickSearchType === 'camp' ? 'Camp' : 'Program'}`
                  : `Search ${quickSearchType === 'camp' ? 'Camps' : 'Programs'}`}
              </h2>
              <button onClick={closeQuickSearch} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!showCreateCustom ? (
              <>
                {/* Search Input */}
                <div className="p-4 pb-2">
                  <input
                    type="text"
                    placeholder={`Search for a ${quickSearchType === 'camp' ? 'camp' : 'program'}...`}
                    value={quickSearchQuery}
                    onChange={e => runQuickSearch(e.target.value, quickSearchType!)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {quickSearchLoading && (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {!quickSearchLoading && quickSearchResults.length > 0 && (
                    <div className="space-y-1.5">
                      {quickSearchResults.map(result => {
                        const alreadyAdded = programs.some(p => p.id === result.id);
                        return (
                          <button
                            key={result.id}
                            onClick={() => !alreadyAdded && addFromQuickSearch(result)}
                            disabled={alreadyAdded}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              alreadyAdded
                                ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 text-sm truncate">{result.name}</p>
                                {result.provider_name && (
                                  <p className="text-xs text-gray-500 truncate">{result.provider_name}</p>
                                )}
                              </div>
                              {alreadyAdded ? (
                                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">Added</span>
                              ) : (
                                <span className="text-xs text-blue-600 ml-2 flex-shrink-0">+ Add</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!quickSearchLoading && quickSearchQuery.trim() && quickSearchResults.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-gray-500 text-sm mb-1">No {quickSearchType === 'camp' ? 'camps' : 'programs'} found</p>
                    </div>
                  )}
                </div>

                {/* Footer — Create Custom */}
                <div className="p-4 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowCreateCustom(true);
                      setCustomProgramForm(prev => ({
                        ...prev,
                        name: quickSearchQuery.trim(),
                      }));
                    }}
                    className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="text-base">+</span>
                    Can&apos;t find it? Create a new {quickSearchType === 'camp' ? 'camp' : 'program'}
                  </button>
                  <div className="flex justify-center gap-3 mt-2">
                    <Link
                      href={quickSearchType === 'camp' ? '/camps' : '/programs'}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                      onClick={closeQuickSearch}
                    >
                      Browse all {quickSearchType === 'camp' ? 'camps' : 'programs'}
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              /* Create Custom Form */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 1. Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {quickSearchType === 'camp' ? 'Camp' : 'Program'} Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={quickSearchType === 'camp' ? 'e.g. Summer Soccer Camp' : 'e.g. Piano Lessons at Music School'}
                    value={customProgramForm.name}
                    onChange={e => setCustomProgramForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                {/* 2. Website */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Website</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={customProgramForm.website}
                    onChange={e => setCustomProgramForm(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 3. Cost */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {quickSearchType === 'camp' ? 'Cost ($)' : 'Cost per Session ($)'}
                  </label>
                  <input
                    type="number"
                    placeholder={quickSearchType === 'camp' ? 'e.g. 500' : 'e.g. 45'}
                    value={customProgramForm.costPerSession || ''}
                    onChange={e => setCustomProgramForm(prev => ({ ...prev, costPerSession: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 4. Camp Dates (camps only) */}
                {quickSearchType === 'camp' && (
                  <DateRangePicker
                    startValue={customProgramForm.campStartDate}
                    endValue={customProgramForm.campEndDate}
                    onStartChange={v => setCustomProgramForm(prev => ({ ...prev, campStartDate: v }))}
                    onEndChange={v => setCustomProgramForm(prev => ({ ...prev, campEndDate: v }))}
                    startLabel="Camp Start Date"
                    endLabel="Camp End Date"
                    fixedPosition
                  />
                )}

                {/* 5. Registration URL */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Registration Site</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={customProgramForm.registration_url}
                    onChange={e => setCustomProgramForm(prev => ({ ...prev, registration_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 6. Registration Date */}
                <DateInput
                  label="Registration Date"
                  value={customProgramForm.new_registration_date}
                  onChange={v => setCustomProgramForm(prev => ({ ...prev, new_registration_date: v }))}
                  size="sm"
                  fixedPosition
                />

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateCustom(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={addCustomProgram}
                    disabled={!customProgramForm.name.trim() || customSubmitting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {customSubmitting ? 'Adding...' : `Add ${quickSearchType === 'camp' ? 'Camp' : 'Program'}`}
                  </button>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  This will be submitted for review by our team to be added to the directory.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24">
        {/* Upgrade Success Banner */}
        {showUpgradeBanner && (
          <div className="mb-4 p-4 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🎉</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Welcome to Family Pro!</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  You now have <strong>unlimited</strong> kid profiles, parent profiles, and saved programs. Add as many as you need!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUpgradeBanner(false)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Plan Downgrade/Canceling Warning */}
        {familyPlannerDetails?.cancelAtPeriodEnd && familyPlannerDetails?.nextBillingDate && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-orange-900">Your Pro plan is ending</p>
              <p className="text-sm text-orange-700 mt-0.5">
                Your plan will downgrade to Free on{' '}
                <strong>{new Date(familyPlannerDetails.nextBillingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
                After that, you&apos;ll be limited to 1 kid, 1 parent, and 5 saved programs.
              </p>
              <Link
                href="/billing"
                className="inline-block mt-2 text-sm font-medium text-orange-700 underline hover:text-orange-900"
              >
                Manage subscription
              </Link>
            </div>
          </div>
        )}

        {/* Downgraded Warning — show if user was pro but is now free with excess data */}
        {subscription?.plan === 'free' && !familyPlannerDetails?.cancelAtPeriodEnd && (kids.length > 1 || adults.length > 1 || programs.length > FREE_PLAN_PROGRAM_LIMIT) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-red-900">Your plan has been downgraded</p>
              <p className="text-sm text-red-700 mt-0.5">
                You&apos;re on the Free plan but have more data than the free limit allows (1 kid, 1 parent, 5 programs).
                Your existing data is preserved, but you won&apos;t be able to add more until you upgrade.
              </p>
              <Link
                href="/familyplanning/billing"
                className="inline-block mt-2 text-sm font-medium text-red-700 underline hover:text-red-900"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        )}

        {/* Edit Submission Notification */}
        {editSubmitNotification && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-green-800">{editSubmitNotification}</span>
            </div>
            <button
              onClick={() => setEditSubmitNotification(null)}
              className="text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* Mobile Upgrade Banner */}
        {user && (
          <div className="lg:hidden flex justify-end mb-2">
            <Link
              href="/familyplanning/billing"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-indigo-700 transition-colors shadow-sm"
            >
              <span>✨</span> Upgrade to Pro
            </Link>
          </div>
        )}
        {/* (Guest sign-in banner removed — guests see landing page instead) */}

        {/* Title + View Toggle */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">My Saved Programs</h1>
          <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 sm:p-1 shadow-sm">
              <button
                onClick={() => setSelectedView('list')}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  selectedView === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">📋 </span>List
              </button>
              <button
                onClick={() => setSelectedView('calendar')}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  selectedView === 'calendar'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">📅 </span>Calendar
              </button>
          </div>
        </div>

        {/* Program Type Filter */}
        <div className="flex items-center gap-1 mb-4 sm:mb-6">
          <button
            onClick={() => setProgramTypeFilter(prev => {
              if (prev.includes('program')) {
                return prev.length > 1 ? prev.filter(t => t !== 'program') : prev;
              }
              return [...prev, 'program'];
            })}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
              programTypeFilter.includes('program')
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📚 Programs
          </button>
          <button
            onClick={() => setProgramTypeFilter(prev => {
              if (prev.includes('camp')) {
                return prev.length > 1 ? prev.filter(t => t !== 'camp') : prev;
              }
              return [...prev, 'camp'];
            })}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
              programTypeFilter.includes('camp')
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ⛺ Camps
          </button>
        </div>

        {selectedView === 'list' ? (
          <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Left Sidebar — on mobile: collapsible sections at top */}
            <div className="lg:col-span-1 order-1 lg:order-1 space-y-2 lg:space-y-0">
              {/* Mobile: collapsible accordion sections */}
              <div className="lg:hidden space-y-2">
                {/* Upcoming - collapsible */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <button
                    onClick={() => setMobileUpcomingOpen(!mobileUpcomingOpen)}
                    className="w-full px-3 py-1.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🔔</span>
                      <span className="font-medium text-xs text-gray-700">Upcoming</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{upcomingEvents.length}</span>
                    </div>
                    <span className={`text-gray-400 text-[10px] transition-transform ${mobileUpcomingOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {mobileUpcomingOpen && (
                    <div className="px-4 pb-3">
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-2">
                        {([
                          { key: 'dates' as const, label: 'Dates' },
                          { key: 'activities' as const, label: 'Activities' },
                          { key: 'all' as const, label: 'All' },
                        ]).map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => setUpcomingFilter(tab.key)}
                            className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${
                              upcomingFilter === tab.key
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {upcomingEvents.length > 0 ? (
                          upcomingEvents.map(event => (
                            <div
                              key={event.id}
                              className={`p-2 rounded-lg border text-xs ${
                                event.type === 'registration'
                                  ? 'bg-red-50 border-red-200'
                                  : event.type === 're-enrollment'
                                    ? 'bg-blue-50 border-blue-200'
                                    : event.type === 'subscription'
                                      ? 'bg-purple-50 border-purple-200'
                                      : 'bg-green-50 border-green-200'
                              }`}
                            >
                              <p className="font-medium text-gray-900 truncate">{event.programName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span>{event.type === 'registration' ? '📋' : event.type === 're-enrollment' ? '🔄' : event.type === 'subscription' ? '💳' : '🎯'}</span>
                                <span className="text-gray-600">{formatDate(event.date)}</span>
                                {event.time && <span className="text-gray-400">{event.time}</span>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-400 text-center py-2">No upcoming events</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* To Do List - mobile */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <button
                    onClick={() => setMobileTodosOpen(!mobileTodosOpen)}
                    className="w-full px-3 py-1.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">📝</span>
                      <span className="font-medium text-xs text-gray-900">To Do</span>
                      {todos.filter(t => !t.completed).length > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{todos.filter(t => !t.completed).length}</span>
                      )}
                    </div>
                    <span className={`text-gray-400 text-[10px] transition-transform ${mobileTodosOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {mobileTodosOpen && (
                    <div className="px-4 pb-3">
                      <div className="flex gap-1.5 mb-2">
                        <input
                          type="text"
                          placeholder="Add a task..."
                          value={newTodoText}
                          onChange={e => setNewTodoText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
                          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                        />
                        <button
                          onClick={addTodo}
                          disabled={!newTodoText.trim()}
                          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-amber-600 transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {todos.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">No tasks yet</p>
                        ) : (
                          <>
                            {todos.filter(t => !t.completed).map(todo => (
                              <div key={todo.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 group">
                                <button onClick={() => toggleTodo(todo.id)} className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0 hover:border-amber-500 transition-colors" />
                                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{todo.text}</span>
                                <button onClick={() => removeTodo(todo.id)} className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            ))}
                            {todos.filter(t => t.completed).map(todo => (
                              <div key={todo.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 group">
                                <button onClick={() => toggleTodo(todo.id)} className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-400 flex-shrink-0 flex items-center justify-center">
                                  <span className="text-white text-[10px]">✓</span>
                                </button>
                                <span className="text-sm text-gray-400 line-through flex-1 min-w-0 truncate">{todo.text}</span>
                                <button onClick={() => removeTodo(todo.id)} className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            ))}
                            {todos.some(t => t.completed) && (
                              <button onClick={clearCompletedTodos} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
                                Clear completed
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Kids & Adults - single row */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="flex">
                    {/* Kids toggle */}
                    <button
                      onClick={() => { setMobileKidsOpen(!mobileKidsOpen); setMobileAdultsOpen(false); }}
                      className={`flex-1 px-3 py-1.5 flex items-center justify-center gap-1.5 border-r border-gray-100 ${mobileKidsOpen ? 'bg-blue-50' : ''}`}
                    >
                      <span className="text-xs">👶</span>
                      <span className="font-medium text-xs text-gray-700">Kids</span>
                      <div className="flex gap-0.5">
                        {kids.map(kid => (
                          <span key={kid.id} className="text-xs" title={`${kid.name}, age ${getKidAge(kid)}`}>{kid.avatar}</span>
                        ))}
                      </div>
                      {kids.length === 0 && <span className="text-[10px] text-gray-400">none</span>}
                      <span className={`text-gray-400 text-[10px] transition-transform ${mobileKidsOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {/* Adults toggle */}
                    <button
                      onClick={() => { setMobileAdultsOpen(!mobileAdultsOpen); setMobileKidsOpen(false); }}
                      className={`flex-1 px-3 py-1.5 flex items-center justify-center gap-1.5 ${mobileAdultsOpen ? 'bg-purple-50' : ''}`}
                    >
                      <span className="text-xs">👤</span>
                      <span className="font-medium text-xs text-gray-700">Adults</span>
                      <div className="flex gap-0.5">
                        {adults.map(adult => (
                          <span key={adult.id} className="text-xs" title={adult.name}>{adult.avatar}</span>
                        ))}
                      </div>
                      {adults.length === 0 && <span className="text-[10px] text-gray-400">none</span>}
                      <span className={`text-gray-400 text-[10px] transition-transform ${mobileAdultsOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                  </div>
                  {/* Kids expanded content */}
                  {mobileKidsOpen && (
                    <div className="px-4 pb-3 pt-2 space-y-2 border-t border-gray-100">
                      {kids.map(kid => (
                        <div key={kid.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                          {editingKid === kid.id ? (
                            <div className="flex-1 space-y-2">
                              <input type="text" value={editKidForm.name} onChange={e => setEditKidForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" placeholder="Name" autoFocus />
                              <DateInput label="Birthday" value={editKidForm.birthday} onChange={v => setEditKidForm(prev => ({ ...prev, birthday: v }))} size="sm" pastMonths={216} futureMonths={1} fixedPosition />
                              <div className="flex flex-wrap gap-1">
                                {KID_AVATARS.map(a => (
                                  <button key={a} type="button" onClick={() => setEditKidForm(prev => ({ ...prev, avatar: a }))} className={`w-7 h-7 rounded-full flex items-center justify-center text-base transition-all ${editKidForm.avatar === a ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}>{a}</button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => saveKidEdit(kid.id)} className="flex-1 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium">Save</button>
                                <button onClick={() => setEditingKid(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-lg shadow-sm">{kid.avatar}</div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{kid.name}</p>
                                  <p className="text-xs text-gray-500">Age {getKidAge(kid)}</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => startEditingKid(kid)} className="text-gray-400 hover:text-blue-500 text-xs p-1">Edit</button>
                                <button onClick={() => removeKid(kid.id)} className="text-gray-400 hover:text-red-500 text-xs p-1">✕</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {showAddKid ? (
                        <div className="p-2 bg-gray-50 rounded-lg space-y-2">
                          <input type="text" placeholder="Child's name" value={newKidName} onChange={e => setNewKidName(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" autoFocus />
                          <DateInput label="Birthday" value={newKidBirthday} onChange={v => setNewKidBirthday(v)} size="sm" pastMonths={216} futureMonths={1} fixedPosition />
                          <div className="flex flex-wrap gap-1">
                            {KID_AVATARS.map(a => (
                              <button key={a} type="button" onClick={() => setNewKidAvatar(a)} className={`w-7 h-7 rounded-full flex items-center justify-center text-base transition-all ${(newKidAvatar || KID_AVATARS[kids.length % KID_AVATARS.length]) === a ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}>{a}</button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={addKid} className="flex-1 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium">Add</button>
                            <button onClick={() => { setShowAddKid(false); setNewKidAvatar(''); }} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowAddKid(true)} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 text-xs">+ Add Child</button>
                      )}
                    </div>
                  )}
                  {/* Adults expanded content */}
                  {mobileAdultsOpen && (
                    <div className="px-4 pb-3 pt-2 space-y-2 border-t border-gray-100">
                      {adults.map(adult => (
                        <div key={adult.id} className="p-2 bg-purple-50 rounded-lg">
                          {editingAdult === adult.id ? (
                            <div className="space-y-2">
                              <input type="text" value={editAdultForm.name} onChange={e => setEditAdultForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" placeholder="Name" autoFocus />
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Relationship</label>
                                <div className="flex flex-wrap gap-1">
                                  {['Parent', 'Guardian', 'Grandparent', 'Nanny', 'Friend', 'Other'].map(rel => (
                                    <button key={rel} type="button" onClick={() => setEditAdultForm(prev => ({ ...prev, relationship: rel }))} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${editAdultForm.relationship === rel ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{rel}</button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {ADULT_AVATARS.map(a => (
                                  <button key={a} type="button" onClick={() => setEditAdultForm(prev => ({ ...prev, avatar: a }))} className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${editAdultForm.avatar === a ? 'bg-purple-100 ring-2 ring-purple-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}>{a}</button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => saveAdultEdit(adult.id)} className="flex-1 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium">Save</button>
                                <button onClick={() => setEditingAdult(null)} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-lg shadow-sm">{adult.avatar}</div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{adult.name}</p>
                                  <p className="text-xs text-gray-500">{adult.relationship}</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => startEditingAdult(adult)} className="text-gray-400 hover:text-purple-500 text-xs p-1">Edit</button>
                                <button onClick={() => removeAdult(adult.id)} className="text-gray-400 hover:text-red-500 text-xs p-1">✕</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {showAddAdult ? (
                        <div className="p-2 bg-gray-50 rounded-lg space-y-2">
                          <input type="text" placeholder="Name" value={newAdultName} onChange={e => setNewAdultName(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" autoFocus />
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Relationship</label>
                            <div className="flex flex-wrap gap-1">
                              {['Parent', 'Guardian', 'Grandparent', 'Nanny', 'Friend', 'Other'].map(rel => (
                                <button key={rel} type="button" onClick={() => setNewAdultRelationship(rel)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${newAdultRelationship === rel ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{rel}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {ADULT_AVATARS.map(a => (
                              <button key={a} type="button" onClick={() => setNewAdultAvatar(a)} className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${(newAdultAvatar || ADULT_AVATARS[adults.length % ADULT_AVATARS.length]) === a ? 'bg-purple-100 ring-2 ring-purple-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}>{a}</button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={addAdult} className="flex-1 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium">Add</button>
                            <button onClick={() => { setShowAddAdult(false); setNewAdultAvatar(''); }} className="flex-1 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowAddAdult(true)} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 text-xs">+ Add Adult</button>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Desktop: full sidebar cards */}
              <div className="hidden lg:block">
              {/* Upcoming Events - First */}
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span>🔔</span> Upcoming
                </h2>
                {/* Filter tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-3">
                  {([
                    { key: 'dates' as const, label: 'Dates' },
                    { key: 'activities' as const, label: 'Activities' },
                    { key: 'all' as const, label: 'All' },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setUpcomingFilter(tab.key)}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                        upcomingFilter === tab.key
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.map(event => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border ${
                          event.type === 'registration'
                            ? 'bg-red-50 border-red-200'
                            : event.type === 're-enrollment'
                              ? 'bg-blue-50 border-blue-200'
                              : event.type === 'subscription'
                                ? 'bg-purple-50 border-purple-200'
                                : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={
                            event.type === 'registration'
                              ? 'text-red-500'
                              : event.type === 're-enrollment'
                                ? 'text-blue-500'
                                : event.type === 'subscription'
                                  ? 'text-purple-500'
                                  : 'text-green-500'
                          }>
                            {event.type === 'registration' ? '📋' : event.type === 're-enrollment' ? '🔄' : event.type === 'subscription' ? '💳' : '🎯'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">
                              {event.type === 'registration'
                                ? 'Registration Opens'
                                : event.type === 're-enrollment'
                                  ? 'Re-enrollment Deadline'
                                  : event.type === 'subscription'
                                    ? 'Subscription Renewal'
                                    : 'Scheduled Activity'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{event.programName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs font-medium text-gray-700">{formatDate(event.date)}</p>
                              {event.time && (
                                <p className="text-xs text-gray-500">{event.time}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {upcomingFilter === 'dates' ? 'No upcoming dates' : upcomingFilter === 'activities' ? 'No upcoming activities' : 'No upcoming events'}
                    </p>
                  )}
                </div>
              </div>

              {/* To Do List */}
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6 overflow-hidden">
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span>📝</span> To Do
                  {todos.filter(t => !t.completed).length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{todos.filter(t => !t.completed).length}</span>
                  )}
                </h2>
                <div className="flex gap-2 mb-3 min-w-0">
                  <input
                    type="text"
                    placeholder="Add a task..."
                    value={newTodoText}
                    onChange={e => setNewTodoText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                  />
                  <button
                    onClick={addTodo}
                    disabled={!newTodoText.trim()}
                    className="flex-shrink-0 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-amber-600 transition-colors"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-1">
                  {todos.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-3">No tasks yet</p>
                  ) : (
                    <>
                      {todos.filter(t => !t.completed).map(todo => (
                        <div key={todo.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group">
                          <button onClick={() => toggleTodo(todo.id)} className="w-[18px] h-[18px] rounded border-2 border-gray-300 flex-shrink-0 hover:border-amber-500 transition-colors" />
                          <span className="text-sm text-gray-700 flex-1 min-w-0">{todo.text}</span>
                          <button onClick={() => removeTodo(todo.id)} className="text-gray-300 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                      {todos.filter(t => t.completed).map(todo => (
                        <div key={todo.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group">
                          <button onClick={() => toggleTodo(todo.id)} className="w-[18px] h-[18px] rounded border-2 border-amber-400 bg-amber-400 flex-shrink-0 flex items-center justify-center">
                            <span className="text-white text-[10px]">✓</span>
                          </button>
                          <span className="text-sm text-gray-400 line-through flex-1 min-w-0">{todo.text}</span>
                          <button onClick={() => removeTodo(todo.id)} className="text-gray-300 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                      {todos.some(t => t.completed) && (
                        <button onClick={clearCompletedTodos} className="text-xs text-gray-400 hover:text-gray-600 mt-2">
                          Clear completed
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Kids Section */}
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <span>👶</span> Kids
                  </h2>
                  {kids.length > 0 && (
                    <button
                      onClick={() => setEditingKid(editingKid ? null : 'toggle')}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {editingKid ? 'Done' : 'Edit'}
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {kids.length === 0 && !showAddKid && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      Add your kids to assign programs
                    </p>
                  )}
                  {kids.map(kid => (
                    <div
                      key={kid.id}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                    >
                      {editingKid === kid.id ? (
                        // Edit mode for this kid
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={editKidForm.name}
                            onChange={e => setEditKidForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Name"
                            autoFocus
                          />
                          <DateInput label="Birthday" value={editKidForm.birthday} onChange={v => setEditKidForm(prev => ({ ...prev, birthday: v }))} size="sm" pastMonths={216} futureMonths={1} fixedPosition />
                          <div>
                            <label className="text-sm text-gray-600 block mb-1">Avatar:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {KID_AVATARS.map(a => (
                                <button
                                  key={a}
                                  type="button"
                                  onClick={() => setEditKidForm(prev => ({ ...prev, avatar: a }))}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${editKidForm.avatar === a ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {a}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm text-gray-600 block mb-1">Color:</label>
                            <div className="flex flex-wrap gap-1">
                              {kidColors.map(c => (
                                <button
                                  key={c.name}
                                  type="button"
                                  onClick={() => setEditKidForm(prev => ({ ...prev, color: c.name }))}
                                  className={`w-6 h-6 rounded-full ${c.bg} ${editKidForm.color === c.name ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                  title={c.name}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveKidEdit(kid.id)}
                              className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingKid(null)}
                              className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
                              {kid.avatar}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{kid.name}</p>
                              <p className="text-sm text-gray-500">
                                Age {getKidAge(kid)} • {programs.filter(p => (p.status === 'registered' || p.status === 'enrolled') && (p.assignedKids.includes(kid.id) || p.assignedKids.includes('all'))).length} activities
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditingKid(kid)}
                              className="text-gray-400 hover:text-blue-500 text-sm p-1"
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeKid(kid.id)}
                              className="text-gray-400 hover:text-red-500 text-sm p-1"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {showAddKid ? (
                    <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                      <input
                        type="text"
                        placeholder="Child's name"
                        value={newKidName}
                        onChange={e => setNewKidName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        autoFocus
                      />
                      <DateInput label="Birthday" value={newKidBirthday} onChange={v => setNewKidBirthday(v)} size="sm" pastMonths={216} futureMonths={1} fixedPosition />
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Avatar:</label>
                        <div className="flex flex-wrap gap-1.5">
                          {KID_AVATARS.map(a => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => setNewKidAvatar(a)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${(newKidAvatar || KID_AVATARS[kids.length % KID_AVATARS.length]) === a ? 'bg-blue-100 ring-2 ring-blue-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={addKid}
                          className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setShowAddKid(false); setNewKidAvatar(''); }}
                          className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddKid(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 text-sm transition-colors"
                    >
                      + Add Child
                    </button>
                  )}
                </div>
              </div>

              {/* Responsible Adults Section */}
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <span>👤</span> Responsible Adults
                  </h2>
                </div>
                <div className="space-y-3">
                  {adults.length === 0 && !showAddAdult && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      Add adults who manage activities
                    </p>
                  )}
                  {adults.map(adult => (
                    <div
                      key={adult.id}
                      className="p-3 bg-purple-50 rounded-lg"
                    >
                      {editingAdult === adult.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editAdultForm.name}
                            onChange={e => setEditAdultForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Name"
                            autoFocus
                          />
                          <div>
                            <label className="text-sm text-gray-600 block mb-1">Relationship:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {['Parent', 'Guardian', 'Grandparent', 'Nanny', 'Friend', 'Other'].map(rel => (
                                <button key={rel} type="button" onClick={() => setEditAdultForm(prev => ({ ...prev, relationship: rel }))} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${editAdultForm.relationship === rel ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{rel}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm text-gray-600 block mb-1">Avatar:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {ADULT_AVATARS.map(a => (
                                <button
                                  key={a}
                                  type="button"
                                  onClick={() => setEditAdultForm(prev => ({ ...prev, avatar: a }))}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all ${editAdultForm.avatar === a ? 'bg-purple-100 ring-2 ring-purple-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {a}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="tel"
                            placeholder="Phone (optional)"
                            value={editAdultForm.phone}
                            onChange={e => setEditAdultForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveAdultEdit(adult.id)}
                              className="flex-1 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingAdult(null)}
                              className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
                              {adult.avatar}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{adult.name}</p>
                              <p className="text-sm text-gray-500">
                                {adult.relationship}
                                {adult.phone && ` • ${adult.phone}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditingAdult(adult)}
                              className="text-gray-400 hover:text-purple-500 text-sm p-1"
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeAdult(adult.id)}
                              className="text-gray-400 hover:text-red-500 text-sm p-1"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {showAddAdult ? (
                    <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                      <input
                        type="text"
                        placeholder="Name"
                        value={newAdultName}
                        onChange={e => setNewAdultName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        autoFocus
                      />
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Relationship:</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Parent', 'Guardian', 'Grandparent', 'Nanny', 'Friend', 'Other'].map(rel => (
                            <button key={rel} type="button" onClick={() => setNewAdultRelationship(rel)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${newAdultRelationship === rel ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{rel}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 block mb-1">Avatar:</label>
                        <div className="flex flex-wrap gap-1.5">
                          {ADULT_AVATARS.map(a => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => setNewAdultAvatar(a)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all ${(newAdultAvatar || ADULT_AVATARS[adults.length % ADULT_AVATARS.length]) === a ? 'bg-purple-100 ring-2 ring-purple-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="tel"
                        placeholder="Phone (optional)"
                        value={newAdultPhone}
                        onChange={e => setNewAdultPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addAdult}
                          className="flex-1 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setShowAddAdult(false); setNewAdultAvatar(''); }}
                          className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddAdult(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 text-sm transition-colors"
                    >
                      + Add Adult
                    </button>
                  )}
                </div>
              </div>

              {/* Settings Link */}
              <Link
                href="/familyplanning/settings"
                className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl shadow-sm text-gray-700 hover:bg-gray-50 transition-colors mb-4"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">Reminder Settings</span>
                {Object.keys(reminders).length > 0 && (
                  <span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    {Object.keys(reminders).length} active
                  </span>
                )}
              </Link>

              {/* Upgrade to Pro */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">✨</span>
                  <h2 className="font-bold">Upgrade to Pro</h2>
                </div>
                <ul className="text-sm space-y-2 mb-4 text-indigo-100">
                  <li className="flex items-center gap-2">
                    <span>✓</span> Unlimited saved programs
                  </li>
                  <li className="flex items-center gap-2">
                    <span>✓</span> Email reminders
                  </li>
                  <li className="flex items-center gap-2">
                    <span>✓</span> Export to calendar
                  </li>
                </ul>
                <Link
                  href="/familyplanning/billing"
                  className="block w-full py-2.5 bg-white text-indigo-600 rounded-lg font-semibold text-center hover:bg-indigo-50 transition-colors"
                >
                  Upgrade Now
                </Link>
              </div>

              </div>{/* end hidden lg:block */}
            </div>{/* end sidebar */}

            {/* Main Content */}
            <div className="lg:col-span-3 order-2 lg:order-2 space-y-4 sm:space-y-6">
              {/* Considering Programs */}
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setMobileConsideringExpanded(!mobileConsideringExpanded)}
                    className="lg:pointer-events-none flex items-center gap-1.5 sm:gap-2"
                  >
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                      <span>🤔</span> Considering
                      <span className="text-xs sm:text-sm font-normal text-gray-500">({consideringPrograms.length})</span>
                      {(() => {
                        const duplicateCount = consideringPrograms.filter(p => isDuplicateProgram(p.id)).length;
                        return duplicateCount > 0 ? (
                          <span className="text-xs font-normal text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''}
                          </span>
                        ) : null;
                      })()}
                    </h2>
                    <span className={`lg:hidden text-gray-400 text-xs transition-transform ${mobileConsideringExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <GridSizeControl
                      columns={consideringGrid.columns}
                      onIncrement={consideringGrid.increment}
                      onDecrement={consideringGrid.decrement}
                      canIncrement={consideringGrid.canIncrement}
                      canDecrement={consideringGrid.canDecrement}
                    />
                    <button onClick={() => openQuickSearch('program')} className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium">
                      + Programs
                    </button>
                    <button onClick={() => openQuickSearch('camp')} className="text-xs sm:text-sm text-green-600 hover:text-green-700 font-medium">
                      + Camps
                    </button>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 hidden sm:block">
                  💡 Tip: Use the Duplicate button to save the same program with different schedules or priorities — perfect for comparing Mon vs Wed classes!
                </p>

                <div className={`${mobileConsideringExpanded ? '' : 'hidden'} lg:!block`}>
                {consideringPrograms.length > 0 ? (
                  <SortableCardList
                    items={consideringPrograms}
                    onReorder={(ids) => hookReorderPrograms(ids, 'considering')}
                    className="grid gap-2 sm:gap-4"
                    style={consideringGrid.gridStyle}
                  >
                    {consideringPrograms.map(program => (
                      <SortableCard key={program.id} id={program.id}>
                      <div
                        className={`p-2.5 sm:p-4 rounded-xl border transition-colors ${getCardColors(program.program_type).bg} ${getCardColors(program.program_type).border} ${getCardColors(program.program_type).borderHover}`}
                      >
                        {editingProgram === program.id ? (
                          // Edit mode
                          <div className="space-y-3">
                            <h3 className="font-semibold text-gray-900">{program.name}</h3>

                            {/* Assign to Kids */}
                            {kids.length > 0 && (
                              <div>
                                <label className="text-xs text-gray-500 block mb-1.5">Assign to</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {kids.map(kid => {
                                    const isSelected = editForm.assignedKids.includes('all') || editForm.assignedKids.includes(kid.id);
                                    return (
                                      <button
                                        key={kid.id}
                                        onClick={() => toggleEditKid(kid.id)}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                                          isSelected
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        <span className="text-sm">{kid.avatar}</span>
                                        <span>{kid.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <DateInput
                              label="Registration Date"
                              value={editForm.new_registration_date}
                              onChange={v => setEditForm(prev => ({ ...prev, new_registration_date: v }))}
                              size="sm"
                              fixedPosition
                            />

                            <div>
                              <label className="text-xs text-gray-600 block mb-1">Registration URL</label>
                              <input
                                type="url"
                                value={editForm.registration_url}
                                onChange={e => setEditForm(prev => ({ ...prev, registration_url: e.target.value }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="https://..."
                              />
                            </div>

                            <div>
                              <label className="text-xs text-gray-600 block mb-1">Cost per Session ($)</label>
                              <input
                                type="number"
                                value={editForm.costPerSession || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, costPerSession: e.target.value ? Number(e.target.value) : null }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="e.g. 45"
                              />
                            </div>

                            {/* Schedule: camps get date range, programs get day-of-week picker */}
                            {program.program_type === 'camp' ? (
                              <DateRangePicker
                                startValue={editForm.sessionStartDate}
                                endValue={editForm.sessionEndDate}
                                onStartChange={v => setEditForm(prev => ({ ...prev, sessionStartDate: v }))}
                                onEndChange={v => setEditForm(prev => ({ ...prev, sessionEndDate: v }))}
                                startLabel="Camp Start"
                                endLabel="Camp End"
                                startPlaceholder="Start date"
                                endPlaceholder="End date"
                                fixedPosition
                              />
                            ) : (
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Schedule Days</label>
                                <div className="flex flex-wrap gap-1">
                                  {DAYS_OF_WEEK.map(({ key, label }) => (
                                    <button
                                      key={key}
                                      onClick={() => toggleScheduleDay(key)}
                                      className={`px-2 py-1 text-xs rounded ${
                                        editForm.scheduleDays.some(d => normalizeDayKey(d) === key)
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                                {/* Time inputs for selected days */}
                                {editForm.scheduleTimes.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {editForm.scheduleTimes.map(st => {
                                      const dayInfo = DAYS_OF_WEEK.find(d => d.key === normalizeDayKey(st.day));
                                      return (
                                        <div key={st.day} className="flex items-center gap-2 text-xs">
                                          <span className="w-10 text-gray-600">{dayInfo?.label || st.day}</span>
                                          <input
                                            type="time"
                                            value={st.time || '09:00'}
                                            onChange={e => updateScheduleTime(st.day, 'time', e.target.value)}
                                            className="px-1 py-0.5 border border-gray-300 rounded text-xs"
                                          />
                                          <span className="text-gray-400">to</span>
                                          <input
                                            type="time"
                                            value={st.endTime || '10:00'}
                                            onChange={e => updateScheduleTime(st.day, 'endTime', e.target.value)}
                                            className="px-1 py-0.5 border border-gray-300 rounded text-xs"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Only show priority if there are duplicates */}
                            {getRelatedProgramCount(programs, program.id) > 1 && (
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Priority</label>
                                <div className="flex gap-1">
                                  {Array.from({ length: getRelatedProgramCount(programs, program.id) }, (_, i) => i + 1).map(p => (
                                    <button
                                      key={p}
                                      onClick={() => setEditForm(prev => ({ ...prev, priority: prev.priority === p ? null : p }))}
                                      className={`w-8 h-8 text-xs rounded ${
                                        editForm.priority === p
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      #{p}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => saveEdit(program.id)}
                                className="flex-1 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingProgram(null)}
                                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="hidden sm:inline text-lg sm:text-2xl flex-shrink-0">
                                  {program.program_type === 'camp' ? '⛺' : CATEGORY_ICONS[program.category[0]] || '📌'}
                                </span>
                                {program.priority && getRelatedProgramCount(programs, program.id) > 1 && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                    #{program.priority}
                                  </span>
                                )}
                                <h3 className="font-semibold text-gray-900 truncate">
                                  {program.name}
                                </h3>
                              </div>
                              <button
                                onClick={() => removeProgram(program.id)}
                                className="text-gray-400 hover:text-red-500 text-sm flex-shrink-0"
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Discrepancy notification */}
                            {programDiscrepancies[getBaseId(program.id)] && (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-2 text-xs">
                                <div className="flex items-start gap-2">
                                  <span className="text-orange-500">⚠️</span>
                                  <div className="flex-1">
                                    <p className="font-medium text-orange-800">Program dates differ from listing</p>
                                    <div className="text-orange-700 mt-1 space-y-0.5">
                                      {programDiscrepancies[getBaseId(program.id)].db_new_registration_date !== program.new_registration_date &&
                                        (programDiscrepancies[getBaseId(program.id)].db_new_registration_date || program.new_registration_date) && (
                                          <p>Registration: {program.new_registration_date ? formatDate(program.new_registration_date) : <span className="italic text-gray-400">none</span>} → {programDiscrepancies[getBaseId(program.id)].db_new_registration_date ? formatDate(programDiscrepancies[getBaseId(program.id)].db_new_registration_date!) : <span className="italic text-gray-400">removed</span>}</p>
                                        )}
                                      {programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date !== program.re_enrollment_date &&
                                        (programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date || program.re_enrollment_date) && (
                                          <p>Re-enrollment: {program.re_enrollment_date ? formatDate(program.re_enrollment_date) : <span className="italic text-gray-400">none</span>} → {programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date ? formatDate(programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date!) : <span className="italic text-gray-400">removed</span>}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      <button
                                        onClick={() => syncWithDatabaseDates(program.id)}
                                        className="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600"
                                      >
                                        Update to listing
                                      </button>
                                      <button
                                        onClick={() => dismissDiscrepancy(program.id)}
                                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                                      >
                                        Keep mine
                                      </button>
                                      <button
                                        onClick={() => snoozeDiscrepancy(program.id)}
                                        className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs hover:bg-gray-200"
                                      >
                                        Remind later
                                      </button>
                                      <button
                                        onClick={() => permanentlyDismissDiscrepancy(program.id)}
                                        className="px-2 py-1 text-gray-400 rounded text-xs hover:text-gray-600 hover:bg-gray-100"
                                      >
                                        Don&apos;t remind
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}


                            {/* Assigned Kids */}
                            {program.assignedKids && program.assignedKids.length > 0 && (
                              <div className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2 inline-block">
                                🎒 {program.assignedKids.includes('all')
                                  ? (kids.length === 1 ? kids[0].name : 'All kids')
                                  : program.assignedKids.map(kidId => kids.find(k => k.id === kidId)?.name).filter(Boolean).join(', ') || 'Assigned'}
                              </div>
                            )}

                            {/* Registration Date */}
                            {program.new_registration_date && (
                              <div className="relative inline-block mr-2 mb-2">
                                <div className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-1 inline-flex items-center gap-1">
                                  📅 Registration: {formatDate(program.new_registration_date)}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleReminder(program.id, 'registration'); }}
                                    className={`ml-1 transition-colors ${reminders[program.id]?.registration ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                                    title={reminders[program.id]?.registration ? 'Reminder on' : 'Set reminder'}
                                  >
                                    💡
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (subscription?.plan !== 'pro') { router.push('/familyplanning/billing'); return; }
                                      const ics = generateRegistrationEvent({ ...program, re_enrollment_date: null });
                                      if (ics) { const slug = program.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30); downloadICS(`registration-${slug}`, ics); }
                                    }}
                                    className={`ml-0.5 transition-colors ${subscription?.plan !== 'pro' ? 'text-gray-300 hover:text-gray-400' : 'text-blue-400 hover:text-blue-600'}`}
                                    title={subscription?.plan !== 'pro' ? 'Upgrade to Pro to export' : 'Add to calendar'}
                                  >
                                    🗓️
                                  </button>
                                </div>
                                {reminderTooltip === `${program.id}-registration` && (
                                  <div className="absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                                    {reminders[program.id]?.registration ? 'Reminder set!' : 'Reminder removed'}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Re-enrollment Date */}
                            {program.re_enrollment_date && (
                              <div className="relative inline-block mb-2">
                                <div className="text-xs text-purple-700 bg-purple-100 rounded px-2 py-1 inline-flex items-center gap-1">
                                  🔄 Re-enroll: {formatDate(program.re_enrollment_date)}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleReminder(program.id, 're_enrollment'); }}
                                    className={`ml-1 transition-colors ${reminders[program.id]?.re_enrollment ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                                    title={reminders[program.id]?.re_enrollment ? 'Reminder on' : 'Set reminder'}
                                  >
                                    💡
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (subscription?.plan !== 'pro') { router.push('/familyplanning/billing'); return; }
                                      const ics = generateRegistrationEvent({ ...program, new_registration_date: null });
                                      if (ics) { const slug = program.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30); downloadICS(`re-enrollment-${slug}`, ics); }
                                    }}
                                    className={`ml-0.5 transition-colors ${subscription?.plan !== 'pro' ? 'text-gray-300 hover:text-gray-400' : 'text-purple-400 hover:text-purple-600'}`}
                                    title={subscription?.plan !== 'pro' ? 'Upgrade to Pro to export' : 'Add to calendar'}
                                  >
                                    🗓️
                                  </button>
                                </div>
                                {reminderTooltip === `${program.id}-re_enrollment` && (
                                  <div className="absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                                    {reminders[program.id]?.re_enrollment ? 'Reminder set!' : 'Reminder removed'}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Camp date range */}
                            {program.program_type === 'camp' && (program.sessionStartDate || program.sessionEndDate) && (
                              <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mb-2 inline-block">
                                🏕️ {program.sessionStartDate ? formatDate(program.sessionStartDate) : '?'} – {program.sessionEndDate ? formatDate(program.sessionEndDate) : '?'}
                              </div>
                            )}

                            {/* Schedule with times (programs only) */}
                            {program.program_type !== 'camp' && program.scheduleTimes && program.scheduleTimes.length > 0 && (
                              <div className="text-xs text-gray-600 mb-2">
                                🗓️ {program.scheduleTimes.map(st => {
                                  const dayLabel = st.day.charAt(0).toUpperCase() + st.day.slice(1, 3);
                                  const startFormatted = st.time ? new Date(`2000-01-01T${st.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
                                  const endFormatted = st.endTime ? new Date(`2000-01-01T${st.endTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
                                  const timeRange = endFormatted ? `${startFormatted}-${endFormatted}` : startFormatted;
                                  return `${dayLabel} ${timeRange}`;
                                }).join(', ')}
                              </div>
                            )}

                            {/* Hours (camps only) */}
                            {program.program_type === 'camp' && (program.enrollHoursStart || program.enrollHoursEnd) && (
                              <div className="text-xs text-gray-600 mb-2">
                                🕐 {program.enrollHoursStart && new Date(`2000-01-01T${program.enrollHoursStart}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {program.enrollHoursStart && program.enrollHoursEnd && ' – '}
                                {program.enrollHoursEnd && new Date(`2000-01-01T${program.enrollHoursEnd}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                            )}

                            {/* Price Range — hidden when user has added their own cost, or when prices are 0/null */}
                            {!program.costPerSession && (program.price_min != null && program.price_min > 0 || program.price_max != null && program.price_max > 0) && (
                              <div className="text-xs text-gray-600 mb-2">
                                💵 {(program.price_min != null && program.price_min > 0) && (program.price_max != null && program.price_max > 0)
                                  ? `$${program.price_min} - $${program.price_max}`
                                  : (program.price_min != null && program.price_min > 0)
                                    ? `$${program.price_min}`
                                    : `$${program.price_max}`
                                }
                                {program.price_unit && ` / ${program.price_unit}`}
                              </div>
                            )}

                            {/* Cost & Monthly Estimate */}
                            {program.costPerSession && (
                              <div className="bg-gray-50 rounded px-2 py-1.5 mb-2">
                                <p className="text-sm font-medium text-gray-700">
                                  💰 ${program.costPerSession}/session
                                </p>
                                {program.scheduleTimes && program.scheduleTimes.length > 0 && (
                                  <p className="text-xs text-gray-500">
                                    Est. ${(program.costPerSession * program.scheduleTimes.length * 4).toFixed(0)}-${(program.costPerSession * program.scheduleTimes.length * 5).toFixed(0)}/month
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Website Links */}
                            <div className="flex flex-wrap gap-2 mb-3 text-xs">
                              {program.registration_url && (
                                <a
                                  href={program.registration_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700 underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Register →
                                </a>
                              )}
                              {program.registration_url && program.provider_website && (
                                <span className="text-gray-300">|</span>
                              )}
                              {program.provider_website && (
                                <a
                                  href={program.provider_website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-500 hover:text-gray-700 underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Website
                                </a>
                              )}
                              {(program.registration_url || program.provider_website) && (
                                <span className="text-gray-300">|</span>
                              )}
                              <Link
                                href={`/programs/${getBaseId(program.id)}`}
                                className="text-blue-500 hover:text-blue-700 underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Details
                              </Link>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => startEditing(program)}
                                className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => duplicateProgram(program)}
                                className="flex-1 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                              >
                                Duplicate
                              </button>
                              <button
                                onClick={() => openEnrollmentModal(program)}
                                className="flex-1 py-1.5 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                              >
                                Enrolled ✓
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      </SortableCard>
                    ))}
                  </SortableCardList>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No programs being considered yet</p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => openQuickSearch('program')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                      >
                        + Add Program
                      </button>
                      <button
                        onClick={() => openQuickSearch('camp')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                      >
                        + Add Camp
                      </button>
                    </div>
                  </div>
                )}
                </div>{/* end mobileConsideringExpanded wrapper */}
              </div>

              {/* Enrolled Programs */}
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <button
                    onClick={() => setMobileRegisteredExpanded(!mobileRegisteredExpanded)}
                    className="lg:pointer-events-none flex items-center gap-1.5 sm:gap-2"
                  >
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                      <span>✅</span> Enrolled
                      <span className="text-xs sm:text-sm font-normal text-gray-500">({registeredPrograms.length})</span>
                    </h2>
                    <span className={`lg:hidden text-gray-400 text-xs transition-transform ${mobileRegisteredExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <GridSizeControl
                      columns={enrolledGrid.columns}
                      onIncrement={enrolledGrid.increment}
                      onDecrement={enrolledGrid.decrement}
                      canIncrement={enrolledGrid.canIncrement}
                      canDecrement={enrolledGrid.canDecrement}
                    />
                  {/* Monthly Cost Estimate */}
                  {registeredPrograms.length > 0 && (() => {
                    const estimate = registeredPrograms.reduce((acc, program) => {
                      if (program.costPerSession && program.scheduleTimes && program.scheduleTimes.length > 0) {
                        // Estimate 4-5 weeks per month
                        const sessionsPerWeek = program.scheduleTimes.length;
                        acc.min += program.costPerSession * sessionsPerWeek * 4;
                        acc.max += program.costPerSession * sessionsPerWeek * 5;
                        acc.hasData = true;
                      }
                      return acc;
                    }, { min: 0, max: 0, hasData: false });

                    return estimate.hasData ? (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Est. Monthly Cost</p>
                        <p className="text-lg font-bold text-blue-600">
                          ${estimate.min.toFixed(0)} - ${estimate.max.toFixed(0)}
                        </p>
                      </div>
                    ) : null;
                  })()}
                  </div>
                </div>

                <div className={`${mobileRegisteredExpanded ? '' : 'hidden'} lg:!block`}>
                {registeredPrograms.length > 0 ? (
                  <SortableCardList
                    items={registeredPrograms}
                    onReorder={(ids) => hookReorderPrograms(ids, 'registered')}
                    className="grid gap-2 sm:gap-3"
                    style={enrolledGrid.gridStyle}
                  >
                    {registeredPrograms.map(program => (
                      <SortableCard key={program.id} id={program.id}>
                      <div
                        className={`p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 ${getCardColors(program.program_type).bg} ${getCardColors(program.program_type).registeredBorder}`}
                      >
                        {/* Top row: name + icon left, actions right */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                            <span className="hidden sm:inline text-3xl mt-0.5">
                              {program.program_type === 'camp' ? '⛺' : CATEGORY_ICONS[program.category[0]] || '📌'}
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">{program.name}</h3>
                          </div>
                          {/* Action buttons: Edit, Considering, ✕ */}
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <button
                              onClick={() => startEditing(program)}
                              className="px-1.5 py-0.5 sm:px-3 sm:py-1 text-gray-600 hover:text-gray-800 text-[10px] sm:text-xs font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => moveToConsidering(program.id)}
                              className="px-1.5 py-0.5 sm:px-3 sm:py-1 text-gray-500 hover:text-gray-700 text-[10px] sm:text-xs"
                            >
                              Considering
                            </button>
                            <button
                              onClick={() => removeProgram(program.id)}
                              className="p-0.5 sm:p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Remove"
                            >
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Discrepancy notification */}
                        {programDiscrepancies[getBaseId(program.id)] && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-1.5 sm:p-2 mt-1 sm:mt-2 text-xs">
                            <div className="flex items-start gap-1.5">
                              <span className="text-orange-500">⚠️</span>
                              <div className="flex-1">
                                <p className="font-medium text-orange-800 text-[11px] sm:text-xs">Dates differ from listing</p>
                                <div className="text-orange-700 mt-0.5 text-[11px] sm:text-xs space-y-0.5">
                                  {programDiscrepancies[getBaseId(program.id)].db_new_registration_date !== program.new_registration_date &&
                                    (programDiscrepancies[getBaseId(program.id)].db_new_registration_date || program.new_registration_date) && (
                                      <p>Reg: {program.new_registration_date ? formatDate(program.new_registration_date) : <span className="italic text-gray-400">none</span>} → {programDiscrepancies[getBaseId(program.id)].db_new_registration_date ? formatDate(programDiscrepancies[getBaseId(program.id)].db_new_registration_date!) : <span className="italic text-gray-400">removed</span>}</p>
                                    )}
                                  {programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date !== program.re_enrollment_date &&
                                    (programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date || program.re_enrollment_date) && (
                                      <p>Re-enroll: {program.re_enrollment_date ? formatDate(program.re_enrollment_date) : <span className="italic text-gray-400">none</span>} → {programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date ? formatDate(programDiscrepancies[getBaseId(program.id)].db_re_enrollment_date!) : <span className="italic text-gray-400">removed</span>}</p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <button
                                    onClick={() => syncWithDatabaseDates(program.id)}
                                    className="px-1.5 py-0.5 bg-orange-500 text-white rounded text-[10px] sm:text-xs hover:bg-orange-600"
                                  >
                                    Update to listing
                                  </button>
                                  <button
                                    onClick={() => dismissDiscrepancy(program.id)}
                                    className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] sm:text-xs hover:bg-gray-300"
                                  >
                                    Keep mine
                                  </button>
                                  <button
                                    onClick={() => snoozeDiscrepancy(program.id)}
                                    className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] sm:text-xs hover:bg-gray-200"
                                  >
                                    Later
                                  </button>
                                  <button
                                    onClick={() => permanentlyDismissDiscrepancy(program.id)}
                                    className="px-1.5 py-0.5 text-gray-400 rounded text-[10px] sm:text-xs hover:text-gray-600 hover:bg-gray-100"
                                  >
                                    Don&apos;t remind
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Dates — bigger font */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          {program.program_type === 'camp' && (program.sessionStartDate || program.sessionEndDate) && (
                            <p className="text-sm sm:text-base font-medium text-green-700">
                              🏕️ {program.sessionStartDate ? formatDate(program.sessionStartDate) : '?'} – {program.sessionEndDate ? formatDate(program.sessionEndDate) : '?'}
                            </p>
                          )}
                          {program.program_type === 'camp' && (program.enrollHoursStart || program.enrollHoursEnd) && (
                            <p className="text-sm sm:text-base font-medium text-gray-600">
                              🕐 {program.enrollHoursStart && new Date(`2000-01-01T${program.enrollHoursStart}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              {program.enrollHoursStart && program.enrollHoursEnd && ' – '}
                              {program.enrollHoursEnd && new Date(`2000-01-01T${program.enrollHoursEnd}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          )}
                          {program.program_type !== 'camp' && program.scheduleTimes && program.scheduleTimes.length > 0 && (
                            <p className="text-sm sm:text-base font-medium text-blue-700">
                              🗓️ {program.scheduleTimes.map(st => {
                                const dayLabel = st.day.charAt(0).toUpperCase() + st.day.slice(1, 3);
                                const startFormatted = st.time ? new Date(`2000-01-01T${st.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
                                const endFormatted = st.endTime ? new Date(`2000-01-01T${st.endTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
                                const timeRange = endFormatted ? `${startFormatted}-${endFormatted}` : startFormatted;
                                return `${dayLabel} ${timeRange}`;
                              }).join(', ')}
                            </p>
                          )}
                          {program.re_enrollment_date && (
                            <div className="relative inline-block">
                              <p className="text-sm sm:text-base font-medium text-blue-700 inline-flex items-center gap-0.5">
                                🔄 {formatDate(program.re_enrollment_date)}
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleReminder(program.id, 're_enrollment'); }}
                                  className={`ml-0.5 transition-colors ${reminders[program.id]?.re_enrollment ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                                  title={reminders[program.id]?.re_enrollment ? 'Reminder on' : 'Set reminder'}
                                >
                                  💡
                                </button>
                              </p>
                              {reminderTooltip === `${program.id}-re_enrollment` && (
                                <div className="absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                                  {reminders[program.id]?.re_enrollment ? 'Reminder set!' : 'Reminder removed'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Assigned persons — under dates */}
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {/* Assigned kids */}
                          {(() => {
                            const assignedKids = program.assignedKids.includes('all')
                              ? kids
                              : kids.filter(k => program.assignedKids.includes(k.id));
                            return assignedKids.map(kid => {
                              const c = getKidColor(kid.color);
                              return (
                                <span key={kid.id} className={`flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2 sm:py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${c.bg} text-white`}>
                                  <span className="text-xs sm:text-sm">{kid.avatar}</span>
                                  {kid.name}
                                </span>
                              );
                            });
                          })()}

                          {/* Drop off adult */}
                          {program.dropoffAdult && (() => {
                            const adult = adults.find(a => a.id === program.dropoffAdult);
                            if (!adult) return null;
                            const c = getAdultColor(adult.id);
                            return (
                              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2 sm:py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${c.pill}`}>
                                <span className="text-[10px] sm:text-xs text-white/70">Drop off</span> {adult.avatar} {adult.name}
                              </span>
                            );
                          })()}

                          {/* Pickup adult */}
                          {program.pickupAdult && (() => {
                            const adult = adults.find(a => a.id === program.pickupAdult);
                            if (!adult) return null;
                            const c = getAdultColor(adult.id);
                            return (
                              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2 sm:py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${c.pill}`}>
                                <span className="text-[10px] sm:text-xs text-white/70">Pickup</span> {adult.avatar} {adult.name}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Calendar export button */}
                        {program.sessionStartDate && program.sessionEndDate && (
                          <div className="mt-1.5 sm:mt-2">
                            <button
                              onClick={() => {
                                if (subscription?.plan !== 'pro') {
                                  router.push('/familyplanning/billing');
                                  return;
                                }
                                const ics = generateRecurringEvents(program);
                                if (ics) {
                                  const slug = program.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
                                  downloadICS(`schedule-${slug}`, ics);
                                }
                              }}
                              title={subscription?.plan !== 'pro' ? 'Upgrade to Pro to export to calendar' : 'Export recurring schedule to calendar'}
                              className={`inline-flex items-center gap-1 px-2 py-1 border rounded-lg text-xs font-medium transition-colors ${
                                subscription?.plan !== 'pro'
                                  ? 'border-gray-200 text-gray-400 hover:bg-gray-50'
                                  : 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100'
                              }`}
                            >
                              📅 Add to Calendar
                            </button>
                          </div>
                        )}

                        {/* Inline edit for current programs */}
                        {editingProgram === program.id && (
                          <div className={`mt-4 pt-4 border-t grid sm:grid-cols-3 gap-4 ${getCardColors(program.program_type).border}`}>
                            <DateInput
                              label="Registration Date"
                              value={editForm.new_registration_date}
                              onChange={v => setEditForm(prev => ({ ...prev, new_registration_date: v }))}
                              size="sm"
                              fixedPosition
                            />
                            <DateInput
                              label="Re-enrollment Date"
                              value={editForm.re_enrollment_date}
                              onChange={v => setEditForm(prev => ({ ...prev, re_enrollment_date: v }))}
                              size="sm"
                              fixedPosition
                            />
                            <div>
                              <label className="text-xs text-gray-600 block mb-1">Registration URL</label>
                              <input
                                type="url"
                                value={editForm.registration_url}
                                onChange={e => setEditForm(prev => ({ ...prev, registration_url: e.target.value }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="https://..."
                              />
                            </div>
                            {/* Schedule: camps get date range, programs get day-of-week picker */}
                            {program.program_type === 'camp' ? (
                              <DateRangePicker
                                startValue={editForm.sessionStartDate}
                                endValue={editForm.sessionEndDate}
                                onStartChange={v => setEditForm(prev => ({ ...prev, sessionStartDate: v }))}
                                onEndChange={v => setEditForm(prev => ({ ...prev, sessionEndDate: v }))}
                                startLabel="Camp Start"
                                endLabel="Camp End"
                                startPlaceholder="Start date"
                                endPlaceholder="End date"
                                fixedPosition
                              />
                            ) : (
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">Schedule Days</label>
                                <div className="flex flex-wrap gap-1">
                                  {DAYS_OF_WEEK.map(({ key, label }) => (
                                    <button
                                      key={key}
                                      onClick={() => toggleScheduleDay(key)}
                                      className={`px-2 py-1 text-xs rounded ${
                                        editForm.scheduleDays.some(d => normalizeDayKey(d) === key)
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                                {/* Time inputs for selected days */}
                                {editForm.scheduleTimes.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {editForm.scheduleTimes.map(st => {
                                      const dayInfo = DAYS_OF_WEEK.find(d => d.key === normalizeDayKey(st.day));
                                      return (
                                        <div key={st.day} className="flex items-center gap-2 text-xs">
                                          <span className="w-10 text-gray-600">{dayInfo?.label || st.day}</span>
                                          <input
                                            type="time"
                                            value={st.time || '09:00'}
                                            onChange={e => updateScheduleTime(st.day, 'time', e.target.value)}
                                            className="px-1 py-0.5 border border-gray-300 rounded text-xs"
                                          />
                                          <span className="text-gray-400">to</span>
                                          <input
                                            type="time"
                                            value={st.endTime || '10:00'}
                                            onChange={e => updateScheduleTime(st.day, 'endTime', e.target.value)}
                                            className="px-1 py-0.5 border border-gray-300 rounded text-xs"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="sm:col-span-3 flex gap-2">
                              <button
                                onClick={() => saveEdit(program.id)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                              >
                                Save Changes
                              </button>
                              <button
                                onClick={() => setEditingProgram(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      </SortableCard>
                    ))}
                  </SortableCardList>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No enrolled programs yet</p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                      Click &quot;Enrolled&quot; on programs you&apos;re considering when you&apos;ve signed up
                    </p>
                  </div>
                )}
                </div>{/* end mobileRegisteredExpanded wrapper */}
              </div>
            </div>
          </div>
        ) : (
          /* Calendar View */
          <div>
            {/* Filters outside calendar box */}
            <div className="mb-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                {/* Status Filter */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setCalendarStatusFilter(prev => {
                      if (prev.includes('considering')) {
                        return prev.length > 1 ? prev.filter(s => s !== 'considering') : prev;
                      }
                      return [...prev, 'considering'];
                    })}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                      calendarStatusFilter.includes('considering')
                        ? 'bg-yellow-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    🤔 Considering
                  </button>
                  <button
                    onClick={() => setCalendarStatusFilter(prev => {
                      if (prev.includes('registered')) {
                        return prev.length > 1 ? prev.filter(s => s !== 'registered') : prev;
                      }
                      return [...prev, 'registered'];
                    })}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                      calendarStatusFilter.includes('registered')
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    ✅ Enrolled
                  </button>
                </div>

                {/* Kid Filter — multi-select toggles */}
                {kids.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {kids.map(kid => {
                      const isSelected = calendarKidFilter.length === 0 || calendarKidFilter.includes(kid.id);
                      const c = getKidColor(kid.color);
                      return (
                        <button
                          key={kid.id}
                          onClick={() => setCalendarKidFilter(prev => {
                            if (prev.length === 0) {
                              // All selected → deselect this kid (select all others)
                              const others = kids.filter(k => k.id !== kid.id).map(k => k.id);
                              return others.length > 0 ? others : prev;
                            }
                            if (prev.includes(kid.id)) {
                              // Already selected → deselect (but keep at least one or go back to all)
                              const remaining = prev.filter(id => id !== kid.id);
                              return remaining.length > 0 ? remaining : [];
                            }
                            // Not selected → add
                            const updated = [...prev, kid.id];
                            // If all kids now selected, go back to empty (= all)
                            return updated.length >= kids.length ? [] : updated;
                          })}
                          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                            isSelected
                              ? `${c.bg} text-white shadow-sm`
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-xs">{kid.avatar}</span>
                          <span>{kid.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* View Mode Toggle — right side */}
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  <button
                    onClick={() => setCalendarViewMode('month')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                      calendarViewMode === 'month'
                        ? 'bg-gray-800 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setCalendarViewMode('week')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                      calendarViewMode === 'week'
                        ? 'bg-gray-800 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setCalendarViewMode('day')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                      calendarViewMode === 'day'
                        ? 'bg-gray-800 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Day
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar white box */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            {/* Header with nav, month/year, and legend */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateCalendar('prev')}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                  title="Previous"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-xl font-bold text-gray-900 min-w-[200px] text-center">
                  {calendarViewMode === 'day'
                    ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })
                    : calendarViewMode === 'week'
                      ? `Week of ${getWeekDates(selectedDate)[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
                  }
                </h2>
                <button
                  onClick={() => navigateCalendar('next')}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                  title="Next"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    setSelectedDate(today);
                    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  }}
                  className="ml-2 px-3 py-1 text-xs font-medium rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                >
                  Today
                </button>
              </div>
              {/* Legend */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500 inline-block"></span> Registration</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500 inline-block"></span> Re-enrollment</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500 inline-block"></span> Activity</span>
              </div>
            </div>

            {/* Month View */}
            {calendarViewMode === 'month' && (
              <div
                className="cursor-ns-resize"
                onWheel={handleCalendarScroll}
              >
                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                  {/* Header */}
                  {weekDays.map(day => (
                    <div key={day} className="bg-gray-50 py-3 text-center text-sm font-semibold text-gray-700">
                      {day}
                    </div>
                  ))}

                  {/* Days */}
                  {getDaysInMonth(currentMonth).map((day, index) => {
                    const events = day ? getEventsForDate(day) : [];
                    const isToday = day &&
                      new Date().getDate() === day &&
                      new Date().getMonth() === currentMonth.getMonth() &&
                      new Date().getFullYear() === currentMonth.getFullYear();

                    return (
                      <div
                        key={index}
                        onClick={() => day && zoomToDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                        className={`bg-white min-h-[100px] p-2 ${day ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'}`}
                      >
                        {day && (
                          <>
                            <div className={`text-sm mb-1 ${isToday ? 'w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold' : 'text-gray-700'}`}>
                              {day}
                            </div>
                            <div className="space-y-1">
                              {events.slice(0, 3).map(event => {
                                const kidAvatars = getEventKidAvatars(event);
                                return (
                                  <div
                                    key={event.id}
                                    className={`text-xs p-1 rounded flex items-center gap-1 group relative ${
                                      event.type === 'registration'
                                        ? 'bg-red-100 text-red-700'
                                        : event.type === 're-enrollment'
                                          ? 'bg-blue-100 text-blue-700'
                                          : event.type === 'subscription'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-green-100 text-green-700'
                                    }`}
                                    onMouseEnter={() => setHoveredEvent(event.id)}
                                    onMouseLeave={() => setHoveredEvent(null)}
                                  >
                                    {/* Kid avatars */}
                                    {kidAvatars.length > 0 && (
                                      <span className="flex-shrink-0">{kidAvatars[0].avatar}</span>
                                    )}
                                    <span className="truncate flex-1">{event.programName}</span>

                                    {/* Hover tooltip */}
                                    {hoveredEvent === event.id && (
                                      <div className="absolute left-0 bottom-full mb-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20 shadow-lg">
                                        <div className="font-medium">{event.programName}</div>
                                        {event.time && <div>🕐 {formatTime(event.time)}</div>}
                                        {kidAvatars.length > 0 && (
                                          <div>{kidAvatars.map(k => k.avatar).join(' ')} {kidAvatars.map(k => k.name).join(', ')}</div>
                                        )}
                                        <div className="text-gray-300">
                                          {event.type === 'registration' ? '📋 Registration Opens' : event.type === 're-enrollment' ? '🔄 Re-enrollment' : event.type === 'subscription' ? '💳 Subscription' : '🎯 Activity'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {events.length > 3 && (
                                <div className="text-xs text-gray-500 pl-1">+{events.length - 3} more</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Week View */}
            {calendarViewMode === 'week' && (
              <div
                className="cursor-ns-resize"
                onWheel={handleCalendarScroll}
              >
                <div className="grid grid-cols-8 gap-px bg-gray-200 rounded-lg overflow-hidden">
                  {/* Time column header */}
                  <div className="bg-gray-50 py-2 text-center text-xs font-semibold text-gray-500">Time</div>
                  {/* Day headers */}
                  {getWeekDates(selectedDate).map(date => {
                    const isToday = formatDateStr(date) === formatDateStr(new Date());
                    return (
                      <div
                        key={date.toISOString()}
                        onClick={() => {
                          setSelectedDate(date);
                          setCalendarViewMode('day');
                        }}
                        className={`py-2 text-center text-sm font-semibold cursor-pointer hover:bg-gray-100 ${isToday ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'}`}
                      >
                        <div>{weekDays[date.getDay()]}</div>
                        <div className={`text-lg ${isToday ? 'text-blue-600' : ''}`}>{date.getDate()}</div>
                      </div>
                    );
                  })}

                  {/* Time slots */}
                  {timeSlots.map(hour => (
                    <>
                      <div key={`time-${hour}`} className="bg-white py-4 px-2 text-xs text-gray-500 text-right border-t border-gray-100">
                        {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                      </div>
                      {getWeekDates(selectedDate).map(date => {
                        const dateStr = formatDateStr(date);
                        const dayEvents = getEventsForDateStr(dateStr).filter(e => {
                          if (!e.time) return hour === 9; // Default non-timed events to 9 AM
                          const eventHour = parseInt(e.time.split(':')[0]);
                          return eventHour === hour;
                        });
                        const isToday = dateStr === formatDateStr(new Date());

                        return (
                          <div
                            key={`${dateStr}-${hour}`}
                            className={`bg-white py-1 px-1 min-h-[60px] border-t border-gray-100 ${isToday ? 'bg-blue-50/30' : ''}`}
                          >
                            {dayEvents.map(event => {
                              const kidAvatars = getEventKidAvatars(event);
                              return (
                                <div
                                  key={event.id}
                                  className={`text-xs p-1.5 rounded mb-1 group relative ${
                                    event.type === 'registration'
                                      ? 'bg-red-100 text-red-700 border-l-2 border-red-500'
                                      : event.type === 're-enrollment'
                                        ? 'bg-blue-100 text-blue-700 border-l-2 border-blue-500'
                                        : event.type === 'subscription'
                                          ? 'bg-purple-100 text-purple-700 border-l-2 border-purple-500'
                                          : 'bg-green-100 text-green-700 border-l-2 border-green-500'
                                  }`}
                                  onMouseEnter={() => setHoveredEvent(event.id)}
                                  onMouseLeave={() => setHoveredEvent(null)}
                                >
                                  <div className="flex items-center gap-1">
                                    {kidAvatars.length > 0 && <span>{kidAvatars[0].avatar}</span>}
                                    <span className="font-medium truncate">{event.programName}</span>
                                  </div>
                                  {event.time && <div className="text-[10px] opacity-75">{formatTime(event.time)}</div>}

                                  {/* Hover tooltip */}
                                  {hoveredEvent === event.id && (
                                    <div className="absolute left-full ml-2 top-0 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20 shadow-lg">
                                      <div className="font-medium">{event.programName}</div>
                                      {event.time && <div>🕐 {formatTime(event.time)}</div>}
                                      {kidAvatars.length > 0 && (
                                        <div>{kidAvatars.map(k => k.avatar).join(' ')} {kidAvatars.map(k => k.name).join(', ')}</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            )}

            {/* Day View */}
            {calendarViewMode === 'day' && (
              <div
                className="cursor-ns-resize"
                onWheel={handleCalendarScroll}
              >
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {timeSlots.map(hour => {
                    const dateStr = formatDateStr(selectedDate);
                    const hourEvents = getEventsForDateStr(dateStr).filter(e => {
                      if (!e.time) return hour === 9;
                      const eventHour = parseInt(e.time.split(':')[0]);
                      return eventHour === hour;
                    });

                    return (
                      <div key={hour} className="flex border-b border-gray-100 last:border-b-0">
                        <div className="w-20 py-4 px-3 text-sm text-gray-500 bg-gray-50 border-r border-gray-100 flex-shrink-0">
                          {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                        </div>
                        <div className="flex-1 py-2 px-3 min-h-[80px]">
                          {hourEvents.map(event => {
                            const kidAvatars = getEventKidAvatars(event);
                            return (
                              <div
                                key={event.id}
                                className={`p-3 rounded-lg mb-2 group relative ${
                                  event.type === 'registration'
                                    ? 'bg-red-50 border border-red-200'
                                    : event.type === 're-enrollment'
                                      ? 'bg-blue-50 border border-blue-200'
                                      : event.type === 'subscription'
                                        ? 'bg-purple-50 border border-purple-200'
                                        : 'bg-green-50 border border-green-200'
                                }`}
                                onMouseEnter={() => setHoveredEvent(event.id)}
                                onMouseLeave={() => setHoveredEvent(null)}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {/* Category icon */}
                                  <span className="text-xl">{CATEGORY_ICONS[event.category || ''] || '📌'}</span>
                                  <span className="font-medium text-gray-900">{event.programName}</span>
                                  {event.time && (
                                    <span className="text-sm text-gray-500 ml-auto">{formatTime(event.time)}</span>
                                  )}
                                </div>
                                {/* Kid avatars */}
                                {kidAvatars.length > 0 && (
                                  <div className="flex items-center gap-1 text-sm text-gray-600">
                                    {kidAvatars.map((k, i) => (
                                      <span key={i} title={k.name}>{k.avatar}</span>
                                    ))}
                                    <span className="ml-1">{kidAvatars.map(k => k.name).join(', ')}</span>
                                  </div>
                                )}
                                <div className={`text-xs mt-1 ${
                                  event.type === 'registration' ? 'text-red-600' :
                                  event.type === 're-enrollment' ? 'text-blue-600' :
                                  event.type === 'subscription' ? 'text-purple-600' : 'text-green-600'
                                }`}>
                                  {event.type === 'registration' ? '📋 Registration Opens' :
                                   event.type === 're-enrollment' ? '🔄 Re-enrollment Deadline' :
                                   event.type === 'subscription' ? '💳 Subscription Renewal' : '🎯 Scheduled Activity'}
                                </div>
                              </div>
                            );
                          })}
                          {hourEvents.length === 0 && (
                            <div className="h-full flex items-center justify-center text-gray-300 text-sm">
                              —
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            </div>
          </div>
        )}
      </main>

      {/* Enrollment Modal */}
      {enrollingProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Enrollment</h3>
            <p className="text-gray-600 mb-4">
              Mark <strong>{enrollingProgram.name}</strong> as enrolled?
            </p>

            {/* Validation Error */}
            {enrollValidationError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {enrollValidationError}
              </div>
            )}

            {/* Assign Kids & Adults side by side */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kids */}
              {kids.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Kids <span className="text-red-500">*</span></label>
                  <div className="flex flex-wrap gap-1.5">
                    {kids.map(kid => {
                      const isSelected = enrollForm.assignedKids.includes('all') || enrollForm.assignedKids.includes(kid.id);
                      return (
                        <button
                          key={kid.id}
                          onClick={() => {
                            setEnrollValidationError('');
                            setEnrollForm(prev => {
                              let current = prev.assignedKids.includes('all')
                                ? kids.map(k => k.id)
                                : [...prev.assignedKids];
                              if (current.includes(kid.id)) {
                                if (current.length <= 1) return prev;
                                current = current.filter(k => k !== kid.id);
                              } else {
                                current = [...current, kid.id];
                              }
                              if (kids.length > 0 && current.length >= kids.length) {
                                return { ...prev, assignedKids: ['all'] };
                              }
                              return { ...prev, assignedKids: current };
                            });
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span className="text-sm">{kid.avatar}</span>
                          <span>{kid.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Adults — pill toggle buttons like kids */}
              {adults.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Drop-off</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {adults.map(adult => (
                      <button
                        key={adult.id}
                        onClick={() => setEnrollForm(prev => ({
                          ...prev,
                          dropoffAdult: prev.dropoffAdult === adult.id ? '' : adult.id,
                        }))}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                          enrollForm.dropoffAdult === adult.id
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span className="text-sm">{adult.avatar}</span>
                        <span>{adult.name}</span>
                      </button>
                    ))}
                  </div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Pick-up</label>
                  <div className="flex flex-wrap gap-1.5">
                    {adults.map(adult => (
                      <button
                        key={adult.id}
                        onClick={() => setEnrollForm(prev => ({
                          ...prev,
                          pickupAdult: prev.pickupAdult === adult.id ? '' : adult.id,
                        }))}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                          enrollForm.pickupAdult === adult.id
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span className="text-sm">{adult.avatar}</span>
                        <span>{adult.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* For Programs: Schedule Days & Time */}
            {enrollingProgram.program_type !== 'camp' && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 block mb-2">Schedule Days <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const isSelected = enrollForm.scheduleDays.some(d => normalizeDayKey(d) === key);
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setEnrollValidationError('');
                          setEnrollForm(prev => {
                            const selected = prev.scheduleDays.some(d => normalizeDayKey(d) === key);
                            if (selected) {
                              return {
                                ...prev,
                                scheduleDays: prev.scheduleDays.filter(d => normalizeDayKey(d) !== key),
                                scheduleTimes: prev.scheduleTimes.filter(st => normalizeDayKey(st.day) !== key),
                              };
                            } else {
                              return {
                                ...prev,
                                scheduleDays: [...prev.scheduleDays, key],
                                scheduleTimes: [...prev.scheduleTimes, { day: key, time: '', endTime: '' }],
                              };
                            }
                          });
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {enrollForm.scheduleTimes.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {enrollForm.scheduleTimes.map(st => {
                      const dayInfo = DAYS_OF_WEEK.find(d => d.key === normalizeDayKey(st.day));
                      return (
                        <div key={st.day} className="flex items-center gap-2 text-xs">
                          <span className="w-10 text-gray-600 font-medium">{dayInfo?.label || st.day}</span>
                          <input
                            type="time"
                            value={st.time || ''}
                            onChange={e => setEnrollForm(prev => ({
                              ...prev,
                              scheduleTimes: prev.scheduleTimes.map(s =>
                                normalizeDayKey(s.day) === normalizeDayKey(st.day) ? { ...s, time: e.target.value } : s
                              ),
                            }))}
                            className="px-1.5 py-1 border border-gray-300 rounded text-xs"
                            placeholder="Start"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="time"
                            value={st.endTime || ''}
                            onChange={e => setEnrollForm(prev => ({
                              ...prev,
                              scheduleTimes: prev.scheduleTimes.map(s =>
                                normalizeDayKey(s.day) === normalizeDayKey(st.day) ? { ...s, endTime: e.target.value } : s
                              ),
                            }))}
                            className="px-1.5 py-1 border border-gray-300 rounded text-xs"
                            placeholder="End"
                          />
                        </div>
                      );
                    })}
                    <p className="text-xs text-gray-400">Time is optional</p>
                  </div>
                )}
              </div>
            )}

            {/* For Camps: Hours (drop-off / pick-up times) */}
            {enrollingProgram.program_type === 'camp' && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 block mb-2">Hours</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Drop-off</label>
                    <input
                      type="time"
                      value={enrollForm.hoursStart}
                      onChange={e => setEnrollForm(prev => ({ ...prev, hoursStart: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <span className="text-gray-400 pt-5">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Pick-up</label>
                    <input
                      type="time"
                      value={enrollForm.hoursEnd}
                      onChange={e => setEnrollForm(prev => ({ ...prev, hoursEnd: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Optional — your personal drop-off/pick-up times</p>
              </div>
            )}

            {/* Session Dates (optional) */}
            <div className="mb-4">
              <DateRangePicker
                startLabel="Session Start"
                endLabel="Session End"
                startPlaceholder="Start date"
                endPlaceholder="End date"
                startValue={enrollForm.sessionStartDate}
                endValue={enrollForm.sessionEndDate}
                onStartChange={v => setEnrollForm(prev => ({ ...prev, sessionStartDate: v }))}
                onEndChange={v => setEnrollForm(prev => ({ ...prev, sessionEndDate: v }))}
                fixedPosition
              />
              <p className="text-xs text-red-400 mt-1">* Required</p>
            </div>

            {/* Cost toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setEnrollForm(prev => ({ ...prev, showCost: !prev.showCost }))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  enrollForm.showCost
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {enrollForm.showCost ? '- Cost' : '+ Cost'}
              </button>
            </div>

            {/* Cost section (optional) */}
            {enrollForm.showCost && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="text-xs text-gray-600 block mb-1.5">Cost per Session ($)</label>
                <input
                  type="number"
                  value={enrollForm.costPerSession ?? ''}
                  onChange={e => setEnrollForm(prev => ({ ...prev, costPerSession: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. 45"
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={confirmEnrollment}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
              >
                Confirm Enrollment
              </button>
              <button
                onClick={() => { setEnrollingProgram(null); setEnrollValidationError(''); resetEnrollForm(); }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Upgrade Banner — desktop: fixed bottom bar */}
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">✨</span>
            <div>
              <p className="font-medium">Upgrade to Family Pro</p>
              <p className="text-sm text-blue-200">Unlimited saves, email reminders, calendar export</p>
            </div>
          </div>
          <Link
            href="/familyplanning/billing"
            className="px-6 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            Upgrade Now
          </Link>
        </div>
      </div>
    </div>
  );
}
