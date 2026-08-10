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

import type { DashboardComponentSchema, DashboardWidgetSchema, PageVariable } from '@object-ui/types';
import { DATE_RANGE_PRESETS, type DateRangePreset } from '@objectstack/spec/ui';
import { resolveDateMacros } from './date-macros.js';

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
  /**
   * Static options, NORMALIZED to `{ value, label }` pairs by
   * `resolveDashboardFilterDefs` — authors may write either the
   * @objectstack/spec object form (`{ value, label }`) or the bare-string
   * shorthand; consumers always see the object form.
   */
  options?: Array<{ value: string; label: string }>;
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
 *
 * `satisfies Record<DateRangePreset, …>` is the load-bearing half of
 * objectui#4167, not decoration. `DATE_RANGE_PRESETS` below is now the spec's
 * list rather than `Object.keys` of this table, so the two could otherwise
 * drift in the one direction the spec's own comment on that const names as the
 * failure mode: a preset the SCHEMA knows and this table has no bounds for
 * "validates clean and then resolves to nothing" — it would reach the filter
 * bar's dropdown, be selected, and produce no range. The `satisfies` makes that
 * a compile error at the moment the spec adds a preset (missing key), and makes
 * a local invention a compile error too (excess key). The annotation form
 * `const PRESET_RANGES: Record<DateRangePreset, …>` would NOT do this: a string
 * index signature satisfies every literal key, so the check passes vacuously.
 */
const PRESET_RANGES = {
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
} satisfies Record<DateRangePreset, { from?: string; to?: string }>;

/**
 * Bounds for a preset NAME that may not be one.
 *
 * The runtime receives whatever a stored dashboard carries, so an unrecognised
 * name must warn (see `buildFilterCondition`) rather than fail to compile. That
 * read is confined here so the `satisfies` pin above stays the single place
 * deciding which names exist — an unguarded `PRESET_RANGES[someString]` would
 * have forced the table back to a `Record<string, …>` and taken the pin with it.
 */
function presetBounds(preset: string): { from?: string; to?: string } | undefined {
  return (PRESET_RANGES as Record<string, { from?: string; to?: string }>)[preset];
}

/**
 * Preset keys the filter bar offers, in display order — the spec's list,
 * RE-EXPORTED since objectui#4167 rather than derived from the local bounds
 * table (objectstack#4115).
 *
 * `@objectstack/spec` 17.0.0-rc.6 publishes `DATE_RANGE_PRESETS`, and its own
 * doc comment names this module as one of the three copies the extraction
 * (objectstack#4614) existed to collapse: "it used to exist three times —
 * inline in `dateRange.defaultRange`, as `PRESET_RANGES` in objectui's
 * `dashboard-filters`, and as a hand-written table in
 * `content/docs/ui/dashboards.mdx`". So the burn-down direction here is not a
 * judgement call, it is upstream's stated intent, and the two lists were
 * already identical in content AND display order — the copy had nothing to
 * protect.
 *
 * What stays local is the BOUNDS table above, which is the other half of
 * #4614's design ("the two vocabularies live one import apart and neither
 * restates the other's grammar"): the spec owns which presets exist, this
 * module owns what each one resolves to in date-macro tokens.
 */
export { DATE_RANGE_PRESETS };

/**
 * ISO calendar date, optionally carrying a time part — `2026-01-15`,
 * `2026-01-15T08:30:00Z`. Deliberately narrower than `Date.parse`, which
 * also accepts locale prose (`March 5, 2026`) and bare years (`2026`);
 * neither is a value the backend compares a date column against usefully.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * True when a bare string value can legitimately reach a query as a date
 * (#3151). Two spellings qualify:
 *
 *  - a **date-macro token** (`{today}`, `${current_month_start}`,
 *    `{7_days_ago}`) — it stays symbolic in the generated condition and is
 *    resolved at query time by `resolveDateMacros`, exactly like the bounds
 *    `PRESET_RANGES` emits. The check asks that resolver itself instead of
 *    restating its grammar here: one token vocabulary, no second dialect to
 *    drift — and a token it does not know is precisely the typo this guard
 *    exists to catch;
 *  - an **ISO date**, which means equality on that day (documented behaviour).
 */
