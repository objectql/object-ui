import { test, expect } from '@playwright/test';

/**
 * Smoke test to verify the console app loads correctly.
 * This is a foundational E2E test that validates the basic app shell.
 */
test.describe('Console App', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to render
    await page.waitForLoadState('networkidle');
    // The page should have rendered something (not blank)
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  test('should display the navigation sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // The app shell should contain a navigation area
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });
});
