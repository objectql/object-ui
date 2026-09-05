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

import { formatDisplayNumber, type DisplayNumberFormatOptions } from './number-display.js';
import { formatDate, formatDateTime } from './date-display.js';
import { resolveMeasureLabel, type BuiltinAggregateLabels } from './chart-series.js';

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
 *
 * ⚠️ That last sentence was briefly FALSE, and objectui#4576 is what made it
 * true again. Sharing the SCALING was never enough on its own: between #4553
 * and #4576 the cell renderer got the locale's percent CONVENTION from `Intl`
 * while {@link formatMeasure} appended a literal '%', so a German session read
 * `1.234,5 %` in a list cell and `1.234,5%` in a dashboard measure — the same
 * number, scaled identically, rendered under two conventions. Both ends now go
 * through the locale's own percent affix. If a third surface ever needs percent
 * display, it takes BOTH halves from here — the scaling AND the convention —
 * or this promise breaks again in the same place.
 */
export function percentDisplayValue(value: number): number {
  return value > -1 && value < 1 ? value * 100 : value;
}

/**
 * Format one number in the DISPLAY locale, surviving a malformed locale tag.
 *
 * THE DUPLICATE IS GONE (objectui#4576). This used to be a hand-mirrored copy
 * of the `try`/`catch` retry inside `formatDisplayNumber` — the ONE
 * number-display formatter — kept in step by a comment at each end because a
 * PACKAGE BOUNDARY stood between them: `formatDisplayNumber` lived in
 * `@object-ui/i18n`, which depends on `i18next`/`react-i18next` and
 * peer-depends on React, and this package is the React-free engine. #4566
 * measured the option mapping LOSSLESS across 32,760 combinations and recorded
 * the duplication rather than crossing that boundary; #4576 removed the
 * boundary instead, by moving the pure function DOWN into this package
 * (`./number-display.ts`), where `@object-ui/i18n` now re-exports it.
 *
 * So this is a thin ADAPTER, not a second implementation: it converts the
 * `Intl`-shaped option bag these call sites already speak into
 * {@link DisplayNumberFormatOptions}, and every policy decision — grouping,
 * the malformed-locale retry, the percent convention — is made in the one
 * home. The retry is load-bearing rather than defensive: before #4566 these
 * sites passed a literal `undefined`, which never throws, but a THREADED tag
 * can be malformed and a bare `Intl.NumberFormat('en_US', …)` throws
 * `RangeError` (measured — underscore instead of hyphen is the likeliest
 * tenant-config typo), which would take the whole widget down. A bad
 * `currency` still throws out of both attempts, which is what lets
 * {@link formatMeasure}'s own `catch` fall through to plain-number formatting.
 *
 * ⚠️ `scale` is deliberately never passed. A measure carries no field `scale`
 * (its decimals come from a numeral format PATTERN), so the grouping policy
 * keyed on it must not fire here — which is exactly why #4566 measured the two
 * implementations byte-identical across all 32,760 combinations.
 */
function formatNumberInLocale(
  value: number,
  locale: string | undefined,
  options: Omit<DisplayNumberFormatOptions, 'locale' | 'scale'>,
): string {
  return formatDisplayNumber(value, { ...options, locale });
}

/**
 * ISO calendar date with NO time part — `2026-07-04`.
 *
 * Deliberately anchored at both ends and deliberately narrower than
 * `Date.parse`, which also accepts locale prose (`March 5, 2026`), bare years
 * (`2026`) and — the one that matters here — plain NUMERALS. A measure value
 * is untyped by the time it reaches {@link formatMeasure}, so the shape test
 * IS the type test, and a loose one would capture the numeric strings and
 * counts this formatter must leave exactly as they are.
 */
