import { test, expect } from '@playwright/test';
import { registerAndLogin } from './helpers/auth';

/** Timeout for sidebar elements to become visible after auth + page render. */
const SIDEBAR_VISIBLE_TIMEOUT = 15_000;

/**
 * Sidebar text visibility tests
 *
 * These tests validate that the application sidebar displays text correctly
 * when toggled between collapsed (icon mode) and expanded states.
 *
 * The Home page (`/home`) deliberately uses a top navigation bar instead
 * of a left sidebar, so these tests navigate into an application first by
 * clicking the first app card. Client-side navigation (no full reload) is
 * used to preserve the MSW-backed mock auth session.
 *
 * The MSW mock environment requires authentication, so each test
 * registers a fresh user before entering the application.
 */

/**
 * Register, land on /home, then enter the first available application so
 * that the `UnifiedSidebar` is rendered. Uses client-side navigation via
 * an app-card click to avoid dropping the MSW auth cookie.
 */
async function enterFirstApp(page: import('@playwright/test').Page) {
  await registerAndLogin(page);

  // Home renders app cards as data-testid="app-card-<name>". Click the first
  // card via client-side routing — page.goto() would reload and drop the
  // mock auth session.
  const firstAppCard = page.locator('[data-testid^="app-card-"]').first();
  await firstAppCard.waitFor({ state: 'visible', timeout: SIDEBAR_VISIBLE_TIMEOUT });
  await firstAppCard.click();

  // Wait for the app route to load.
  await page.waitForURL(/\/console\/apps\//, { timeout: SIDEBAR_VISIBLE_TIMEOUT });
}

test.describe('Sidebar Text Visibility', () => {
  test('should show all text labels when sidebar is expanded in icon mode', async ({ page }) => {
    await enterFirstApp(page);

    // Wait for sidebar to be visible (page needs time to render after auth redirect)
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: SIDEBAR_VISIBLE_TIMEOUT });

    // Find the sidebar toggle button (desktop trigger rendered by AppShell)
    const toggleButton = page.locator('[data-sidebar="trigger"]').first();
    await expect(toggleButton).toBeVisible({ timeout: SIDEBAR_VISIBLE_TIMEOUT });

    // Get the parent sidebar element that has data-state attribute
    const sidebarGroup = page.locator('.group[data-collapsible="icon"]').first();

    // First, collapse the sidebar if it's expanded
    let currentState = await sidebarGroup.getAttribute('data-state');
    if (currentState === 'expanded') {
      await toggleButton.click();
      await page.waitForTimeout(300); // Wait for animation
      currentState = await sidebarGroup.getAttribute('data-state');
      expect(currentState).toBe('collapsed');
    }

    // Now expand the sidebar
    await toggleButton.click();
    await page.waitForTimeout(300); // Wait for animation

    // Verify sidebar is expanded
    currentState = await sidebarGroup.getAttribute('data-state');
    expect(currentState).toBe('expanded');

    // Check that group labels are visible
    const groupLabels = page.locator('[data-sidebar="group-label"]');
    const labelCount = await groupLabels.count();

    if (labelCount > 0) {
      for (let i = 0; i < labelCount; i++) {
        const label = groupLabels.nth(i);

        // Check opacity
        const opacity = await label.evaluate((el) => {
          return window.getComputedStyle(el).opacity;
        });
        expect(parseFloat(opacity), `Group label ${i} should be fully visible (opacity: 1)`).toBe(1);

        // Check display
        const display = await label.evaluate((el) => {
          return window.getComputedStyle(el).display;
        });
        expect(display, `Group label ${i} should not be hidden`).not.toBe('none');
      }
    }

    // Check that menu button text is visible
    const menuButtons = page.locator('[data-sidebar="menu-button"]');
    const buttonCount = await menuButtons.count();

    if (buttonCount > 0) {
      for (let i = 0; i < buttonCount; i++) {
        const button = menuButtons.nth(i);

        // Check that button has proper width (not constrained to icon size)
        const width = await button.evaluate((el) => {
          return window.getComputedStyle(el).width;
        });

        // In expanded mode, button should not be constrained to 2rem (32px)
        const widthPx = parseFloat(width);
        expect(widthPx, `Menu button ${i} should be wider than icon size (${widthPx}px)`).toBeGreaterThan(32);
      }
    }

    // Take a screenshot for visual verification
    await page.screenshot({
      path: '/tmp/sidebar-expanded.png',
      fullPage: false
    });

    console.log(`Found ${labelCount} group labels and ${buttonCount} menu buttons`);
  });

  test('should hide text labels when sidebar is collapsed in icon mode', async ({ page }) => {
    await enterFirstApp(page);

    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: SIDEBAR_VISIBLE_TIMEOUT });

    const toggleButton = page.locator('[data-sidebar="trigger"]').first();
    await expect(toggleButton).toBeVisible({ timeout: SIDEBAR_VISIBLE_TIMEOUT });

    const sidebarGroup = page.locator('.group[data-collapsible="icon"]').first();

    // Expand first if needed
    let currentState = await sidebarGroup.getAttribute('data-state');
    if (currentState === 'collapsed') {
      await toggleButton.click();
      await page.waitForTimeout(300);
    }

    // Now collapse
    await toggleButton.click();
    await page.waitForTimeout(300);

    currentState = await sidebarGroup.getAttribute('data-state');
    expect(currentState).toBe('collapsed');

    // Check that group labels are hidden
    const groupLabels = page.locator('[data-sidebar="group-label"]');
    const labelCount = await groupLabels.count();

    if (labelCount > 0) {
      for (let i = 0; i < labelCount; i++) {
        const label = groupLabels.nth(i);

        const opacity = await label.evaluate((el) => {
          return window.getComputedStyle(el).opacity;
        });
        expect(parseFloat(opacity), `Group label ${i} should be hidden (opacity: 0) when collapsed`).toBe(0);
      }
    }

    // Take a screenshot
    await page.screenshot({
      path: '/tmp/sidebar-collapsed.png',
      fullPage: false
    });
  });
});
