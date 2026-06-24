// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasetReportRenderer
 *
 * Renders a spec `Report` that binds to a semantic-layer `dataset` (ADR-0021
 * single-form) instead of an inline `objectName` + `columns` query. The report
 * selects dimensions (`rows`, and for matrix also `columns`) and measures
 * (`values`) BY NAME and runs them through `dataSource.queryDataset` — the
 * same governed path dataset-bound dashboard widgets and the dataset preview
 * use, so the numbers (and the server-resolved dimension display labels)
 * match everywhere.
 *
 * - `summary` / `tabular` → one grouped table (`rows` + `values`).
 * - `matrix` → a true cross-tab (ADR-0021 D2): `rows` down × `columns`
 *   across, measures in the cells. One dataset query over all dimensions,
 *   pivoted client-side. Totals (per-row subtotals, per-column subtotals,
 *   grand total) are SERVER-supplied: the selection asks for
 *   `totals: { groupings: [rows, columns, []] }` and the renderer only
 *   places the returned pre-aggregated rows. It never re-aggregates bucketed
 *   values client-side — measures like `avg` cannot be recombined without
 *   drifting from the semantic layer (the ADR-0021 governance red line) —
 *   so an older server that returns no `totals` renders the plain cross-tab
 *   with no totals row/column. A matrix without `columns` degrades to the
 *   flat grouped table.
 * - `joined` → a vertical stack of blocks, each its own dataset-bound table,
 *   with the report-level `runtimeFilter` merged into every block.
 *
 * Headers and measure cells mirror the dashboard `DatasetWidget` (PR #1825):
 * column headers use the dataset's server-supplied display `label` (run
 * through the i18n field-label convention), and measure values format with
 * the field's declared `currency` (`Intl` symbol) + numeral `format`, never
 * the raw field name or a misleading "$".
 *
 * Drill-down (ADR-0021 D2): when the report's `drilldown` flag is not `false`
 * and the host supplies `onDrill`, every aggregated row / matrix cell is
 * clickable and emits `{ dataset, groupKey, runtimeFilter }`. The HOST owns
 * navigation — it resolves the dataset's `object` and dimension→field mapping
 * (this renderer only knows dimension NAMES) and routes to the underlying
 * records.
 */

import * as React from 'react';
import { Loader2, AlertTriangle, Table2 } from 'lucide-react';
import {
  ComponentRegistry,
  formatMeasure,
  formatDimensionValue,
  buildDatasetFieldHelpers,
  buildDatasetDrillFilter,
  type DatasetResultField,
} from '@object-ui/core';
import { useSafeFieldLabel, useSafeTranslate } from '@object-ui/i18n';
import { mergeFilters } from './mergeFilters';

type Row = Record<string, unknown>;

/** One server-computed totals grouping: `dimensions: []` is the grand total. */
interface DatasetTotals {
  dimensions: string[];
  rows: Row[];
}

interface DatasetCapableSource {
  queryDataset?: (
    dataset: string,
    selection: unknown,
  ) => Promise<{
    rows: Row[];
    fields?: DatasetResultField[];
    object?: string;
    dimensionFields?: Record<string, string>;
    drillRawRows?: Row[];
    totals?: DatasetTotals[];
  }>;
}

/** What a drill click means — the host resolves names to a navigation target. */
export interface DatasetDrillArgs {
  /** Dataset the clicked aggregate was computed over. */
  dataset: string;
  /** Dimension NAME → clicked bucket value (row dims, plus across dims for a matrix cell). */
  groupKey: Record<string, unknown>;
  /** The effective render-time scope filter, if any. */
  runtimeFilter?: Record<string, unknown>;
  /** The dataset's base object (records to drill into), when the server supplied it. */
  object?: string;
  /**
   * Exact record-list filter (object FIELD name → RAW stored value) for the
   * clicked bucket, ANDed with `runtimeFilter`. Present only when the server
   * returned the dimension→field mapping + raw grouped values, so the host can
   * filter precisely — including select/lookup dims a display-label `groupKey`
   * would mis-filter — without re-fetching the dataset definition.
   */
  objectFilter?: Record<string, unknown>;
}

