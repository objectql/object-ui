/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Dashboard-level filter resolution (framework#2501).
 *
 * A dashboard declares top-level filters (`globalFilters` + the built-in
 * `dateRange`). Their values live as dashboard-level variables; each widget
 * may declare which of ITS OWN fields a filter binds to via
 * `filterBindings`. At render time the dashboard broadcasts the filter
 * values into each bound widget's inline query by merging a widget-scoped
 * `FilterCondition` into the widget's own `filter`.
 *
 * Everything in this module is pure and synchronous so the binding rules
 * are unit-testable in isolation from React and the data layer.
 */

import type { DashboardSchema, DashboardWidgetSchema, PageVariable } from '@object-ui/types';

/** Reserved filter name for the dashboard's built-in date range. */
export const DATE_RANGE_FILTER_NAME = 'dateRange';

/** Default target field for the built-in date range filter. */
const DATE_RANGE_DEFAULT_FIELD = 'created_at';

export interface DashboardFilterDef {
  /** Stable name — the variable key and the key widgets bind against. */
  name: string;
  /** Default target field when a widget declares no explicit binding. */
  field: string;
  label?: string;
  type: 'text' | 'select' | 'date' | 'number' | 'lookup' | 'dateRange';
  options?: string[];
  optionsFrom?: {
    object: string;
    valueField: string;
    labelField?: string;
    filter?: any;
  };
  defaultValue?: any;
  /** Legacy widget-id allow-list; ignored when a widget binds explicitly. */
  targetWidgets?: string[];
  /** dateRange only — whether the UI offers a custom from/to picker. */
  allowCustomRange?: boolean;
}

/** Value shape held by a `dateRange`-typed filter variable. */
export interface DateRangeValue {
  /** One of the `DashboardSchema.dateRange.defaultRange` presets. */
  preset?: string;
  /** Custom range bounds as ISO dates (either bound may be omitted). */
  from?: string;
  to?: string;
}

/**
 * Date-range presets → date-macro token bounds. Tokens stay symbolic in the
 * generated condition; every widget renderer resolves them at query time via
 * `resolveDateMacros`, exactly like hand-authored widget filters.
 */
const PRESET_RANGES: Record<string, { from?: string; to?: string }> = {
  today: { from: '{today}', to: '{today}' },
  yesterday: { from: '{yesterday}', to: '{yesterday}' },
  this_week: { from: '{current_week_start}', to: '{current_week_end}' },
  last_week: { from: '{last_week_start}', to: '{last_week_end}' },
  this_month: { from: '{current_month_start}', to: '{current_month_end}' },
  last_month: { from: '{last_month_start}', to: '{last_month_end}' },
  this_quarter: { from: '{current_quarter_start}', to: '{current_quarter_end}' },
  last_quarter: { from: '{last_quarter_start}', to: '{last_quarter_end}' },
  this_year: { from: '{current_year_start}', to: '{current_year_end}' },
  last_year: { from: '{last_year_start}', to: '{last_year_end}' },
  last_7_days: { from: '{7_days_ago}', to: '{today}' },
  last_30_days: { from: '{30_days_ago}', to: '{today}' },
  last_90_days: { from: '{90_days_ago}', to: '{today}' },
};

/** Preset keys the filter bar offers, in display order. */
export const DATE_RANGE_PRESETS = Object.keys(PRESET_RANGES);

/**
 * Normalize a dashboard schema's filter declarations into a flat list of
 * filter definitions. The built-in `dateRange` (when declared) comes first
 * under the reserved name `"dateRange"`; each `globalFilters` entry follows,
 * named by its `name` (defaulting to `field`). Later duplicates win.
 */
export function resolveDashboardFilterDefs(
  schema: Pick<DashboardSchema, 'globalFilters' | 'dateRange'>,
): DashboardFilterDef[] {
  const byName = new Map<string, DashboardFilterDef>();

  if (schema.dateRange) {
    const preset = schema.dateRange.defaultRange;
    byName.set(DATE_RANGE_FILTER_NAME, {
      name: DATE_RANGE_FILTER_NAME,
      field: schema.dateRange.field || DATE_RANGE_DEFAULT_FIELD,
      type: 'dateRange',
      // 'custom' has no bounds of its own — start empty and let the user pick.
      defaultValue: preset && preset !== 'custom' ? { preset } : undefined,
      allowCustomRange: schema.dateRange.allowCustomRange,
    });
  }

  for (const f of schema.globalFilters ?? []) {
    if (!f?.field) continue;
    const name = f.name || f.field;
    if (byName.has(name) && typeof console !== 'undefined') {
      console.warn(`[dashboard-filters] duplicate filter name "${name}" — the later definition wins`);
    }
    byName.set(name, {
      name,
      field: f.field,
      label: f.label,
      type: f.type ?? 'text',
      options: f.options,
      optionsFrom: f.optionsFrom,
      defaultValue: f.defaultValue,
      targetWidgets: f.targetWidgets,
    });
  }

  return Array.from(byName.values());
}

/**
 * Derive `PageVariable` definitions for a dashboard's filter values so the
 * dashboard can host them in a `PageVariablesProvider` (the page/dashboard
 * variables primitive). Filter values are then also readable in widget
 * expressions as `page.<name>`.
 */
export function dashboardFilterVariableDefs(defs: DashboardFilterDef[]): PageVariable[] {
  return defs.map((def) => ({
    name: def.name,
    type: def.type === 'dateRange' ? 'object' : 'string',
    defaultValue: def.defaultValue,
  }));
}

/** True when a filter value carries no constraint. */
function isEmptyValue(def: DashboardFilterDef, value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (def.type === 'dateRange' || def.type === 'date') {
    const v = value as DateRangeValue;
    if (typeof v !== 'object') return false;
    return !v.preset && !v.from && !v.to;
  }
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/**
 * Build the operator shape (the value side of a `FilterCondition` entry) for
 * one filter's current value. Returns `undefined` when the value imposes no
 * constraint. The caller keys the result by the bound field name.
 */
export function buildFilterCondition(
  def: DashboardFilterDef,
  value: unknown,
): Record<string, unknown> | unknown | undefined {
  if (isEmptyValue(def, value)) return undefined;

  if (def.type === 'dateRange' || def.type === 'date') {
    const v = value as DateRangeValue;
    if (typeof v === 'object') {
      const range = v.preset ? PRESET_RANGES[v.preset] : undefined;
      const from = range?.from ?? v.from;
      const to = range?.to ?? v.to;
      if (!from && !to) return undefined;
      return {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    // A bare string date means equality on that day.
    return value;
  }

  if (def.type === 'select' || def.type === 'lookup') {
    return Array.isArray(value) ? { $in: value } : value;
  }

  if (def.type === 'text') {
    return { $contains: value };
  }

  // number and anything else: equality.
  return value;
}

/**
 * Resolve which of the widget's fields a filter binds to.
 * Returns `undefined` when the widget is not bound to this filter.
 *
 * Precedence: explicit `filterBindings` entry (string overrides the field,
 * `false` opts out — both win over everything) → legacy `targetWidgets`
 * allow-list → the filter's own default `field`.
 */
function resolveBoundField(
  widget: Pick<DashboardWidgetSchema, 'id' | 'filterBindings'>,
  def: DashboardFilterDef,
): string | undefined {
  const binding = widget.filterBindings?.[def.name];
  if (binding === false) return undefined;
  if (typeof binding === 'string' && binding) return binding;
  if (def.targetWidgets && def.targetWidgets.length > 0) {
    if (!widget.id || !def.targetWidgets.includes(widget.id)) return undefined;
  }
  return def.field;
}

/**
 * Compute the widget-scoped `FilterCondition` for the current filter values:
 * one `{ [boundField]: condition }` entry per active, bound filter, combined
 * with `$and` when several apply. Returns `undefined` when nothing applies —
 * callers then leave the widget's own filter untouched.
 */
export function buildWidgetScopedFilter(
  widget: Pick<DashboardWidgetSchema, 'id' | 'filterBindings'>,
  defs: DashboardFilterDef[],
  values: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const conditions: Record<string, unknown>[] = [];

  for (const def of defs) {
    const value = values[def.name];
    if (isEmptyValue(def, value)) continue;
    const field = resolveBoundField(widget, def);
    if (!field) continue;
    const condition = buildFilterCondition(def, value);
    if (condition === undefined) continue;
    conditions.push({ [field]: condition });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}
