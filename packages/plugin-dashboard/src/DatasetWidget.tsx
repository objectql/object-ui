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
import { SchemaRenderer } from '@object-ui/react';
import {
  buildChartSeries,
  formatMeasure,
  formatDimensionValue,
  buildDatasetFieldHelpers,
  buildDatasetDrillFilter,
  type DatasetResultField,
} from '@object-ui/core';
import { cn } from '@object-ui/components';
import { useSafeFieldLabel, useSafeTranslate } from '@object-ui/i18n';
import { Loader2, BarChart3, AlertTriangle, Download } from 'lucide-react';
import { resolveDateMacros } from './utils';
import { DrillDownDrawer } from './DrillDownDrawer';

type Row = Record<string, unknown>;
interface DatasetTotals { dimensions: string[]; rows: Row[] }
interface DatasetResult { rows: Row[]; fields?: DatasetResultField[]; object?: string; dimensionFields?: Record<string, string>; drillRawRows?: Row[]; totals?: DatasetTotals[] }
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
 * Pivot flat dataset rows into a cross-tab: `rowDims` go DOWN, `colDim` spreads
 * ACROSS. Returns ordered row/column headers (display labels from the rows) and
 * a map from a `${rowId} ${colId}` cell key to the FLAT row index holding
 * that combination's measure values. No re-aggregation — the dataset already
 * grouped by every dimension, so each cell maps to exactly one row (the index
 * is also what drill-through uses to read `drillRawRows`).
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
    const rid = rowDims.map((d) => String(row[d] ?? '∅')).join('');
    const cid = String(row[colDim] ?? '∅');
    if (!rowSeen.has(rid)) { rowSeen.add(rid); rowHeaders.push({ id: rid, labels: rowDims.map((d) => formatDimensionValue(row[d])) }); }
    if (!colSeen.has(cid)) { colSeen.add(cid); colHeaders.push({ id: cid, label: formatDimensionValue(row[colDim]) }); }
    cellIndex.set(`${rid} ${cid}`, index);
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
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = base.endsWith('.csv') ? base : `${base}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

export function DatasetWidget({ widget, dataSource }: { widget: any; dataSource: unknown }) {
  const datasetName = String(widget?.dataset ?? '');
  const dimensions: string[] = useMemo(() => (Array.isArray(widget?.dimensions) ? widget.dimensions.filter(Boolean) : []), [widget]);
  const values: string[] = useMemo(() => (Array.isArray(widget?.values) ? widget.values.filter(Boolean) : []), [widget]);
  // Dataset `compareTo` must be the structured `{ kind, dimension }` shape (it
  // needs a time dimension + dateRange). The legacy widget form is a bare string
  // (`'previousPeriod'`) — forwarding it makes the executor throw "compareTo
  // requires a timeDimension". Only pass the structured form; drop the legacy
  // string (the base measure still renders; the comparison overlay is opt-in).
  const compareTo = widget?.compareTo && typeof widget.compareTo === 'object' ? widget.compareTo : undefined;
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

  const tt = useSafeTranslate();
  const { fieldLabel } = useSafeFieldLabel();

  // ADR-0021 dual-form: the widget's presentation-scope `filter` must flow into
  // the dataset query as `runtimeFilter`, or a dataset-bound widget renders the
  // UNFILTERED total (e.g. "open pipeline" showing the grand total). Resolve
  // date macros client-side first — exactly as the legacy widget renderers do
  // (the server does not expand `{current_quarter_start}` etc.). Keyed on the
  // raw filter ref so the resolution is stable across renders.
  const rawFilter = widget?.filter;
  const runtimeFilter = useMemo(
    () => (rawFilter && typeof rawFilter === 'object' && Object.keys(rawFilter).length > 0
      ? resolveDateMacros(rawFilter)
      : undefined),
    [rawFilter],
  );

  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; rows: Row[]; fields?: DatasetResultField[]; object?: string; dimensionFields?: Record<string, string>; drillRawRows?: Array<Record<string, unknown>>; totals?: DatasetTotals[]; error?: string }>({ status: 'idle', rows: [] });
  // Drill-through (ADR-0021 D2): the clicked bucket's record-list filter + title.
  const [drill, setDrill] = useState<{ filter: Record<string, unknown>; title: string } | null>(null);

  // Signature uses the RAW filter (stable) — the resolved one carries a
  // render-time `now` and would otherwise force a refetch loop.
  const signature = `${widgetType}|${datasetName}|${dimensions.join(',')}|${values.join(',')}|${JSON.stringify(rawFilter ?? null)}|${JSON.stringify(compareTo ?? null)}`;
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
      ...(runtimeFilter ? { runtimeFilter } : {}),
      ...(compareTo ? { compareTo } : {}),
      ...(totalsGroupings ? { totals: { groupings: totalsGroupings } } : {}),
    })
      .then((res) => { if (!cancelled) setState({ status: 'ok', rows: Array.isArray(res?.rows) ? res.rows : [], fields: Array.isArray(res?.fields) ? res.fields : [], object: res?.object, dimensionFields: res?.dimensionFields, drillRawRows: Array.isArray(res?.drillRawRows) ? res.drillRawRows : undefined, totals: Array.isArray(res?.totals) ? res.totals : undefined }); })
      .catch((e) => { if (!cancelled) setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (values.length === 0) {
    return <div className="flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">{tt('dashboard.pickMeasures', 'Pick measures (values) for this dataset widget.')}</div>;
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return <div className="flex h-full w-full items-center justify-center p-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
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

  // Metric / KPI — show the single measure value of the first row, using the
  // measure's display label (not the raw name) and its format (e.g. "$616,000").
  if (isMetric) {
    const f = measureField(values[0]);
    const value = state.rows[0]?.[values[0]] ?? 0;
    return (
      <div className="flex h-full w-full flex-col items-start justify-center gap-1 p-2">
        <span className="text-2xl font-semibold tabular-nums">{formatMeasure(value, f?.format, f?.currency)}</span>
        <span className="text-xs text-muted-foreground">{headerLabel(values[0])}</span>
      </div>
    );
  }

  // Table / pivot — a grouped table or, for a pivot with ≥2 dimensions, a true
  // cross-tab.
  if (isTable) {
    // Drill-through is available when the server returned the dataset's object +
    // at least one drillable dimension that this widget actually groups by.
    const { object, dimensionFields, drillRawRows } = state;
    const drillDims = dimensionFields ? dimensions.filter((d) => d in dimensionFields) : [];
    const canDrill = !!object && drillDims.length > 0;

    // Drill by FLAT row index — both the flat table and the matrix cells map a
    // clicked element to a single dataset row (and its `drillRawRows` entry).
    const openDrill = (index: number, title: string) => {
      if (!object || !dimensionFields) return;
      const merged = buildDrillFilter(drillRawRows?.[index], drillDims, dimensionFields, runtimeFilter);
      setDrill({ filter: merged, title: title || String(widget?.title ?? '') });
    };

    const drawer = drill && object ? (
      <DrillDownDrawer
        open
        onClose={() => setDrill(null)}
        title={drill.title || String(widget?.title ?? tt('dashboard.details', 'Details'))}
        objectName={object}
        filter={drill.filter}
        dataSource={dataSource}
      />
    ) : null;

    // CSV export — display-label headers + the underlying grouped rows (measures
    // kept numeric so the data round-trips into a spreadsheet). Shared by the flat
    // table and the cross-tab.
    const exportColumns = [...dimensions, ...values];
    const exportCsv = () => downloadCsv(String(widget?.title ?? datasetName ?? 'export'), [
      exportColumns.map((c) => headerLabel(c)),
      ...state.rows.map((r) => exportColumns.map((c) => {
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
      const pivot = buildPivot(state.rows, rowDims, colDim);
      // Single measure → one column per across-bucket; multiple → bucket × measure.
      const cellCols = pivot.colHeaders.flatMap((col) =>
        values.map((m) => ({ col, measure: m, header: values.length === 1 ? col.label : `${col.label} · ${headerLabel(m)}` })),
      );
      const fmtMeasure = (v: unknown, m: string) => formatMeasure(v, measureField(m)?.format, measureField(m)?.currency);
      // Server-supplied marginal totals (ADR-0021): match each grouping by its
      // dimension array, then its rows to the pivot headers via the same bucket
      // ids. Absent (older server) → maps stay empty and no totals UI renders.
      const findTotals = (dims: string[]) =>
        state.totals?.find((t) => Array.isArray(t.dimensions) && t.dimensions.join(',') === dims.join(','))?.rows;
      const rowTotalById = new Map<string, Row>();
      for (const r of findTotals(rowDims) ?? []) rowTotalById.set(rowDims.map((d) => String(r[d] ?? '∅')).join(''), r);
      const colTotalById = new Map<string, Row>();
      for (const r of findTotals([colDim]) ?? []) colTotalById.set(String(r[colDim] ?? '∅'), r);
      const grandTotal = findTotals([])?.[0];
      const showTotalCol = rowTotalById.size > 0;
      const showTotalRow = colTotalById.size > 0;
      const totalLabel = tt('dashboard.total', 'Total');
      return (
        <div className="relative h-full w-full overflow-auto p-1" data-testid="dataset-matrix">{exportBtn}
          <table className="w-full text-xs">
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
                    const index = pivot.cellIndex.get(`${rh.id} ${cc.col.id}`);
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
                      </td>
                    );
                  })}
                  {showTotalCol && values.map((m) => (
                    <td key={`total-${m}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap font-medium" data-testid="matrix-row-total">
                      {fmtMeasure(rowTotalById.get(rh.id)?.[m], m)}
                    </td>
                  ))}
                </tr>
              ))}
              {showTotalRow && (
                <tr className="border-t bg-muted/30 font-medium" data-testid="matrix-total-row">
                  {rowDims.length > 0 && (
                    <td colSpan={rowDims.length} className="px-2 py-1 whitespace-nowrap">{totalLabel}</td>
                  )}
                  {cellCols.map((cc) => (
                    <td key={`${cc.col.id}-${cc.measure}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                      {fmtMeasure(colTotalById.get(cc.col.id)?.[cc.measure], cc.measure)}
                    </td>
                  ))}
                  {showTotalCol && values.map((m) => (
                    <td key={`grand-${m}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap" data-testid="matrix-grand-total">
                      {fmtMeasure(grandTotal?.[m], m)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
          {drawer}
        </div>
      );
    }

    // table (and a 1-dimension pivot) → a flat grouped table.
    const columns = [...dimensions, ...values];
    return (
      <div className="relative h-full w-full overflow-auto p-1">{exportBtn}
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{headerLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row, i) => (
              <tr
                key={i}
                className={cn('border-t', canDrill && 'cursor-pointer hover:bg-accent/40')}
                data-testid={canDrill ? 'dataset-drill-row' : undefined}
                onClick={canDrill ? () => openDrill(i, drillDims.map((d) => formatDimensionValue(row[d])).filter(Boolean).join(' / ')) : undefined}
              >
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1 whitespace-nowrap tabular-nums">
                    {values.includes(c) ? formatMeasure(row[c], measureField(c)?.format, measureField(c)?.currency) : formatDimensionValue(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {drawer}
      </div>
    );
  }

  // Chart — route to the advanced renderer with the widget's TRUE chart family
  // and one series per measure. Series carry the measure display label so the
  // legend reads "Tasks" rather than "task_count".
  const chartType = CHART_TYPE_MAP[widgetType] ?? 'bar';
  // ADR-0021 (#1759): shared helper — pivots a second dimension into grouped
  // series so multi-dimension dataset widgets match the chart-view renderer.
  const { data: chartData, xAxisKey, series } = buildChartSeries(state.rows, dimensions, values, state.fields);
  return (
    <div className={cn('h-full w-full min-h-[220px]')}>
      <SchemaRenderer
        schema={{ type: 'chart', chartType, data: chartData, xAxisKey, series } as any}
      />
    </div>
  );
}
