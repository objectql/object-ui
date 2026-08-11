// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasetWidget — renders a dashboard widget that binds to a semantic-layer
 * `dataset` (ADR-0021) instead of an inline `object` + `valueField` query.
 *
 * It selects the dataset's dimensions/measures BY NAME and runs them through
 * `dataSource.queryDataset` — the same governed path the dataset preview and
 * dataset-bound reports use — so the numbers match everywhere.
 *
 * Rendering dispatch (by `widget.type`):
 *  - metric / kpi / gauge / solid-gauge / bullet (or no dimensions) → KPI value
 *    with the measure's display label + format.
 *  - table / pivot → a grouped table of `dimensions` + `values`. Rows drill
 *    through to the underlying records (ADR-0021 D2) when the server returns the
 *    dataset's `object` + dimension→field mapping.
 *  - bar / column / horizontal-bar / line / area / pie / donut / funnel /
 *    scatter / radar / treemap / sankey → the shared advanced `chart` renderer
 *    with its TRUE chart type and one series per measure. A type the renderer
 *    can't draw maps to its closest family (never a silent blank bar).
 *
 * Errors surface instead of silently showing wrong/empty numbers.
 *
 * Field access goes through `as any` because the bundled `@object-ui/types`
 * `DashboardWidgetSchema` only gains `dataset`/`dimensions`/`values` once
 * objectui bumps its `@objectstack/spec` dependency (cross-repo spec skew).
 */

