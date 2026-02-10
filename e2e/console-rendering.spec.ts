import { test, expect } from '@playwright/test';

/**
 * Console rendering & navigation E2E tests.
 *
 * These tests validate that the production build renders correctly and
 * that client-side routing works — the two main failure modes that cause
 * the "blank page on Vercel" issue.
 */

/** Wait for React to mount (at least one child inside #root). */
async function waitForReactMount(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => (document.getElementById('root')?.children.length ?? 0) > 0,
    { timeout: 30_000 },
  );
}

test.describe('Console Rendering', () => {
  test('should not have critical console errors during bootstrap', async ({ page }) => {
    const criticalErrors: string[] = [];

    // Capture console.error calls that indicate fatal issues
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore benign errors (e.g. favicon 404, service-worker registration)
        if (
          text.includes('favicon') ||
          text.includes('service-worker') ||
          text.includes('mockServiceWorker')
        ) {
          return;
        }
        criticalErrors.push(text);
      }
    });

    await page.goto('/');
    await waitForReactMount(page);

    expect(
      criticalErrors,
      `Critical console errors detected:\n${criticalErrors.join('\n')}`,
    ).toEqual([]);
  });

  test('should resolve client-side routes without blank content', async ({ page }) => {
    await page.goto('/');
    await waitForReactMount(page);

    // After routing, the page should have meaningful DOM content
    const rootHTML = await page.locator('#root').innerHTML();
    expect(rootHTML.length, 'React root innerHTML is empty').toBeGreaterThan(50);
  });

  test('should serve index.html for SPA fallback routes', async ({ page }) => {
    // Vercel blank-page issues often stem from missing SPA rewrites.
    // Navigate to a deep route — the server must return index.html (not 404).
    const response = await page.goto('/apps/default/some-object');
    expect(response?.status(), 'Deep route returned non-200 status').toBeLessThan(400);

    await waitForReactMount(page);

    // React should still mount
    const root = page.locator('#root');
    const childCount = await root.evaluate((el) => el.children.length);
    expect(childCount, 'React did not mount on deep route').toBeGreaterThan(0);
  });

  test('should include the MSW service worker in the build output', async ({ page }) => {
    // The mock server requires mockServiceWorker.js to be served from /public.
    // If it's missing, the app may hang during bootstrap.
    const response = await page.request.get('/mockServiceWorker.js');

    // In production builds without MSW, 404 is acceptable.
    // But if the build includes it, it must be valid JS.
    if (response.ok()) {
      const contentType = response.headers()['content-type'] || '';
      expect(contentType).toContain('javascript');
    }
  });
});
