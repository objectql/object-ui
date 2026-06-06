import { test, expect } from '@playwright/test';
import { selectOption, fillLookup, addLineItem } from './helpers';

/**
 * Tier 0 live e2e: an object's standard New/Edit modal renders inline child
 * collections purely from `formViews.default.subforms` (no bespoke page). Here
 * the showcase_project form view declares { childObject: 'showcase_task' }, so
 * "New Project" opens a master-detail modal that submits parent + children in
 * one atomic /api/v1/batch.
 */
test('New <object> modal renders form-view subforms and submits an atomic batch', async ({ page }) => {
  const batches: any[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/v1/batch')) {
      try { batches.push(r.postDataJSON()); } catch { /* ignore */ }
    }
  });

  await page.goto('/apps/showcase_app/showcase_project');
  await page.getByRole('button', { name: /^New$/i }).first().click();

  // The standard create modal is now a master-detail form (no custom page).
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('md-form-submit')).toBeVisible();
  await expect(dialog.getByText('Tasks', { exact: false })).toBeVisible();

  const name = `Tier0 ${Date.now()}`;
  await dialog.locator('input[name="name"]').fill(name);
  await fillLookup(page, 'account', 'North');
  await selectOption(page, 'status', 'planned');
  await expect(dialog.getByText('Northwind', { exact: false }).first()).toBeVisible();

  const row = await addLineItem(page);
  await row.getByRole('textbox').first().fill('Tier0 Task');

  await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/v1/batch'), { timeout: 15_000 }).catch(() => null),
    dialog.getByTestId('md-form-submit').click(),
  ]);
  await page.waitForTimeout(500);

  expect(batches.length).toBeGreaterThan(0);
  const ops = batches[0].operations;
  expect(ops[0]).toMatchObject({ object: 'showcase_project', action: 'create' });
  expect(ops[0].data.name).toBe(name);
  expect(ops[0].data.status).toBe('planned');
  const child = ops.find((o: any) => o.object === 'showcase_task');
  expect(child?.data?.project).toEqual({ $ref: 0 });
});
