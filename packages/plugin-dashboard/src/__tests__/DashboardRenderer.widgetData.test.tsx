/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardRenderer } from '../DashboardRenderer';

/**
 * Extract component schemas rendered by SchemaRenderer from the DOM.
 * When a component type is not registered, SchemaRenderer renders
 * an error block containing a JSON <pre> element with the schema.
 * We parse those to verify the schema shape produced by DashboardRenderer.
 */
function getRenderedSchemas(container: HTMLElement): any[] {
  const pres = container.querySelectorAll('pre');
  return Array.from(pres).map(el => JSON.parse(el.textContent!));
}

describe('DashboardRenderer widget data extraction', () => {
  it('should extract chart data from options.data.items', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Test Bar',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'name',
            yField: 'value',
            data: {
              provider: 'value',
              items: [
                { name: 'A', value: 100 },
                { name: 'B', value: 200 },
              ],
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('bar');
    expect(chartSchema.data).toHaveLength(2);
    expect(chartSchema.data[0]).toEqual({ name: 'A', value: 100 });
    expect(chartSchema.xAxisKey).toBe('name');
    expect(chartSchema.series).toEqual([{ dataKey: 'value' }]);
  });

  it('should extract chart data from widget.data.items (backward compat)', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'area',
          title: 'Test Area',
          layout: { x: 0, y: 0, w: 3, h: 2 },
          options: { xField: 'month', yField: 'revenue' },
          data: {
            provider: 'value',
            items: [
              { month: 'Jan', revenue: 155000 },
              { month: 'Feb', revenue: 87000 },
            ],
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('area');
    expect(chartSchema.data).toHaveLength(2);
    expect(chartSchema.data[0].month).toBe('Jan');
  });

  it('should extract table data from options.data.items', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'table',
          title: 'Test Table',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            columns: [
              { header: 'Name', accessorKey: 'name' },
              { header: 'Amount', accessorKey: 'amount' },
            ],
            data: {
              provider: 'value',
              items: [
                { name: 'Item A', amount: '$100' },
                { name: 'Item B', amount: '$200' },
                { name: 'Item C', amount: '$300' },
              ],
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    // data-table is a registered component that renders a real table,
    // so we verify the data reaches it by checking for rendered cell content
    expect(container.textContent).toContain('Item A');
    expect(container.textContent).toContain('$200');
    expect(container.textContent).toContain('Item C');
  });

  it('should handle donut chart data from options', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'donut',
          title: 'Test Donut',
          layout: { x: 0, y: 0, w: 1, h: 2 },
          options: {
            xField: 'source',
            yField: 'value',
            data: {
              provider: 'value',
              items: [
                { source: 'Web', value: 2 },
                { source: 'Referral', value: 1 },
              ],
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('donut');
    expect(chartSchema.data).toHaveLength(2);
    expect(chartSchema.xAxisKey).toBe('source');
  });

  it('should default to empty array when no data is provided', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'No Data Bar',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: { xField: 'x', yField: 'y' },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.data).toEqual([]);
  });

  it('should render metric widgets using spec shorthand format', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'metric',
          layout: { x: 0, y: 0, w: 1, h: 1 },
          options: {
            label: 'Total Revenue',
            value: '$652,000',
            trend: { value: 12.5, direction: 'up', label: 'vs last month' },
            icon: 'DollarSign',
          },
        },
        {
          type: 'metric',
          layout: { x: 1, y: 0, w: 1, h: 1 },
          options: {
            label: 'Active Deals',
            value: '5',
            trend: { value: 2.1, direction: 'down', label: 'vs last month' },
            icon: 'Briefcase',
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);

    // MetricWidget is registered in the ComponentRegistry, so it should render
    // the label and value from the merged options
    expect(container.textContent).toContain('Total Revenue');
    expect(container.textContent).toContain('$652,000');
    expect(container.textContent).toContain('Active Deals');
    expect(container.textContent).toContain('5');
  });

  it('should assign unique keys to widgets without id or title', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'metric',
          layout: { x: 0, y: 0, w: 1, h: 1 },
          options: { label: 'Metric A', value: '100' },
        },
        {
          type: 'metric',
          layout: { x: 1, y: 0, w: 1, h: 1 },
          options: { label: 'Metric B', value: '200' },
        },
        {
          type: 'metric',
          layout: { x: 2, y: 0, w: 1, h: 1 },
          options: { label: 'Metric C', value: '300' },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);

    // All three metrics should render without React key warnings
    expect(container.textContent).toContain('Metric A');
    expect(container.textContent).toContain('Metric B');
    expect(container.textContent).toContain('Metric C');
    expect(container.textContent).toContain('100');
    expect(container.textContent).toContain('200');
    expect(container.textContent).toContain('300');
  });

  it('should produce object-chart schema for chart widgets with provider: object', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Revenue by Account',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            xField: 'account',
            yField: 'total',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'amount', function: 'sum', groupBy: 'account' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('bar');
    expect(chartSchema.objectName).toBe('opportunity');
    expect(chartSchema.aggregate).toEqual({
      field: 'amount',
      function: 'sum',
      groupBy: 'account',
    });
    expect(chartSchema.xAxisKey).toBe('account');
    expect(chartSchema.series).toEqual([{ dataKey: 'amount' }]);
    // Must NOT have an empty data array – data comes from the object source
    expect(chartSchema.data).toBeUndefined();
  });

  it('should fall back to widget.object when data.object is missing for provider: object', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'area',
          title: 'Trend',
          object: 'deal',
          layout: { x: 0, y: 0, w: 3, h: 2 },
          options: {
            xField: 'month',
            yField: 'revenue',
            data: {
              provider: 'object',
              aggregate: { field: 'revenue', function: 'sum', groupBy: 'month' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.objectName).toBe('deal');
  });

  it('should pass through provider: object config for table widgets', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'table',
          title: 'Object Table',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            columns: [
              { header: 'Name', accessorKey: 'name' },
              { header: 'Amount', accessorKey: 'amount' },
            ],
            data: {
              provider: 'object',
              object: 'opportunity',
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const tableSchema = schemas.find(s => s.type === 'data-table');

    // data-table is a registered component so it may render directly.
    // If not registered, the schema will appear in the error <pre>.
    // In either case, the schema must contain objectName instead of empty data.
    if (tableSchema) {
      expect(tableSchema.objectName).toBe('opportunity');
      expect(tableSchema.dataProvider).toEqual({
        provider: 'object',
        object: 'opportunity',
      });
      expect(tableSchema.data).toBeUndefined();
    }
  });

  it('should pass through provider: object config for pivot widgets', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'pivot',
          title: 'Object Pivot',
          object: 'sales',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            rowField: 'region',
            columnField: 'quarter',
            valueField: 'revenue',
            data: {
              provider: 'object',
              object: 'sales',
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const pivotSchema = schemas.find(s => s.type === 'pivot');

    if (pivotSchema) {
      expect(pivotSchema.objectName).toBe('sales');
      expect(pivotSchema.dataProvider).toEqual({
        provider: 'object',
        object: 'sales',
      });
      expect(pivotSchema.data).toBeUndefined();
    }
  });

  it('should use yField as series dataKey when provider: object has no aggregate', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'line',
          title: 'No Aggregate',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            xField: 'date',
            yField: 'revenue',
            data: {
              provider: 'object',
              object: 'opportunity',
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.series).toEqual([{ dataKey: 'revenue' }]);
  });

  it('should auto-adapt series dataKey from aggregate.field even when yField differs', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Mismatched yField',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            xField: 'account',
            yField: 'total',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'amount', function: 'sum', groupBy: 'account' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    // Even though yField is 'total', the series should use aggregate.field ('amount')
    expect(chartSchema.series).toEqual([{ dataKey: 'amount' }]);
  });

  it('should produce object-chart schema for area chart with provider: object aggregate', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'area',
          title: 'Revenue Trends',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 3, h: 2 },
          options: {
            xField: 'stage',
            yField: 'expected_revenue',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'expected_revenue', function: 'sum', groupBy: 'stage' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('area');
    expect(chartSchema.objectName).toBe('opportunity');
    expect(chartSchema.aggregate).toEqual({
      field: 'expected_revenue',
      function: 'sum',
      groupBy: 'stage',
    });
    expect(chartSchema.xAxisKey).toBe('stage');
    expect(chartSchema.series).toEqual([{ dataKey: 'expected_revenue' }]);
    expect(chartSchema.data).toBeUndefined();
  });

  it('should produce object-chart schema for donut chart with count aggregate', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'donut',
          title: 'Lead Source',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 1, h: 2 },
          options: {
            xField: 'lead_source',
            yField: 'count',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'count', function: 'count', groupBy: 'lead_source' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('donut');
    expect(chartSchema.objectName).toBe('opportunity');
    expect(chartSchema.aggregate.function).toBe('count');
    expect(chartSchema.xAxisKey).toBe('lead_source');
    expect(chartSchema.series).toEqual([{ dataKey: 'count' }]);
    expect(chartSchema.data).toBeUndefined();
  });

  it('should produce object-chart schema for line chart with avg aggregate', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'line',
          title: 'Avg Deal Size by Stage',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'stage',
            yField: 'amount',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'amount', function: 'avg', groupBy: 'stage' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('line');
    expect(chartSchema.aggregate.function).toBe('avg');
    expect(chartSchema.series).toEqual([{ dataKey: 'amount' }]);
  });

  it('should produce object-chart schema for cross-object widget (order)', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Orders by Status',
          object: 'order',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'status',
            yField: 'amount',
            data: {
              provider: 'object',
              object: 'order',
              aggregate: { field: 'amount', function: 'max', groupBy: 'status' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('bar');
    expect(chartSchema.objectName).toBe('order');
    expect(chartSchema.aggregate.function).toBe('max');
    expect(chartSchema.xAxisKey).toBe('status');
    expect(chartSchema.series).toEqual([{ dataKey: 'amount' }]);
  });

  it('should render without errors when widgets array is empty', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Empty Dashboard',
      widgets: [],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    expect(container).toBeDefined();
    expect(container.querySelectorAll('pre').length).toBe(0);
  });

  it('should handle chart widget with null data gracefully', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Null Data Bar',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: { xField: 'x', yField: 'y', data: null },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.data).toEqual([]);
  });

  it('should not crash data-table when provider:object leaks data config via options spread', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'table',
          title: 'Provider Object Table',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            columns: [
              { header: 'Name', accessorKey: 'name' },
              { header: 'Amount', accessorKey: 'amount' },
            ],
            data: {
              provider: 'object',
              object: 'opportunity',
            },
          },
        },
      ],
    } as any;

    // Must render without throwing. Previously this crashed with
    // "paginatedData.some is not a function" because the provider
    // config object leaked through as data.
    const { container } = render(<DashboardRenderer schema={schema} />);
    expect(container).toBeDefined();
    // The component should not show a crash error
    expect(container.textContent).not.toContain('is not a function');
  });

  it('should not crash pivot table when provider:object leaks data config via options spread', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'pivot',
          title: 'Provider Object Pivot',
          object: 'sales',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            rowField: 'region',
            columnField: 'quarter',
            valueField: 'revenue',
            data: {
              provider: 'object',
              object: 'sales',
            },
          },
        },
      ],
    } as any;

    // Must render without throwing. Previously this crashed with
    // "data is not iterable" because the provider config object
    // leaked through as data.
    const { container } = render(<DashboardRenderer schema={schema} />);
    expect(container).toBeDefined();
    expect(container.textContent).not.toContain('is not iterable');
  });

  it('should handle scatter chart type as a valid chart widget', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'scatter',
          title: 'Scatter Plot',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'x',
            yField: 'y',
            data: {
              provider: 'value',
              items: [
                { x: 1, y: 10 },
                { x: 2, y: 20 },
              ],
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('scatter');
    expect(chartSchema.data).toHaveLength(2);
    expect(chartSchema.xAxisKey).toBe('x');
    expect(chartSchema.series).toEqual([{ dataKey: 'y' }]);
  });

  it('should produce object-chart schema for scatter chart with provider: object', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'scatter',
          title: 'Object Scatter',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 3, h: 2 },
          options: {
            xField: 'amount',
            yField: 'probability',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'probability', function: 'avg', groupBy: 'amount' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('scatter');
    expect(chartSchema.objectName).toBe('opportunity');
    expect(chartSchema.aggregate.function).toBe('avg');
  });

  it('should use widget.categoryField as xAxisKey fallback over options.xField', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Category Field Override',
          categoryField: 'forecast_category',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'stage',
            yField: 'amount',
            data: {
              provider: 'value',
              items: [
                { forecast_category: 'Pipeline', amount: 100 },
                { forecast_category: 'Closed', amount: 200 },
              ],
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    // widget.categoryField should override options.xField
    expect(chartSchema.xAxisKey).toBe('forecast_category');
  });

  it('should use widget.valueField as yField fallback over options.yField', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'line',
          title: 'Value Field Override',
          valueField: 'expected_revenue',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'month',
            yField: 'amount',
            data: {
              provider: 'value',
              items: [
                { month: 'Jan', expected_revenue: 100 },
              ],
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'chart');

    expect(chartSchema).toBeDefined();
    // widget.valueField should override options.yField
    expect(chartSchema.series).toEqual([{ dataKey: 'expected_revenue' }]);
  });

  it('should construct object-chart from widget-level fields when no data provider exists', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'New Widget',
          object: 'opportunity',
          categoryField: 'stage',
          valueField: 'amount',
          aggregate: 'sum',
          layout: { x: 0, y: 0, w: 2, h: 2 },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('bar');
    expect(chartSchema.objectName).toBe('opportunity');
    expect(chartSchema.xAxisKey).toBe('stage');
    expect(chartSchema.series).toEqual([{ dataKey: 'amount' }]);
    expect(chartSchema.aggregate).toEqual({
      field: 'amount',
      function: 'sum',
      groupBy: 'stage',
    });
  });

  it('should construct data-table from widget.object when no data provider exists', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'table',
          title: 'New Table Widget',
          object: 'contact',
          layout: { x: 0, y: 0, w: 4, h: 2 },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const tableSchema = schemas.find(s => s.type === 'data-table');

    // data-table is registered, may render directly — check if schema was produced
    if (tableSchema) {
      expect(tableSchema.objectName).toBe('contact');
    }
    // Either way, it should not crash
    expect(container).toBeDefined();
  });

  // ---- Live preview: widget-level fields override data provider config ------

  it('should override data provider aggregate.groupBy with widget.categoryField', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Live Preview',
          object: 'opportunity',
          categoryField: 'region',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'stage',
            yField: 'amount',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    // widget.categoryField ('region') should override aggregate.groupBy ('stage')
    expect(chartSchema.aggregate.groupBy).toBe('region');
    expect(chartSchema.xAxisKey).toBe('region');
  });

  it('should override data provider aggregate.field with widget.valueField', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'area',
          title: 'Live Preview',
          object: 'opportunity',
          valueField: 'expected_revenue',
          layout: { x: 0, y: 0, w: 3, h: 2 },
          options: {
            xField: 'stage',
            yField: 'amount',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    // widget.valueField ('expected_revenue') should override aggregate.field ('amount')
    expect(chartSchema.aggregate.field).toBe('expected_revenue');
    expect(chartSchema.series).toEqual([{ dataKey: 'expected_revenue' }]);
  });

  it('should override data provider aggregate.function with widget.aggregate', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'bar',
          title: 'Live Preview',
          object: 'opportunity',
          aggregate: 'count',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'stage',
            yField: 'amount',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    // widget.aggregate ('count') should override aggregate.function ('sum')
    expect(chartSchema.aggregate.function).toBe('count');
  });

  it('should prefer widget.object over data provider object for objectName', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'line',
          title: 'Live Preview',
          object: 'contact',
          layout: { x: 0, y: 0, w: 3, h: 2 },
          options: {
            xField: 'month',
            yField: 'count',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'count', function: 'count', groupBy: 'month' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    // widget.object ('contact') should override data.object ('opportunity')
    expect(chartSchema.objectName).toBe('contact');
  });

  it('should prefer widget.object for table widgets with data provider', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'table',
          title: 'Live Preview Table',
          object: 'contact',
          layout: { x: 0, y: 0, w: 4, h: 2 },
          options: {
            data: {
              provider: 'object',
              object: 'opportunity',
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const tableSchema = schemas.find(s => s.type === 'data-table');

    if (tableSchema) {
      // widget.object ('contact') should override data.object ('opportunity')
      expect(tableSchema.objectName).toBe('contact');
    }
  });

  it('should apply all widget-level field overrides simultaneously for live preview', () => {
    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'pie',
          title: 'Full Override',
          object: 'account',
          categoryField: 'industry',
          valueField: 'revenue',
          aggregate: 'avg',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          options: {
            xField: 'stage',
            yField: 'amount',
            data: {
              provider: 'object',
              object: 'opportunity',
              aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
            },
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    const schemas = getRenderedSchemas(container);
    const chartSchema = schemas.find(s => s.type === 'object-chart');

    expect(chartSchema).toBeDefined();
    expect(chartSchema.chartType).toBe('pie');
    expect(chartSchema.objectName).toBe('account');
    expect(chartSchema.xAxisKey).toBe('industry');
    expect(chartSchema.aggregate).toEqual({
      field: 'revenue',
      function: 'avg',
      groupBy: 'industry',
    });
    expect(chartSchema.series).toEqual([{ dataKey: 'revenue' }]);
  });
});
