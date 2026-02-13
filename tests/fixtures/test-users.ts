/**
 * Test user fixtures for access control testing
 * These represent different user types and their expected access levels
 */

export interface TestUser {
  id: string;
  email: string;
  type: 'guest' | 'authenticated' | 'admin' | 'free_tier' | 'weekly_tier' | 'monthly_tier';
  subscriptionStatus?: 'trialing' | 'active' | 'canceled' | 'expired';
  hasUsedFreeTrial?: boolean;
}

export const TEST_USERS: Record<string, TestUser> = {
  guest: {
    id: '',
    email: '',
    type: 'guest',
  },
  authenticated: {
    id: 'user-123',
    email: 'user@example.com',
    type: 'authenticated',
  },
  admin: {
    id: 'admin-123',
    email: 'admin@sfhubs.com',
    type: 'admin',
  },
  freeTier: {
    id: 'free-123',
    email: 'free@example.com',
    type: 'free_tier',
    subscriptionStatus: 'trialing',
    hasUsedFreeTrial: false,
  },
  freeTierExpired: {
    id: 'free-expired-123',
    email: 'expired@example.com',
    type: 'free_tier',
    subscriptionStatus: 'expired',
    hasUsedFreeTrial: true,
  },
  weeklyTier: {
    id: 'weekly-123',
    email: 'weekly@example.com',
    type: 'weekly_tier',
    subscriptionStatus: 'active',
  },
  monthlyTier: {
    id: 'monthly-123',
    email: 'monthly@example.com',
    type: 'monthly_tier',
    subscriptionStatus: 'active',
  },
};

/**
 * Page access matrix defining which user types can access which pages
 *
 * NOTE: Server-side middleware protects routes. In e2e tests without real auth,
 * protected routes will redirect to login. The matrix below represents INTENDED
 * access levels when properly authenticated.
 */
export interface PageAccess {
  route: string;
  name: string;
  isPublic: boolean;           // No auth required
  requiresAuth: boolean;       // Requires any authenticated user
  requiresAdmin: boolean;      // Requires admin email in allowlist
  redirectTo?: string;         // Where to redirect if not authorized
}

export const PAGE_ACCESS_MATRIX: PageAccess[] = [
  // Public pages - accessible to all
  {
    route: '/',
    name: 'Homepage',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    route: '/programs/test-program-id',
    name: 'Program Detail',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    route: '/compare',
    name: 'Compare Programs',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    route: '/add-provider',
    name: 'Add Provider',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    route: '/featured',
    name: 'Featured Programs Landing',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    route: '/featured/login',
    name: 'Featured Login',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    route: '/premium',
    name: 'Premium Upsell',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },

  // Auth-required pages - redirect to login if not authenticated
  {
    route: '/profile',
    name: 'User Profile',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: false,
    redirectTo: '/featured/login',
  },
  {
    route: '/familyplanning/dashboard',
    name: 'Family Planning Dashboard',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: false,
    redirectTo: '/featured/login',
  },
  {
    route: '/featured/setup',
    name: 'Featured Setup',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: false,
    redirectTo: '/featured/login',
  },

  // Admin-only pages - redirect to admin login
  {
    route: '/admin',
    name: 'Admin Dashboard',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/review',
    name: 'Admin Review',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/edits',
    name: 'Admin Edits',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/edit-program',
    name: 'Admin Add Program',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/search',
    name: 'Admin Search',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/duplicates',
    name: 'Admin Duplicates',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/merged-programs',
    name: 'Admin Merged Programs',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/mass-update',
    name: 'Admin Mass Update',
    isPublic: false,
    requiresAuth: true,
    requiresAdmin: true,
    redirectTo: '/admin/login',
  },
  {
    route: '/admin/login',
    name: 'Admin Login',
    isPublic: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
];

/**
 * Feature access matrix for subscription-gated features
 */
export interface FeatureAccess {
  feature: string;
  description: string;
  guest: boolean;
  authenticated: boolean;
  free_tier: boolean;
  weekly_tier: boolean;
  monthly_tier: boolean;
}

export const FEATURE_ACCESS_MATRIX: FeatureAccess[] = [
  {
    feature: 'compare_programs',
    description: 'Compare up to 3 programs',
    guest: true,
    authenticated: true,
    free_tier: true,
    weekly_tier: true,
    monthly_tier: true,
  },
  {
    feature: 'save_programs',
    description: 'Save programs to dashboard',
    guest: false,
    authenticated: true,
    free_tier: true,
    weekly_tier: true,
    monthly_tier: true,
  },
  {
    feature: 'suggest_edits',
    description: 'Suggest program edits for review',
    guest: false,
    authenticated: true,
    free_tier: true,
    weekly_tier: true,
    monthly_tier: true,
  },
  {
    feature: 'featured_badge',
    description: 'Program appears with featured badge',
    guest: false,
    authenticated: false,
    free_tier: true,
    weekly_tier: true,
    monthly_tier: true,
  },
  {
    feature: 'top_placement',
    description: 'Program appears in Featured section',
    guest: false,
    authenticated: false,
    free_tier: true,
    weekly_tier: true,
    monthly_tier: true,
  },
  {
    feature: 'priority_notification',
    description: 'Priority notification for new leads',
    guest: false,
    authenticated: false,
    free_tier: false,
    weekly_tier: false,
    monthly_tier: true,
  },
  {
    feature: 'analytics_dashboard',
    description: 'View program analytics',
    guest: false,
    authenticated: false,
    free_tier: false,
    weekly_tier: false,
    monthly_tier: true,
  },
  {
    feature: 'free_trial',
    description: 'Access to 3-day free trial',
    guest: false,
    authenticated: true,
    free_tier: false, // Already used
    weekly_tier: false,
    monthly_tier: false,
  },
];
