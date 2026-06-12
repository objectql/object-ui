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
import { DatasetReportRenderer, isDatasetReport } from '../DatasetReportRenderer';

type MockRows = Array<Record<string, unknown>>;
type MockResult = { rows: MockRows; totals?: Array<{ dimensions: string[]; rows: MockRows }> };

function makeSource(byDataset: Record<string, MockRows | MockResult>) {
  const calls: Array<{ dataset: string; selection: any }> = [];
  return {
    calls,
    queryDataset: vi.fn(async (dataset: string, selection: unknown) => {
      calls.push({ dataset, selection: selection as any });
      const entry = byDataset[dataset];
      if (Array.isArray(entry)) return { rows: entry };
      return { rows: entry?.rows ?? [], ...(entry?.totals ? { totals: entry.totals } : {}) };
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
