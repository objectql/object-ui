/**
 * DashboardView Design Interaction Tests
 *
 * Verifies the refactored design mode:
 * - Inline config panel (DashboardConfigPanel / WidgetConfigPanel) on the right
 * - Click-to-select in preview area syncs with config panel
 * - Dashboard config panel shows when no widget selected
 * - Widget config panel shows when a widget is selected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardView } from '../components/DashboardView';

// Track props passed to mocked components
const { rendererCalls, dashboardConfigCalls, widgetConfigCalls } = vi.hoisted(() => ({
  rendererCalls: {
    designMode: false,
    selectedWidgetId: null as string | null,
    onWidgetClick: null as ((id: string | null) => void) | null,
  },
  dashboardConfigCalls: {
    open: false,
    onClose: null as (() => void) | null,
    config: null as Record<string, any> | null,
  },
  widgetConfigCalls: {
    open: false,
    onClose: null as (() => void) | null,
    config: null as Record<string, any> | null,
    onSave: null as ((config: Record<string, any>) => void) | null,
    onFieldChange: null as ((field: string, value: any) => void) | null,
  },
}));

// Mock MetadataProvider with a dashboard
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: [],
    dashboards: [
      {
        name: 'crm-dashboard',
        type: 'dashboard',
        title: 'CRM Overview',
        label: 'CRM Overview',
        columns: 2,
        widgets: [
          { id: 'w1', title: 'Total Revenue', type: 'metric', object: 'orders', valueField: 'amount', aggregate: 'sum' },
          { id: 'w2', title: 'Revenue Trends', type: 'line', object: 'orders', categoryField: 'month' },
          { id: 'w3', title: 'Pipeline by Stage', type: 'bar', object: 'opportunities' },
        ],
      },
    ],
    reports: [],
    pages: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// Mock AdapterProvider
const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn().mockResolvedValue({}) }));
vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => ({
    update: mockUpdate,
    create: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock DashboardRenderer to capture design mode props
vi.mock('@object-ui/plugin-dashboard', () => ({
  DashboardRenderer: (props: any) => {
    rendererCalls.designMode = props.designMode;
    rendererCalls.selectedWidgetId = props.selectedWidgetId;
    rendererCalls.onWidgetClick = props.onWidgetClick;
    return (
      <div data-testid="dashboard-renderer">
        <span data-testid="renderer-design-mode">{String(!!props.designMode)}</span>
        <span data-testid="renderer-selected">{props.selectedWidgetId ?? 'none'}</span>
        {props.schema?.widgets?.map((w: any) => (
          <div
            key={w.id}
            data-testid={`renderer-widget-${w.id}`}
            data-widget-title={w.title}
            onClick={() => props.onWidgetClick?.(w.id)}
          >
            {w.title}
          </div>
        ))}
      </div>
    );
  },
  DashboardConfigPanel: (props: any) => {
    dashboardConfigCalls.open = props.open;
    dashboardConfigCalls.onClose = props.onClose;
    dashboardConfigCalls.config = props.config;
    if (!props.open) return null;
    return (
      <div data-testid="dashboard-config-panel">
        <span data-testid="dashboard-config-columns">{props.config?.columns ?? 'none'}</span>
        <button data-testid="dashboard-config-close" onClick={props.onClose}>Close</button>
      </div>
    );
  },
  WidgetConfigPanel: (props: any) => {
    widgetConfigCalls.open = props.open;
    widgetConfigCalls.onClose = props.onClose;
    widgetConfigCalls.config = props.config;
    widgetConfigCalls.onSave = props.onSave;
    widgetConfigCalls.onFieldChange = props.onFieldChange;
    if (!props.open) return null;
    return (
      <div data-testid="widget-config-panel">
        <span data-testid="widget-config-title">{props.config?.title ?? 'none'}</span>
        {props.headerExtra && <div data-testid="widget-config-header-extra">{props.headerExtra}</div>}
        <button data-testid="widget-config-close" onClick={props.onClose}>Close</button>
      </div>
    );
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  mockUpdate.mockClear();
  rendererCalls.designMode = false;
  rendererCalls.selectedWidgetId = null;
  rendererCalls.onWidgetClick = null;
  dashboardConfigCalls.open = false;
  dashboardConfigCalls.onClose = null;
  dashboardConfigCalls.config = null;
  widgetConfigCalls.open = false;
  widgetConfigCalls.onClose = null;
  widgetConfigCalls.config = null;
  widgetConfigCalls.onSave = null;
  widgetConfigCalls.onFieldChange = null;
});

const renderDashboardView = async () => {
  const result = render(
    <MemoryRouter initialEntries={['/dashboard/crm-dashboard']}>
      <Routes>
        <Route path="/dashboard/:dashboardName" element={<DashboardView />} />
      </Routes>
    </MemoryRouter>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  return result;
};

const openConfigPanel = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
  });
};

describe('Dashboard Design Mode — Inline Config Panel', () => {
  it('should show dashboard config panel when edit button is clicked (no widget selected)', async () => {
    await renderDashboardView();
    await openConfigPanel();

    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('true');
    expect(screen.getByTestId('dashboard-config-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-config-panel')).not.toBeInTheDocument();
  });

  it('should show widget config panel when a widget is clicked in preview', async () => {
    await renderDashboardView();
    await openConfigPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    expect(screen.getByTestId('widget-config-panel')).toBeInTheDocument();
    expect(screen.getByTestId('widget-config-title')).toHaveTextContent('Total Revenue');
    expect(screen.queryByTestId('dashboard-config-panel')).not.toBeInTheDocument();
  });

  it('should switch back to dashboard config when widget is deselected', async () => {
    await renderDashboardView();
    await openConfigPanel();

    // Select a widget
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('widget-config-panel')).toBeInTheDocument();

    // Deselect by clicking null
    await act(async () => {
      rendererCalls.onWidgetClick?.(null);
    });

    expect(screen.getByTestId('dashboard-config-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-config-panel')).not.toBeInTheDocument();
  });

  it('should switch between different widgets', async () => {
    await renderDashboardView();
    await openConfigPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('widget-config-title')).toHaveTextContent('Total Revenue');

    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w3'));
    });
    expect(screen.getByTestId('widget-config-title')).toHaveTextContent('Pipeline by Stage');
  });

  it('should show add-widget toolbar in edit mode', async () => {
    await renderDashboardView();
    expect(screen.queryByTestId('dashboard-widget-toolbar')).not.toBeInTheDocument();

    await openConfigPanel();
    expect(screen.getByTestId('dashboard-widget-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-add-metric')).toBeInTheDocument();
  });

  it('should not show DesignDrawer (no Sheet overlay)', async () => {
    await renderDashboardView();
    await openConfigPanel();
    expect(screen.queryByTestId('design-drawer')).not.toBeInTheDocument();
  });

  it('should close config panel and clear selection on close', async () => {
    await renderDashboardView();
    await openConfigPanel();

    // Select a widget
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Close via widget config panel close button
    await act(async () => {
      fireEvent.click(screen.getByTestId('widget-config-close'));
    });

    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
  });

  it('should show delete button in widget config panel header', async () => {
    await renderDashboardView();
    await openConfigPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    expect(screen.getByTestId('widget-config-header-extra')).toBeInTheDocument();
    expect(screen.getByTestId('widget-delete-button')).toBeInTheDocument();
  });

  it('should remove widget and switch to dashboard config when delete is clicked', async () => {
    await renderDashboardView();
    await openConfigPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('widget-config-panel')).toBeInTheDocument();

    // Click the delete button
    await act(async () => {
      fireEvent.click(screen.getByTestId('widget-delete-button'));
    });

    // Should switch back to dashboard config (widget deselected)
    expect(screen.getByTestId('dashboard-config-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-config-panel')).not.toBeInTheDocument();
    // Deleted widget should be removed from the preview
    expect(screen.queryByTestId('renderer-widget-w1')).not.toBeInTheDocument();
    // Backend should be called to persist the deletion
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should preserve live preview when field changes via onFieldChange', async () => {
    await renderDashboardView();
    await openConfigPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Simulate a live field change via onFieldChange
    await act(async () => {
      widgetConfigCalls.onFieldChange?.('title', 'Live Title');
    });

    // Preview should update live
    expect(screen.getByTestId('renderer-widget-w1')).toHaveTextContent('Live Title');
    // Config panel should still show the widget (not reset or disappear)
    expect(screen.getByTestId('widget-config-panel')).toBeInTheDocument();
  });
});
