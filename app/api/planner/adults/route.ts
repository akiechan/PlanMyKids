import { NextRequest, NextResponse } from 'next/server';
import { getPlannerAuth, getUserPlan, getServiceClient } from '@/lib/planner-auth';
import { FREE_PLAN_ADULT_LIMIT } from '@/lib/planner-limits';
import type { CreateAdultInput } from '@/types/planner';

export async function POST(request: NextRequest) {
  const auth = await getPlannerAuth(request);
  if ('error' in auth) return auth.error;
  const { userId, user } = auth;

  const body: CreateAdultInput = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Check plan limits
  const plan = await getUserPlan(user.email!);
  if (plan === 'free') {
    const { count } = await supabase
      .from('planner_adults')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((count ?? 0) >= FREE_PLAN_ADULT_LIMIT) {
      return NextResponse.json(
        { error: 'Free plan limit reached', limit: FREE_PLAN_ADULT_LIMIT },
        { status: 403 }
      );
    }
  }

  // Get next sort_order
  const { data: last } = await supabase
    .from('planner_adults')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('planner_adults')
    .insert({
      user_id: userId,
      name: body.name.trim(),
      email: body.email || null,
      phone: body.phone || null,
      relationship: body.relationship || 'Parent',
      avatar: body.avatar || '🦁',
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const auth = await getPlannerAuth(request);
  if ('error' in auth) return auth.error;
  const { userId } = auth;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from('planner_adults')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ON DELETE SET NULL on planner_saved_programs adult FKs handles cleanup
  const { error } = await supabase
    .from('planner_adults')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
