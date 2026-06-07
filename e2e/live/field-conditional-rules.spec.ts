import { test, expect, type Locator } from '@playwright/test';
import { selectOption } from './helpers';

/**
 * B2 live e2e: field-level conditional rules (visibleWhen / readonlyWhen /
 * requiredWhen), authored as CEL on the object's fields and enforced
 * client-side by the form renderer via the canonical @objectstack/formula
 * engine — the SAME dialect the server enforces, so the UX and the persisted
 * verdict agree.
 *
 * The showcase Invoice header declares:
 *   • issued_on.requiredWhen = "record.status in ['sent', 'paid']"
 *   • tax_rate.readonlyWhen  = "record.status == 'paid'"
 *   • paid_on.visibleWhen    = "record.status == 'paid'"   (UX-only)
 *     paid_on.requiredWhen   = "record.status == 'paid'"
 *
 * Driving the Status select must reactively re-gate every dependent field.
 */

/** True when the field's <label> carries the required asterisk. */
async function isRequired(dialog: Locator, labelText: string): Promise<boolean> {
  const marker = dialog
    .locator('label', { hasText: labelText })
    .locator('span[aria-label="required"]');
  return (await marker.count()) > 0;
}

test('header fields react to Status via CEL visibleWhen / readonlyWhen / requiredWhen', async ({ page }) => {
  await page.goto('/apps/showcase_app/showcase_invoice');
  await page.getByRole('button', { name: /^(New|新建)$/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('md-form-submit')).toBeVisible();

  const paidOn = dialog.locator('[name="paid_on"]');
  const taxRate = dialog.locator('[name="tax_rate"]');

  // --- Initial (status unset / draft): paid_on hidden, tax_rate editable,
  //     issued_on not yet required. ---
  await expect(paidOn).toHaveCount(0);
  await expect(taxRate).toBeEnabled();
  expect(await isRequired(dialog, 'Issued On')).toBe(false);

  // --- Paid: tax_rate locks (readonlyWhen), paid_on appears + required,
  //     issued_on required. ---
  await selectOption(dialog, 'status', 'paid');
  await expect(paidOn).toHaveCount(1);
  await expect(taxRate).toBeDisabled();
  expect(await isRequired(dialog, 'Paid On')).toBe(true);
  expect(await isRequired(dialog, 'Issued On')).toBe(true);

  // --- Sent: tax_rate editable again, paid_on hidden again, issued_on still
  //     required. ---
  await selectOption(dialog, 'status', 'sent');
  await expect(paidOn).toHaveCount(0);
  await expect(taxRate).toBeEnabled();
  expect(await isRequired(dialog, 'Issued On')).toBe(true);

  // --- Draft: everything relaxes — tax_rate editable, paid_on hidden,
  //     issued_on optional. ---
  await selectOption(dialog, 'status', 'draft');
  await expect(paidOn).toHaveCount(0);
  await expect(taxRate).toBeEnabled();
  expect(await isRequired(dialog, 'Issued On')).toBe(false);
});
