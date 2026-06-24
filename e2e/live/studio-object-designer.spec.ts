import { test, expect, type Page } from '@playwright/test';

/**
 * Live e2e for the Studio OBJECT designer — a "dogfood" gate that drives the
 * metadata-admin object editor as a business user would and pins the UX
 * regressions found in objectstack-ai/objectui#1926. Runs against the real
 * stack (console at LIVE_APP_URL, backend at :3000).
 *
 * Why these specifically: each is a class that static gates (build, unit,
 * spec-liveness) cannot catch because the break only appears when a real user
 * drives the real controlled inputs against the real spec validator:
 *   F2 — per-keystroke identifier sanitisation (must TYPE, not fill)
 *   F1 — cross-component reactivity (create package → switcher refresh)
 *   F3 — label→api-name derivation on blur
 *   F4 — empty picklist row must not trip spec validation
 */

const STUDIO = '/apps/com.objectstack.studio';
const PKG = 'com.example.showcase';
const NEW_OBJ = `${STUDIO}/metadata/object/new?package=${PKG}`;

/** Add a field of the given palette type into the open object designer. */
async function addField(page: Page, typeName: string) {
  await page.getByRole('button', { name: /Add field/i }).first().click();
  await page.getByPlaceholder(/Search field type/i).fill(typeName);
  // Target the palette *button* by exact accessible name — not getByText,
  // which also matches the category header ("Text") and the type badge.
  await page.getByRole('button', { name: typeName, exact: true }).first().click();
}

test('F2: object Name accepts a typed underscore (no per-keystroke trim)', async ({ page }) => {
  await page.goto(NEW_OBJ);
  const name = page.getByTestId('object-name-input');
  await expect(name).toBeVisible();
  await name.click();
  // MUST type char-by-char: .fill() would set the value in one shot and hide
  // the per-keystroke bug. Pre-fix this yields "repairticket".
  await name.pressSequentially('repair_ticket');
  await expect(name).toHaveValue('repair_ticket');
});

test('F3: a field API name derives from its label on blur', async ({ page }) => {
  await page.goto(NEW_OBJ);
  await page.getByTestId('object-name-input').fill('asset');
  await addField(page, 'Text');
  const label = page.getByTestId('field-label-input');
  await label.fill('Asset Code');
  await label.blur();
  await expect(page.getByTestId('field-apiname-input')).toHaveValue('asset_code');
});

test('F4: adding a picklist + an empty option row does not trip spec validation', async ({ page }) => {
  await page.goto(NEW_OBJ);
  await page.getByTestId('object-name-input').fill('asset');
  await addField(page, 'Picklist');
  await page.getByRole('button', { name: /Add value/i }).click();
  // Live spec validation is debounced, so settle before a NEGATIVE assertion:
  // the empty option row must NOT surface the developer-oriented
  // "System identifier must be at least 2 characters" spec error. (With the
  // bug the row persists to def.options and this banner appears.)
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('metadata-validation-banner')).toHaveCount(0);
  await expect(page.getByText(/System identifier must be/i)).toHaveCount(0);
});

test('F1: a newly created package appears in the switcher without a reload', async ({ page }) => {
  const pkgId = `com.e2e.dogfood${Date.now()}`;
  const pkgName = `E2E Dogfood ${Date.now()}`;
  await page.goto(`${STUDIO}/component/developer/packages`);
  await page.getByRole('button', { name: /New Package/i }).click();
  await page.getByTestId('package-id-input').fill(pkgId);
  await page.getByTestId('package-name-input').fill(pkgName);
  await page.getByRole('button', { name: /Create package/i }).click();

  // No reload: open the sidebar package switcher and expect the new package.
  await page.getByTestId('package-switcher').click();
  await expect(page.getByRole('option', { name: pkgName })).toBeVisible();

  // Cleanup so we don't pollute the shared dev stack.
  await page.evaluate(async (id) => {
    const tok = localStorage.getItem('auth-session-token');
    await fetch(`/api/v1/packages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    }).catch(() => {});
  }, pkgId);
});
