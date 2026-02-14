import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { stripe, PLANNER_PRICE_IDS } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    // Create server-side Supabase client
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

    // Get the current session — try cookies first, then Authorization header
    let session = (await supabase.auth.getSession()).data.session;

    if (!session) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const { data } = await supabase.auth.getUser(token);
        if (data.user) {
          // Create a minimal session-like object for userId extraction
          session = { user: data.user } as any;
        }
      }
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Single query with JOIN -- eliminates N+1 problem
    const { data: featuredSubscriptions, error: featuredError } = await supabase
      .from('featured_subscriptions')
      .select(`
        id,
        program_id,
        plan_type,
        status,
        trial_start,
        trial_end,
        current_period_start,
        current_period_end,
        canceled_at,
        contact_email,
        created_at,
        stripe_customer_id,
        programs(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (featuredError) {
      console.error('Error fetching featured subscriptions:', featuredError);
    }

    // Enrich subscriptions with program names from the JOIN
    const enrichedSubscriptions = (featuredSubscriptions || []).map((sub: any) => ({
      ...sub,
      program_name: sub.programs?.name || (sub.program_id ? 'Unknown Program' : 'New Program (Pending)'),
      programs: undefined,
      stripe_customer_id: undefined,
    }));

    // Check Stripe for family planner subscription
    let familyPlannerStatus: Record<string, unknown> = {
      plan: 'free',
      status: 'active',
      billingCycle: 'monthly',
      nextBillingDate: null,
      price: 0,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      features: ['Save up to 5 programs', '1 child profile', '1 parent profile', 'Basic calendar view'],
    };

    try {
      // Reuse Stripe customer ID from featured subscriptions if available
      let stripeCustomerId = (featuredSubscriptions || []).find((s: any) => s.stripe_customer_id)?.stripe_customer_id;

      if (!stripeCustomerId && session.user.email) {
        const customers = await stripe.customers.list({
          email: session.user.email,
          limit: 1,
        });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        }
      }

      if (stripeCustomerId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          limit: 100,
        });

        const plannerPriceIds = [PLANNER_PRICE_IDS.monthly, PLANNER_PRICE_IDS.yearly].filter(Boolean);

        const plannerSub = subscriptions.data.find(sub =>
          ['active', 'trialing'].includes(sub.status) &&
          sub.items.data.some(item => plannerPriceIds.includes(item.price.id))
        );

        if (plannerSub) {
          const priceId = plannerSub.items.data[0]?.price.id;
          const isYearly = priceId === PLANNER_PRICE_IDS.yearly;

          familyPlannerStatus = {
            plan: 'pro',
            status: plannerSub.cancel_at_period_end ? 'cancelling' : plannerSub.status,
            billingCycle: isYearly ? 'yearly' : 'monthly',
            nextBillingDate: (plannerSub as any).current_period_end
              ? new Date((plannerSub as any).current_period_end * 1000).toISOString()
              : null,
            price: isYearly ? 65 : 8.5,
            cancelAtPeriodEnd: plannerSub.cancel_at_period_end || false,
            stripeSubscriptionId: plannerSub.id,
            features: [
              'Unlimited saved programs',
              'Unlimited child profiles',
              'Email reminders before registration',
              'Export to iOS/Android calendar',
              'Family sharing (2 accounts)',
              'Priority support',
            ],
          };
        }
      }
    } catch (e) {
      console.error('Error checking Stripe for planner subscription:', e);
    }

    const response = NextResponse.json({
      featuredSubscriptions: enrichedSubscriptions,
      familyPlanner: familyPlannerStatus,
      email: session.user.email,
    });

    // No cache — subscription status must always be fresh (especially after upgrades)
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return response;
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