/** A report (or joined block) bound to a dataset. Field access is permissive — */
/** the bundled spec types lag the runtime schema across the repo boundary.     */
interface DatasetReportLike {
  name?: string;
  type?: string;
  dataset?: string;
  rows?: string[];
  /** Dimension names across — matrix pivots `rows` × `columns` (ADR-0021 D2). */
  columns?: string[];
  values?: string[];
  runtimeFilter?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  /** Click-through to underlying records (default true). */
  drilldown?: boolean;
  /** Embedded chart visualization (ADR-0021): type + xAxis/yAxis over the dataset. */
  chart?: Record<string, unknown>;
  label?: unknown;
  description?: unknown;
  blocks?: DatasetReportLike[];
}

export interface DatasetReportRendererProps {
  report: DatasetReportLike;
  dataSource?: unknown;
  /** Filter merged into the report (and every joined block) as `runtimeFilter`. */
  runtimeFilter?: Record<string, unknown>;
  /**
   * Drill-down sink. Rows/cells become clickable when provided (and the
   * report doesn't set `drilldown: false`).
   */
  onDrill?: (args: DatasetDrillArgs) => void;
  className?: string;
}

/** `true` when this report should render through the dataset path. */
export function isDatasetReport(value: unknown): value is DatasetReportLike {
  if (!value || typeof value !== 'object') return false;
  const v = value as DatasetReportLike;
  if (typeof v.dataset === 'string' && v.dataset.length > 0) return true;
  // A joined report whose blocks are dataset-bound.
  return v.type === 'joined' && Array.isArray(v.blocks) && v.blocks.some((b) => typeof b?.dataset === 'string');
}

function resolveText(label: unknown, fallback: string): string {
  if (!label) return fallback;
  if (typeof label === 'string') return label;
  if (typeof label === 'object' && typeof (label as { default?: unknown }).default === 'string') {
    return (label as { default: string }).default;
  }
  return fallback;
}

function readNames(value: unknown): string[] {
  return Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string' && !!v) : [];
}

