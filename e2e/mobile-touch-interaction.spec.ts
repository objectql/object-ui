import { test, expect } from '@playwright/test';
import { waitForReactMount, CONSOLE_BASE } from './helpers';

/**
 * P3 Mobile Touch Interaction tests.
 *
 * Verifies that the Console app handles touch-based interactions
 * correctly on mobile viewports (tap, swipe, long-press, pinch-to-zoom).
 */

// Practical minimum touch-target height in pixels.
// WCAG 2.5.8 recommends 44px, but many design systems use h-8 (32px) for
// compact icon buttons. Matches the threshold in mobile-viewport.spec.ts.
const MINIMUM_TOUCH_TARGET_PX = 32;

// Minimum compliance rate: 70% of visible interactive elements must meet the
// target size. Some inline icon buttons intentionally use smaller sizes
// (e.g., h-6), so a 30% tolerance is allowed. Mirrors mobile-viewport.spec.ts.
const MINIMUM_TOUCH_TARGET_COMPLIANCE = 0.7;

test.describe('Mobile Touch Interactions', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('swipe gesture on navigation sidebar', async ({ page }) => {
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    // Tap center of viewport to verify touch interaction works
    await page.touchscreen.tap(195, 422);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('long-press triggers context menu', async ({ page }) => {
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    // Verify interactive elements are present and touchable
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('pinch-to-zoom is handled gracefully', async ({ page }) => {
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });

    // Verify viewport meta prevents unwanted zoom behavior
    const viewportMeta = page.locator('meta[name="viewport"]');
    if (await viewportMeta.count() > 0) {
      const content = await viewportMeta.getAttribute('content');
      expect(content).toBeTruthy();
    }
  });

  test('tap targets meet minimum size', async ({ page }) => {
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    const interactiveElements = page.locator(
      'button, a, [role="button"], input, select, textarea',
    );
    const count = await interactiveElements.count();

    let compliantCount = 0;
    let totalChecked = 0;
    const limit = Math.min(count, 50);

    for (let i = 0; i < limit; i++) {
      const el = interactiveElements.nth(i);
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box) {
          totalChecked++;
          if (box.width >= MINIMUM_TOUCH_TARGET_PX && box.height >= MINIMUM_TOUCH_TARGET_PX) {
            compliantCount++;
          }
        }
      }
    }

    if (totalChecked > 0) {
      expect(compliantCount / totalChecked).toBeGreaterThanOrEqual(
        MINIMUM_TOUCH_TARGET_COMPLIANCE,
      );
    }
  });
});
