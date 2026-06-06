import { test, expect } from '@playwright/test';

/**
 * Live e2e for the Studio metadata page editor — guards the "Add block works
 * and blocks are configurable" contract the SDUI runtime depends on. Drives the
 * real editor at /apps/:app/metadata/page/:name against the running stack.
 */
const EDIT = '/apps/showcase_app/metadata/page/showcase_project_workspace';

test('the page editor loads with its config sections', async ({ page }) => {
  await page.goto(EDIT);
  await expect(page.getByTestId('metadata-edit-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Basics' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Layout' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add block/i }).first()).toBeVisible();
});

test('Add block opens a block-type picker with configurable block kinds', async ({ page }) => {
  await page.goto(EDIT);
  await expect(page.getByTestId('metadata-edit-page')).toBeVisible();

  await page.getByRole('button', { name: /Add block/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The picker offers selectable, schema-backed block kinds (SDUI slots).
  await expect(dialog.getByRole('button', { name: /Card/i })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Section/i })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Record details/i })).toBeVisible();
});
