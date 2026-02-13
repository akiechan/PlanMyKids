import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANNER_PRICE_IDS } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';

async function getStripeCustomer(email: string, userId: string) {
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length > 0) {
    return customers.data[0].id;
  }
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });
  return customer.id;
}

async function findPlannerSubscription(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 100,
  });

  const plannerPriceIds = [PLANNER_PRICE_IDS.monthly, PLANNER_PRICE_IDS.yearly].filter(Boolean);

  return subscriptions.data.find(sub =>
    ['active', 'trialing', 'past_due'].includes(sub.status) &&
    sub.items.data.some(item => plannerPriceIds.includes(item.price.id))
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, cycle } = await request.json();
    const customerId = await getStripeCustomer(user.email!, user.id);

    if (action === 'subscribe') {
      const existingSub = await findPlannerSubscription(customerId);
      if (existingSub) {
        return NextResponse.json(
          { error: 'Already subscribed. Use switch action to change billing cycle.' },
          { status: 400 }
        );
      }

      const priceId = cycle === 'yearly' ? PLANNER_PRICE_IDS.yearly : PLANNER_PRICE_IDS.monthly;
      if (!priceId) {
        return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 });
      }

      const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/familyplanning/dashboard?upgraded=true`,
        cancel_url: `${origin}/familyplanning/billing`,
        metadata: {
          type: 'planner',
          user_id: user.id,
          cycle,
        },
        subscription_data: {
          metadata: {
            type: 'planner',
            user_id: user.id,
          },
        },
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    if (action === 'switch') {
      const existingSub = await findPlannerSubscription(customerId);
      if (!existingSub) {
        return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
      }

      const newPriceId = cycle === 'yearly' ? PLANNER_PRICE_IDS.yearly : PLANNER_PRICE_IDS.monthly;
      if (!newPriceId) {
        return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 });
      }

      await stripe.subscriptions.update(existingSub.id, {
        items: [{
          id: existingSub.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'reactivate') {
      const existingSub = await findPlannerSubscription(customerId);
      if (!existingSub) {
        return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
      }

      await stripe.subscriptions.update(existingSub.id, {
        cancel_at_period_end: false,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Planner subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = await getStripeCustomer(user.email!, user.id);
    const existingSub = await findPlannerSubscription(customerId);

    if (!existingSub) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    await stripe.subscriptions.update(existingSub.id, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel planner subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