function isUsableDateString(value: string): boolean {
  if (resolveDateMacros(value) !== value) return true;
  return ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** `today, yesterday, …` — quoted in every rejection so the fix is in reach. */
function presetList(): string {
  return DATE_RANGE_PRESETS.join(', ');
}

function warnDateFilter(message: string): void {
  if (typeof console !== 'undefined') console.warn(`[dashboard-filters] ${message}`);
}

/**
 * Normalize a date filter's DECLARED default into the `DateRangeValue` shape
 * every date consumer in this module reads (framework#4475).
 *
 * The built-in `dateRange` declaration has always been normalized this way —
 * `schema.dateRange.defaultRange` is a preset NAME and
 * `resolveDashboardFilterDefs` lifts it to `{ preset }`. A `globalFilters`
 * entry of `type: 'date'` was passed through raw instead, and that asymmetry
 * is the whole bug: `@objectstack/spec`'s `GlobalFilterSchema.defaultValue` is
 * `string | number | boolean`, so a bare preset name is the ONLY spelling an
 * author can write, yet nothing ever mapped it. Both symptoms of Setup's
 * System Overview reading 0 across every KPI tile follow from that:
 *
 *  - `buildFilterCondition` fell through to its "a bare string date means
 *    equality on that day" branch and emitted `created_at = 'last_7_days'`,
 *    which matches no row — a query the backend answers `200 OK` with a 0;
 *  - `DateRangeFilter` reads `value.preset` / `.from` / `.to`, all `undefined`
 *    on a bare string, so the control displayed "All time" while sending that
 *    equality — the tiles looked deliberately unfiltered and merely empty.
 *
 * Only a name this module actually knows is lifted. A genuine ISO date string
 * still means equality on that day (the documented behaviour), and a number /
 * boolean / unrecognised string is left exactly as declared — an unrecognised
 * string then never reaches a query at all: `buildFilterCondition` skips it
 * with a warning rather than comparing a column against it (#3151).
 */
function normalizeDateDefault(type: DashboardFilterDef['type'], defaultValue: unknown): unknown {
  if (type !== 'date' && type !== 'dateRange') return defaultValue;
  if (typeof defaultValue !== 'string') return defaultValue;
  return defaultValue in PRESET_RANGES ? { preset: defaultValue } : defaultValue;
}

/**
 * Normalize a filter's static `options` declaration to `{ value, label }`
 * pairs. The @objectstack/spec `GlobalFilterSchema.options` form is
 * `{ value, label }` objects (label possibly an i18n record); the bare-string
 * shorthand (`options: ['EMEA', …]`) is also accepted. Rendering an
 * un-normalized object child crashes React — this is the single place both
 * shapes converge.
 */
function normalizeFilterOptions(
  options: unknown,
): Array<{ value: string; label: string }> | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  const normalized: Array<{ value: string; label: string }> = [];
  for (const o of options) {
    if (o === null || o === undefined) continue;
    if (typeof o === 'object') {
      const value = (o as any).value;
      if (value === undefined || value === null) continue;
      const label = (o as any).label;
      normalized.push({
        value: String(value),
        label: typeof label === 'string' && label ? label : String(value),
      });
    } else {
      normalized.push({ value: String(o), label: String(o) });
    }
  }
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Normalize a dashboard schema's filter declarations into a flat list of
 * filter definitions. The built-in `dateRange` (when declared) comes first
 * under the reserved name `"dateRange"`; each `globalFilters` entry follows,
 * named by its `name` (defaulting to `field`). Later duplicates win.
 */
export function resolveDashboardFilterDefs(
  schema: Pick<DashboardComponentSchema, 'globalFilters' | 'dateRange'>,
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
    const type = f.type ?? 'text';
    byName.set(name, {
      name,
      field: f.field,
      label: f.label,
      type,
      options: normalizeFilterOptions(f.options),
      optionsFrom: f.optionsFrom,
      // framework#4475 — same preset-name lifting the built-in `dateRange`
      // above already does; see normalizeDateDefault for why a bare string is
      // the only thing an author can declare here.
      defaultValue: normalizeDateDefault(type, f.defaultValue),
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
 *
 * A `date`/`dateRange` value is held to three spellings (#3151): a known
 * preset name → range bounds; a date-macro token or ISO date → equality on
 * that day; **anything else → skipped with a console warning**, never
 * silently downgraded to an equality nothing can match. That last branch is
 * the same strictness `buildWidgetScopedFilter` applies to a default binding
 * on an unknown field name, for the same reason: a query the backend answers
 * `200 OK` with zero rows is indistinguishable from "this range has no data",
 * so the typo has to be said out loud somewhere.
 */
export function buildFilterCondition(
  def: DashboardFilterDef,
  value: unknown,
): Record<string, unknown> | unknown | undefined {
  if (isEmptyValue(def, value)) return undefined;

  if (def.type === 'dateRange' || def.type === 'date') {
    const v = value as DateRangeValue;
    if (typeof v === 'object') {
      const preset = typeof v.preset === 'string' && v.preset ? v.preset : undefined;
      const range = preset ? presetBounds(preset) : undefined;
      const from = range?.from ?? v.from;
      const to = range?.to ?? v.to;
      if (preset && !range) {
        // Was already dropped here — but silently, which reads as "no data".
        warnDateFilter(
          from || to
            ? `filter "${def.name}": ignoring unknown date range preset "${preset}" — ` +
                `using the explicit from/to bounds instead; known presets: ${presetList()}`
            : `skipping filter "${def.name}": unknown date range preset "${preset}" — ` +
                `expected one of: ${presetList()}`,
        );
      }
      if (!from && !to) return undefined;
      return {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    if (typeof v === 'string' && !isUsableDateString(v)) {
      warnDateFilter(
        `skipping filter "${def.name}": value "${v}" is neither a known date range preset ` +
          `nor an ISO date — expected one of: ${presetList()}, an ISO date (YYYY-MM-DD), ` +
          `or a date macro such as {today}`,
      );
      return undefined;
    }
    // A bare string date (or date macro) means equality on that day.
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
 *
 * Metadata-aware default bindings (#2578 item 5): when `knownFields` is
 * provided (the widget's object field names), a DEFAULT binding whose target
 * field is not on the object is skipped with a console warning instead of
 * emitting a query the backend will empty-match or reject. An EXPLICIT
 * `filterBindings` string is always honoured — the author asked for that
 * field, so a typo surfaces as a visible (fixable) empty widget rather than
 * being silently dropped. Callers omit `knownFields` when metadata is not
 * (yet) available, preserving the previous behaviour.
 */
export function buildWidgetScopedFilter(
  widget: Pick<DashboardWidgetSchema, 'id' | 'filterBindings'>,
  defs: DashboardFilterDef[],
  values: Record<string, unknown>,
  knownFields?: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  const conditions: Record<string, unknown>[] = [];

  for (const def of defs) {
    const value = values[def.name];
    if (isEmptyValue(def, value)) continue;
    const field = resolveBoundField(widget, def);
    if (!field) continue;
    const isExplicit = typeof widget.filterBindings?.[def.name] === 'string';
    if (!isExplicit && knownFields && !knownFields.has(field)) {
      if (typeof console !== 'undefined') {
        console.warn(
          `[dashboard-filters] skipping filter "${def.name}" on widget "${widget.id ?? '?'}": ` +
            `default field "${field}" does not exist on the widget's object — ` +
            `map it with filterBindings: { "${def.name}": "<field>" } or opt out with false`,
        );
      }
      continue;
    }
    const condition = buildFilterCondition(def, value);
    if (condition === undefined) continue;
    conditions.push({ [field]: condition });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}
