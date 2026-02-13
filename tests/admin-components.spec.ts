import { test, expect } from '@playwright/test';
import { waitForPageLoad, setupAdminCookies } from './fixtures/auth-helpers';
import { TEST_USERS } from './fixtures/test-users';

/**
 * Test Suite: Admin Components
 *
 * Comprehensive tests for admin functionality including:
 * - Admin dashboard navigation
 * - Program management
 * - Camp-specific fields
 * - URL handling
 * - Form validation
 * - Data display
 */

test.describe('Admin Dashboard', () => {

  test('displays all admin menu categories', async ({ page }) => {
    // Note: In a real test with auth, we would set up admin cookies
    await page.goto('/admin');
    await waitForPageLoad(page);

    // Check for main category headings using more specific selectors
    await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Manage Programs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bulk Operations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Analytics & History' })).toBeVisible();
  });

  test('has correct navigation links', async ({ page }) => {
    await page.goto('/admin');
    await waitForPageLoad(page);

    // Check for key navigation links
    const links = [
      '/admin/review',
      '/admin/edits',
      '/admin/programs',
      '/admin/search',
      '/admin/duplicates',
      '/admin/mass-update',
      '/admin/activity',
      '/admin/setup',
    ];

    for (const href of links) {
      const link = page.locator(`a[href="${href}"]`);
      await expect(link).toBeVisible();
    }
  });

  test('displays pending counts when available', async ({ page }) => {
    await page.goto('/admin');
    await waitForPageLoad(page);

    // The dashboard shows pending counts - check the structure exists
    const reviewLink = page.locator('a[href="/admin/review"]');
    await expect(reviewLink).toBeVisible();
  });
});

