import { test, expect } from '@playwright/test';
import { selectOption, fillLookup, addLineItem } from './helpers';

/**
 * Live e2e for the master-detail entry form (showcase "New Project + Tasks").
 *
 * Regression guard for the "click Create, nothing happens" bug: the submit must
 * carry the user's input through to the atomic batch. The earlier symptom was a
 * `form.reset()` firing on a parent re-render (between the click and the
 * deferred requestSubmit) that wiped the form, so RHF then validated blank
 * required fields and never submitted. We assert the POST /api/v1/batch fires
 * with the populated parent payload — which only happens when the form kept its
 * values through submit.
 *
 * (Asserting the persisted record needs a browser write-session; the live
 * harness injects a bearer token that the data API accepts for reads but not
 * the transactional /batch write, so we assert the outgoing request instead.)
 */
const PAGE = '/apps/showcase_app/page/showcase_project_workspace';

async function captureBatch(page: import('@playwright/test').Page) {
  const reqs: any[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/v1/batch')) {
      try { reqs.push(r.postDataJSON()); } catch { reqs.push(null); }
    }
  });
  return reqs;
}

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { name: 'New Project + Tasks' })).toBeVisible();
});

test('Create submits the populated parent in one atomic batch', async ({ page }) => {
  const batches = await captureBatch(page);
  const name = `E2E Project ${Date.now()}`;
  await page.locator('input[name="name"]').fill(name);
  await fillLookup(page, 'account', 'North');
  await selectOption(page, 'status', 'planned');
  await expect(page.getByText('Northwind', { exact: false })).toBeVisible();

  await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/v1/batch') && r.request?.().method?.() !== 'GET', { timeout: 15_000 }).catch(() => null),
    page.getByTestId('md-form-submit').click(),
  ]);
  await page.waitForTimeout(500);

  expect(batches.length).toBeGreaterThan(0);
  const parentOp = batches[0]?.operations?.[0];
  expect(parentOp?.object).toBe('showcase_project');
  expect(parentOp?.data?.name).toBe(name);        // the form kept its value through submit
  expect(parentOp?.data?.account).toBeTruthy();    // lookup committed
  expect(parentOp?.data?.status).toBe('planned');  // Radix select committed
});

test('Create with a task line includes the child op referencing the parent', async ({ page }) => {
  const batches = await captureBatch(page);
  const name = `E2E MD ${Date.now()}`;
  await page.locator('input[name="name"]').fill(name);
  await fillLookup(page, 'account', 'North');
  await selectOption(page, 'status', 'active');
  await expect(page.getByText('Northwind', { exact: false })).toBeVisible();

  const row = await addLineItem(page);
  await row.getByRole('textbox').first().fill('E2E Task A');

  await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/v1/batch'), { timeout: 15_000 }).catch(() => null),
    page.getByTestId('md-form-submit').click(),
  ]);
  await page.waitForTimeout(500);

  expect(batches.length).toBeGreaterThan(0);
  const ops = batches[0]?.operations ?? [];
  expect(ops[0]?.data?.name).toBe(name);
  // a child task op referencing the parent via $ref:0
  const child = ops.find((o: any) => o.object === 'showcase_task');
  expect(child).toBeTruthy();
  expect(child?.data?.project).toEqual({ $ref: 0 });
});
