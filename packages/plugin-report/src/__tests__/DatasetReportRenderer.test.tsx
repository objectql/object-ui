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
