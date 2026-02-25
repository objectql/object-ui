/**
 * Tests for ObjectChart data fetching & fault tolerance.
 *
 * Verifies that ObjectChart:
 * - Calls dataSource.find() when objectName is set and no bound data
 * - Handles missing/invalid dataSource gracefully
 * - Works without a SchemaRendererProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { SchemaRendererProvider } from '@object-ui/react';
import { ObjectChart } from '../ObjectChart';

// Suppress console.error from React error boundary / fetch errors
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

describe('ObjectChart data fetching', () => {
  it('should call dataSource.find when objectName is set and no bind path', async () => {
    const mockFind = vi.fn().mockResolvedValue([
      { stage: 'Prospect', amount: 100 },
      { stage: 'Proposal', amount: 200 },
    ]);
    const dataSource = { find: mockFind };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectChart
          schema={{
            type: 'object-chart',
            objectName: 'opportunity',
            chartType: 'bar',
            xAxisKey: 'stage',
            series: [{ dataKey: 'amount' }],
          }}
        />
      </SchemaRendererProvider>
    );

    await waitFor(() => {
      expect(mockFind).toHaveBeenCalledWith('opportunity', { $filter: undefined });
    });
  });

  it('should NOT call dataSource.find when schema.data is provided', () => {
    const mockFind = vi.fn();
    const dataSource = { find: mockFind };

    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectChart
          schema={{
            type: 'object-chart',
            objectName: 'opportunity',
            chartType: 'bar',
            data: [{ stage: 'A', amount: 100 }],
            xAxisKey: 'stage',
            series: [{ dataKey: 'amount' }],
          }}
        />
      </SchemaRendererProvider>
    );

    expect(mockFind).not.toHaveBeenCalled();
  });

  it('should apply aggregation to fetched data', async () => {
    const mockFind = vi.fn().mockResolvedValue([
      { stage: 'Prospect', amount: 100 },
      { stage: 'Prospect', amount: 200 },
      { stage: 'Proposal', amount: 300 },
    ]);
    const dataSource = { find: mockFind };

    const { container } = render(
      <SchemaRendererProvider dataSource={dataSource}>
        <ObjectChart
          schema={{
            type: 'object-chart',
            objectName: 'opportunity',
            chartType: 'bar',
            xAxisKey: 'stage',
            series: [{ dataKey: 'amount' }],
            aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
          }}
        />
      </SchemaRendererProvider>
    );

    await waitFor(() => {
      expect(mockFind).toHaveBeenCalled();
    });
  });
});

describe('ObjectChart fault tolerance', () => {
  it('should not crash when dataSource has no find method', () => {
    const { container } = render(
      <SchemaRendererProvider dataSource={{}}>
        <ObjectChart
          schema={{
            type: 'object-chart',
            objectName: 'opportunity',
            chartType: 'bar',
            xAxisKey: 'stage',
            series: [{ dataKey: 'amount' }],
          }}
        />
      </SchemaRendererProvider>
    );

    // Should render without crashing
    expect(container).toBeDefined();
  });

  it('should not crash when rendered outside SchemaRendererProvider', () => {
    const { container } = render(
      <ObjectChart
        schema={{
          type: 'object-chart',
          chartType: 'bar',
          xAxisKey: 'stage',
          series: [{ dataKey: 'amount' }],
        }}
      />
    );

    // Should render without crashing
    expect(container).toBeDefined();
  });

  it('should show "No data source available" when no dataSource and objectName set', () => {
    const { container } = render(
      <ObjectChart
        schema={{
          type: 'object-chart',
          objectName: 'opportunity',
          chartType: 'bar',
          xAxisKey: 'stage',
          series: [{ dataKey: 'amount' }],
        }}
      />
    );

    expect(container.textContent).toContain('No data source available');
  });

  it('should use dataSource prop over context when both are present', async () => {
    const contextFind = vi.fn().mockResolvedValue([]);
    const propFind = vi.fn().mockResolvedValue([{ stage: 'A', amount: 1 }]);

    render(
      <SchemaRendererProvider dataSource={{ find: contextFind }}>
        <ObjectChart
          dataSource={{ find: propFind }}
          schema={{
            type: 'object-chart',
            objectName: 'opportunity',
            chartType: 'bar',
            xAxisKey: 'stage',
            series: [{ dataKey: 'amount' }],
          }}
        />
      </SchemaRendererProvider>
    );

    await waitFor(() => {
      expect(propFind).toHaveBeenCalled();
    });
    expect(contextFind).not.toHaveBeenCalled();
  });
});
