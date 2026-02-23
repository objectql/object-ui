/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import type { ListColumn } from '@object-ui/types';

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
 */
function formatSummaryLabel(type: string, value: number | null): string {
  if (value === null) return '';
  const typeLabels: Record<string, string> = {
    count: 'Count',
    sum: 'Sum',
    avg: 'Avg',
    min: 'Min',
    max: 'Max',
  };
  const label = typeLabels[type] || type;
  const formatted = type === 'avg'
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value.toLocaleString();
  return `${label}: ${formatted}`;
}

/**
 * Hook to compute column summary/aggregation values.
 *
 * @param columns - Column definitions (may include `summary` config)
 * @param data - Row data array
 * @returns Map of field name to summary result, and a flag if any summaries exist
 */
export function useColumnSummary(
  columns: ListColumn[] | undefined,
  data: any[]
): { summaries: Map<string, ColumnSummaryResult>; hasSummary: boolean } {
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
      const effectiveValues = config.type === 'count'
        ? data.filter(row => row[targetField] != null && row[targetField] !== '').map((_, i) => i)
        : values;

      const result = computeAggregation(config.type, effectiveValues);
      summaries.set(col.field, {
        field: col.field,
        value: result,
        label: formatSummaryLabel(config.type, result),
      });
    }

    return { summaries, hasSummary: summaries.size > 0 };
  }, [columns, data]);
}
