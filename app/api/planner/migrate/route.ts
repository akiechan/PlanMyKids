import { NextRequest, NextResponse } from 'next/server';
import { getPlannerAuth, getServiceClient } from '@/lib/planner-auth';
import type { PlannerMigrationPayload, LegacySavedProgram } from '@/types/planner';

// UUID v4 regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Duplicate format: {uuid}-{13-digit-timestamp}
const DUPLICATE_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d{13})$/i;

export async function POST(request: NextRequest) {
  const auth = await getPlannerAuth(request);
  if ('error' in auth) return auth.error;
  const { userId } = auth;

  const body: PlannerMigrationPayload = await request.json();
  const supabase = getServiceClient();

  // Idempotent: skip if user already has any DB data
  const { count } = await supabase
    .from('planner_saved_programs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ migrated: false, reason: 'already_migrated' });
  }

  // 1. Insert kids → build old→new ID map
  const kidIdMap: Record<string, string> = {};
  if (body.kids?.length) {
    for (let i = 0; i < body.kids.length; i++) {
      const kid = body.kids[i];
      const { data } = await supabase
        .from('planner_kids')
        .insert({
          user_id: userId,
          name: kid.name,
          birthday: kid.birthday || null,
          avatar: kid.avatar || '🐣',
          color: kid.color || 'blue',
          sort_order: i,
        })
        .select('id')
        .single();

      if (data) kidIdMap[kid.id] = data.id;
    }
  }

  // 2. Insert adults → build old→new ID map
  const adultIdMap: Record<string, string> = {};
  if (body.adults?.length) {
    for (let i = 0; i < body.adults.length; i++) {
      const adult = body.adults[i];
      const { data } = await supabase
        .from('planner_adults')
        .insert({
          user_id: userId,
          name: adult.name,
          email: adult.email || null,
          phone: adult.phone || null,
          relationship: adult.relationship || 'Parent',
          avatar: adult.avatar || '🦁',
          sort_order: i,
        })
        .select('id')
        .single();

      if (data) adultIdMap[adult.id] = data.id;
    }
  }

  // 3. Insert programs
  // First pass: insert non-duplicate programs and build saved_program ID map
  const savedProgramIdMap: Record<string, string> = {}; // old localStorage id → new DB id
  const duplicates: LegacySavedProgram[] = [];

  if (body.programs?.length) {
    for (const prog of body.programs) {
      const dupMatch = DUPLICATE_RE.exec(prog.id);
      if (dupMatch) {
        duplicates.push(prog);
        continue;
      }

      const insertData = buildProgramInsert(prog, userId, adultIdMap, null);
      const { data } = await supabase
        .from('planner_saved_programs')
        .insert(insertData)
        .select('id')
        .single();

      if (data) {
        savedProgramIdMap[prog.id] = data.id;
        // Insert kid assignments
        await insertKidAssignments(supabase, data.id, prog, kidIdMap);
      }
    }

    // Second pass: insert duplicates with source_saved_program_id
    for (const prog of duplicates) {
      const dupMatch = DUPLICATE_RE.exec(prog.id)!;
      const baseOldId = dupMatch[1];
      const sourceSavedProgramId = savedProgramIdMap[baseOldId] || null;

      const insertData = buildProgramInsert(prog, userId, adultIdMap, sourceSavedProgramId);
      const { data } = await supabase
        .from('planner_saved_programs')
        .insert(insertData)
        .select('id')
        .single();

      if (data) {
        savedProgramIdMap[prog.id] = data.id;
        await insertKidAssignments(supabase, data.id, prog, kidIdMap);
      }
    }
  }

  // 4. Insert todos
  let todosInserted = 0;
  if (body.todos?.length) {
    for (let i = 0; i < body.todos.length; i++) {
      const todo = body.todos[i];
      const { error } = await supabase.from('planner_todos').insert({
        user_id: userId,
        text: todo.text,
        completed: todo.completed ?? false,
        sort_order: i,
      });
      if (!error) todosInserted++;
    }
  }

  // 5. Insert reminders (remap saved_program_id)
  let remindersInserted = 0;
  if (body.reminders) {
    for (const [oldProgramId, settings] of Object.entries(body.reminders)) {
      const newSavedProgramId = savedProgramIdMap[oldProgramId];
      if (!newSavedProgramId) continue;

      if (settings.registration) {
        const { error } = await supabase.from('planner_reminders').insert({
          user_id: userId,
          saved_program_id: newSavedProgramId,
          reminder_type: 'registration',
          enabled: true,
        });
        if (!error) remindersInserted++;
      }
      if (settings.re_enrollment) {
        const { error } = await supabase.from('planner_reminders').insert({
          user_id: userId,
          saved_program_id: newSavedProgramId,
          reminder_type: 're_enrollment',
          enabled: true,
        });
        if (!error) remindersInserted++;
      }
    }
  }

  // 6. Insert discrepancy dismissals
  if (body.dismissedDiscrepancies?.length) {
    for (const programId of body.dismissedDiscrepancies) {
      if (UUID_RE.test(programId)) {
        await supabase.from('planner_discrepancy_dismissed').insert({
          user_id: userId,
          program_id: programId,
        });
      }
    }
  }

  // 7. Insert user preferences
  await supabase.from('planner_user_preferences').upsert({
    user_id: userId,
    welcome_dismissed: body.welcomeDismissed ?? false,
    reminder_lead_time_days: body.reminderSettings?.leadTimeDays ?? 7,
    reminder_email_enabled: body.reminderSettings?.emailEnabled ?? false,
  });

  return NextResponse.json({
    migrated: true,
    counts: {
      kids: Object.keys(kidIdMap).length,
      adults: Object.keys(adultIdMap).length,
      programs: Object.keys(savedProgramIdMap).length,
      todos: todosInserted,
      reminders: remindersInserted,
    },
  });
}

