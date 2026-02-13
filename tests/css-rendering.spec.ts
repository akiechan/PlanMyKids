import { test, expect } from '@playwright/test';

/**
 * Test Suite: CSS Rendering
 *
 * Verifies that CSS and Tailwind styles are properly loaded and applied.
 */

test.describe('CSS Loading', () => {

  test('stylesheets are loaded on homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for network to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check that stylesheets are present in the document
    const stylesheets = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      const styles = document.querySelectorAll('style');
      return {
        linkCount: links.length,
        styleCount: styles.length,
        hasStyles: links.length > 0 || styles.length > 0,
        linkHrefs: Array.from(links).map(l => (l as HTMLLinkElement).href)
      };
    });

    console.log('Stylesheets found:', stylesheets);
    expect(stylesheets.hasStyles).toBe(true);
  });

  test('CSS files are accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all CSS file URLs
    const cssUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.map(link => (link as HTMLLinkElement).href);
    });

    console.log('CSS URLs:', cssUrls);

    // Verify at least one CSS file exists
    expect(cssUrls.length).toBeGreaterThan(0);

    // Try to fetch the first CSS file
    if (cssUrls.length > 0) {
      const response = await page.request.get(cssUrls[0]);
      expect(response.status()).toBe(200);
    }
  });
});

test.describe('Tailwind CSS Applied', () => {

  test('body has styles applied after full load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Extended wait

    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        fontFamily: computed.fontFamily,
        backgroundColor: computed.backgroundColor,
        margin: computed.margin,
        padding: computed.padding
      };
    });

    console.log('Body styles:', bodyStyles);

    // Body should have some font applied
    expect(bodyStyles.fontFamily).toBeTruthy();
  });

  test('navigation element exists and has styles', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const navStyles = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return null;

      const computed = window.getComputedStyle(nav);
      return {
        display: computed.display,
        backgroundColor: computed.backgroundColor,
        position: computed.position,
        className: nav.className
      };
    });

    console.log('Nav styles:', navStyles);

    expect(navStyles).not.toBeNull();
  });

  test('h1 heading is visible and styled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    const h1Styles = await h1.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        color: computed.color,
        className: el.className
      };
    });

    console.log('H1 styles:', h1Styles);

    // H1 should have bold weight
    expect(parseInt(h1Styles.fontWeight)).toBeGreaterThanOrEqual(700);
  });
});

test.describe('Page Content Renders', () => {

  test('homepage renders main content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check main elements exist
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Find the Perfect Program');

    // Check nav exists
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check search input exists
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('page has visual content (screenshot test)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Take a screenshot to verify visual rendering
    const screenshot = await page.screenshot();

    // Screenshot should have content (not blank)
    expect(screenshot.length).toBeGreaterThan(10000); // Should be more than 10KB
  });

  test('CSS classes are present in HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that Tailwind classes exist in the HTML
    const hasTailwindClasses = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      return {
        hasFlex: html.includes('flex'),
        hasGrid: html.includes('grid'),
        hasPadding: html.includes('px-') || html.includes('py-') || html.includes('p-'),
        hasMaxWidth: html.includes('max-w'),
        hasBg: html.includes('bg-'),
        hasText: html.includes('text-'),
        hasRounded: html.includes('rounded'),
        hasShadow: html.includes('shadow')
      };
    });

    console.log('Tailwind classes present:', hasTailwindClasses);

    expect(hasTailwindClasses.hasFlex).toBe(true);
    expect(hasTailwindClasses.hasBg).toBe(true);
  });
});

test.describe('CSS Debug Info', () => {

  test('collect all CSS debug information', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const debugInfo = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const nav = document.querySelector('nav');
      const main = document.querySelector('main');

      const getStyles = (el: Element | null) => {
        if (!el) return null;
        const computed = window.getComputedStyle(el);
        return {
          display: computed.display,
          backgroundColor: computed.backgroundColor,
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          color: computed.color
        };
      };

      return {
        stylesheetCount: document.querySelectorAll('link[rel="stylesheet"]').length,
        styleTagCount: document.querySelectorAll('style').length,
        htmlClass: html.className,
        bodyClass: body.className,
        navClass: nav?.className || 'not found',
        mainClass: main?.className || 'not found',
        htmlStyles: getStyles(html),
        bodyStyles: getStyles(body),
        navStyles: getStyles(nav),
        mainStyles: getStyles(main),
        documentReady: document.readyState
      };
    });

    console.log('=== CSS DEBUG INFO ===');
    console.log(JSON.stringify(debugInfo, null, 2));

    // Just verify we can collect this info
    expect(debugInfo.documentReady).toBe('complete');
  });
});
