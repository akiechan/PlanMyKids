import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
});

// Featured Business price IDs
export const FEATURED_PRICE_IDS = {
  weekly: process.env.STRIPE_PRICE_FEATURED_WEEKLY || '',
  monthly: process.env.STRIPE_PRICE_FEATURED_MONTHLY || '',
};

// Family Planner price IDs
export const PLANNER_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_PLANNER_MONTHLY || '',
  yearly: process.env.STRIPE_PRICE_PLANNER_YEARLY || '',
};

// Legacy alias for existing code that references PRICE_IDS
export const PRICE_IDS = FEATURED_PRICE_IDS;

export const PLAN_DETAILS = {
  free_trial: {
    name: 'Free Trial',
    description: '3-day free trial, then $98/week',
    price: 0,
    trialDays: 3,
    priceId: FEATURED_PRICE_IDS.weekly,
  },
  weekly: {
    name: 'Weekly',
    description: '$98 per week',
    price: 98,
    trialDays: 0,
    priceId: FEATURED_PRICE_IDS.weekly,
  },
  monthly: {
    name: 'Monthly',
    description: '$298 per month (save 24%)',
    price: 298,
    trialDays: 0,
    priceId: FEATURED_PRICE_IDS.monthly,
  },
} as const;

export type PlanType = keyof typeof PLAN_DETAILS;
