// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#3337 point 5 — the one functional half of the `compareTo`
 * convergence (objectstack#5011).
 *
 * Forwarding the structured `compareTo` is not enough on its own: the executor
 * shifts a `timeDimensions` entry carrying a `dateRange`, and this widget only
 * ever produced a `runtimeFilter`. A widget whose window lives in its own
 * filter (a date macro, or the dashboard's date-range filter merged in) got
 * "compareTo needs a dated window to shift" back and rendered no comparison.
 *
 * These tests pin the three halves of making it real: the window is LOWERED
 * (and moved, not copied), the choice of dimension stays the EXECUTOR's, and
 * the `<measure>__compare` columns the executor sends back are actually shown.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

let lastChartSchema: any = null;

vi.mock('@object-ui/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  SchemaRenderer: (props: any) => {
    lastChartSchema = props.schema;
    return null;
  },
}));

import { DatasetWidget, extractDateWindows } from '../DatasetWidget';

afterEach(() => {
  cleanup();
  lastChartSchema = null;
});

const makeSource = (impl: (d: string, s: any) => Promise<any>) => ({ queryDataset: vi.fn(impl) });
const oneRow = async () => ({ rows: [{ revenue: 1 }] });
const selectionOf = (src: { queryDataset: any }) => src.queryDataset.mock.calls[0][1];

const Q2 = { close_date: { $gte: '2026-04-01', $lte: '2026-06-30' } };

describe('extractDateWindows', () => {
  it('lowers a bounded ISO window and removes it from the filter', () => {
    const { windows, rest } = extractDateWindows({ ...Q2, stage: 'won' });
    expect(windows).toEqual([{ dimension: 'close_date', dateRange: ['2026-04-01', '2026-06-30'] }]);
    expect(rest).toEqual({ stage: 'won' });
  });

  it('returns no filter at all when the window was the whole filter', () => {
    const { windows, rest } = extractDateWindows({ ...Q2 });
    expect(windows).toHaveLength(1);
    expect(rest).toBeUndefined();
  });

  // A `dateRange` is a DATE window. These four are not one, and quietly
  // treating them as one is how a widget would end up shifting the wrong thing.
  it('leaves a numeric range alone', () => {
    const filter = { amount: { $gte: 1000, $lte: 5000 } };
    expect(extractDateWindows(filter)).toEqual({ windows: [], rest: filter });
  });

  it('leaves an exclusive bound alone (dateRange has no exclusive bound)', () => {
    const filter = { close_date: { $gte: '2026-04-01', $lt: '2026-07-01' } };
    expect(extractDateWindows(filter)).toEqual({ windows: [], rest: filter });
  });

  it('leaves a half-open window alone (nothing bounded to shift)', () => {
    const filter = { close_date: { $gte: '2026-04-01' } };
    expect(extractDateWindows(filter)).toEqual({ windows: [], rest: filter });
  });

  it('leaves a window inside $or alone (it is not the window the query runs in)', () => {
    const filter = { $or: [Q2, { stage: 'won' }] };
    expect(extractDateWindows(filter)).toEqual({ windows: [], rest: filter });
  });

  it('walks $and members and unwraps the one-member conjunction left behind', () => {
    // Exactly the shape DashboardRenderer's mergeFilters produces when a
    // dashboard date-range filter is broadcast into a widget's own filter.
    const { windows, rest } = extractDateWindows({ $and: [{ stage: 'won' }, Q2] });
    expect(windows).toEqual([{ dimension: 'close_date', dateRange: ['2026-04-01', '2026-06-30'] }]);
    expect(rest).toEqual({ stage: 'won' });
  });

  it('intersects two conjunctive windows on the SAME dimension', () => {
    // Widget window (Q2) AND dashboard window (May) → May. Plain arithmetic on
    // the AND — and it keeps the executor from being handed the same dimension
    // twice and calling it ambiguous.
    const { windows } = extractDateWindows({
      $and: [Q2, { close_date: { $gte: '2026-05-01', $lte: '2026-05-31' } }],
    });
    expect(windows).toEqual([{ dimension: 'close_date', dateRange: ['2026-05-01', '2026-05-31'] }]);
  });

  it('keeps every dated dimension — picking one is the executor’s job', () => {
    const { windows } = extractDateWindows({
      close_date: { $gte: '2026-04-01', $lte: '2026-06-30' },
      created_at: { $gte: '2026-01-01', $lte: '2026-12-31' },
    });
    expect(windows.map((w) => w.dimension)).toEqual(['close_date', 'created_at']);
  });
});

