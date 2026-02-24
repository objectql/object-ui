/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardWithConfig } from '../DashboardWithConfig';
import type { DashboardSchema } from '@object-ui/types';

// Mock SchemaRenderer to avoid deep component tree
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: any) => (
    <div data-testid="schema-renderer">{schema?.type ?? 'unknown'}</div>
  ),
}));

const sampleSchema: DashboardSchema = {
  type: 'dashboard',
  columns: 3,
  gap: 4,
  widgets: [
    {
      id: 'widget-1',
      title: 'Revenue',
      type: 'metric',
      component: { type: 'metric', label: 'Revenue', value: '$100K' },
    },
    {
      id: 'widget-2',
      title: 'Users',
      type: 'bar',
      object: 'users',
      categoryField: 'role',
      valueField: 'count',
      layout: { x: 0, y: 1, w: 2, h: 1 },
    },
  ],
};

const sampleConfig = {
  columns: 3,
  gap: 4,
  rowHeight: '120',
  refreshInterval: '0',
  title: 'My Dashboard',
  showDescription: true,
  theme: 'auto',
};

describe('DashboardWithConfig', () => {
  it('should render the dashboard container', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('dashboard-with-config')).toBeDefined();
  });

  it('should render the settings toggle button', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('dashboard-config-toggle')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('should not show config panel by default', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('config-panel')).toBeNull();
  });

  it('should show config panel when defaultConfigOpen is true', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
        defaultConfigOpen={true}
      />,
    );
    expect(screen.getByTestId('config-panel')).toBeDefined();
  });

  it('should toggle config panel when settings button is clicked', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
      />,
    );
    // Initially closed
    expect(screen.queryByTestId('config-panel')).toBeNull();

    // Open
    fireEvent.click(screen.getByTestId('dashboard-config-toggle'));
    expect(screen.getByTestId('config-panel')).toBeDefined();

    // Close
    fireEvent.click(screen.getByTestId('dashboard-config-toggle'));
    expect(screen.queryByTestId('config-panel')).toBeNull();
  });

  it('should show dashboard breadcrumb in config panel', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
        defaultConfigOpen={true}
      />,
    );
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Configuration')).toBeDefined();
  });

  it('should close config panel via close button', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
        defaultConfigOpen={true}
      />,
    );
    fireEvent.click(screen.getByTestId('config-panel-close'));
    expect(screen.queryByTestId('config-panel')).toBeNull();
  });

  it('should call onConfigSave when saving dashboard config', () => {
    const onConfigSave = vi.fn();
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={onConfigSave}
        defaultConfigOpen={true}
      />,
    );
    // Trigger a change to make the panel dirty
    const rowHeightInput = screen.getByTestId('config-field-rowHeight');
    fireEvent.change(rowHeightInput, { target: { value: '200' } });
    // Save
    fireEvent.click(screen.getByTestId('config-panel-save'));
    expect(onConfigSave).toHaveBeenCalledTimes(1);
    expect(onConfigSave.mock.calls[0][0].rowHeight).toBe('200');
  });

  it('should apply className to container', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
        className="custom-class"
      />,
    );
    const container = screen.getByTestId('dashboard-with-config');
    expect(container.className).toContain('custom-class');
  });

  it('should show Dashboard > Configuration breadcrumb when no widget is selected', () => {
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
        defaultConfigOpen={true}
      />,
    );
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Configuration')).toBeDefined();
    // Widget breadcrumb should NOT be present
    expect(screen.queryByText('Widget')).toBeNull();
  });

  it('should accept onWidgetSave prop without errors', () => {
    const onWidgetSave = vi.fn();
    render(
      <DashboardWithConfig
        schema={sampleSchema}
        config={sampleConfig}
        onConfigSave={vi.fn()}
        onWidgetSave={onWidgetSave}
        defaultConfigOpen={true}
      />,
    );
    // Config panel should open showing Dashboard config by default (no widget selected)
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Configuration')).toBeDefined();
    expect(screen.queryByText('Widget')).toBeNull();
  });
});
