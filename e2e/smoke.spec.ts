import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the console production build.
 *
 * These tests run against `vite preview` (the same artefact deployed to Vercel)
 * and are designed to catch **blank-page** regressions caused by:
 *   - Broken imports or missing modules in the production bundle
 *   - Missing polyfills (e.g. `process`, `crypto`)
 *   - Uncaught JavaScript exceptions during bootstrap
 *   - Failed network requests for critical assets (JS/CSS bundles)
 *   - React failing to mount into #root
 */

/** Wait for React to mount (at least one child inside #root). */
async function waitForReactMount(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => (document.getElementById('root')?.children.length ?? 0) > 0,
    { timeout: 30_000 },
  );
}

test.describe('Console App – Smoke', () => {
  test('should load the page without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await waitForReactMount(page);

    // The page must not have thrown any uncaught exceptions
    expect(errors, 'Uncaught JS errors during page load').toEqual([]);
  });

  test('should render React content inside #root', async ({ page }) => {
    await page.goto('/');
    await waitForReactMount(page);

    // #root must exist and have child elements (React mounted successfully)
    const root = page.locator('#root');
    await expect(root).toBeAttached();
    const childCount = await root.evaluate((el) => el.children.length);
    expect(childCount, '#root has no children – blank page detected').toBeGreaterThan(0);
  });

  test('should not show a blank page (meaningful text rendered)', async ({ page }) => {
    await page.goto('/');
    await waitForReactMount(page);

    // The visible page text must not be empty
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length, 'Page body has no visible text').toBeGreaterThan(0);
  });

  test('should load all JavaScript bundles without 404s', async ({ page }) => {
    const failedAssets: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (
        (url.endsWith('.js') || url.endsWith('.css')) &&
        response.status() >= 400
      ) {
        failedAssets.push(`${response.status()} ${url}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(failedAssets, 'Critical assets returned HTTP errors').toEqual([]);
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ObjectStack|ObjectUI|Console/i);
  });

  test('should show the app shell or loading screen', async ({ page }) => {
    await page.goto('/');

    // Either the app shell (nav / sidebar) or the loading screen should appear
    // within a reasonable time. Both are acceptable initial states.
    const appShell = page.locator('nav').first();
    const loadingScreen = page.getByText(/Initializing|Loading|Connecting/i).first();

    await expect(
      appShell.or(loadingScreen),
    ).toBeVisible({ timeout: 30_000 });
  });
});
