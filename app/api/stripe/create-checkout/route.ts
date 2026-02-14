import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { CreateCheckoutRequest } from '@/types/featured';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get authenticated user — try cookies first, then Authorization header
    let user = (await supabase.auth.getUser()).data.user;

    if (!user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const { data } = await supabase.auth.getUser(token);
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateCheckoutRequest = await request.json();
    const {
      programId,
      programData,
      planType,
      contactName,
      contactEmail,
      contactPhone,
      programLogoUrl,
    } = body;

    // Validate required fields
    if (!contactName || !contactEmail) {
      return NextResponse.json(
        { error: 'Contact name and email are required' },
        { status: 400 }
      );
    }

    if (!programId && !programData?.name) {
      return NextResponse.json(
        { error: 'Program ID or program data is required' },
        { status: 400 }
      );
    }

    // Determine price ID
    let priceId: string;
    if (planType === 'monthly') {
      priceId = PRICE_IDS.monthly;
    } else {
      // Both free_trial and weekly use the weekly price
      priceId = PRICE_IDS.weekly;
    }

    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe price not configured' },
        { status: 500 }
      );
    }

    // Create or get Stripe customer
    let stripeCustomerId: string;

    // Check if user already has a Stripe customer ID
    const { data: existingSubscription } = await supabase
      .from('featured_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single();

    if (existingSubscription?.stripe_customer_id) {
      stripeCustomerId = existingSubscription.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: contactEmail,
        name: contactName,
        metadata: {
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Create featured_subscription record
    const { data: subscription, error: insertError } = await supabase
      .from('featured_subscriptions')
      .insert({
        program_id: programId || null,
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        stripe_price_id: priceId,
        plan_type: planType,
        status: 'pending',
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        program_logo_url: programLogoUrl || null,
        program_data: programData || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create subscription record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create subscription record' },
        { status: 500 }
      );
    }

    // Get the origin for redirect URLs
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // Create Stripe Checkout Session
    const sessionParams = {
      mode: 'subscription' as const,
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/featured/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/featured/setup`,
      payment_method_collection: 'always' as const,
      metadata: {
        subscription_id: subscription.id,
        program_id: programId || '',
        user_id: user.id,
      },
      ...(planType === 'free_trial' && {
        subscription_data: {
          trial_period_days: 3,
          metadata: {
            subscription_id: subscription.id,
            program_id: programId || '',
            user_id: user.id,
          },
        },
      }),
    };

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
