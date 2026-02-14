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

    // Fetch all subscriptions (excludes ended ones by default) and grant access
    // for active, trialing (trial_period_days), and past_due (payment retry window).
    const GRANT_ACCESS_STATUSES = ['active', 'trialing', 'past_due'];
    const subs = await stripe.subscriptions.list({ customer: customerId, limit: 100 });

    const hasPlannerSub = subs.data
      .filter(sub => GRANT_ACCESS_STATUSES.includes(sub.status))
      .some(sub =>
        sub.items.data.some(item =>
          plannerPriceIds.includes(item.price.id)
        )
      );

    return hasPlannerSub ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}
