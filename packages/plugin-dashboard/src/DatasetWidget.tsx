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
 *  - table / pivot → a grouped table of `dimensions` + `values`.
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
import { Loader2, BarChart3, AlertTriangle } from 'lucide-react';
import { resolveDateMacros } from './utils';

type Row = Record<string, unknown>;
/** Measure column metadata from the analytics result (ADR-0021). */
interface ResultField { name: string; type?: string; label?: string; format?: string }
interface DatasetCapableSource {
  queryDataset?: (dataset: string, selection: unknown) => Promise<{ rows: Row[]; fields?: ResultField[] }>;
}

/**
 * Format a measure value using its dataset `format` hint (numeral-style, e.g.
 * "$0,0", "0.0", "0.0%"). Falls back to a thousand-separated number. The format
 * can't be baked into the numeric row value server-side (charts need the raw
 * number), so it is applied here at render time.
 */
function formatMeasure(v: unknown, format?: string): string {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);
  if (!format) {
    // No format hint → preserve the plain rendering (integers verbatim).
    return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const isPercent = format.includes('%');
  const isCurrency = format.includes('$');
  const decimals = format.split('.')[1]?.match(/0/g)?.length ?? 0;
  const body = v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${isCurrency ? '$' : ''}${body}${isPercent ? '%' : ''}`;
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

  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; rows: Row[]; fields?: ResultField[]; error?: string }>({ status: 'idle', rows: [] });

  // Signature uses the RAW filter (stable) — the resolved one carries a
  // render-time `now` and would otherwise force a refetch loop.
  const signature = `${datasetName}|${dimensions.join(',')}|${values.join(',')}|${JSON.stringify(rawFilter ?? null)}|${JSON.stringify(compareTo ?? null)}`;
  useEffect(() => {
    const src = dataSource as DatasetCapableSource | undefined;
    if (!src || typeof src.queryDataset !== 'function') {
      setState({ status: 'error', rows: [], error: 'This data source does not support dataset queries.' });
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
      .then((res) => { if (!cancelled) setState({ status: 'ok', rows: Array.isArray(res?.rows) ? res.rows : [], fields: Array.isArray(res?.fields) ? res.fields : [] }); })
      .catch((e) => { if (!cancelled) setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (values.length === 0) {
    return <div className="flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">Pick measures (values) for this dataset widget.</div>;
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
  if (state.rows.length === 0) {
    return <div className="flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground"><BarChart3 className="mr-2 h-4 w-4" />No rows</div>;
  }

  // Measure metadata (label + format) carried on the result fields, keyed by name.
  const fieldByName = new Map((state.fields ?? []).map((f) => [f.name, f]));
  const measureField = (name: string) => fieldByName.get(name);

  // Metric / KPI — show the single measure value of the first row, using the
  // measure's display label (not the raw name) and its format (e.g. "$616,000").
  if (isMetric) {
    const f = measureField(values[0]);
    const value = state.rows[0]?.[values[0]];
    return (
      <div className="flex h-full w-full flex-col items-start justify-center gap-1 p-2">
        <span className="text-2xl font-semibold tabular-nums">{formatMeasure(value, f?.format)}</span>
        <span className="text-xs text-muted-foreground">{f?.label ?? values[0]}</span>
      </div>
    );
  }

  // Table / pivot — a grouped table of the selected dimensions + measures.
  if (isTable) {
    const columns = [...dimensions, ...values];
    return (
      <div className="h-full w-full overflow-auto p-1">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{measureField(c)?.label ?? c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1 whitespace-nowrap tabular-nums">
                    {values.includes(c) ? formatMeasure(row[c], measureField(c)?.format) : formatValue(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
