import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { sendEmail } from '@/lib/mailgun';

// Use service role for webhook (no user context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleTrialWillEnd(subscription);
        break;
      }

      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceUpcoming(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // Planner checkouts don't have a featured_subscription record
  if (session.metadata?.type === 'planner') {
    console.log('Planner checkout completed for user:', session.metadata.user_id);
    return;
  }

  const subscriptionId = session.metadata?.subscription_id;
  if (!subscriptionId) {
    console.error('No subscription_id in checkout session metadata');
    return;
  }

  const stripeSubscriptionId = session.subscription as string;

  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Determine status based on Stripe subscription status
  let status: string;
  if (stripeSubscription.status === 'trialing') {
    status = 'trialing';
  } else if (stripeSubscription.status === 'active') {
    status = 'active';
  } else {
    status = 'pending';
  }

  // Update the subscription record
  // Note: In newer Stripe API, period dates are accessed differently via billing_cycle_anchor
  const { error } = await supabaseAdmin
    .from('featured_subscriptions')
    .update({
      stripe_subscription_id: stripeSubscriptionId,
      status,
      trial_start: stripeSubscription.trial_start
        ? new Date(stripeSubscription.trial_start * 1000).toISOString().split('T')[0]
        : null,
      trial_end: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000).toISOString().split('T')[0]
        : null,
      // Use billing_cycle_anchor as the period start reference
      current_period_start: stripeSubscription.billing_cycle_anchor
        ? new Date(stripeSubscription.billing_cycle_anchor * 1000).toISOString().split('T')[0]
        : null,
    })
    .eq('id', subscriptionId);

  if (error) {
    console.error('Failed to update subscription:', error);
    throw error;
  }

  console.log(`Subscription ${subscriptionId} updated to status: ${status}`);

  // Mark the program as featured
  await markProgramAsFeatured(subscriptionId);

  // Send confirmation email
  await sendConfirmationEmail(subscriptionId, status, stripeSubscription.trial_end);
}

