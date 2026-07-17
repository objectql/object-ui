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
 * The widget child components (`object-chart`, …) are stubbed in the REAL
 * component registry so the real SchemaRenderer resolves them and each stub
 * surfaces its resolved `filter` as a DOM attribute — the page-variables
 * provider, filter bar, binding resolution, and $and merge all run for real.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { DashboardSchema } from '@object-ui/types';
import { ComponentRegistry } from '@object-ui/core';
import { DashboardRenderer } from '../DashboardRenderer';

const FilterProbe = ({ schema }: { schema: any }) => (
  <div
    data-testid={`widget-schema-${schema?.objectName ?? schema?.type}`}
    data-filter={JSON.stringify(schema?.filter ?? null)}
  />
);
ComponentRegistry.register('object-chart', FilterProbe);
ComponentRegistry.register('object-metric', FilterProbe);

afterEach(cleanup);

const widgetFilter = (objectName: string) => {
  const el = screen.getByTestId(`widget-schema-${objectName}`);
  return JSON.parse(el.getAttribute('data-filter')!);
};

describe('DashboardRenderer dashboard-level filters', () => {
  it('renders no filter bar when the schema declares no filters', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      widgets: [{ id: 'w1', type: 'bar', object: 'invoices', aggregate: 'count' }],
    };
    render(<DashboardRenderer schema={schema} />);
    expect(screen.queryByTestId('dashboard-filter-bar')).not.toBeInTheDocument();
    expect(widgetFilter('invoices')).toBeNull();
  });

  it('broadcasts the default date range into each widget via its own bound field', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      dateRange: { field: 'created_at', defaultRange: 'last_30_days', allowCustomRange: true },
      widgets: [
        // Default binding → dateRange.field (created_at).
        { id: 'w1', type: 'bar', object: 'invoices', aggregate: 'count' },
        // Explicit per-widget override → this widget's own field.
        { id: 'w2', type: 'line', object: 'accounts', aggregate: 'count', filterBindings: { dateRange: 'signed_at' } },
      ],
    };
    render(<DashboardRenderer schema={schema} />);

    expect(screen.getByTestId('dashboard-filter-bar')).toBeInTheDocument();
    expect(widgetFilter('invoices')).toEqual({
      created_at: { $gte: '{30_days_ago}', $lte: '{today}' },
    });
    expect(widgetFilter('accounts')).toEqual({
      signed_at: { $gte: '{30_days_ago}', $lte: '{today}' },
    });
  });

  it('merges the broadcast with a widget\'s own filter and honors opt-out', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      globalFilters: [
        { name: 'region', field: 'region', type: 'select', options: ['EMEA', 'APAC'], defaultValue: 'EMEA' },
      ],
      widgets: [
        { id: 'w1', type: 'bar', object: 'invoices', aggregate: 'count', filter: { status: 'paid' } },
        { id: 'w2', type: 'pie', object: 'accounts', aggregate: 'count', filterBindings: { region: false } },
      ],
    };
    render(<DashboardRenderer schema={schema} />);

    // Widget filter AND dashboard filter.
    expect(widgetFilter('invoices')).toEqual({
      $and: [{ status: 'paid' }, { region: 'EMEA' }],
    });
    // Opted out — own (absent) filter untouched.
    expect(widgetFilter('accounts')).toBeNull();
  });

  it('re-scopes all bound widgets live when a filter value changes', async () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      globalFilters: [{ name: 'q', field: 'name', type: 'text', label: 'Search' }],
      widgets: [
        { id: 'w1', type: 'bar', object: 'invoices', aggregate: 'count' },
        { id: 'w2', type: 'line', object: 'accounts', aggregate: 'count', filterBindings: { q: 'title' } },
      ],
    };
    render(<DashboardRenderer schema={schema} />);

    expect(widgetFilter('invoices')).toBeNull();

    const input = screen.getByTestId('dashboard-filter-q');
    fireEvent.change(input, { target: { value: 'acme' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(widgetFilter('invoices')).toEqual({ name: { $contains: 'acme' } });
      expect(widgetFilter('accounts')).toEqual({ title: { $contains: 'acme' } });
    });

    // Clearing the value removes the broadcast again.
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(widgetFilter('invoices')).toBeNull();
      expect(widgetFilter('accounts')).toBeNull();
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
