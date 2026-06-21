/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Licensed under the MIT license found in the LICENSE file.
 */

/**
 * Resolve the display currency code for a currency field, in precedence order:
 * the field's explicit `currency` → its `currencyConfig.defaultCurrency` (fixed
 * mode) → a legacy top-level `defaultCurrency` → the tenant default
 * (`localization.currency`, ADR-0053). Returns `undefined` when none is known,
 * so the renderer shows a plain number rather than guessing a symbol.
 *
 * This is the single resolution the field renderers share — ending the
 * per-renderer inconsistency where some read only `currency`, others only
 * `defaultCurrency`, and others `currencyConfig`.
 */
export function resolveFieldCurrency(
  field: { currency?: string; defaultCurrency?: string; currencyConfig?: { defaultCurrency?: string } } | null | undefined,
  tenantDefault?: string,
): string | undefined {
  return (
    field?.currency ||
    field?.currencyConfig?.defaultCurrency ||
    field?.defaultCurrency ||
    tenantDefault ||
    undefined
  );
}