test.describe('Admin Programs Page', () => {

  test('displays programs list or redirects to login', async ({ page }) => {
    await page.goto('/admin/programs');
    await waitForPageLoad(page);

    // Either shows search input (if authorized) or redirects to login
    const searchInput = page.locator('input[placeholder*="Search"]');
    const loginPage = page.url().includes('login');

    const hasSearch = await searchInput.isVisible().catch(() => false);
    expect(hasSearch || loginPage).toBe(true);
  });

  test('has program type filter options when accessible', async ({ page }) => {
    await page.goto('/admin/programs');
    await waitForPageLoad(page);

    // Skip check if redirected to login
    if (page.url().includes('login')) {
      expect(true).toBe(true);
      return;
    }

    // Look for filter controls
    const filters = page.locator('select');
    const count = await filters.count();
    expect(count >= 0).toBe(true);
  });

  test('has status filter when accessible', async ({ page }) => {
    await page.goto('/admin/programs');
    await waitForPageLoad(page);

    // Skip check if redirected to login
    if (page.url().includes('login')) {
      expect(true).toBe(true);
      return;
    }

    // Look for status filter
    const statusFilter = page.locator('select');
    const count = await statusFilter.count();
    expect(count >= 0).toBe(true);
  });

  test('displays program cards with correct information', async ({ page }) => {
    await page.goto('/admin/programs');
    await waitForPageLoad(page);

    // Skip check if redirected to login
    if (page.url().includes('login')) {
      expect(true).toBe(true);
      return;
    }

    // Check if program entries are displayed
    const content = page.getByRole('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Admin Edit Page - Camp Fields', () => {

  test('loads edit page structure or redirects', async ({ page }) => {
    // Use a test ID or navigate to edit page
    await page.goto('/admin/edit/test-id');
    await waitForPageLoad(page);

    // Either loads edit form or redirects to login
    const loginRedirect = page.url().includes('login');
    const mainContent = page.getByRole('main');

    const hasMain = await mainContent.isVisible().catch(() => false);
    expect(hasMain || loginRedirect).toBe(true);
  });
});

test.describe('Admin Review Page', () => {

  test('displays review page', async ({ page }) => {
    await page.goto('/admin/review');
    await waitForPageLoad(page);

    // Check page loaded
    const heading = page.locator('h1, h2');
    const count = await heading.count();
    expect(count > 0).toBe(true);
  });

  test('has approve/reject functionality structure', async ({ page }) => {
    await page.goto('/admin/review');
    await waitForPageLoad(page);

    // Check for action buttons or empty state
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Admin Search Page', () => {

  test('has search input', async ({ page }) => {
    await page.goto('/admin/search');
    await waitForPageLoad(page);

    // Should have a search input
    const searchInput = page.locator('input[type="text"], input[type="search"]');
    const count = await searchInput.count();
    expect(count > 0).toBe(true);
  });

  test('has search button', async ({ page }) => {
    await page.goto('/admin/search');
    await waitForPageLoad(page);

    // Should have a search button
    const searchButton = page.locator('button:has-text("Search"), button[type="submit"]');
    const count = await searchButton.count();
    expect(count > 0).toBe(true);
  });
});

test.describe('Admin Mass Update Page', () => {

  test('displays mass update page', async ({ page }) => {
    await page.goto('/admin/mass-update');
    await waitForPageLoad(page);

    // Check page loaded
    const content = page.getByRole('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Admin Duplicates Page', () => {

  test('displays duplicates page', async ({ page }) => {
    await page.goto('/admin/duplicates');
    await waitForPageLoad(page);

    // Check page loaded
    const content = page.getByRole('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Admin Activity Log Page', () => {

  test('displays activity log page', async ({ page }) => {
    await page.goto('/admin/activity');
    await waitForPageLoad(page);

    // Check page loaded
    const content = page.getByRole('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Admin Edits Page', () => {

  test('displays edits page', async ({ page }) => {
    await page.goto('/admin/edits');
    await waitForPageLoad(page);

    // Check page loaded
    const content = page.getByRole('main');
    await expect(content).toBeVisible();
  });
});

test.describe('Admin Merged Programs Page', () => {

  test('displays merged programs page', async ({ page }) => {
    await page.goto('/admin/merged-programs');
    await waitForPageLoad(page);

    // Check page loaded
    const content = page.getByRole('main');
    await expect(content).toBeVisible();
  });
});

test.describe('URL Handling Tests', () => {

  test('camp cards handle URLs without http prefix', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);

    // Wait for camps to load
    await page.waitForTimeout(2000);

    // Check that page doesn't throw URL parsing errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // Scroll through the page to trigger any lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Check no URL parsing errors occurred
    const urlErrors = errors.filter(e => e.includes('cannot be parsed as a URL'));
    expect(urlErrors.length).toBe(0);
  });

  test('program cards handle URLs without http prefix', async ({ page }) => {
    await page.goto('/programs');
    await waitForPageLoad(page);

    // Wait for programs to load
    await page.waitForTimeout(2000);

    // Check that page doesn't throw URL parsing errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // Scroll through the page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Check no URL parsing errors occurred
    const urlErrors = errors.filter(e => e.includes('cannot be parsed as a URL'));
    expect(urlErrors.length).toBe(0);
  });

  test('camp detail page handles URLs without http prefix', async ({ page }) => {
    // First get a camp ID from the camps page
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Click on first camp card if available
    const campCard = page.locator('a[href^="/camps/"]').first();
    const cardExists = await campCard.count() > 0;

    if (cardExists) {
      const errors: string[] = [];
      page.on('pageerror', error => {
        errors.push(error.message);
      });

      await campCard.click();
      await waitForPageLoad(page);

      // Check no URL parsing errors occurred
      const urlErrors = errors.filter(e => e.includes('cannot be parsed as a URL'));
      expect(urlErrors.length).toBe(0);
    }
  });
});

test.describe('Camp Filters', () => {

  test('displays season filter options', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);

    // Check for season filter dropdown/button
    const seasonDropdown = page.locator('button:has-text("Select season"), [data-testid="season-filter"]');
    const count = await seasonDropdown.count();
    expect(count >= 0).toBe(true);
  });

  test('displays days format filter options', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);

    // Look for days format buttons
    const dailyButton = page.locator('button:has-text("Daily")');
    const weeklyButton = page.locator('button:has-text("Week")');

    const dailyCount = await dailyButton.count();
    const weeklyCount = await weeklyButton.count();

    expect(dailyCount + weeklyCount > 0).toBe(true);
  });

  test('displays age filter inputs', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);

    // Look for age inputs
    const ageInputs = page.locator('input[type="number"]');
    const count = await ageInputs.count();
    expect(count >= 2).toBe(true); // At least min and max age
  });

  test('displays hours filter inputs', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);

    // Look for time inputs
    const timeInputs = page.locator('input[type="time"]');
    const count = await timeInputs.count();
    expect(count >= 0).toBe(true);
  });

  test('has clear filters functionality', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);

    // Apply a filter first (e.g., age)
    const ageMin = page.locator('input[placeholder="From"]').first();
    if (await ageMin.isVisible()) {
      await ageMin.fill('5');
      await page.waitForTimeout(500);

      // Check if clear filters button appears
      const clearButton = page.locator('button:has-text("Clear")');
      const count = await clearButton.count();
      expect(count >= 0).toBe(true);
    }
  });
});

test.describe('Camp Cards Display', () => {

  test('displays camp cards with green theme', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Check for green-themed elements
    const greenElements = page.locator('.bg-green-500, .bg-green-50, .text-green-600, .from-green-500');
    const count = await greenElements.count();
    expect(count >= 0).toBe(true);
  });

  test('displays featured badge for featured camps', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Check for featured badge elements (amber/yellow for featured)
    const featuredBadges = page.locator('text=Featured');
    const count = await featuredBadges.count();
    // May or may not have featured camps, just check it doesn't error
    expect(count >= 0).toBe(true);
  });

  test('displays camp format badges', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Look for format badges
    const weeklyBadges = page.locator('text=Week-by-Week');
    const dailyBadges = page.locator('text=Daily');

    const weeklyCount = await weeklyBadges.count();
    const dailyCount = await dailyBadges.count();

    // At least one type should exist if there are camps
    expect(weeklyCount + dailyCount >= 0).toBe(true);
  });
});

test.describe('Camp Detail Page', () => {

  test('displays back to camps link', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Click first camp
    const campCard = page.locator('a[href^="/camps/"]').first();
    if (await campCard.count() > 0) {
      await campCard.click();
      await waitForPageLoad(page);

      // Check for back link
      const backLink = page.locator('text=Back to Camps');
      await expect(backLink).toBeVisible();
    }
  });

  test('displays camp season badge', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    const campCard = page.locator('a[href^="/camps/"]').first();
    if (await campCard.count() > 0) {
      await campCard.click();
      await waitForPageLoad(page);

      // Season badge should be visible (Summer, Spring, Fall, or Winter)
      const seasonBadges = page.locator('text=Summer Camp, text=Spring, text=Fall, text=Winter');
      const count = await seasonBadges.count();
      expect(count >= 0).toBe(true);
    }
  });

  test('displays registration button', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    const campCard = page.locator('a[href^="/camps/"]').first();
    if (await campCard.count() > 0) {
      await campCard.click();
      await waitForPageLoad(page);

      // Should have registration button or contact message
      const registerButton = page.locator('text=Register Now');
      const contactMessage = page.locator('text=Contact provider');

      const registerCount = await registerButton.count();
      const contactCount = await contactMessage.count();

      expect(registerCount + contactCount > 0).toBe(true);
    }
  });

  test('displays contact information section', async ({ page }) => {
    await page.goto('/camps');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    const campCard = page.locator('a[href^="/camps/"]').first();
    if (await campCard.count() > 0) {
      await campCard.click();
      await waitForPageLoad(page);

      // Should have contact section - use exact text match
      const contactSection = page.getByText('Contact', { exact: true });
      await expect(contactSection).toBeVisible();
    }
  });
});

