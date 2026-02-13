// TypeScript interfaces for all planner database entities

export interface PlannerKid {
  id: string;
  user_id: string;
  name: string;
  birthday: string | null;
  avatar: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlannerAdult {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string;
  avatar: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlannerSavedProgram {
  id: string;
  user_id: string;
  program_id: string | null;
  source_saved_program_id: string | null;
  status: 'considering' | 'registered' | 'enrolled';
  schedule_days: string[];
  schedule_times: { day: string; time: string; endTime?: string }[];
  session_start_date: string | null;
  session_end_date: string | null;
  enroll_hours_start: string | null;
  enroll_hours_end: string | null;
  cost_per_session: number | null;
  override_re_enrollment_date: string | null;
  override_new_registration_date: string | null;
  override_registration_url: string | null;
  assigned_adult_id: string | null;
  dropoff_adult_id: string | null;
  pickup_adult_id: string | null;
  dropoff_time: string | null;
  pickup_time: string | null;
  assign_all_kids: boolean;
  priority: number | null;
  custom_program_data: CustomProgramData | null;
  has_pending_edit: boolean;
  saved_at: string;
  created_at: string;
  updated_at: string;

  // Joined data (from select queries)
  program?: {
    name: string;
    provider_name: string | null;
    category: string[];
    program_type: string;
    price_min: number | null;
    price_max: number | null;
    price_unit: string | null;
    re_enrollment_date: string | null;
    new_registration_date: string | null;
    registration_url: string | null;
    provider_website: string | null;
  } | null;
  kids?: { kid_id: string }[];
}

export interface CustomProgramData {
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
}

export interface PlannerTodo {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlannerReminder {
  id: string;
  user_id: string;
  saved_program_id: string;
  reminder_type: 'registration' | 're_enrollment';
  enabled: boolean;
  created_at: string;
}

export interface PlannerUserPreferences {
  user_id: string;
  welcome_dismissed: boolean;
  reminder_lead_time_days: number;
  reminder_email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Input types for mutations (without server-generated fields)

export interface CreateKidInput {
  name: string;
  birthday?: string | null;
  avatar: string;
  color: string;
}

export interface CreateAdultInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  relationship: string;
  avatar: string;
}

export interface SaveProgramInput {
  program_id: string | null;
  custom_program_data?: CustomProgramData | null;
  status?: 'considering' | 'registered' | 'enrolled';
  assign_all_kids?: boolean;
  kid_ids?: string[];
  schedule_days?: string[];
  schedule_times?: { day: string; time: string; endTime?: string }[];
  cost_per_session?: number | null;
  override_new_registration_date?: string | null;
  priority?: number | null;
}

// Migration payload (sent from client localStorage to /api/planner/migrate)
export interface PlannerMigrationPayload {
  kids: LegacyKid[];
  adults: LegacyAdult[];
  programs: LegacySavedProgram[];
  todos: LegacyTodo[];
  reminders: Record<string, { registration?: boolean; re_enrollment?: boolean }>;
  dismissedDiscrepancies: string[];
  welcomeDismissed: boolean;
  reminderSettings?: { leadTimeDays?: number; emailEnabled?: boolean };
}

// Legacy localStorage shapes (for migration)
export interface LegacyKid {
  id: string;
  name: string;
  birthday?: string;
  age?: number;
  avatar: string;
  color: string;
}

export interface LegacyAdult {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  relationship: string;
  avatar: string;
}

export interface LegacySavedProgram {
  id: string;
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
  status: string;
  assignedKids: string[];
  assignedAdult?: string;
  dropoffAdult?: string;
  pickupAdult?: string;
  dropoffTime?: string;
  pickupTime?: string;
  scheduleDays?: string[];
  scheduleTimes?: { day: string; time: string; endTime?: string }[];
  enrollHoursStart?: string | null;
  enrollHoursEnd?: string | null;
  costPerSession?: number | null;
  priority?: number | null;
  savedAt?: string;
  sessionStartDate?: string | null;
  sessionEndDate?: string | null;
  original_re_enrollment_date?: string | null;
  original_new_registration_date?: string | null;
  original_registration_url?: string | null;
  hasPendingEdit?: boolean;
}

export interface LegacyTodo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}
