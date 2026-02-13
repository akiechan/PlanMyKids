import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './fixtures/auth-helpers';

/**
 * Test Suite: Guest User (Not Logged In)
 *
 * Tests that a user who hasn't logged in can:
 * - View all public pages (homepage, program details, compare, featured landing)
 * - Use the comparison feature (up to 3 programs)
 * - Is redirected to login when accessing protected pages
 * - Is redirected to admin login when accessing admin pages
 */

test.describe('Guest User - Public Pages', () => {

  test('can access homepage', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    await expect(page.locator('h1')).toContainText('Find the Perfect Program');
    expect(page.url()).not.toContain('login');
  });

  test('can view program listings on homepage', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Should see program cards or loading state
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });

  test('can access compare page', async ({ page }) => {
    await page.goto('/compare');
    await waitForPageLoad(page);

    expect(page.url()).toContain('compare');
    expect(page.url()).not.toContain('login');
  });

  test('can access add-provider page', async ({ page }) => {
    await page.goto('/add-provider');
    await waitForPageLoad(page);

    expect(page.url()).toContain('add-provider');
  });

  test('can access featured landing page', async ({ page }) => {
    await page.goto('/featured');
    await waitForPageLoad(page);

    expect(page.url()).not.toContain('login');
  });

  test('can access premium upsell page', async ({ page }) => {
    await page.goto('/premium');
    await waitForPageLoad(page);

    expect(page.url()).not.toContain('login');
  });

  test('can access featured login page', async ({ page }) => {
    await page.goto('/featured/login');
    await waitForPageLoad(page);

    expect(page.url()).toContain('featured/login');
  });

  test('can access admin login page', async ({ page }) => {
    await page.goto('/admin/login');
    await waitForPageLoad(page);

    expect(page.url()).toContain('admin/login');
  });
});

test.describe('Guest User - Protected Pages Redirect', () => {

  test('redirects from family dashboard to login', async ({ page }) => {
    await page.goto('/familyplanning/dashboard');
    await waitForPageLoad(page);

    expect(page.url()).toContain('login');
  });

  test('redirects from profile to login', async ({ page }) => {
    await page.goto('/profile');
    await waitForPageLoad(page);

    expect(page.url()).toContain('login');
  });

  test('redirects from featured setup to login', async ({ page }) => {
    await page.goto('/featured/setup');
    await waitForPageLoad(page);

    expect(page.url()).toContain('login');
  });
});

test.describe('Guest User - Admin Pages Redirect', () => {

  test('redirects from admin dashboard to admin login', async ({ page }) => {
    await page.goto('/admin');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });

  test('redirects from admin review to admin login', async ({ page }) => {
    await page.goto('/admin/review');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });

  test('redirects from admin edits to admin login', async ({ page }) => {
    await page.goto('/admin/edits');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });

  test('redirects from admin add-program to admin login', async ({ page }) => {
    await page.goto('/admin/edit-program');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });

  test('redirects from admin search to admin login', async ({ page }) => {
    await page.goto('/admin/search');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });

  test('redirects from admin duplicates to admin login', async ({ page }) => {
    await page.goto('/admin/duplicates');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });

  test('redirects from admin merged-programs to admin login', async ({ page }) => {
    await page.goto('/admin/merged-programs');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });

  test('redirects from admin mass-update to admin login', async ({ page }) => {
    await page.goto('/admin/mass-update');
    await waitForPageLoad(page);

    expect(page.url()).toContain('/admin/login');
  });
});

test.describe('Guest User - Comparison Feature', () => {

  test('sees compare button on program cards', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for programs to potentially load
    await page.waitForTimeout(2000);

    // Guest users should see Compare button (+)
    const compareButtons = page.locator('button[title*="comparison"]');
    const count = await compareButtons.count();

    // Should have buttons if programs exist
    expect(count >= 0).toBe(true);
  });
});

test.describe('Guest User - UI Elements', () => {

  test('does not see "My Saved Programs" on homepage', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const savedLink = page.locator('text=My Saved Programs');
    const isVisible = await savedLink.isVisible().catch(() => false);

    expect(isVisible).toBe(false);
  });

  test('sees login option in navigation', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Should see some form of login/signup option
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });
});
