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
import { buildChartSeries } from '@object-ui/core';
import { cn } from '@object-ui/components';
import { useObjectTranslation, useSafeFieldLabel } from '@object-ui/i18n';
import { Loader2, BarChart3, AlertTriangle } from 'lucide-react';
import { resolveDateMacros } from './utils';
import { DrillDownDrawer } from './DrillDownDrawer';

type Row = Record<string, unknown>;
/** Measure column metadata from the analytics result (ADR-0021). */
interface ResultField { name: string; type?: string; label?: string; format?: string; currency?: string }
interface DatasetResult { rows: Row[]; fields?: ResultField[]; object?: string; dimensionFields?: Record<string, string> }
interface DatasetCapableSource {
  queryDataset?: (dataset: string, selection: unknown) => Promise<DatasetResult>;
}

/**
 * Build the record-list filter for a drilled row. Each drillable dimension maps
 * to its underlying object field, filtered by the dimension's RAW grouped value
 * (taken from the server's parallel `drillRawRows` array — the visible `row`
 * carries the display label, which would mis-filter a select/lookup field). The
 * widget's render-time scope (`runtimeFilter`) is ANDed in so the drilled list
 * stays within the same slice the aggregate was computed over.
 */
export function buildDrillFilter(
  rawRow: Record<string, unknown> | undefined,
  drillDims: string[],
  dimensionFields: Record<string, string>,
  runtimeFilter?: Record<string, unknown>,
): Record<string, unknown> {
  const drillFilter: Record<string, unknown> = {};
  for (const d of drillDims) {
    const raw = rawRow?.[d];
    drillFilter[dimensionFields[d]] = raw === '' || raw === undefined ? null : raw;
  }
  return runtimeFilter ? { ...runtimeFilter, ...drillFilter } : drillFilter;
}

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
    if (!rowSeen.has(rid)) { rowSeen.add(rid); rowHeaders.push({ id: rid, labels: rowDims.map((d) => formatValue(row[d])) }); }
    if (!colSeen.has(cid)) { colSeen.add(cid); colHeaders.push({ id: cid, label: formatValue(row[colDim]) }); }
    cellIndex.set(`${rid} ${cid}`, index);
  });
  return { rowHeaders, colHeaders, cellIndex };
}

/**
 * Translate with a graceful fallback. Mirrors the PivotTable pattern: when no
 * i18n provider is mounted (or the key is missing), return the English default
 * so the widget never renders a raw translation key.
 */
function useTranslate(): (key: string, fallback: string) => string {
  let t: ((k: string) => string) | undefined;
  try {
    t = useObjectTranslation().t;
  } catch {
    t = undefined;
  }
  return (key, fallback) => {
    if (!t) return fallback;
    const v = t(key);
    return !v || v === key ? fallback : v;
  };
}

/**
 * Format a measure value. Currency comes from the field's declared `currency`
 * (locale-correct symbol via `Intl`), NOT from a "$" baked into the format
 * string — an amount with no declared currency must render as a plain number,
 * never a misleading "$". The numeral-style `format` hint (e.g. "0,0", "0.0%")
 * controls grouping / decimals / percent; it can't be baked into the row value
 * server-side (charts need the raw number), so it is applied here.
 */