async function markProgramAsFeatured(subscriptionId: string) {
  // Get the subscription to find the program
  const { data: subscription, error: fetchError } = await supabaseAdmin
    .from('featured_subscriptions')
    .select('program_id, program_data')
    .eq('id', subscriptionId)
    .single();

  if (fetchError || !subscription) {
    console.error('Failed to get subscription for featuring:', fetchError);
    return;
  }

  let programId = subscription.program_id;

  // If no program_id but has program_data, create a new program
  if (!programId && subscription.program_data) {
    const programData = subscription.program_data;
    const { data: newProgram, error: createError } = await supabaseAdmin
      .from('programs')
      .insert({
        name: programData.name,
        description: programData.description || '',
        category: programData.category || [],
        provider_name: programData.provider_name || '',
        provider_website: programData.provider_website || null,
        contact_email: programData.contact_email || null,
        contact_phone: programData.contact_phone || null,
        status: 'active',
        is_featured: true,
        program_type: 'program',
        age_min: 0,
        age_max: 18,
        operating_days: [],
        hours_per_day: {},
        google_review_count: 0,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Failed to create program:', createError);
      return;
    }

    programId = newProgram.id;

    // Create location if address/neighborhood provided
    if (programData.neighborhood || programData.address) {
      await supabaseAdmin
        .from('program_locations')
        .insert({
          program_id: programId,
          address: programData.address || '',
          neighborhood: programData.neighborhood || '',
          latitude: 0,
          longitude: 0,
          is_primary: true,
        });
    }

    // Update subscription with the new program_id
    await supabaseAdmin
      .from('featured_subscriptions')
      .update({ program_id: programId })
      .eq('id', subscriptionId);

    console.log(`Created new program ${programId} for subscription ${subscriptionId}`);
  }

  // Mark the program as featured
  if (programId) {
    const { error: updateError } = await supabaseAdmin
      .from('programs')
      .update({ is_featured: true })
      .eq('id', programId);

    if (updateError) {
      console.error('Failed to mark program as featured:', updateError);
    } else {
      console.log(`Program ${programId} marked as featured`);
    }
  }
}

async function sendConfirmationEmail(subscriptionId: string, status: string, trialEnd: number | null) {
  // Get subscription details from database
  const { data: subscription, error } = await supabaseAdmin
    .from('featured_subscriptions')
    .select(`
      *,
      programs:program_id (name)
    `)
    .eq('id', subscriptionId)
    .single();

  if (error || !subscription) {
    console.error('Failed to get subscription for email:', error);
    return;
  }

  const contactEmail = subscription.contact_email;
  const contactName = subscription.contact_name || 'there';
  // Handle both single object and array returns from Supabase join
  const programData = Array.isArray(subscription.programs) ? subscription.programs[0] : subscription.programs;
  const programName = programData?.name || 'Your Program';
  const isTrialing = status === 'trialing';
  const trialEndDate = trialEnd ? new Date(trialEnd * 1000).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { success, error: emailError } = await sendEmail({
    to: contactEmail,
    subject: isTrialing
      ? `Your Free Trial Has Started - ${programName}`
      : `Welcome to Featured Programs - ${programName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f59e0b; margin: 0;">PlanMyKids</h1>
        </div>

        <div style="background-color: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #065f46;">
            ${isTrialing ? 'Your Free Trial Has Started!' : 'Welcome to Featured Programs!'}
          </h2>
          <p>Hi ${contactName},</p>
          <p>
            Great news! <strong>${programName}</strong> is now featured on PlanMyKids.
            ${isTrialing ? `Your 3-day free trial is active until ${trialEndDate}.` : ''}
          </p>
          ${isTrialing ? `
          <p style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin: 16px 0;">
            <strong>Reminder:</strong> Your trial will automatically convert to a paid subscription on ${trialEndDate}.
            You can cancel anytime before then if you decide it's not right for you.
          </p>
          ` : ''}
        </div>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #374151;">What's Next?</h3>
          <ul style="padding-left: 20px; color: #4b5563;">
            <li>Your program now appears at the top of search results</li>
            <li>Featured badge is displayed on your listing</li>
            <li>Families can easily find and contact you</li>
          </ul>
          <a href="${appUrl}" style="display: inline-block; background-color: #f59e0b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 10px;">
            View Your Listing
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Have questions? Reply to this email and we'll be happy to help.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          PlanMyKids - Discover enrichment programs for your kids in San Francisco
        </p>
      </body>
      </html>
    `,
  });

  if (success) {
    console.log(`Confirmation email sent to ${contactEmail}`);
  } else {
    console.error('Failed to send confirmation email:', emailError);
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;

  // Find the subscription record
  const { data: record, error: findError } = await supabaseAdmin
    .from('featured_subscriptions')
    .select('id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (findError || !record) {
    // Not a featured subscription — may be a planner subscription (managed via Stripe directly)
    console.log('No featured_subscription record for:', stripeSubscriptionId, '(may be planner subscription)');
    return;
  }

  // Map Stripe status to our status
  let status: string;
  switch (subscription.status) {
    case 'trialing':
      status = 'trialing';
      break;
    case 'active':
      status = 'active';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      status = 'canceled';
      break;
    default:
      status = 'pending';
  }

  const { error } = await supabaseAdmin
    .from('featured_subscriptions')
    .update({
      status,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('id', record.id);

  if (error) {
    console.error('Failed to update subscription:', error);
    throw error;
  }

  console.log(`Subscription ${record.id} updated to status: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;

  // Get the subscription to find the program
  const { data: record } = await supabaseAdmin
    .from('featured_subscriptions')
    .select('id, program_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  const { error } = await supabaseAdmin
    .from('featured_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('Failed to cancel subscription:', error);
    throw error;
  }

  // Unfeature the program
  if (record?.program_id) {
    await supabaseAdmin
      .from('programs')
      .update({ is_featured: false })
      .eq('id', record.program_id);
    console.log(`Program ${record.program_id} unfeatured`);
  }

  console.log(`Subscription ${stripeSubscriptionId} canceled`);
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  // Note: Stripe sends this event 3 days before trial ends by default
  // We use this for a "3 days left" reminder
  // The "1 day before charge" reminder is sent via invoice.upcoming
  const stripeSubscriptionId = subscription.id;

  // Find the subscription record
  const { data: record, error: findError } = await supabaseAdmin
    .from('featured_subscriptions')
    .select(`
      id,
      contact_email,
      contact_name,
      program_id,
      programs:program_id (name)
    `)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (findError || !record) {
    console.error('Subscription record not found for trial reminder:', stripeSubscriptionId);
    return;
  }

  const contactEmail = record.contact_email;
  const contactName = record.contact_name || 'there';
  // Handle both single object and array returns from Supabase join
  const programData = Array.isArray(record.programs) ? record.programs[0] : record.programs;
  const programName = programData?.name || 'Your Program';
  const trialEndDate = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'in 3 days';

  const { success, error: emailError } = await sendEmail({
    to: contactEmail,
    subject: `Your Free Trial Ends in 3 Days - ${programName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f59e0b; margin: 0;">PlanMyKids</h1>
        </div>

        <div style="background-color: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #0369a1;">Your Trial Ends in 3 Days</h2>
          <p>Hi ${contactName},</p>
          <p>
            This is a friendly heads-up that your free trial for <strong>${programName}</strong>
            ends on <strong>${trialEndDate}</strong>.
          </p>
          <p>
            After your trial ends, your card will be charged <strong>$98/week</strong> to keep your
            program featured on PlanMyKids.
          </p>
        </div>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #374151;">How It's Going</h3>
          <p style="color: #4b5563;">
            Your program is currently appearing at the top of search results with the featured badge.
            We'll send you another reminder the day before your trial ends.
          </p>
        </div>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #374151;">Questions or Need to Cancel?</h3>
          <p style="color: #4b5563;">
            If you have any questions or need to cancel before being charged, just reply to this email
            and we'll be happy to help.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          PlanMyKids - Discover enrichment programs for your kids in San Francisco
        </p>
      </body>
      </html>
    `,
  });

  if (success) {
    console.log(`Trial 3-day reminder email sent to ${contactEmail}`);
  } else {
    console.error('Failed to send trial reminder email:', emailError);
  }
}

async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  // This fires 1 day before invoice is finalized (configurable in Stripe dashboard)
  // Use it to send "1 day before charge" reminder emails
  const lines = invoice.lines?.data;
  const subscriptionId = lines?.[0]?.subscription;
  const stripeSubscriptionId = typeof subscriptionId === 'string' ? subscriptionId : null;

  if (!stripeSubscriptionId) {
    console.log('No subscription ID in invoice.upcoming event');
    return;
  }

  // Find the subscription record
  const { data: record, error: findError } = await supabaseAdmin
    .from('featured_subscriptions')
    .select(`
      id,
      contact_email,
      contact_name,
      status,
      program_id,
      programs:program_id (name)
    `)
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (findError || !record) {
    console.error('Subscription record not found for invoice upcoming:', stripeSubscriptionId);
    return;
  }

  // Only send for trialing subscriptions (first charge after trial)
  // For regular renewals, we could send a different email or skip
  const isTrialEnding = record.status === 'trialing';

  const contactEmail = record.contact_email;
  const contactName = record.contact_name || 'there';
  const programData = Array.isArray(record.programs) ? record.programs[0] : record.programs;
  const programName = programData?.name || 'Your Program';

  // Calculate charge date (invoice.created + 1 day typically)
  const chargeDate = invoice.due_date
    ? new Date(invoice.due_date * 1000).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'tomorrow';

  const amount = invoice.amount_due ? `$${(invoice.amount_due / 100).toFixed(0)}` : '$98';

  const { success, error: emailError } = await sendEmail({
    to: contactEmail,
    subject: isTrialEnding
      ? `Your Trial Ends Tomorrow - ${programName}`
      : `Payment Reminder - ${programName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f59e0b; margin: 0;">PlanMyKids</h1>
        </div>

        <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #92400e;">
            ${isTrialEnding ? 'Your Trial Ends Tomorrow' : 'Payment Reminder'}
          </h2>
          <p>Hi ${contactName},</p>
          <p>
            ${isTrialEnding
              ? `This is a reminder that your free trial for <strong>${programName}</strong> ends tomorrow.`
              : `This is a reminder about your upcoming payment for <strong>${programName}</strong>.`
            }
          </p>
          <p style="font-size: 18px; font-weight: bold; color: #92400e;">
            Your card will be charged ${amount} on ${chargeDate}.
          </p>
        </div>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #374151;">Want to Continue?</h3>
          <p style="color: #4b5563;">
            No action needed! Your subscription will automatically continue, and your program
            will keep appearing at the top of search results with the featured badge.
          </p>
        </div>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #991b1b;">Need to Cancel?</h3>
          <p style="color: #7f1d1d;">
            If you'd like to cancel before being charged, please reply to this email today.
            We'll help you cancel right away.
          </p>
        </div>

        <p style="color: #666; font-size: 14px;">
          Questions? Just reply to this email and we'll be happy to help.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          PlanMyKids - Discover enrichment programs for your kids in San Francisco
        </p>
      </body>
      </html>
    `,
  });

  if (success) {
    console.log(`Invoice upcoming (1-day reminder) email sent to ${contactEmail}`);
  } else {
    console.error('Failed to send invoice upcoming email:', emailError);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // In newer Stripe API, subscription is accessed via parent property or lines
  const lines = invoice.lines?.data;
  const subscriptionId = lines?.[0]?.subscription;
  const stripeSubscriptionId = typeof subscriptionId === 'string' ? subscriptionId : null;

  if (!stripeSubscriptionId) return;

  const { error } = await supabaseAdmin
    .from('featured_subscriptions')
    .update({
      status: 'past_due',
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('Failed to update subscription to past_due:', error);
    throw error;
  }

  console.log(`Subscription ${stripeSubscriptionId} marked as past_due`);
}
