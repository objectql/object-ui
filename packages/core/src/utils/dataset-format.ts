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

/**
 * Column metadata the analytics server returns alongside the rows: a display
 * `label` for both dimensions and measures, plus a measure's numeral `format`
 * and declared `currency`. A superset of {@link ChartResultField} (which only
 * needs name/label/format).
 */
export interface DatasetResultField {
  name: string;
  type?: string;
  label?: string;
  format?: string;
  currency?: string;
}

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
 * Format a MEASURE value. Currency comes from the field's declared `currency`
 * (locale-correct symbol via `Intl`), NOT from a "$" baked into the format
 * string — an amount with no declared currency must render as a plain number,
 * never a misleading "$". The numeral `format` hint (e.g. "0,0", "0.0%")
 * controls grouping / decimals / percent; it can't be baked into the row value
 * server-side (the same number feeds charts), so it is applied here.
 */
export function formatMeasure(v: unknown, format?: string, currency?: string): string {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);

  const decimals = format ? (format.split('.')[1]?.match(/0/g)?.length ?? 0) : undefined;

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 2,
      }).format(v);
    } catch {
      // Unknown currency code → fall through to plain number formatting.
    }
  }

  if (!format) {
    // No format hint → preserve the plain rendering (integers verbatim).
    return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const isPercent = format.includes('%');
  // A legacy "$" literal in the format string is still honored (explicit author
  // choice) — but it is NOT how a real currency field gets its symbol.
  const legacyDollar = format.includes('$') ? '$' : '';
  // numeral's "0.0%" multiplies by 100, and a percent field stores a FRACTION
  // (0.75 ⇒ 75%). Scale to display magnitude the SAME way the list-view cell
  // renderer does — otherwise an avg of 0.608 renders as "0.6%" instead of
  // "60.8%", disagreeing with the per-row "75%" the list already shows.
  const display = isPercent ? percentDisplayValue(v) : v;
  const body = display.toLocaleString(undefined, { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0 });
  return `${legacyDollar}${body}${isPercent ? '%' : ''}`;
}

/**
 * Format a non-measure (dimension / label) value — the server already resolves
 * dimension display labels, so this only tidies numbers and nulls.
 */
export function formatDimensionValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
