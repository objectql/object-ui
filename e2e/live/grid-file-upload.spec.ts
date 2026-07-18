import { test, expect } from '@playwright/test';

/**
 * Tier 0 live e2e: a `file` field on a master-detail child renders a real
 * UPLOAD control inside the inline line-item grid — not a degraded text input —
 * and the uploaded file persists on the line in the atomic /api/v1/batch
 * (objectui#2360). `showcase_invoice_line.receipt` is a `Field.file()`, so every
 * standard Invoice form's "Line Items" grid gets a per-row Receipt upload cell,
 * auto-derived from the data model (no columns config).
 *
 * This codifies the manual dogfood pass that shipped #2360:
 *   • the Receipt column auto-derives into the grid (file fields are no longer
 *     dropped from auto-columns);
 *   • the cell is a genuine `input[type=file]` upload control (compact button +
 *     removable chip), never a text `<Input>`;
 *   • picking a file uploads it through the console's UploadProvider adapter and
 *     shows a chip with the file name;
 *   • submit carries the resolved file object ({ name, url, … }) on the line.
 *
 * Live-only (needs the storage service + a real backend); runs under
 * `pnpm test:e2e:live`, not the mocked PR e2e job.
 */

// A 1×1 PNG — smallest valid image payload for the upload round-trip.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

test('inline line-item grid uploads a per-row file and persists it in the batch', async ({ page }) => {
  const batches: any[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/v1/batch')) {
      try { batches.push(r.postDataJSON()); } catch { /* ignore */ }
    }
  });

  await page.goto('/apps/showcase_app/showcase_invoice');
  await page.getByRole('button', { name: /^New$/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('md-form-submit')).toBeVisible();
  await expect(dialog.getByText('Line Items', { exact: false })).toBeVisible();

  const li = dialog.getByTestId('line-items');
  // The child schema loads async — wait for real headers, then assert Receipt.
  await li.locator('th', { hasText: 'Product' }).first().waitFor();
  await expect(li.locator('th', { hasText: 'Receipt' })).toHaveCount(1);

  // The Receipt cell is a genuine upload control, NOT a text input (#2360 core).
  const fileInput = li.locator('input[type="file"]').first();
  await expect(fileInput).toHaveCount(1);
  await expect(li.locator('input[type="text"][aria-label="Receipt"]')).toHaveCount(0);

  // Materialise the ghost row via a product pick (auto-fills description/price),
  // then give the line a quantity so it's a valid billable line.
  await li.getByTestId('lookup-trigger').first().click();
  const option = page.getByRole('option', { name: /Widget A/i }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
  await li.locator('input[aria-label="Qty"]').first().fill('1');

  // Upload into the row's Receipt cell → a removable chip with the file name.
  await fileInput.setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
  await expect(li.getByTestId('file-cell-chip').first()).toContainText('receipt.png');

  // Header fields, then submit and capture the atomic batch.
  const name = `INV-${Date.now()}`;
  await dialog.locator('input[name="name"]').fill(name);
  await dialog.getByTestId('lookup-trigger-account').first().click();
  const acct = page.getByRole('option').first();
  await acct.waitFor({ state: 'visible' });
  await acct.click();
  await dialog.getByTestId('select-trigger-status').first().click();
  await page.getByTestId('select-option-draft').first().click();

  await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/v1/batch'), { timeout: 15_000 }).catch(() => null),
    dialog.getByTestId('md-form-submit').click(),
  ]);
  await page.waitForTimeout(500);

  expect(batches.length).toBeGreaterThan(0);
  const ops = batches[0].operations;
  const child = ops.find((o: any) => o.object === 'showcase_invoice_line');
  expect(child).toBeTruthy();
  // The uploaded file resolved to a stored object, not a blob/text placeholder.
  const receipt = child?.data?.receipt;
  expect(receipt).toBeTruthy();
  expect(receipt.name || receipt.original_name).toContain('receipt');
  expect(String(receipt.url)).toMatch(/^https?:\/\//);
});
