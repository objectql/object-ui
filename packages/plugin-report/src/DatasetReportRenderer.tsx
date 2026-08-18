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
 * - `tabular` → the selection as a simple list (`rows` + `values`), no totals.
 * - `summary` → the same table plus a SERVER-computed grand-total footer
 *   (`totals: { groupings: [[]] }`) — the declared type picks the branch
 *   (#2941), the data shape never does.
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
 * Ordering (framework#3916): a report's `order` — a list of `{ by, direction }`
 * keys, most significant first — is lowered onto the dataset selection, so the
 * SERVER orders the whole grid (after measure-scoped filters merge and derived
 * measures evaluate) and this renderer only places the rows it is handed. It is
 * never a client-side re-sort: sorting here would order the truncated page
 * rather than the query, and could not sort by a derived measure at all.
 *
 * For a matrix that also decides the ACROSS axis: `colHeaders` are collected in
 * row-arrival order, so ordering the rows by the across dimension is what makes
 * the columns read left-to-right in that order. Declaring nothing still reads
 * correctly — the server defaults a selected time dimension to ascending, which
 * is what makes month/quarter columns chronological out of the box.
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
  relabelDimensions,
  // The dataset→chart derivation the dashboard and the chart view have always
  // used, adopted here by objectui#4878: it is where the whole null-category
  // family lives (#4466 / #4497 / #4673 / #4500 / #4508), so routing through it
  // INHERITS those fixes instead of re-deriving them on a third surface.
  buildChartSeries,
  // The authored half of objectui#4229's data/presentation split (objectui#4877).
  // `mergeAuthoredSeries` — not `mergeAuthoredPresentation` — because a report's
  // `chart.xAxis`/`chart.yAxis` are bare dimension/measure NAME strings, i.e.
  // pure data on this surface; see the call site.
  chartConfigPresentation,
  mergeAuthoredSeries,
  pivotBucketId,
  pivotDimensionValue,
  pivotCellKey,
  type DatasetResultField,
  type DatasetDrillRange,
} from '@object-ui/core';
import { useSafeFieldLabel, useSafeTranslate, useDisplayLocale, useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import { mergeFilters } from './mergeFilters';
import { useDatasetDimensionLabels } from './useDatasetDimensionLabels';

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
    drillRanges?: Array<Record<string, DatasetDrillRange>>;
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
  /**
   * ⛔ NOT an authorable key, and NEVER applied as a filter (objectui#5137).
   *
   * `ReportSchema` (`@objectstack/spec`) is `z.core.$strict` and rejects
   * `filter` outright, naming the replacement itself
   * (`Did you mean … → runtimeFilter?`) — so a document carrying it did not
   * arrive through the validated path. It stays declared for exactly one reason:
   * so {@link warnOnRejectedFilterAlias} can SEE it on a stored document and
   * say out loud that no filter was applied. Reading it AS a scope filter is
   * the consumer tolerance this card removed. Author `runtimeFilter`.
   */
  filter?: Record<string, unknown>;
  /**
   * Result ordering, most significant key first (framework#3916). Each `by`
   * names a dimension the report groups by (`rows` / `columns`) or a measure it
   * displays (`values`). A `joined` report carries this per BLOCK, never on the
   * container.
   */
  order?: Array<{ by?: unknown; direction?: unknown }>;
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

// Warn-once memo for the rejected `filter` key. Keyed by SITE (which already
// carries the report / block name) plus the offending value's key set, so two
// different stale filters on one page both report — the author has to fix every
// producer, not just the first one seen, and a bare site key would mute the
// second. The key set rather than a full serialization because this reads
// stored JSON that crosses the repo boundary: a warning must not be able to
// throw on its way out.
const warnedFilterAliases = new Set<string>();

/** Reset the warn-once memo. Exported for tests. */
export function resetReportFilterAliasWarnings(): void {
  warnedFilterAliases.clear();
}

const isDev = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV !==
  'production';

/**
 * Dev-mode only: say out loud that a stored document's `filter` was NOT applied.
 *
 * objectui#5137 removed the `report.runtimeFilter ?? report.filter` alias read
 * (and its per-block twin). `filter` is not an authorable key — `ReportSchema`
 * (`@objectstack/spec`) is `z.core.$strict` and refuses it, naming the
 * replacement itself — so honouring it here made the runtime looser than the
 * contract the spec publishes, and which message an author met was a function
 * of which path their document travelled.
 *
 * Deleting the read ALONE would have been a silent narrowing: a stored document
 * still carrying `filter` renders **unfiltered**, which for a scoped report is
 * worse than an error. (Server-side permissions still apply, so this is not an
 * access-control hole — it is rows the AUTHOR meant to exclude, shown without
 * anyone being told.) So the key does not go quiet: it is said out loud, once
 * per offending document.
 *
 * The rename hint is copied verbatim from the spec's own `unrecognized_keys`
 * message (`@objectstack/spec` 17.0.0) so an author meets one message rather
 * than two dialects of one message.
 *
 * Non-breaking by construction: changes no types, rejects nothing, renders
 * everything it rendered before, and is a no-op under `NODE_ENV=production`.
 */
function warnOnRejectedFilterAlias(node: DatasetReportLike, site: string): void {
  if (!isDev()) return;
  const rejected = node.filter;
  if (rejected === undefined) return;
  const shape =
    rejected && typeof rejected === 'object'
      ? Object.keys(rejected as Record<string, unknown>).sort().join(',')
      : String(rejected);
  const memo = `${site}:${shape}`;
  if (warnedFilterAliases.has(memo)) return;
  warnedFilterAliases.add(memo);
  console.warn(
    `[ObjectUI] ${site} carries \`filter\`, which is not an authorable key. ` +
      'Did you mean `filter` → `runtimeFilter`? ' +
      'NO filter was applied — it renders UNFILTERED, showing rows the report ' +
      'was scoped to exclude. `ReportSchema` (`@objectstack/spec`) is strict and ' +
      'rejects `filter`, so this document did not come through the validated ' +
      'path; the renderer no longer reads it either. Fix the producer: rename ' +
      '`filter` to `runtimeFilter`. (objectui#5137)',
  );
}

/** How a report / block names itself in the warning above. */
function describeReportSite(report: DatasetReportLike): string {
  return `Report \`${report.name ?? '(unnamed)'}\``;
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

/** A lowered ordering, keyed in significance order (first key = primary sort). */
type SelectionOrder = Record<string, 'asc' | 'desc'>;

/**
 * Lower a report's authored `order` list into the `DatasetSelection.order` the
 * dataset query takes (framework#3916).
 *
 * The array's element order becomes the object's key insertion order, which is
 * how `DatasetSelection.order` expresses sort significance. Returns `undefined`
 * for an absent / empty / entirely-unusable list, so the caller OMITS the field
 * and the server's own defaults still apply — a selected time dimension comes
 * back chronological without the author declaring anything.
 *
 * Deliberately permissive about the input, like `readNames` above: this reads
 * stored report JSON, which crosses the repo boundary and may predate (or lag)
 * the schema. An entry with no usable `by` is dropped rather than throwing —
 * the authoring-time schema is where a malformed `order` is meant to be caught.
 *
 * Mirrors `reportSelectionOrder` in `@objectstack/spec/ui`; kept local because
 * the pinned spec (`^17.0.0-rc.0`) predates that export. Swap this for the
 * import once the dependency bump lands.
 */
function readOrder(value: unknown): SelectionOrder | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: SelectionOrder = {};
  for (const entry of value as Array<{ by?: unknown; direction?: unknown }>) {
    const by = entry && typeof entry === 'object' ? entry.by : undefined;
    if (typeof by !== 'string' || !by) continue;
    out[by] = entry.direction === 'desc' ? 'desc' : 'asc';
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Narrow an ordering to the keys a given selection actually projects.
 *
 * The server REJECTS an order key that names nothing the selection selected
 * (a deliberate 400 — a mistyped sort key that silently returns arbitrary rows
 * is worse than a loud failure). But one report's `order` is validated against
 * its WHOLE selection, while this renderer issues narrower sub-selections from
 * it: the embedded chart queries only `chart.xAxis` × `chart.yAxis`, and the
 * flat table path drops the matrix across-dimensions. Forwarding the full list
 * to those would turn a perfectly valid report into a failed query.
 *
 * So keys outside a sub-selection are dropped HERE rather than sent and
 * rejected. This cannot mask an authoring mistake: the report's own schema
 * already validated every key against `rows` ∪ `columns` ∪ `values`, so the
 * only keys that can be lost are ones the narrower query genuinely has no
 * column for.
 */
function scopeOrder(
  order: SelectionOrder | undefined,
  dimensions: string[],
  measures: string[],
): SelectionOrder | undefined {
  if (!order) return undefined;
  const selectable = new Set<string>([...dimensions, ...measures]);
  const out: SelectionOrder = {};
  for (const [key, direction] of Object.entries(order)) {
    if (selectable.has(key)) out[key] = direction;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Shared fetch for one dataset selection.
 *
 * `order` (framework#3916) is scoped to what THIS selection projects before it
 * is sent — see {@link scopeOrder}. Every report path funnels through here, so
 * scoping once is what keeps the chart's narrow x/y sub-selection from posting
 * an order key it never selected.
 */
function useDatasetRows(
  dataset: string,
  dimensions: string[],
  measures: string[],
  runtimeFilter: Record<string, unknown> | undefined,
  dataSource: unknown,
  totalsGroupings?: string[][],
  order?: SelectionOrder,
) {
  const [state, setState] = React.useState<{
    status: 'idle' | 'loading' | 'ok' | 'error';
    rows: Row[];
    fields?: DatasetResultField[];
    object?: string;
    dimensionFields?: Record<string, string>;
    drillRawRows?: Row[];
    drillRanges?: Array<Record<string, DatasetDrillRange>>;
    totals?: DatasetTotals[];
    error?: string;
  }>({
    status: 'idle',
    rows: [],
  });

  const scopedOrder = scopeOrder(order, dimensions, measures);
  const rfKey = JSON.stringify(runtimeFilter ?? null);
  const totalsKey = JSON.stringify(totalsGroupings ?? null);
  // The ordering is part of the signature: it changes the ROWS the server
  // returns (and, for a matrix, the arrival order the pivot builds its column
  // headers from), so a report edited from asc to desc must refetch, not
  // re-render the previous grid. `JSON.stringify` preserves key order, which is
  // exactly the sort significance that must invalidate the cache.
  const orderKey = JSON.stringify(scopedOrder ?? null);
  const signature = `${dataset}|${dimensions.join(',')}|${measures.join(',')}|${rfKey}|${totalsKey}|${orderKey}`;
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
        ...(scopedOrder ? { order: scopedOrder } : {}),
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
            drillRanges: Array.isArray(res?.drillRanges) ? res.drillRanges : undefined,
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

/**
 * One dataset-bound table: fetch via `queryDataset`, render `rows` + `values`.
 *
 * `withTotals` is what tells a `summary` report ("grouped by row") apart from
 * a `tabular` one ("simple list") at the same selection (#2941): a summary
 * additionally asks the SAME query for its grand total
 * (`totals: { groupings: [[]] }`) and renders it as a footer row. The total is
 * server-aggregated — never recombined from the bucket rows here, which the
 * ADR-0021 governance red line forbids (an `avg` cannot be recombined) — so an
 * older server that returns no `totals` renders the plain table, exactly like
 * the matrix path.
 */
function DatasetReportTable({
  dataset,
  rows,
  values,
  runtimeFilter,
  dataSource,
  onDrill,
  order,
  withTotals,
}: {
  dataset: string;
  rows: string[];
  values: string[];
  runtimeFilter?: Record<string, unknown>;
  dataSource?: unknown;
  onDrill?: (args: DatasetDrillArgs) => void;
  order?: SelectionOrder;
  withTotals?: boolean;
}) {
  // With no grouping dimensions the single result row already IS the grand
  // total — requesting totals would only duplicate it.
  const state = useDatasetRows(
    dataset,
    rows,
    values,
    runtimeFilter,
    dataSource,
    withTotals && rows.length > 0 ? [[]] : undefined,
    order,
  );
  const { fieldLabel } = useSafeFieldLabel();
  const tt = useSafeTranslate();
  // The display locale every measure and dimension value below is formatted in
  // (objectui#4575, completing objectui#4566's channel). `formatMeasure` /
  // `formatDimensionValue` are pure functions in `@object-ui/core`, which is
  // React-free, so the tag has to arrive as an argument. Nothing in this
  // component formats inside a `useMemo` — every site is in the render body —
  // so there is no dependency array to add it to here (the matrix below is the
  // one place in this file where there is).
  const displayLocale = useDisplayLocale();
  // objectui#4330 — the option list this report's select dimensions are
  // localized against. Null (and free) for a report whose dimensions own no
  // options, or before the read lands.
  const dimensionLabels = useDatasetDimensionLabels(state.object, state.dimensionFields, rows);

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
    // #1752: a time-bucketed date dim contributes a RANGE (not an equality dim),
    // so the fast path also fires when the server sent a range for this row —
    // covering a date-ONLY report that has no equality drill dim at all.
    const rowRanges = state.drillRanges?.[index];
    const hasRange = !!rowRanges && Object.keys(rowRanges).length > 0;
    const objectFilter =
      state.object && (drillDims.length > 0 || hasRange)
        ? buildDatasetDrillFilter(state.drillRawRows?.[index], drillDims, state.dimensionFields ?? {}, runtimeFilter, rowRanges)
        : undefined;
    onDrill!({ dataset, groupKey, runtimeFilter, object: state.object, objectFilter });
  };

  const { measureField, headerLabel } = buildDatasetFieldHelpers(state.fields, state.object, fieldLabel);
  const columns = [...rows, ...values];
  // The rows as DISPLAYED (objectui#4330). Order and count are preserved, so
  // `state.rows[i]` / `drillRawRows[i]` stay index-aligned — which is what
  // keeps the drill payload below on the untranslated values. With no label
  // map this is `state.rows` ITSELF, the same array identity as before.
  const displayRows = relabelDimensions(state.rows, dimensionLabels);
  // Server-supplied grand total (`dimensions: []`); absent → no totals row.
  const grandTotal = withTotals
    ? state.totals?.find((t) => Array.isArray(t.dimensions) && t.dimensions.length === 0)?.rows?.[0]
    : undefined;
  const totalText = tt('report.total', 'Total');
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
          {displayRows.map((row, i) => (
            <tr
              key={i}
              className={`border-t${canDrill ? ` ${DRILL_CLASS}` : ''}`}
              data-testid={canDrill ? 'dataset-drill-row' : undefined}
              // The drill payload is built from the row AS THE SERVER SENT IT
              // (`state.rows[i]`), never from the displayed one: `groupKey` and
              // `objectFilter` are identity keys the host filters records with,
              // and translating those would address nothing (objectui#4263 /
              // #4273's convention, restated for #4330).
              onClick={canDrill ? () => drill(state.rows[i], i) : undefined}
            >
              {columns.map((c) => (
                <td key={c} className="px-2 py-1 tabular-nums whitespace-nowrap">
                  {values.includes(c)
                    ? formatMeasure(row[c], measureField(c)?.format, measureField(c)?.currency, measureField(c)?.percentScale, displayLocale)
                    : formatDimensionValue(row[c], displayLocale)}
                </td>
              ))}
            </tr>
          ))}
          {grandTotal && (
            <tr className="border-t bg-muted/30 font-medium" data-testid="dataset-report-total-row">
              {rows.length > 0 && (
                <td colSpan={rows.length} className="px-2 py-1 whitespace-nowrap">
                  {totalText}
                </td>
              )}
              {values.map((measure) => (
                <td key={measure} className="px-2 py-1 tabular-nums whitespace-nowrap">
                  {formatMeasure(grandTotal[measure], measureField(measure)?.format, measureField(measure)?.currency, measureField(measure)?.percentScale, displayLocale)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Resolve a report's declared `type` — the spec's `ReportType`
 * (`ui/report.zod.ts`: `tabular | summary | matrix | joined`) — to the
 * presentation it renders. The DECLARED type picks the branch; it is never
 * inferred from the data shape. Before this, `tabular` and `summary` shared
 * one branch and the visual difference was read off whether `rows` happened
 * to be non-empty — a `tabular` report that declared `rows` silently rendered
 * exactly like a `summary` (#2941). An absent/out-of-spec value falls back to
 * `tabular`, the spec's own declared default.
 *
 * Exported for the spec-parity test, which fails the moment `ReportType` and
 * this dispatch drift in either direction.
 */
export function resolveReportPresentation(type: unknown): 'tabular' | 'summary' | 'matrix' | 'joined' {
  switch (type) {
    case 'summary':
      return 'summary';
    case 'matrix':
      return 'matrix';
    case 'joined':
      return 'joined';
    case 'tabular':
    default:
      return 'tabular';
  }
}

/** How a report renders its embedded chart for one spec `ChartTypeSchema` value. */
export type ReportChartPlan =
  /** A categorical series the generic chart component draws distinctly. */
  | { kind: 'series'; chartType: string }
  /** Single-value family — one dimensionless dataset query, shown as a number. */
  | { kind: 'single_value' }
  /** Tabular family — the grouped table beneath IS the rendering; no duplicate chart. */
  | { kind: 'tabular' }
  /** Out-of-spec value (stored dialect / typo) — surfaced, never a silent bar. */
  | { kind: 'unsupported'; type: string };

/**
 * Classify a report chart type into its rendering plan — every value of the
 * spec's `ChartTypeSchema` (`ui/chart.zod.ts`, 19 names), each on the branch
 * its family demands. The old mapping collapsed 10 of the 19 to a BAR — a
 * plausible wrong picture with no warning (#2941). Now:
 *
 * - the 12 series families reach the generic chart component verbatim
 *   (`column` is its documented vertical-bar alias; `horizontal-bar` stays
 *   horizontal instead of silently flipping vertical);
 * - the single-value families (`gauge` / `solid-gauge` / `metric` / `kpi` /
 *   `bullet`) render the measure as a number — the spec's own comment calls
 *   them "honest single-value variants pending a real dial/target renderer";
 * - `table` / `pivot` add no duplicate chart: the grouped table that always
 *   renders beneath the chart slot is exactly the tabular presentation;
 * - anything else is out-of-spec and gets a visible notice.
 *
 * `combo` joined `ChartTypeSchema` in spec 17.0.0-rc.1 and routes as a series
 * chart. It was renderer-local until then — the chart renderer derives the base
 * family from the series — so nothing here classified it, and a spec-valid combo
 * report hit the out-of-spec notice the moment the spec started accepting one.
 *
 * Exported for the spec-parity test, which fails the moment `ChartTypeSchema`
 * and this classification drift in either direction.
 */
export function planReportChart(t: unknown): ReportChartPlan {
  switch (t) {
    case 'bar':
    case 'column':
    case 'horizontal-bar':
    case 'line':
    case 'area':
    case 'pie':
    case 'donut':
    case 'funnel':
    case 'scatter':
    case 'treemap':
    case 'sankey':
    case 'radar':
    case 'combo':
      return { kind: 'series', chartType: t };
    case 'gauge':
    case 'solid-gauge':
    case 'metric':
    case 'kpi':
    case 'bullet':
      return { kind: 'single_value' };
    case 'table':
    case 'pivot':
      return { kind: 'tabular' };
    default:
      return { kind: 'unsupported', type: String(t) };
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
 * The author's per-chart override for ONE measure's display name — the entry of
 * `chart.series[]` whose `name` IS that measure (objectui#4020, level ①).
 *
 * `ReportChartSchema.series[]` has declared `{ name, label? }` since rc.1, but
 * the renderer never read it: the chart was handed `series: [{ dataKey }]` with
 * no label at all, so an authored `label` was inert metadata and the measure
 * printed as its raw `name`. Declared is now enforced.
 *
 * The FIRST entry naming the measure wins, the same ruling the dashboard's
 * `mergeAuthoredPresentation` makes for its own `chartConfig.series` — a later
 * duplicate cannot silently re-label a series the author already described.
 *
 * `label` is the spec's `I18nLabel` (`string | { en, 'zh-CN', … }`), so it goes
 * through `pickLocalized`, the repo's one resolver for that shape — a
 * first-string-wins pick would put the English limb of a translated label on a
 * zh-CN console, which is the very defect class this card closes. An entry that
 * names the measure but carries no usable `label` returns `undefined` and falls
 * through to the dataset's own measure label, exactly as an absent entry does.
 */
function authoredSeriesLabel(series: unknown, measure: string, language: string | undefined): string | undefined {
  if (!Array.isArray(series) || !measure) return undefined;
  for (const entry of series as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const { name, label } = entry as { name?: unknown; label?: unknown };
    if (name !== measure) continue;
    return pickLocalized(label, language) || undefined;
  }
  return undefined;
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
 *
 * ## What reaches the chart component (objectui#4877 / objectui#4878)
 *
 * This slot forwarded exactly six keys — `chartType`, `data`, `height`,
 * `isAnimationActive`, `series`, `xAxisKey` — which made it the one dataset
 * chart surface that shared neither half of the ruled split:
 *
 *  - the DATA half now routes through `buildChartSeries` (objectui#4878), so the
 *    null-category family it owns is inherited rather than re-derived; the rows
 *    used to reach the renderer with a raw null category, which draws no mark;
 *  - the PRESENTATION half now routes through `chartConfigPresentation` +
 *    `mergeAuthoredSeries` (objectui#4877), so the chrome and per-series keys
 *    `ReportChartSchema` declares stop being inert metadata. `showLegend: false`
 *    was the sharpest of those: dropped, it read as absent, and absent means the
 *    legend is ON — the author's explicit value inverted in effect.
 *
 * Both helpers live in `@object-ui/core` beside each other, which is what keeps
 * this surface and the dashboard widget lowering ONE vocabulary once.
 */
function DatasetReportChart({
  dataset,
  chart,
  runtimeFilter,
  dataSource,
  order,
}: {
  dataset: string;
  chart: Record<string, unknown>;
  runtimeFilter?: Record<string, unknown>;
  dataSource?: unknown;
  order?: SelectionOrder;
}) {
  const xAxis = typeof chart.xAxis === 'string' ? chart.xAxis : '';
  const yAxis = typeof chart.yAxis === 'string' ? chart.yAxis : '';
  const plan = planReportChart(chart.type);
  // The chart plots a NARROWER selection than the table beneath it (one
  // dimension × one measure), so `useDatasetRows` scopes the report's order to
  // those two columns — a "biggest first" on the plotted measure still sorts
  // the bars; a key naming some other row dimension is simply not applicable
  // here and is dropped rather than posted and rejected.
  //
  // A single-value chart (metric / kpi / gauge…) instead queries the measure
  // with NO dimension: the server hands back its one pre-aggregated grand
  // total, so the number shown is governed by the semantic layer, never a
  // client-side recombination (the ADR-0021 red line). Plans that render no
  // chart at all select no measures, which parks the hook in `idle`.
  const wantsQuery = plan.kind === 'series' || plan.kind === 'single_value';
  const state = useDatasetRows(
    dataset,
    plan.kind === 'series' && xAxis ? [xAxis] : [],
    wantsQuery && yAxis ? [yAxis] : [],
    runtimeFilter,
    dataSource,
    undefined,
    order,
  );
  const ChartComponent = useRegistryComponent('chart');
  const { fieldLabel } = useSafeFieldLabel();
  // objectui#4878 — the null-category bucket's LABEL. `@object-ui/core` is
  // React-free and cannot read the locale bundle, so `buildChartSeries` falls
  // back to the English `NULL_CATEGORY_LABEL`; the resolved string has to come
  // from HERE, the layer that holds the provider (objectui#4500 made exactly
  // this division on the dashboard, and ObjectChart makes it too). Without it a
  // zh console would draw the bar — and label it `(None)`.
  const tt = useSafeTranslate();
  // objectui#4575 — the single-value metric below is a MEASURE like any other
  // and follows the display locale. (The series charts render their own labels
  // through the chart component, not through `formatMeasure`.)
  const displayLocale = useDisplayLocale();
  // objectui#4020 — the UI LANGUAGE an authored `series[].label` is picked in.
  // Deliberately not `displayLocale`: that one prefers the tenant's REGIONAL
  // locale (ADR-0053) because it feeds `Intl` number formatting, and a workspace
  // formatting numbers as `de-DE` while its console runs zh must still read the
  // zh limb of a translated label.
  const { language } = useObjectTranslation();
  // objectui#4330 — the embedded chart plots the SAME dimension the table
  // beneath it groups by, so it takes the same label map. Leaving it out would
  // put the two spellings of one value on one screen, which is the defect this
  // family exists to close.
  const chartDimensions = React.useMemo(() => (xAxis ? [xAxis] : []), [xAxis]);
  const dimensionLabels = useDatasetDimensionLabels(
    state.object,
    state.dimensionFields,
    chartDimensions,
  );

  const title = typeof chart.title === 'string' ? chart.title : undefined;

  // `table` / `pivot`: the grouped table rendered beneath this slot IS the
  // tabular presentation — a duplicate chart would say nothing new.
  if (plan.kind === 'tabular') return null;
  if (plan.kind === 'unsupported') {
    // Out-of-spec chart type in stored metadata: say so instead of drawing a
    // silently wrong bar (#2941). The table beneath still carries the numbers.
    return (
      <div
        className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
        data-testid="dataset-report-chart-unsupported"
      >
        Chart type &ldquo;{plan.type}&rdquo; is not a spec chart type — the grouped table below carries this report&rsquo;s numbers.
      </div>
    );
  }

  // A series chart needs both an x (dimension) and y (measure); a
  // single-value chart needs only the measure. Without them, skip.
  if (plan.kind === 'series' ? !xAxis || !yAxis : !yAxis) return null;
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading chart…
      </div>
    );
  }
  // On error or empty, fall back silently to the table beneath.
  if (state.status === 'error' || state.rows.length === 0) return null;

  const { measureField, headerLabel } = buildDatasetFieldHelpers(state.fields, state.object, fieldLabel);
  // The measure's display name, resolved ONCE for every branch below
  // (objectui#4020). Three levels, highest first:
  //
  //  1. `chart.series[]`'s entry naming this measure — the spec's own per-chart
  //     override (see `authoredSeriesLabel`);
  //  2. the bound dataset's `measures[].label`, which reaches the client as the
  //     result field's `label` — `headerLabel` reads exactly that (then the i18n
  //     field-label convention), so the chart and the summary table BENEATH IT
  //     print one string for one measure instead of two;
  //  3. the measure NAME, `headerLabel`'s own last resort.
  //
  // Level ② is what the dashboard's `buildChartSeries` already did for its own
  // chart series (`fields[].label`), and what the table here has always done;
  // the report chart was the one surface that consulted neither and shipped the
  // raw `name` to a fully-translated console.
  const measureLabel = authoredSeriesLabel(chart.series, yAxis, language) ?? headerLabel(yAxis);

  if (plan.kind === 'single_value') {
    const mf = measureField(yAxis);
    return (
      <div className="rounded-md border bg-card p-3" data-testid="dataset-report-metric">
        {title ? <h3 className="mb-2 text-sm font-semibold">{title}</h3> : null}
        <div className="flex flex-col gap-0.5 py-2">
          <span className="text-2xl font-semibold tabular-nums">
            {formatMeasure(state.rows[0]?.[yAxis], mf?.format, mf?.currency, mf?.percentScale, displayLocale)}
          </span>
          <span className="text-xs text-muted-foreground">{measureLabel}</span>
        </div>
      </div>
    );
  }

  // The chart component is registered lazily; until it resolves render nothing
  // (the grouped table beneath still shows the exact numbers).
  if (!ChartComponent) return null;

  // ── The DATA half: derived from the selection, never authored (#4229) ─────
  //
  // objectui#4878 — the rows and the series binding come from the SHARED
  // derivation every other dataset chart surface uses. This path used to hand
  // `relabelDimensions(state.rows, …)` straight to the renderer, which is the
  // pre-#4466 answer: a null dimension value reached the chart raw and drew NO
  // MARK, so the report silently understated its own data (#4466 measured the
  // dominant group vanishing while the y-axis still accommodated it). Every
  // property of that family — the bucket itself (#4466), its localized label
  // (#4500), and the identity that keeps a stored `'(None)'` apart from the
  // null group (#4508) — is a property of `buildChartSeries`, so it arrives
  // here by inheritance rather than by a third re-derivation.
  //
  // The selection is exactly one dimension × one measure, so this takes the
  // helper's single-dimension branch and returns ONE series; the pivot branch
  // (2+ dimensions) is unreachable from a report chart, whose schema declares a
  // single `xAxis`/`yAxis` pair.
  const { data: chartData, xAxisKey, series: derivedSeries } = buildChartSeries(
    relabelDimensions(state.rows, dimensionLabels),
    [xAxis],
    [yAxis],
    state.fields,
    { nullCategoryLabel: tt('chart.nullCategory', '(None)') },
  );

  // ── The PRESENTATION half: authored, merged forward (#4229) ──────────────
  //
  // objectui#4877 — `ReportChartSchema` declares per-series `color`/`stack`/
  // `type`/`yAxis`/`dashArray`/`opacity`/`variant`, and this path forwarded
  // none of them. `mergeAuthoredSeries` is the same merge the dashboard makes
  // over the same spec shape, matched by `series[].name` → derived `dataKey`,
  // so membership stays with the dataset: an entry naming a measure this chart
  // does not plot is ignored.
  //
  // Deliberately NOT `mergeAuthoredPresentation`: that entry point also reads
  // `xAxis`/`yAxis` as spec `ChartAxis` OBJECTS, and on THIS surface they are
  // bare dimension/measure name strings — the selection itself. Feeding them to
  // it would return `axes.yAxis = [{}]`, one empty entry, and the COUNT of
  // y-axis entries is what declares a secondary axis. The series-only entry
  // point makes that unreachable by construction rather than by a guard.
  const authoredSeries = mergeAuthoredSeries(derivedSeries, chart.series);
  // #4020's three-level display name OUTRANKS both of the labels above: the
  // derivation's `fields[].label` (level ② without the i18n field-label
  // convention `headerLabel` applies) and `mergeAuthoredSeries`' own pick,
  // which resolves an `{ en, 'zh-CN' }` label first-string-wins because core
  // holds no provider — the very thing that would paint English on a zh
  // console. `measureLabel` already resolved ① through `pickLocalized` and ②
  // through `headerLabel`, so it wins outright.
  const chartSeries = authoredSeries.map((s) =>
    s.dataKey === yAxis ? { ...s, label: measureLabel } : s,
  );

  // The authored CHROME — `showLegend`, `showDataLabels`, `colors`, `subtitle`,
  // `description`, `annotations`, `interaction`, `height` — lowered by the same
  // whitelist the dashboard uses (objectui#4877). `showLegend: false` was not
  // merely dropped before but INVERTED in effect: `AdvancedChartImpl` computes
  // `legendVisible = showLegend !== false`, so an absent value means the legend
  // is on and the author's explicit `false` drew one anyway.
  //
  // `title` is dropped from the result on purpose: this renderer paints the
  // report chart's title itself, as the `h3` below, and forwarding it as well
  // would draw a SECOND one inside the chart's own frame. `aria` is not lowered
  // by the whitelist at all — nothing on this path reads it (see that helper's
  // header for the ruling and where it is tracked).
  const { title: _chartOwnTitle, ...chrome } = chartConfigPresentation(chart);

  return (
    <div className="rounded-md border bg-card p-3" data-testid="dataset-report-chart">
      {title ? <h3 className="mb-2 text-sm font-semibold">{title}</h3> : null}
      {/* eslint-disable-next-line react-hooks/static-components -- ChartComponent is a stable registry lookup (useRegistryComponent), not a component created during render */}
      <ChartComponent
        schema={{
          chartType: plan.chartType,
          data: chartData,
          xAxisKey,
          // One series, carrying its display name. `ChartRenderer` turns a
          // series `label` into `config[dataKey].label`, which is the single
          // input the legend, the mark's tooltip name and the single-value
          // caption all read — so legend and tooltip follow this by
          // construction rather than by a second resolution.
          series: chartSeries,
          // The default plot height, kept beneath the spread so an authored
          // `height` wins. A non-positive one never reaches here (the whitelist
          // drops it), which leaves this default rather than an invisible plot.
          height: 280,
          // Render deterministically (no rAF entrance animation): reports are
          // often viewed in a background tab or exported, where an animated
          // chart freezes at frame 0 (pie/donut would show no ring).
          isAnimationActive: false,
          ...chrome,
        }}
      />
    </div>
  );
}

/**
 * Stable bucket id for a dimension-value tuple — the id every lookup in the
 * cross-tab below is keyed by (row headers, column headers, and both subtotal
 * maps), so they all agree by construction.
 *
 * The values go through `pivotBucketId` (shared with the dashboard's pivot)
 * rather than being concatenated: this used to `join('')`, which left NO
 * boundary at all between adjacent values, so `'x'` + `'yz'` and `'xy'` + `'z'`
 * were one bucket and the later row overwrote the earlier one
 * (objectstack#5665; objectstack#5473 is the same defect in the dashboard).
 *
 * Each value is normalized by `pivotDimensionValue`, so an absent one encodes
 * as JSON `null`. It used to be spelled `String(row[d] ?? '∅')`, which put an
 * ordinary string in the tuple and merged a null value with a value that
 * literally IS that character — the encoder's own assumption ("no value spells
 * this") reintroduced by its caller (objectui#4056).
 */
function bucketId(dims: string[], row: Row): string {
  return pivotBucketId(dims.map((d) => pivotDimensionValue(row[d])));
}

/**
 * `locale` is the display-locale tag the bucket's numeric values are formatted
 * in (objectui#4575) — this is a plain function, not a component, so it cannot
 * read `useDisplayLocale()` itself and the caller threads it. It affects the
 * human-readable LABEL only; the matching bucket `id` comes from
 * {@link bucketId}, which is built from the RAW values and is deliberately
 * untouched by the locale, so a locale change can never re-key a cell (which
 * would break the `cells` lookup and drill-through with it).
 */
function bucketLabel(dims: string[], row: Row, locale?: string): string {
  return dims.map((d) => formatDimensionValue(row[d], locale)).join(' / ');
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
  order,
}: {
  dataset: string;
  rows: string[];
  columnsAcross: string[];
  values: string[];
  runtimeFilter?: Record<string, unknown>;
  dataSource?: unknown;
  onDrill?: (args: DatasetDrillArgs) => void;
  order?: SelectionOrder;
}) {
  // Row subtotals, column subtotals, and the grand total ([]), in that order.
  //
  // #3916: the ordering rides on the PRIMARY query only — the server drops it
  // for the totals sub-queries by design (a total covers the whole selection,
  // and an order key may name a dimension the totals grouping doesn't have).
  // The across-axis header sequence follows from it: `pivot` below collects
  // `colHeaders` in row-ARRIVAL order, so ordering the rows by the across
  // dimension is what makes the columns read left-to-right in that order.
  const state = useDatasetRows(
    dataset,
    [...rows, ...columnsAcross],
    values,
    runtimeFilter,
    dataSource,
    [rows, columnsAcross, []],
    order,
  );
  const tt = useSafeTranslate();
  const { fieldLabel } = useSafeFieldLabel();
  // objectui#4575 — the display locale every measure and dimension value here
  // is formatted in. Unlike the flat table above, this component formats inside
  // a `useMemo` (the header labels `bucketLabel` builds), so the locale also
  // joins that memo's dependency array — threading it into the call alone would
  // leave the headers frozen in the locale they were first built with.
  const displayLocale = useDisplayLocale();
  // objectui#4330 — both axes' dimensions, one read (see the flat table above).
  const dimensionLabels = useDatasetDimensionLabels(state.object, state.dimensionFields, [
    ...rows,
    ...columnsAcross,
  ]);

  const pivot = React.useMemo(() => {
    if (state.status !== 'ok') return null;
    // `key` is the RAW bucket (drill identity); `display` is the same bucket as
    // it reads on screen, per dimension — the two are deliberately separate
    // (objectui#4330).
    const rowHeaders: Array<{ id: string; label: string; key: Row; display: Row }> = [];
    const colHeaders: Array<{ id: string; label: string; key: Row; display: Row }> = [];
    const seenRow = new Set<string>();
    const seenCol = new Set<string>();
    const cells = new Map<string, { row: Row; index: number }>();
    // Bucket ids and header labels come from the DISPLAY rows so both axes read
    // the localized label; the `key` a drill click carries comes from the RAW
    // row beside it, because that one addresses records (objectui#4263/#4273).
    // Index alignment across the two arrays is guaranteed by
    // `relabelDimensions`, which preserves order and count.
    const displayRows = relabelDimensions(state.rows, dimensionLabels);
    displayRows.forEach((r, index) => {
      const raw = state.rows[index];
      const rid = bucketId(rows, r);
      const cid = bucketId(columnsAcross, r);
      if (!seenRow.has(rid)) {
        seenRow.add(rid);
        const key: Row = {};
        const display: Row = {};
        for (const d of rows) { key[d] = raw[d]; display[d] = r[d]; }
        rowHeaders.push({ id: rid, label: bucketLabel(rows, r, displayLocale), key, display });
      }
      if (!seenCol.has(cid)) {
        seenCol.add(cid);
        const key: Row = {};
        const display: Row = {};
        for (const d of columnsAcross) { key[d] = raw[d]; display[d] = r[d]; }
        colHeaders.push({ id: cid, label: bucketLabel(columnsAcross, r, displayLocale), key, display });
      }
      // Keyed by pivotCellKey, not `${rid} ${cid}`: a plain space is a boundary
      // only while no dimension value contains one, and they do constantly
      // ("New York", "In Progress"). `index` is also what drill-through reads
      // `drillRawRows` by, so a merged key drilled to the wrong records too.
      // The cell holds MEASURES, which no relabel touches — so it keeps the
      // server's own row.
      cells.set(pivotCellKey(rid, cid), { row: raw, index });
    });
    return { rowHeaders, colHeaders, cells };
    // `displayLocale` is load-bearing here, not decorative: the header labels
    // above are built inside this memo (objectui#4575). Measured — with the
    // locale threaded into `bucketLabel` but absent from these deps, a session
    // that switches locale without refetching keeps the previous locale's
    // headers, and the pin for that is the "re-labels the across header when
    // only the locale changes" case in DatasetReportRenderer.measureLocale.test.tsx.
  }, [state, rows, columnsAcross, dimensionLabels, displayLocale]);

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
    // #1752: include the date-bucket range sidecar so an "X by time" cell scopes
    // to the clicked time bucket, not every bucket in that row/column.
    const cellRanges = state.drillRanges?.[index];
    const hasRange = !!cellRanges && Object.keys(cellRanges).length > 0;
    const objectFilter =
      state.object && (drillDims.length > 0 || hasRange)
        ? buildDatasetDrillFilter(state.drillRawRows?.[index], drillDims, state.dimensionFields ?? {}, runtimeFilter, cellRanges)
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
  //
  // The totals carry dimension values too, so they take the SAME relabel the
  // display rows took (objectui#4330 — the dashboard pivot does this for the
  // same reason, #4263): both sides of the lookup must speak one vocabulary,
  // or a zh-CN matrix would read 国内 down the side while the row-total lookup
  // still asked for `Domestic` and every total cell fell back to blank.
  const findTotals = (dims: string[]) => {
    const totalRows = state.totals?.find(
      (t) => Array.isArray(t.dimensions) && t.dimensions.join(',') === dims.join(','),
    )?.rows;
    return totalRows ? relabelDimensions(totalRows, dimensionLabels) : totalRows;
  };
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
                  {formatDimensionValue(rh.display[d], displayLocale)}
                </td>
              ))}
              {cellCols.map((cc) => {
                const entry = pivot.cells.get(pivotCellKey(rh.id, cc.col.id));
                const value = entry?.row[cc.measure];
                const clickable = canDrill && entry != null;
                return (
                  <td
                    key={`${cc.col.id}-${cc.measure}`}
                    className={`px-2 py-1 text-right tabular-nums whitespace-nowrap${clickable ? ` ${DRILL_CLASS}` : ''}`}
                    data-testid={clickable ? 'dataset-drill-cell' : undefined}
                    onClick={clickable ? () => drillCell(rh.key, cc.col.key, entry!.index) : undefined}
                  >
                    {formatMeasure(value, measureField(cc.measure)?.format, measureField(cc.measure)?.currency, measureField(cc.measure)?.percentScale, displayLocale)}
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
                    {formatMeasure(rowTotalById.get(rh.id)?.[measure], measureField(measure)?.format, measureField(measure)?.currency, measureField(measure)?.percentScale, displayLocale)}
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
                  {formatMeasure(colTotalById.get(cc.col.id)?.[cc.measure], measureField(cc.measure)?.format, measureField(cc.measure)?.currency, measureField(cc.measure)?.percentScale, displayLocale)}
                </td>
              ))}
              {showTotalCol &&
                values.map((measure) => (
                  <td
                    key={`grand-${measure}`}
                    className="px-2 py-1 text-right tabular-nums whitespace-nowrap"
                    data-testid="matrix-grand-total"
                  >
                    {formatMeasure(grandTotal?.[measure], measureField(measure)?.format, measureField(measure)?.currency, measureField(measure)?.percentScale, displayLocale)}
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
  // objectui#5137 — `runtimeFilter` ONLY. `filter` is rejected by the strict
  // spec, so it is not read here either; it is reported instead of applied.
  const reportSite = describeReportSite(report);
  warnOnRejectedFilterAlias(report, reportSite);
  const outerFilter = mergeFilters(report.runtimeFilter, runtimeFilter);
  // ADR-0021 D2: `drilldown` defaults on; the host must still supply a sink.
  const drillSink = report.drilldown === false ? undefined : onDrill;
  // The DECLARED type drives the branch (#2941) — never the data shape.
  const presentation = resolveReportPresentation(report.type);

  // Joined → a vertical stack of dataset-bound blocks.
  if (presentation === 'joined' && Array.isArray(report.blocks)) {
    return (
      <div
        className={className}
        data-testid="dataset-joined-report"
        data-report-name={report.name}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {report.blocks.map((block, index) => {
          // objectui#5137 — same rule per block: `runtimeFilter` only.
          warnOnRejectedFilterAlias(block, `${reportSite} block \`${block.name ?? index}\``);
          const blockFilter = mergeFilters(outerFilter, block.runtimeFilter);
          const blockAcross = readNames(block.columns);
          // #3916 — each block orders ITSELF. A joined container selects nothing
          // of its own (the schema rejects `order` on it), and every block is an
          // independent query over its own dataset, so there is no report-level
          // ordering to inherit here.
          const blockOrder = readOrder(block.order);
          // Same type-driven dispatch as the top level: a block's declared
          // type picks its presentation (`JoinedReportBlockSchema.type`
          // defaults to `tabular`). A grouped block (summary, or a matrix
          // without across-dimensions) carries the totals footer.
          const blockPresentation = resolveReportPresentation(block.type);
          const blockTable = blockPresentation === 'matrix' && blockAcross.length > 0 ? (
            <DatasetMatrixTable
              dataset={String(block.dataset ?? '')}
              rows={readNames(block.rows)}
              columnsAcross={blockAcross}
              values={readNames(block.values)}
              runtimeFilter={blockFilter}
              dataSource={dataSource}
              onDrill={drillSink}
              order={blockOrder}
            />
          ) : (
            <DatasetReportTable
              dataset={String(block.dataset ?? '')}
              rows={readNames(block.rows)}
              values={readNames(block.values)}
              runtimeFilter={blockFilter}
              dataSource={dataSource}
              onDrill={drillSink}
              order={blockOrder}
              withTotals={blockPresentation === 'summary' || blockPresentation === 'matrix'}
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
  const reportOrder = readOrder(report.order);
  // Matrix with an across dimension → true cross-tab; without one it
  // degrades to the grouped (summary) table (pre-`columns` stored JSON).
  if (presentation === 'matrix' && across.length > 0) {
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
          order={reportOrder}
        />
      </div>
    );
  }

  // summary → grouped table with the server-computed totals footer;
  // tabular → the same selection as a simple list, no totals (the declared
  // type is what separates them, #2941). A matrix without `columns` degrades
  // to the summary presentation — it is a grouped type. Either is preceded by
  // the embedded chart visualization when the report declares one (ADR-0021:
  // the chart plots the dataset's yAxis measure across the xAxis dimension;
  // the table beneath always carries the exact numbers).
  const chartCfg =
    report.chart && typeof report.chart === 'object' && (report.chart as { type?: unknown }).type
      ? (report.chart as Record<string, unknown>)
      : null;
  return (
    <div
      className={`${className ?? ''} flex flex-col gap-3`}
      data-testid="dataset-report"
      data-report-name={report.name}
      data-report-presentation={presentation}
    >
      {chartCfg ? (
        <DatasetReportChart
          dataset={String(report.dataset ?? '')}
          chart={chartCfg}
          runtimeFilter={outerFilter}
          dataSource={dataSource}
          order={reportOrder}
        />
      ) : null}
      <DatasetReportTable
        dataset={String(report.dataset ?? '')}
        rows={readNames(report.rows)}
        values={readNames(report.values)}
        runtimeFilter={outerFilter}
        dataSource={dataSource}
        onDrill={drillSink}
        order={reportOrder}
        withTotals={presentation === 'summary' || presentation === 'matrix'}
      />
    </div>
  );
};
