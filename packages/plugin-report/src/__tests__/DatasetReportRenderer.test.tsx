/**
 * DatasetReportRenderer tests (ADR-0021 single-form).
 *
 * Covers:
 *  - isDatasetReport guard (dataset-bound report / joined-with-dataset-blocks)
 *  - summary report → grouped table via dataSource.queryDataset
 *  - joined report → one dataset-bound table per block
 *  - report-level runtimeFilter merged into the dataset query
 *  - missing queryDataset → a clear error instead of a blank
 *  - matrix → true rows × columns cross-tab (ADR-0021 D2)
 *  - matrix totals: requests `totals.groupings` [rows, columns, []] and
 *    renders the SERVER-supplied subtotals/grand total; no totals in the
 *    response (older server) → no totals UI (never re-aggregated client-side)
 *  - drill-down: clickable rows/cells emit {dataset, groupKey, runtimeFilter}
 *  - ordering (framework#3916): `report.order` / `blocks[].order` lowered onto
 *    the selection, scoped per sub-selection, and part of the refetch key
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '@object-ui/i18n';
import { DatasetReportRenderer, isDatasetReport } from '../DatasetReportRenderer';

type MockRows = Array<Record<string, unknown>>;
type MockField = { name: string; type?: string; label?: string; format?: string; currency?: string };
type MockResult = {
  rows: MockRows;
  fields?: MockField[];
  object?: string;
  dimensionFields?: Record<string, string>;
  drillRawRows?: MockRows;
  drillRanges?: Array<Record<string, { field: string; gte: unknown; lt: unknown }>>;
  totals?: Array<{ dimensions: string[]; rows: MockRows }>;
};

function makeSource(byDataset: Record<string, MockRows | MockResult>) {
  const calls: Array<{ dataset: string; selection: any }> = [];
  return {
    calls,
    queryDataset: vi.fn(async (dataset: string, selection: unknown) => {
      calls.push({ dataset, selection: selection as any });
      const entry = byDataset[dataset];
      if (Array.isArray(entry)) return { rows: entry };
      return {
        rows: entry?.rows ?? [],
        ...(entry?.fields ? { fields: entry.fields } : {}),
        ...(entry?.object ? { object: entry.object } : {}),
        ...(entry?.dimensionFields ? { dimensionFields: entry.dimensionFields } : {}),
        ...(entry?.drillRawRows ? { drillRawRows: entry.drillRawRows } : {}),
        ...(entry?.drillRanges ? { drillRanges: entry.drillRanges } : {}),
        ...(entry?.totals ? { totals: entry.totals } : {}),
      };
    }),
  };
}

describe('isDatasetReport', () => {
  it('matches a report bound to a dataset', () => {
    expect(isDatasetReport({ name: 'r', dataset: 'task_metrics', values: ['c'] })).toBe(true);
  });
  it('matches a joined report whose blocks are dataset-bound', () => {
    expect(isDatasetReport({ type: 'joined', blocks: [{ dataset: 'task_metrics', values: ['c'] }] })).toBe(true);
  });
  it('does not match a legacy object-bound report', () => {
    expect(isDatasetReport({ name: 'r', objectName: 'task', columns: [{ field: 'x' }] })).toBe(false);
    expect(isDatasetReport(null)).toBe(false);
  });
});

describe('DatasetReportRenderer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a summary report as a grouped table', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }, { status: 'Done', est_hours: 24 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'hours', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    // headers are the row + value names
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('est_hours')).toBeInTheDocument();
    expect(src.queryDataset).toHaveBeenCalledWith('task_metrics', expect.objectContaining({
      dimensions: ['status'], measures: ['est_hours'],
    }));
  });

  it('renders a joined report as one table per block', async () => {
    const src = makeSource({ task_metrics: [{ status: 'To Do', task_count: 4 }] });
    render(
      <DatasetReportRenderer
        report={{
          name: 'overview', type: 'joined',
          blocks: [
            { name: 'open_block', label: 'Open Tasks', dataset: 'task_metrics', rows: ['status'], values: ['task_count'], runtimeFilter: { done: false } },
            { name: 'done_block', label: 'Completed Tasks', dataset: 'task_metrics', rows: ['status'], values: ['task_count'], runtimeFilter: { done: true } },
          ],
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Open Tasks')).toBeInTheDocument());
    expect(screen.getByText('Completed Tasks')).toBeInTheDocument();
    expect(screen.getAllByTestId('dataset-report-block')).toHaveLength(2);
    // each block forwards its own runtimeFilter
    expect(src.queryDataset).toHaveBeenCalledWith('task_metrics', expect.objectContaining({ runtimeFilter: { done: false } }));
    expect(src.queryDataset).toHaveBeenCalledWith('task_metrics', expect.objectContaining({ runtimeFilter: { done: true } }));
  });

  it('merges the report-level runtimeFilter into the dataset query', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', task_count: 1 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['task_count'] }}
        dataSource={src}
        runtimeFilter={{ owner: 'me' }}
      />,
    );
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    expect(src.calls[0].selection.runtimeFilter).toMatchObject({ owner: 'me' });
  });

  it('pivots a matrix report into a rows × columns cross-tab (ADR-0021 D2)', async () => {
    const src = makeSource({
      task_metrics: [
        { status: 'Backlog', priority: 'High', est_hours: 10 },
        { status: 'Backlog', priority: 'Low', est_hours: 20 },
        { status: 'Done', priority: 'High', est_hours: 14 },
      ],
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // One query over ALL dimensions (down + across).
    expect(src.queryDataset).toHaveBeenCalledWith('task_metrics', expect.objectContaining({
      dimensions: ['status', 'priority'], measures: ['est_hours'],
    }));
    // Across buckets become column headers (single measure → bucket label only).
    expect(screen.getByRole('columnheader', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Low' })).toBeInTheDocument();
    // Cells land at row × column intersections; missing pairs render '—'.
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // Done × Low has no bucket
  });

  it('matrix requests server-side totals groupings: [rows, columns, []]', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', priority: 'High', est_hours: 10 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    expect(src.calls[0].selection.totals).toEqual({ groupings: [['status'], ['priority'], []] });
  });

  it('matrix renders server-supplied totals: row subtotal column, totals row, grand total', async () => {
    const src = makeSource({
      task_metrics: {
        rows: [
          { status: 'Backlog', priority: 'High', est_hours: 10 },
          { status: 'Backlog', priority: 'Low', est_hours: 20 },
          { status: 'Done', priority: 'High', est_hours: 14 },
        ],
        totals: [
          { dimensions: ['status'], rows: [{ status: 'Backlog', est_hours: 30 }, { status: 'Done', est_hours: 14 }] },
          { dimensions: ['priority'], rows: [{ priority: 'High', est_hours: 24 }, { priority: 'Low', est_hours: 20 }] },
          { dimensions: [], rows: [{ est_hours: 44 }] },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // Trailing "Total" column header (single measure → plain label).
    expect(screen.getByTestId('matrix-total-col-header')).toHaveTextContent('Total');
    // Per-row subtotals, matched to row headers by bucketId.
    expect(screen.getAllByTestId('matrix-row-total').map((el) => el.textContent)).toEqual(['30', '14']);
    // Totals row: per-column subtotals in cellCols order (High, Low).
    const totalRow = screen.getByTestId('matrix-total-row');
    expect(totalRow).toHaveTextContent('Total');
    expect(totalRow).toHaveTextContent('24');
    expect(totalRow).toHaveTextContent('20');
    // Grand total ([] grouping) sits at the totals row × Total column corner.
    expect(screen.getByTestId('matrix-grand-total')).toHaveTextContent('44');
  });

  it('matrix keeps a null bucket apart from the literal placeholder character, on BOTH axes (objectui#4056)', async () => {
    // The last encoding in this family that relied on "the data will not
    // contain this character": `bucketId` fed `String(row[d] ?? '∅')` into the
    // JSON encoder, so an unset dimension became the STRING "∅" and collided
    // with a row whose value literally IS that character — one bucket, the later
    // row overwriting the earlier one (the objectstack#5473 symptom class,
    // reached through the placeholder). An empty value is now JSON `null`.
    //
    // Both axes in one fixture because this renderer keys row headers, column
    // headers, cells and BOTH subtotal maps off the same `bucketId`.
    const src = makeSource({
      task_metrics: {
        rows: [
          { status: null, priority: null, est_hours: 1 },
          { status: null, priority: '∅', est_hours: 2 },
          { status: '∅', priority: null, est_hours: 3 },
          { status: '∅', priority: '∅', est_hours: 4 },
        ],
        totals: [
          { dimensions: ['status'], rows: [{ status: null, est_hours: 10 }, { status: '∅', est_hours: 20 }] },
          { dimensions: ['priority'], rows: [{ priority: null, est_hours: 30 }, { priority: '∅', est_hours: 40 }] },
          { dimensions: [], rows: [{ est_hours: 50 }] },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());

    // Four distinct (row, column) combinations → four cells, none overwritten.
    // Display layer untouched: null still renders as the em dash
    // `formatDimensionValue` has always produced, the literal character as
    // itself — the placeholders only ever entered the ids.
    const matrix = screen.getByTestId('dataset-matrix');
    const bodyRows = [...matrix.querySelectorAll('tbody tr')];
    expect(bodyRows.slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent))).toEqual([
      ['—', '1', '2', '10'],
      ['∅', '3', '4', '20'],
    ]);
    // Column headers split the same way, and each column subtotal lands under
    // ITS OWN header — the card's radius: header ids and `colTotalById` keys are
    // built by the same expression and must change together.
    expect(screen.getByRole('columnheader', { name: '—' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '∅' })).toBeInTheDocument();
    const totalRow = screen.getByTestId('matrix-total-row');
    expect([...totalRow.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['Total', '30', '40', '50']);
  });

  it('matrix degrades gracefully when the server returns no totals (older server)', async () => {
    const src = makeSource({
      task_metrics: [
        { status: 'Backlog', priority: 'High', est_hours: 10 },
        { status: 'Done', priority: 'High', est_hours: 14 },
      ],
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    expect(screen.queryByTestId('matrix-total-col-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('matrix-row-total')).not.toBeInTheDocument();
    expect(screen.queryByTestId('matrix-total-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('matrix-grand-total')).not.toBeInTheDocument();
  });

  it('matrix without `columns` degrades to the flat grouped table', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', priority: 'High', est_hours: 10 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status', 'priority'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    expect(screen.queryByTestId('dataset-matrix')).not.toBeInTheDocument();
  });

  it('drill: clicking a grouped row emits dataset + dimension groupKey + scope filter', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['est_hours'] }}
        dataSource={src}
        runtimeFilter={{ owner: 'me' }}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-drill-row')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dataset-drill-row'));
    expect(onDrill).toHaveBeenCalledWith({
      dataset: 'task_metrics',
      groupKey: { status: 'Backlog' },
      runtimeFilter: { owner: 'me' },
    });
  });

  it('drill: clicking a matrix cell emits row + across dimension values', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', priority: 'High', est_hours: 10 }] });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    fireEvent.click(screen.getAllByTestId('dataset-drill-cell')[0]);
    expect(onDrill).toHaveBeenCalledWith(expect.objectContaining({
      dataset: 'task_metrics',
      groupKey: { status: 'Backlog', priority: 'High' },
    }));
  });

  it('drilldown: false disables row clicks even with an onDrill sink', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['est_hours'], drilldown: false }}
        dataSource={src}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    expect(screen.queryByTestId('dataset-drill-row')).not.toBeInTheDocument();
  });

  // ── label headers ────────────────────────────────────────────────────────
  it('renders the dataset display label for headers, not the raw field name', async () => {
    const src = makeSource({
      task_metrics: {
        rows: [{ status: 'Backlog', task_count: 4 }],
        object: 'task',
        fields: [
          { name: 'status', type: 'string', label: 'Stage' },
          { name: 'task_count', type: 'number', label: 'Tasks' },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['task_count'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    // Headers use the server field label, not the raw name.
    expect(screen.getByRole('columnheader', { name: 'Stage' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'task_count' })).not.toBeInTheDocument();
  });

  it('falls back to the raw field name when the result carries no field labels', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', task_count: 4 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['task_count'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    expect(screen.getByRole('columnheader', { name: 'status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'task_count' })).toBeInTheDocument();
  });

  it('uses the dataset display label for matrix row + measure headers', async () => {
    const src = makeSource({
      task_metrics: {
        rows: [{ status: 'Backlog', priority: 'High', est_hours: 10, billed: 5 }],
        object: 'task',
        fields: [
          { name: 'status', type: 'string', label: 'Stage' },
          { name: 'priority', type: 'string', label: 'Priority' },
          { name: 'est_hours', type: 'number', label: 'Estimated Hours' },
          { name: 'billed', type: 'number', label: 'Billed Hours' },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours', 'billed'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // Row-dimension header uses the field label (was Title-Cased name before).
    expect(screen.getByRole('columnheader', { name: 'Stage' })).toBeInTheDocument();
    // Multi-measure cell header reads "<bucket> · <measure label>", not the raw name.
    expect(screen.getByRole('columnheader', { name: 'High · Estimated Hours' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'High · Billed Hours' })).toBeInTheDocument();
  });

  // ── currency-aware measure formatting ──────────────────────────────────────
  it('formats an amount with NO declared currency as a plain number (no $)', async () => {
    const src = makeSource({
      revenue_metrics: {
        rows: [{ region: 'East', revenue: 1234 }],
        fields: [
          { name: 'region', type: 'string', label: 'Region' },
          { name: 'revenue', type: 'number', label: 'Revenue', format: '0,0' },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'revenue_metrics', rows: ['region'], values: ['revenue'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('East')).toBeInTheDocument());
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.queryByText('$1,234')).not.toBeInTheDocument();
  });

  it('uses the declared currency (Intl symbol) for measure cells', async () => {
    const src = makeSource({
      revenue_metrics: {
        rows: [{ region: 'East', revenue: 1234 }],
        fields: [
          { name: 'region', type: 'string', label: 'Region' },
          { name: 'revenue', type: 'number', label: 'Revenue', format: '0,0', currency: 'CNY' },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'revenue_metrics', rows: ['region'], values: ['revenue'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('East')).toBeInTheDocument());
    // Intl renders CNY with the ¥ symbol — never a bare number, never a wrong $.
    const cell = screen.getByText((t) => t.includes('1,234') && /[¥￥]|CN¥/.test(t));
    expect(cell).toBeInTheDocument();
  });

  it('formats matrix cells + server totals with the measure currency', async () => {
    const src = makeSource({
      revenue_metrics: {
        rows: [{ region: 'East', segment: 'SMB', revenue: 1000 }],
        object: 'deal',
        fields: [
          { name: 'region', type: 'string', label: 'Region' },
          { name: 'segment', type: 'string', label: 'Segment' },
          { name: 'revenue', type: 'number', label: 'Revenue', format: '0,0', currency: 'USD' },
        ],
        totals: [
          { dimensions: ['region'], rows: [{ region: 'East', revenue: 1000 }] },
          { dimensions: ['segment'], rows: [{ segment: 'SMB', revenue: 1000 }] },
          { dimensions: [], rows: [{ revenue: 1000 }] },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'revenue_metrics', rows: ['region'], columns: ['segment'], values: ['revenue'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // Both the body cell and the server-supplied row subtotal carry the $ symbol.
    expect(screen.getByTestId('matrix-row-total')).toHaveTextContent('$1,000');
    expect(screen.getByTestId('matrix-grand-total')).toHaveTextContent('$1,000');
  });

  // ── i18n ───────────────────────────────────────────────────────────────────
  it('renders the English fallback for the totals label with no i18n provider', async () => {
    const src = makeSource({
      task_metrics: {
        rows: [{ status: 'Backlog', priority: 'High', est_hours: 10 }],
        totals: [
          { dimensions: ['status'], rows: [{ status: 'Backlog', est_hours: 10 }] },
          { dimensions: ['priority'], rows: [{ priority: 'High', est_hours: 10 }] },
          { dimensions: [], rows: [{ est_hours: 10 }] },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // graceful fallback → the English default, never a raw "report.total" key.
    expect(screen.getByTestId('matrix-total-col-header')).toHaveTextContent('Total');
    expect(screen.getByTestId('matrix-total-row')).toHaveTextContent('Total');
    expect(screen.queryByText('report.total')).not.toBeInTheDocument();
  });

  it('uses the mounted i18n translation for the totals label (zh → 总计)', async () => {
    const src = makeSource({
      task_metrics: {
        rows: [{ status: 'Backlog', priority: 'High', est_hours: 10 }],
        totals: [
          { dimensions: ['status'], rows: [{ status: 'Backlog', est_hours: 10 }] },
          { dimensions: ['priority'], rows: [{ priority: 'High', est_hours: 10 }] },
          { dimensions: [], rows: [{ est_hours: 10 }] },
        ],
      },
    });
    render(
      <I18nProvider config={{ defaultLanguage: 'zh', detectBrowserLanguage: false }}>
        <DatasetReportRenderer
          report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
          dataSource={src}
        />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // report.total resolves to its zh bundle value — the provider wins over the
    // English fallback, and never leaks the raw key.
    expect(screen.getByTestId('matrix-total-col-header')).toHaveTextContent('总计');
    expect(screen.getByTestId('matrix-total-row')).toHaveTextContent('总计');
    expect(screen.queryByText('report.total')).not.toBeInTheDocument();
  });

  // ── raw-value drill (ADR-0021 D2) ──────────────────────────────────────────
  it('drill: emits object + raw objectFilter (stored value, not display label)', async () => {
    const src = makeSource({
      task_metrics: {
        rows: [{ status: 'In Progress', est_hours: 30 }],
        object: 'task',
        dimensionFields: { status: 'status' },
        // the visible row carries the DISPLAY label; the raw row carries the stored value
        drillRawRows: [{ status: 'in_progress' }],
      },
    });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['est_hours'] }}
        dataSource={src}
        runtimeFilter={{ owner: 'me' }}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-drill-row')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dataset-drill-row'));
    expect(onDrill).toHaveBeenCalledWith(expect.objectContaining({
      dataset: 'task_metrics',
      object: 'task',
      groupKey: { status: 'In Progress' },
      // raw stored value, mapped to the underlying object field, ANDed with scope
      objectFilter: { owner: 'me', status: 'in_progress' },
    }));
  });

  it('#1752 drill: a date-bucketed row emits a half-open RANGE objectFilter (not equality)', async () => {
    const src = makeSource({
      pipe_by_quarter: {
        rows: [{ close_date: '2026-Q2', revenue: 1000 }],
        object: 'opportunity',
        // A date bucket isn't equality-drillable → no dimensionFields; a range sidecar instead.
        drillRanges: [{ close_date: { field: 'close_date', gte: '2026-04-01', lt: '2026-07-01' } }],
      },
    });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'pipe_by_quarter', rows: ['close_date'], values: ['revenue'] }}
        dataSource={src}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-drill-row')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dataset-drill-row'));
    expect(onDrill).toHaveBeenCalledWith(expect.objectContaining({
      dataset: 'pipe_by_quarter',
      object: 'opportunity',
      // the clicked quarter scopes the drilled list to [2026-04-01, 2026-07-01)
      objectFilter: { close_date: { $gte: '2026-04-01', $lt: '2026-07-01' } },
    }));
  });

  it('drill: raw objectFilter filters a lookup dim by its FK id, not the record name', async () => {
    const src = makeSource({
      deal_metrics: {
        rows: [{ account: 'Acme Corp', amount: 1000 }],
        object: 'deal',
        dimensionFields: { account: 'account_id' },
        drillRawRows: [{ account: 'acc_123' }],
      },
    });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'deal_metrics', rows: ['account'], values: ['amount'] }}
        dataSource={src}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-drill-row')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dataset-drill-row'));
    expect(onDrill).toHaveBeenCalledWith(expect.objectContaining({
      object: 'deal',
      objectFilter: { account_id: 'acc_123' },
    }));
  });

  it('matrix drill: cell emits raw objectFilter over both row + across dims', async () => {
    const src = makeSource({
      task_metrics: {
        rows: [{ status: 'In Progress', priority: 'High', est_hours: 10 }],
        object: 'task',
        dimensionFields: { status: 'status', priority: 'priority' },
        drillRawRows: [{ status: 'in_progress', priority: 'p1' }],
      },
    });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'task_metrics', rows: ['status'], columns: ['priority'], values: ['est_hours'] }}
        dataSource={src}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    fireEvent.click(screen.getAllByTestId('dataset-drill-cell')[0]);
    expect(onDrill).toHaveBeenCalledWith(expect.objectContaining({
      object: 'task',
      groupKey: { status: 'In Progress', priority: 'High' },
      objectFilter: { status: 'in_progress', priority: 'p1' },
    }));
  });

  it('drill: omits objectFilter when the server returns no drill metadata (older server)', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['est_hours'] }}
        dataSource={src}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-drill-row')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dataset-drill-row'));
    const args = onDrill.mock.calls[0][0];
    expect(args.groupKey).toEqual({ status: 'Backlog' });
    expect(args.objectFilter).toBeUndefined();
  });

  /**
   * framework#3916 — a report's `order` must reach the SELECTION.
   *
   * The schema gained `order` on the framework side and the executor applies
   * it, but this renderer built the selection it posts and never carried the
   * declaration into it — so an authored ordering did nothing. These pin the
   * lowering, its per-path scoping, and the cache key.
   */
  it('lowers report.order onto the selection, keys in declared order', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    render(
      <DatasetReportRenderer
        report={{
          name: 'hours', type: 'summary', dataset: 'task_metrics',
          rows: ['status'], values: ['est_hours'],
          order: [{ by: 'est_hours', direction: 'desc' }, { by: 'status' }],
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    const order = src.calls[0].selection.order;
    expect(order).toEqual({ est_hours: 'desc', status: 'asc' });
    // Key ORDER is the contract — it is how sort significance survives the
    // lowering from a list into a plain object.
    expect(Object.keys(order)).toEqual(['est_hours', 'status']);
  });

  it('omits `order` entirely when the report declares none', async () => {
    // Not `{}` — the field must be absent so the server's own default (a
    // selected time dimension sorts ascending) still applies.
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    render(
      <DatasetReportRenderer
        report={{ name: 'hours', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['est_hours'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    expect('order' in src.calls[0].selection).toBe(false);
  });

  it('matrix sends the order alongside the totals groupings', async () => {
    const src = makeSource({
      task_metrics: [{ status: 'Backlog', closed_month: '2026-06', est_hours: 10 }],
    });
    render(
      <DatasetReportRenderer
        report={{
          name: 'm', type: 'matrix', dataset: 'task_metrics',
          rows: ['status'], columns: ['closed_month'], values: ['est_hours'],
          order: [{ by: 'closed_month', direction: 'desc' }],
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    expect(src.calls[0].selection.order).toEqual({ closed_month: 'desc' });
    expect(src.calls[0].selection.totals).toEqual({ groupings: [['status'], ['closed_month'], []] });
  });

  it('matrix column headers follow the row order the server returned', async () => {
    // The pivot collects colHeaders in row-ARRIVAL order, so the server's
    // ordering IS the across-axis order — the whole point of #3916.
    const src = makeSource({
      task_metrics: [
        { status: 'Backlog', closed_month: '2026-08', est_hours: 1 },
        { status: 'Backlog', closed_month: '2026-07', est_hours: 2 },
        { status: 'Backlog', closed_month: '2026-06', est_hours: 3 },
      ],
    });
    render(
      <DatasetReportRenderer
        report={{
          name: 'm', type: 'matrix', dataset: 'task_metrics',
          rows: ['status'], columns: ['closed_month'], values: ['est_hours'],
          order: [{ by: 'closed_month', direction: 'desc' }],
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    const headers = screen.getAllByRole('columnheader').map((el) => el.textContent);
    expect(headers).toEqual(expect.arrayContaining(['2026-08', '2026-07', '2026-06']));
    expect(headers.indexOf('2026-08')).toBeLessThan(headers.indexOf('2026-07'));
    expect(headers.indexOf('2026-07')).toBeLessThan(headers.indexOf('2026-06'));
  });

  it('scopes the order to each sub-selection — the chart drops keys it does not plot', async () => {
    // The chart queries xAxis × yAxis only. Forwarding a key naming some other
    // row dimension would have the server reject the query outright (an order
    // key must name something the selection projects), turning a valid report
    // into a broken chart.
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    render(
      <DatasetReportRenderer
        report={{
          name: 'hours', type: 'summary', dataset: 'task_metrics',
          rows: ['status', 'owner'], values: ['est_hours'],
          chart: { type: 'bar', xAxis: 'status', yAxis: 'est_hours' },
          order: [{ by: 'owner' }, { by: 'est_hours', direction: 'desc' }],
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(src.calls.length).toBeGreaterThan(1));
    const chartCall = src.calls.find((c) => Array.isArray(c.selection.dimensions) && c.selection.dimensions.length === 1)!;
    const tableCall = src.calls.find((c) => Array.isArray(c.selection.dimensions) && c.selection.dimensions.length === 2)!;
    // Chart keeps only the measure it plots; `owner` is not in its selection.
    expect(chartCall.selection.order).toEqual({ est_hours: 'desc' });
    // The table selects both, so it keeps the full declaration.
    expect(tableCall.selection.order).toEqual({ owner: 'asc', est_hours: 'desc' });
  });

  it('a joined report orders per block, never from the container', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', task_count: 2 }] });
    render(
      <DatasetReportRenderer
        report={{
          name: 'j', type: 'joined',
          blocks: [
            { name: 'a', dataset: 'task_metrics', rows: ['status'], values: ['task_count'], order: [{ by: 'task_count', direction: 'desc' }] },
            { name: 'b', dataset: 'task_metrics', rows: ['status'], values: ['task_count'] },
          ],
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getAllByTestId('dataset-report-block')).toHaveLength(2));
    const withOrder = src.calls.filter((c) => 'order' in c.selection);
    expect(withOrder).toHaveLength(1);
    expect(withOrder[0].selection.order).toEqual({ task_count: 'desc' });
  });

  it('drops malformed order entries rather than failing the report', async () => {
    // Stored report JSON crosses the repo boundary; the authoring-time schema
    // is where a bad `order` is caught, not here. Deliberately violates the
    // declared shape (that is the point), so it is built as `unknown` first.
    const malformed: unknown = [
      { by: 42 },                                 // non-string key
      null,                                       // not an object at all
      { direction: 'desc' },                      // no key
      { by: 'status', direction: 'sideways' },    // unrecognised direction
    ];
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    render(
      <DatasetReportRenderer
        report={{
          name: 'hours', type: 'summary', dataset: 'task_metrics',
          rows: ['status'], values: ['est_hours'],
          order: malformed as Array<{ by?: unknown; direction?: unknown }>,
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    // Only the one usable key survives; an unrecognised direction falls to asc.
    expect(src.calls[0].selection.order).toEqual({ status: 'asc' });
  });

  it('refetches when the order changes (it changes the rows, not just the view)', async () => {
    const src = makeSource({ task_metrics: [{ status: 'Backlog', est_hours: 30 }] });
    const report = (direction: string) => ({
      name: 'hours', type: 'summary', dataset: 'task_metrics',
      rows: ['status'], values: ['est_hours'],
      order: [{ by: 'est_hours', direction }],
    });
    const { rerender } = render(<DatasetReportRenderer report={report('asc')} dataSource={src} />);
    await waitFor(() => expect(screen.getByText('Backlog')).toBeInTheDocument());
    expect(src.calls).toHaveLength(1);
    rerender(<DatasetReportRenderer report={report('desc')} dataSource={src} />);
    await waitFor(() => expect(src.calls).toHaveLength(2));
    expect(src.calls[1].selection.order).toEqual({ est_hours: 'desc' });
  });

  it('shows an error when the data source cannot run dataset queries', async () => {
    render(
      <DatasetReportRenderer
        report={{ name: 'r', type: 'summary', dataset: 'task_metrics', rows: ['status'], values: ['task_count'] }}
        dataSource={{}}
      />,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/does not support dataset queries/i)).toBeInTheDocument();
  });
});

/**
 * Matrix bucket / cell-key encoding (objectstack#5665).
 *
 * The cross-tab keys three lookups off dimension-value tuples: the DOWN bucket,
 * the ACROSS bucket, and the (row, column) cell that meets them. All three were
 * spelled by concatenation — the bucket id joined its values with the EMPTY
 * string, the cell key joined the two bucket ids with a PLAIN SPACE — so a
 * boundary existed only where the data happened not to reach across it. Two
 * different buckets then produced ONE key: the later row silently overwrote the
 * earlier one, the cell showed another row's measure, the overwritten row was
 * unreachable, and drill-through followed the same wrong index into the wrong
 * records. Same defect as the dashboard widget's (objectstack#5473).
 *
 * These cases assert BEHAVIOUR — which bucket renders which measure, which raw
 * record a cell drills to — not key spelling. The pre-existing pivot cases use
 * one row dimension and space-free values, where an empty separator is
 * indistinguishable from a correct one, which is why they stayed green
 * throughout.
 */
describe('DatasetReportRenderer — matrix bucket encoding (objectstack#5665)', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Data rows of the rendered cross-tab, as text — the totals row excluded. */
  const matrixBodyRows = (): string[][] =>
    [...screen.getByTestId('dataset-matrix').querySelectorAll('tbody tr')]
      .filter((tr) => tr.getAttribute('data-testid') !== 'matrix-total-row')
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''));

  it('keeps two DOWN buckets whose values concatenate identically apart ("x"+"yz" vs "xy"+"z")', async () => {
    // The empty join gave these two rows one id, "xyz". Nothing about the values
    // is exotic — any two adjacent dimensions can spell each other's boundary.
    const src = makeSource({
      sales: [
        { region: 'x', segment: 'yz', priority: 'High', amount: 1 },
        { region: 'xy', segment: 'z', priority: 'High', amount: 2 },
      ],
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'sales', rows: ['region', 'segment'], columns: ['priority'], values: ['amount'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    expect(matrixBodyRows()).toEqual([
      ['x', 'yz', '1'],
      ['xy', 'z', '2'],
    ]);
  });

  it('keeps two ACROSS buckets whose values concatenate identically apart', async () => {
    // The across axis runs through the same encoder, so it collides the same
    // way: "Q"+"1x" and "Q1"+"x" both spelled "Q1x", collapsing two columns into
    // one and making the first bucket's measure unreachable.
    const src = makeSource({
      sales: {
        rows: [
          { region: 'East', quarter: 'Q', channel: '1x', amount: 1 },
          { region: 'East', quarter: 'Q1', channel: 'x', amount: 2 },
        ],
        totals: [
          { dimensions: ['quarter', 'channel'], rows: [{ quarter: 'Q', channel: '1x', amount: 10 }, { quarter: 'Q1', channel: 'x', amount: 20 }] },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'sales', rows: ['region'], columns: ['quarter', 'channel'], values: ['amount'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    expect(screen.getByRole('columnheader', { name: 'Q / 1x' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Q1 / x' })).toBeInTheDocument();
    expect(matrixBodyRows()).toEqual([['East', '1', '2']]);
    // Column subtotals key the across buckets with the SAME encoder, so they
    // must land under their own column rather than share one.
    expect(screen.getByTestId('matrix-total-row').textContent).toContain('10');
    expect(screen.getByTestId('matrix-total-row').textContent).toContain('20');
  });

  it('does not merge cells when a dimension value contains a space ("New" × "York Q1" vs "New York" × "Q1")', async () => {
    // The space-joined cell key spelled both pairs "New York Q1" — and values
    // with spaces are the norm, not the exception ("New York", "In Progress").
    const src = makeSource({
      sales: [
        { region: 'New', quarter: 'York Q1', amount: 111 },
        { region: 'New York', quarter: 'Q1', amount: 222 },
      ],
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'sales', rows: ['region'], columns: ['quarter'], values: ['amount'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // Each bucket pair holds its own measure; the two absent pairs render '—'.
    expect(matrixBodyRows()).toEqual([
      ['New', '111', '—'],
      ['New York', '—', '222'],
    ]);
  });

  it('drills a colliding cell to ITS raw record, not the one that overwrote it', async () => {
    // The cell entry carries the flat row INDEX that drill-through reads
    // `drillRawRows` by, so a merged key drilled to another row's records with
    // no error — the quiet half of the same bug.
    const src = makeSource({
      sales: {
        rows: [
          { region: 'New', quarter: 'York Q1', amount: 111 },
          { region: 'New York', quarter: 'Q1', amount: 222 },
        ],
        object: 'opportunity',
        dimensionFields: { region: 'billing_state', quarter: 'close_quarter' },
        drillRawRows: [
          { region: 'NEW', quarter: 'YORK-Q1' },
          { region: 'NEW-YORK', quarter: 'Q1' },
        ],
      },
    });
    const onDrill = vi.fn();
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'sales', rows: ['region'], columns: ['quarter'], values: ['amount'] }}
        dataSource={src}
        onDrill={onDrill}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    // First clickable cell = row "New" × column "York Q1" (flat row 0).
    fireEvent.click(screen.getAllByTestId('dataset-drill-cell')[0]);
    expect(onDrill).toHaveBeenCalledWith(expect.objectContaining({
      groupKey: { region: 'New', quarter: 'York Q1' },
      objectFilter: { billing_state: 'NEW', close_quarter: 'YORK-Q1' },
    }));
  });

  it('matches per-row subtotals to multi-dimension row buckets', async () => {
    // `rowTotalById` keys the server's subtotal rows with the same encoder as
    // the row headers, so the collision reached the Total column too: two
    // subtotals under one id, one of them unreachable.
    const src = makeSource({
      sales: {
        rows: [
          { region: 'x', segment: 'yz', priority: 'High', amount: 1 },
          { region: 'xy', segment: 'z', priority: 'High', amount: 2 },
        ],
        totals: [
          { dimensions: ['region', 'segment'], rows: [{ region: 'x', segment: 'yz', amount: 1 }, { region: 'xy', segment: 'z', amount: 2 }] },
          { dimensions: ['priority'], rows: [{ priority: 'High', amount: 3 }] },
          { dimensions: [], rows: [{ amount: 3 }] },
        ],
      },
    });
    render(
      <DatasetReportRenderer
        report={{ name: 'm', type: 'matrix', dataset: 'sales', rows: ['region', 'segment'], columns: ['priority'], values: ['amount'] }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('dataset-matrix')).toBeInTheDocument());
    expect(screen.getAllByTestId('matrix-row-total').map((el) => el.textContent)).toEqual(['1', '2']);
    expect(screen.getByTestId('matrix-grand-total')).toHaveTextContent('3');
  });
});
