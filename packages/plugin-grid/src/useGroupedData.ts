/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useMemo, useCallback } from 'react';
import type { GroupingConfig } from '@object-ui/types';

export interface GroupEntry {
  /** Composite key identifying this group (field values joined by ' / ') */
  key: string;
  /** Display label for the group header */
  label: string;
  /** Rows belonging to this group */
  rows: any[];
  /** Whether the group section is collapsed */
  collapsed: boolean;
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
 * @param config  - GroupingConfig from the grid schema (optional)
 * @param data    - flat data rows
 */
export function useGroupedData(
  config: GroupingConfig | undefined,
  data: any[],
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
      return { key, label: entry.label, rows: entry.rows, collapsed };
    });
  }, [data, fields, isGrouped, toggledKeys, fieldsDefaultCollapsed]);

  const toggleGroup = useCallback((key: string) => {
    setToggledKeys((prev) => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : !fieldsDefaultCollapsed,
    }));
  }, [fieldsDefaultCollapsed]);

  return { groups, isGrouped, toggleGroup };
}
