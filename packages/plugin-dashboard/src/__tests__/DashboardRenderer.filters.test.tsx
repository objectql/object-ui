/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Dashboard-level filter broadcast (framework#2501).
 *
 * ADR-0021: widgets bind a semantic-layer `dataset` and render through
 * DatasetWidget, which forwards the widget's EFFECTIVE `filter` (its own filter
 * AND the dashboard broadcast, resolved through the same bindings + `$and` merge)
 * to `dataSource.queryDataset` as `runtimeFilter`. We assert that call so the
 * page-variables provider, filter bar, binding resolution, and merge all run for
 * real. Date macros (`{today}`, `{30_days_ago}`) are resolved client-side before
 * the query, so date-range assertions check the SHAPE, not the literal tokens.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { DashboardSchema } from '@object-ui/types';
import { DashboardRenderer } from '../DashboardRenderer';

afterEach(cleanup);

/** A dataset data source that records every `queryDataset` call. */
const makeQueryDataset = () => vi.fn(async () => ({ rows: [{ count: 1 }], fields: [] }));

/** The `runtimeFilter` of the LAST `queryDataset` call for a given dataset. */
const lastRuntimeFilter = (
  queryDataset: ReturnType<typeof makeQueryDataset>,
  dataset: string,
): unknown => {
  const calls = queryDataset.mock.calls.filter((c) => c[0] === dataset);
  if (calls.length === 0) return undefined;
  return (calls[calls.length - 1][1] as { runtimeFilter?: unknown })?.runtimeFilter;
};

describe('DashboardRenderer dashboard-level filters', () => {
  it('renders no filter bar when the schema declares no filters', async () => {
    const queryDataset = makeQueryDataset();
    const schema: DashboardSchema = {
      type: 'dashboard',
      widgets: [{ id: 'w1', type: 'bar', dataset: 'invoices', values: ['count'] }],
    };
    render(<DashboardRenderer schema={schema} dataSource={{ queryDataset }} />);
    expect(screen.queryByTestId('dashboard-filter-bar')).not.toBeInTheDocument();
    await waitFor(() => expect(queryDataset).toHaveBeenCalledWith('invoices', expect.anything()));
    expect(lastRuntimeFilter(queryDataset, 'invoices')).toBeUndefined();
  });

  it('broadcasts the default date range into each widget via its own bound field', async () => {
    const queryDataset = makeQueryDataset();
    const schema: DashboardSchema = {
      type: 'dashboard',
      dateRange: { field: 'created_at', defaultRange: 'last_30_days', allowCustomRange: true },
      widgets: [
        // Default binding → dateRange.field (created_at).
        { id: 'w1', type: 'bar', dataset: 'invoices', values: ['count'] },
        // Explicit per-widget override → this widget's own field.
        { id: 'w2', type: 'line', dataset: 'accounts', values: ['count'], filterBindings: { dateRange: 'signed_at' } },
      ],
    };
    render(<DashboardRenderer schema={schema} dataSource={{ queryDataset }} />);

    expect(screen.getByTestId('dashboard-filter-bar')).toBeInTheDocument();
    await waitFor(() => {
      expect(lastRuntimeFilter(queryDataset, 'invoices')).toEqual({
        created_at: { $gte: expect.any(String), $lte: expect.any(String) },
      });
      expect(lastRuntimeFilter(queryDataset, 'accounts')).toEqual({
        signed_at: { $gte: expect.any(String), $lte: expect.any(String) },
      });
    });
  });

  it('merges the broadcast with a widget\'s own filter and honors opt-out', async () => {
    const queryDataset = makeQueryDataset();
    const schema: DashboardSchema = {
      type: 'dashboard',
      globalFilters: [
        { name: 'region', field: 'region', type: 'select', options: ['EMEA', 'APAC'], defaultValue: 'EMEA' },
      ],
      widgets: [
        { id: 'w1', type: 'bar', dataset: 'invoices', values: ['count'], filter: { status: 'paid' } },
        { id: 'w2', type: 'pie', dataset: 'accounts', values: ['count'], filterBindings: { region: false } },
      ],
    };
    render(<DashboardRenderer schema={schema} dataSource={{ queryDataset }} />);

    // Widget filter AND dashboard filter.
    await waitFor(() => {
      expect(lastRuntimeFilter(queryDataset, 'invoices')).toEqual({
        $and: [{ status: 'paid' }, { region: 'EMEA' }],
      });
    });
    // Opted out — own (absent) filter untouched, so no runtimeFilter.
    expect(lastRuntimeFilter(queryDataset, 'accounts')).toBeUndefined();
  });

  it('re-scopes all bound widgets live when a filter value changes', async () => {
    const queryDataset = makeQueryDataset();
    const schema: DashboardSchema = {
      type: 'dashboard',
      globalFilters: [{ name: 'q', field: 'name', type: 'text', label: 'Search' }],
      widgets: [
        { id: 'w1', type: 'bar', dataset: 'invoices', values: ['count'] },
        { id: 'w2', type: 'line', dataset: 'accounts', values: ['count'], filterBindings: { q: 'title' } },
      ],
    };
    render(<DashboardRenderer schema={schema} dataSource={{ queryDataset }} />);

    await waitFor(() => expect(queryDataset).toHaveBeenCalledWith('invoices', expect.anything()));
    expect(lastRuntimeFilter(queryDataset, 'invoices')).toBeUndefined();

    const input = screen.getByTestId('dashboard-filter-q');
    fireEvent.change(input, { target: { value: 'acme' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(lastRuntimeFilter(queryDataset, 'invoices')).toEqual({ name: { $contains: 'acme' } });
      expect(lastRuntimeFilter(queryDataset, 'accounts')).toEqual({ title: { $contains: 'acme' } });
    });

    // Clearing the value removes the broadcast again.
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(lastRuntimeFilter(queryDataset, 'invoices')).toBeUndefined();
      expect(lastRuntimeFilter(queryDataset, 'accounts')).toBeUndefined();
    });
  });

  it('injects the merged filter into a dataset widget\'s runtimeFilter', async () => {
    const queryDataset = vi.fn(async () => ({ rows: [{ revenue: 1 }] }));
    const schema: DashboardSchema = {
      type: 'dashboard',
      globalFilters: [
        { name: 'region', field: 'region', type: 'select', options: ['EMEA'], defaultValue: 'EMEA' },
      ],
      widgets: [
        { id: 'w1', type: 'metric', dataset: 'sales', values: ['revenue'], filter: { stage: 'won' } } as any,
      ],
    };
    render(<DashboardRenderer schema={schema} dataSource={{ queryDataset }} />);

    await waitFor(() => {
      expect(queryDataset).toHaveBeenCalledWith('sales', expect.objectContaining({
        runtimeFilter: { $and: [{ stage: 'won' }, { region: 'EMEA' }] },
      }));
    });
  });
});
