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
});
