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

import { useEffect, useMemo, useState } from 'react';
// `useDatasetDimensionMeta` is the analytics label net's SHARED React glue
// (objectui#4389): the locale-free metadata read this widget and the dataset
// report block both take, lifted out of the two longhand copies PR #4388 left
// behind. It lives in `@object-ui/react` because it reads the host context —
// see its file header for the measured dependency direction. This widget
// layers its CHART-ONLY colour/order derivation on top, below.
import { SchemaRenderer, useDatasetDimensionMeta } from '@object-ui/react';
import {
  buildChartSeries,
  buildOptionColorMap,
  buildCategoryOrder,
  relabelDimensions,
  localizeFieldOptions,
  deriveDimensionLabelMaps,
  dimensionOptionTranslator,
  findChartSeriesRow,
  formatMeasure,
  formatDimensionValue,
  buildDatasetFieldHelpers,
  buildDatasetDrillFilter,
  // The pivot key encoders now live in `@object-ui/core` so this widget and the
  // report renderer's cross-tab share ONE implementation — each having written
  // its own is why the same collision had to be fixed twice (objectstack#5473,
  // objectstack#5665). Imported under the shared name because BOTH of this
  // widget's axes now use it: the across axis used to spell its single-value id
  // as a bare string, which was a second encoding of the same kind of id and
  // carried the placeholder collision on its own (objectui#4056).
  pivotBucketId,
  pivotDimensionValue,
  pivotCellKey,
  compareToTrendLabelKey,
  // The authored half of the same split — moved to core beside `buildChartSeries`
  // so this widget and the report's embedded chart lower one vocabulary once
  // (objectui#4877). Re-exported below under their original names.
  chartConfigPresentation,
  mergeAuthoredPresentation,
  // The console's ONE client-side sort primitive (objectui#3096). The flat
  // dataset table below sorts through it rather than inlining `a < b`, so a
  // dashboard table and a list view order the same values identically — and
  // so the relational/blank/numeric cases it already settles are not decided a
  // second time here.
  getSortValue,
  compareSortValues,
  type ChartSegmentClickEvent,
  type CompareToConfig,
  type DatasetResultField,
  type DatasetDrillRange,
} from '@object-ui/core';
import { cn, Skeleton, ChartSkeleton, GridSkeleton } from '@object-ui/components';
import { useSafeFieldLabel, useSafeTranslate, useDisplayLocale } from '@object-ui/i18n';
import { BarChart3, AlertTriangle, Download, ArrowUpIcon, ArrowDownIcon, MinusIcon, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
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
 * and why an empty value encodes as JSON `null` rather than a placeholder
 * string (objectui#4056).
 *
 * Every consumer of a bucket id — the cell index below, the row-total lookup
 * AND the column-total lookup in the cross-tab renderer — must build its key
 * with these, over values normalized by `pivotDimensionValue`; a second,
 * hand-rolled encoding of the same id is what made the old bug invisible.
 *
 * `pivotRowId` is the historical name of the axis-neutral encoder, kept as an
 * alias so this package's published surface does not change.
 */
const pivotRowId = pivotBucketId;
export { pivotRowId, pivotCellKey };

/**
 * Pivot flat dataset rows into a cross-tab: `rowDims` go DOWN, `colDim` spreads
 * ACROSS. Returns ordered row/column headers (display labels from the rows) and
 * a map from a `pivotCellKey(rowId, colId)` cell key to the FLAT row index
 * holding that combination's measure values. No re-aggregation — the dataset
 * already grouped by every dimension, so each cell maps to exactly one row (the
 * index is also what drill-through uses to read `drillRawRows`).
 *
 * `locale` is the display-locale tag the header LABELS are formatted in
 * (objectui#4566) — this is a plain exported function, not a component, so it
 * cannot read `useDisplayLocale()` itself. It affects `rowHeaders`/`colHeaders`
 * only; the `id`s are opaque keys built by `pivotBucketId` from the RAW values
 * and are deliberately untouched by it, so a locale change can never re-key a
 * cell (which would break the `cellIndex` lookup and drill-through with it).
 */
export function buildPivot(
  rows: Array<Record<string, unknown>>,
  rowDims: string[],
  colDim: string,
  locale?: string,
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
    // from `labels`/`label` via formatDimensionValue. BOTH go through the shared
    // encoder, over values normalized by `pivotDimensionValue`. The column id
    // used to be the bare value on the reasoning that a single value needs no
    // boundary; that is true of the boundary and false of everything else the
    // encoder does, and it left the across axis on its own encoding — which then
    // carried the null-placeholder collision independently (objectui#4056). A
    // one-element tuple costs nothing and keeps one encoding for one kind of id.
    const rid = pivotBucketId(rowDims.map((d) => pivotDimensionValue(row[d])));
    const cid = pivotBucketId([pivotDimensionValue(row[colDim])]);
    if (!rowSeen.has(rid)) { rowSeen.add(rid); rowHeaders.push({ id: rid, labels: rowDims.map((d) => formatDimensionValue(row[d], locale)) }); }
    if (!colSeen.has(cid)) { colSeen.add(cid); colHeaders.push({ id: cid, label: formatDimensionValue(row[colDim], locale) }); }
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
 *
 * `combo` is NOT such a fallback: the renderer draws it distinctly (mixed
 * marks on a `ComposedChart`, a left and a right y-axis), and it is a
 * `ChartTypeSchema` member since spec 17.0.0-rc.1 — so it maps to ITSELF.
 * Until #4229 it had no entry at all and fell through the `?? 'bar'` default,
 * which is one of the two halves that made an authored combo render as grouped
 * bars; the other half is the presentation merge below. `widgetDispatch`
 * already resolves a `combo` widget to `chartType: 'combo'`
 * (`SERIES_CHART_TYPES`), so this entry makes the two surfaces agree.
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
  combo: 'combo',
};

/**
 * The authored chart CHROME and the series/axis presentation merge, both of
 * which now live in `@object-ui/core`'s `chart-presentation` beside
 * `buildChartSeries` — the derivation they are merged onto (objectui#4877).
 *
 * They were written here (#3135 → objectstack#7016 → #4229) and moved when the
 * report renderer's embedded chart turned out to need the SAME merge over the
 * same spec keys: `ReportChartSchema` and `ChartConfigSchema` declare one
 * vocabulary, and a second copy of the split beside this one is precisely the
 * duplication objectui#4389 filed as a defect. The doctrine — the two
 * admission criteria, the data/presentation ruling, why `aria` stays
 * unforwarded — travelled with the code; see that module's header.
 *
 * Re-exported under their original names so this module's public surface is
 * unchanged.
 */
export {
  chartConfigPresentation,
  mergeAuthoredPresentation,
  type AuthoredSeriesPresentation,
  type MergedChartSeries,
} from '@object-ui/core';

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
  const { fieldLabel, fieldOptionLabel } = useSafeFieldLabel();
  // The display locale every measure and dimension value below is formatted in
  // (objectui#4566). `formatMeasure` / `formatDimensionValue` are pure
  // functions in `@object-ui/core`, so the tag has to arrive as an argument —
  // this is the one place in this component allowed to read it. Nothing here
  // formats inside a `useMemo`, so unlike objectui#4542 / #4553 there is no
  // dependency array to add it to; the sites below are all in the render body
  // and re-run whenever the provider changes.
  const displayLocale = useDisplayLocale();

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
  // The object-schema probe's host-authenticated fetch (objectui#4121) is no
  // longer read here: it moved INTO `useDatasetDimensionMeta` along with the
  // rest of the read, so the property is stated once for both surfaces instead
  // of once per surface (objectui#4389). The hook consults the context the same
  // way this widget did — directly, not via a throwing `useSchemaContext()` —
  // so a widget rendered outside a host still degrades to the global fetch.
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
  // ── The flat table's client-side sort (objectui#5827) ────────────────────
  // `null` = the dataset's own order. Declared up here with the other hooks
  // because the table branch sits AFTER this component's early returns, where a
  // `useState` would be conditional.
  //
  // Client-side is the design, not a shortcut: this widget issues ONE
  // `queryDataset` call and paginates nothing, so the rows on screen ARE the
  // whole result set and reordering them needs no round trip. `options.limit`
  // does truncate that set server-side — a sort then orders exactly the set the
  // unsorted table was already showing, never a different slice of the data.
  const [tableSort, setTableSort] = useState<{ column: string; dir: 'asc' | 'desc' } | null>(null);
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

  // ── The analytics label net's INPUT: resolved field metadata, locale-free ──
  // ONE object-schema read per dataset query, yielding `{ object, field,
  // options }` per dimension field path. Everything this widget DISPLAYS
  // (per-category colours, {value → label} maps, the declared category order)
  // is derived from it during render, one memo down, because that derivation is
  // where the locale bundle applies (objectui#4030): keeping the fetched
  // metadata locale-free means switching language re-renders the labels instead
  // of re-fetching the schema.
  //
  // The read itself — the host-authenticated `apiFetch` channel (objectui#4121),
  // the locale-free state, the effect deps, the best-effort failure shape — now
  // lives ONCE in `@object-ui/react`'s `useDatasetDimensionMeta`, shared with
  // the dataset report block (objectui#4389). It was written out here and again
  // in plugin-report by PR #4388; both copies stated the same two bug fixes, and
  // that is precisely the drift #4389 was filed to close. What stays local is
  // the part that is genuinely this widget's: WHICH dimensions to resolve, and
  // the chart-only colour/order derivation in the memo below.
  //
  // The METRIC branch renders ONE measure value plus that measure's header
  // label — a dimension's value never reaches its output in any spelling — so
  // there is nothing on that path to relabel and resolving would be a metadata
  // read nothing consumes (objectui#4263, pinned via `enabled`).
  //
  // Which dimensions resolve (objectui#4263 → #4330): EVERY dimension, on every
  // non-metric widget type — one rule, no per-widget-type dialect. #4263 ruled a
  // narrower one: on table/pivot the SERVER resolves a LOCAL dimension's display
  // label (ADR-0021), so this client net stayed off there and opened only for
  // DOTTED paths, where the server is silent too. That boundary was ruled for
  // LABEL RESOLUTION — "the label already exists, don't produce it twice" — and
  // it held exactly as long as resolution was the only thing downstream of the
  // read. objectui#4030 / PR #4324 put a second consumer there: the locale
  // bundle, which needs the option LIST, not the label. So a local select on a
  // table had its label resolved by the server, in English, with nothing on the
  // client to translate it against — the cells read `Domestic` beside a related
  // list reading 国内 (objectui#4330). The read is what closes that, and the PM
  // amended the #4263 boundary deliberately for it.
  //
  // It is not a second resolution: `buildDimensionLabelMap` carries BOTH the
  // stored value and the AUTHORED label as keys, and `relabelDimensions` is
  // value-wise and idempotent — a server-resolved `Domestic` maps to 国内 once,
  // and under `en` (or with no bundle entry) the display equals the authored
  // label, so no key is emitted and the rows pass through by identity.
  //
  // WHY THE READ IS NOT GATED ON "the dimension is a select" (measured, see the
  // amended pins): select-ness is not observable before the read.
  // `DatasetDimension.type` is `string|number|date|boolean|lookup` — the spec
  // has no `select` member — and every select dimension in the live example apps
  // declares `type: 'string'`; on the wire, `AnalyticsResult.fields[]` types a
  // select column `'string'` too (the analytics cube registry's
  // `fieldTypeToDimensionType` default). The select gate therefore lands on the
  // read's OUTPUT, where it is exact: `resolveDimensionFieldMeta` yields an entry
  // only for a terminal field that actually carries `options`, so a text /
  // number / date / lookup dimension produces no map and no relabel.
  const dimensionMeta = useDatasetDimensionMeta(
    state.object,
    state.dimensionFields,
    dimensions,
    { enabled: !isMetric },
  );

  // ── The analytics label net's OUTPUT, with the locale bundle applied ──────
  // objectui#4030 (source thread objectstack#5076): the net above RESOLVES a
  // select dimension's option label but used to hand the object's authored
  // English label straight to the axis, the legend, the table cells and the
  // CSV — the same screen's related list showing the translation beside it.
  // The bundle is applied HERE, once, on the shared `{value → label}` /
  // localized-options pair every one of those consumers reads, rather than per
  // surface. `fieldOptionLabel` is the resolver list and form surfaces already
  // use (`fieldOptions.<object>.<field>.<value>`), reached through the
  // provider-safe wrapper so a widget rendered without an I18nProvider keeps
  // its authored labels instead of crashing.
  //
  // `deriveDimensionLabelMaps` is core's — the same derivation the dataset
  // report block runs, stated once (objectui#4389). Per-category COLOURS and
  // the declared category ORDER are NOT: they key the palette and the axis
  // sequence, neither of which a table or pivot renders, so they stay null on
  // that path exactly as they did when it returned early (objectui#4263).
  // #4330 widened only WHICH DIMENSIONS get a label map, never what a table
  // consumes — hence the `isTable` gate on `firstDimPath` and nothing else.
  const { categoryColors, dimensionLabels, categoryOrder } = useMemo(() => {
    if (!dimensionMeta) return { categoryColors: null, dimensionLabels: null, categoryOrder: null };
    const { metaByPath, relabel } = dimensionMeta;
    // Colours and declared order read `option.label`, so they are fed the
    // LOCALIZED options — the same "translate the options, then render them"
    // shape the list side uses (`translateOptions` → `SelectCellRenderer`).
    // That keeps them keyed by the string the relabeled rows actually carry.
    // `relabel[0]` is the first dimension: `relabel` is built from the same
    // already-`Boolean`-filtered `dimensions` array this widget passes in, in
    // order, so `relabel[0].path` is `fieldOf(dimensions[0])`.
    const firstDimPath = isTable ? undefined : relabel[0]?.path;
    const firstDimMeta = firstDimPath ? metaByPath[firstDimPath] : undefined;
    const firstDimOptions = firstDimPath
      ? localizeFieldOptions(firstDimMeta?.options, dimensionOptionTranslator(firstDimMeta, fieldOptionLabel))
      : undefined;
    return {
      categoryColors: buildOptionColorMap(firstDimOptions),
      dimensionLabels: deriveDimensionLabelMaps(metaByPath, relabel, fieldOptionLabel),
      categoryOrder: buildCategoryOrder(firstDimOptions),
    };
  }, [dimensionMeta, fieldOptionLabel, isTable]);

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
        <span className={cn('text-2xl font-semibold tabular-nums', accentClass)}>{formatMeasure(value, f?.format, f?.currency, f?.percentScale, displayLocale)}</span>
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
    // ── The display rows (objectui#4263, widened by #4330) ──────────────────
    // The table/pivot branch renders `state.rows` as they arrived unless a
    // dimension resolved a label map. `dimensionLabels` covers EVERY dimension
    // whose terminal field carries `options` — dotted (the server resolved
    // nothing) and local (the server resolved the AUTHORED label, which under
    // a non-default locale is the wrong one, objectui#4330). A dimension whose
    // field carries no options gets no entry, so a text/number/date/lookup
    // table still gets `state.rows` ITSELF back — same array identity, same
    // rendered bytes. The map is value-AND-authored-label keyed and
    // `relabelDimensions` is idempotent, so neither spelling double-resolves.
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
    // `rows` is a parameter because the flat table now renders its rows in an
    // order of its own (objectui#5827 — blank bucket last, plus whatever the
    // user sorted by), and "the CSV follows the table" has to mean the order
    // too, not just the cell text. The cross-tab passes `displayRows`, which is
    // what this always exported.
    const exportCsv = (rows: Row[]) => downloadCsv(String(widget?.title ?? datasetName ?? 'export'), [
      exportColumns.map((c) => columnLabel(c)),
      // The CSV follows the table's own cells (objectui#4263): a dotted
      // dimension exports the label the table now shows, and a local one is
      // unchanged for the same reason its cell is.
      // …and #4330 widens that to a LOCAL select dimension for the same
      // reason: the CSV is the table's data, so it exports the cell. Measures
      // stay numeric (the raw values that must round-trip into a spreadsheet);
      // the drill filter — the identity key — reads `drillRawRows`, untouched.
      ...rows.map((r) => exportColumns.map((c) => {
        const v = r[c];
        return v == null ? '' : (typeof v === 'number' ? v : String(v));
      })),
    ]);
    const exportBtnFor = (rows: Row[]) => (
      <button
        type="button"
        onClick={() => exportCsv(rows)}
        data-testid="dataset-export"
        title={tt('dashboard.exportCsv', 'Export CSV')}
        aria-label={tt('dashboard.exportCsv', 'Export CSV')}
        className="absolute right-1 top-1 z-10 rounded p-1 text-muted-foreground opacity-70 hover:bg-accent/50 hover:text-foreground hover:opacity-100"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    );
    const exportBtn = exportBtnFor(displayRows);

    // pivot → a true cross-tab when there are ≥2 dimensions: the LAST dimension
    // spreads ACROSS as columns, the rest go DOWN as rows, measures fill the
    // cells. The dataset already returns one row per dimension combination, so
    // cells just place those pre-aggregated values — no client re-aggregation
    // (an avg/min/max can't be recombined). With <2 dimensions a cross-tab is
    // meaningless, so it degrades to the flat grouped table.
    if (isMatrix) {
      const pivot = buildPivot(displayRows, rowDims, colDim, displayLocale);
      // Single measure → one column per across-bucket; multiple → bucket × measure.
      const cellCols = pivot.colHeaders.flatMap((col) =>
        values.map((m) => ({ col, measure: m, header: values.length === 1 ? col.label : `${col.label} · ${headerLabel(m)}` })),
      );
      const fmtMeasure = (v: unknown, m: string) => formatMeasure(v, measureField(m)?.format, measureField(m)?.currency, measureField(m)?.percentScale, displayLocale);
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
      for (const r of findTotals(rowDims) ?? []) rowTotalById.set(pivotBucketId(rowDims.map((d) => pivotDimensionValue(r[d]))), r);
      const colTotalById = new Map<string, Row>();
      for (const r of findTotals([colDim]) ?? []) colTotalById.set(pivotBucketId([pivotDimensionValue(r[colDim])]), r);
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

    // ── Which columns are NUMBERS (objectui#5827) ─────────────────────────
    // Right-alignment is a claim about the values, so it is decided from them.
    //
    // The column DESCRIPTOR cannot decide it, contrary to what the card
    // assumed: the executor stamps `type: 'number'` on every measure column it
    // appends (`service-analytics/src/dataset-executor.ts`) without looking at
    // the aggregate, so across measures the declared type is a constant and
    // discriminates nothing. Nor is `tabular-nums` evidence — this table
    // applies it to every cell, dimension cells included.
    //
    // What IS structural is which columns are MEASURES, and only a measure is a
    // candidate: a dimension is a grouping axis even when its bucket keys are
    // digits (a year, a quarter), and right-aligning those would render the
    // axis as if it were a quantity.
    //
    // Within the candidates the test is defensive — EVERY non-null value must
    // be a number. `formatMeasure` falls back to `String(v)` for a non-number,
    // which is exactly what a `min()`/`max()` over a text field yields; that
    // column renders words and stays left-aligned. An all-null column passes
    // vacuously and right-aligns its `—`s: that is the same column with no
    // rows, not a different kind of column.
    //
    // Resolved ONCE per column into a set, not per cell: the predicate scans
    // every row, so calling it from inside the row loop would make rendering
    // quadratic in the row count.
    const numericColumns = new Set(
      columns.filter(
        (c) =>
          (values.includes(c) || compareOf(c) !== undefined) &&
          displayRows.every((r) => r[c] == null || typeof r[c] === 'number'),
      ),
    );

    // ── Row order (objectui#5827) ─────────────────────────────────────────
    // Rows are DECORATED with their incoming index and reordered as decorated
    // pairs, never as bare rows. `openDrill(i)` indexes `drillRawRows` — the
    // server's parallel array of RAW bucket values — so the index has to keep
    // pointing at the row it arrived with. Sorting `displayRows` in place would
    // leave every drill filtering by some other row's bucket, silently: both
    // arrays keep the same length and every click still opens a drawer.
    const entries = displayRows.map((row, index) => ({ row, index }));
    // A sort survives only while its column does. After a re-query on edited
    // metadata the stored column may be gone; falling back to the default order
    // beats sorting every row by `undefined`.
    const activeSort = tableSort && columns.includes(tableSort.column) ? tableSort : null;
    const orderedEntries = activeSort
      ? entries
          // Resolve the key ONCE per row (decorate → sort → undecorate) — the
          // convention `sort-values.ts` documents, because `getSortValue` walks
          // the value and a comparator would repeat that walk O(n log n) times.
          .map((e) => ({ ...e, key: getSortValue(e.row[activeSort.column]) }))
          .sort((a, b) => {
            // Blanks last in BOTH directions. `compareSortValues` places them
            // last ascending and documents that callers negate for descending —
            // negation would float them to the top, so the blank arm is settled
            // BEFORE the direction is applied and never inside it. Since
            // objectui#5845 the descending arm is what a measure column's
            // FIRST click runs, so this is now the very first thing a user
            // exercises rather than the second.
            if (a.key === null && b.key === null) return 0;
            if (a.key === null) return 1;
            if (b.key === null) return -1;
            const cmp = compareSortValues(a.key, b.key);
            return activeSort.dir === 'asc' ? cmp : -cmp;
          })
      : // Default order = the order the dataset returned, with one exception:
        // the EMPTY-dimension bucket sinks below the named ones. It keeps its
        // `—` label — only its position moves. A bucket with no value sorting
        // FIRST reads to the viewer as a data bug. `Array#sort` is stable, so
        // every other pair compares 0 and the server's ordering survives whole.
        [...entries].sort((a, b) => {
          for (const d of dimensions) {
            const aBlank = getSortValue(a.row[d]) === null ? 1 : 0;
            const bBlank = getSortValue(b.row[d]) === null ? 1 : 0;
            if (aBlank !== bBlank) return aBlank - bBlank;
          }
          return 0;
        });

    // ── First-click direction (objectui#5845) ───────────────────────────
    // A numeric MEASURE starts DESCENDING; everything else starts ascending.
    // The question a click asks of a measure is "who is biggest" — the very
    // complaint objectui#5827 opened on (Technology, the largest industry,
    // rendering last) — and one click answering it is what every analytics
    // table does. A dimension is a grouping axis, where A→Z is the idiom the
    // console's DataTable uses and this table keeps.
    //
    // The predicate is `numericColumns`, the SAME set that decides
    // right-alignment: first-click direction is a property of the column's
    // ROLE (a measure whose values really are numbers), not of "it looks like
    // digits". So a digit-keyed dimension (a year, a quarter) still starts
    // ascending, and so does a `min()`/`max()` over a text field.
    const firstDir = (c: string): 'asc' | 'desc' => (numericColumns.has(c) ? 'desc' : 'asc');
    // <first> → <the other one> → back to the default order. Three states, not
    // the two a server-paged grid offers: here the default IS a meaningful
    // order (the dataset's own, which an author can set via `options.sortBy`),
    // so a header has to be able to hand it back. The middle step is written
    // as "whatever `firstDir` is not" rather than as the literal `'desc'`,
    // because hard-coding it would send a measure column desc → desc and cost
    // it the ascending state entirely.
    const cycleSort = (c: string) =>
      setTableSort((prev) => {
        const first = firstDir(c);
        if (prev?.column !== c) return { column: c, dir: first };
        return prev.dir === first
          ? { column: c, dir: first === 'asc' ? 'desc' : 'asc' }
          : null;
      });
    // The console's own indicator (`components/…/data-table.tsx`): an idle
    // column shows nothing until the header is hovered, the sorted one shows a
    // primary-tinted arrow. `aria-hidden` because the `th`'s `aria-sort` is
    // what carries the state to assistive tech.
    const sortIcon = (c: string) => {
      if (activeSort?.column !== c) {
        return <ChevronsUpDown className="ml-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" aria-hidden="true" />;
      }
      const Arrow = activeSort.dir === 'asc' ? ChevronUp : ChevronDown;
      return <Arrow className="ml-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden="true" />;
    };

    return (
      <div className="relative h-full w-full overflow-auto p-1">{exportBtnFor(orderedEntries.map((e) => e.row))}
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((c) => {
                const numeric = numericColumns.has(c);
                return (
                  <th
                    key={c}
                    scope="col"
                    aria-sort={activeSort?.column === c ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn('group px-2 py-1.5 font-medium whitespace-nowrap', numeric ? 'text-right' : 'text-left')}
                    data-testid={compareOf(c) ? 'dataset-compare-column' : undefined}
                  >
                    {/* A real button, not a click handler on the `th`: the sort
                        has to be reachable from the keyboard and needs an
                        accessible name. It is visually the header text, so the
                        console's header layout is unchanged. */}
                    <button
                      type="button"
                      onClick={() => cycleSort(c)}
                      data-testid="dataset-table-sort"
                      className={cn(
                        'inline-flex w-full select-none items-center font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        numeric ? 'justify-end' : 'justify-between',
                      )}
                    >
                      <span className="truncate">{columnLabel(c)}</span>
                      {sortIcon(c)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {orderedEntries.map(({ row, index }) => (
              <tr
                key={index}
                // Hover feedback on EVERY row, not only a drillable one — the
                // cue that says "this row is a unit" is what the card is about,
                // and a table nobody can drill needs it just as much. A
                // drillable row keeps its stronger accent fill: `cn` runs
                // tailwind-merge, so the later `hover:bg-accent/40` replaces
                // `hover:bg-muted/40` rather than stacking with it.
                className={cn('border-t transition-colors hover:bg-muted/40', canDrill && 'cursor-pointer hover:bg-accent/40')}
                data-testid={canDrill ? 'dataset-drill-row' : undefined}
                onClick={canDrill ? () => openDrill(index, drillDims.map((d) => formatDimensionValue(row[d], displayLocale)).filter(Boolean).join(' / ')) : undefined}
              >
                {columns.map((c) => {
                  // A comparison column formats as the measure it compares.
                  const measure = compareOf(c) ?? (values.includes(c) ? c : undefined);
                  return (
                    <td key={c} className={cn('px-2 py-1 whitespace-nowrap tabular-nums', numericColumns.has(c) && 'text-right')}>
                      {measure
                        ? formatMeasure(row[c], measureField(measure)?.format, measureField(measure)?.currency, measureField(measure)?.percentScale, displayLocale)
                        : formatDimensionValue(row[c], displayLocale)}
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
  // objectui#4500 — the null-category bucket's LABEL. `@object-ui/core` is
  // React-free and cannot read the locale bundle, so it falls back to the
  // English `NULL_CATEGORY_LABEL`; the resolved label has to come from here
  // (the same division ObjectChart uses — core takes the string, the renderer
  // holds the provider). ONE binding on purpose: `buildChartSeries` writes it
  // into the rendered rows and `findChartSeriesRow` matches a clicked category
  // against it, so the two drifting apart costs the bucket bar its drill —
  // a visible bar that silently no-ops (#4498's dead-click rule).
  const nullCategoryLabel = tt('chart.nullCategory', '(None)');
  // ADR-0021 (#1759): shared helper — pivots a second dimension into grouped
  // series so multi-dimension dataset widgets match the chart-view renderer.
  const { data: chartData, xAxisKey, series } = buildChartSeries(chartRows, dimensions, values, state.fields, { nullCategoryLabel });

  // The author's PRESENTATION, merged onto those derived bindings — per-series
  // mark and axis binding, plus the axis definitions (#4229). Membership stays
  // with the dataset; see `mergeAuthoredPresentation` for the ruled split.
  const { series: presentedSeries, axes: authoredAxes } = mergeAuthoredPresentation(series, widget?.chartConfig);

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
    : comparedValues.map((m) => {
        // An overlay is the SAME measure one period back, so it takes its
        // primary's mark and axis — read off the already-merged series, never
        // re-read from `chartConfig` (one merge path). Without this a combo's
        // overlay fell to the renderer's positional guess and drew a bar
        // measure as a line on the opposite axis. `stack` is deliberately NOT
        // inherited: stacking an overlay onto its own primary would add the
        // two periods together.
        const primary = presentedSeries.find((s) => s.dataKey === m);
        return {
          dataKey: compareColumn(m),
          label: `${headerLabel(m)} · ${compareLabel}`,
          variant: 'comparison' as const,
          ...(primary?.chartType ? { chartType: primary.chartType } : {}),
          ...(primary?.yAxis ? { yAxis: primary.yAxis } : {}),
        };
      });
  const chartSeries = comparisonSeries.length > 0
    ? [...presentedSeries.map((s) => ({ ...s, variant: s.variant ?? 'current' })), ...comparisonSeries]
    : presentedSeries;

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
  // criteria a key has to meet, for why `type`/`aria` are deliberately NOT
  // here, and for where `xAxis`/`yAxis`/`series` go instead (#4229). It also
  // owns the `colors` split, so the per-category map it returns already carries
  // the dimension field's own option colours underneath any explicit author map.
  const chartPresentation = chartConfigPresentation(widget?.chartConfig, categoryColors);

  // Map a clicked chart segment back to its dataset row, then drill through to
  // the underlying records — same governed path the table/pivot rows use.
  const handleChartDrill = (ev: ChartSegmentClickEvent) => {
    // `categoryId` is the clicked bucket's IDENTITY (objectui#4508) and is
    // forwarded whenever the renderer could read one: it is what separates two
    // bars painting the same axis text — a stored `'(None)'` beside the null
    // bucket — so each drills to the rows its own bar was drawn from. Absent,
    // the category text identified the bucket on its own and the lookup says so.
    const idx = findChartSeriesRow(chartRows, dimensions, values, ev?.category, ev?.series, {
      nullCategoryLabel,
      bucketId: ev?.categoryId,
    });
    if (idx < 0) return;
    // `series` is a real (second) dimension value only when pivoted; otherwise
    // it's the measure name — omit it from the drawer title.
    //
    // The title reads the LABEL, not the key (objectui#4682). `ev.series` is a
    // renderer `dataKey`, and the lookup above is the only thing that should
    // consult it: for every ordinary group the key IS the label, but a group
    // whose label cannot name it keys by its `chartBucketId` instead
    // (objectui#4508's collision on the series axis, reachable since
    // objectui#4673), and the drawer then announced `Backlog / [null]` over a
    // segment the user saw labelled `(None)` — the right records under a title
    // that reads as broken data. `seriesLabel` is absent wherever the renderer
    // knew no label, so every other chart's title is byte-identical.
    const pivoted = dimensions.length >= 2 && values.length === 1;
    const seriesTitle = ev?.seriesLabel ?? ev?.series;
    const title = [ev?.category, pivoted ? seriesTitle : undefined].filter(Boolean).map(String).join(' / ');
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
        schema={{ type: 'chart', chartType, data: chartData, xAxisKey, series: chartSeries, isAnimationActive: false, ...chartPresentation, ...authoredAxes, ...(effectiveCategoryOrder ? { categoryOrder: effectiveCategoryOrder } : {}) } as any}
        onChartClick={chartDrill}
        onSegmentClick={chartDrill}
      />
      {drillDrawer}
    </div>
  );
}
