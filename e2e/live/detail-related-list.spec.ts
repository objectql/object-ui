import { test, expect } from '@playwright/test';

/**
 * Live e2e for relationship-derived DETAIL-PAGE related lists — the read-side
 * mirror of `inlineEdit`.
 *
 * `showcase_project.account` is a lookup → showcase_account, so the Account's
 * record detail page must auto-render a "Projects" related list with NO page
 * config (derived from the relationship by `deriveRelatedLists`). The list's
 * title/columns come from `relatedListTitle` / `relatedListColumns` declared on
 * the relationship. We open an Account record and assert the Projects related
 * list is present.
 */
test('Account detail page auto-renders a relationship-derived Projects related list', async ({ page }) => {
  // 1) Open the Accounts list and drill into the first record.
  await page.goto('/apps/showcase_app/showcase_account');

  // The data grid renders the primary (name) cell as a link. Clicking it opens
  // the record (the list uses a split-pane drawer keyed by `?recordId=`). Grab
  // the id and navigate to the canonical full-page detail route.
  const firstRowNameLink = page.getByRole('row').nth(1).getByRole('link').first();
  await firstRowNameLink.waitFor({ state: 'visible', timeout: 15_000 });
  await firstRowNameLink.click();

  await page.waitForURL(/[?&]recordId=/, { timeout: 15_000 });
  const recordId = new URL(page.url()).searchParams.get('recordId');
  expect(recordId).toBeTruthy();

  // 2) Open the canonical full-page detail (synthesized record page).
  await page.goto(`/apps/showcase_app/showcase_account/record/${recordId}`);
  await expect(page).toHaveURL(/\/showcase_account\/record\//, { timeout: 15_000 });

  // 3) The synthesized detail page groups related lists under a "Related" tab.
  //    This tab only exists because `deriveRelatedLists` found the
  //    showcase_project.account relationship — it's the read-side mirror at work.
  const relatedTab = page.getByRole('tab', { name: /^Related$/i });
  await relatedTab.waitFor({ state: 'visible', timeout: 15_000 });
  await relatedTab.click();

  // 4) The relationship-derived related list renders under its declared
  //    `relatedListTitle` ("Projects").
  const relatedPanel = page.getByRole('tabpanel', { name: /Related/i });
  await expect(relatedPanel.getByText('Projects', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  // The status column renders as a friendly, capitalized badge label (e.g.
  // "Planned"/"Active") — NOT the raw lowercase value ("planned"). This guards
  // the cell-renderer resolution for explicitly-supplied related-list columns.
  // (Empty override columns like Health are pruned, so we don't assert those.)
  await expect(
    relatedPanel.getByText(/^(Planned|Active|On Hold|Completed|Cancelled)$/).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(relatedPanel.getByText('planned', { exact: true })).toHaveCount(0);
});