describe('DatasetWidget — lowering the comparison window (#3337 point 5)', () => {
  it('lowers the resolved date window into timeDimensions and MOVES it out of runtimeFilter', async () => {
    const src = makeSource(oneRow);
    render(
      <DatasetWidget
        widget={{
          type: 'metric', dataset: 'sales', values: ['revenue'],
          filter: { ...Q2, stage: 'won' },
          compareTo: { kind: 'previousPeriod' },
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    const selection = selectionOf(src);
    expect(selection.timeDimensions).toEqual([
      { dimension: 'close_date', dateRange: ['2026-04-01', '2026-06-30'] },
    ]);
    // MOVED, not copied. The comparison pass re-runs with the SHIFTED
    // timeDimensions but the same runtimeFilter — a copy left here would
    // intersect the shifted window with the current one and every
    // `<measure>__compare` column would come back empty.
    expect(selection.runtimeFilter).toEqual({ stage: 'won' });
  });

  it('resolves date macros before lowering them', async () => {
    const src = makeSource(oneRow);
    render(
      <DatasetWidget
        widget={{
          type: 'metric', dataset: 'sales', values: ['revenue'],
          filter: { close_date: { $gte: '{current_quarter_start}', $lte: '{current_quarter_end}' } },
          compareTo: { kind: 'previousPeriod' },
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    const [td] = selectionOf(src).timeDimensions;
    expect(td.dimension).toBe('close_date');
    // Concrete dates, not the macro tokens the executor would have to guess at.
    expect(td.dateRange[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(td.dateRange[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('lowers nothing without compareTo — every other widget’s query is unchanged', async () => {
    const src = makeSource(oneRow);
    render(
      <DatasetWidget
        widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], filter: { ...Q2 } }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    expect(selectionOf(src)).toEqual({
      dimensions: [], measures: ['revenue'], runtimeFilter: Q2,
    });
  });

  it('sends BOTH dated dimensions rather than picking one', async () => {
    const src = makeSource(oneRow);
    render(
      <DatasetWidget
        widget={{
          type: 'metric', dataset: 'sales', values: ['revenue'],
          filter: { ...Q2, created_at: { $gte: '2026-01-01', $lte: '2026-12-31' } },
          compareTo: { kind: 'previousYear' },
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(src.queryDataset).toHaveBeenCalled());
    expect(selectionOf(src).timeDimensions).toHaveLength(2);
    expect(selectionOf(src).compareTo).toEqual({ kind: 'previousYear' });
  });

  it('surfaces the executor’s ambiguity error un-swallowed', async () => {
    // Verbatim from dataset-executor's resolveCompareDimension: the message
    // names the candidates so the author can pick one. A renderer that guessed
    // instead would have replaced this with a quietly wrong window.
    const message =
      '[dataset-executor] compareTo.dimension is ambiguous: 2 time dimensions carry a dateRange '
      + '("close_date", "created_at"). Name the one to shift — '
      + "compareTo: { kind: 'previousYear', dimension: 'close_date' }.";
    const src = makeSource(async () => { throw new Error(message); });
    render(
      <DatasetWidget
        widget={{
          type: 'metric', dataset: 'sales', values: ['revenue'],
          filter: { ...Q2, created_at: { $gte: '2026-01-01', $lte: '2026-12-31' } },
          compareTo: { kind: 'previousYear' },
        }}
        dataSource={src}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/ambiguous/);
    expect(screen.getByRole('alert')).toHaveTextContent(/"close_date", "created_at"/);
  });
});

describe('DatasetWidget — showing the comparison the executor returned', () => {
  it('renders the KPI delta + window label from the __compare column', async () => {
    const src = makeSource(async () => ({
      rows: [{ revenue: 120, revenue__compare: 100 }],
      fields: [{ name: 'revenue', type: 'number', label: 'Revenue' }, { name: 'revenue__compare', type: 'number' }],
    }));
    render(
      <DatasetWidget
        widget={{
          type: 'metric', dataset: 'sales', values: ['revenue'],
          filter: { ...Q2 }, compareTo: { kind: 'previousYear' },
        }}
        dataSource={src}
      />,
    );
    const trend = await screen.findByTestId('dataset-compare-trend');
    expect(trend).toHaveTextContent('20%');
    expect(trend).toHaveTextContent(/vs last year/i);
  });

  it('labels the window from the RAW filter’s macros, which resolution erased', async () => {
    // `previousPeriod` derives its label by sniffing the filter's date macros.
    // The resolved filter has none left — passing that instead would silently
    // downgrade every label to the generic "vs previous period".
    const src = makeSource(async () => ({ rows: [{ revenue: 120, revenue__compare: 100 }] }));
    render(
      <DatasetWidget
        widget={{
          type: 'metric', dataset: 'sales', values: ['revenue'],
          filter: { close_date: { $gte: '{current_quarter_start}', $lte: '{current_quarter_end}' } },
          compareTo: { kind: 'previousPeriod' },
        }}
        dataSource={src}
      />,
    );
    expect(await screen.findByTestId('dataset-compare-trend')).toHaveTextContent(/vs last quarter/i);
  });

  it('shows no trend when the executor attached no comparison', async () => {
    const src = makeSource(async () => ({ rows: [{ revenue: 120 }] }));
    render(
      <DatasetWidget
        widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], filter: { ...Q2 }, compareTo: { kind: 'previousYear' } }}
        dataSource={src}
      />,
    );
    await screen.findByText('120');
    expect(screen.queryByTestId('dataset-compare-trend')).not.toBeInTheDocument();
  });

  it('renders a comparison COLUMN in the table, formatted as its base measure', async () => {
    const src = makeSource(async () => ({
      rows: [
        { stage: 'won', revenue: 120, revenue__compare: 100 },
        { stage: 'lost', revenue: 20, revenue__compare: 40 },
      ],
      fields: [
        { name: 'stage', type: 'string', label: 'Stage' },
        { name: 'revenue', type: 'number', label: 'Revenue', format: '$0,0' },
        { name: 'revenue__compare', type: 'number' },
      ],
    }));
    render(
      <DatasetWidget
        widget={{
          type: 'table', dataset: 'sales', dimensions: ['stage'], values: ['revenue'],
          filter: { ...Q2 }, compareTo: { kind: 'previousYear' },
        }}
        dataSource={src}
      />,
    );
    const header = await screen.findByTestId('dataset-compare-column');
    expect(header).toHaveTextContent(/Revenue/);
    expect(header).toHaveTextContent(/vs last year/i);
    // The comparison value carries the base measure's format — it is the same
    // measure over an earlier window, so "$100", never a bare 100.
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('$120')).toBeInTheDocument();
  });

  it('appends a comparison SERIES to the chart, marked for the overlay treatment', async () => {
    const src = makeSource(async () => ({
      rows: [
        { stage: 'won', revenue: 120, revenue__compare: 100 },
        { stage: 'lost', revenue: 20, revenue__compare: 40 },
      ],
      fields: [{ name: 'revenue', type: 'number', label: 'Revenue' }],
    }));
    render(
      <DatasetWidget
        widget={{
          type: 'bar', dataset: 'sales', dimensions: ['stage'], values: ['revenue'],
          filter: { ...Q2 }, compareTo: { kind: 'previousYear' },
        }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(lastChartSchema).not.toBeNull());
    expect(lastChartSchema.series).toHaveLength(2);
    expect(lastChartSchema.series[0]).toMatchObject({ dataKey: 'revenue', variant: 'current' });
    expect(lastChartSchema.series[1]).toMatchObject({
      dataKey: 'revenue__compare',
      variant: 'comparison',
    });
    expect(lastChartSchema.series[1].label).toMatch(/vs last year/i);
  });

  it('adds no comparison series when no __compare column came back', async () => {
    const src = makeSource(async () => ({ rows: [{ stage: 'won', revenue: 120 }] }));
    render(
      <DatasetWidget
        widget={{ type: 'bar', dataset: 'sales', dimensions: ['stage'], values: ['revenue'], compareTo: { kind: 'previousYear' } }}
        dataSource={src}
      />,
    );
    await waitFor(() => expect(lastChartSchema).not.toBeNull());
    expect(lastChartSchema.series).toHaveLength(1);
    expect(lastChartSchema.series[0].variant).toBeUndefined();
  });
});
