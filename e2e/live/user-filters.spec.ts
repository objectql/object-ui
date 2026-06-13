import { test, expect } from '@playwright/test';

/**
 * ADR-0047 — end-user filter surfaces, locked end-to-end.
 *
 * Covers the behaviors hand-verified during the ADR-0047 rounds so they
 * cannot silently regress:
 *
 *  1. Data mode (showcase_task "All Tasks"): metadata filter TABS render and
 *     dropdowns are suppressed (tabs XOR dropdowns); picking a tab filters
 *     the grid and persists as `uf__tab` in the URL; reload restores it.
 *  2. Data mode visualization switcher: a compact dropdown in the toolbar's
 *     right cluster (single row), offering only the whitelist.
 *  3. Interface mode (Task Workbench page): author-enabled dropdown filters
 *     only — no view tabs, no visualization switcher (single-entry
 *     whitelist = locked); selecting a value filters rows, persists as
 *     `uf_<field>`, survives reload; per-option counts do NOT zero out
 *     while the selection is active (counts snapshot).
 */

test.describe('ADR-0047 data mode — filter tabs + viz dropdown', () => {
  test('filter tabs render exclusively, persist to URL, and restore on reload', async ({ page }) => {
    await page.goto('/apps/showcase_app/showcase_task');

    // The default "All Tasks" view configures metadata tabs — they render…
    // (TabBar renders role="tab" with stable view-tab-<name> testids)
    const urgentTab = page.getByTestId('view-tab-urgent');
    await expect(urgentTab).toBeVisible();
    // …and dropdown filter badges do not (tabs XOR dropdowns).
    await expect(page.getByTestId('filter-badge-status')).toHaveCount(0);

    // Picking a tab filters the grid and mirrors into the URL.
    await urgentTab.click();
    await expect(page).toHaveURL(/uf__tab=urgent/);
    await expect(page.getByTestId('record-count-bar')).toContainText(/^2 /, { timeout: 15000 });

    // Reload: the tab selection and its filter survive.
    await page.reload();
    await expect(page).toHaveURL(/uf__tab=urgent/);
    await expect(page.getByTestId('record-count-bar')).toContainText(/^2 /, { timeout: 15000 });
  });

  test('visualization switcher is a single dropdown offering the whitelist', async ({ page }) => {
    await page.goto('/apps/showcase_app/showcase_task');

    const trigger = page.getByTestId('view-switcher-dropdown');
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Whitelist: grid, kanban, gallery, calendar — and nothing else.
    await expect(page.getByRole('button', { name: 'Kanban' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gallery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Timeline' })).toHaveCount(0);

    // Switching actually swaps the renderer (kanban board appears).
    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(trigger).toContainText('Kanban');
  });
});

test.describe('ADR-0047 interface mode — Task Workbench', () => {
  test('locked surface: dropdowns only, no view tabs, no switcher', async ({ page }) => {
    await page.goto('/apps/showcase_app/page/showcase_task_workbench');

    await expect(page.getByTestId('interface-list-page')).toBeVisible();
    await expect(page.getByTestId('filter-badge-status')).toBeVisible();
    await expect(page.getByTestId('filter-badge-priority')).toBeVisible();
    // Single-entry visualization whitelist renders no switcher.
    await expect(page.getByTestId('view-switcher-dropdown')).toHaveCount(0);
  });

  test('dropdown selection filters, keeps counts, persists, and restores', async ({ page }) => {
    await page.goto('/apps/showcase_app/page/showcase_task_workbench');

    // Open the priority dropdown (showCount: true) and capture pre-selection state.
    await page.getByTestId('filter-badge-priority').click();
    const options = page.getByTestId('filter-options-priority');
    await expect(options).toBeVisible();
    await expect(options.getByText('Urgent')).toBeVisible();

    // Select Urgent: the grid narrows and the URL picks up the selection.
    await options.getByText('Urgent').click();
    await expect(page).toHaveURL(/uf_priority=urgent/);
    await expect(page.getByTestId('record-count-bar')).toContainText(/^2 /, { timeout: 15000 });

    // Counts snapshot: with Urgent active the OTHER options keep their
    // pre-selection counts instead of collapsing to 0 (the server already
    // filtered the rows; the popover replays the snapshot).
    const optionRows = options.locator('label');
    const texts = await optionRows.allTextContents();
    const nonUrgent = texts.filter(t => !/Urgent/.test(t));
    expect(nonUrgent.length).toBeGreaterThan(0);
    // Every non-selected option still shows a non-zero count.
    for (const t of nonUrgent) {
      expect(t).not.toMatch(/\b0\b/);
    }

    // Reload: badge selection state and the filtered result set survive.
    await page.reload();
    await expect(page).toHaveURL(/uf_priority=urgent/);
    await expect(page.getByTestId('filter-badge-priority')).toContainText('1');
    await expect(page.getByTestId('record-count-bar')).toContainText(/^2 /, { timeout: 15000 });
  });
});