function buildProgramInsert(
  prog: LegacySavedProgram,
  userId: string,
  adultIdMap: Record<string, string>,
  sourceSavedProgramId: string | null,
) {
  const isCustom = prog.id.startsWith('custom-');
  const isValidUUID = UUID_RE.test(prog.id);

  // Determine program_id: null for custom, the UUID for real programs
  let programId: string | null = null;
  if (!isCustom && isValidUUID) {
    programId = prog.id;
  } else if (!isCustom) {
    // Duplicate or other format — try to extract UUID
    const dupMatch = DUPLICATE_RE.exec(prog.id);
    if (dupMatch) programId = dupMatch[1];
  }

  // Build custom_program_data for custom programs
  const customProgramData = isCustom
    ? {
        name: prog.name,
        provider_name: prog.provider_name,
        category: prog.category,
        program_type: prog.program_type,
        price_min: prog.price_min,
        price_max: prog.price_max,
        price_unit: prog.price_unit,
        provider_website: prog.provider_website,
        registration_url: prog.registration_url,
        re_enrollment_date: prog.re_enrollment_date,
        new_registration_date: prog.new_registration_date,
      }
    : null;

  // Determine if dates are overrides (differ from original values)
  const overrideReEnrollment =
    prog.re_enrollment_date &&
    prog.original_re_enrollment_date !== undefined &&
    prog.re_enrollment_date !== prog.original_re_enrollment_date
      ? prog.re_enrollment_date
      : null;

  const overrideNewRegistration =
    prog.new_registration_date &&
    prog.original_new_registration_date !== undefined &&
    prog.new_registration_date !== prog.original_new_registration_date
      ? prog.new_registration_date
      : null;

  const overrideRegistrationUrl =
    prog.registration_url &&
    prog.original_registration_url !== undefined &&
    prog.registration_url !== prog.original_registration_url
      ? prog.registration_url
      : null;

  const assignAllKids =
    prog.assignedKids?.length === 1 && prog.assignedKids[0] === 'all';

  return {
    user_id: userId,
    program_id: programId,
    source_saved_program_id: sourceSavedProgramId,
    status: normalizeStatus(prog.status),
    schedule_days: prog.scheduleDays || [],
    schedule_times: prog.scheduleTimes || [],
    session_start_date: prog.sessionStartDate || null,
    session_end_date: prog.sessionEndDate || null,
    enroll_hours_start: prog.enrollHoursStart || null,
    enroll_hours_end: prog.enrollHoursEnd || null,
    cost_per_session: prog.costPerSession ?? null,
    override_re_enrollment_date: overrideReEnrollment,
    override_new_registration_date: overrideNewRegistration,
    override_registration_url: overrideRegistrationUrl,
    assigned_adult_id: prog.assignedAdult ? (adultIdMap[prog.assignedAdult] || null) : null,
    dropoff_adult_id: prog.dropoffAdult ? (adultIdMap[prog.dropoffAdult] || null) : null,
    pickup_adult_id: prog.pickupAdult ? (adultIdMap[prog.pickupAdult] || null) : null,
    dropoff_time: prog.dropoffTime || null,
    pickup_time: prog.pickupTime || null,
    assign_all_kids: assignAllKids,
    priority: prog.priority ?? null,
    custom_program_data: customProgramData,
    has_pending_edit: prog.hasPendingEdit ?? false,
    saved_at: prog.savedAt || new Date().toISOString(),
  };
}

function normalizeStatus(status: string): 'considering' | 'registered' | 'enrolled' {
  if (status === 'registered' || status === 'enrolled') return status;
  return 'considering';
}

async function insertKidAssignments(
  supabase: ReturnType<typeof getServiceClient>,
  savedProgramId: string,
  prog: LegacySavedProgram,
  kidIdMap: Record<string, string>,
) {
  if (!prog.assignedKids?.length) return;
  // Skip 'all' — handled by assign_all_kids boolean
  const kidIds = prog.assignedKids
    .filter(k => k !== 'all')
    .map(k => kidIdMap[k])
    .filter(Boolean);

  if (kidIds.length > 0) {
    await supabase.from('planner_program_kids').insert(
      kidIds.map(kid_id => ({ saved_program_id: savedProgramId, kid_id }))
    );
  }
}
