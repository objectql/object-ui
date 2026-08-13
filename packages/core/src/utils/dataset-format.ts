/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * dataset-format — shared value formatting for semantic-layer `queryDataset`
 * results (ADR-0021). Used by every dataset-bound surface (dashboard widgets,
 * reports, the dataset preview) so a measure renders identically everywhere:
 * a currency amount carries its declared currency symbol, a plain number stays
 * a plain number, and a dimension label passes through untouched.
 *
 * Pure (no React / i18n) so it can live in `@object-ui/core` and be imported
 * by both `@object-ui/plugin-dashboard` and `@object-ui/plugin-report`.
 */

import type { AnalyticsResult } from '@objectstack/spec/contracts';
import type { PercentScale } from '@objectstack/spec/data';

/**
 * Column metadata the analytics server returns alongside the rows — the spec's
 * `AnalyticsResult.fields[]` element BY REFERENCE, never a local restatement of
 * it (objectui#3815). Read `@objectstack/spec` for what a column carries; this
 * comment deliberately does not re-list the keys, because the enumeration it
 * replaced was the latent bug: a hand-written interface stops at the contract
 * of the day it was written and cannot grow with the spec, and here it would
 * not even fail to compile — three surfaces (`plugin-dashboard`'s
 * `DatasetWidget`, `plugin-report`'s `DatasetReportRenderer`, app-shell's
 * `DatasetPreview`) consume this name AS the real thing, so a spec column key
 * they never learn about is one they can never render. The same derive-don't-
 * restate fix as the parameter side (#3613/#3753) and the adapter return side
 * (#3752); this was the last surviving restatement of the family.
 *
 * `type` is REQUIRED, as the contract has it. The restatement had relaxed it to
 * optional, which was a promise the server never asked for: nothing in this repo
 * constructs a result column (every value originates in
 * `ObjectStackAdapter.queryDataset`, which already declares the spec element),
 * and nothing reads `.type` — so the widening bought no caller anything and only
 * offered future readers a `string | undefined` the wire never produces.
 *
 * Still a superset of {@link ChartResultField} (which needs only
 * name/label/format) — pinned, not merely asserted, in
 * `__tests__/dataset-result-field-spec-parity.test.ts`.
 */
export type DatasetResultField = AnalyticsResult['fields'][number];

/**
 * How a percentage column's stored number relates to its displayed percentage —
 * the server's answer to a question a `%` format string cannot express:
 * `fraction` is a 0–1 ratio (`1` ⇒ "100%"), `whole` is already percentage
 * points (`1` ⇒ "1%"). Resolved from metadata server-side (a `ratio` measure is
 * a fraction by definition; a measure over a `percent` field inherits that
 * field's scale) and carried on the result column, so display never has to
 * infer it from the value's magnitude — the inference that printed a ratio of
 * exactly 1 as "1.0%" (#3136).
 *
 * Spec-owned since 17.0.0-rc.2 (`@objectstack/spec/data` exports the identical
 * union); re-exported here so existing `@object-ui/core` consumers keep their
 * import path.
 */
export type { PercentScale } from '@objectstack/spec/data';

/**
 * Scale a stored `percent`-field value to its DISPLAY magnitude.
 *
 * Percent fields store a FRACTION (0–1) by convention — a stored `0.75` means
 * 75% (see the percent edit widget `PercentField`, which divides input by 100).
 * A value already in whole-percent form (magnitude ≥ 1, e.g. a `progress` /
 * `completion` field storing `57`) is passed through unchanged. This is the
 * SINGLE source of truth for percent display scaling, shared by the list-view
 * percent cell renderer (`formatPercent` in `@object-ui/fields`) and the dataset
 * measure formatter ({@link formatMeasure}) so a percent renders identically as
 * a row value and as an aggregated metric — the two surfaces can never drift.
 */
export function percentDisplayValue(value: number): number {
  return value > -1 && value < 1 ? value * 100 : value;
}

