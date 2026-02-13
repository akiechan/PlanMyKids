import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { stripe, FEATURED_PRICE_IDS } from '@/lib/stripe';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// POST - Reactivate a canceled (cancel_at_period_end) subscription
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
      .select('id, user_id, status, stripe_subscription_id, stripe_customer_id, stripe_price_id, program_id, plan_type')
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
        { error: 'Not authorized to reactivate this subscription' },
        { status: 403 }
      );
    }

    if (!['canceled', 'active', 'trialing'].includes(subscription.status)) {
      return NextResponse.json(
        { error: 'Can only reactivate canceled or canceling subscriptions' },
        { status: 400 }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No Stripe subscription ID found. Please contact support.' },
        { status: 400 }
      );
    }

    // Check the Stripe subscription's actual state
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    if (stripeSub.status !== 'active' && stripeSub.status !== 'trialing') {
      // Subscription has fully expired — create a new Stripe Checkout session
      const origin = request.headers.get('origin') || 'http://localhost:3000';
      const priceId = subscription.stripe_price_id
        || (subscription.plan_type === 'monthly' ? FEATURED_PRICE_IDS.monthly : FEATURED_PRICE_IDS.weekly);

      if (!priceId) {
        return NextResponse.json(
          { error: 'Unable to determine price. Please create a new subscription.' },
          { status: 400 }
        );
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: subscription.stripe_customer_id || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/billing?reactivated=true`,
        cancel_url: `${origin}/billing`,
        metadata: {
          subscription_id: subscription.id,
          program_id: subscription.program_id || '',
          user_id: userId,
        },
      });

      // Update subscription status to pending while awaiting payment
      await serviceClient
        .from('featured_subscriptions')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);

      return NextResponse.json({
        success: true,
        redirectUrl: checkoutSession.url,
        message: 'Redirecting to Stripe for payment.',
      });
    }

    // Still active (cancel_at_period_end) — just remove the cancel flag
    await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: false }
    );

    await serviceClient
      .from('featured_subscriptions')
      .update({
        status: stripeSub.status === 'trialing' ? 'trialing' : 'active',
        canceled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully.',
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
