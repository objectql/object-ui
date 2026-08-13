/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import type { ListColumn } from '@object-ui/types';
import type { ColumnSummary } from '@objectstack/spec/ui';
import { useLocalization, resolveFieldCurrency, createSafeTranslation } from '@object-ui/i18n';

/**
 * Aggregation functions for the column footer — the spec's `ColumnSummary`
 * vocabulary itself, not a copy of it (objectui#3161, objectstack#4115 ledger
 * batch 7).
 *
 * The eleven members used to be spelled out here under a comment promising they
 * were "kept in lockstep with the spec enum" — a promise nothing enforced. They
 * are the enum now, which turns `TYPE_LABEL_KEYS` below into the thing that
 * reports a divergence: it is a total `Record<ColumnSummaryType, string>`, so a
 * member the spec adds is a compile error naming the missing label key instead
 * of a footer cell that renders blank.
 */
export type ColumnSummaryType = ColumnSummary;

/**
 * What a column's `summary` may be: the string shorthand (`summary: 'sum'`,
 * aggregating the column's own field) or the object form carrying a per-column
 * `field` override.
 *
 * Taken straight off `ListColumn['summary']` rather than restated. It was
 * called `ColumnSummaryConfig`, which is a name the spec owns for only HALF of
 * this union — `ColumnSummaryConfig` there is the OBJECT form alone
 * (`{ type, field? }`), while the shorthand is `ColumnSummary`. So the local
 * declaration wore the spec's name for a strictly wider type: code written
 * against `ColumnSummaryConfig` here accepted `'sum'`, and the same name
 * imported from the spec rejects it. Binding to `ListColumn['summary']` makes
 * the spec's own union the definition, so a third accepted form would arrive
 * here automatically.
 */
export type ColumnSummarySetting = NonNullable<ListColumn['summary']>;

export interface ColumnSummaryResult {
  field: string;
  value: number | null;
  label: string;
}

/** A data row as the aggregations read it — cells are untyped until inspected. */
type SummaryRow = Record<string, unknown>;

/**
 * Aggregations that read raw cell values instead of parsed numbers, so they
 * work on text, select and lookup columns rather than numeric ones only.
 */
const NON_NUMERIC_TYPES = new Set<string>([
  'count',
  'count_empty',
  'count_filled',
  'count_unique',
  'percent_empty',
  'percent_filled',
]);

/** Aggregations whose result is a percentage (0-100), not a value in the column's unit. */
const PERCENT_TYPES = new Set<string>(['percent_empty', 'percent_filled']);

/**
 * Bundle key per aggregation — objectui#4024.
 *
 * The footer's NUMBER was already locale-formatted while the PREFIX in front of
 * it was a hardcoded English literal, so a zh-CN console read `Avg: 39%` with a
 * correctly formatted `39%`. The aggregate kind is known here, so the prefix was
 * one bundle lookup away.
 *
 * Still a total `Record<ColumnSummaryType, string>`, which is the property the
 * header above describes: a member the spec adds is a compile error naming the
 * missing key, rather than a footer cell that renders blank.
 *
 * `none` maps to the empty string, not to a key — it is the spec's explicit
 * opt-out and never reaches a label (`useColumnSummary` skips it), so giving it
 * a key would put an unreachable entry in ten packs.
 */
const TYPE_LABEL_KEYS: Record<ColumnSummaryType, string> = {
  none: '',
  count: 'grid.summary.count',
  count_empty: 'grid.summary.countEmpty',
  count_filled: 'grid.summary.countFilled',
  count_unique: 'grid.summary.countUnique',
  // The trailing `%` is what distinguishes these from the count-family pair —
  // which is why the two families deliberately share a word in every pack.
  percent_empty: 'grid.summary.percentEmpty',
  percent_filled: 'grid.summary.percentFilled',
  sum: 'grid.summary.sum',
  avg: 'grid.summary.avg',
  min: 'grid.summary.min',
  max: 'grid.summary.max',
};

/**
 * English fallbacks for the provider-less path (the objectui#4514 trap).
 *
 * `useColumnSummary` is a PUBLIC export of this package and its own sibling
 * suite (`useColumnSummary.test.tsx`) asserts `/Sum: /` with only a
 * `LocalizationProvider` mounted. `createSafeTranslation` is what keeps that —
 * and every downstream consumer's provider-less test — rendering English
 * instead of `grid.summary.sum`.
 */
const SUMMARY_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'grid.summary.pattern': '{{label}}: {{value}}',
  'grid.summary.count': 'Count',
  'grid.summary.countEmpty': 'Empty',
  'grid.summary.countFilled': 'Filled',
  'grid.summary.countUnique': 'Unique',
  'grid.summary.percentEmpty': 'Empty',
  'grid.summary.percentFilled': 'Filled',
  'grid.summary.sum': 'Sum',
  'grid.summary.avg': 'Avg',
  'grid.summary.min': 'Min',
  'grid.summary.max': 'Max',
};

