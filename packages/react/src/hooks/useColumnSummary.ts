/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';

/** Summary function types aligned with ColumnSummarySchema */
export type SummaryFunction = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';

export interface ColumnSummaryConfig {
  /** The field/column to aggregate */
  field: string;
  /** The aggregation function */
  function: SummaryFunction;
  /** Optional label for the summary */
  label?: string;
  /** Number format options */
  format?: Intl.NumberFormatOptions;
}

export interface ColumnSummaryResult {
  /** The computed value */
  value: number;
  /** Formatted display string */
  formatted: string;
  /** The label */
  label: string;
}

/**
 * Hook for computing column-level summaries (SUM, AVG, COUNT, MIN, MAX, DISTINCT).
 * Implements ColumnSummarySchema from @objectstack/spec v2.0.7.
 *
 * @example
 * ```tsx
 * const summary = useColumnSummary(data, { field: 'amount', function: 'sum', label: 'Total' });
 * // summary.formatted => "$12,345.67"
 * ```
 */
export function useColumnSummary(
  data: Record<string, unknown>[],
  config: ColumnSummaryConfig,
  locale?: string
): ColumnSummaryResult {
  return useMemo(() => {
    const values = data
      .map((row) => {
        const val = row[config.field];
        return typeof val === 'number' ? val : Number(val);
      })
      .filter((v) => !isNaN(v));

    let value: number;

    switch (config.function) {
      case 'sum':
        value = values.reduce((acc, v) => acc + v, 0);
        break;
      case 'avg':
        value = values.length > 0 ? values.reduce((acc, v) => acc + v, 0) / values.length : 0;
        break;
      case 'count':
        value = data.length;
        break;
      case 'min':
        value = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        value = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'distinct':
        value = new Set(data.map((row) => row[config.field])).size;
        break;
      default:
        value = 0;
    }

    const formatted = new Intl.NumberFormat(locale, config.format).format(value);
    const label = config.label ?? config.function.toUpperCase();

    return { value, formatted, label };
  }, [data, config.field, config.function, config.label, config.format, locale]);
}