/**
 * Format one number in the DISPLAY locale, surviving a malformed locale tag.
 *
 * ⚠️ SURVIVING DUPLICATION, recorded deliberately (objectui#4566). This mirrors
 * the `try`/`catch` retry inside `formatDisplayNumber`
 * (`@object-ui/i18n`'s `utils/number-display.ts`) — the ONE number-display
 * formatter — and the mirror exists only because of a PACKAGE BOUNDARY, not
 * because the behaviour differs. See {@link formatMeasure}'s note for the
 * measurement that chose this over routing through it. Keep the two in step:
 * a change to the retry policy there belongs here too.
 *
 * The retry is load-bearing rather than defensive. Before #4566 these sites
 * passed a literal `undefined`, which never throws; a THREADED tag can be
 * malformed, and a bare `Intl.NumberFormat('en_US', …)` throws `RangeError`
 * (measured — underscore instead of hyphen is the likeliest tenant-config
 * typo). Un-caught that would take the whole widget down, so a bad tag falls
 * back to the runtime default exactly as `formatDisplayNumber` does. A bad
 * `currency` still throws out of both attempts, which is what lets
 * {@link formatMeasure}'s own `catch` fall through to plain-number formatting.
 */
function formatNumberInLocale(
  value: number,
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    // Retry WITHOUT the locale, keeping every other option: rescues a malformed
    // tag while still surfacing a genuinely bad `currency` to the caller.
    return new Intl.NumberFormat(undefined, options).format(value);
  }
}

/**
 * Format a MEASURE value. Currency comes from the field's declared `currency`
 * (locale-correct symbol via `Intl`), NOT from a "$" baked into the format
 * string — an amount with no declared currency must render as a plain number,
 * never a misleading "$". The numeral `format` hint (e.g. "0,0", "0.0%")
 * controls grouping / decimals / percent; it can't be baked into the row value
 * server-side (the same number feeds charts), so it is applied here.
 *
 * `locale` is the BCP-47 tag of the active display locale — in React, whatever
 * `useDisplayLocale()` returns. It is optional and LAST so every existing call
 * keeps compiling, and omitting it reproduces the previous output byte for
 * byte (the old code passed a literal `undefined` to `Intl`, which is exactly
 * what an omitted argument passes now).
 *
 * Before objectui#4566 there was no way to pass one: all three formatting sites
 * here hard-coded `undefined`, which is neither of the repo's two locale
 * channels — it is the MACHINE's locale. A German session read a KPI as
 * `1,234.5` beside a grid cell rendering the same number as `1.234,5`, and
 * inverted separators read as a different number, not an unstyled one.
 *
 * ── Why this still formats itself instead of calling `formatDisplayNumber` ──
 * The one-resolver rule says this should route through `formatDisplayNumber`
 * (`@object-ui/i18n`) and retire the parallel implementation. That was measured
 * across 32,760 value × format × currency × percentScale × locale combinations
 * and the option mapping is LOSSLESS — routing through it changes literally no
 * byte of output, because the policy layer `formatDisplayNumber` adds over
 * plain `Intl` is grouping suppression keyed on a field's declared `scale`, and
 * a measure has no `scale` to feed it (decimals here come from a numeral format
 * PATTERN, so grouping stays on and the two agree everywhere).
 *
 * What blocks the routing is the PACKAGE BOUNDARY, not the behaviour.
 * `@object-ui/core` is the React-free engine (see this module's header, and the
 * topology table in AGENTS.md §3: "No UI-lib deps. Logic only."), while
 * `@object-ui/i18n` depends on `i18next`/`react-i18next` and peer-depends on
 * React, and publishes no pure-utility subpath to import in isolation — its
 * `exports` map is `.` and `./locales/*`. A `core` → `i18n` edge would put
 * React into the dependency closure of every React-FREE consumer of this
 * package: the `object-ui` VS Code extension and `@object-ui/data-objectstack`
 * both take `@object-ui/core` as a runtime dependency and declare no React.
 *
 * So the duplication survives on purpose and is recorded at BOTH ends (see
 * `formatNumberInLocale` above and the note in `number-display.ts`). Retiring
 * it for real means moving `formatDisplayNumber` DOWN into this package and
 * re-exporting it from `@object-ui/i18n` — the right direction, since `core` is
 * the lower layer — but that relocates a published export across a package
 * boundary and is deliberately left to its own card.
 */
