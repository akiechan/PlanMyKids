import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// POST - Cancel an active/trialing subscription via Stripe
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subscriptionId = params.id;

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

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const serviceClient = getServiceClient();

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
        { error: 'Not authorized to cancel this subscription' },
        { status: 403 }
      );
    }

    if (!['active', 'trialing'].includes(subscription.status)) {
      return NextResponse.json(
        { error: 'Can only cancel active or trialing subscriptions' },
        { status: 400 }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No Stripe subscription ID found. Please contact support.' },
        { status: 400 }
      );
    }

    // Cancel at period end so listing stays active and featured until paid period expires
    await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    // Keep status as-is (active/trialing) so the DB trigger doesn't remove is_featured.
    // The Stripe webhook (customer.subscription.deleted) will set status to 'canceled'
    // and unfeature the program when the period actually ends.
    await serviceClient
      .from('featured_subscriptions')
      .update({
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled. It will remain active until the end of the current billing period.',
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