function formatMeasure(v: unknown, format?: string, currency?: string): string {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);

  const decimals = format ? (format.split('.')[1]?.match(/0/g)?.length ?? 0) : undefined;

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 2,
      }).format(v);
    } catch {
      // Unknown currency code → fall through to plain number formatting.
    }
  }

  if (!format) {
    // No format hint → preserve the plain rendering (integers verbatim).
    return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const isPercent = format.includes('%');
  // A legacy "$" literal in the format string is still honored (explicit author
  // choice) — but it is NOT how a real currency field gets its symbol.
  const legacyDollar = format.includes('$') ? '$' : '';
  const body = v.toLocaleString(undefined, { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0 });
  return `${legacyDollar}${body}${isPercent ? '%' : ''}`;
}

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
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

  const tt = useTranslate();
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

  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; rows: Row[]; fields?: ResultField[]; object?: string; dimensionFields?: Record<string, string>; drillRawRows?: Array<Record<string, unknown>>; error?: string }>({ status: 'idle', rows: [] });
  // Drill-through (ADR-0021 D2): the clicked bucket's record-list filter + title.
  const [drill, setDrill] = useState<{ filter: Record<string, unknown>; title: string } | null>(null);

  // Signature uses the RAW filter (stable) — the resolved one carries a
  // render-time `now` and would otherwise force a refetch loop.
  const signature = `${datasetName}|${dimensions.join(',')}|${values.join(',')}|${JSON.stringify(rawFilter ?? null)}|${JSON.stringify(compareTo ?? null)}`;
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
    })
      .then((res) => { if (!cancelled) setState({ status: 'ok', rows: Array.isArray(res?.rows) ? res.rows : [], fields: Array.isArray(res?.fields) ? res.fields : [], object: res?.object, dimensionFields: res?.dimensionFields, drillRawRows: Array.isArray(res?.drillRawRows) ? res.drillRawRows : undefined }); })
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

  // Measure metadata (label + format + currency) carried on the result fields, keyed by name.
  const fieldByName = new Map((state.fields ?? []).map((f) => [f.name, f]));
  const measureField = (name: string) => fieldByName.get(name);
  // Resolve a column header: the dataset's display label (server-enriched onto
  // the field, for dimensions and measures alike), then through the i18n
  // field-label convention so a translated label wins, then the raw name.
  const headerLabel = (name: string) => {
    const fallback = measureField(name)?.label ?? name;
    return state.object ? fieldLabel(state.object, name, fallback) : fallback;
  };

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

    // pivot → a true cross-tab when there are ≥2 dimensions: the LAST dimension
    // spreads ACROSS as columns, the rest go DOWN as rows, measures fill the
    // cells. The dataset already returns one row per dimension combination, so
    // cells just place those pre-aggregated values — no client re-aggregation
    // (an avg/min/max can't be recombined). With <2 dimensions a cross-tab is
    // meaningless, so it degrades to the flat grouped table.
    const isMatrix = widgetType === 'pivot' && dimensions.length >= 2;
    if (isMatrix) {
      const rowDims = dimensions.slice(0, -1);
      const colDim = dimensions[dimensions.length - 1];
      const pivot = buildPivot(state.rows, rowDims, colDim);
      // Single measure → one column per across-bucket; multiple → bucket × measure.
      const cellCols = pivot.colHeaders.flatMap((col) =>
        values.map((m) => ({ col, measure: m, header: values.length === 1 ? col.label : `${col.label} · ${headerLabel(m)}` })),
      );
      return (
        <div className="h-full w-full overflow-auto p-1" data-testid="dataset-matrix">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                {rowDims.map((d) => (
                  <th key={d} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{headerLabel(d)}</th>
                ))}
                {cellCols.map((cc) => (
                  <th key={`${cc.col.id}-${cc.measure}`} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{cc.header}</th>
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
                        {fr ? formatMeasure(fr[cc.measure], measureField(cc.measure)?.format, measureField(cc.measure)?.currency) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {drawer}
        </div>
      );
    }

    // table (and a 1-dimension pivot) → a flat grouped table.
    const columns = [...dimensions, ...values];
    return (
      <div className="h-full w-full overflow-auto p-1">
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
                onClick={canDrill ? () => openDrill(i, drillDims.map((d) => formatValue(row[d])).filter(Boolean).join(' / ')) : undefined}
              >
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1 whitespace-nowrap tabular-nums">
                    {values.includes(c) ? formatMeasure(row[c], measureField(c)?.format, measureField(c)?.currency) : formatValue(row[c])}
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