export function formatMeasure(
  v: unknown,
  format?: string,
  currency?: string,
  percentScale?: PercentScale,
  locale?: string,
): string {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);

  const decimals = format ? (format.split('.')[1]?.match(/0/g)?.length ?? 0) : undefined;

  if (currency) {
    try {
      return formatNumberInLocale(v, locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 2,
      });
    } catch {
      // Unknown currency code → fall through to plain number formatting.
      // Still reachable with a locale threaded: `formatNumberInLocale` retries
      // without the LOCALE, and a bad currency throws out of that retry too.
    }
  }

  if (!format) {
    // No format hint → preserve the plain rendering (integers verbatim).
    //
    // The integer branch stays a bare `String(v)` and is deliberately NOT
    // localized: it is the one form here that renders no separator and no
    // decimal mark, so there is nothing for a locale to change — and routing it
    // through `Intl` WOULD change it, in two ways this card is not about
    // (measured): a locale with its own numbering system would re-digit it
    // (`ar-EG` 1234 → an Arabic-Indic spelling), and `1e21` would expand from
    // `1e+21` to its 22 digits. Only the fractional branch below ever produced
    // locale-dependent text, and that is the site #4566 fixes.
    return Number.isInteger(v) ? String(v) : formatNumberInLocale(v, locale, { maximumFractionDigits: 2 });
  }
  const isPercent = format.includes('%');
  // A legacy "$" literal in the format string is still honored (explicit author
  // choice) — but it is NOT how a real currency field gets its symbol.
  const legacyDollar = format.includes('$') ? '$' : '';
  // numeral's "0.0%" multiplies by 100, and a percent field stores a FRACTION
  // (0.75 ⇒ 75%). Scale to display magnitude the SAME way the list-view cell
  // renderer does — otherwise an avg of 0.608 renders as "0.6%" instead of
  // "60.8%", disagreeing with the per-row "75%" the list already shows.
  //
  // A DECLARED `percentScale` from the server wins outright: the value-magnitude
  // heuristic below cannot tell a 0–1 ratio of exactly 1 from 1 percentage point
  // (both are the number 1) and resolves it as "1%", so an SLA rate of full
  // compliance rendered as "1.0%" instead of "100.0%" (#3136). The heuristic
  // stays as the fallback for columns that arrive without the annotation.
  const display = isPercent
    ? (percentScale ? (percentScale === 'fraction' ? v * 100 : v) : percentDisplayValue(v))
    : v;
  const body = formatNumberInLocale(display, locale, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  });
  // The '%' stays a LITERAL suffix rather than `Intl`'s `style: 'percent'`,
  // and that is a measured choice, not an oversight (objectui#4566). The
  // percent STYLE would re-scale by 100, and the round trip loses precision at
  // the top of the range: en `100,000,000,000,000,000,000,000%` becomes
  // `99,999,999,999,999,990,000,000%`. English output moving is the signal that
  // a mapping is wrong on this card — unlike `formatPercent`'s (objectui#4553),
  // where en had never grouped and moving it WAS the fix. The consequence is
  // that a German session reads `1.234,5%` here and `1.234,5 %` (no-break space,
  // the German percent convention) from a list cell; that divergence is real,
  // is narrower than the one this card closes, and is filed separately rather
  // than smuggled in behind a locale fix.
  return `${legacyDollar}${body}${isPercent ? '%' : ''}`;
}

