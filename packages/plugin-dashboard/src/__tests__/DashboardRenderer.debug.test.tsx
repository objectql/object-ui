/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DashboardRenderer } from '../DashboardRenderer';

describe('DashboardRenderer debug mode', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (globalThis as any).OBJECTUI_DEBUG = true;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    (globalThis as any).OBJECTUI_DEBUG = undefined;
  });

  const makeSchema = (debug: boolean) =>
    ({
      type: 'dashboard' as const,
      name: 'test-debug',
      title: 'Debug Dashboard',
      debug,
      widgets: [
        {
          id: 'chart-1',
          type: 'bar',
          title: 'Revenue Chart',
          layout: { x: 0, y: 0, w: 2, h: 2 },
          data: {
            provider: 'object',
            object: 'opportunity',
            aggregate: { function: 'sum', field: 'amount', groupBy: 'stage' },
          },
          options: { xField: 'stage', yField: 'amount' },
        },
        {
          id: 'table-1',
          type: 'table',
          title: 'Orders Table',
          layout: { x: 2, y: 0, w: 2, h: 2 },
          data: {
            provider: 'value',
            items: [{ name: 'Item A', qty: 10 }],
          },
        },
      ],
    } as any);

  it('should render debug overlay when schema.debug is true', () => {
    const { getByTestId } = render(<DashboardRenderer schema={makeSchema(true)} />);
    expect(getByTestId('dashboard-debug-overlay')).toBeTruthy();
  });

  it('should NOT render debug overlay when schema.debug is false', () => {
    const { queryByTestId } = render(<DashboardRenderer schema={makeSchema(false)} />);
    expect(queryByTestId('dashboard-debug-overlay')).toBeNull();
  });

  it('should show widget count and dataSource status in overlay summary', () => {
    const { getByTestId } = render(<DashboardRenderer schema={makeSchema(true)} />);
    const overlay = getByTestId('dashboard-debug-overlay');
    expect(overlay.textContent).toContain('2 widget(s)');
    expect(overlay.textContent).toContain('dataSource');
  });

  it('should expand to show per-widget diagnostics', () => {
    const { getByTestId, queryByTestId } = render(
      <DashboardRenderer schema={makeSchema(true)} />
    );
    // Details not visible by default
    expect(queryByTestId('dashboard-debug-details')).toBeNull();

    // Click toggle to expand
    fireEvent.click(getByTestId('dashboard-debug-toggle'));
    expect(getByTestId('dashboard-debug-details')).toBeTruthy();

    // Should show per-widget info
    expect(getByTestId('debug-widget-chart-1')).toBeTruthy();
    expect(getByTestId('debug-widget-table-1')).toBeTruthy();
  });

  it('should identify provider:object widgets correctly', () => {
    const { getByTestId } = render(<DashboardRenderer schema={makeSchema(true)} />);
    fireEvent.click(getByTestId('dashboard-debug-toggle'));

    const chartDebug = getByTestId('debug-widget-chart-1');
    expect(chartDebug.textContent).toContain('provider:object: ✓');
    expect(chartDebug.textContent).toContain('objectName: opportunity');
    expect(chartDebug.textContent).toContain('aggregate: ✓');
  });

  it('should identify static data widgets correctly', () => {
    const { getByTestId } = render(<DashboardRenderer schema={makeSchema(true)} />);
    fireEvent.click(getByTestId('dashboard-debug-toggle'));

    const tableDebug = getByTestId('debug-widget-table-1');
    expect(tableDebug.textContent).toContain('data: ✓');
    expect(tableDebug.textContent).toContain('provider:object: ✗');
  });

  it('should emit debugLog calls when OBJECTUI_DEBUG is enabled', () => {
    render(<DashboardRenderer schema={makeSchema(true)} />);
    const dashboardLogs = consoleSpy.mock.calls.filter(
      args => typeof args[0] === 'string' && args[0].includes('[dashboard]')
    );
    // Should have at least: 1 dashboard render + 2 widget logs
    expect(dashboardLogs.length).toBeGreaterThanOrEqual(3);
  });
});
