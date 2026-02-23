/**
 * DashboardEditor Property Panel Layout Tests
 *
 * Verifies that the property panel renders above the widget grid
 * so it's immediately visible in the narrow DesignDrawer context.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardEditor } from '../DashboardEditor';
import type { DashboardSchema } from '@object-ui/types';

const DASHBOARD_WITH_WIDGETS: DashboardSchema = {
  type: 'dashboard',
  title: 'Test Dashboard',
  columns: 2,
  widgets: [
    { id: 'w1', title: 'Revenue', type: 'metric', object: 'orders', valueField: 'amount', aggregate: 'sum' },
    { id: 'w2', title: 'Sales Chart', type: 'bar', object: 'orders', categoryField: 'month' },
  ],
};

describe('DashboardEditor property panel layout', () => {
  it('should render property panel before widget grid in DOM order when widget is selected', () => {
    const { container } = render(
      <DashboardEditor
        schema={DASHBOARD_WITH_WIDGETS}
        onChange={vi.fn()}
        selectedWidgetId="w1"
        onWidgetSelect={vi.fn()}
      />,
    );

    const editor = screen.getByTestId('dashboard-editor');
    const propertyPanel = screen.getByTestId('widget-property-panel');
    const widgetCard = screen.getByTestId('dashboard-widget-w1');

    // Property panel should appear before the widget cards in DOM order
    // compareDocumentPosition bit 4 (DOCUMENT_POSITION_FOLLOWING) means widgetCard comes after propertyPanel
    const position = propertyPanel.compareDocumentPosition(widgetCard);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should render property panel as a direct child of the editor container', () => {
    render(
      <DashboardEditor
        schema={DASHBOARD_WITH_WIDGETS}
        onChange={vi.fn()}
        selectedWidgetId="w1"
        onWidgetSelect={vi.fn()}
      />,
    );

    const editor = screen.getByTestId('dashboard-editor');
    const propertyPanel = screen.getByTestId('widget-property-panel');

    // Property panel should be a direct child of the editor (not nested inside main area)
    expect(propertyPanel.parentElement).toBe(editor);
  });

  it('should use vertical (flex-col) layout for the editor', () => {
    render(
      <DashboardEditor
        schema={DASHBOARD_WITH_WIDGETS}
        onChange={vi.fn()}
        selectedWidgetId="w1"
        onWidgetSelect={vi.fn()}
      />,
    );

    const editor = screen.getByTestId('dashboard-editor');
    // Should use flex-col layout, NOT sm:flex-row
    expect(editor.className).toContain('flex-col');
    expect(editor.className).not.toContain('flex-row');
  });

  it('should not have fixed width on property panel (uses full width in stacked layout)', () => {
    render(
      <DashboardEditor
        schema={DASHBOARD_WITH_WIDGETS}
        onChange={vi.fn()}
        selectedWidgetId="w1"
        onWidgetSelect={vi.fn()}
      />,
    );

    const propertyPanel = screen.getByTestId('widget-property-panel');
    // Should NOT have the old w-72 fixed width class
    expect(propertyPanel.className).not.toContain('w-72');
  });
});
