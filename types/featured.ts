export type PlanType = 'free_trial' | 'weekly' | 'monthly';

export type SubscriptionStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

export interface FeaturedSubscription {
  id: string;
  program_id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  program_logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCheckoutRequest {
  programId: string | null;
  programData?: {
    name: string;
    description?: string;
    category?: string[];
    neighborhood?: string;
    address?: string;
    website?: string;
  };
  planType: PlanType;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  programLogoUrl?: string;
}

export interface CreateCheckoutResponse {
  sessionId: string;
  url: string;
}
