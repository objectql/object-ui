import { test, expect } from '@playwright/test';
import { waitForReactMount, CONSOLE_BASE } from './helpers';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * P3 Mobile Visual Regression tests.
 *
 * Captures screenshots at common mobile breakpoints and compares them
 * against stored baselines to detect unintended visual changes.
 *
 * These tests are skipped when baseline snapshots have not been generated yet.
 * To generate baselines, run: pnpm test:e2e --update-snapshots
 */

const MOBILE_VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'ipad-mini', width: 768, height: 1024 },
];

// Keep in sync with Console app route definitions (apps/console/src/routes).
const ROUTES = ['/', '/dashboard'];

const snapshotsDir = join(dirname(fileURLToPath(import.meta.url)), 'mobile-visual-regression.spec.ts-snapshots');
const hasBaselines = existsSync(snapshotsDir);

test.describe('Mobile Visual Regression', () => {
  // Skip the entire suite when baselines have not been generated yet
  test.skip(!hasBaselines, 'No baseline snapshots found – run with --update-snapshots first');

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
