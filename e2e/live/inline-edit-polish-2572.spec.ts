import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Live dogfood verification for the record-level inline edit polish
 * (objectui#2572 / PR #2604) against the REAL showcase stack:
 *
 *   1. $expand-ed lookup values pass through to the picker — the Account chip
 *      shows "Northwind" with ZERO hydration findOne fetches;
 *   2. approval-lock preflight — saving a budget change fires
 *      `showcase_budget_approval`, and the re-read lock state hides the inline
 *      edit affordances (enter() no-ops);
 *   3. currency edits in a real number input carrying metadata min/step;
 *   4. the header Edit CTA is disabled while the inline session is live;
 *   5. Esc cancels / Ctrl+Enter saves the shared session.
 *
 * Prereqs: showcase backend + console dev server (see playwright.live.config.ts;
 * override via LIVE_APP_URL / LIVE_API_URL). The budget mutation intentionally
 * locks the record — run against a throwaway database.
 */

const APP = process.env.SHOWCASE_APP || 'com.example.showcase';
const API = process.env.LIVE_API_URL || 'http://localhost:3000';

// Remote sandbox: the pinned headless-shell build isn't installed; use the
// preinstalled full Chromium instead of downloading (per environment policy).
if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const EDIT_HINT = 'Double-click to edit';

function authToken(): string {
  const state = JSON.parse(readFileSync('e2e/live/.auth/state.json', 'utf8'));
  const entry = state.origins?.[0]?.localStorage?.find((e: any) => e.name === 'auth-session-token');
  if (!entry) throw new Error('No auth-session-token in storage state');
  return entry.value;
}

test('record inline-edit polish (#2572) — showcase Project end-to-end', async ({ page, request }) => {
  test.setTimeout(240_000);

  // ── Resolve the "Website Relaunch" record id via the API (authoritative). ──
  const token = authToken();
  const listRes = await request.get(`${API}/api/v1/data/showcase_project?$top=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listRes.ok()).toBeTruthy();
  const listBody = await listRes.json();
  const rows: any[] = listBody?.records ?? listBody?.data ?? [];
  const record = rows.find((r) => r.name === 'Website Relaunch');
  expect(record, 'seeded "Website Relaunch" project exists').toBeTruthy();
  const recordId = record.id ?? record._id;

  // ── Open the record page. ──
  await page.goto(`/apps/${APP}/showcase_project/record/${recordId}`);
  await expect(page.getByRole('heading', { name: /Website Relaunch/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  const headerToolbar = page.getByRole('toolbar', { name: 'Page header actions' });
  const headerEdit = headerToolbar.getByRole('button', { name: 'Edit', exact: true });
  await expect(headerEdit, 'header Edit CTA enabled before any session').toBeEnabled();

  // ── Item 1 instrumentation: count lookup hydration fetches from now on. ──
  const accountHydrations: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/v1\/data\/showcase_account\/[^/?]+/.test(r.url())) accountHydrations.push(r.url());
  });

  // ── Enter the shared inline-edit session (double-click a details-body field). ──
  const spentGroup = page
    .locator('div.group')
    .filter({ has: page.getByText('Spent', { exact: true }) })
    .last();
  await spentGroup.locator(`[title="${EDIT_HINT}"]`).dblclick();

  const saveBtn = page.getByRole('button', { name: 'Save', exact: true });
  await expect(saveBtn, 'save bar appears once the session is live').toBeVisible();

  // ── Item 3: budget edits in a real numeric input with metadata min/step. ──
  const budgetInput = page.locator('input[type="number"][min="0"][step="0.01"]').first();
  await expect(budgetInput, 'currency renders as number input with min=0 step=0.01').toBeVisible();
  await expect(budgetInput).toHaveValue('150000');

  // ── Item 1: the Account picker shows the expanded record's name with no re-fetch. ──
  await expect(page.getByText('Northwind', { exact: true }).first()).toBeVisible();
  expect(accountHydrations, 'no findOne hydration fetch for the expanded account value').toEqual([]);

  // ── Item 4: header Edit CTA disabled while the session is live. ──
  await expect(headerEdit, 'header Edit CTA disabled during inline session').toBeDisabled();

  // ── Item 5a: Esc cancels the session (no popover open). ──
  await page.keyboard.press('Escape');
  await expect(saveBtn, 'Esc tears the session down').toBeHidden();
  await expect(headerEdit, 'header Edit CTA re-enabled after cancel').toBeEnabled();

  // ── Item 5b: re-enter, change the budget, Ctrl+Enter commits ONE atomic PATCH. ──
  const budgetGroup = page
    .locator('div.group')
    .filter({ has: page.getByText('Budget', { exact: true }) })
    .last();
  await budgetGroup.locator(`[title="${EDIT_HINT}"]`).dblclick();
  await expect(saveBtn).toBeVisible();
  const budgetInput2 = page.locator('input[type="number"][min="0"][step="0.01"]').first();
  await budgetInput2.fill('160000');
  const patchPromise = page.waitForResponse(
    (res) =>
      res.request().method() === 'PATCH' &&
      res.url().includes(`/data/showcase_project/`) &&
      res.ok(),
    { timeout: 20_000 },
  );
  await page.keyboard.press('Control+Enter');
  const patchRes = await patchPromise;
  const patchBody = patchRes.request().postDataJSON?.() ?? {};
  expect(Number(patchBody.budget), 'PATCH carries the edited budget').toBe(160000);
  expect(patchBody, 'PATCH carries ONLY the edited key').not.toHaveProperty('spent');
  await expect(saveBtn, 'session ends after a successful save').toBeHidden({ timeout: 15_000 });

  // ── Item 2: the budget change (>100k, changed) fires showcase_budget_approval →
  //    a pending request opens and the re-read approval state locks the session:
  //    every pencil/double-click affordance disappears. (This backend does NOT
  //    materialize `approval_status` on the record — the lock signal is the
  //    pending request from the approvals API, which is exactly the second
  //    branch of RecordDetailView's `approvalLocked`.) ──
  const authHeader = { Authorization: `Bearer ${token}` };
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${API}/api/v1/approvals/requests?object=showcase_project&recordId=${recordId}`,
          { headers: authHeader },
        );
        const body = await res.json();
        return (body?.data ?? []).some((r: any) => r.status === 'pending');
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe(true);

  // Fresh mount reads the pending request → locked → zero inline-edit
  // affordances anywhere on the page…
  await expect
    .poll(
      async () => {
        await page.reload();
        await page
          .getByRole('heading', { name: /Website Relaunch/ })
          .first()
          .waitFor({ timeout: 20_000 });
        // Editable-record pages render the hint; wait a beat for hydration
        // so an empty count means "locked", not "not yet rendered".
        await page.waitForTimeout(1_500);
        return page.locator(`[title="${EDIT_HINT}"]`).count();
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe(0);

  // …and a double-click on the (former) budget field must NOT open a session.
  const lockedBudgetGroup = page
    .locator('div.group')
    .filter({ has: page.getByText('Budget', { exact: true }) })
    .last();
  await lockedBudgetGroup.dblclick();
  await expect(saveBtn).toBeHidden();
});
