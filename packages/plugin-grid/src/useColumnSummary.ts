/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import type { ListColumn } from '@object-ui/types';
import { useLocalization, resolveFieldCurrency } from '@object-ui/i18n';

/**
 * Summary configuration for a column.
 * Can be a string shorthand (e.g. 'sum') or a full config object.
 */
export type ColumnSummaryConfig = string | { type: 'count' | 'sum' | 'avg' | 'min' | 'max'; field?: string };

export interface ColumnSummaryResult {
  field: string;
  value: number | null;
  label: string;
}

/**
 * Normalize summary config from string or object to a standard shape.
 */
function normalizeSummary(summary: ColumnSummaryConfig): { type: string; field?: string } {
  if (typeof summary === 'string') {
    return { type: summary };
  }
  return summary;
}

/**
 * Compute a single aggregation over data values.
 */
function computeAggregation(type: string, values: number[]): number | null {
  if (values.length === 0) return null;

  switch (type) {
    case 'count':
      return values.length;
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
 */
function formatSummaryLabel(
  type: string,
  value: number | null,
  column?: { type?: string; currency?: string; defaultCurrency?: string; currencyConfig?: { defaultCurrency?: string }; precision?: number | null; scale?: number | null },
  tenantDefault?: string,
): string {
  if (value === null) return '';
  const typeLabels: Record<string, string> = {
    count: 'Count',
    sum: 'Sum',
    avg: 'Avg',
    min: 'Min',
    max: 'Max',
  };
  const label = typeLabels[type] || type;

  const colType = column?.type;
  let formatted: string;
  if (type !== 'count' && colType === 'currency') {
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
  } else if (type !== 'count' && colType === 'percent') {
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

      const config = normalizeSummary(col.summary as ColumnSummaryConfig);
      const targetField = config.field || col.field;

      // Extract numeric values from data
      const values: number[] = [];
      for (const row of data) {
        const v = row[targetField];
        if (v != null && typeof v === 'number' && !isNaN(v)) {
          values.push(v);
        } else if (v != null && typeof v === 'string') {
          const parsed = parseFloat(v);
          if (!isNaN(parsed)) values.push(parsed);
        }
      }

      // For 'count', count all non-null values (not just numeric)
      let result: number | null;
      if (config.type === 'count') {
        const count = data.filter(row => row[targetField] != null && row[targetField] !== '').length;
        result = count > 0 ? count : null;
      } else {
        result = computeAggregation(config.type, values);
      }

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
