/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Drill-down helpers shared by PivotTable and chart widgets.
 *
 * The functions here implement the **Style A (declarative)** drill-down
 * protocol: a widget schema may carry an optional `drillDown` block, and
 * when a user clicks a cell / bar / segment the widget builds a click
 * payload (`event`) and asks these helpers to derive a filter + title for
 * the drill-down drawer.
 *
 * ```jsonc
 * "drillDown": {
 *   "enabled": true,
 *   "filter": { "stage": "${event.rowKey}", "lead_source": "${event.colKey}" },
 *   "title":  "${event.rowLabel} × ${event.colLabel}"
 * }
 * ```
 *
 * The helpers are intentionally protocol-agnostic — any caller can
 * synthesize an `event` object and rely on the same defaults / templating.
 */

import type { DrillDownConfig } from '@object-ui/types';

/**
 * Generic click payload. Pivots provide row/col, charts provide
 * category/series. Extra fields are passed through verbatim so callers
 * can reference them in templates.
 */
export interface DrillEvent {
  /** Pivot: row field raw value. */
  rowKey?: string;
  /** Pivot: column field raw value. */
  colKey?: string;
  /** Pivot: human-readable row label. */
  rowLabel?: string;
  /** Pivot: human-readable column label. */
  colLabel?: string;
  /** Chart: x-axis / category value. */
  category?: string;
  /** Chart: human-readable label for the category (when raw differs from display). */
  categoryLabel?: string;
  /** Chart: series name (multi-series charts). */
  series?: string;
  /** Aggregated value at the click point. */
  value?: number;
  /** Pivot scope: which cell type was clicked. */
  scope?: 'cell' | 'row' | 'column' | 'total';
  /** Free-form pass-through (e.g. raw record reference). */
  [key: string]: unknown;
}

/** Default field hints used to derive a filter when `config.filter` is omitted. */
export interface DrillDefaults {
  rowField?: string;
  columnField?: string;
  /** Chart group-by field (xAxisKey / aggregate.groupBy). */
  groupByField?: string;
}

const TEMPLATE = /\$\{event\.([a-zA-Z0-9_]+)\}/g;

/**
 * Substitute `${event.x}` placeholders in a string with values from the
 * event payload. Unknown keys resolve to an empty string.
 *
 * Non-string values are coerced via `String(...)`. Returns the input
 * unchanged when no placeholder is present.
 */
export function interpolate(template: string, event: DrillEvent): string {
  if (typeof template !== 'string' || template.indexOf('${event.') === -1) {
    return template;
  }
  return template.replace(TEMPLATE, (_match, key: string) => {
    const v = event[key];
    if (v === undefined || v === null) return '';
    return String(v);
  });
}

/**
 * Recursively walk a filter object/value and replace `${event.*}` strings
 * with the event values. Whole-string templates that resolve to a single
 * event field preserve the original (typed) value — e.g. `"${event.value}"`
 * stays a number — so backend filters can compare against the right type.
 */
function interpolateValue(value: unknown, event: DrillEvent): unknown {
  if (typeof value === 'string') {
    // Whole-string template (e.g. "${event.rowKey}") → keep typed value
    const m = value.match(/^\$\{event\.([a-zA-Z0-9_]+)\}$/);
    if (m) {
      const raw = event[m[1]];
      // Convert empty string sentinel back to null for SQL filter friendliness
      if (raw === '') return null;
      return raw === undefined ? null : raw;
    }
    return interpolate(value, event);
  }
  if (Array.isArray(value)) {
    return value.map(v => interpolateValue(v, event));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateValue(v, event);
    }
    return out;
  }
  return value;
}

/**
 * Compute the filter object passed to the drilled list view.
 *
 * Resolution order:
 * 1. `config.filter` (interpolated against the event)
 * 2. Defaults derived from `defaults`:
 *    - `rowField` + event.rowKey  (pivot)
 *    - `columnField` + event.colKey  (pivot)
 *    - `groupByField` + event.category  (chart)
 *
 * Pivot scope shortcuts:
 *   - scope === 'row'    → only rowField filter
 *   - scope === 'column' → only columnField filter
 *   - scope === 'total'  → empty filter (drill-through to the full set)
 */
export function computeDrillFilter(
  config: DrillDownConfig | undefined,
  event: DrillEvent,
  defaults: DrillDefaults = {},
): Record<string, unknown> {
  if (config?.filter) {
    return interpolateValue(config.filter, event) as Record<string, unknown>;
  }

  const out: Record<string, unknown> = {};
  const { rowField, columnField, groupByField } = defaults;
  const scope = event.scope ?? 'cell';

  if (scope === 'total') return out;

  if ((scope === 'cell' || scope === 'row') && rowField && 'rowKey' in event) {
    out[rowField] = event.rowKey === '' ? null : event.rowKey;
  }
  if ((scope === 'cell' || scope === 'column') && columnField && 'colKey' in event) {
    out[columnField] = event.colKey === '' ? null : event.colKey;
  }
  if (groupByField && 'category' in event) {
    out[groupByField] = event.category === '' ? null : event.category;
  }
  return out;
}

/**
 * Compute the drill-down title (for drawer/dialog header).
 *
 * Falls back to the most descriptive non-empty thing we know about the
 * click point. Always returns a non-empty string.
 */
export function resolveDrillTitle(
  config: DrillDownConfig | undefined,
  event: DrillEvent,
  fallback = 'Details',
): string {
  if (config?.title) {
    const t = interpolate(config.title, event).trim();
    if (t) return t;
  }

  const parts: string[] = [];
  if (event.rowLabel) parts.push(event.rowLabel);
  if (event.colLabel) parts.push(event.colLabel);
  if (event.categoryLabel) parts.push(event.categoryLabel);
  else if (event.category) parts.push(event.category);
  if (event.series) parts.push(event.series);
  return parts.length > 0 ? parts.join(' × ') : fallback;
}

/** Whether drill-down is enabled on a config (treats `{}` as enabled too). */
export function isDrillEnabled(config: DrillDownConfig | undefined): boolean {
  if (!config) return false;
  return config.enabled !== false;
}
