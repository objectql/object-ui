/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Resolve the display currency code for a currency-typed field, in precedence
 * order: the field's explicit `currency` -> its `currencyConfig.defaultCurrency`
 * (fixed mode) -> a legacy top-level `defaultCurrency` -> the tenant default
 * (`localization.currency`, ADR-0053, surfaced via {@link useLocalization}).
 * Returns `undefined` when none is known, so the renderer shows a plain number
 * rather than guessing a symbol.
 *
 * This is the single resolution every field / measure / cell renderer shares -
 * ending the per-renderer drift where some read only `currency`, others only
 * `defaultCurrency`, and others `currencyConfig`. It lives in `@object-ui/i18n`
 * (alongside `useLocalization`) because the tenant default is a localization
 * concern; `@object-ui/fields` re-exports it for backward compatibility.
 */
export function resolveFieldCurrency(
  field:
    | { currency?: string; defaultCurrency?: string; currencyConfig?: { defaultCurrency?: string } }
    | null
    | undefined,
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