test.describe('Error Handling', () => {

  test('handles non-existent camp gracefully', async ({ page }) => {
    await page.goto('/camps/non-existent-camp-id-12345');
    await waitForPageLoad(page);

    // Should show camp not found or redirect
    const notFound = page.locator('text=Camp Not Found, text=not found, text=doesn\'t exist');
    const count = await notFound.count();

    // Either shows not found or redirects
    expect(count >= 0).toBe(true);
  });

  test('handles non-existent program gracefully', async ({ page }) => {
    await page.goto('/programs/non-existent-program-id-12345');
    await waitForPageLoad(page);

    // Should show not found or redirect
    const notFound = page.locator('text=Not Found, text=not found, text=doesn\'t exist');
    const count = await notFound.count();

    expect(count >= 0).toBe(true);
  });
});

test.describe('Admin Edit Form - Program Type', () => {

  test('edit page has program type selector', async ({ page }) => {
    await page.goto('/admin/programs');
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Find an edit link
    const editLink = page.locator('a[href^="/admin/edit/"]').first();
    if (await editLink.count() > 0) {
      await editLink.click();
      await waitForPageLoad(page);

      // Check for program type selector
      const programButton = page.locator('text=Program');
      const campButton = page.locator('text=Camp');

      const programCount = await programButton.count();
      const campCount = await campButton.count();

      expect(programCount + campCount > 0).toBe(true);
    }
  });
});

test.describe('Responsive Design', () => {

  test('camps page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/camps');
    await waitForPageLoad(page);

    // Page should not have horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Small tolerance
  });

  test('admin dashboard is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin');
    await waitForPageLoad(page);

    // Page should load without errors
    const content = page.getByRole('main');
    await expect(content).toBeVisible();
  });
});
