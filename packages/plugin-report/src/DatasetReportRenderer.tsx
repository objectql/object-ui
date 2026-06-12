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
 * Drill-down (ADR-0021 D2): when the report's `drilldown` flag is not `false`
 * and the host supplies `onDrill`, every aggregated row / matrix cell is
 * clickable and emits `{ dataset, groupKey, runtimeFilter }`. The HOST owns
 * navigation — it resolves the dataset's `object` and dimension→field mapping
 * (this renderer only knows dimension NAMES) and routes to the underlying
 * records.
 */

import * as React from 'react';
import { Loader2, AlertTriangle, Table2 } from 'lucide-react';
import { mergeFilters } from './mergeFilters';

type Row = Record<string, unknown>;

/** One server-computed totals grouping: `dimensions: []` is the grand total. */
interface DatasetTotals {
  dimensions: string[];
  rows: Row[];
}

interface DatasetCapableSource {
  queryDataset?: (dataset: string, selection: unknown) => Promise<{ rows: Row[]; totals?: DatasetTotals[] }>;
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
  label?: unknown;
  description?: unknown;
  blocks?: DatasetReportLike[];
}

/** What a drill click means — the host resolves names to a navigation target. */
export interface DatasetDrillArgs {
  /** Dataset the clicked aggregate was computed over. */
  dataset: string;
  /** Dimension NAME → clicked bucket value (row dims, plus across dims for a matrix cell). */
  groupKey: Record<string, unknown>;
  /** The effective render-time scope filter, if any. */
  runtimeFilter?: Record<string, unknown>;
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

function formatCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
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

  if (values.length === 0) return <EmptyMeasures dataset={dataset} />;
  if (state.status === 'loading' || state.status === 'idle') return <FetchStates status={state.status} />;
  if (state.status === 'error') return <FetchStates status="error" error={state.error} />;
  if (state.rows.length === 0) return <NoRows />;

  // Drilling needs at least one dimension to scope by.
  const canDrill = !!onDrill && rows.length > 0;
  const drill = (row: Row) => {
    const groupKey: Record<string, unknown> = {};
    for (const dim of rows) groupKey[dim] = row[dim];
    onDrill!({ dataset, groupKey, runtimeFilter });
  };

  const columns = [...rows, ...values];
  return (
    <div className="overflow-auto max-h-[70vh] rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                {c}
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
              onClick={canDrill ? () => drill(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c} className="px-2 py-1 tabular-nums whitespace-nowrap">
                  {formatCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stable bucket id for a dimension-value tuple. */
function bucketId(dims: string[], row: Row): string {
  return dims.map((d) => String(row[d] ?? '∅')).join('');
}

function bucketLabel(dims: string[], row: Row): string {
  return dims.map((d) => formatCell(row[d])).join(' / ');
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

  const pivot = React.useMemo(() => {
    if (state.status !== 'ok') return null;
    const rowHeaders: Array<{ id: string; label: string; key: Row }> = [];
    const colHeaders: Array<{ id: string; label: string; key: Row }> = [];
    const seenRow = new Set<string>();
    const seenCol = new Set<string>();
    const cells = new Map<string, Row>();
    for (const r of state.rows) {
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
      cells.set(`${rid} ${cid}`, r);
    }
    return { rowHeaders, colHeaders, cells };
  }, [state, rows, columnsAcross]);

  if (values.length === 0) return <EmptyMeasures dataset={dataset} />;
  if (state.status === 'loading' || state.status === 'idle') return <FetchStates status={state.status} />;
  if (state.status === 'error') return <FetchStates status="error" error={state.error} />;
  if (!pivot || pivot.rowHeaders.length === 0) return <NoRows />;

  const canDrill = !!onDrill;
  const drillCell = (rowKey: Row, colKey: Row) => {
    onDrill!({ dataset, groupKey: { ...rowKey, ...colKey }, runtimeFilter });
  };

  // Single measure → one column per across-bucket; multiple → bucket × measure.
  const cellCols = pivot.colHeaders.flatMap((col) =>
    values.map((measure) => ({
      col,
      measure,
      header: values.length === 1 ? col.label : `${col.label} · ${measure}`,
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
                {d}
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
                  {values.length === 1 ? 'Total' : `Total · ${measure}`}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {pivot.rowHeaders.map((rh) => (
            <tr key={rh.id} className="border-t">
              {rows.map((d) => (
                <td key={d} className="px-2 py-1 whitespace-nowrap font-medium">
                  {formatCell(rh.key[d])}
                </td>
              ))}
              {cellCols.map((cc) => {
                const cell = pivot.cells.get(`${rh.id} ${cc.col.id}`);
                const value = cell?.[cc.measure];
                const clickable = canDrill && cell != null;
                return (
                  <td
                    key={`${cc.col.id}-${cc.measure}`}
                    className={`px-2 py-1 text-right tabular-nums whitespace-nowrap${clickable ? ` ${DRILL_CLASS}` : ''}`}
                    data-testid={clickable ? 'dataset-drill-cell' : undefined}
                    onClick={clickable ? () => drillCell(rh.key, cc.col.key) : undefined}
                  >
                    {formatCell(value)}
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
                    {formatCell(rowTotalById.get(rh.id)?.[measure])}
                  </td>
                ))}
            </tr>
          ))}
          {showTotalRow && (
            <tr className="border-t bg-muted/30 font-medium" data-testid="matrix-total-row">
              {rows.length > 0 && (
                <td colSpan={rows.length} className="px-2 py-1 whitespace-nowrap">
                  Total
                </td>
              )}
              {cellCols.map((cc) => (
                <td key={`${cc.col.id}-${cc.measure}`} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                  {formatCell(colTotalById.get(cc.col.id)?.[cc.measure])}
                </td>
              ))}
              {showTotalCol &&
                values.map((measure) => (
                  <td
                    key={`grand-${measure}`}
                    className="px-2 py-1 text-right tabular-nums whitespace-nowrap"
                    data-testid="matrix-grand-total"
                  >
                    {formatCell(grandTotal?.[measure])}
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

  // summary / tabular (and matrix without `columns`) → a single grouped table.
  return (
    <div className={className} data-testid="dataset-report" data-report-name={report.name}>
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
