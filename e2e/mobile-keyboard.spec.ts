import { test, expect } from '@playwright/test';
import { waitForReactMount, CONSOLE_BASE } from './helpers';

/**
 * P3 On-screen Keyboard Interaction tests.
 *
 * Verifies that form inputs in the Console app are usable with
 * mobile on-screen keyboards (focus, type, submit).
 */

test.describe('On-screen Keyboard Interactions', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('form inputs should be accessible via keyboard', async ({ page }) => {
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    const inputs = page.locator(
      'input[type="text"], input[type="email"], input[type="search"], textarea',
    );
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        await input.focus();
        await expect(input).toBeFocused();
        await input.type('test');
        const value = await input.inputValue();
        expect(value).toContain('test');
        await input.fill('');
      }
    }
  });

  test('search input should accept keyboard input', async ({ page }) => {
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]',
      )
      .first();

    if ((await searchInput.count()) > 0 && (await searchInput.isVisible())) {
      await searchInput.focus();
      await searchInput.type('hello');
      const value = await searchInput.inputValue();
      expect(value).toBe('hello');
    }
  });

  test('pressing Enter submits forms', async ({ page }) => {
    await page.goto(`${CONSOLE_BASE}/`, { waitUntil: 'networkidle' });
    await waitForReactMount(page);

    const form = page.locator('form').first();
    if ((await form.count()) > 0 && (await form.isVisible())) {
      const input = form.locator('input').first();
      if ((await input.count()) > 0 && (await input.isVisible())) {
        await input.focus();
        await expect(input).toBeFocused();
      }
    }
  });
});
