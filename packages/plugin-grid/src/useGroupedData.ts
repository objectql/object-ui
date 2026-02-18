/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useMemo, useCallback } from 'react';
import type { GroupingConfig } from '@object-ui/types';

/** Supported aggregation function types. */
export type AggregationType = 'sum' | 'count' | 'avg' | 'min' | 'max';

/** Describes a single aggregation to compute per group. */
export interface AggregationConfig {
  /** The field to aggregate. */
  field: string;
  /** The aggregation function. */
  type: AggregationType;
}

/** Result of a computed aggregation for a group. */
export interface AggregationResult {
  /** The field that was aggregated. */
  field: string;
  /** The aggregation function used. */
  type: AggregationType;
  /** The computed value. */
  value: number;
}

export interface GroupEntry {
  /** Composite key identifying this group (field values joined by ' / ') */
  key: string;
  /** Display label for the group header */
  label: string;
  /** Rows belonging to this group */
  rows: any[];
  /** Whether the group section is collapsed */
  collapsed: boolean;
  /** Computed aggregations for this group (empty when no aggregations configured). */
  aggregations: AggregationResult[];
}

export interface UseGroupedDataResult {
  /** Grouped entries (empty when grouping is not configured) */
  groups: GroupEntry[];
  /** Whether grouping is active */
  isGrouped: boolean;
  /** Toggle the collapsed state of a group by its key */
  toggleGroup: (key: string) => void;
}

/**
 * Build a composite group key from a row based on the grouping fields.
 */
function buildGroupKey(row: Record<string, any>, fields: GroupingConfig['fields']): string {
  return fields.map((f) => String(row[f.field] ?? '')).join(' / ');
}

/**
 * Build a human-readable label from a row based on the grouping fields.
 */
function buildGroupLabel(row: Record<string, any>, fields: GroupingConfig['fields']): string {
  return fields
    .map((f) => {
      const val = row[f.field];
      return val !== undefined && val !== null && val !== '' ? String(val) : '(empty)';
    })
    .join(' / ');
}

/**
 * Compute aggregation results for a set of rows.
 */
function computeAggregations(
  rows: any[],
  configs: AggregationConfig[],
): AggregationResult[] {
  return configs.map(({ field, type }) => {
    const nums = rows
      .map((r) => Number(r[field]))
      .filter((n) => Number.isFinite(n));

    let value: number;
    switch (type) {
      case 'count':
        value = nums.length;
        break;
      case 'sum':
        value = nums.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        break;
      case 'min':
        value = nums.length > 0 ? Math.min(...nums) : 0;
        break;
      case 'max':
        value = nums.length > 0 ? Math.max(...nums) : 0;
        break;
      default:
        value = 0;
    }

    return { field, type, value };
  });
}

/**
 * Compare function that respects per-field sort order.
 */
function compareGroups(a: string, b: string, order: 'asc' | 'desc'): number {
  const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  return order === 'desc' ? -cmp : cmp;
}

/**
 * Hook that groups a flat data array by the fields specified in GroupingConfig.
 *
 * Supports multi-level grouping, per-field sort order, and per-field default
 * collapsed state.  Collapse state is managed internally so the consumer only
 * needs to wire `toggleGroup` to the UI.
 *
 * @param config        - GroupingConfig from the grid schema (optional)
 * @param data          - flat data rows
 * @param aggregations  - optional aggregation definitions to compute per group
 */
export function useGroupedData(
  config: GroupingConfig | undefined,
  data: any[],
  aggregations?: AggregationConfig[],
): UseGroupedDataResult {
  const fields = config?.fields;
  const isGrouped = !!(fields && fields.length > 0);

  // Track which group keys have been explicitly toggled by the user.
  const [toggledKeys, setToggledKeys] = useState<Record<string, boolean>>({});

  // Determine whether a field set defaults to collapsed.
  const fieldsDefaultCollapsed = useMemo(() => {
    if (!fields) return false;
    // If any grouping field has collapsed: true, default all groups to collapsed.
    return fields.some((f) => f.collapsed);
  }, [fields]);

  const groups: GroupEntry[] = useMemo(() => {
    if (!isGrouped || !fields) return [];

    // Group rows by composite key
    const map = new Map<string, { label: string; rows: any[] }>();
    const keyOrder: string[] = [];

    for (const row of data) {
      const key = buildGroupKey(row, fields);
      if (!map.has(key)) {
        map.set(key, { label: buildGroupLabel(row, fields), rows: [] });
        keyOrder.push(key);
      }
      map.get(key)!.rows.push(row);
    }

    // Sort groups using the first grouping field's order
    const primaryOrder = fields[0]?.order ?? 'asc';
    keyOrder.sort((a, b) => compareGroups(a, b, primaryOrder));

    return keyOrder.map((key) => {
      const entry = map.get(key)!;
      const collapsed =
        key in toggledKeys ? toggledKeys[key] : fieldsDefaultCollapsed;
      const agg = aggregations && aggregations.length > 0
        ? computeAggregations(entry.rows, aggregations)
        : [];
      return { key, label: entry.label, rows: entry.rows, collapsed, aggregations: agg };
    });
  }, [data, fields, isGrouped, toggledKeys, fieldsDefaultCollapsed, aggregations]);

  const toggleGroup = useCallback((key: string) => {
    setToggledKeys((prev) => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : !fieldsDefaultCollapsed,
    }));
  }, [fieldsDefaultCollapsed]);

  return { groups, isGrouped, toggleGroup };
}
