/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { ObjectMetricWidget } from '../ObjectMetricWidget';
import { SchemaRendererProvider } from '@object-ui/react';

// Suppress console.error from expected fetch errors
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

describe('ObjectMetricWidget', () => {
  const baseProps = {
    objectName: 'opportunity',
    label: 'Total Revenue',
    fallbackValue: '$652,000',
    icon: 'DollarSign',
  };

  it('should show fallback value when no dataSource is available', () => {
    render(<ObjectMetricWidget {...baseProps} />);

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$652,000')).toBeInTheDocument();
  });

  it('should show loading state while fetching', async () => {
    const dataSource = {
      find: vi.fn(() => new Promise(() => {})), // Never resolves
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectMetricWidget {...baseProps} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const loadingEl = container.querySelector('[data-testid="metric-loading"]');
      expect(loadingEl).toBeTruthy();
    });
  });

  it('should show error state when data fetch fails', async () => {
    const dataSource = {
      find: vi.fn().mockRejectedValue(new Error('Cube name is required')),
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectMetricWidget {...baseProps} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const errorEl = container.querySelector('[data-testid="metric-error"]');
      expect(errorEl).toBeTruthy();
    });

    expect(screen.getByText('Cube name is required')).toBeInTheDocument();
  });

  it('should show error state when aggregate fails', async () => {
    const dataSource = {
      aggregate: vi.fn().mockRejectedValue(new Error('Connection refused')),
      find: vi.fn(),
    };

    const propsWithAggregate = {
      ...baseProps,
      aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
    };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectMetricWidget {...propsWithAggregate} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      const errorEl = container.querySelector('[data-testid="metric-error"]');
      expect(errorEl).toBeTruthy();
    });

    expect(screen.getByText('Connection refused')).toBeInTheDocument();
  });

  it('should display fetched value from find()', async () => {
    const dataSource = {
      find: vi.fn().mockResolvedValue({
        data: [
          { name: 'A', amount: 100 },
          { name: 'B', amount: 200 },
          { name: 'C', amount: 300 },
        ],
      }),
    };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectMetricWidget {...baseProps} />
      </SchemaRendererProvider>,
    );

    // When no aggregate config, it falls back to counting records
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should display aggregated value from aggregate()', async () => {
    const dataSource = {
      aggregate: vi.fn().mockResolvedValue([
        { stage: 'All', amount: 652000 },
      ]),
      find: vi.fn(),
    };

    const propsWithAggregate = {
      ...baseProps,
      aggregate: { field: 'amount', function: 'sum', groupBy: '_all' },
    };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectMetricWidget {...propsWithAggregate} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('652000')).toBeInTheDocument();
    });

    // Should have called aggregate, not find
    expect(dataSource.aggregate).toHaveBeenCalledWith('opportunity', {
      field: 'amount',
      function: 'sum',
      groupBy: '_all',
      filter: undefined,
    });
  });

  it('should render label even in error state', async () => {
    const dataSource = {
      find: vi.fn().mockRejectedValue(new Error('Server error')),
    };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectMetricWidget {...baseProps} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    // Label should still be visible
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
  });

  it('should use prop dataSource over context dataSource', async () => {
    const contextDs = {
      find: vi.fn().mockResolvedValue({ data: [{ a: 1 }] }),
    };
    const propDs = {
      find: vi.fn().mockResolvedValue({ data: [{ a: 1 }, { a: 2 }] }),
    };

    render(
      <SchemaRendererProvider dataSource={contextDs}>
        <ObjectMetricWidget {...baseProps} dataSource={propDs} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    expect(propDs.find).toHaveBeenCalled();
    expect(contextDs.find).not.toHaveBeenCalled();
  });
});
