import { test, expect } from '@playwright/test';
import { waitForReactMount, CONSOLE_BASE } from './helpers';

/**
 * Critical view workflow E2E tests.
 *
 * These tests validate end-to-end view rendering and navigation in the
 * console app's production build. They cover the primary SDUI view types
 * (Grid, Kanban, Calendar) and view-switching workflows.
 *
 * NOTE: All tests are skipped because they require the console app to be
 * running with seeded data (via `pnpm --filter @object-ui/console preview`).
 * In CI, the `webServer` config in playwright.config.ts handles startup.
 * Enable these tests once mock data is seeded during the build step.
 */

/** Base path for the default app — mirrors route: /apps/:appName/:objectName */
const APP_BASE = `${CONSOLE_BASE}/apps/default`;

/**
 * Waits for the app shell to be fully interactive (sidebar or main nav visible).
 * Extends `waitForReactMount` with an additional check for layout readiness.
 */
async function waitForAppShell(page: import('@playwright/test').Page) {
  await waitForReactMount(page);
  await expect(
    page.locator('nav').first().or(page.getByText(/Loading|Initializing/i).first()),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('View Workflows', () => {
  // -----------------------------------------------------------------
  // All tests are skipped: they require the console to be running with
  // seeded object definitions and mock data. Remove `.skip` once CI
  // seeds the data source (e.g. via MSW or a fixtures endpoint).
  // -----------------------------------------------------------------

  test.describe('Grid View', () => {
    test.skip('should render a data table with column headers', async ({ page }) => {
      // Navigate to an object list — defaults to the first (grid) view
      await page.goto(`${APP_BASE}/project_task`);
      await waitForAppShell(page);

      // Grid view renders a <table> (or role="table" / role="grid")
      const table = page.locator('table').first().or(page.getByRole('table').first());
      await expect(table).toBeVisible({ timeout: 15_000 });

      // At least one column header should be present
      const headers = page.locator('th, [role="columnheader"]');
      await expect(headers.first()).toBeVisible();
      expect(await headers.count()).toBeGreaterThan(0);
    });

    test.skip('should display rows when data is available', async ({ page }) => {
      await page.goto(`${APP_BASE}/project_task`);
      await waitForAppShell(page);

      // Wait for data rows to appear (tbody > tr, or role="row")
      const rows = page.locator('tbody tr, [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 15_000 });
      expect(await rows.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Grid → Detail Navigation', () => {
    test.skip('should navigate to detail view when clicking a grid row', async ({ page }) => {
      await page.goto(`${APP_BASE}/project_task`);
      await waitForAppShell(page);

      // Click the first data row in the grid
      const firstRow = page.locator('tbody tr, [role="row"]').first();
      await expect(firstRow).toBeVisible({ timeout: 15_000 });
      await firstRow.click();

      // Detail view opens — either via URL change or a sheet/drawer overlay.
      // Check for URL containing "record/" or a detail panel becoming visible.
      await expect(
        page.locator('[role="dialog"], [role="region"]').first(),
      ).toBeVisible({ timeout: 10_000 }).catch(() => {
        // Fallback: full-page navigation to /record/:id
        expect(page.url()).toContain('/record/');
      });

      // Detail view should display meaningful content
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(0);
    });

    test.skip('should navigate back to grid view from detail', async ({ page }) => {
      // Start on a record detail page directly
      await page.goto(`${APP_BASE}/project_task/record/1`);
      await waitForAppShell(page);

      // Find and click the back button
      const backButton = page
        .getByRole('button', { name: /back/i })
        .or(page.locator('[aria-label="Back"]'));
      await expect(backButton).toBeVisible({ timeout: 10_000 });
      await backButton.click();

      // Should return to the object list (grid view)
      await page.waitForURL(`**/${APP_BASE}/project_task**`, { timeout: 10_000 });

      // Grid table should be visible again
      const table = page.locator('table').first().or(page.getByRole('table').first());
      await expect(table).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Kanban View', () => {
    test.skip('should render kanban board with columns', async ({ page }) => {
      // Navigate to the kanban (board) view via the view route
      await page.goto(`${APP_BASE}/project_task/view/board`);
      await waitForAppShell(page);

      // Kanban board is a region with aria-label="Kanban board"
      const board = page.getByRole('region', { name: /kanban board/i });
      await expect(board).toBeVisible({ timeout: 15_000 });

      // Columns are groups within the board
      const columns = board.getByRole('group');
      await expect(columns.first()).toBeVisible();
      expect(await columns.count()).toBeGreaterThan(0);
    });

    test.skip('should render card lists inside kanban columns', async ({ page }) => {
      await page.goto(`${APP_BASE}/project_task/view/board`);
      await waitForAppShell(page);

      const board = page.getByRole('region', { name: /kanban board/i });
      await expect(board).toBeVisible({ timeout: 15_000 });

      // Each column should contain a list of cards
      const cardLists = board.getByRole('list');
      await expect(cardLists.first()).toBeVisible();
    });
  });

  test.describe('Calendar View', () => {
    test.skip('should render calendar month grid', async ({ page }) => {
      await page.goto(`${APP_BASE}/project_task/view/schedule`);
      await waitForAppShell(page);

      // Calendar region with accessible label
      const calendar = page.getByRole('region', { name: /calendar/i });
      await expect(calendar).toBeVisible({ timeout: 15_000 });

      // Month grid with day cells
      const grid = page.getByRole('grid', { name: /calendar grid/i });
      await expect(grid).toBeVisible();

      // Day column headers (Sun, Mon, …)
      const dayHeaders = page.getByRole('columnheader');
      expect(await dayHeaders.count()).toBe(7);
    });

    test.skip('should display navigation controls for periods', async ({ page }) => {
      await page.goto(`${APP_BASE}/project_task/view/schedule`);
      await waitForAppShell(page);

      const calendar = page.getByRole('region', { name: /calendar/i });
      await expect(calendar).toBeVisible({ timeout: 15_000 });

      // Navigation buttons: Today, Previous period, Next period
      await expect(page.getByRole('button', { name: /go to today/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /previous period/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /next period/i })).toBeVisible();
    });
  });

  test.describe('View Switching', () => {
    test.skip('should switch from grid to kanban and back', async ({ page }) => {
      // Start on the default grid view
      await page.goto(`${APP_BASE}/project_task`);
      await waitForAppShell(page);

      // Grid should be visible initially
      const table = page.locator('table').first().or(page.getByRole('table').first());
      await expect(table).toBeVisible({ timeout: 15_000 });

      // Click the "Board" view tab to switch to kanban
      const boardTab = page.getByRole('button', { name: /board/i }).or(page.getByText('Board'));
      await boardTab.click();

      // Kanban board should appear
      const board = page.getByRole('region', { name: /kanban board/i });
      await expect(board).toBeVisible({ timeout: 15_000 });

      // Click the "All Tasks" tab to switch back to grid
      const gridTab = page
        .getByRole('button', { name: /all tasks/i })
        .or(page.getByText('All Tasks'));
      await gridTab.click();

      // Grid should reappear
      await expect(table).toBeVisible({ timeout: 15_000 });
    });

    test.skip('should switch from grid to calendar view', async ({ page }) => {
      await page.goto(`${APP_BASE}/project_task`);
      await waitForAppShell(page);

      // Click the "Schedule" view tab for calendar
      const calendarTab = page
        .getByRole('button', { name: /schedule/i })
        .or(page.getByText('Schedule'));
      await calendarTab.click();

      // Calendar region should appear
      const calendar = page.getByRole('region', { name: /calendar/i });
      await expect(calendar).toBeVisible({ timeout: 15_000 });
    });

    test.skip('should preserve navigation context when switching views', async ({ page }) => {
      // Start on the grid view for a specific object
      await page.goto(`${APP_BASE}/project_task`);
      await waitForAppShell(page);

      // Switch to kanban
      const boardTab = page.getByRole('button', { name: /board/i }).or(page.getByText('Board'));
      await boardTab.click();
      await expect(
        page.getByRole('region', { name: /kanban board/i }),
      ).toBeVisible({ timeout: 15_000 });

      // URL should still reference the same object
      expect(page.url()).toContain('project_task');

      // Switch to calendar
      const calendarTab = page
        .getByRole('button', { name: /schedule/i })
        .or(page.getByText('Schedule'));
      await calendarTab.click();
      await expect(
        page.getByRole('region', { name: /calendar/i }),
      ).toBeVisible({ timeout: 15_000 });

      // URL should still reference the same object
      expect(page.url()).toContain('project_task');

      // Breadcrumbs or header should still show the object context
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).toMatch(/project[._\s]task/i);
    });
  });

  test.describe('Error Resilience', () => {
    test.skip('should not produce console errors during view transitions', async ({ page }) => {
      const criticalErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Ignore benign errors
          if (
            text.includes('favicon') ||
            text.includes('service-worker') ||
            text.includes('mockServiceWorker')
          ) {
            return;
          }
          criticalErrors.push(text);
        }
      });

      await page.goto(`${APP_BASE}/project_task`);
      await waitForAppShell(page);

      // Cycle through views: grid → kanban → calendar → grid
      const boardTab = page.getByRole('button', { name: /board/i }).or(page.getByText('Board'));
      await boardTab.click();
      await page.waitForTimeout(2000);

      const calendarTab = page
        .getByRole('button', { name: /schedule/i })
        .or(page.getByText('Schedule'));
      await calendarTab.click();
      await page.waitForTimeout(2000);

      const gridTab = page
        .getByRole('button', { name: /all tasks/i })
        .or(page.getByText('All Tasks'));
      await gridTab.click();
      await page.waitForTimeout(2000);

      expect(
        criticalErrors,
        `Console errors during view switching:\n${criticalErrors.join('\n')}`,
      ).toEqual([]);
    });
  });
});
