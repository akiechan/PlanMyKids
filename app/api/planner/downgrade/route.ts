import { NextRequest, NextResponse } from 'next/server';
import { getPlannerAuth, getUserPlan, getServiceClient } from '@/lib/planner-auth';
import {
  FREE_PLAN_KID_LIMIT,
  FREE_PLAN_ADULT_LIMIT,
  FREE_PLAN_PROGRAM_LIMIT,
} from '@/lib/planner-limits';

interface DowngradeBody {
  keepKidIds: string[];
  keepAdultIds: string[];
  keepProgramIds: string[];
}

export async function POST(request: NextRequest) {
  const auth = await getPlannerAuth(request);
  if ('error' in auth) return auth.error;
  const { userId, user } = auth;

  // Only allow for free plan users (who were previously pro)
  const plan = await getUserPlan(user.email!);
  if (plan !== 'free') {
    return NextResponse.json({ error: 'Not on free plan' }, { status: 400 });
  }

  const body: DowngradeBody = await request.json();

  // Validate keep lists are within free plan limits
  if (body.keepKidIds.length > FREE_PLAN_KID_LIMIT) {
    return NextResponse.json(
      { error: `Cannot keep more than ${FREE_PLAN_KID_LIMIT} kid(s)` },
      { status: 400 }
    );
  }
  if (body.keepAdultIds.length > FREE_PLAN_ADULT_LIMIT) {
    return NextResponse.json(
      { error: `Cannot keep more than ${FREE_PLAN_ADULT_LIMIT} adult(s)` },
      { status: 400 }
    );
  }
  if (body.keepProgramIds.length > FREE_PLAN_PROGRAM_LIMIT) {
    return NextResponse.json(
      { error: `Cannot keep more than ${FREE_PLAN_PROGRAM_LIMIT} program(s)` },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // Delete kids NOT in keep list
  if (body.keepKidIds.length > 0) {
    const { data: allKids } = await supabase
      .from('planner_kids')
      .select('id')
      .eq('user_id', userId);

    const deleteKidIds = (allKids || [])
      .map(k => k.id)
      .filter(id => !body.keepKidIds.includes(id));

    if (deleteKidIds.length > 0) {
      await supabase
        .from('planner_kids')
        .delete()
        .eq('user_id', userId)
        .in('id', deleteKidIds);
    }
  } else {
    // Keep none — delete all
    await supabase
      .from('planner_kids')
      .delete()
      .eq('user_id', userId);
  }

  // Delete adults NOT in keep list
  if (body.keepAdultIds.length > 0) {
    const { data: allAdults } = await supabase
      .from('planner_adults')
      .select('id')
      .eq('user_id', userId);

    const deleteAdultIds = (allAdults || [])
      .map(a => a.id)
      .filter(id => !body.keepAdultIds.includes(id));

    if (deleteAdultIds.length > 0) {
      await supabase
        .from('planner_adults')
        .delete()
        .eq('user_id', userId)
        .in('id', deleteAdultIds);
    }
  } else {
    await supabase
      .from('planner_adults')
      .delete()
      .eq('user_id', userId);
  }

  // Delete saved programs NOT in keep list
  if (body.keepProgramIds.length > 0) {
    const { data: allPrograms } = await supabase
      .from('planner_saved_programs')
      .select('id')
      .eq('user_id', userId);

    const deleteProgramIds = (allPrograms || [])
      .map(p => p.id)
      .filter(id => !body.keepProgramIds.includes(id));

    if (deleteProgramIds.length > 0) {
      // CASCADE handles planner_program_kids and planner_reminders
      await supabase
        .from('planner_saved_programs')
        .delete()
        .eq('user_id', userId)
        .in('id', deleteProgramIds);
    }
  } else {
    await supabase
      .from('planner_saved_programs')
      .delete()
      .eq('user_id', userId);
  }

  return NextResponse.json({ success: true });
}