/** Shared fetch for one dataset selection. */
function useDatasetRows(
  dataset: string,
  dimensions: string[],
  measures: string[],
  runtimeFilter: Record<string, unknown> | undefined,
  dataSource: unknown,
  totalsGroupings?: string[][],
) {
  const [state, setState] = React.useState<{
    status: 'idle' | 'loading' | 'ok' | 'error';
    rows: Row[];
    fields?: DatasetResultField[];
    object?: string;
    dimensionFields?: Record<string, string>;
    drillRawRows?: Row[];
    totals?: DatasetTotals[];
    error?: string;
  }>({
    status: 'idle',
    rows: [],
  });

  const rfKey = JSON.stringify(runtimeFilter ?? null);
  const totalsKey = JSON.stringify(totalsGroupings ?? null);
  const signature = `${dataset}|${dimensions.join(',')}|${measures.join(',')}|${rfKey}|${totalsKey}`;
  React.useEffect(() => {
    const src = dataSource as DatasetCapableSource | undefined;
    if (!src || typeof src.queryDataset !== 'function') {
      setState({ status: 'error', rows: [], error: 'This data source does not support dataset queries.' });
      return;
    }
    if (!dataset || measures.length === 0) {
      setState({ status: 'idle', rows: [] });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', rows: [] });
    src
      .queryDataset(dataset, {
        dimensions,
        measures,
        ...(runtimeFilter && Object.keys(runtimeFilter).length > 0 ? { runtimeFilter } : {}),
        ...(totalsGroupings ? { totals: { groupings: totalsGroupings } } : {}),
      })
      .then((res) => {
        if (!cancelled) {
          setState({
            status: 'ok',
            rows: Array.isArray(res?.rows) ? res.rows : [],
            fields: Array.isArray(res?.fields) ? res.fields : [],
            object: res?.object,
            dimensionFields: res?.dimensionFields,
            drillRawRows: Array.isArray(res?.drillRawRows) ? res.drillRawRows : undefined,
            totals: Array.isArray(res?.totals) ? res.totals : undefined,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return state;
}

function EmptyMeasures({ dataset }: { dataset: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
      This report binds the “{dataset}” dataset — choose at least one measure (values) to render.
    </div>
  );
}

function FetchStates({ status, error }: { status: 'idle' | 'loading' | 'error'; error?: string }) {
  if (status === 'error') {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="break-words">{error}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Running report…
    </div>
  );
}

function NoRows() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 p-6 text-xs text-muted-foreground">
      <Table2 className="h-6 w-6" /> The dataset returned no rows for this report’s scope.
    </div>
  );
}

const DRILL_CLASS = 'cursor-pointer hover:bg-accent/40';

/** One dataset-bound table: fetch via `queryDataset`, render `rows` + `values`. */
function DatasetReportTable({
  dataset,
  rows,
  values,
  runtimeFilter,
  dataSource,
  onDrill,
}: {
  dataset: string;
  rows: string[];
  values: string[];
  runtimeFilter?: Record<string, unknown>;
  dataSource?: unknown;
  onDrill?: (args: DatasetDrillArgs) => void;
}) {
  const state = useDatasetRows(dataset, rows, values, runtimeFilter, dataSource);
  const { fieldLabel } = useSafeFieldLabel();

  if (values.length === 0) return <EmptyMeasures dataset={dataset} />;
  if (state.status === 'loading' || state.status === 'idle') return <FetchStates status={state.status} />;
  if (state.status === 'error') return <FetchStates status="error" error={state.error} />;
  if (state.rows.length === 0) return <NoRows />;

  // Drilling needs at least one dimension to scope by.
  const canDrill = !!onDrill && rows.length > 0;
  // Dims the server can map to object fields → raw-value (drill-correct) filter.
  const drillDims = state.dimensionFields ? rows.filter((d) => d in state.dimensionFields!) : [];
  const drill = (row: Row, index: number) => {
    const groupKey: Record<string, unknown> = {};
    for (const dim of rows) groupKey[dim] = row[dim];
    // ADR-0021 D2: when the server returned the object + raw grouped values,
    // emit an exact field→raw filter (correct for select/lookup dims, which a
    // display-label groupKey would mis-filter); the host then filters with no
    // extra metadata round-trip. Older server → groupKey-only fallback.
    const objectFilter =
      state.object && state.dimensionFields && drillDims.length > 0
        ? buildDatasetDrillFilter(state.drillRawRows?.[index], drillDims, state.dimensionFields, runtimeFilter)
        : undefined;
    onDrill!({ dataset, groupKey, runtimeFilter, object: state.object, objectFilter });
  };

  const { measureField, headerLabel } = buildDatasetFieldHelpers(state.fields, state.object, fieldLabel);
  const columns = [...rows, ...values];
  return (
    <div className="overflow-auto max-h-[70vh] rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                {headerLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t${canDrill ? ` ${DRILL_CLASS}` : ''}`}
              data-testid={canDrill ? 'dataset-drill-row' : undefined}
              onClick={canDrill ? () => drill(row, i) : undefined}
            >
              {columns.map((c) => (
                <td key={c} className="px-2 py-1 tabular-nums whitespace-nowrap">
                  {values.includes(c)
                    ? formatMeasure(row[c], measureField(c)?.format, measureField(c)?.currency)
                    : formatDimensionValue(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Report chart type → the generic chart component's `chartType`. Families that
 * aren't a cartesian/categorical series (gauge / kpi / metric / funnel /
 * treemap / sankey / bullet / table / pivot) fall back to a bar so the
 * visualization still renders; the grouped table beneath always carries the
 * exact numbers, so the fallback never hides data.
 */
function mapReportChartType(t: unknown): string {
  switch (t) {
    case 'line':
      return 'line';
    case 'area':
      return 'area';
    case 'pie':
      return 'pie';
    case 'donut':
      return 'donut';
    case 'radar':
      return 'radar';
    case 'scatter':
      return 'scatter';
    case 'bar':
    case 'column':
    case 'horizontal-bar':
    default:
      return 'bar';
  }
}

/**
 * Resolve a registered component by type, triggering its LAZY loader and
 * re-rendering once it registers. The generic `chart` component is registered
 * via `registerLazy`, so a plain `ComponentRegistry.get` returns undefined
 * until the plugin-charts chunk loads — this hook kicks off `loadLazy` and
 * subscribes so the chart appears as soon as the chunk resolves. Kept decoupled
 * (no static import of plugin-charts / @object-ui/react) so plugin-report stays
 * dependency-light and its test module graph doesn't duplicate React.
 */
function useRegistryComponent(
  type: string,
): React.ComponentType<{ schema: Record<string, unknown> }> | undefined {
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (ComponentRegistry.get(type)) return;
    const unsub =
      typeof ComponentRegistry.subscribe === 'function'
        ? ComponentRegistry.subscribe(() => {
            if (ComponentRegistry.get(type)) bump();
          })
        : undefined;
    const pending = ComponentRegistry.loadLazy?.(type);
    if (pending && typeof pending.then === 'function') {
      pending.then(() => bump()).catch(() => {});
    }
    return unsub;
  }, [type]);
  return ComponentRegistry.get(type) as
    | React.ComponentType<{ schema: Record<string, unknown> }>
    | undefined;
}

/**
 * Render a report's embedded `chart` (ADR-0021) by running its OWN dataset
 * query — the `xAxis` dimension grouped, the `yAxis` measure aggregated — and
 * feeding the rows to the registered generic chart component (plugin-charts).
 *
 * Decoupled via {@link ComponentRegistry} (same approach as the legacy
 * renderer) so plugin-report keeps no hard dependency on plugin-charts: if the
 * chart plugin isn't loaded, or the chart is incomplete, we render nothing and
 * let the grouped table stand alone. Before this, a dataset-bound report's
 * `chart` config was authorable in Studio but never rendered anywhere.
 */
function DatasetReportChart({
  dataset,
  chart,
  runtimeFilter,
  dataSource,
}: {
  dataset: string;
  chart: Record<string, unknown>;
  runtimeFilter?: Record<string, unknown>;
  dataSource?: unknown;
}) {
  const xAxis = typeof chart.xAxis === 'string' ? chart.xAxis : '';
  const yAxis = typeof chart.yAxis === 'string' ? chart.yAxis : '';
  const state = useDatasetRows(
    dataset,
    xAxis ? [xAxis] : [],
    yAxis ? [yAxis] : [],
    runtimeFilter,
    dataSource,
  );
  const ChartComponent = useRegistryComponent('chart');

  // A chart needs both an x (dimension) and y (measure); without them, skip.
  if (!xAxis || !yAxis) return null;
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading chart…
      </div>
    );
  }
  // On error or empty, fall back silently to the table beneath.
  if (state.status === 'error' || state.rows.length === 0) return null;
  // The chart component is registered lazily; until it resolves render nothing
  // (the grouped table beneath still shows the exact numbers).
  if (!ChartComponent) return null;

  const title = typeof chart.title === 'string' ? chart.title : undefined;
  return (
    <div className="rounded-md border bg-card p-3" data-testid="dataset-report-chart">
      {title ? <h3 className="mb-2 text-sm font-semibold">{title}</h3> : null}
      <ChartComponent
        schema={{
          chartType: mapReportChartType(chart.type),
          data: state.rows,
          xAxisKey: xAxis,
          series: [{ dataKey: yAxis }],
          height: typeof chart.height === 'number' ? chart.height : 280,
          // Render deterministically (no rAF entrance animation): reports are
          // often viewed in a background tab or exported, where an animated
          // chart freezes at frame 0 (pie/donut would show no ring).
          isAnimationActive: false,
        }}
      />
    </div>
  );
}

/** Stable bucket id for a dimension-value tuple. */
function bucketId(dims: string[], row: Row): string {
  return dims.map((d) => String(row[d] ?? '∅')).join('');
}

function bucketLabel(dims: string[], row: Row): string {
  return dims.map((d) => formatDimensionValue(row[d])).join(' / ');
}

/**
 * True cross-tab for `type: 'matrix'` — one dataset query over
 * `[...rows, ...columns]`, pivoted client-side. Cells show every measure
 * (single measure → one column per across-bucket; multiple → one column per
 * across-bucket × measure). Totals come from the SAME query via
 * `totals: { groupings: [rows, columns, []] }` — pre-aggregated server-side,
 * never recombined here; a response without `totals` renders no totals UI.
 */
function DatasetMatrixTable({
  dataset,
  rows,
  columnsAcross,
  values,
  runtimeFilter,
  dataSource,
  onDrill,
}: {
  dataset: string;
  rows: string[];
  columnsAcross: string[];
  values: string[];
  runtimeFilter?: Record<string, unknown>;
  dataSource?: unknown;
  onDrill?: (args: DatasetDrillArgs) => void;
}) {
  // Row subtotals, column subtotals, and the grand total ([]), in that order.
  const state = useDatasetRows(dataset, [...rows, ...columnsAcross], values, runtimeFilter, dataSource, [
    rows,
    columnsAcross,
    [],
  ]);
  const tt = useSafeTranslate();
  const { fieldLabel } = useSafeFieldLabel();

  const pivot = React.useMemo(() => {
    if (state.status !== 'ok') return null;
    const rowHeaders: Array<{ id: string; label: string; key: Row }> = [];
    const colHeaders: Array<{ id: string; label: string; key: Row }> = [];
    const seenRow = new Set<string>();
    const seenCol = new Set<string>();
    const cells = new Map<string, { row: Row; index: number }>();
    state.rows.forEach((r, index) => {
      const rid = bucketId(rows, r);
      const cid = bucketId(columnsAcross, r);
      if (!seenRow.has(rid)) {
        seenRow.add(rid);
        const key: Row = {};
        for (const d of rows) key[d] = r[d];
        rowHeaders.push({ id: rid, label: bucketLabel(rows, r), key });
      }
      if (!seenCol.has(cid)) {
        seenCol.add(cid);
        const key: Row = {};
        for (const d of columnsAcross) key[d] = r[d];
        colHeaders.push({ id: cid, label: bucketLabel(columnsAcross, r), key });
      }
      cells.set(`${rid} ${cid}`, { row: r, index });
    });
    return { rowHeaders, colHeaders, cells };
  }, [state, rows, columnsAcross]);

  if (values.length === 0) return <EmptyMeasures dataset={dataset} />;
  if (state.status === 'loading' || state.status === 'idle') return <FetchStates status={state.status} />;
  if (state.status === 'error') return <FetchStates status="error" error={state.error} />;
  if (!pivot || pivot.rowHeaders.length === 0) return <NoRows />;

  const { measureField, headerLabel } = buildDatasetFieldHelpers(state.fields, state.object, fieldLabel);
  const totalText = tt('report.total', 'Total');
  const canDrill = !!onDrill;
  // Down + across dims the server can map to object fields → raw-value filter.
  const drillDims = state.dimensionFields
    ? [...rows, ...columnsAcross].filter((d) => d in state.dimensionFields!)
    : [];
  const drillCell = (rowKey: Row, colKey: Row, index: number) => {
    const objectFilter =
      state.object && state.dimensionFields && drillDims.length > 0
        ? buildDatasetDrillFilter(state.drillRawRows?.[index], drillDims, state.dimensionFields, runtimeFilter)
        : undefined;
    onDrill!({ dataset, groupKey: { ...rowKey, ...colKey }, runtimeFilter, object: state.object, objectFilter });
  };

  // Single measure → one column per across-bucket; multiple → bucket × measure.
  const cellCols = pivot.colHeaders.flatMap((col) =>
    values.map((measure) => ({
      col,
      measure,
      header: values.length === 1 ? col.label : `${col.label} · ${headerLabel(measure)}`,
    })),
  );

  // Server-supplied totals: match each grouping by its `dimensions` array,
  // then match its rows to the pivot headers via the same bucketId. Absent
  // (older server) → every map stays empty and no totals UI renders.
  const findTotals = (dims: string[]) =>
    state.totals?.find((t) => Array.isArray(t.dimensions) && t.dimensions.join(',') === dims.join(','))?.rows;
  const rowTotalById = new Map<string, Row>();
  for (const r of findTotals(rows) ?? []) rowTotalById.set(bucketId(rows, r), r);
  const colTotalById = new Map<string, Row>();
  for (const r of findTotals(columnsAcross) ?? []) colTotalById.set(bucketId(columnsAcross, r), r);
  const grandTotal = findTotals([])?.[0];
  const showTotalCol = rowTotalById.size > 0;
  const showTotalRow = colTotalById.size > 0;

  return (
    <div className="overflow-auto max-h-[70vh] rounded-md border" data-testid="dataset-matrix">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            {rows.map((d) => (
              <th key={d} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                {headerLabel(d)}
              </th>
            ))}
            {cellCols.map((cc) => (
              <th key={`${cc.col.id}-${cc.measure}`} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">
                {cc.header}
              </th>
            ))}
            {showTotalCol &&
              values.map((measure) => (
                <th
                  key={`total-${measure}`}
                  className="px-2 py-1.5 text-right font-medium whitespace-nowrap"
                  data-testid="matrix-total-col-header"
                >
                  {values.length === 1 ? totalText : `${totalText} · ${headerLabel(measure)}`}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {pivot.rowHeaders.map((rh) => (
            <tr key={rh.id} className="border-t">
              {rows.map((d) => (
                <td key={d} className="px-2 py-1 whitespace-nowrap font-medium">
                  {formatDimensionValue(rh.key[d])}
                </td>
              ))}
              {cellCols.map((cc) => {
                const entry = pivot.cells.get(`${rh.id} ${cc.col.id}`);
                const value = entry?.row[cc.measure];
                const clickable = canDrill && entry != null;
                return (
                  <td
                    key={`${cc.col.id}-${cc.measure}`}
                    className={`px-2 py-1 text-right tabular-nums whitespace-nowrap${clickable ? ` ${DRILL_CLASS}` : ''}`}
                    data-testid={clickable ? 'dataset-drill-cell' : undefined}
                    onClick={clickable ? () => drillCell(rh.key, cc.col.key, entry!.index) : undefined}
                  >
                    {formatMeasure(value, measureField(cc.measure)?.format, measureField(cc.measure)?.currency)}
                  </td>
                );
              })}
              {showTotalCol &&
                values.map((measure) => (
                  <td
                    key={`total-${measure}`}
                    className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium"
                    data-testid="matrix-row-total"
                  >
                    {formatMeasure(rowTotalById.get(rh.id)?.[measure], measureField(measure)?.format, measureField(measure)?.currency)}
                  </td>
                ))}
            </tr>
          ))}
          {showTotalRow && (
            <tr className="border-t bg-muted/30 font-medium" data-testid="matrix-total-row">
              {rows.length > 0 && (
                <td colSpan={rows.length} className="px-2 py-1 whitespace-nowrap">
                  {totalText}
                </td>
              )}
              {cellCols.map((cc) => (
                <td key={`${cc.col.id}-${cc.measure}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                  {formatMeasure(colTotalById.get(cc.col.id)?.[cc.measure], measureField(cc.measure)?.format, measureField(cc.measure)?.currency)}
                </td>
              ))}
              {showTotalCol &&
                values.map((measure) => (
                  <td
                    key={`grand-${measure}`}
                    className="px-2 py-1 text-right tabular-nums whitespace-nowrap"
                    data-testid="matrix-grand-total"
                  >
                    {formatMeasure(grandTotal?.[measure], measureField(measure)?.format, measureField(measure)?.currency)}
                  </td>
                ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const DatasetReportRenderer: React.FC<DatasetReportRendererProps> = ({
  report,
  dataSource,
  runtimeFilter,
  onDrill,
  className,
}) => {
  const outerFilter = mergeFilters(
    (report.runtimeFilter ?? report.filter) as Record<string, unknown> | undefined,
    runtimeFilter,
  );
  // ADR-0021 D2: `drilldown` defaults on; the host must still supply a sink.
  const drillSink = report.drilldown === false ? undefined : onDrill;

  // Joined → a vertical stack of dataset-bound blocks.
  if (report.type === 'joined' && Array.isArray(report.blocks)) {
    return (
      <div
        className={className}
        data-testid="dataset-joined-report"
        data-report-name={report.name}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {report.blocks.map((block, index) => {
          const blockFilter = mergeFilters(outerFilter, (block.runtimeFilter ?? block.filter) as Record<string, unknown> | undefined);
          const blockAcross = readNames(block.columns);
          const blockTable = block.type === 'matrix' && blockAcross.length > 0 ? (
            <DatasetMatrixTable
              dataset={String(block.dataset ?? '')}
              rows={readNames(block.rows)}
              columnsAcross={blockAcross}
              values={readNames(block.values)}
              runtimeFilter={blockFilter}
              dataSource={dataSource}
              onDrill={drillSink}
            />
          ) : (
            <DatasetReportTable
              dataset={String(block.dataset ?? '')}
              rows={readNames(block.rows)}
              values={readNames(block.values)}
              runtimeFilter={blockFilter}
              dataSource={dataSource}
              onDrill={drillSink}
            />
          );
          return (
            <section
              key={block.name ?? `block-${index}`}
              data-testid="dataset-report-block"
              data-block-id={block.name ?? `block-${index}`}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4"
            >
              <header className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold">{resolveText(block.label, block.name ?? `Block ${index + 1}`)}</h3>
                {block.description ? (
                  <p className="text-xs text-muted-foreground">{resolveText(block.description, '')}</p>
                ) : null}
              </header>
              {blockTable}
            </section>
          );
        })}
      </div>
    );
  }

  const across = readNames(report.columns);
  // Matrix with an across dimension → true cross-tab; without one it
  // degrades to the flat grouped table (pre-`columns` stored JSON).
  if (report.type === 'matrix' && across.length > 0) {
    return (
      <div className={className} data-testid="dataset-report" data-report-name={report.name}>
        <DatasetMatrixTable
          dataset={String(report.dataset ?? '')}
          rows={readNames(report.rows)}
          columnsAcross={across}
          values={readNames(report.values)}
          runtimeFilter={outerFilter}
          dataSource={dataSource}
          onDrill={drillSink}
        />
      </div>
    );
  }

  // summary / tabular (and matrix without `columns`) → a grouped table,
  // preceded by the embedded chart visualization when the report declares one
  // (ADR-0021: the chart plots the dataset's yAxis measure across the xAxis
  // dimension; the table beneath always carries the exact numbers).
  const chartCfg =
    report.chart && typeof report.chart === 'object' && (report.chart as { type?: unknown }).type
      ? (report.chart as Record<string, unknown>)
      : null;
  return (
    <div
      className={`${className ?? ''} flex flex-col gap-3`}
      data-testid="dataset-report"
      data-report-name={report.name}
    >
      {chartCfg ? (
        <DatasetReportChart
          dataset={String(report.dataset ?? '')}
          chart={chartCfg}
          runtimeFilter={outerFilter}
          dataSource={dataSource}
        />
      ) : null}
      <DatasetReportTable
        dataset={String(report.dataset ?? '')}
        rows={readNames(report.rows)}
        values={readNames(report.values)}
        runtimeFilter={outerFilter}
        dataSource={dataSource}
        onDrill={drillSink}
      />
    </div>
  );
};
