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
import { useLocalization, resolveFieldCurrency } from '@object-ui/i18n';

/**
 * Aggregation functions for the column footer — the spec's `ColumnSummary`
 * vocabulary itself, not a copy of it (objectui#3161, objectstack#4115 ledger
 * batch 7).
 *
 * The eleven members used to be spelled out here under a comment promising they
 * were "kept in lockstep with the spec enum" — a promise nothing enforced. They
 * are the enum now, which turns `TYPE_LABELS` below into the thing that reports
 * a divergence: it is a total `Record<ColumnSummaryType, string>`, so a member
 * the spec adds is a compile error naming the missing label instead of a footer
 * cell that renders blank.
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

const TYPE_LABELS: Record<ColumnSummaryType, string> = {
  none: '',
  count: 'Count',
  count_empty: 'Empty',
  count_filled: 'Filled',
  count_unique: 'Unique',
  // The trailing `%` is what distinguishes these from the count-family pair.
  percent_empty: 'Empty',
  percent_filled: 'Filled',
  sum: 'Sum',
  avg: 'Avg',
  min: 'Min',
  max: 'Max',
};

/**
 * Every aggregation name the renderer computes. A Set rather than an `in` check
 * against TYPE_LABELS, because `in` also matches inherited keys — a column
 * configured with `summary: 'toString'` would otherwise read as supported.
 *
 * Exported so a test can assert it covers the spec's `ColumnSummarySchema`
 * exactly: a name the schema accepts but this set omits validates at authoring
 * time and then renders a blank footer cell.
 */
export const SUPPORTED_SUMMARY_TYPES: ReadonlySet<string> = new Set<string>(Object.keys(TYPE_LABELS));

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
 */
function formatSummaryLabel(
  type: string,
  value: number | null,
  column?: { type?: string; currency?: string; defaultCurrency?: string; currencyConfig?: { defaultCurrency?: string }; precision?: number | null; scale?: number | null },
  tenantDefault?: string,
): string {
  if (value === null) return '';
  const label = TYPE_LABELS[type as ColumnSummaryType] || type;

  if (PERCENT_TYPES.has(type)) {
    return `${label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }
  if (NON_NUMERIC_TYPES.has(type)) {
    return `${label}: ${value.toLocaleString()}`;
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
  return `${label}: ${formatted}`;
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
        label: formatSummaryLabel(config.type, result, columnHints, tenantCurrency),
      });
    }

    return { summaries, hasSummary: summaries.size > 0 };
  }, [columns, data, fieldMetadata, tenantCurrency]);
}
