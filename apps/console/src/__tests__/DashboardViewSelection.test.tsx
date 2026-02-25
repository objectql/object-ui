/**
 * DashboardView Selection Sync Tests
 *
 * Integration tests verifying the full click-to-select flow with inline config panels:
 * Preview widget click → config panel switches → edit property → preview updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardView } from '../components/DashboardView';

// Track the latest props passed to mocked components
const { rendererCalls, dashboardConfigCalls, widgetConfigCalls, mockRefresh } = vi.hoisted(() => ({
  rendererCalls: {
    designMode: false,
    selectedWidgetId: null as string | null,
    onWidgetClick: null as ((id: string | null) => void) | null,
    lastSchema: null as any,
  },
  dashboardConfigCalls: {
    open: false,
    config: null as Record<string, any> | null,
    onSave: null as ((config: Record<string, any>) => void) | null,
    onFieldChange: null as ((field: string, value: any) => void) | null,
  },
  widgetConfigCalls: {
    open: false,
    config: null as Record<string, any> | null,
    onSave: null as ((config: Record<string, any>) => void) | null,
    onFieldChange: null as ((field: string, value: any) => void) | null,
    onClose: null as (() => void) | null,
  },
  mockRefresh: vi.fn().mockResolvedValue(undefined),
}));

// Mock MetadataProvider with a dashboard
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: [],
    dashboards: [
      {
        name: 'sales',
        type: 'dashboard',
        title: 'Sales Dashboard',
        label: 'Sales Dashboard',
        columns: 2,
        widgets: [
          { id: 'w1', title: 'Revenue', type: 'metric', object: 'orders', valueField: 'amount', aggregate: 'sum' },
          { id: 'w2', title: 'Sales Chart', type: 'bar', object: 'orders', categoryField: 'month' },
        ],
      },
    ],
    reports: [],
    pages: [],
    loading: false,
    error: null,
    refresh: mockRefresh,
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

// Mock plugin-dashboard components to capture config panel interactions
vi.mock('@object-ui/plugin-dashboard', () => ({
  DashboardRenderer: (props: any) => {
    rendererCalls.designMode = props.designMode;
    rendererCalls.selectedWidgetId = props.selectedWidgetId;
    rendererCalls.onWidgetClick = props.onWidgetClick;
    rendererCalls.lastSchema = props.schema;
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
    dashboardConfigCalls.config = props.config;
    dashboardConfigCalls.onSave = props.onSave;
    dashboardConfigCalls.onFieldChange = props.onFieldChange;
    if (!props.open) return null;
    return (
      <div data-testid="dashboard-config-panel">
        <span data-testid="dashboard-config-title">{props.config?.title ?? 'none'}</span>
      </div>
    );
  },
  WidgetConfigPanel: (props: any) => {
    widgetConfigCalls.open = props.open;
    widgetConfigCalls.config = props.config;
    widgetConfigCalls.onSave = props.onSave;
    widgetConfigCalls.onFieldChange = props.onFieldChange;
    widgetConfigCalls.onClose = props.onClose;
    if (!props.open) return null;
    return (
      <div data-testid="widget-config-panel">
        <span data-testid="widget-config-title">{props.config?.title ?? 'none'}</span>
        {props.headerExtra && <div data-testid="widget-config-header-extra">{props.headerExtra}</div>}
        <button
          data-testid="widget-config-save"
          onClick={() => props.onSave?.({ ...props.config, title: 'Updated Revenue' })}
        >
          Save
        </button>
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
  mockRefresh.mockClear();
  rendererCalls.designMode = false;
  rendererCalls.selectedWidgetId = null;
  rendererCalls.onWidgetClick = null;
  rendererCalls.lastSchema = null;
  dashboardConfigCalls.open = false;
  dashboardConfigCalls.config = null;
  dashboardConfigCalls.onSave = null;
  dashboardConfigCalls.onFieldChange = null;
  widgetConfigCalls.open = false;
  widgetConfigCalls.config = null;
  widgetConfigCalls.onSave = null;
  widgetConfigCalls.onFieldChange = null;
  widgetConfigCalls.onClose = null;
});

const renderDashboardView = async () => {
  const result = render(
    <MemoryRouter initialEntries={['/dashboard/sales']}>
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

describe('DashboardView — Selection Sync Integration', () => {
  it('should not enable design mode when config panel is closed', async () => {
    await renderDashboardView();

    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
  });

  it('should enable design mode when edit button is clicked', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('true');
  });

  it('should show dashboard config panel by default (no widget selected)', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    expect(screen.getByTestId('dashboard-config-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-config-panel')).not.toBeInTheDocument();
  });

  it('should switch to widget config panel when a widget is selected', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w1');
    expect(screen.getByTestId('widget-config-panel')).toBeInTheDocument();
    expect(screen.getByTestId('widget-config-title')).toHaveTextContent('Revenue');
  });

  it('should sync widget selection from preview click', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w2'));
    });

    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w2');
    expect(screen.getByTestId('widget-config-title')).toHaveTextContent('Sales Chart');
  });

  it('should update preview when widget config is saved', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Save updated widget config
    await act(async () => {
      fireEvent.click(screen.getByTestId('widget-config-save'));
    });

    // Preview should reflect the updated title
    expect(screen.getByTestId('renderer-widget-w1')).toHaveTextContent('Updated Revenue');
  });

  it('should deselect when clicking background (null selection)', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('widget-config-panel')).toBeInTheDocument();

    // Simulate background click
    await act(async () => {
      rendererCalls.onWidgetClick?.(null);
    });

    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
    expect(screen.getByTestId('dashboard-config-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-config-panel')).not.toBeInTheDocument();
  });

  it('should clear selection when config panel is closed', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w1');

    // Close the config panel
    await act(async () => {
      widgetConfigCalls.onClose?.();
    });

    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
  });

  it('should auto-save widget config changes to backend', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Save updated config
    await act(async () => {
      fireEvent.click(screen.getByTestId('widget-config-save'));
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'sys_dashboard',
      'sales',
      expect.objectContaining({
        widgets: expect.arrayContaining([
          expect.objectContaining({ id: 'w1', title: 'Updated Revenue' }),
        ]),
      }),
    );
  });

  it('should delete widget and persist to backend', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Click delete
    await act(async () => {
      fireEvent.click(screen.getByTestId('widget-delete-button'));
    });

    // Widget removed from preview
    expect(screen.queryByTestId('renderer-widget-w1')).not.toBeInTheDocument();
    // Remaining widget still present
    expect(screen.getByTestId('renderer-widget-w2')).toBeInTheDocument();
    // Backend should be called without the deleted widget
    expect(mockUpdate).toHaveBeenCalledWith(
      'sys_dashboard',
      'sales',
      expect.objectContaining({
        widgets: expect.not.arrayContaining([
          expect.objectContaining({ id: 'w1' }),
        ]),
      }),
    );
  });

  it('should update preview live when onFieldChange fires without resetting config panel', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Simulate live field change
    await act(async () => {
      widgetConfigCalls.onFieldChange?.('title', 'Live Preview Title');
    });

    // Preview should update
    expect(screen.getByTestId('renderer-widget-w1')).toHaveTextContent('Live Preview Title');
    // Widget config panel should still be visible
    expect(screen.getByTestId('widget-config-panel')).toBeInTheDocument();
  });

  it('should call metadata refresh after widget config save', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    mockRefresh.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId('widget-config-save'));
    });

    // Backend save should trigger metadata refresh
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should call metadata refresh after widget deletion', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    mockRefresh.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId('widget-delete-button'));
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });
});
