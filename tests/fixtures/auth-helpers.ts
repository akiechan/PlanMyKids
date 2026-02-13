import { Page, BrowserContext } from '@playwright/test';
import { TestUser } from './test-users';

/**
 * Helper functions for setting up different auth states in tests
 */

/**
 * Mock session data for Supabase auth
 */
interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
}

/**
 * Create a mock Supabase session for testing
 */
export function createMockSession(user: TestUser): MockSession | null {
  if (user.type === 'guest') {
    return null;
  }

  return {
    access_token: `mock-access-token-${user.id}`,
    refresh_token: `mock-refresh-token-${user.id}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    user: {
      id: user.id,
      email: user.email,
      user_metadata: {
        full_name: `Test User ${user.type}`,
      },
    },
  };
}

/**
 * Set up localStorage for a given user type
 */
export async function setupUserAuth(page: Page, user: TestUser): Promise<void> {
  const session = createMockSession(user);

  await page.addInitScript((sessionData) => {
    if (sessionData) {
      // Set up Supabase auth storage
      const supabaseKey = 'sb-' + 'localhost' + '-auth-token';
      localStorage.setItem(supabaseKey, JSON.stringify(sessionData));
    }
  }, session);
}

/**
 * Set up subscription data in localStorage
 */
export async function setupSubscription(
  page: Page,
  user: TestUser,
  programId?: string
): Promise<void> {
  if (user.type === 'guest' || user.type === 'authenticated') {
    return;
  }

  const subscriptionData = {
    id: `sub-${user.id}`,
    program_id: programId || 'test-program-id',
    user_id: user.id,
    plan_type: user.type === 'free_tier'
      ? 'free_trial'
      : user.type === 'weekly_tier'
        ? 'weekly'
        : 'monthly',
    status: user.subscriptionStatus || 'active',
    trial_start: user.type === 'free_tier'
      ? new Date().toISOString()
      : null,
    trial_end: user.type === 'free_tier'
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await page.addInitScript((subData) => {
    localStorage.setItem('planmykids-subscription', JSON.stringify(subData));
  }, subscriptionData);
}

/**
 * Set up saved programs in localStorage
 */
export async function setupSavedPrograms(page: Page, programs: unknown[]): Promise<void> {
  await page.addInitScript((programsData) => {
    localStorage.setItem('planmykids-saved-programs', JSON.stringify(programsData));
  }, programs);
}

/**
 * Set up compare context in localStorage
 */
export async function setupComparePrograms(page: Page, programs: unknown[]): Promise<void> {
  await page.addInitScript((programsData) => {
    localStorage.setItem('planmykids-compare', JSON.stringify({
      programs: programsData,
      lastUpdated: new Date().toISOString(),
    }));
  }, programs);
}

/**
 * Clear all auth and user data from localStorage
 */
export async function clearUserData(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
  });
}

/**
 * Set admin cookies for middleware authentication
 */
export async function setupAdminCookies(context: BrowserContext, user: TestUser): Promise<void> {
  if (user.type !== 'admin') {
    return;
  }

  // Set Supabase auth cookies
  await context.addCookies([
    {
      name: 'sb-access-token',
      value: `mock-admin-token-${user.id}`,
      domain: 'localhost',
      path: '/',
    },
    {
      name: 'sb-refresh-token',
      value: `mock-admin-refresh-${user.id}`,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * Check if current page shows access denied message
 */
export async function isAccessDenied(page: Page): Promise<boolean> {
  const accessDeniedSelectors = [
    'text=Access Denied',
    'text=Not Authorized',
    'text=Please log in',
    'text=Sign in required',
    'text=You need to be logged in',
    'text=Unauthorized',
  ];

  for (const selector of accessDeniedSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if current page shows paywall/upgrade message
 */
export async function showsPaywall(page: Page): Promise<boolean> {
  const paywallSelectors = [
    'text=Upgrade to',
    'text=Subscribe to',
    'text=Start your free trial',
    'text=Unlock',
    'text=Premium feature',
    'text=Family Pro',
  ];

  for (const selector of paywallSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

/**
 * Wait for page to fully load and hydrate
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // Wait for React hydration
  await page.waitForTimeout(500);
}