const useSummaryTranslation = createSafeTranslation(
  SUMMARY_DEFAULT_TRANSLATIONS,
  'grid.summary.sum',
);

/** The translator shape `formatSummaryLabel` needs — i18next's `t`, narrowed. */
type SummaryTranslate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Every aggregation name the renderer computes. A Set rather than an `in` check
 * against TYPE_LABEL_KEYS, because `in` also matches inherited keys — a column
 * configured with `summary: 'toString'` would otherwise read as supported.
 *
 * Exported so a test can assert it covers the spec's `ColumnSummarySchema`
 * exactly: a name the schema accepts but this set omits validates at authoring
 * time and then renders a blank footer cell.
 */
export const SUPPORTED_SUMMARY_TYPES: ReadonlySet<string> = new Set<string>(
  Object.keys(TYPE_LABEL_KEYS),
);

/**
 * Emptiness test for the count/percent aggregations. Matches the convention
 * used elsewhere in the codebase (audit history display, form dirty-checking):
 * null/undefined/empty-string, plus empty arrays so an unset multi-select or
 * lookup column counts as empty instead of as a filled `[]`.
 */
const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Stable identity for `count_unique`. Object and array cells (lookup and
 * multi-select columns) compare by value — a raw `Set` compares by reference
 * and would report every row as unique.
 */
function uniqueKey(v: unknown): unknown {
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v) ?? String(v);
    } catch {
      return String(v);
    }
  }
  return v;
}

/**
 * Normalize summary config from string or object to a standard shape.
 */
function normalizeSummary(summary: ColumnSummarySetting): { type: string; field?: string } {
  if (typeof summary === 'string') {
    return { type: summary };
  }
  return summary;
}

/**
 * Collect the numeric values of a field, parsing numeric strings so a column
 * backed by string-encoded decimals still aggregates.
 */
function numericValues(rows: SummaryRow[], field: string): number[] {
  const values: number[] = [];
  for (const row of rows) {
    const v = row[field];
    if (typeof v === 'number' && !isNaN(v)) {
      values.push(v);
    } else if (typeof v === 'string') {
      const parsed = parseFloat(v);
      if (!isNaN(parsed)) values.push(parsed);
    }
  }
  return values;
}

/**
 * Compute a single aggregation over the rows.
 *
 * The count and percent families are cardinalities over *raw* cell values, so
 * they are computed before the numeric parse — `count_unique` on a text column
 * has to work, and a row whose value does not parse as a number is still a
 * filled row.
 */
function computeAggregation(type: string, rows: SummaryRow[], field: string): number | null {
  if (NON_NUMERIC_TYPES.has(type)) {
    const total = rows.length;
    if (total === 0) return null;

    switch (type) {
      case 'count':
        // Every row, filled or not — `count_filled` is the non-empty variant.
        return total;
      case 'count_filled':
        return rows.filter((r) => !isEmptyValue(r[field])).length;
      case 'count_empty':
        return rows.filter((r) => isEmptyValue(r[field])).length;
      case 'count_unique': {
        // An empty cell is not a distinct value, it is the absence of one.
        const seen = new Set<unknown>();
        for (const row of rows) {
          const v = row[field];
          if (!isEmptyValue(v)) seen.add(uniqueKey(v));
        }
        return seen.size;
      }
      case 'percent_filled':
        return (rows.filter((r) => !isEmptyValue(r[field])).length / total) * 100;
      case 'percent_empty':
        return (rows.filter((r) => isEmptyValue(r[field])).length / total) * 100;
      default:
        return null;
    }
  }

  const values = numericValues(rows, field);
  if (values.length === 0) return null;

  switch (type) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return null;
  }
}

/**
 * Format a summary value for display.
 *
 * When a `column` carries type metadata (e.g. `type: 'currency'` or
 * `'percent'`) we route the numeric result through the matching
 * formatter so currency columns render as `$1,234.56` and percent
 * columns as `12%` instead of falling back to a bare `toLocaleString()`.
 * Currency code defaults to USD when neither `currency` nor
 * `defaultCurrency` is supplied — mirrors the CurrencyCellRenderer
 * behavior so cells and footer agree.
 *
 * That column formatting applies to the numeric family only. Count
 * aggregations are plain cardinalities and percent aggregations carry their own
 * unit, so neither may inherit the column's currency or percent formatting —
 * `count_unique` on a currency column reads "3", not "$3.00".
 *
 * ## The label/value JOIN is a bundle key too (objectui#4024)
 *
 * The three arms below used to build `` `${label}: ${formatted}` ``, which hands
 * the locale the WORD and keeps the PUNCTUATION in English. ja/zh set a
 * fullwidth colon and ar runs right-to-left, so the separator is translatable
 * content: `grid.summary.pattern` owns the whole shape and a pack is free to
 * spell it 「合计:119,200」. Same reasoning as `collaboration.resolvedSuffix`
 * in the packs — "separator included, so a translator owns the whole phrase
 * rather than inheriting an English-shaped glue".
 *
 * The NUMBER is untouched: every `toLocaleString` / `Intl.NumberFormat` call
 * below is exactly as it was, and stays #4589's surface rather than this
 * card's.
 */
