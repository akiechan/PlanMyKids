// Shared auth helper for planner API routes

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { stripe, PLANNER_PRICE_IDS } from '@/lib/stripe';

/**
 * Create an auth-aware Supabase client from request cookies.
 * Returns the client and authenticated user, or a 401 response.
 */
export async function getPlannerAuth(request: NextRequest) {
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

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  return { supabase, user: session.user, userId: session.user.id };
}

/**
 * Get a service role client for operations that need to bypass RLS.
 */
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url: any, options: any = {}) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}

/**
 * Check if the user is on a Pro plan by querying Stripe.
 * Returns 'pro' or 'free'.
 */
export async function getUserPlan(email: string): Promise<'pro' | 'free'> {
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) return 'free';

    const customerId = customers.data[0].id;
    const plannerPriceIds = Object.values(PLANNER_PRICE_IDS).filter(Boolean);

    // Check both active and trialing — Stripe puts subscriptions into 'trialing'
    // when the Price has a default trial or trial_period_days is passed at checkout.
    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 10 }),
      stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 10 }),
    ]);

    const allSubs = [...activeSubs.data, ...trialingSubs.data];
    const hasPlannerSub = allSubs.some(sub =>
      sub.items.data.some(item =>
        plannerPriceIds.includes(item.price.id)
      )
    );

    return hasPlannerSub ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}
