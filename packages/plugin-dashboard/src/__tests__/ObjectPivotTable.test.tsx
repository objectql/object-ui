/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ObjectPivotTable } from '../ObjectPivotTable';
import { SchemaRendererProvider } from '@object-ui/react';

describe('ObjectPivotTable', () => {
  const baseSchema = {
    type: 'pivot' as const,
    rowField: 'region',
    columnField: 'quarter',
    valueField: 'revenue',
    aggregation: 'sum' as const,
  };

  it('should render PivotTable with static data', () => {
    const schema = {
      ...baseSchema,
      data: [
        { region: 'North', quarter: 'Q1', revenue: 100 },
        { region: 'South', quarter: 'Q1', revenue: 200 },
      ],
    };

    render(<ObjectPivotTable schema={schema} />);
    expect(screen.getByText('North')).toBeDefined();
    expect(screen.getByText('South')).toBeDefined();
  });

  it('should show loading skeleton when fetching data', async () => {
    // A dataSource that resolves slowly
    const dataSource = {
      find: vi.fn(() => new Promise(() => {})), // Never resolves
    };

    const schema = {
      ...baseSchema,
      objectName: 'sales',
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectPivotTable schema={schema} />
      </SchemaRendererProvider>,
    );

    // Should show loading skeleton
    await waitFor(() => {
      const loadingEl = container.querySelector('[data-testid="pivot-loading"]');
      expect(loadingEl).toBeDefined();
    });
  });

  it('should show error state on fetch failure', async () => {
    const dataSource = {
      find: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    const schema = {
      ...baseSchema,
      objectName: 'sales',
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectPivotTable schema={schema} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const errorEl = container.querySelector('[data-testid="pivot-error"]');
      expect(errorEl).toBeDefined();
    });

    expect(screen.getByText('Network error')).toBeDefined();
  });

  it('should render fetched data in PivotTable', async () => {
    const dataSource = {
      find: vi.fn().mockResolvedValue({
        records: [
          { region: 'East', quarter: 'Q1', revenue: 500 },
          { region: 'West', quarter: 'Q2', revenue: 300 },
        ],
      }),
    };

    const schema = {
      ...baseSchema,
      objectName: 'sales',
    };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectPivotTable schema={schema} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('East')).toBeDefined();
      expect(screen.getByText('West')).toBeDefined();
    });

    expect(dataSource.find).toHaveBeenCalledWith('sales', { $filter: undefined });
  });

  it('should show empty state when no data returned', async () => {
    const dataSource = {
      find: vi.fn().mockResolvedValue({ records: [] }),
    };

    const schema = {
      ...baseSchema,
      objectName: 'sales',
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectPivotTable schema={schema} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const emptyState = container.querySelector('[data-testid="pivot-empty-state"]');
      expect(emptyState).toBeDefined();
    });
  });

  it('should prefer static data over fetched data', () => {
    const dataSource = {
      find: vi.fn(),
    };

    const schema = {
      ...baseSchema,
      objectName: 'sales',
      data: [
        { region: 'Static', quarter: 'Q1', revenue: 999 },
      ],
    };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectPivotTable schema={schema} />
      </SchemaRendererProvider>,
    );

    expect(screen.getByText('Static')).toBeDefined();
    expect(dataSource.find).not.toHaveBeenCalled();
  });

  it('should show no-data-source message when objectName is set but no dataSource available', () => {
    const schema = {
      ...baseSchema,
      objectName: 'sales',
    };

    render(<ObjectPivotTable schema={schema} />);
    expect(screen.getByText(/No data source available/)).toBeDefined();
  });

  it('should render title in all states', async () => {
    const dataSource = {
      find: vi.fn().mockRejectedValue(new Error('fail')),
    };

    const schema = {
      ...baseSchema,
      objectName: 'sales',
      title: 'Revenue Pivot',
    };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectPivotTable schema={schema} />
      </SchemaRendererProvider>,
    );

    // Title shows even in error state
    await waitFor(() => {
      expect(screen.getByText('Revenue Pivot')).toBeDefined();
    });
  });
});
