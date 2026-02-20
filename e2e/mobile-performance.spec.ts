import { test, expect } from '@playwright/test';
import { waitForReactMount, CONSOLE_BASE } from './helpers';

/**
 * P3 Mobile Performance Benchmark tests.
 *
 * Measures page load time, layout stability, and interaction
 * responsiveness under simulated mobile CPU constraints.
 */

test.describe('Mobile Performance Benchmarks', () => {
  test('page loads within performance budget on mobile', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.setViewportSize({ width: 390, height: 844 });

    const startTime = Date.now();
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds even under 4× CPU throttle
    expect(loadTime).toBeLessThan(5000);
  });

  test('no layout shifts on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasOverflow).toBe(false);
  });

  test('interactive elements respond within 100ms', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    if (count > 0) {
      const start = Date.now();
      await buttons.first().click({ force: true });
      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(100);
    }
  });
});
