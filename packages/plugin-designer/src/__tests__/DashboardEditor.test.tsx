/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardEditor } from '../DashboardEditor';
import type { DashboardSchema } from '@object-ui/types';

const EMPTY_DASHBOARD: DashboardSchema = {
  type: 'dashboard',
  title: 'Test Dashboard',
  columns: 2,
  widgets: [],
};

const DASHBOARD_WITH_WIDGETS: DashboardSchema = {
  type: 'dashboard',
  title: 'Test Dashboard',
  columns: 2,
  widgets: [
    { id: 'w1', title: 'Revenue', type: 'metric', object: 'orders', valueField: 'amount', aggregate: 'sum' },
    { id: 'w2', title: 'Sales Chart', type: 'bar', object: 'orders', categoryField: 'month' },
  ],
};

describe('DashboardEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Rendering
  // ============================
  describe('Rendering', () => {
    it('should render with empty dashboard', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-editor')).toBeDefined();
      expect(screen.getByText(/No widgets/)).toBeDefined();
    });

    it('should render widget add buttons', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-add-metric')).toBeDefined();
      expect(screen.getByTestId('dashboard-add-bar')).toBeDefined();
      expect(screen.getByTestId('dashboard-add-line')).toBeDefined();
      expect(screen.getByTestId('dashboard-add-pie')).toBeDefined();
      expect(screen.getByTestId('dashboard-add-table')).toBeDefined();
      expect(screen.getByTestId('dashboard-add-grid')).toBeDefined();
    });

    it('should render existing widgets', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-widget-w1')).toBeDefined();
      expect(screen.getByTestId('dashboard-widget-w2')).toBeDefined();
    });
  });

  // ============================
  // Adding Widgets
  // ============================
  describe('Adding Widgets', () => {
    it('should add a metric widget', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-add-metric'));
      expect(onChange).toHaveBeenCalledOnce();
      const newSchema = onChange.mock.calls[0][0] as DashboardSchema;
      expect(newSchema.widgets).toHaveLength(1);
      expect(newSchema.widgets[0].type).toBe('metric');
    });

    it('should add a bar chart widget', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-add-bar'));
      const newSchema = onChange.mock.calls[0][0] as DashboardSchema;
      expect(newSchema.widgets[0].type).toBe('bar');
    });
  });

  // ============================
  // Removing Widgets
  // ============================
  describe('Removing Widgets', () => {
    it('should remove a widget', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-widget-remove-w1'));
      expect(onChange).toHaveBeenCalledOnce();
      const newSchema = onChange.mock.calls[0][0] as DashboardSchema;
      expect(newSchema.widgets.find((w) => w.id === 'w1')).toBeUndefined();
    });
  });

  // ============================
  // Widget Selection & Property Panel
  // ============================
  describe('Widget Property Panel', () => {
    it('should show property panel when widget is selected', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-widget-w1'));
      expect(screen.getByTestId('widget-property-panel')).toBeDefined();
      expect(screen.getByTestId('widget-prop-title')).toBeDefined();
      expect(screen.getByTestId('widget-prop-type')).toBeDefined();
    });

    it('should update widget title via property panel', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      // Select widget
      fireEvent.click(screen.getByTestId('dashboard-widget-w1'));
      // Edit title
      fireEvent.change(screen.getByTestId('widget-prop-title'), { target: { value: 'New Title' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('should update widget data source', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-widget-w1'));
      fireEvent.change(screen.getByTestId('widget-prop-object'), { target: { value: 'products' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('should show widget layout size inputs', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-widget-w1'));
      expect(screen.getByTestId('widget-prop-width')).toBeDefined();
      expect(screen.getByTestId('widget-prop-height')).toBeDefined();
    });
  });

  // ============================
  // Read-only Mode
  // ============================
  describe('Read-only Mode', () => {
    it('should disable add buttons in read-only mode', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} readOnly />);
      expect(screen.getByTestId('dashboard-add-metric').hasAttribute('disabled')).toBe(true);
    });
  });

  // ============================
  // Undo/Redo
  // ============================
  describe('Undo/Redo', () => {
    it('should render undo/redo buttons', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-undo')).toBeDefined();
      expect(screen.getByTestId('dashboard-redo')).toBeDefined();
    });

    it('should have undo disabled initially', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-undo').hasAttribute('disabled')).toBe(true);
      expect(screen.getByTestId('dashboard-redo').hasAttribute('disabled')).toBe(true);
    });

    it('should not render undo/redo buttons in read-only mode', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} readOnly />);
      expect(screen.queryByTestId('dashboard-undo')).toBeNull();
      expect(screen.queryByTestId('dashboard-redo')).toBeNull();
    });
  });

  // ============================
  // Export/Import
  // ============================
  describe('Export/Import', () => {
    it('should render export button', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-export')).toBeDefined();
    });

    it('should call onExport when export is clicked', () => {
      const onChange = vi.fn();
      const onExport = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} onExport={onExport} />);
      fireEvent.click(screen.getByTestId('dashboard-export'));
      expect(onExport).toHaveBeenCalledWith(EMPTY_DASHBOARD);
    });

    it('should render import button', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-import')).toBeDefined();
    });

    it('should not render import button in read-only mode', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} readOnly />);
      expect(screen.queryByTestId('dashboard-import')).toBeNull();
    });
  });

  // ============================
  // Preview Mode
  // ============================
  describe('Preview Mode', () => {
    it('should render preview toggle button', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      expect(screen.getByTestId('dashboard-preview-toggle')).toBeDefined();
    });

    it('should show preview when toggle is clicked', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-preview-toggle'));
      expect(screen.getByTestId('dashboard-preview')).toBeDefined();
    });

    it('should hide property panel in preview mode', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={DASHBOARD_WITH_WIDGETS} onChange={onChange} />);
      // Select a widget first
      fireEvent.click(screen.getByTestId('dashboard-widget-w1'));
      expect(screen.getByTestId('widget-property-panel')).toBeDefined();
      // Toggle preview
      fireEvent.click(screen.getByTestId('dashboard-preview-toggle'));
      expect(screen.queryByTestId('widget-property-panel')).toBeNull();
    });

    it('should disable add buttons in preview mode', () => {
      const onChange = vi.fn();
      render(<DashboardEditor schema={EMPTY_DASHBOARD} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('dashboard-preview-toggle'));
      expect(screen.getByTestId('dashboard-add-metric').hasAttribute('disabled')).toBe(true);
    });
  });
});
