import { NextRequest, NextResponse } from 'next/server';
import { getPlannerAuth, getUserPlan, getServiceClient } from '@/lib/planner-auth';
import { FREE_PLAN_PROGRAM_LIMIT } from '@/lib/planner-limits';
import type { SaveProgramInput } from '@/types/planner';

export async function POST(request: NextRequest) {
  const auth = await getPlannerAuth(request);
  if ('error' in auth) return auth.error;
  const { userId, user } = auth;

  const body: SaveProgramInput = await request.json();

  if (!body.program_id && !body.custom_program_data) {
    return NextResponse.json({ error: 'program_id or custom_program_data required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Check plan limits
  const plan = await getUserPlan(user.email!);
  if (plan === 'free') {
    const { count } = await supabase
      .from('planner_saved_programs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((count ?? 0) >= FREE_PLAN_PROGRAM_LIMIT) {
      return NextResponse.json(
        { error: 'Free plan limit reached', limit: FREE_PLAN_PROGRAM_LIMIT },
        { status: 403 }
      );
    }
  }

  // Check for duplicates (same user + same program_id)
  if (body.program_id) {
    const { data: existing } = await supabase
      .from('planner_saved_programs')
      .select('id')
      .eq('user_id', userId)
      .eq('program_id', body.program_id)
      .is('source_saved_program_id', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Program already saved', existingId: existing.id }, { status: 409 });
    }
  }

  // Insert
  const { data, error } = await supabase
    .from('planner_saved_programs')
    .insert({
      user_id: userId,
      program_id: body.program_id || null,
      custom_program_data: body.custom_program_data || null,
      status: body.status || 'considering',
      assign_all_kids: body.assign_all_kids || false,
      schedule_days: body.schedule_days || [],
      schedule_times: body.schedule_times || [],
      cost_per_session: body.cost_per_session ?? null,
      override_new_registration_date: body.override_new_registration_date || null,
      priority: body.priority ?? null,
      sort_order: 0,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert kid assignments if provided
  if (body.kid_ids && body.kid_ids.length > 0 && data) {
    await supabase
      .from('planner_program_kids')
      .insert(body.kid_ids.map(kid_id => ({
        saved_program_id: data.id,
        kid_id,
      })));
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const auth = await getPlannerAuth(request);
  if ('error' in auth) return auth.error;
  const { userId } = auth;

  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Verify ownership before deleting
  const { data: existing } = await supabase
    .from('planner_saved_programs')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // CASCADE handles planner_program_kids and planner_reminders
  const { error } = await supabase
    .from('planner_saved_programs')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
