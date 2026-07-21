import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Live e2e for the record detail History tab's display pipeline
 * (app-shell auditHistoryDisplay → record:history → HistoryTimeline).
 *
 * Regression for the gantt QA report where the tab rendered raw audit
 * payloads: ISO datetimes ("2026-08-04T12:00:00.000Z"), raw lookup id
 * arrays, raw select values, and "Unknown user" for every entry.
 *
 * Needs an object with `enable.trackHistory: true`; the showcase app has
 * none, so this spec targets `todo_task` from examples/app-todo and SKIPS
 * when that backend isn't the live target:
 *
 *   cd ../objectstack/examples/app-todo && pnpm exec objectstack dev --seed-admin --fresh -p 4015
 *   cd apps/console && DEV_PROXY_TARGET=http://localhost:4015 pnpm exec vite --port 5196 --strictPort
 *   LIVE_APP_URL=http://localhost:5196 LIVE_API_URL=http://localhost:4015 pnpm test:e2e:live record-history-display
 */
const API = process.env.LIVE_API_URL || 'http://localhost:3000';

async function hasTodoTask(request: APIRequestContext): Promise<boolean> {
  const res = await request.get(`${API}/api/v1/meta/object/todo_task`);
  return res.ok();
}

async function adminUser(request: APIRequestContext): Promise<{ id: string; name: string }> {
  const body = await (
    await request.get(`${API}/api/v1/data/sys_user?$top=1&$select=id,name`)
  ).json();
  const row = (body.data ?? body.records ?? body)[0];
  expect(row?.id, 'a seeded sys_user').toBeTruthy();
  return { id: row.id, name: row.name };
}

test('History tab shows display values (localized dates, option labels, resolved lookups, real actor) instead of raw audit payloads', async ({ page, request }) => {
  test.skip(!(await hasTodoTask(request)), 'live backend has no todo_task (app-todo) — skipping');

  const admin = await adminUser(request);

  // 1) Seed a task and drive three audited updates through the real API —
  //    the same field mix the QA report flagged: dates, a select, a lookup,
  //    and a boolean.
  const subject = `历史显示 e2e ${Date.now()}`;
  const createRes = await request.post(`${API}/api/v1/data/todo_task`, {
    data: {
      subject,
      status: 'not_started',
      priority: 'high',
      due_date: '2026-07-26',
      reminder_date: '2026-07-27T12:00:00.000Z',
      is_recurring: false,
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  const id = created.id ?? created.record?.id ?? created.data?.id;
  expect(id).toBeTruthy();

  for (const patch of [
    { due_date: '2026-08-04', reminder_date: '2026-08-06T00:00:00.000Z' },
    { status: 'in_progress', owner: admin.id },
    { is_recurring: true, recurrence_type: 'weekly', recurrence_interval: 1 },
  ]) {
    const res = await request.patch(`${API}/api/v1/data/todo_task/${id}`, { data: patch });
    expect(res.ok()).toBeTruthy();
  }

  // 2) Open the synthesized record page and its History tab.
  await page.goto(`/apps/todo_app/todo_task/record/${id}`);
  const historyTab = page.getByRole('tab', { name: /^(History|历史)$/ });
  await historyTab.waitFor({ state: 'visible', timeout: 15_000 });
  await historyTab.click();

  const panel = page.getByRole('tabpanel', { name: /History|历史/ });
  // The three UPDATE entries render as diff lines; wait for the latest one.
  await expect(panel.getByText('Recurrence Type', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  const text = (await panel.innerText()).replace(/\s+/g, ' ');

  // 3) Actor attribution: the audit user resolves to a display name —
  //    never the raw id, never the unknown-user fallback.
  expect(text).toContain(admin.name);
  expect(text).not.toContain(admin.id);
  expect(text).not.toMatch(/Unknown user|未知用户/);

  // 4) Select values render as option labels, not raw stored values.
  expect(text).toMatch(/Not Started/);
  expect(text).toMatch(/In Progress/);
  expect(text).not.toMatch(/\bnot_started\b|\bin_progress\b/);

  // 5) Dates/datetimes are localized — no raw ISO payloads anywhere.
  expect(text).not.toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/);

  // 6) The owner lookup resolves to the user's name on the diff line (its id
  //    is already asserted absent above), and booleans render as words.
  expect(text).toMatch(/Assigned To/i);
  expect(text).toMatch(/Yes|是/);
});
