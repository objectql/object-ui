/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `formatDisplayNumber` — the ONE number-display formatter behind every field
 * cell, field widget and metric renderer in the console.
 *
 * It exists because the same `new Intl.NumberFormat('en-US', …)` construction
 * had been copied into the number cell renderer, the currency cell renderer,
 * the currency widget, the compact `formatNumber` helper and the dashboard
 * metric widget. Two defects therefore had five homes each, and fixing "the"
 * renderer never changed the answer (objectui#4033, source thread
 * objectstack#5067):
 *
 *  1. the locale was hardcoded to `en-US`, so a `zh-CN` / `de-DE` console still
 *     grouped and pointed decimals the US way; and
 *  2. `useGrouping` was never set, so a four-digit YEAR stored as
 *     `Field.number({ scale: 0 })` rendered as `2,026` — in every locale, with
 *     no field property able to turn it off.
 *
 * Both policies now live here and nowhere else. Call sites bring the value and
 * the display width; they do not bring a locale default and they do not decide
 * grouping.
 *
 * ⚠️ ONE KNOWN EXCEPTION, recorded at both ends (objectui#4566).
 * `formatMeasure` / `formatDimensionValue` in `@object-ui/core`'s
 * `utils/dataset-format.ts` still build their own `Intl.NumberFormat`, and they
 * mirror the malformed-locale retry below in a local `formatNumberInLocale`.
 * That is NOT drift left unnoticed: the option mapping was measured lossless
 * across 32,760 combinations (routing them through this function changes no
 * byte of output, because a measure carries no field `scale` and so never
 * reaches the grouping policy). What blocks the routing is the package
 * boundary — `@object-ui/core` is React-free and consumed by React-free
 * packages, while this one depends on `i18next`/`react-i18next` and peer-depends
 * on React, and exports no pure-utility subpath. Retiring the duplicate means
 * moving THIS module down into `@object-ui/core` and re-exporting it from here.
 * Until then, a change to the retry policy below belongs in that mirror too.
 */

export interface DisplayNumberFormatOptions {
  /**
   * BCP-47 tag for the ACTIVE display locale — in React, whatever
   * `useDisplayLocale()` returns.
   *
   * `undefined` means "follow the runtime default", which is the honest answer
   * for a non-React caller that has no locale in hand. It never means `en-US`:
   * assuming US conventions for the whole world is the defect this module was
   * created to remove.
   */
  locale?: string;

  /**
   * ISO 4217 code. When present the value is formatted as money — which also
   * means grouping is kept, because a grouped amount is what every currency
   * convention expects and an ordinal amount of money is not a thing.
   */
  currency?: string;

  /**
   * The FIELD's declared `scale` — the `s` of a `decimal(p, s)` column — and
   * nothing else. This is a POLICY input, not a display width: pass it only
   * when a field declaration actually said so.
   *
   * `scale: 0` with no currency declares a discrete integer (a year, a fiscal
   * period, an ordinal), and those are not grouped. Leave `scale` undefined and
   * grouping is kept — which is correct for the two cases that look similar but
   * are not:
   *
   *   - an UNDECLARED scale (`scale` is optional in the spec, so absent means
   *     "decimals unknown", not "integer"); and
   *   - a caller whose zero-decimal display comes from something other than a
   *     field declaration — e.g. the dashboard `MetricWidget`, whose decimals
   *     come from a numeral.js format pattern and whose large KPI aggregates
   *     are *documented* to want separators ("`1,930,000` not `1930000`").
   *
   * ⚠️ INTERIM DEFAULT (objectui#4033, PM ruling 2026-08-11). Suppressing
   * grouping for every scale-0 number is a transitional policy with a known,
   * accepted cost: a large scale-0 COUNT loses its separators too. It is the
   * better trade only until the spec gains an authorable presentation hint
   * (`useGrouping` / `displayFormat` — being specified separately, contract-first,
   * in the objectstack repo). When that hint lands it OVERRIDES this default,
   * and this heuristic should be reduced to the fallback for fields that
   * declare nothing.
   */
  scale?: number;

  style?: 'decimal' | 'percent';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'compact';
}

/**
 * The grouping policy, alone and testable: does this number get thousands
 * separators?
 *
 * @param scale    the field's declared `scale`, or `undefined` when the caller
 *                 has no field declaration behind it
 * @param currency ISO 4217 code when the number is money
 */
export function shouldGroupDisplayNumber(scale?: number, currency?: string): boolean {
  // Money always groups — including money whose currency code could not be
  // resolved, which still renders as an amount (just without a symbol).
  if (currency) return true;
  // Only an explicitly declared scale of 0 is an ordinal. `undefined !== 0`.
  return scale !== 0;
}

/**
 * Format a number for DISPLAY, in the active locale, under the grouping policy
 * above.
 *
 * Throws for a bad `currency` code exactly as `Intl.NumberFormat` does, so the
 * fallbacks call sites already had (`${currency} ${value.toFixed(n)}`) keep
 * working unchanged. A bad LOCALE is handled here instead of throwing: `locale`
 * arrives from a server response (ADR-0053 `localization.locale`), and a
 * malformed tag from a tenant config must never take a grid cell down.
 */
export function formatDisplayNumber(
  value: number,
  options: DisplayNumberFormatOptions = {},
): string {
  const { locale, currency, scale, ...passthrough } = options;

  const intlOptions: Intl.NumberFormatOptions = { ...passthrough };
  if (currency) {
    intlOptions.style = 'currency';
    intlOptions.currency = currency;
  }

  // ⚠️ Set `useGrouping` ONLY to suppress. `useGrouping: true` is NOT the same
  // as omitting the key: `true` means "always", while omitting it means "auto"
  // (and "min2" under compact notation), which is the locale's own preference.
  // Measured — for 1234: es-ES "auto" → `1234` but "always" → `1.234`; pl-PL
  // "auto" → `1234` but "always" → `1 234`. Writing `true` here would silently
  // override those locales' conventions in the name of preserving en-US output.
  if (!shouldGroupDisplayNumber(scale, currency)) {
    intlOptions.useGrouping = false;
  }

  try {
    return new Intl.NumberFormat(locale, intlOptions).format(value);
  } catch {
    // Retry WITHOUT the locale, keeping every other option: this rescues a
    // malformed tag while still surfacing a genuinely bad `currency` to the
    // caller's own catch.
    return new Intl.NumberFormat(undefined, intlOptions).format(value);
  }
}
