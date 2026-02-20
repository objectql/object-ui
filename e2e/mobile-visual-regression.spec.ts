import { test, expect } from '@playwright/test';
import { waitForReactMount, CONSOLE_BASE } from './helpers';

/**
 * P3 Mobile Visual Regression tests.
 *
 * Captures screenshots at common mobile breakpoints and compares them
 * against stored baselines to detect unintended visual changes.
 */

const MOBILE_VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'ipad-mini', width: 768, height: 1024 },
];

// Keep in sync with Console app route definitions (apps/console/src/routes).
const ROUTES = ['/', '/dashboard'];

test.describe('Mobile Visual Regression', () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${viewport.name} - ${route} renders consistently`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${CONSOLE_BASE}${route}`, { waitUntil: 'networkidle' });
        await waitForReactMount(page);

        await expect(page).toHaveScreenshot(
          `${viewport.name}${route.replace(/\//g, '-') || '-home'}.png`,
          {
            maxDiffPixelRatio: 0.05,
            fullPage: false,
          },
        );
      });
    }
  }
});