import { useContext, useEffect, useMemo, useState } from 'react';
import { SchemaRenderer, SchemaRendererContext } from '@object-ui/react';
import {
  buildChartSeries,
  buildOptionColorMap,
  buildDimensionLabelMap,
  buildCategoryOrder,
  relabelDimensions,
  resolveDimensionFieldOptions,
  findChartSeriesRow,
  formatMeasure,
  formatDimensionValue,
  buildDatasetFieldHelpers,
  buildDatasetDrillFilter,
  // The pivot key encoders now live in `@object-ui/core` so this widget and the
  // report renderer's cross-tab share ONE implementation — each having written
  // its own is why the same collision had to be fixed twice (objectstack#5473,
  // objectstack#5665). Aliased to the local name: `pivotRowId` reads right here
  // (this widget only ever encodes DOWN buckets — its across axis is a single
  // dimension), while the shared helper is axis-neutral because the report's
  // cross-tab keys multi-dimension ACROSS buckets with it too.
  pivotBucketId as pivotRowId,
  pivotCellKey,
  compareToTrendLabelKey,
  type CompareToConfig,
  type DatasetResultField,
  type DatasetDrillRange,
} from '@object-ui/core';
import { cn, Skeleton, ChartSkeleton, GridSkeleton } from '@object-ui/components';
import { useSafeFieldLabel, useSafeTranslate } from '@object-ui/i18n';
import { BarChart3, AlertTriangle, Download, ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';
import { useFilterScope } from '@object-ui/react';
import { resolveFilterPlaceholders, computeMetricDelta } from './utils';
import { metricAccentTextClass } from './colorVariants';
import { DrillDownDrawer } from './DrillDownDrawer';

type Row = Record<string, unknown>;
interface DatasetTotals { dimensions: string[]; rows: Row[] }
interface DatasetResult { rows: Row[]; fields?: DatasetResultField[]; object?: string; dimensionFields?: Record<string, string>; drillRawRows?: Row[]; drillRanges?: Array<Record<string, DatasetDrillRange>>; totals?: DatasetTotals[] }
interface DatasetCapableSource {
  queryDataset?: (dataset: string, selection: unknown) => Promise<DatasetResult>;
}

/**
 * Build the record-list filter for a drilled row. Re-exported for back-compat;
 * the implementation now lives in `@object-ui/core` (`buildDatasetDrillFilter`)
 * so the dashboard and the report renderer drill identically.
 */
export const buildDrillFilter = buildDatasetDrillFilter;

/**
 * The pivot key encoders, re-exported for back-compat; the implementations now
 * live in `@object-ui/core` (`pivotBucketId` / `pivotCellKey`) so this widget
 * and the report renderer's cross-tab key their buckets identically. See that
 * module for why both are `JSON.stringify` rather than a delimiter character,
 * and for the null-placeholder residual tracked in objectstack#5666.
 *
 * Every consumer of a row id — the cell index below AND the row-total lookup in
 * the cross-tab renderer — must build its key with these; a second, hand-rolled
 * encoding of the same id is what made the old bug invisible.
 */
export { pivotRowId, pivotCellKey };

/**
 * Pivot flat dataset rows into a cross-tab: `rowDims` go DOWN, `colDim` spreads
 * ACROSS. Returns ordered row/column headers (display labels from the rows) and
 * a map from a `pivotCellKey(rowId, colId)` cell key to the FLAT row index
 * holding that combination's measure values. No re-aggregation — the dataset
 * already grouped by every dimension, so each cell maps to exactly one row (the
 * index is also what drill-through uses to read `drillRawRows`).
 */
export function buildPivot(
  rows: Array<Record<string, unknown>>,
  rowDims: string[],
  colDim: string,
): {
  rowHeaders: Array<{ id: string; labels: string[] }>;
  colHeaders: Array<{ id: string; label: string }>;
  cellIndex: Map<string, number>;
} {
  const rowHeaders: Array<{ id: string; labels: string[] }> = [];
  const colHeaders: Array<{ id: string; label: string }> = [];
  const rowSeen = new Set<string>();
  const colSeen = new Set<string>();
  const cellIndex = new Map<string, number>();
  rows.forEach((row, index) => {
    // Both ids are opaque lookup keys, never displayed — the visible text comes
    // from `labels`/`label` via formatDimensionValue. The column id stays the
    // bare value because a single value needs no boundary; only the row id joins
    // several values, and pivotRowId encodes that join unambiguously. (It used to
    // join them with a control character no dimension value was ASSUMED to carry;
    // pivotRowId needs no such assumption.)
    const rid = pivotRowId(rowDims.map((d) => String(row[d] ?? '∅')));
    const cid = String(row[colDim] ?? '∅');
    if (!rowSeen.has(rid)) { rowSeen.add(rid); rowHeaders.push({ id: rid, labels: rowDims.map((d) => formatDimensionValue(row[d])) }); }
    if (!colSeen.has(cid)) { colSeen.add(cid); colHeaders.push({ id: cid, label: formatDimensionValue(row[colDim]) }); }
    cellIndex.set(pivotCellKey(rid, cid), index);
  });
  return { rowHeaders, colHeaders, cellIndex };
}

/** RFC4180-ish CSV cell: quote when it contains a comma, quote, or newline. */
function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const str = String(v);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Serialize a 2D array (first row = headers) to CSV text. */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Trigger a client-side CSV download (no-op outside the browser). A UTF-8 BOM
 *  is prepended so Excel opens non-ASCII labels (e.g. Chinese) correctly. */
function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>): void {
  if (typeof document === 'undefined') return;
  const base = filename && filename.trim() ? filename.trim() : 'export';
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = base.endsWith('.csv') ? base : `${base}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Column the executor attaches a comparison window's value under. */
const COMPARE_SUFFIX = '__compare';
const compareColumn = (measure: string) => `${measure}${COMPARE_SUFFIX}`;

/**
 * English fallbacks for the `dashboard.trend.*` keys — the SAME vocabulary the
 * inline `MetricWidget` / `ObjectMetricWidget` label their trend with, so a
 * dataset-bound and an inline KPI comparing the same window read identically.
 * No new key is introduced here.
 */
const TREND_LABEL_DEFAULTS: Record<string, string> = {
  vsLastQuarter: 'vs last quarter',
  vsLastMonth: 'vs last month',
  vsLastWeek: 'vs last week',
  vsLastYear: 'vs last year',
  vsYesterday: 'vs yesterday',
  vsPreviousPeriod: 'vs previous period',
};

/**
 * ISO calendar date, optionally carrying a time part — `2026-01-15`,
 * `2026-01-15T08:30:00Z`. Deliberately narrower than `Date.parse` (which also
 * accepts `2026` and `March 5, 2026`); the same shape the dashboard filter
 * layer already holds date values to (`core/utils/dashboard-filters.ts`).
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** A `DatasetSelection.timeDimensions` entry stating a bounded window. */
export interface DatasetTimeWindow {
  dimension: string;
  dateRange: [string, string];
}

/**
 * A **bounded, closed** date window, or null. Exactly `{ $gte, $lte }` with two
 * ISO-date bounds qualifies, and nothing else:
 *
 *  - `{ $gte: 1000 }` on an amount is a numeric range, not a window;
 *  - `$gt` / `$lt` are EXCLUSIVE, and `dateRange` has no exclusive bound —
 *    converting one would silently widen the window by a day;
 *  - a half-open `{ $gte }` alone has no end to shift. A period-over-period
 *    comparison is only defined against a bounded window, so leaving it in the
 *    filter is what makes the executor say so out loud.
 */
function boundedDateWindow(value: unknown): [string, string] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value as object);
  if (keys.length !== 2 || !keys.includes('$gte') || !keys.includes('$lte')) return null;
  const { $gte: from, $lte: to } = value as { $gte: unknown; $lte: unknown };
  if (typeof from !== 'string' || typeof to !== 'string') return null;
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) return null;
  return [from, to];
}

/**
 * Split a RESOLVED runtime filter into the bounded date windows it states and
 * the rest of the filter (objectui#3337 point 5).
 *
 * The executor shifts exactly one thing for a `compareTo`: a `timeDimensions`
 * entry carrying a `dateRange`. A widget states its window in its own `filter`
 * instead (a date macro, or the dashboard's date-range filter merged in by
 * `DashboardRenderer`), which is why forwarding a structured `compareTo` alone
 * still came back "compareTo needs a dated window to shift".
 *
 * Windows are **moved, not copied**: the comparison pass re-runs with the
 * shifted `timeDimensions` but the SAME `runtimeFilter`, so a copy left behind
 * would intersect the shifted window with the current one and every
 * `<measure>__compare` column would come back empty.
 *
 * Only CONJUNCTIVE positions are walked — the top level and `$and` members. A
 * window inside `$or` / `$not` is not a window the whole query runs in, so it
 * stays in the filter untouched.
 *
 * **Which dimension gets shifted is not decided here.** Every window found is
 * lowered under the name the author wrote. Zero of them, or two, is the
 * executor's error to raise — it names the candidates (`resolveCompareDimension`).
 * Guessing one renderer-side would trade a loud error for a quietly wrong
 * window, which is the failure class objectstack#5011 set out to end.
 */
export function extractDateWindows(filter: unknown): {
  windows: DatasetTimeWindow[];
  rest: Record<string, unknown> | undefined;
} {
  // Insertion-ordered so the lowered windows (and any executor message listing
  // them) are deterministic.
  const ranges = new Map<string, [string, string]>();

  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    const out: Record<string, unknown> = {};
    let conjuncts: Record<string, unknown>[] | null = null;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === '$and' && Array.isArray(value)) {
        conjuncts = value
          .map(walk)
          .filter(
            (c): c is Record<string, unknown> =>
              !!c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length > 0,
          );
        continue;
      }
      // Any other operator ($or, $not, …) is left whole, contents included.
      if (key.startsWith('$')) {
        out[key] = value;
        continue;
      }
      const range = boundedDateWindow(value);
      if (!range) {
        out[key] = value;
        continue;
      }
      const prev = ranges.get(key);
      // Two conjunctive windows on ONE dimension are their intersection — plain
      // arithmetic on the AND, not a heuristic. (The realistic pair: a widget
      // that dates its own filter under a dashboard date-range filter bound to
      // the same field.) Lexicographic comparison is chronological for ISO
      // dates, whose fixed-width prefix orders bare dates and timestamps alike.
      ranges.set(
        key,
        prev
          ? [prev[0] > range[0] ? prev[0] : range[0], prev[1] < range[1] ? prev[1] : range[1]]
          : range,
      );
    }
    if (conjuncts && conjuncts.length > 0) out.$and = conjuncts;
    return out;
  };

  const walked = walk(filter) as Record<string, unknown> | undefined;
  let rest = walked && Object.keys(walked).length > 0 ? walked : undefined;
  // `{ $and: [x] }` — a one-member conjunction left after its sibling was
  // lowered — is just `x`. Unwrapped only at the top level and only when it is
  // the sole key, so no sibling condition can be overwritten by the merge.
  const only = rest && Object.keys(rest).length === 1 && Array.isArray(rest.$and) && rest.$and.length === 1
    ? (rest.$and[0] as Record<string, unknown>)
    : undefined;
  if (only) rest = only;

  return {
    windows: Array.from(ranges, ([dimension, dateRange]) => ({ dimension, dateRange })),
    rest,
  };
}

/** Single-value KPI widget types — rendered as a number, not a chart. */
const METRIC_TYPES = new Set(['metric', 'kpi', 'gauge', 'solid-gauge', 'bullet']);

/**
 * Map a dashboard widget `type` to the advanced chart renderer's `chartType`.
 * Families the renderer doesn't draw distinctly fall back to their closest
 * relative (e.g. `spline`/`step-line` → line, `stacked-area` → area,
 * `pyramid` → funnel, grouped/stacked/bi-polar bars → bar) so a widget never
 * renders blank or as a misleading default.
 */
const CHART_TYPE_MAP: Record<string, string> = {
  bar: 'bar',
  column: 'column',
  'horizontal-bar': 'horizontal-bar',
  'grouped-bar': 'bar',
  'stacked-bar': 'bar',
  'bi-polar-bar': 'bar',
  line: 'line',
  spline: 'line',
  'step-line': 'line',
  area: 'area',
  'stacked-area': 'area',
  pie: 'pie',
  donut: 'donut',
  funnel: 'funnel',
  pyramid: 'funnel',
  scatter: 'scatter',
  bubble: 'scatter',
  radar: 'radar',
  treemap: 'treemap',
  sankey: 'sankey',
};

/**
 * Lower a dashboard widget's declared `chartConfig` (spec `ChartConfigSchema` —
 * the same shape a report block and a react `<ObjectChart>` parse) onto the
 * chart schema this widget hands to the renderer.
 *
 * ## Why this is a whitelist and not a spread
 *
 * Until #3135 NONE of `chartConfig` reached the renderer: this widget read
 * `options` and nothing else, so an author who wrote `showLegend: false` still
 * got a legend and one who wrote `true` only got one because "on" is the
 * renderer's default. #3135 lowered that single flag and left the rest declared
 * and inert. objectstack#7016 lowers the rest of the keys that are actually
 * DELIVERED, admitting a key only when both of these hold:
 *
 *  1. **The chart block draws it end to end on this path.** `{ type: 'chart' }`
 *     resolves to `ChartRenderer` → `AdvancedChartImpl`, which draws
 *     `title`/`subtitle` in its ChartFrame, turns `description` into the chart
 *     container's `role="img"` + `aria-label`, applies `height` as that
 *     container's inline height, reads `colors` as the positional palette,
 *     prints `showDataLabels` as a Recharts `LabelList`, draws `annotations` as
 *     ReferenceLine/ReferenceArea and honours `interaction` as the tooltip
 *     toggle plus `Brush`. Forwarding a key the renderer ignores would only
 *     move declared-but-not-delivered one layer down, which is the failure this
 *     change exists to remove.
 *  2. **It does not fight the dataset derivation.** `xAxis` / `yAxis` /
 *     `series` are DERIVED from the dataset selection (`buildChartSeries`), so
 *     they stay unforwarded: an authored axis or series array would shadow the
 *     derived binding and blank the chart. `type` stays out for the same
 *     reason — the widget's own `type` already picks the family through
 *     `CHART_TYPE_MAP`, which is the dataset path's chart-family channel.
 *
 * `aria` is the one declared key with **no reader at all** on this path:
 * `AdvancedChartImpl` has no `aria` prop, and `SchemaRenderer`'s ARIA injection
 * reads the FLAT `ariaLabel`/`ariaDescribedBy`/`role`, never a nested `aria`
 * object. It is therefore left unforwarded on purpose (criterion 1) and
 * reported back to objectstack#5175's narrowing half rather than papered over
 * with a dashboard-only flattening that would also collide with the accessible
 * name `description` already sets.
 *
 * @param raw the widget's `chartConfig` as authored (anything, incl. absent)
 * @param fieldCategoryColors per-category colours resolved from the category
 *   dimension's own select/lookup option colours, merged UNDER an explicit
 *   author map (see the `colors` note below)
 * @returns only the keys that resolved, so the caller can spread it over the
 *   derived chart schema and every undeclared key keeps the renderer's default
 */
export function chartConfigPresentation(
  raw: unknown,
  fieldCategoryColors?: Record<string, string> | null,
): Record<string, unknown> {
  const config: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};

  const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

  if (typeof config.showLegend === 'boolean') out.showLegend = config.showLegend;
  if (typeof config.showDataLabels === 'boolean') out.showDataLabels = config.showDataLabels;
  const title = text(config.title);
  if (title) out.title = title;
  const subtitle = text(config.subtitle);
  if (subtitle) out.subtitle = subtitle;
  const description = text(config.description);
  if (description) out.description = description;
  // A non-positive height would collapse the plot; the container default is the
  // more honest answer than an invisible chart.
  if (typeof config.height === 'number' && Number.isFinite(config.height) && config.height > 0) {
    out.height = config.height;
  }
  if (Array.isArray(config.annotations) && config.annotations.length > 0) out.annotations = config.annotations;
  if (config.interaction && typeof config.interaction === 'object' && !Array.isArray(config.interaction)) {
    out.interaction = config.interaction;
  }

  // `colors` is overloaded kanban-style — and the two arms reach the renderer
  // through two DIFFERENT props, so the split has to happen here (the react
  // tier's ObjectChart splits it the same way): a `string[]` is the positional
  // palette (`colors`), a `{ value: color }` record is an explicit per-category
  // map (`categoryColors`). The author's map is merged OVER the dimension
  // field's own option colours, which is the precedence the spec field comment
  // states ("a value→color map — and a select/lookup dimension's option colors
  // — take precedence over the positional palette per category").
  const palette = Array.isArray(config.colors)
    ? config.colors.filter((c): c is string => typeof c === 'string' && !!c)
    : undefined;
  if (palette?.length) out.colors = palette;
  const authorCategoryColors =
    config.colors && typeof config.colors === 'object' && !Array.isArray(config.colors)
      ? (config.colors as Record<string, string>)
      : undefined;
  if (fieldCategoryColors || authorCategoryColors) {
    out.categoryColors = { ...(fieldCategoryColors ?? {}), ...(authorCategoryColors ?? {}) };
  }

  return out;
}

export function DatasetWidget({ widget, dataSource }: { widget: any; dataSource: unknown }) {
  const datasetName = String(widget?.dataset ?? '');
  const dimensions: string[] = useMemo(() => (Array.isArray(widget?.dimensions) ? widget.dimensions.filter(Boolean) : []), [widget]);
  const values: string[] = useMemo(() => (Array.isArray(widget?.values) ? widget.values.filter(Boolean) : []), [widget]);
  // `widget.compareTo` IS the executor's contract since objectstack#5011 —
  // `{ kind, dimension? }`, the same `DatasetCompareTo` the selection carries —
  // so it forwards unchanged. It used to be a three-branch union whose two
  // string arms had no meaning downstream and were dropped right here; the
  // convergence deleted the arms instead of keeping the workaround, so there is
  // no longer a widget form this path has to quietly discard. A stale string
  // left in stored metadata is now INVALID metadata, rejected where it is
  // authored/published — not laundered here into a different query
  // (AGENTS.md #0.1).
  const compareTo: CompareToConfig | undefined = widget?.compareTo;
  const widgetType = String(widget?.type ?? '');
  const isMetric = METRIC_TYPES.has(widgetType) || dimensions.length === 0;
  const isTable = widgetType === 'table' || widgetType === 'pivot';
  // pivot with ≥2 dims → a true cross-tab: last dim spreads across as columns,
  // the rest go down as rows. Computed up-front so the fetch can also request
  // the matching subtotal groupings.
  const isMatrix = widgetType === 'pivot' && dimensions.length >= 2;
  const rowDims = isMatrix ? dimensions.slice(0, -1) : [];
  const colDim = isMatrix ? dimensions[dimensions.length - 1] : '';
  // Row subtotals, column subtotals, and the grand total ([]) — the server
  // computes each with the measure's TRUE aggregate (never re-derived here).
  const totalsGroupings = isMatrix ? [rowDims, [colDim], []] : undefined;

  // ── Query-affecting widget options (framework#3588) ──────────────────────
  // `options` is the renderer-extras bag, but four of its keys are NOT
  // presentation-only: they change the query the server compiles. They were
  // accepted by the metadata layer and then dropped here — this component never
  // read `options` at all — so `dateGranularity: 'month'` grouped by the raw
  // timestamp (one bar per record) and `sortBy` produced no ordering. Lower
  // them into the `DatasetSelection` the server already understands.
  const options: Record<string, unknown> =
    widget?.options && typeof widget.options === 'object' && !Array.isArray(widget.options)
      ? (widget.options as Record<string, unknown>)
      : {};
  const dateGranularity = typeof options.dateGranularity === 'string' ? options.dateGranularity : undefined;
  const sortBy = typeof options.sortBy === 'string' && options.sortBy ? options.sortBy : undefined;
  // Only order by something this widget actually projects — the server rejects
  // an order key it can't resolve, and a stale `sortBy` left behind by an edit
  // should degrade to "unordered", not fail the whole widget.
  const sortable = sortBy && (dimensions.includes(sortBy) || values.includes(sortBy)) ? sortBy : undefined;
  const order = sortable
    ? { [sortable]: options.sortOrder === 'desc' ? ('desc' as const) : ('asc' as const) }
    : undefined;
  const limit = typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0
    ? Math.floor(options.limit)
    : undefined;

  const tt = useSafeTranslate();
  const { fieldLabel } = useSafeFieldLabel();

  // ADR-0021 dual-form: the widget's presentation-scope `filter` must flow into
  // the dataset query as `runtimeFilter`, or a dataset-bound widget renders the
  // UNFILTERED total (e.g. "open pipeline" showing the grand total). Resolve
  // placeholders client-side first — exactly as the legacy widget renderers do
  // (the server expands neither `{current_quarter_start}` nor
  // `{current_user_id}`). Keyed on the raw filter ref so the resolution is
  // stable across renders.
  //
  // Resolve BOTH vocabularies. This used to call `resolveDateMacros` alone, so
  // a user-scoped widget sent `{current_user_id}` to SQL as a literal, matched
  // no row, and rendered 0 with no error anywhere (framework #3574).
  const filterScope = useFilterScope();
  // Host-authenticated fetch for the object-schema probe further down
  // (objectui#4121). This widget takes its `dataSource` as a PROP and reads no
  // other context, so the channel has to be read here — the same context the
  // rest of the family reads (`ObjectChart`, `ObjectGantt`, `useViewData`,
  // `useRecordEditable`), consulted DIRECTLY rather than via
  // `useSchemaContext()`, which throws when no provider is mounted: a widget
  // rendered outside a host (every existing suite in this package) must keep
  // degrading to the global fetch instead of crashing the render.
  const apiFetch = useContext(SchemaRendererContext)?.apiFetch;
  const rawFilter = widget?.filter;
  const runtimeFilter = useMemo(
    () => (rawFilter && typeof rawFilter === 'object' && Object.keys(rawFilter).length > 0
      ? resolveFilterPlaceholders(rawFilter, filterScope)
      : undefined),
    [rawFilter, filterScope],
  );

  // ── The comparison window (objectui#3337 point 5) ────────────────────────
  // Lower the widget's already-resolved date window into the one place the
  // executor can shift it — `selection.timeDimensions[].dateRange` — and only
  // when a comparison is actually asked for. Without a comparison the window
  // says exactly the same thing in `runtimeFilter`, and leaving every other
  // widget's query byte-identical keeps this change to the path it is about.
  // See `extractDateWindows` for why the windows are MOVED and why the choice
  // of dimension is left to the executor.
  const { windows: compareWindows, rest: selectionFilter } = useMemo(
    () => (compareTo
      ? extractDateWindows(runtimeFilter)
      : { windows: [] as DatasetTimeWindow[], rest: runtimeFilter }),
    [compareTo, runtimeFilter],
  );

  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; rows: Row[]; fields?: DatasetResultField[]; object?: string; dimensionFields?: Record<string, string>; drillRawRows?: Array<Record<string, unknown>>; drillRanges?: Array<Record<string, DatasetDrillRange>>; totals?: DatasetTotals[]; error?: string }>({ status: 'idle', rows: [] });
  // Drill-through (ADR-0021 D2): the clicked bucket's record-list filter + title.
  const [drill, setDrill] = useState<{ filter: Record<string, unknown>; title: string } | null>(null);
  // Per-category colors: when the chart's first dimension is a select/lookup
  // field, paint each category in its option color (health green/red/yellow)
  // instead of the generic --chart-1..5 palette — the same wiring the chart
  // view uses (ObjectChart). The renderer's `categoryColors` map wins over the
  // positional palette and falls back to it for categories without a color.
  const [categoryColors, setCategoryColors] = useState<Record<string, string> | null>(null);
  // Per-dimension {value → label} maps. The dataset groups by a select field's
  // stored value (e.g. `active`); the chart axis must read the option label
  // (e.g. `合作中`). The server resolves this when it can, but an AI-built
  // select whose options the analytics layer can't see comes back value-keyed,
  // so we resolve it here from the object field options (see relabelDimensions).
  const [dimensionLabels, setDimensionLabels] = useState<Record<string, Record<string, string>> | null>(null);
  // The first dimension's DECLARED picklist order (framework#3588) — the
  // sequence the author wrote the options in on the object. For an
  // ordered-sequence chart (funnel/pyramid) that order IS the domain order
  // (Qualification → Needs Analysis → Proposal → Negotiation); grouping returns
  // buckets alphabetically, which draws a shape that reads as a pipeline but
  // isn't one. Fetched from the same object schema as the colours/labels below.
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);

  // Signature uses the RAW filter (stable) — the resolved one carries a
  // render-time `now` and would otherwise force a refetch loop. The
  // query-affecting options join it so editing a widget's granularity/sort in
  // the designer refetches instead of re-rendering the previous grid.
  const signature = `${widgetType}|${datasetName}|${dimensions.join(',')}|${values.join(',')}|${JSON.stringify(rawFilter ?? null)}|${JSON.stringify(compareTo ?? null)}|${dateGranularity ?? ''}|${JSON.stringify(order ?? null)}|${limit ?? ''}`;
  useEffect(() => {
    const src = dataSource as DatasetCapableSource | undefined;
    if (!src || typeof src.queryDataset !== 'function') {
      setState({ status: 'error', rows: [], error: tt('dashboard.datasetUnsupported', 'This data source does not support dataset queries.') });
      return;
    }
    if (values.length === 0) { setState({ status: 'idle', rows: [] }); return; }
    let cancelled = false;
    setState({ status: 'loading', rows: [] });
    src.queryDataset(datasetName, {
      dimensions,
      measures: values,
      ...(selectionFilter ? { runtimeFilter: selectionFilter } : {}),
      ...(compareWindows.length > 0 ? { timeDimensions: compareWindows } : {}),
      ...(compareTo ? { compareTo } : {}),
      ...(totalsGroupings ? { totals: { groupings: totalsGroupings } } : {}),
      ...(dateGranularity ? { dateGranularity } : {}),
      ...(order ? { order } : {}),
      ...(limit != null ? { limit } : {}),
    })
      .then((res) => { if (!cancelled) setState({ status: 'ok', rows: Array.isArray(res?.rows) ? res.rows : [], fields: Array.isArray(res?.fields) ? res.fields : [], object: res?.object, dimensionFields: res?.dimensionFields, drillRawRows: Array.isArray(res?.drillRawRows) ? res.drillRawRows : undefined, drillRanges: Array.isArray(res?.drillRanges) ? res.drillRanges : undefined, totals: Array.isArray(res?.totals) ? res.totals : undefined }); })
      .catch((e) => { if (!cancelled) setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Resolve the dimensions' select/lookup field options (charts only;
  // metric/table don't use per-category colors or axis relabeling). The dataset
  // query gives us the base `object` + the dimension→field map, so ONE object
  // schema fetch yields both: a {value|label → color} map for the first
  // dimension's per-category colors, and a {value → label} map per dimension so
  // the axis/series display labels even when the server returned raw values.
  // Best-effort: any failure leaves both null (positional palette + raw values).
  //
  // The read rides the host's AUTHENTICATED fetch (objectui#4121) — the same
  // channel `provider: 'api'` view sources use — falling back to the global one
  // only when no host supplies it. A bearer-token session carries its credential
  // in the `Authorization` header, not a cookie, so `credentials: 'include'`
  // alone left this read unauthenticated in a hosted console; combined with the
  // best-effort shape above the symptom was not an error but semantic option
  // colors and dimension labels silently never applying.
  useEffect(() => {
    const object = state.object;
    // The METRIC branch renders ONE measure value plus that measure's header
    // label — a dimension's value never reaches its output in any spelling — so
    // there is nothing on that path to relabel and resolving would be a
    // metadata read nothing consumes (objectui#4263, pinned).
    if (isMetric || !object || dimensions.length === 0) { setCategoryColors(null); setDimensionLabels(null); setCategoryOrder(null); return; }
    const fieldOf = (dim: string) => (state.dimensionFields && state.dimensionFields[dim]) || dim;
    // ── Which dimensions this widget type resolves (objectui#4263) ──────────
    // On table/pivot the SERVER resolves a dimension's display label
    // (ADR-0021) — that is exactly why objectui#4053's `table` widget rendered
    // `Education` while its chart rendered `education`. So this client net
    // stays OFF for LOCAL dimensions there: running it would be a SECOND
    // resolution of a value the server already resolved. It opens only for
    // DOTTED paths, the case the server is silent on too (#4053's premise),
    // where this is the only resolution available and the table would
    // otherwise show the raw stored enum.
    //
    // Charts keep resolving EVERY dimension: the server's silence for an
    // AI-built select is the whole reason this net exists there.
    const dottedOnly = isTable;
    const resolveDims = dottedOnly ? dimensions.filter((d) => fieldOf(d).includes('.')) : dimensions;
    // A table with no dotted dimension resolves nothing and — the part that
    // makes "unchanged" literal — never issues the metadata read at all.
    if (resolveDims.length === 0) { setCategoryColors(null); setDimensionLabels(null); setCategoryOrder(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const doFetch = apiFetch ?? fetch;
        const loadObjectSchema = async (name: string) => {
          const r = await doFetch(`/api/v1/meta/object/${encodeURIComponent(name)}`, { headers: { accept: 'application/json' }, credentials: 'include' });
          const doc = await r.json().catch(() => null);
          return doc?.item ?? doc?.data ?? doc;
        };
        const objSchema = await loadObjectSchema(object);
        // A dimension's field may be a DOTTED relationship path
        // (`crm_account.industry`) whose options live on the RELATED object, not
        // on the dataset's base object — objectui#4053. `resolveDimensionFieldOptions`
        // is the object-resolution step of this same lookup: a local field name
        // still resolves straight off `objSchema`, a dotted one walks each hop
        // through the SAME channel `objSchema` came from. Unresolvable paths
        // yield no entry, so the raw value survives exactly as before.
        const optionsByPath = await resolveDimensionFieldOptions(
          objSchema,
          resolveDims.map(fieldOf),
          loadObjectSchema,
        );
        // Per-category COLOURS and the declared category ORDER are chart wiring
        // — they key the palette and the axis sequence, neither of which a
        // table or pivot renders. They stay null on that path exactly as they
        // did when it returned early (objectui#4263).
        const firstDimOptions = dottedOnly ? undefined : optionsByPath[fieldOf(dimensions[0])];
        const colorMap = buildOptionColorMap(firstDimOptions);
        const labels: Record<string, Record<string, string>> = {};
        for (const dim of resolveDims) {
          const m = buildDimensionLabelMap(optionsByPath[fieldOf(dim)]);
          if (m) labels[dim] = m;
        }
        if (!cancelled) {
          setCategoryColors(colorMap);
          setDimensionLabels(Object.keys(labels).length > 0 ? labels : null);
          setCategoryOrder(buildCategoryOrder(firstDimOptions));
        }
      } catch { if (!cancelled) { setCategoryColors(null); setDimensionLabels(null); setCategoryOrder(null); } }
    })();
    return () => { cancelled = true; };
    // `apiFetch` joins the deps (objectui#4121) exactly as it does in
    // `useRecordEditable`'s. It does not re-open this file's documented refetch
    // concern — that one is on the query effect above and is about a
    // render-time `now` inside the RESOLVED filter, i.e. a value this component
    // recomputes every render. `apiFetch` is not: it comes from the provider's
    // memoized context value, and this widget's own `setState` cannot re-render
    // the provider, so the identity is stable across the effect's own updates.
    // The in-repo host holds it at module scope (`ConsoleShell.tsx:187` → `:245`).
  }, [state.object, state.dimensionFields, dimensions, isMetric, isTable, apiFetch]);

  if (values.length === 0) {
    return <div className="flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">{tt('dashboard.pickMeasures', 'Pick measures (values) for this dataset widget.')}</div>;
  }
  // Pending → a SHAPE-MATCHED skeleton, not a 0-value chart or an empty table.
  // The widget's eventual footprint (chart bars / table rows / a KPI number) is
  // hinted while `queryDataset` is in flight so the first paint reads as
  // "loading", never as "broken / empty". Three states stay distinct: this is
  // loading; `state.rows.length === 0 && status==='ok'` is the empty state
  // ("No rows" / a KPI 0) handled below; data renders last.
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div
        className="h-full w-full p-2"
        data-testid="dataset-loading"
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">{tt('dashboard.loading', 'Loading…')}</span>
        {isMetric ? (
          <div className="flex h-full w-full flex-col items-start justify-center gap-2 p-2">
            <Skeleton className="h-8 w-32 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        ) : isTable ? (
          <GridSkeleton
            className="h-full"
            rows={5}
            columns={Math.max(2, dimensions.length + values.length)}
          />
        ) : (
          <ChartSkeleton className="h-full" />
        )}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div role="alert" className="flex h-full w-full items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span className="break-words">{state.error}</span>
      </div>
    );
  }
  // A metric (single value) over an empty dataset is 0, not "No rows" — the
  // latter reads as broken for KPIs like "Total Books" on a fresh app. Charts
  // and tables keep the empty state (there is genuinely nothing to plot).
  if (state.rows.length === 0 && !isMetric) {
    return <div className="flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground"><BarChart3 className="mr-2 h-4 w-4" />{tt('dashboard.noRows', 'No rows')}</div>;
  }

  // Measure metadata (label + format + currency) + header-label resolution,
  // shared with the report renderer via @object-ui/core.
  const { measureField, headerLabel } = buildDatasetFieldHelpers(state.fields, state.object, fieldLabel);

  // --- Comparison overlay (objectui#3337) ---------------------------------
  // The executor attaches a `<measure>__compare` column per measure once it has
  // a window to shift. Showing it is the visible half of the comparison:
  // forwarding `compareTo` and lowering the window only get the numbers INTO
  // the result, and a widget that then drops them renders the very "silently no
  // comparison" this issue is about. The comparison values carry the base
  // measure's own format (they are the same measure over an earlier window).
  const comparedValues = compareTo
    ? values.filter((m) => state.rows.some((r) => r[compareColumn(m)] != null))
    : [];
  // Window label from the SAME `dashboard.trend.*` vocabulary the inline metric
  // widget uses. `compareToTrendLabelKey` reads `compareTo.kind` and — for
  // `previousPeriod` — the RAW filter's macro tokens, so "vs last quarter"
  // survives the resolution that turned those tokens into dates.
  const compareTrendKey = compareTo ? compareToTrendLabelKey(compareTo, rawFilter) : '';
  const compareLabel = compareTo
    ? tt(`dashboard.trend.${compareTrendKey}`, TREND_LABEL_DEFAULTS[compareTrendKey] ?? 'vs previous period')
    : '';

  // --- Drill-through (shared by table/pivot AND chart) -------------------
  // Available when the server returned the dataset's base object + at least one
  // drillable dimension this widget groups by. Tables/pivots drill by row index;
  // charts map a clicked segment back to its dataset row (see handleChartDrill).
  const { object: drillObject, dimensionFields, drillRawRows, drillRanges } = state;
  const drillDims = dimensionFields ? dimensions.filter((d) => d in dimensionFields) : [];
  // #1752: a date-only widget has no equality drill dim but still drills by the
  // server's per-row date RANGE, so the presence of ranges makes it drillable too.
  const canDrill = !!drillObject && (drillDims.length > 0 || !!drillRanges?.length);
  const openDrill = (index: number, title: string) => {
    if (!drillObject) return;
    const merged = buildDrillFilter(drillRawRows?.[index], drillDims, dimensionFields ?? {}, runtimeFilter, drillRanges?.[index]);
    setDrill({ filter: merged, title: title || String(widget?.title ?? '') });
  };
  const drillDrawer = drill && drillObject ? (
    <DrillDownDrawer
      open
      onClose={() => setDrill(null)}
      title={drill.title || String(widget?.title ?? tt('dashboard.details', 'Details'))}
      objectName={drillObject}
      filter={drill.filter}
      dataSource={dataSource}
    />
  ) : null;

  // Metric / KPI — show the single measure value of the first row, using the
  // measure's display label (not the raw name) and its format (e.g. "$616,000").
  if (isMetric) {
    const f = measureField(values[0]);
    const value = state.rows[0]?.[values[0]] ?? 0;
    // Period-over-period delta, computed from the SAME `computeMetricDelta` the
    // inline KPI uses so both surfaces round and sign it identically.
    const previous = state.rows[0]?.[compareColumn(values[0])];
    const delta = comparedValues.includes(values[0])
      ? computeMetricDelta(
          typeof value === 'number' ? value : null,
          typeof previous === 'number' ? previous : null,
        )
      : null;
    // ── The declared accent (objectui#3359, objectstack#5010 ruling B) ──────
    // `widget.colorVariant` has been spec-declared and authored for a long time
    // (16 live authorizations across platform-objects' system_overview and
    // app-showcase's dashboards, every one of them a dataset-bound `metric`) —
    // and `dataset` being REQUIRED on DashboardWidgetSchema means every legal
    // widget lands here, in a component that read the key nowhere. So the
    // renderer painted all sixteen identically and the key was declared but
    // never enforced.
    //
    // It maps onto the accent system this package already has rather than a new
    // one: no icon chip and no card chrome is rendered here, exactly like
    // MetricWidget's `bare` layout, so the accent lands where that layout puts
    // it — on the big number, via the same shared `VARIANT_TEXT_CLASSES`. A
    // dataset-bound KPI and an inline `bare` KPI declaring the same variant now
    // read the same. No declaration (and the enum's own `'default'`) resolves to
    // `undefined`, which `cn` drops: the markup of every widget that never
    // declared the key stays byte-identical.
    const accentClass = metricAccentTextClass(widget?.colorVariant);
    return (
      <div className="flex h-full w-full flex-col items-start justify-center gap-1 p-2">
        <span className={cn('text-2xl font-semibold tabular-nums', accentClass)}>{formatMeasure(value, f?.format, f?.currency, f?.percentScale)}</span>
        {delta && (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground" data-testid="dataset-compare-trend">
            <span className={cn(
              'flex shrink-0 items-center font-medium',
              delta.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
              delta.direction === 'down' && 'text-rose-600 dark:text-rose-400',
              delta.direction === 'neutral' && 'text-muted-foreground',
            )}>
              {delta.direction === 'up' && <ArrowUpIcon className="mr-1 h-3 w-3" />}
              {delta.direction === 'down' && <ArrowDownIcon className="mr-1 h-3 w-3" />}
              {delta.direction === 'neutral' && <MinusIcon className="mr-1 h-3 w-3" />}
              {delta.value}%
            </span>
            <span className="min-w-0 truncate">{compareLabel}</span>
          </div>
        )}
        <span className="text-xs text-muted-foreground">{headerLabel(values[0])}</span>
      </div>
    );
  }

  // Table / pivot — a grouped table or, for a pivot with ≥2 dimensions, a true
  // cross-tab.
  if (isTable) {
    // ── The dotted gap-fill's display rows (objectui#4263) ──────────────────
    // The table/pivot branch renders `state.rows` as they arrived, which is
    // correct for a LOCAL dimension (the server resolved its label) and leaves
    // a DOTTED one showing the raw stored enum, since nothing resolved it.
    // `dimensionLabels` is populated on this path for DOTTED dimensions ONLY
    // (see the resolution effect), so for a table whose dimensions are all
    // local it is null and `relabelDimensions` returns `state.rows` ITSELF —
    // the same array identity, hence the same rendered bytes as before this
    // change. It is value-keyed and idempotent besides, so a value the server
    // already resolved has no entry and passes through untouched.
    //
    // Row ORDER and COUNT are preserved, which is what keeps `openDrill(i)`
    // and `pivot.cellIndex` aligned with the raw `drillRawRows` they index
    // into — a drill still filters by the stored value, never the label.
    const displayRows = relabelDimensions(state.rows, dimensionLabels);
    // Drill-through (canDrill / openDrill / drillDrawer) is computed above and
    // shared with the chart path — tables/pivots drill by flat row index.
    // CSV export — display-label headers + the underlying grouped rows (measures
    // kept numeric so the data round-trips into a spreadsheet). Shared by the flat
    // table and the cross-tab.
    // Measure columns, each followed by its comparison column when the executor
    // attached one. `compareOf` names the base measure a comparison column
    // belongs to — its format, and the label it is qualified with, both come
    // from that measure (a comparison is the same measure over an earlier
    // window). A measure literally named `<x>__compare` is still itself.
    const compareOf = (column: string): string | undefined => {
      if (values.includes(column) || !column.endsWith(COMPARE_SUFFIX)) return undefined;
      const base = column.slice(0, -COMPARE_SUFFIX.length);
      return values.includes(base) ? base : undefined;
    };
    const columnLabel = (column: string): string => {
      const base = compareOf(column);
      return base ? `${headerLabel(base)} · ${compareLabel}` : headerLabel(column);
    };
    const measureColumns = values.flatMap((m) =>
      comparedValues.includes(m) ? [m, compareColumn(m)] : [m],
    );
    // The cross-tab exports its comparison columns too (objectui#3614), even
    // though its DISPLAY stacks them inside the cell: a CSV is data, not a
    // picture of the table. So each compared measure keeps its own flat
    // `<measure>__compare` column here and every exported cell stays the bare
    // number a spreadsheet can compute on — serializing the stacked cell would
    // emit strings like "$120 $100 20%", which is a screenshot in CSV clothing.
    const exportColumns = [...dimensions, ...measureColumns];
    const exportCsv = () => downloadCsv(String(widget?.title ?? datasetName ?? 'export'), [
      exportColumns.map((c) => columnLabel(c)),
      // The CSV follows the table's own cells (objectui#4263): a dotted
      // dimension exports the label the table now shows, and a local one is
      // unchanged for the same reason its cell is.
      ...displayRows.map((r) => exportColumns.map((c) => {
        const v = r[c];
        return v == null ? '' : (typeof v === 'number' ? v : String(v));
      })),
    ]);
    const exportBtn = (
      <button
        type="button"
        onClick={exportCsv}
        data-testid="dataset-export"
        title={tt('dashboard.exportCsv', 'Export CSV')}
        aria-label={tt('dashboard.exportCsv', 'Export CSV')}
        className="absolute right-1 top-1 z-10 rounded p-1 text-muted-foreground opacity-70 hover:bg-accent/50 hover:text-foreground hover:opacity-100"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    );

    // pivot → a true cross-tab when there are ≥2 dimensions: the LAST dimension
    // spreads ACROSS as columns, the rest go DOWN as rows, measures fill the
    // cells. The dataset already returns one row per dimension combination, so
    // cells just place those pre-aggregated values — no client re-aggregation
    // (an avg/min/max can't be recombined). With <2 dimensions a cross-tab is
    // meaningless, so it degrades to the flat grouped table.
    if (isMatrix) {
      const pivot = buildPivot(displayRows, rowDims, colDim);
      // Single measure → one column per across-bucket; multiple → bucket × measure.
      const cellCols = pivot.colHeaders.flatMap((col) =>
        values.map((m) => ({ col, measure: m, header: values.length === 1 ? col.label : `${col.label} · ${headerLabel(m)}` })),
      );
      const fmtMeasure = (v: unknown, m: string) => formatMeasure(v, measureField(m)?.format, measureField(m)?.currency, measureField(m)?.percentScale);
      // ── The comparison, stacked inside the cell (objectui#3614) ───────────
      // A cross-tab's columns are already `bucket × measure`; giving the
      // comparison a column of its own would make them `bucket × measure ×
      // window` — twice the width and a third header level — on the one widget
      // family whose width is already the scarce resource. So the comparison
      // stacks INSIDE the cell instead: the current value on top, the
      // comparison value and its delta beneath in smaller type. Column
      // structure, header depth and the row/column subtotal correspondence all
      // stay exactly as they were.
      //
      // Presence is read from the DATA — the `<measure>__compare` column the
      // executor attaches — via the same `comparedValues` the KPI, flat-table
      // and chart paths read, so there is no widget flag to set and a pivot the
      // executor sent no comparison for renders exactly as it did before.
      //
      // Subtotals get the same treatment as data cells, deliberately: a Total
      // column that alone showed no comparison reads as "this row has none",
      // which is a different — and false — statement.
      const compareStack = (row: Row | undefined, measure: string) => {
        if (!comparedValues.includes(measure)) return null;
        const previous = row?.[compareColumn(measure)];
        if (previous == null) return null;
        const current = row?.[measure];
        // The SAME delta helper the KPI path uses, so a dataset KPI and a
        // cross-tab cell over the same two windows agree on sign and rounding
        // instead of each rolling their own percentage.
        const delta = computeMetricDelta(
          typeof current === 'number' ? current : null,
          typeof previous === 'number' ? previous : null,
        );
        return (
          <div
            className="flex items-center justify-end gap-1 text-[10px] font-normal leading-tight text-muted-foreground"
            data-testid="matrix-cell-compare"
            data-direction={delta?.direction}
            title={compareLabel}
          >
            {/* A comparison is the same measure over an earlier window, so it
                carries that measure's own format — never a bare number. */}
            <span className="tabular-nums">{fmtMeasure(previous, measure)}</span>
            {delta && (
              <span
                className={cn(
                  'flex shrink-0 items-center tabular-nums font-medium',
                  delta.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
                  delta.direction === 'down' && 'text-rose-600 dark:text-rose-400',
                )}
              >
                {delta.direction === 'up' && <ArrowUpIcon className="h-2.5 w-2.5" />}
                {delta.direction === 'down' && <ArrowDownIcon className="h-2.5 w-2.5" />}
                {delta.direction === 'neutral' && <MinusIcon className="h-2.5 w-2.5" />}
                {delta.value}%
              </span>
            )}
          </div>
        );
      };
      // One caption names the comparison window for the whole table. The
      // stacked numbers are otherwise unlabeled, and repeating "vs last year"
      // in every cell would drown the grid it annotates. The flat table
      // qualifies its comparison COLUMN header instead; a cross-tab has no
      // per-window header to qualify, which is exactly what stacking traded.
      const compareCaption = comparedValues.length > 0 ? (
        <caption
          className="px-2 pb-1 text-left text-[10px] font-normal text-muted-foreground"
          data-testid="matrix-compare-caption"
        >
          {compareLabel}
        </caption>
      ) : null;
      // Server-supplied marginal totals (ADR-0021): match each grouping by its
      // dimension array, then its rows to the pivot headers via the same bucket
      // ids. Absent (older server) → maps stay empty and no totals UI renders.
      const findTotals = (dims: string[]) => {
        const totalRows = state.totals?.find((t) => Array.isArray(t.dimensions) && t.dimensions.join(',') === dims.join(','))?.rows;
        // Marginal totals arrive keyed by the RAW dimension value, and their
        // bucket ids are re-derived below from those values to meet the
        // pivot's headers. Both sides must speak the same vocabulary, so the
        // totals take the SAME relabel the display rows took (objectui#4263) —
        // otherwise a dotted pivot's headers read `Education` while the
        // row-total lookup still asked for `education` and every total cell
        // silently fell back to `—`.
        return totalRows ? relabelDimensions(totalRows, dimensionLabels) : totalRows;
      };
      const rowTotalById = new Map<string, Row>();
      for (const r of findTotals(rowDims) ?? []) rowTotalById.set(pivotRowId(rowDims.map((d) => String(r[d] ?? '∅'))), r);
      const colTotalById = new Map<string, Row>();
      for (const r of findTotals([colDim]) ?? []) colTotalById.set(String(r[colDim] ?? '∅'), r);
      const grandTotal = findTotals([])?.[0];
      const showTotalCol = rowTotalById.size > 0;
      const showTotalRow = colTotalById.size > 0;
      const totalLabel = tt('dashboard.total', 'Total');
      return (
        <div className="relative h-full w-full overflow-auto p-1" data-testid="dataset-matrix">{exportBtn}
          <table className="w-full text-xs">
            {compareCaption}
            <thead className="bg-muted/40">
              <tr>
                {rowDims.map((d) => (
                  <th key={d} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{headerLabel(d)}</th>
                ))}
                {cellCols.map((cc) => (
                  <th key={`${cc.col.id}-${cc.measure}`} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{cc.header}</th>
                ))}
                {showTotalCol && values.map((m) => (
                  <th key={`total-${m}`} className="px-2 py-1.5 text-right font-medium whitespace-nowrap" data-testid="matrix-total-col-header">
                    {values.length === 1 ? totalLabel : `${totalLabel} · ${headerLabel(m)}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivot.rowHeaders.map((rh) => (
                <tr key={rh.id} className="border-t">
                  {rh.labels.map((lbl, di) => (
                    <td key={di} className="px-2 py-1 whitespace-nowrap font-medium">{lbl}</td>
                  ))}
                  {cellCols.map((cc) => {
                    const index = pivot.cellIndex.get(pivotCellKey(rh.id, cc.col.id));
                    const fr = index != null ? state.rows[index] : undefined;
                    const clickable = canDrill && index != null;
                    const title = [...rh.labels, cc.col.label].filter(Boolean).join(' / ');
                    return (
                      <td
                        key={`${cc.col.id}-${cc.measure}`}
                        className={cn('px-2 py-1 text-right tabular-nums whitespace-nowrap', clickable && 'cursor-pointer hover:bg-accent/40')}
                        data-testid={clickable ? 'dataset-drill-cell' : undefined}
                        onClick={clickable ? () => openDrill(index as number, title) : undefined}
                      >
                        {fr ? fmtMeasure(fr[cc.measure], cc.measure) : '—'}
                        {compareStack(fr, cc.measure)}
                      </td>
                    );
                  })}
                  {showTotalCol && values.map((m) => {
                    const rowTotal = rowTotalById.get(rh.id);
                    return (
                      <td key={`total-${m}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium" data-testid="matrix-row-total">
                        {fmtMeasure(rowTotal?.[m], m)}
                        {compareStack(rowTotal, m)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {showTotalRow && (
                <tr className="border-t bg-muted/30 font-medium" data-testid="matrix-total-row">
                  {rowDims.length > 0 && (
                    <td colSpan={rowDims.length} className="px-2 py-1 whitespace-nowrap">{totalLabel}</td>
                  )}
                  {cellCols.map((cc) => {
                    const colTotal = colTotalById.get(cc.col.id);
                    return (
                      <td key={`${cc.col.id}-${cc.measure}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                        {fmtMeasure(colTotal?.[cc.measure], cc.measure)}
                        {compareStack(colTotal, cc.measure)}
                      </td>
                    );
                  })}
                  {showTotalCol && values.map((m) => (
                    <td key={`grand-${m}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap" data-testid="matrix-grand-total">
                      {fmtMeasure(grandTotal?.[m], m)}
                      {compareStack(grandTotal, m)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
          {drillDrawer}
        </div>
      );
    }

    // table (and a 1-dimension pivot) → a flat grouped table.
    const columns = [...dimensions, ...measureColumns];
    return (
      <div className="relative h-full w-full overflow-auto p-1">{exportBtn}
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                  data-testid={compareOf(c) ? 'dataset-compare-column' : undefined}
                >
                  {columnLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={i}
                className={cn('border-t', canDrill && 'cursor-pointer hover:bg-accent/40')}
                data-testid={canDrill ? 'dataset-drill-row' : undefined}
                onClick={canDrill ? () => openDrill(i, drillDims.map((d) => formatDimensionValue(row[d])).filter(Boolean).join(' / ')) : undefined}
              >
                {columns.map((c) => {
                  // A comparison column formats as the measure it compares.
                  const measure = compareOf(c) ?? (values.includes(c) ? c : undefined);
                  return (
                    <td key={c} className="px-2 py-1 whitespace-nowrap tabular-nums">
                      {measure
                        ? formatMeasure(row[c], measureField(measure)?.format, measureField(measure)?.currency, measureField(measure)?.percentScale)
                        : formatDimensionValue(row[c])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {drillDrawer}
      </div>
    );
  }

  // Chart — route to the advanced renderer with the widget's TRUE chart family
  // and one series per measure. Series carry the measure display label so the
  // legend reads "Tasks" rather than "task_count".
  const chartType = CHART_TYPE_MAP[widgetType] ?? 'bar';
  // Resolve select/enum dimension values → display labels before charting, so a
  // value-keyed group (e.g. status=`active`) shows its label (`合作中`) on the
  // axis with its count intact (cloud#667). `chartRows` stays index-aligned with
  // `state.rows`/`drillRawRows`, so drill-through still maps to the raw value.
  const chartRows = relabelDimensions(state.rows, dimensionLabels);
  // ADR-0021 (#1759): shared helper — pivots a second dimension into grouped
  // series so multi-dimension dataset widgets match the chart-view renderer.
  const { data: chartData, xAxisKey, series } = buildChartSeries(chartRows, dimensions, values, state.fields);

  // Comparison overlay — one extra series per compared measure, carrying the
  // same `variant: 'comparison'` the inline chart's overlay uses (ObjectChart's
  // augmentedSeries), so AdvancedChartImpl draws it muted/dashed here too.
  // Skipped when buildChartSeries PIVOTED a second dimension into the series:
  // those series are dimension VALUES, not measures, so there is no per-measure
  // series a comparison could pair with (the `__compare` columns are still in
  // the rows — nothing is lost, it just isn't drawn as an overlay).
  const pivotedSeries = dimensions.length >= 2 && values.length === 1;
  const comparisonSeries = pivotedSeries
    ? []
    : comparedValues.map((m) => ({
        dataKey: compareColumn(m),
        label: `${headerLabel(m)} · ${compareLabel}`,
        variant: 'comparison' as const,
      }));
  const chartSeries = comparisonSeries.length > 0
    ? [...series.map((s) => ({ ...s, variant: (s as { variant?: string }).variant ?? 'current' })), ...comparisonSeries]
    : series;

  // Ordered-sequence charts (funnel/pyramid) need a DEFINED stage order.
  // `options.stageOrder` wins when the author states one explicitly; otherwise
  // the dimension field's declared picklist order does. Explicit values are
  // expanded with their display labels because `chartRows` may already be
  // relabeled — the same value-or-label keying `categoryColors` uses.
  const stageOrder = Array.isArray(options.stageOrder) ? options.stageOrder : undefined;
  const explicitOrder = stageOrder?.flatMap((v) => {
    const key = String(v);
    const label = dimensionLabels?.[dimensions[0]]?.[key];
    return label && label !== key ? [key, label] : [key];
  });
  const effectiveCategoryOrder = explicitOrder?.length ? explicitOrder : categoryOrder;

  // The widget's declared `chartConfig`, lowered onto the chart schema —
  // #3135 for `showLegend`, objectstack#7016 for the rest of the keys the chart
  // block measurably delivers. See `chartConfigPresentation` for the two
  // criteria a key has to meet and for why `xAxis`/`yAxis`/`series`/`type`/
  // `aria` are deliberately NOT here. It also owns the `colors` split, so the
  // per-category map it returns already carries the dimension field's own
  // option colours underneath any explicit author map.
  const chartPresentation = chartConfigPresentation(widget?.chartConfig, categoryColors);

  // Map a clicked chart segment back to its dataset row, then drill through to
  // the underlying records — same governed path the table/pivot rows use.
  const handleChartDrill = (ev: { category?: string; series?: string; value?: number }) => {
    const idx = findChartSeriesRow(chartRows, dimensions, values, ev?.category, ev?.series);
    if (idx < 0) return;
    // `series` is a real (second) dimension value only when pivoted; otherwise
    // it's the measure name — omit it from the drawer title.
    const pivoted = dimensions.length >= 2 && values.length === 1;
    const title = [ev?.category, pivoted ? ev?.series : undefined].filter(Boolean).map(String).join(' / ');
    openDrill(idx, title);
  };

  // The `chart` schema renders through either ChartRenderer (reads `onChartClick`)
  // or ObjectChart (reads `onSegmentClick` and suppresses its own object-drill) —
  // pass both so the segment click drills regardless of which is registered.
  const chartDrill = canDrill ? handleChartDrill : undefined;
  return (
    <div className={cn('relative h-full w-full min-h-[220px]')}>
      <SchemaRenderer
        // isAnimationActive: false — dashboard charts render at final geometry on
        // the FIRST committed frame. Recharts' entrance animation is a rAF tween
        // that starts at height 0 and, inside react-grid-layout's mount-time
        // measurement churn, can freeze there — bars never draw until an unrelated
        // re-render (#2756, follow-up to #2727's ineffective settle re-mount).
        // Turning the tween off makes the first paint deterministic.
        schema={{ type: 'chart', chartType, data: chartData, xAxisKey, series: chartSeries, isAnimationActive: false, ...chartPresentation, ...(effectiveCategoryOrder ? { categoryOrder: effectiveCategoryOrder } : {}) } as any}
        onChartClick={chartDrill}
        onSegmentClick={chartDrill}
      />
      {drillDrawer}
    </div>
  );
}
