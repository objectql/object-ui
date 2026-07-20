/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo } from 'react';
import type { PivotTableSchema, PivotAggregation } from '@object-ui/types';
import { cn, DataEmptyState } from '@object-ui/components';
import { isDrillEnabled, type DrillEvent } from '@object-ui/core';
import { useSafeTranslate } from '@object-ui/i18n';

function useTotalLabel(): string {
  return useSafeTranslate()('dashboard.total', 'Total');
}

function useNoDataLabel(): string {
  return useSafeTranslate()('dashboard.noDataAvailable', 'No data available');
}

export interface PivotTableProps {
  schema: PivotTableSchema;
  className?: string;
  /**
   * Optional value→label map for the row field. Callers (e.g.
   * ObjectPivotTable) derive this from the referenced object's schema so the
   * pivot displays select-field labels (e.g. "Proposal") instead of raw
   * stored values (e.g. "proposal").
   */
  rowLabels?: Record<string, string>;
  /** Same as rowLabels but for the column field. */
  columnLabels?: Record<string, string>;
  /** Optional display label for the row field name (e.g. "Stage" for "stage"). */
  rowFieldLabel?: string;
  /**
   * Drill-down click handler. When provided **and** `schema.drillDown` is
   * enabled, cells / row & column headers / totals become interactive.
   * Receives the click context which is forwarded to the drill-down engine.
   */
  onDrillDown?: (event: DrillEvent) => void;
}

