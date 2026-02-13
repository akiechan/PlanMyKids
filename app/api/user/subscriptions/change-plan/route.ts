import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { stripe, FEATURED_PRICE_IDS, PLANNER_PRICE_IDS } from '@/lib/stripe';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// POST - Change subscription plan (upgrade/switch)
export async function POST(request: NextRequest) {
  try {
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
    const body = await request.json();
    const { type } = body;

    if (type === 'featured_monthly') {
      // Upgrade featured business from weekly to monthly
      const { subscriptionId } = body;
      if (!subscriptionId) {
        return NextResponse.json(
          { error: 'Subscription ID is required' },
          { status: 400 }
        );
      }

      const serviceClient = getServiceClient();
      const { data: subscription, error: fetchError } = await serviceClient
        .from('featured_subscriptions')
        .select('id, user_id, status, stripe_subscription_id, stripe_customer_id, plan_type')
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
          { error: 'Not authorized to modify this subscription' },
          { status: 403 }
        );
      }

      if (subscription.plan_type !== 'weekly') {
        return NextResponse.json(
          { error: 'Only weekly plans can upgrade to monthly' },
          { status: 400 }
        );
      }

      if (!['active', 'trialing'].includes(subscription.status)) {
        return NextResponse.json(
          { error: 'Can only upgrade active subscriptions' },
          { status: 400 }
        );
      }

      if (!subscription.stripe_subscription_id) {
        return NextResponse.json(
          { error: 'No Stripe subscription found. Please contact support.' },
          { status: 400 }
        );
      }

      if (!FEATURED_PRICE_IDS.monthly) {
        return NextResponse.json(
          { error: 'Monthly price not configured' },
          { status: 500 }
        );
      }

      // Get the Stripe subscription to find the item ID
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const itemId = stripeSub.items.data[0]?.id;

      if (!itemId) {
        return NextResponse.json(
          { error: 'Stripe subscription item not found' },
          { status: 500 }
        );
      }

      // Upgrade: charge prorated amount now, new plan applies next cycle
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: [{
          id: itemId,
          price: FEATURED_PRICE_IDS.monthly,
        }],
        proration_behavior: 'always_invoice',
      });

      // Update DB record
      await serviceClient
        .from('featured_subscriptions')
        .update({
          plan_type: 'monthly',
          stripe_price_id: FEATURED_PRICE_IDS.monthly,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId);

      // Create Stripe Billing Portal session so user can confirm on Stripe
      const origin = request.headers.get('origin') || 'http://localhost:3000';
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id || (stripeSub.customer as string),
        return_url: `${origin}/billing`,
      });

      return NextResponse.json({
        success: true,
        redirectUrl: portalSession.url,
        message: 'Upgrade to monthly scheduled. Redirecting to Stripe.',
      });

    } else if (type === 'featured_weekly') {
      // Downgrade featured business from monthly to weekly
      const { subscriptionId } = body;
      if (!subscriptionId) {
        return NextResponse.json(
          { error: 'Subscription ID is required' },
          { status: 400 }
        );
      }

      const serviceClient = getServiceClient();
      const { data: subscription, error: fetchError } = await serviceClient
        .from('featured_subscriptions')
        .select('id, user_id, status, stripe_subscription_id, stripe_customer_id, plan_type')
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
          { error: 'Not authorized to modify this subscription' },
          { status: 403 }
        );
      }

      if (subscription.plan_type !== 'monthly') {
        return NextResponse.json(
          { error: 'Only monthly plans can downgrade to weekly' },
          { status: 400 }
        );
      }

      if (!['active', 'trialing'].includes(subscription.status)) {
        return NextResponse.json(
          { error: 'Can only downgrade active subscriptions' },
          { status: 400 }
        );
      }

      if (!subscription.stripe_subscription_id) {
        return NextResponse.json(
          { error: 'No Stripe subscription found. Please contact support.' },
          { status: 400 }
        );
      }

      if (!FEATURED_PRICE_IDS.weekly) {
        return NextResponse.json(
          { error: 'Weekly price not configured' },
          { status: 500 }
        );
      }

      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const itemId = stripeSub.items.data[0]?.id;

      if (!itemId) {
        return NextResponse.json(
          { error: 'Stripe subscription item not found' },
          { status: 500 }
        );
      }

      // Update the subscription — no proration, change takes effect at next billing period
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: [{
          id: itemId,
          price: FEATURED_PRICE_IDS.weekly,
        }],
        proration_behavior: 'none',
      });

      // Update DB record
      await serviceClient
        .from('featured_subscriptions')
        .update({
          plan_type: 'weekly',
          stripe_price_id: FEATURED_PRICE_IDS.weekly,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId);

      // Create Stripe Billing Portal session
      const origin = request.headers.get('origin') || 'http://localhost:3000';
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id || (stripeSub.customer as string),
        return_url: `${origin}/billing`,
      });

      return NextResponse.json({
        success: true,
        redirectUrl: portalSession.url,
        message: 'Downgrade to weekly scheduled. Redirecting to Stripe.',
      });

    } else if (type === 'planner_yearly') {
      // Switch family planner from monthly to yearly
      const { stripeSubscriptionId } = body;
      if (!stripeSubscriptionId) {
        return NextResponse.json(
          { error: 'Stripe subscription ID is required' },
          { status: 400 }
        );
      }

      if (!PLANNER_PRICE_IDS.yearly) {
        return NextResponse.json(
          { error: 'Yearly price not configured' },
          { status: 500 }
        );
      }

      // Retrieve the subscription and verify ownership via customer email
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const customer = await stripe.customers.retrieve(stripeSub.customer as string);

      if (customer.deleted || !('email' in customer) || customer.email !== session.user.email) {
        return NextResponse.json(
          { error: 'Not authorized to modify this subscription' },
          { status: 403 }
        );
      }

      // Verify it's currently on monthly pricing
      const currentPriceId = stripeSub.items.data[0]?.price.id;
      if (currentPriceId !== PLANNER_PRICE_IDS.monthly) {
        return NextResponse.json(
          { error: 'Only monthly plans can switch to yearly' },
          { status: 400 }
        );
      }

      const itemId = stripeSub.items.data[0]?.id;
      if (!itemId) {
        return NextResponse.json(
          { error: 'Subscription item not found' },
          { status: 500 }
        );
      }

      // Upgrade: charge prorated amount now, new plan applies next cycle
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{
          id: itemId,
          price: PLANNER_PRICE_IDS.yearly,
        }],
        proration_behavior: 'always_invoice',
      });

      // Create Stripe Billing Portal session so user can confirm on Stripe
      const origin = request.headers.get('origin') || 'http://localhost:3000';
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeSub.customer as string,
        return_url: `${origin}/billing`,
      });

      return NextResponse.json({
        success: true,
        redirectUrl: portalSession.url,
        message: 'Switch to yearly plan scheduled. Redirecting to Stripe.',
      });

    } else if (type === 'planner_monthly') {
      // Switch family planner from yearly to monthly
      const { stripeSubscriptionId } = body;
      if (!stripeSubscriptionId) {
        return NextResponse.json(
          { error: 'Stripe subscription ID is required' },
          { status: 400 }
        );
      }

      if (!PLANNER_PRICE_IDS.monthly) {
        return NextResponse.json(
          { error: 'Monthly price not configured' },
          { status: 500 }
        );
      }

      // Retrieve the subscription and verify ownership via customer email
      const plannerSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const plannerCustomer = await stripe.customers.retrieve(plannerSub.customer as string);

      if (plannerCustomer.deleted || !('email' in plannerCustomer) || plannerCustomer.email !== session.user.email) {
        return NextResponse.json(
          { error: 'Not authorized to modify this subscription' },
          { status: 403 }
        );
      }

      // Verify it's currently on yearly pricing
      const plannerCurrentPriceId = plannerSub.items.data[0]?.price.id;
      if (plannerCurrentPriceId !== PLANNER_PRICE_IDS.yearly) {
        return NextResponse.json(
          { error: 'Only yearly plans can switch to monthly' },
          { status: 400 }
        );
      }

      const plannerItemId = plannerSub.items.data[0]?.id;
      if (!plannerItemId) {
        return NextResponse.json(
          { error: 'Subscription item not found' },
          { status: 500 }
        );
      }

      // Update the subscription — no proration, change takes effect at next billing period
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{
          id: plannerItemId,
          price: PLANNER_PRICE_IDS.monthly,
        }],
        proration_behavior: 'none',
      });

      // Create Stripe Billing Portal session
      const origin = request.headers.get('origin') || 'http://localhost:3000';
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: plannerSub.customer as string,
        return_url: `${origin}/billing`,
      });

      return NextResponse.json({
        success: true,
        redirectUrl: portalSession.url,
        message: 'Switch to monthly plan scheduled. Redirecting to Stripe.',
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid change type' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error changing plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