const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ISO date carrying a time part — `2026-07-04T07:00:00.000Z`, or the same with
 * a space separator, with or without seconds/offset. Matched only as far as
 * `HH:mm`; `Date.parse` decides the rest, so a well-shaped impossible instant
 * still falls through untouched.
 */
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * Render a date-shaped measure value through the display path a list cell
 * already uses for that field, or return `undefined` to say "not a date" and
 * leave the caller's own fallthrough in charge.
 *
 * ── Why this is a ROUTE and not a formatter (objectui#7178) ──
 * Every line of date rendering below happens in `./date-display.ts`, which is
 * where `@object-ui/fields`' `formatDate` / `formatDateTime` now live and what
 * `DateCellRenderer`, `ObjectGrid`'s date cells and `ObjectGantt`'s tooltips
 * call. Writing the date convention HERE instead is the mistake this file's
 * own header is about: objectui#4576, where a percent convention had one copy
 * in a list cell and another in this function, both correct, and a German
 * session read `1.234,5 %` in the cell beside `1.234,5%` in the measure. One
 * date convention, one home, nothing to drift.
 *
 * The date/datetime split mirrors `ObjectGantt.tsx`'s sniffed-ISO dispatch
 * verbatim, because that site is already the repo's answer to this exact
 * situation: an ISO string arriving with NO field type attached. A measure is
 * that situation by construction — the analytics result carries a column, not
 * a field definition — so the absolute locale form is taken rather than
 * `DateCellRenderer`'s `|| 'relative'` default, which is keyed on knowing the
 * value is a `date` FIELD in a row.
 *
 * `format` is threaded into `formatDate`'s STYLE parameter, which is the same
 * mapping `DateCellRenderer` makes from `field.format` and the same one
 * `plugin-dashboard`'s `recordFields` already makes for a date-shaped format.
 * That vocabulary is `'short'` and `'relative'`; a date PATTERN such as
 * `'YYYY-MM-DD'` is not part of it and renders as the locale default. See the
 * `format` note on {@link formatMeasure}.
 */
function formatMeasureDate(v: unknown, format: string | undefined, locale: string | undefined): string | undefined {
  if (typeof v !== 'string') return undefined;
  // `Date.parse` guards both arms so a well-shaped impossible date
  // (`2026-02-30`) is NOT swallowed into the em dash `formatDate` returns for
  // an unparseable value — it keeps falling through to `String(v)`, exactly as
  // it does today. Only a value that is genuinely a date changes.
  if (ISO_DATE_ONLY_RE.test(v)) {
    return Number.isNaN(Date.parse(v)) ? undefined : formatDate(v, format, { locale });
  }
  if (ISO_DATETIME_RE.test(v)) {
    return Number.isNaN(Date.parse(v)) ? undefined : formatDateTime(v, { locale });
  }
  return undefined;
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
 * ── This routes through `formatDisplayNumber` (objectui#4576) ──
 * It did not always. #4566 measured the option mapping across 32,760
 * value × format × currency × percentScale × locale combinations and found it
 * LOSSLESS — routing changes no byte of output, because the policy layer
 * `formatDisplayNumber` adds over plain `Intl` is grouping suppression keyed on
 * a field's declared `scale`, and a measure has no `scale` to feed it (decimals
 * here come from a numeral format PATTERN, so grouping stays on and the two
 * agree everywhere). What blocked it was the PACKAGE BOUNDARY: the formatter
 * lived in `@object-ui/i18n`, which depends on `i18next`/`react-i18next` and
 * peer-depends on React, while this package is the React-free engine (AGENTS.md
 * §3: "No UI-lib deps. Logic only.") and a runtime dependency of React-FREE
 * consumers — the `object-ui` VS Code extension and `@object-ui/data-objectstack`.
 *
 * #4576 removed the boundary rather than working around it: `formatDisplayNumber`
 * is pure, so it moved DOWN into this package (`./number-display.ts`) and
 * `@object-ui/i18n` re-exports it. The duplicate implementation this file used
 * to carry is gone, and with it the drift that duplicate produced — see the
 * percent note in the body, and {@link percentDisplayValue}'s promise, which
 * is true again.
 *
 * ── Date-valued measures (objectui#7178) ──
 * `min` / `max` over a date or datetime field is a legitimate measure, and it
 * used to render its stored value verbatim: the guard above returned
 * `String(v)` for anything non-numeric BEFORE `format` was read, so a KPI tile
 * showed `2026-07-04T07:00:00.000Z` in `text-2xl` and wrapped it over two
 * lines. A date-shaped value now routes through {@link formatMeasureDate} to
 * the display path list cells use; nothing about the numeric path moved.
 *
 * ⚠️ What `format` can and cannot say for those values, measured rather than
 * assumed. The shared date path takes a named STYLE, not a date pattern:
 * `formatDate`'s vocabulary is `'short'` and `'relative'`, and every other
 * string falls to its default locale-medium branch. So `format: 'short'` and
 * `format: 'relative'` are honoured — the same words `DateCellRenderer`
 * honours from `field.format` for the same field — while a PATTERN like
 * `format: 'YYYY-MM-DD'` is accepted by the schema, reaches this function, and
 * renders the locale default. That last part is not new behaviour introduced
 * here: `plugin-dashboard`'s `recordFields` already routes a date-shaped
 * `format` into the same style slot and gets the same locale default. Closing
 * it would mean teaching the shared path a pattern grammar, which is a change
 * to the path itself and to every list cell that reads it — not a measure
 * concern, and not this card.
 */
export function formatMeasure(
  v: unknown,
  format?: string,
  currency?: string,
  percentScale?: PercentScale,
  locale?: string,
): string {
  if (v == null) return '—';
  if (typeof v !== 'number') {
    // Ahead of the `String(v)` short-circuit, which is what made `format` dead
    // on this path and printed a `min`/`max` over a datetime as a raw
    // 24-character ISO string (objectui#7178). Deliberately NOT ahead of the
    // `typeof` test itself: above that line the argument can be a bare number,
    // and any date test generous enough to consider one would have to decide
    // whether `1751612400000` is epoch milliseconds — which is how a measure
    // that counts things starts rendering as a date. Numbers reach the numeral
    // formatter below byte for byte as before.
    const asDate = formatMeasureDate(v, format, locale);
    return asDate ?? String(v);
  }

  const decimals = format ? (format.split('.')[1]?.match(/0/g)?.length ?? 0) : undefined;

  if (currency) {
    try {
      // No `style: 'currency'` here: `formatDisplayNumber` derives that from the
      // presence of `currency` itself, which is also what keeps its "money
      // always groups" policy in one place instead of two.
      return formatNumberInLocale(v, locale, {
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
  // The percent sign is the LOCALE's, not a literal '%' (objectui#4576).
  //
  // Until #4576 this appended a hard-coded '%' to a decimal-formatted body, so
  // a German session read `1.234,5%` from a dashboard measure beside
  // `1.234,5 %` (no-break space — the German percent convention) from a list
  // cell showing the SAME number, because `formatPercent` had gone through
  // `Intl` since #4553. That contradicted {@link percentDisplayValue}'s own
  // promise that the two surfaces "can never drift": the SCALING had stopped
  // drifting, the CONVENTION had started. Measured to differ in de, fr, es, ru,
  // sv, cs, fi (no-break space), tr (the sign moves to the FRONT: `%1.234,5`)
  // and ar (its own sign plus U+061C); en, ja, zh were already identical.
  //
  // `style: 'percentPoints'` is what closes it, and the choice of route is
  // measured, not incidental. `display` is already in percentage POINTS, while
  // `Intl`'s `style: 'percent'` wants a fraction — so routing through that
  // would mean dividing by 100 for `Intl` to multiply straight back, and that
  // round trip is lossy at rounding TIES: 27,581 of 1,200,013
  // ordinary-magnitude en-US forms move (`0.175` at 2 decimals goes from
  // `0.18%` to `0.17%`), plus `MAX_SAFE_INTEGER` and everything from 1e23 up.
  // That count is #4576's tie-dense grid — 0.005 steps to 2,000, precisions
  // 0/1/2 — measured on THIS formatter's call shape. #4590 re-measured the same
  // route through `formatPercent` and reports 27,577 of 1,200,003: a different
  // form set, not a correction of this one.
  //
  // No caller in this repo takes the divide-by-100 route today. `formatPercent`
  // was the last one and moved to `style: 'percentPoints'` in #4590; the two
  // `style: 'percent'` sites left (`element:number`'s format options and the
  // report exporter's Excel options) hand `Intl` a FRACTION, which is that
  // style's own contract and not this trap. The route now survives only where a
  // test constructs it in order to show it disagreeing.
  //
  // Formatting the points directly with the percent UNIT was measured to
  // produce a byte-identical percent affix to `style: 'percent'` across all 171
  // locale tags tested, while moving ZERO of those 1,200,013 en forms — the
  // same convention by a route that does not touch the value.
  const body = formatNumberInLocale(display, locale, {
    style: isPercent ? 'percentPoints' : 'decimal',
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  });
  return `${legacyDollar}${body}`;
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
 *
 * ## `builtinAggregateLabels` (objectui#7534, sibling of #7258)
 *
 * A result field the analytics service minted as a BUILT-IN default measure
 * carries `builtinAggregate` (objectstack#14492) and a hard-coded English
 * `label` ('Count'). {@link resolveMeasureLabel} is the ONE resolver for that —
 * #7258 wired it into `buildChartSeries()`, so a chart legend already read
 * `计数` on a zh console while the table underneath it, the KPI caption, the
 * pivot header and the dataset preview all still said `Count`, because they
 * resolve their titles through here instead.
 *
 * Passing the caller's resolved labels closes that gap without a second
 * resolution order: the discriminator is consulted FIRST (exactly as on the
 * chart seam), the existing `fieldLabel` convention still applies on top, and
 * the raw name is still the floor. Omitting the argument reproduces the
 * previous output byte for byte — an author-declared measure carries no
 * discriminator and keeps its wire `label` verbatim (objectui#4106), and a
 * provider-less host resolves no labels and so changes nothing.
 */
export function buildDatasetFieldHelpers(
  fields: DatasetResultField[] | undefined,
  object: string | undefined,
  fieldLabel?: (objectName: string, fieldName: string, fallback: string) => string,
  builtinAggregateLabels?: BuiltinAggregateLabels,
): {
  measureField: (name: string) => DatasetResultField | undefined;
  headerLabel: (name: string) => string;
} {
  const fieldByName = new Map((fields ?? []).map((f) => [f.name, f] as const));
  const measureField = (name: string) => fieldByName.get(name);
  const headerLabel = (name: string) => {
    const field = measureField(name);
    const fallback = field ? resolveMeasureLabel(field, builtinAggregateLabels) : name;
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
