// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { DatasetWidget, buildDrillFilter, buildPivot } from '../DatasetWidget';

afterEach(cleanup);

const makeSource = (impl: (d: string, s: any) => Promise<{ rows: any[] }>) => ({ queryDataset: vi.fn(impl) });

describe('DatasetWidget', () => {
  it('renders a KPI value for a metric widget', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 510000 }] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'] }} dataSource={src} />);
    expect(await screen.findByText('510000')).toBeInTheDocument();
    expect(src.queryDataset).toHaveBeenCalledWith('sales', { dimensions: [], measures: ['revenue'] });
  });

  it('renders the measure label + formatted value from the result fields', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ spent_sum: 616000 }],
      fields: [{ name: 'spent_sum', type: 'number', label: 'Total Spent', format: '$0,0' }],
    })) };
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['spent_sum'] }} dataSource={src} />);
    expect(await screen.findByText('$616,000')).toBeInTheDocument();
    expect(screen.getByText('Total Spent')).toBeInTheDocument();
  });

  it('runs the dataset query for a dimensioned (chart) widget — rows→dimensions, values→measures', async () => {
    const src = makeSource(async () => ({ rows: [{ stage: 'won', revenue: 100 }, { stage: 'lost', revenue: 20 }] }));
    render(<DatasetWidget widget={{ type: 'bar', dataset: 'sales', dimensions: ['stage'], values: ['revenue'] }} dataSource={src} />);
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalledWith('sales', { dimensions: ['stage'], measures: ['revenue'] }));
  });

  it('forwards a structured compareTo, but drops the legacy string form (which the executor cannot run)', async () => {
    const structured = { kind: 'previousPeriod', dimension: 'close_date' };
    const src1 = makeSource(async () => ({ rows: [{ revenue: 1 }] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], compareTo: structured }} dataSource={src1} />);
    await waitFor(() => expect(src1.queryDataset).toHaveBeenCalledWith('sales', { dimensions: [], measures: ['revenue'], compareTo: structured }));

    const src2 = makeSource(async () => ({ rows: [{ revenue: 1 }] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], compareTo: 'previousPeriod' }} dataSource={src2} />);
    await waitFor(() => expect(src2.queryDataset).toHaveBeenCalledWith('sales', { dimensions: [], measures: ['revenue'] }));
  });

  it('forwards the widget filter as runtimeFilter — a dataset-bound widget stays filtered (ADR-0021)', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 8179769 }] }));
    const filter = { stage: { $nin: ['closed_won', 'closed_lost'] } };
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], filter }} dataSource={src} />);
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalledWith('sales', {
      dimensions: [], measures: ['revenue'], runtimeFilter: filter,
    }));
  });

  it('resolves date macros in the widget filter before sending runtimeFilter', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 1 }] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], filter: { close_date: { $gte: '{current_quarter_start}' } } }} dataSource={src} />);
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    const selection = src.queryDataset.mock.calls[0][1] as any;
    // Macro is resolved to a concrete value, not passed through verbatim.
    expect(selection.runtimeFilter.close_date.$gte).not.toBe('{current_quarter_start}');
  });

  it('surfaces a dataset error instead of wrong numbers', async () => {
    const src = makeSource(async () => { throw new Error('relationship "account" not declared'); });
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'] }} dataSource={src} />);
    expect(await screen.findByText(/not declared/)).toBeInTheDocument();
  });

  it('errors when the data source cannot run dataset queries', async () => {
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'] }} dataSource={{}} />);
    await waitFor(() => expect(screen.getByText(/does not support dataset queries/)).toBeInTheDocument());
  });

  it('prompts when no measures are selected (no query run)', () => {
    const src = makeSource(async () => ({ rows: [] }));
    render(<DatasetWidget widget={{ type: 'bar', dataset: 'sales', dimensions: ['stage'], values: [] }} dataSource={src} />);
    expect(screen.getByText(/Pick measures/)).toBeInTheDocument();
    expect(src.queryDataset).not.toHaveBeenCalled();
  });

  it('shows 0 (not "No rows") for a metric over an empty dataset', async () => {
    const src = makeSource(async () => ({ rows: [] }));
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'books', values: ['count'] }} dataSource={src} />);
    expect(await screen.findByText('0')).toBeInTheDocument();
    expect(screen.queryByText('No rows')).not.toBeInTheDocument();
  });

  it('formats the empty-metric zero (e.g. $0) using the measure format', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [],
      fields: [{ name: 'revenue', type: 'number', label: 'Revenue', format: '$0,0' }],
    })) };
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'sales', values: ['revenue'] }} dataSource={src} />);
    expect(await screen.findByText('$0')).toBeInTheDocument();
  });

  it('still shows "No rows" for a dimensioned chart over an empty dataset', async () => {
    const src = makeSource(async () => ({ rows: [] }));
    render(<DatasetWidget widget={{ type: 'bar', dataset: 'sales', dimensions: ['stage'], values: ['revenue'] }} dataSource={src} />);
    expect(await screen.findByText('No rows')).toBeInTheDocument();
  });

  // ── #2 header labels ────────────────────────────────────────────────────
  it('renders the dataset display label for a dimension header, not the raw field name', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ status: 'Open', task_count: 5 }],
      fields: [
        { name: 'status', type: 'string', label: 'Status' },
        { name: 'task_count', type: 'number', label: 'Tasks' },
      ],
    })) };
    render(<DatasetWidget widget={{ type: 'table', dataset: 'tasks', dimensions: ['status'], values: ['task_count'] }} dataSource={src} />);
    expect(await screen.findByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    // The raw field name must not leak into a header (cell value is "Open").
    expect(screen.queryByText('status')).not.toBeInTheDocument();
  });

  // ── #3 currency ─────────────────────────────────────────────────────────
  it('formats an amount with NO declared currency as a plain number (no $)', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ budget_sum: 616000 }],
      fields: [{ name: 'budget_sum', type: 'number', label: 'Total Budget', format: '0,0' }],
    })) };
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'proj', values: ['budget_sum'] }} dataSource={src} />);
    expect(await screen.findByText('616,000')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('uses the declared currency (Intl symbol) when the field carries a currency', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ budget_sum: 616000 }],
      fields: [{ name: 'budget_sum', type: 'number', label: 'Total Budget', format: '0,0', currency: 'CNY' }],
    })) };
    render(<DatasetWidget widget={{ type: 'metric', dataset: 'proj', values: ['budget_sum'] }} dataSource={src} />);
    // CNY → "¥"/"CN¥"/"CNY" depending on ICU; never "$".
    const el = await screen.findByText(/(¥|CNY)\s?616,000/);
    expect(el).toBeInTheDocument();
    expect(el.textContent).not.toContain('$');
  });

  // ── #1 drill-through ────────────────────────────────────────────────────
  it('is NOT drillable without server object + dimensionFields metadata', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ status: 'Open', task_count: 5 }],
      fields: [{ name: 'status', type: 'string', label: 'Status' }, { name: 'task_count', type: 'number', label: 'Tasks' }],
    })) };
    render(<DatasetWidget widget={{ type: 'pivot', dataset: 'tasks', dimensions: ['status'], values: ['task_count'] }} dataSource={src} />);
    await screen.findByText('Status');
    expect(screen.queryByTestId('dataset-drill-row')).not.toBeInTheDocument();
  });

  it('marks rows drillable once the server returns object + dimensionFields', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ status: 'Open', task_count: 5 }],
      fields: [{ name: 'status', type: 'string', label: 'Status' }, { name: 'task_count', type: 'number', label: 'Tasks' }],
      object: 'showcase_task',
      dimensionFields: { status: 'status' },
      drillRawRows: [{ status: 'open' }],
    })) };
    render(<DatasetWidget widget={{ type: 'pivot', dataset: 'tasks', dimensions: ['status'], values: ['task_count'] }} dataSource={src} />);
    expect(await screen.findByTestId('dataset-drill-row')).toBeInTheDocument();
  });

  it('buildDrillFilter filters by the RAW stored value, not the display label', () => {
    // The raw-values row carries the stored value "open"; the display label
    // "Open" never reaches the filter.
    expect(buildDrillFilter({ status: 'open' }, ['status'], { status: 'status' })).toEqual({ status: 'open' });
  });

  it('buildDrillFilter maps a dimension to its underlying object field', () => {
    expect(buildDrillFilter({ account: 'acc_123' }, ['account'], { account: 'account_id' })).toEqual({ account_id: 'acc_123' });
  });

  it('buildDrillFilter ANDs the widget runtime filter in', () => {
    expect(
      buildDrillFilter({ status: 'open', priority: 'high' }, ['status', 'priority'], { status: 'status', priority: 'priority' }, { archived: false }),
    ).toEqual({ archived: false, status: 'open', priority: 'high' });
  });

  it('buildDrillFilter normalizes a missing/empty raw value to null', () => {
    expect(buildDrillFilter({ status: '' }, ['status'], { status: 'status' })).toEqual({ status: null });
    expect(buildDrillFilter(undefined, ['status'], { status: 'status' })).toEqual({ status: null });
  });

  // ── pivot cross-tab ──────────────────────────────────────────────────────
  it('buildPivot turns flat rows into a cross-tab keyed to flat row indices', () => {
    const rows = [
      { status: 'Open', priority: 'High', task_count: 2 },
      { status: 'Open', priority: 'Low', task_count: 1 },
      { status: 'Done', priority: 'High', task_count: 3 },
    ];
    const p = buildPivot(rows, ['status'], 'priority');
    expect(p.rowHeaders.map((r) => r.labels[0])).toEqual(['Open', 'Done']);
    expect(p.colHeaders.map((c) => c.label)).toEqual(['High', 'Low']);
    expect(p.cellIndex.get('Open High')).toBe(0);
    expect(p.cellIndex.get('Open Low')).toBe(1);
    expect(p.cellIndex.get('Done High')).toBe(2);
    expect(p.cellIndex.get('Done Low')).toBeUndefined(); // sparse combo absent
  });

  it('renders a pivot (≥2 dims) as a true cross-tab, not a flat table', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [
        { status: 'Open', priority: 'High', task_count: 2 },
        { status: 'Open', priority: 'Low', task_count: 1 },
        { status: 'Done', priority: 'High', task_count: 3 },
      ],
      fields: [
        { name: 'status', type: 'string', label: 'Status' },
        { name: 'priority', type: 'string', label: 'Priority' },
        { name: 'task_count', type: 'number', label: 'Tasks' },
      ],
    })) };
    render(<DatasetWidget widget={{ type: 'pivot', dataset: 'tasks', dimensions: ['status', 'priority'], values: ['task_count'] }} dataSource={src} />);
    const matrix = await screen.findByTestId('dataset-matrix');
    // Last dim (priority) spreads across as column headers…
    expect(within(matrix).getByText('High')).toBeInTheDocument();
    expect(within(matrix).getByText('Low')).toBeInTheDocument();
    // …first dim (status) is the row header (rendered once per row, not per combo).
    expect(within(matrix).getByText('Status')).toBeInTheDocument();
    expect(within(matrix).getByText('Done')).toBeInTheDocument();
    expect(within(matrix).getAllByText('Open')).toHaveLength(1);
  });

  it('falls back to a flat table for a single-dimension pivot', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ status: 'Open', task_count: 5 }],
      fields: [{ name: 'status', type: 'string', label: 'Status' }, { name: 'task_count', type: 'number', label: 'Tasks' }],
    })) };
    render(<DatasetWidget widget={{ type: 'pivot', dataset: 'tasks', dimensions: ['status'], values: ['task_count'] }} dataSource={src} />);
    await screen.findByText('Status');
    expect(screen.queryByTestId('dataset-matrix')).not.toBeInTheDocument();
  });

  it('makes matrix cells drillable when the server returns drill metadata', async () => {
    const src = { queryDataset: vi.fn(async () => ({
      rows: [{ status: 'Open', priority: 'High', task_count: 2 }],
      fields: [{ name: 'status', type: 'string', label: 'Status' }, { name: 'priority', type: 'string', label: 'Priority' }, { name: 'task_count', type: 'number', label: 'Tasks' }],
      object: 'showcase_task',
      dimensionFields: { status: 'status', priority: 'priority' },
      drillRawRows: [{ status: 'open', priority: 'high' }],
    })) };
    render(<DatasetWidget widget={{ type: 'pivot', dataset: 'tasks', dimensions: ['status', 'priority'], values: ['task_count'] }} dataSource={src} />);
    expect(await screen.findByTestId('dataset-drill-cell')).toBeInTheDocument();
  });
});