function formatSummaryLabel(
  type: string,
  value: number | null,
  t: SummaryTranslate,
  column?: { type?: string; currency?: string; defaultCurrency?: string; currencyConfig?: { defaultCurrency?: string }; precision?: number | null; scale?: number | null },
  tenantDefault?: string,
): string {
  if (value === null) return '';
  const labelKey = TYPE_LABEL_KEYS[type as ColumnSummaryType];
  // `|| type` is the backstop for an aggregation with no key — it echoes the
  // raw kind, as before, never a half-resolved `grid.summary.<junk>`.
  const label = labelKey ? t(labelKey) : type;
  const join = (formatted: string): string =>
    t('grid.summary.pattern', { label, value: formatted });

  if (PERCENT_TYPES.has(type)) {
    return join(`${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`);
  }
  if (NON_NUMERIC_TYPES.has(type)) {
    return join(value.toLocaleString());
  }

  const colType = column?.type;
  let formatted: string;
  if (colType === 'currency') {
    const currency = resolveFieldCurrency(column, tenantDefault);
    // Decimal places come from `scale`, not `precision` (the total digit count
    // of a decimal(p, s) column) — see #2131. Reading `precision` padded a
    // decimal(10, 0) sum out to "…0000000000".
    const decimals = column?.scale ?? 0;
    try {
      formatted = currency
        ? new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }).format(value)
        : new Intl.NumberFormat(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }).format(value);
    } catch {
      formatted = value.toLocaleString();
    }
  } else if (colType === 'percent') {
    const decimals = column?.precision ?? 0;
    const pct = (value > -1 && value < 1) ? value * 100 : value;
    formatted = `${pct.toFixed(decimals)}%`;
  } else if (type === 'avg') {
    formatted = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else {
    formatted = value.toLocaleString();
  }
  return join(formatted);
}

/**
 * Hook to compute column summary/aggregation values.
 *
 * @param columns - Column definitions (may include `summary` config)
 * @param data - Row data array
 * @param fieldMetadata - Optional `objectSchema.fields` map; when present
 *   the hook reads `type`/`currency`/`precision` to format the summary
 *   in the column's native unit (currency → `$1,234.56`, percent → `12%`).
 * @returns Map of field name to summary result, and a flag if any summaries exist
 */
export function useColumnSummary(
  columns: ListColumn[] | undefined,
  data: any[],
  fieldMetadata?: Record<string, { type?: string; currency?: string; defaultCurrency?: string; precision?: number | null; scale?: number | null }>
): { summaries: Map<string, ColumnSummaryResult>; hasSummary: boolean } {
  // Tenant default currency (ADR-0053) backstops a currency column that
  // declares no explicit code, so the footer agrees with the cells above it.
  const { currency: tenantCurrency } = useLocalization();
  // Aggregate-prefix bundle lookups (objectui#4024). Provider-safe: with no
  // I18nProvider this resolves the English defaults table, never a raw key.
  const { t } = useSummaryTranslation();
  return useMemo(() => {
    const summaries = new Map<string, ColumnSummaryResult>();

    if (!columns || columns.length === 0 || data.length === 0) {
      return { summaries, hasSummary: false };
    }

    for (const col of columns) {
      if (!col.summary) continue;

      const config = normalizeSummary(col.summary as ColumnSummarySetting);

      // `none` is the spec's explicit opt-out, and an unrecognized name has no
      // value to show. Both skip the entry entirely rather than registering a
      // blank one — otherwise a view whose columns all say `none` would render
      // an empty footer row.
      if (config.type === 'none' || !SUPPORTED_SUMMARY_TYPES.has(config.type)) continue;

      const targetField = config.field || col.field;
      const result = computeAggregation(config.type, data, targetField);

      // Merge column-level hints (`col.currency`, `col.precision`, etc.) with
      // any matching fieldMetadata entry so authors get correct currency/
      // percent formatting without restating type info on every column.
      const meta = fieldMetadata?.[targetField];
      const columnHints = {
        type: (col as any).type ?? meta?.type,
        currency: (col as any).currency ?? meta?.currency,
        defaultCurrency: (col as any).defaultCurrency ?? meta?.defaultCurrency,
        precision: (col as any).precision ?? meta?.precision,
        scale: (col as any).scale ?? meta?.scale,
      };

      summaries.set(col.field, {
        field: col.field,
        value: result,
        label: formatSummaryLabel(config.type, result, t, columnHints, tenantCurrency),
      });
    }

    return { summaries, hasSummary: summaries.size > 0 };
  }, [columns, data, fieldMetadata, tenantCurrency, t]);
}
