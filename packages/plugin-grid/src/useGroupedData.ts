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
export type AggregationType = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';

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
  /** Composite key identifying this group (unique across all levels) */
  key: string;
  /** Display label for the group header (current level only) */
  label: string;
  /** Field name this group is bucketed by */
  field: string;
  /** Nesting depth (0 = top-level) */
  depth: number;
  /** Rows belonging to this group (flattened across subgroups) */
  rows: any[];
  /** Whether the group section is collapsed */
  collapsed: boolean;
  /** Computed aggregations for this group (empty when no aggregations configured). */
  aggregations: AggregationResult[];
  /**
   * Nested subgroups for the next grouping field.
   *
   * Empty array (not undefined) when this is the deepest level so consumers
   * can switch on `subgroups.length` to decide whether to render a child
   * `GroupRow` or the data table.
   */
  subgroups: GroupEntry[];
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
 * Extract a stable identity key from a value. For lookup / master_detail
 * fields the cell contains an expanded object (e.g. `{ id, name, ... }`); we
 * key off `id` so different referenced records produce distinct groups even
 * when they happen to share the same display name. Plain primitives are
 * stringified directly.
 */
function extractValueKey(value: any): string {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) {
    return value.map((v) => extractValueKey(v)).join('|');
  }
  if (typeof value === 'object') {
    const id = (value as any).id ?? (value as any)._id ?? (value as any).pk ?? (value as any).value;
    if (id !== undefined && id !== null && id !== '') return String(id);
    const label = (value as any).name ?? (value as any).label ?? (value as any).title;
    if (label !== undefined && label !== null && label !== '') return String(label);
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

/**
 * Build a value-only key segment for a single grouping field. Used to compose
 * stable composite keys across nesting levels.
 */
function buildSegmentKey(row: Record<string, any>, field: string): string {
  return extractValueKey(row[field]);
}

/**
 * Optional per-field value formatter. Returning `undefined` falls back to the
 * default stringification, so resolvers can opt out for individual values
 * (e.g. unknown select values).
 */
export type GroupValueFormatter = (field: string, value: any) => string | undefined;

/**
 * Build a human-readable label for a single grouping field value.
 *
 * When a `formatValue` resolver is supplied, it is consulted first so callers
 * can map raw values (e.g. select option codes, booleans) to display labels.
 */
function buildSegmentLabel(
  value: any,
  field: string,
  formatValue?: GroupValueFormatter,
): string {
  if (value === undefined || value === null || value === '') return '(empty)';
  if (formatValue) {
    const formatted = formatValue(field, value);
    if (formatted !== undefined && formatted !== '') return formatted;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((v) => {
        if (formatValue) {
          const f2 = formatValue(field, v);
          if (f2 !== undefined && f2 !== '') return f2;
        }
        return buildSegmentLabel(v, field);
      })
      .join(', ');
    return joined || '(empty)';
  }
  // Lookup / master_detail fields: the cell is an expanded object such as
  // `{ id, name, ... }`. Stringifying directly produces "[object Object]",
  // so prefer common display fields, falling back to the id.
  if (typeof value === 'object') {
    const label =
      (value as any).name ??
      (value as any).label ??
      (value as any).title ??
      (value as any).display_name ??
      (value as any).displayName ??
      (value as any).fullName ??
      (value as any).full_name;
    if (label !== undefined && label !== null && label !== '') return String(label);
    const id = (value as any).id ?? (value as any)._id ?? (value as any).pk;
    if (id !== undefined && id !== null && id !== '') return String(id);
    return '(empty)';
  }
  return String(value);
}

/**
 * Compute aggregation results for a set of rows.
 */
function computeAggregations(
  rows: any[],
  configs: AggregationConfig[],
): AggregationResult[] {
  return configs.map(({ field, type }) => {
    if (type === 'count_distinct') {
      const set = new Set<unknown>();
      for (const r of rows) {
        const v = r[field];
        if (v != null && v !== '') set.add(v);
      }
      return { field, type, value: set.size };
    }
    if (type === 'count') {
      // count includes nulls (row count for the bucket).
      return { field, type, value: rows.length };
    }
    const nums = rows
      .map((r) => Number(r[field]))
      .filter((n) => Number.isFinite(n));

    let value: number;
    switch (type) {
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
 * One entry of the spec's `grouping.fields[]` as AUTHORED — `field` plus the
 * optional `order` / `collapsed`.
 *
 * ⚠️ NOT the same type as `@object-ui/components`' `GroupingFieldEntry`, which
 * is the grouping EDITOR's fully-populated value shape and requires `order`
 * and `collapsed`. This one is `z.input` of the spec schema, where both carry
 * defaults and are therefore optional, so the two are structurally different
 * and each keeps its own name (objectui#6273 — one authority per exported
 * name; a shared spelling for two shapes is the collision that gate exists to
 * catch).
 */
export type UsableGroupingField = NonNullable<GroupingConfig['fields']>[number];

/**
 * The `grouping.fields[]` entries a grid can actually group by (objectui#7217).
 *
 * ## Why this exists
 *
 * `grouping` is authored JSON and reaches the renderer unparsed — `ObjectGrid`
 * reads `schema.grouping` straight off its props and `@object-ui/core`'s
 * `validateSchema` is structural and never looks at the key. A `null` hole in
 * the array (a trailing comma, a sparse generator, an agent-written block) was
 * therefore dereferenced twice with no guard: once by `ObjectGrid`'s
 * `groupValueFormatter` memo and once by this hook's `buildLevel`. Both threw
 * `TypeError: Cannot read properties of null (reading 'field')` and took the
 * whole grid down during render.
 *
 * ## The admission rule is the harvester's, deliberately
 *
 * An entry is usable when it is an object carrying a non-empty string `field`
 * — exactly the entries `collectGroupingFieldRefs` (`@object-ui/core`) harvests
 * into the projection. Keeping the two sets equal is the point: an entry the
 * grid grouped by but the projection ignored would be fetched as `undefined`
 * on every row and bucket every record into one `(empty)` group, which is the
 * silent wrong answer objectui#7179 closed. This is a defensive normalizer,
 * NOT a lenient alias — no off-spec spelling is taught to mean anything here;
 * unusable entries are dropped, never coerced.
 *
 * ## Dropping the entry, not the grouping
 *
 * One bad entry must not flatten a working grouped view: the usable entries
 * still group, at the levels they still occupy.
 *
 * @param fields - `grouping.fields` in any authored state.
 * @returns The usable entries, in order, with their `order` / `collapsed`
 *   intact — the harvester answers with field NAMES, which is why this cannot
 *   simply route through it.
 */
export function usableGroupingFields(fields: unknown): UsableGroupingField[] {
  if (!Array.isArray(fields)) return [];
  return fields.filter((entry): entry is UsableGroupingField => {
    if (entry === null || typeof entry !== 'object') return false;
    const name = (entry as { field?: unknown }).field;
    return typeof name === 'string' && name.trim() !== '';
  });
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
 * @param formatValue   - optional per-field formatter that maps raw values to
 *                        display labels (e.g. resolves select option codes
 *                        to their human-readable labels)
 */
export function useGroupedData(
  config: GroupingConfig | undefined,
  data: any[],
  aggregations?: AggregationConfig[],
  formatValue?: GroupValueFormatter,
): UseGroupedDataResult {
  // [objectui#7217] The SAME normalized list `ObjectGrid`'s formatter memo
  // reads. Memoized on the raw array rather than on `config`: hosts rebuild
  // the `{ grouping }` object literal every render, so keying on `config`
  // would hand `groups` a fresh array identity on every render.
  const rawFields = config?.fields;
  const fields = useMemo(() => usableGroupingFields(rawFields), [rawFields]);
  const isGrouped = fields.length > 0;

  // Track which group keys have been explicitly toggled by the user.
  const [toggledKeys, setToggledKeys] = useState<Record<string, boolean>>({});

  const groups: GroupEntry[] = useMemo(() => {
    if (!isGrouped) return [];

    /**
     * Recursively build a tree of groups for the slice of rows at the current
     * nesting depth. Each level partitions rows by `fields[depth]` and then
     * recurses into the next field.  When all fields are consumed we stop and
     * the rows attached to the leaf entry become the data table input.
     */
    const buildLevel = (
      rowsAtLevel: any[],
      depth: number,
      parentKey: string,
    ): GroupEntry[] => {
      if (depth >= fields.length) return [];
      const f = fields[depth];

      const map = new Map<string, { label: string; rows: any[] }>();
      const keyOrder: string[] = [];

      for (const row of rowsAtLevel) {
        const segment = buildSegmentKey(row, f.field);
        if (!map.has(segment)) {
          map.set(segment, {
            label: buildSegmentLabel(row[f.field], f.field, formatValue),
            rows: [],
          });
          keyOrder.push(segment);
        }
        map.get(segment)!.rows.push(row);
      }

      const order = f.order ?? 'asc';
      keyOrder.sort((a, b) => {
        const labelA = map.get(a)?.label ?? a;
        const labelB = map.get(b)?.label ?? b;
        return compareGroups(labelA, labelB, order);
      });

      return keyOrder.map((segment) => {
        const entry = map.get(segment)!;
        const compositeKey = parentKey ? `${parentKey}__${depth}:${segment}` : `${depth}:${segment}`;
        const collapsedDefault = !!f.collapsed;
        const collapsed =
          compositeKey in toggledKeys ? toggledKeys[compositeKey] : collapsedDefault;
        const agg = aggregations && aggregations.length > 0
          ? computeAggregations(entry.rows, aggregations)
          : [];
        const subgroups = depth + 1 < fields.length
          ? buildLevel(entry.rows, depth + 1, compositeKey)
          : [];
        return {
          key: compositeKey,
          label: entry.label,
          field: f.field,
          depth,
          rows: entry.rows,
          collapsed,
          aggregations: agg,
          subgroups,
        };
      });
    };

    return buildLevel(data, 0, '');
  }, [data, fields, isGrouped, toggledKeys, aggregations, formatValue]);

  const toggleGroup = useCallback((key: string) => {
    setToggledKeys((prev) => {
      // Determine the per-level default: the leading "<depth>:..." segment of
      // the composite key tells us which grouping field (and its `collapsed`
      // flag) to honor when the user has not explicitly toggled this group.
      const lastSegment = key.split('__').pop() || '';
      const depthMatch = /^(\d+):/.exec(lastSegment);
      const depth = depthMatch ? Number(depthMatch[1]) : 0;
      const fieldDefault = !!fields[depth]?.collapsed;
      return {
        ...prev,
        [key]: prev[key] !== undefined ? !prev[key] : !fieldDefault,
      };
    });
  }, [fields]);

  return { groups, isGrouped, toggleGroup };
}
