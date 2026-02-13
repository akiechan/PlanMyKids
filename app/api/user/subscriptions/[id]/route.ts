import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// DELETE - Cancel/delete a subscription
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subscriptionId = params.id;

    // Create server-side Supabase client to verify user
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const serviceClient = getServiceClient();

    // Verify the subscription belongs to this user
    const { data: subscription, error: fetchError } = await serviceClient
      .from('featured_subscriptions')
      .select('id, user_id, status, stripe_subscription_id')
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.user_id !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this subscription' },
        { status: 403 }
      );
    }

    // Only allow deleting pending or canceled subscriptions
    // Active subscriptions should be canceled through Stripe
    if (!['pending', 'canceled', 'expired'].includes(subscription.status)) {
      return NextResponse.json(
        { error: 'Can only delete pending, canceled, or expired subscriptions. Active subscriptions must be canceled through Stripe first.' },
        { status: 400 }
      );
    }

    // Delete the subscription
    const { error: deleteError } = await serviceClient
      .from('featured_subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (deleteError) {
      console.error('Error deleting subscription:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription deleted successfully',
    });
  } catch (error) {
    console.error('Error in subscription DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
