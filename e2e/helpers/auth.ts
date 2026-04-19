import type { Page } from '@playwright/test';
import { CONSOLE_BASE } from './index';

/** Shared timeout for waiting on React rendering and MSW boot. */
const REACT_READY_TIMEOUT = 30_000;

/**
 * Register a new test user and wait for redirect to the home page.
 *
 * MSW auth handlers run in-memory, so each browser context starts
 * without a session.  This helper creates a fresh user via the
 * register form so that subsequent navigation hits authenticated
 * routes.
 *
 * Note: The home page uses a top navigation bar (no left sidebar); the
 * `UnifiedSidebar` is only rendered inside `/apps/:appName/*` routes.
 */
export async function registerAndLogin(page: Page) {
  await page.goto(`${CONSOLE_BASE}/register`);

  // Wait for React to mount and the register form to render
  await page.waitForFunction(
    () => (document.getElementById('root')?.children.length ?? 0) > 0,
    { timeout: REACT_READY_TIMEOUT },
  );
  // Wait for the form inputs to be present (MSW boot + React render)
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15_000 });

  // Fill in the registration form
  const ts = Date.now();
  await page.locator('input[type="text"]').fill('E2E Test User');
  await page.locator('input[type="email"]').fill(`e2e-${ts}@test.local`);
  await page.locator('input[type="password"]').first().fill('Test1234!');
  await page.locator('input[type="password"]').nth(1).fill('Test1234!');

  // Submit and wait for navigation away from the register page
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/console\/(home|apps\/)/, { timeout: REACT_READY_TIMEOUT });
}
