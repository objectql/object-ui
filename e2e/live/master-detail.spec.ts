import { test, expect } from '@playwright/test';
import { selectOption, fillLookup, addLineItem } from './helpers';

/**
 * Live e2e for the master-detail entry form (showcase "New Project + Tasks").
 *
 * Canonical guard for the "click Create, nothing happens" bug. Driven with REAL
 * browser input so Radix Select + react-hook-form + the lookup picker actually
 * bind — the thing synthetic-event automation cannot do.
 *
 * Success signal: after a valid submit the form RESETS (the parent ObjectForm
 * remounts with empty fields). This only happens once the whole chain ran —
 * real input committed → RHF validation passed → submitHandler persisted →
 * onSuccess fired — so it is a reliable end-to-end assertion.
 *
 * Scope notes:
 *  - The showcase workspace renders against the demo data layer, so these assert
 *    the observable UX contract (form reset) rather than a specific network call.
 *    The atomic cross-object batch wire (`POST /api/v1/batch`, `$ref` linkage,
 *    commit/rollback) is covered by @object-ui/plugin-form unit tests + the
 *    framework REST e2e.
 *  - A success TOAST is expected too, but `toast()` (plugin-form) and the
 *    console `<Toaster>` currently resolve to separate sonner instances in this
 *    build, so the toast is checked best-effort and not asserted here. Tracked
 *    separately (sonner/React de-duplication).
 */
const PAGE = '/apps/showcase_app/page/showcase_project_workspace';

async function expectFormReset(page: import('@playwright/test').Page) {
  // The parent form remounts on success → the name field returns to empty.
  await expect(page.locator('input[name="name"]')).toHaveValue('', { timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { name: 'New Project + Tasks' })).toBeVisible();
});

test('create (parent only) drives Radix/lookup, submits, and resets the form', async ({ page }) => {
  await page.locator('input[name="name"]').fill(`E2E Project ${Date.now()}`);
  await fillLookup(page, 'account', 'North'); // Northwind seed
  await selectOption(page, 'status', 'planned');

  // Prove the harness actually drove the widgets before submitting.
  await expect(page.getByText('Northwind', { exact: false })).toBeVisible();
  await expect(page.getByTestId('select-trigger-status')).toContainText(/planned/i);

  await page.getByTestId('md-form-submit').click();
  await expectFormReset(page);
});

test('create with a task line submits and resets the form', async ({ page }) => {
  await page.locator('input[name="name"]').fill(`E2E MD ${Date.now()}`);
  await fillLookup(page, 'account', 'North');
  await selectOption(page, 'status', 'active');
  // Assert the parent fields committed BEFORE touching the child grid.
  await expect(page.getByText('Northwind', { exact: false })).toBeVisible();

  const row = await addLineItem(page);
  await row.getByRole('textbox').first().fill('E2E Task A');
  if (await row.getByTestId('select-trigger-status').count()) {
    await selectOption(row, 'status', 'todo');
  }

  await page.getByTestId('md-form-submit').click();
  await expectFormReset(page);
});