/** Apply a simple format string to a number. Supports prefix/suffix like "$,.2f". */
function formatValue(value: number, format?: string): string {
  if (!format) return String(value);

  let prefix = '';
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
  const suffix = fmt.replace(/[0-9#.f]/g, '');

  const formatted = decimals !== undefined ? value.toFixed(decimals) : String(value);

  if (useGrouping) {
    const [intPart, decPart] = formatted.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return prefix + (decPart !== undefined ? `${grouped}.${decPart}` : grouped) + suffix;
  }

  return prefix + formatted + suffix;
}

/** Friendly display label for an empty/null column or row key. */
const EMPTY_KEY_LABEL = '—';

function displayKey(key: string, labels?: Record<string, string>): string {
  if (key === '') return EMPTY_KEY_LABEL;
  return labels?.[key] ?? key;
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
export const PivotTable: React.FC<PivotTableProps> = ({ schema, className, rowLabels, columnLabels, rowFieldLabel, onDrillDown }) => {
  const {
    title,
    rowField,
    columnField,
    valueField,
    aggregation = 'sum',
    data: rawData = [],
    showRowTotals = false,
    showColumnTotals = false,
    format,
    columnColors,
    drillDown,
  } = schema;
  const totalLabel = useTotalLabel();
  const noDataLabel = useNoDataLabel();

  const drillEnabled = isDrillEnabled(drillDown) && typeof onDrillDown === 'function';
  const fireDrill = (ev: DrillEvent) => {
    if (!drillEnabled) return;
    onDrillDown!({
      ...ev,
      rowLabel: ev.rowKey !== undefined ? (rowLabels?.[ev.rowKey] ?? ev.rowKey) : ev.rowLabel,
      colLabel: ev.colKey !== undefined ? (columnLabels?.[ev.colKey] ?? ev.colKey) : ev.colLabel,
    });
  };
  const drillKey = (handler: () => void): React.KeyboardEventHandler => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
  const cellInteractive = drillEnabled
    ? 'cursor-pointer hover:bg-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]'
    : '';

  // Ensure data is always an array – provider config objects must not reach iteration
  const data = Array.isArray(rawData) ? rawData : [];

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

  if (data.length === 0) {
    return (
      <div className={cn('overflow-auto', className)}>
        {title && (
          <h3 className="text-sm font-semibold mb-2">{title}</h3>
        )}
        <DataEmptyState
          data-testid="pivot-empty-state"
          className="py-8 gap-2 [&>h3]:hidden"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          }
          iconWrapperClassName=""
          title=""
          description={noDataLabel}
        />
      </div>
    );
  }

  return (
    <div className={cn('overflow-auto', className)}>
      {title && (
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
      )}
      <table className="w-full text-sm border-collapse table-auto" role="table">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap">{rowFieldLabel || rowField}</th>
            {colKeys.map((col) => {
              const onClick = () => fireDrill({ scope: 'column', colKey: col });
              return (
                <th
                  key={col}
                  className={cn(
                    'text-right p-2 font-medium whitespace-nowrap',
                    col === '' && 'italic text-muted-foreground/70',
                    columnColors?.[col] ?? 'text-muted-foreground',
                    cellInteractive,
                  )}
                  title={col === '' ? `${columnField}: (empty)` : `${columnField}: ${col}`}
                  role={drillEnabled ? 'button' : undefined}
                  tabIndex={drillEnabled ? 0 : undefined}
                  onClick={drillEnabled ? onClick : undefined}
                  onKeyDown={drillEnabled ? drillKey(onClick) : undefined}
                  aria-label={drillEnabled ? `Drill into ${columnField}: ${col || '(empty)'}` : undefined}
                >
                  {displayKey(col, columnLabels)}
                </th>
              );
            })}
            {showRowTotals && (
              <th className="text-right p-2 font-semibold text-muted-foreground bg-muted/20 whitespace-nowrap">{totalLabel}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((row) => (
            <tr key={row} className="border-b border-border/50 hover:bg-muted/30">
              <td
                className={cn(
                  'p-2 font-medium whitespace-nowrap',
                  row === '' && 'italic text-muted-foreground/70',
                  cellInteractive,
                )}
                role={drillEnabled ? 'button' : undefined}
                tabIndex={drillEnabled ? 0 : undefined}
                onClick={drillEnabled ? () => fireDrill({ scope: 'row', rowKey: row }) : undefined}
                onKeyDown={drillEnabled ? drillKey(() => fireDrill({ scope: 'row', rowKey: row })) : undefined}
                aria-label={drillEnabled ? `Drill into ${rowField}: ${row || '(empty)'}` : undefined}
              >
                {displayKey(row, rowLabels)}
              </td>
              {colKeys.map((col) => {
                const value = matrix[row]?.[col] ?? 0;
                const onClick = () => fireDrill({ scope: 'cell', rowKey: row, colKey: col, value });
                return (
                  <td
                    key={col}
                    className={cn(
                      'text-right p-2 tabular-nums',
                      columnColors?.[col],
                      cellInteractive,
                    )}
                    role={drillEnabled ? 'button' : undefined}
                    tabIndex={drillEnabled ? 0 : undefined}
                    onClick={drillEnabled ? onClick : undefined}
                    onKeyDown={drillEnabled ? drillKey(onClick) : undefined}
                    aria-label={drillEnabled ? `Drill into ${rowField}=${row || '(empty)'}, ${columnField}=${col || '(empty)'}` : undefined}
                  >
                    {fmt(value)}
                  </td>
                );
              })}
              {showRowTotals && (
                <td
                  className={cn('text-right p-2 font-semibold tabular-nums bg-muted/20', cellInteractive)}
                  role={drillEnabled ? 'button' : undefined}
                  tabIndex={drillEnabled ? 0 : undefined}
                  onClick={drillEnabled ? () => fireDrill({ scope: 'row', rowKey: row, value: rowTotals[row] ?? 0 }) : undefined}
                  onKeyDown={drillEnabled ? drillKey(() => fireDrill({ scope: 'row', rowKey: row, value: rowTotals[row] ?? 0 })) : undefined}
                >
                  {fmt(rowTotals[row] ?? 0)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {showColumnTotals && (
          <tfoot>
            <tr className="border-t-2 border-border font-semibold bg-muted/40">
              <td className="p-2">{totalLabel}</td>
              {colKeys.map((col) => (
                <td
                  key={col}
                  className={cn('text-right p-2 tabular-nums', cellInteractive)}
                  role={drillEnabled ? 'button' : undefined}
                  tabIndex={drillEnabled ? 0 : undefined}
                  onClick={drillEnabled ? () => fireDrill({ scope: 'column', colKey: col, value: colTotals[col] ?? 0 }) : undefined}
                  onKeyDown={drillEnabled ? drillKey(() => fireDrill({ scope: 'column', colKey: col, value: colTotals[col] ?? 0 })) : undefined}
                >
                  {fmt(colTotals[col] ?? 0)}
                </td>
              ))}
              {showRowTotals && (
                <td
                  className={cn('text-right p-2 tabular-nums font-bold', cellInteractive)}
                  role={drillEnabled ? 'button' : undefined}
                  tabIndex={drillEnabled ? 0 : undefined}
                  onClick={drillEnabled ? () => fireDrill({ scope: 'total', value: grandTotal }) : undefined}
                  onKeyDown={drillEnabled ? drillKey(() => fireDrill({ scope: 'total', value: grandTotal })) : undefined}
                >
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
