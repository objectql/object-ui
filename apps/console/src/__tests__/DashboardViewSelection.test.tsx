/**
 * DashboardView Selection Sync Tests
 *
 * Integration tests verifying the full click-to-select flow:
 * Preview widget click → editor panel shows properties → edit property → preview updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardView } from '../components/DashboardView';

// Track the latest onWidgetSelect and selectedWidgetId passed to DashboardEditor
const { editorCalls, rendererCalls } = vi.hoisted(() => ({
  editorCalls: { selectedWidgetId: null as string | null, onWidgetSelect: null as ((id: string | null) => void) | null, lastOnChange: null as ((s: any) => void) | null },
  rendererCalls: { designMode: false, selectedWidgetId: null as string | null, onWidgetClick: null as ((id: string | null) => void) | null },
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

// Mock DashboardRenderer to capture designMode, selectedWidgetId, and onWidgetClick
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
}));

// Mock DashboardEditor to capture selectedWidgetId and onWidgetSelect
vi.mock('@object-ui/plugin-designer', () => ({
  DashboardEditor: (props: any) => {
    editorCalls.selectedWidgetId = props.selectedWidgetId;
    editorCalls.onWidgetSelect = props.onWidgetSelect;
    editorCalls.lastOnChange = props.onChange;
    const widget = props.schema?.widgets?.find((w: any) => w.id === props.selectedWidgetId);
    return (
      <div data-testid="dashboard-editor">
        <span data-testid="editor-selected">{props.selectedWidgetId ?? 'none'}</span>
        {widget && (
          <div data-testid="editor-property-panel">
            <span data-testid="editor-widget-title">{widget.title}</span>
            <button
              data-testid="editor-change-title"
              onClick={() => {
                const updated = {
                  ...props.schema,
                  widgets: props.schema.widgets.map((w: any) =>
                    w.id === props.selectedWidgetId
                      ? { ...w, title: 'Updated Revenue' }
                      : w,
                  ),
                };
                props.onChange(updated);
              }}
            >
              Change Title
            </button>
          </div>
        )}
        {/* Clicking a widget in the editor list */}
        {props.schema?.widgets?.map((w: any) => (
          <button
            key={w.id}
            data-testid={`editor-widget-${w.id}`}
            onClick={() => props.onWidgetSelect?.(w.id)}
          >
            {w.title}
          </button>
        ))}
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

// Mock Radix Dialog portal to render inline for testing
vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual('@radix-ui/react-dialog');
  return {
    ...(actual as Record<string, unknown>),
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

beforeEach(() => {
  mockUpdate.mockClear();
  editorCalls.selectedWidgetId = null;
  editorCalls.onWidgetSelect = null;
  editorCalls.lastOnChange = null;
  rendererCalls.designMode = false;
  rendererCalls.selectedWidgetId = null;
  rendererCalls.onWidgetClick = null;
});

const renderDashboardView = async () => {
  const result = render(
    <MemoryRouter initialEntries={['/dashboard/sales']}>
      <Routes>
        <Route path="/dashboard/:dashboardName" element={<DashboardView />} />
      </Routes>
    </MemoryRouter>,
  );
  // Wait for the queueMicrotask loading state to resolve
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  return result;
};

describe('DashboardView — Selection Sync Integration', () => {
  it('should not enable design mode when drawer is closed', async () => {
    await renderDashboardView();

    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
  });

  it('should enable design mode when drawer is opened', async () => {
    await renderDashboardView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('true');
  });

  it('should sync widget selection from preview to editor when clicking a widget', async () => {
    await renderDashboardView();

    // Open drawer
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    // Click widget w1 in the preview area
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Both renderer and editor should show w1 as selected
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w1');
    expect(screen.getByTestId('editor-selected')).toHaveTextContent('w1');
    // Editor should show property panel for w1
    expect(screen.getByTestId('editor-property-panel')).toBeInTheDocument();
    expect(screen.getByTestId('editor-widget-title')).toHaveTextContent('Revenue');
  });

  it('should sync widget selection from editor to preview', async () => {
    await renderDashboardView();

    // Open drawer
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    // Click widget w2 in the editor
    await act(async () => {
      fireEvent.click(screen.getByTestId('editor-widget-w2'));
    });

    // Both should show w2 selected
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w2');
    expect(screen.getByTestId('editor-selected')).toHaveTextContent('w2');
  });

  it('should update preview when property is edited in the editor panel', async () => {
    await renderDashboardView();

    // Open drawer
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    // Select widget w1 in preview
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Edit the title in the property panel
    await act(async () => {
      fireEvent.click(screen.getByTestId('editor-change-title'));
    });

    // Preview should now show the updated title
    expect(screen.getByTestId('renderer-widget-w1')).toHaveTextContent('Updated Revenue');
  });

  it('should deselect when clicking background (null selection)', async () => {
    await renderDashboardView();

    // Open drawer
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    // Select w1
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('editor-property-panel')).toBeInTheDocument();

    // Simulate background click by calling onWidgetClick(null)
    await act(async () => {
      rendererCalls.onWidgetClick?.(null);
    });

    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
    expect(screen.getByTestId('editor-selected')).toHaveTextContent('none');
    expect(screen.queryByTestId('editor-property-panel')).not.toBeInTheDocument();
  });

  it('should clear selection when drawer is closed', async () => {
    await renderDashboardView();

    // Open drawer and select a widget
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w1');

    // Close the drawer via the Sheet's close button (sr-only "Close" text)
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    const sheetCloseBtn = closeButtons.find((btn) =>
      btn.closest('[data-testid="design-drawer"]'),
    );
    if (sheetCloseBtn) {
      await act(async () => {
        fireEvent.click(sheetCloseBtn);
      });
    }

    // After close, design mode should be off and selection cleared
    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
  });

  it('should auto-save property changes to backend', async () => {
    await renderDashboardView();

    // Open drawer
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-edit-button'));
    });

    // Select and edit
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('editor-change-title'));
    });

    // Backend should be called with updated schema
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
});
