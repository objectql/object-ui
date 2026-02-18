/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo } from 'react';
import type { PivotTableSchema, PivotAggregation } from '@object-ui/types';
import { cn } from '@object-ui/components';

export interface PivotTableProps {
  schema: PivotTableSchema;
  className?: string;
}

/** Apply a simple format string to a number. Supports prefix/suffix like "$,.2f". */
function formatValue(value: number, format?: string): string {
  if (!format) return String(value);

  let prefix = '';
  let suffix = '';
  let useGrouping = false;
  let decimals: number | undefined;

  let fmt = format;

  // Extract leading non-format characters as prefix (e.g. "$")
  const prefixMatch = fmt.match(/^([^0-9.,#]*)/);
  if (prefixMatch && prefixMatch[1]) {
    // comma inside the prefix-ish area means grouping, not a literal prefix
    const raw = prefixMatch[1];
    prefix = raw.replace(',', '');
    if (raw.includes(',')) useGrouping = true;
    fmt = fmt.slice(prefixMatch[1].length);
  }

  // Grouping indicator anywhere remaining
  if (fmt.includes(',')) {
    useGrouping = true;
    fmt = fmt.replace(/,/g, '');
  }

  // Decimal specifier e.g. ".2f"
  const decMatch = fmt.match(/\.(\d+)f?/);
  if (decMatch) {
    decimals = Number(decMatch[1]);
    fmt = fmt.slice(decMatch[0].length);
  }

  // Remaining characters become suffix
  suffix = fmt.replace(/[0-9#.f]/g, '');

  const formatted = decimals !== undefined ? value.toFixed(decimals) : String(value);

  if (useGrouping) {
    const [intPart, decPart] = formatted.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return prefix + (decPart !== undefined ? `${grouped}.${decPart}` : grouped) + suffix;
  }

  return prefix + formatted + suffix;
}

/** Aggregate an array of numbers with the given function. */
function aggregate(values: number[], fn: PivotAggregation): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'count':
      return values.length;
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/**
 * PivotTable – Cross-tabulation / Pivot Table component.
 *
 * Renders a matrix where rows correspond to `rowField`, columns to
 * `columnField`, and cells show the aggregated `valueField`.
 */
export const PivotTable: React.FC<PivotTableProps> = ({ schema, className }) => {
  const {
    title,
    rowField,
    columnField,
    valueField,
    aggregation = 'sum',
    data = [],
    showRowTotals = false,
    showColumnTotals = false,
    format,
    columnColors,
  } = schema;

  const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal } = useMemo(() => {
    // Collect unique row/column values preserving insertion order
    const rowSet = new Map<string, true>();
    const colSet = new Map<string, true>();
    // Bucket raw values: bucket[row][col] = number[]
    const bucket: Record<string, Record<string, number[]>> = {};

    for (const item of data) {
      const r = String(item[rowField] ?? '');
      const c = String(item[columnField] ?? '');
      const v = Number(item[valueField]) || 0;

      rowSet.set(r, true);
      colSet.set(c, true);

      if (!bucket[r]) bucket[r] = {};
      if (!bucket[r][c]) bucket[r][c] = [];
      bucket[r][c].push(v);
    }

    const rKeys = Array.from(rowSet.keys());
    const cKeys = Array.from(colSet.keys());

    // Build aggregated matrix
    const mat: Record<string, Record<string, number>> = {};
    const rTotals: Record<string, number> = {};
    const cTotals: Record<string, number> = {};

    for (const r of rKeys) {
      mat[r] = {};
      const rowValues: number[] = [];
      for (const c of cKeys) {
        const cellValues = bucket[r]?.[c] ?? [];
        const cellAgg = aggregate(cellValues, aggregation);
        mat[r][c] = cellAgg;
        rowValues.push(...cellValues);

        // Accumulate column bucket values for column totals
        if (!cTotals[c] && cTotals[c] !== 0) {
          // Will compute after
        }
      }
      rTotals[r] = aggregate(rowValues, aggregation);
    }

    // Column totals
    for (const c of cKeys) {
      const colValues: number[] = [];
      for (const r of rKeys) {
        const cellValues = bucket[r]?.[c] ?? [];
        colValues.push(...cellValues);
      }
      cTotals[c] = aggregate(colValues, aggregation);
    }

    // Grand total
    const allValues: number[] = [];
    for (const item of data) {
      allValues.push(Number(item[valueField]) || 0);
    }
    const gt = aggregate(allValues, aggregation);

    return { rowKeys: rKeys, colKeys: cKeys, matrix: mat, rowTotals: rTotals, colTotals: cTotals, grandTotal: gt };
  }, [data, rowField, columnField, valueField, aggregation]);

  const fmt = (v: number) => formatValue(v, format);

  return (
    <div className={cn('overflow-auto', className)}>
      {title && (
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
      )}
      <table className="w-full text-sm border-collapse" role="table">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 font-medium text-muted-foreground">{rowField}</th>
            {colKeys.map((col) => (
              <th
                key={col}
                className={cn(
                  'text-right p-2 font-medium',
                  columnColors?.[col] ?? 'text-muted-foreground',
                )}
              >
                {col}
              </th>
            ))}
            {showRowTotals && (
              <th className="text-right p-2 font-semibold text-muted-foreground">Total</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((row) => (
            <tr key={row} className="border-b border-border/50 hover:bg-muted/30">
              <td className="p-2 font-medium">{row}</td>
              {colKeys.map((col) => (
                <td
                  key={col}
                  className={cn(
                    'text-right p-2 tabular-nums',
                    columnColors?.[col],
                  )}
                >
                  {fmt(matrix[row]?.[col] ?? 0)}
                </td>
              ))}
              {showRowTotals && (
                <td className="text-right p-2 font-semibold tabular-nums">
                  {fmt(rowTotals[row] ?? 0)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {showColumnTotals && (
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="p-2">Total</td>
              {colKeys.map((col) => (
                <td key={col} className="text-right p-2 tabular-nums">
                  {fmt(colTotals[col] ?? 0)}
                </td>
              ))}
              {showRowTotals && (
                <td className="text-right p-2 tabular-nums">
                  {fmt(grandTotal)}
                </td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};