/**
 * Format a non-measure (dimension / label) value — the server already resolves
 * dimension display labels, so this only tidies numbers and nulls.
 *
 * `locale` follows {@link formatMeasure}: optional, last, and omitting it
 * reproduces the previous machine-locale output byte for byte. Integers stay
 * verbatim here for the same measured reason as there.
 */
export function formatDimensionValue(v: unknown, locale?: string): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : formatNumberInLocale(v, locale, { maximumFractionDigits: 2 });
  }
  return String(v);
}

/**
 * Resolve a column header / measure helper pair for one result set.
 * `headerLabel` maps a dimension/measure NAME to its display label — the
 * server-enriched field `label`, then (when `fieldLabel` is supplied) through
 * the i18n field-label convention so a translated label wins, then the raw name
 * as a last resort. `measureField` exposes a field's `format`/`currency`.
 *
 * `fieldLabel` is injected (rather than imported) so this stays React/i18n-free;
 * callers pass `useSafeFieldLabel().fieldLabel`.
 */
export function buildDatasetFieldHelpers(
  fields: DatasetResultField[] | undefined,
  object: string | undefined,
  fieldLabel?: (objectName: string, fieldName: string, fallback: string) => string,
): {
  measureField: (name: string) => DatasetResultField | undefined;
  headerLabel: (name: string) => string;
} {
  const fieldByName = new Map((fields ?? []).map((f) => [f.name, f] as const));
  const measureField = (name: string) => fieldByName.get(name);
  const headerLabel = (name: string) => {
    const fallback = measureField(name)?.label ?? name;
    return object && fieldLabel ? fieldLabel(object, name, fallback) : fallback;
  };
  return { measureField, headerLabel };
}

/**
 * A half-open date-range drill scope for one time-bucketed dimension (#1752):
 * the object FIELD to filter and its inclusive `gte` / exclusive `lt` bounds
 * (the server's `drillRanges` sidecar entry).
 */
export interface DatasetDrillRange {
  field: string;
  gte: unknown;
  lt: unknown;
}

/**
 * Build the record-list filter for a drilled dataset bucket (ADR-0021 D2).
 *
 * Each drillable dimension maps to its underlying object field, filtered by the
 * dimension's RAW grouped value (from the server's parallel `drillRawRows`, NOT
 * the visible row which carries the display LABEL — a select/lookup label would
 * mis-filter). An empty/undefined raw value normalizes to `null` (an explicit
 * "is empty" filter). The render-time `runtimeFilter` is ANDed in so the drilled
 * list stays within the same slice the aggregate was computed over.
 *
 * A time-bucketed date dimension (#1752) drills by RANGE, not equality — a
 * humanized bucket ("2026-Q2") can't be exact-matched, so the server sends a
 * half-open `[gte, lt)` per date dim in `rawRanges` instead of a raw value.
 * Each becomes an ObjectQL range operator object (`{ $gte, $lt }`) so the drill
 * scopes the list to the clicked time bucket instead of every bucket (which the
 * old date-dim skip degraded to — a superset).
 *
 * Shared by the dashboard `DatasetWidget` and the report renderer so a drill
 * filters identically (and correctly, including lookups) on both surfaces.
 */
export function buildDatasetDrillFilter(
  rawRow: Record<string, unknown> | undefined,
  drillDims: string[],
  dimensionFields: Record<string, string>,
  runtimeFilter?: Record<string, unknown>,
  rawRanges?: Record<string, DatasetDrillRange>,
): Record<string, unknown> {
  const drillFilter: Record<string, unknown> = {};
  for (const d of drillDims) {
    const raw = rawRow?.[d];
    drillFilter[dimensionFields[d]] = raw === '' || raw === undefined ? null : raw;
  }
  if (rawRanges) {
    for (const r of Object.values(rawRanges)) {
      if (r && r.field) drillFilter[r.field] = { $gte: r.gte, $lt: r.lt };
    }
  }
  return runtimeFilter ? { ...runtimeFilter, ...drillFilter } : drillFilter;
}
