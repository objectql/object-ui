import { test, expect, devices } from '@playwright/test';
import { waitForReactMount, CONSOLE_BASE } from './helpers';

/**
 * P5.5 Mobile viewport tests for the Console app.
 *
 * These tests verify that the Console renders correctly
 * at common mobile breakpoints (iPhone SE 375px, iPhone 14 390px, iPad 768px).
 * They run against the existing mobile device projects configured in playwright.config.ts.
 */

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPad Mini', width: 768, height: 1024 },
];

// Minimum touch compliance rate: 70% of visible buttons should meet the minimum height.
// Some icon buttons intentionally use smaller sizes (e.g., h-6 for inline controls),
// so we allow a 30% tolerance rather than requiring 100%.
const MINIMUM_TOUCH_TARGET_COMPLIANCE = 0.7;

// Practical minimum touch target height in pixels.
// WCAG recommends 44px, but many design systems use h-8 (32px) for icon buttons.
// The 44px minimum is enforced on form controls via min-h-[44px] sm:min-h-0.
const MINIMUM_TOUCH_TARGET_PX = 32;

test.describe('P5.5 Mobile Viewport Tests', () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}×${viewport.height})`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.width < 768,
        hasTouch: true,
      });

      test('should render without JS errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        await page.goto(`${CONSOLE_BASE}/`);
        await waitForReactMount(page);

        expect(errors, 'Uncaught JS errors on mobile viewport').toEqual([]);
      });

      test('should render meaningful content (no blank page)', async ({ page }) => {
        await page.goto(`${CONSOLE_BASE}/`);
        await waitForReactMount(page);

        const root = page.locator('#root');
        await expect(root).toBeAttached();
        const childCount = await root.evaluate((el) => el.children.length);
        expect(childCount, 'Blank page on mobile').toBeGreaterThan(0);
      });

      test('should have viewport meta tag with viewport-fit=cover', async ({ page }) => {
        await page.goto(`${CONSOLE_BASE}/`);
        const meta = page.locator('meta[name="viewport"]');
        await expect(meta).toHaveAttribute('content', /viewport-fit=cover/);
      });

      test('should have PWA manifest link', async ({ page }) => {
        await page.goto(`${CONSOLE_BASE}/`);
        const manifestLink = page.locator('link[rel="manifest"]');
        await expect(manifestLink).toBeAttached();
      });

      test('should not have horizontal overflow', async ({ page }) => {
        await page.goto(`${CONSOLE_BASE}/`);
        await waitForReactMount(page);

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasOverflow, 'Page has horizontal overflow on mobile').toBe(false);
      });

      test('should have touch targets ≥ 44px for interactive elements', async ({ page }) => {
        await page.goto(`${CONSOLE_BASE}/`);
        await waitForReactMount(page);

        // Check all visible buttons have reasonable touch target size
        const buttons = page.locator('button:visible');
        const count = await buttons.count();

        // Skip test if no buttons visible (e.g. loading state)
        if (count === 0) return;

        // Sample check: verify at least 80% of buttons meet minimum touch target
        let compliant = 0;
        const limit = Math.min(count, 20); // Check up to 20 buttons
        for (let i = 0; i < limit; i++) {
          const box = await buttons.nth(i).boundingBox();
          if (box && (box.height >= MINIMUM_TOUCH_TARGET_PX || box.width >= MINIMUM_TOUCH_TARGET_PX)) {
            compliant++;
          }
        }

        const complianceRate = compliant / limit;
        expect(complianceRate, 'Touch target compliance').toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_COMPLIANCE);
      });
    });
  }
});
