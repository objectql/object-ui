import { test, expect } from '@playwright/test';

/**
 * Live e2e for the master-detail inline grid's per-row "expand to full form"
 * (the mainstream hybrid: a quick grid + a rich per-row form). Adding a line
 * then clicking its expand button reveals the child's COMPLETE form inline,
 * with the parent relationship FK excluded. Applying writes the values back
 * into the grid row — no separate backend write; the atomic batch still
 * persists everything on the parent Save.
 *
 * The editor is rendered inline (not a portaled drawer) precisely so it stays
 * interactive + accessible when this form is itself inside the create-record
 * modal (a nested portaled overlay would inherit the host modal's
 * pointer-events / aria-hidden lock and be unclickable).
 */
test('a grid row expands into a full inline form and writes values back', async ({ page }) => {
  await page.goto('/apps/showcase_app/showcase_invoice');
  await page.getByRole('button', { name: /^New$/i }).first().click();

  const dialog = page.getByRole('dialog').first();
  await expect(dialog.getByTestId('md-form-submit')).toBeVisible();

  // Add a line item, then expand it into the full form.
  await dialog.getByTestId('line-items-add').click();
  await dialog.getByTestId('line-items-expand-0').click();

  const editor = page.getByTestId('md-row-form');
  await expect(editor).toBeVisible();

  // The full form includes the line's business fields (Product) and excludes
  // the parent relationship FK (Invoice).
  await expect(editor.getByText('Product', { exact: false }).first()).toBeVisible();
  await expect(editor.getByText(/^Invoice$/)).toHaveCount(0);

  // Fill the required fields (Product + Qty) in the full form, then Apply.
  await editor.locator('input[name="product"]').fill('Widget Deluxe');
  await editor.locator('input[name="quantity"]').fill('3');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  // Editor closes and the value is written back into the grid row.
  await expect(editor).toBeHidden();
  await expect(dialog.getByTestId('line-items').getByRole('textbox').first()).toHaveValue('Widget Deluxe');
});
