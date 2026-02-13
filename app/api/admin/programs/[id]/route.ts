import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearCampsCache } from '@/lib/api-cache';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: {
      fetch: (url: any, options: any = {}) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

// GET - Check if program can be deleted and get related data
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const programId = params.id;
    const supabase = getSupabaseClient();

    // Fetch program details
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, name, provider_name, is_featured, status')
      .eq('id', programId)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Check for active featured subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('featured_subscriptions')
      .select('id, status, contact_email, plan_type')
      .eq('program_id', programId)
      .in('status', ['active', 'trialing']);

    if (subError) {
      console.error('Error checking subscriptions:', subError);
    }

    // Check for reviews
    const { count: reviewCount, error: reviewError } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', programId);

    if (reviewError) {
      console.error('Error checking reviews:', reviewError);
    }

    // Check for edit requests
    const { count: editRequestCount, error: editError } = await supabase
      .from('program_edit_requests')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', programId)
      .eq('status', 'pending');

    if (editError) {
      console.error('Error checking edit requests:', editError);
    }

    const warnings: string[] = [];

    // Warning about local storage planner (we can't check this from server)
    warnings.push('Users may have saved this program to their Family Planner (stored locally in their browser). They will see a broken reference if deleted.');

    if (subscriptions && subscriptions.length > 0) {
      warnings.push(`This program has ${subscriptions.length} active featured subscription(s). Deleting will orphan these subscriptions.`);
    }

    if (reviewCount && reviewCount > 0) {
      warnings.push(`This program has ${reviewCount} review(s) that will be permanently deleted.`);
    }

    if (editRequestCount && editRequestCount > 0) {
      warnings.push(`This program has ${editRequestCount} pending edit request(s) that will be affected.`);
    }

    if (program.is_featured) {
      warnings.push('This is a FEATURED program with special visibility.');
    }

    return NextResponse.json({
      program,
      canDelete: true,
      warnings,
      relatedData: {
        activeSubscriptions: subscriptions?.length || 0,
        reviewCount: reviewCount || 0,
        pendingEditRequests: editRequestCount || 0,
      },
    });
  } catch (error) {
    console.error('Error checking program:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a program
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const programId = params.id;
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { programData, locationData } = body;

    // Update program
    const { error: programError } = await supabase
      .from('programs')
      .update(programData)
      .eq('id', programId);

    if (programError) {
      console.error('Error updating program:', programError);
      return NextResponse.json(
        { error: `Failed to update program: ${programError.message}` },
        { status: 500 }
      );
    }

    // Update or insert location if provided
    if (locationData) {
      const { data: existingLocation } = await supabase
        .from('program_locations')
        .select('id')
        .eq('program_id', programId)
        .eq('is_primary', true)
        .single();

      if (existingLocation) {
        const { error: locationError } = await supabase
          .from('program_locations')
          .update(locationData)
          .eq('id', existingLocation.id);

        if (locationError) {
          console.error('Error updating location:', locationError);
          return NextResponse.json(
            { error: `Failed to update location: ${locationError.message}` },
            { status: 500 }
          );
        }
      } else {
        const { error: locationError } = await supabase
          .from('program_locations')
          .insert({
            program_id: programId,
            ...locationData,
            is_primary: true,
          });

        if (locationError) {
          console.error('Error inserting location:', locationError);
          return NextResponse.json(
            { error: `Failed to insert location: ${locationError.message}` },
            { status: 500 }
          );
        }
      }
    }

    clearCampsCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating program:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a program and related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const programId = params.id;
    const supabase = getSupabaseClient();

    // First verify program exists
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, name')
      .eq('id', programId)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Delete program locations first (not cascaded)
    const { error: locError } = await supabase
      .from('program_locations')
      .delete()
      .eq('program_id', programId);

    if (locError) {
      console.error('Error deleting locations:', locError);
    }

    // Update featured subscriptions to orphan them (ON DELETE SET NULL)
    // This is handled by the database constraint

    // Delete edit requests referencing this program
    const { error: editError } = await supabase
      .from('program_edit_requests')
      .delete()
      .eq('program_id', programId);

    if (editError) {
      console.error('Error deleting edit requests:', editError);
    }

    // Delete the program (reviews will cascade)
    const { error: deleteError } = await supabase
      .from('programs')
      .delete()
      .eq('id', programId);

    if (deleteError) {
      console.error('Error deleting program:', deleteError);
      return NextResponse.json(
        { error: `Failed to delete program: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Log the deletion for admin activity
    try {
      await supabase.from('admin_activity_log').insert({
        action: 'delete_program',
        details: {
          program_id: programId,
          program_name: program.name,
        },
      });
    } catch (logError) {
      // Don't fail if logging fails
      console.error('Error logging deletion:', logError);
    }

    clearCampsCache();
    return NextResponse.json({
      success: true,
      message: `Program "${program.name}" has been deleted`,
    });
  } catch (error) {
    console.error('Error deleting program:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
