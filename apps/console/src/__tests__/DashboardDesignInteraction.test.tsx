/**
 * DashboardView Design Interaction Tests
 *
 * Verifies the fixes for:
 * - Non-modal DesignDrawer allowing preview widget clicks
 * - Property panel appearing above widget grid when a widget is selected
 * - Click-to-select in preview area with highlight and property linkage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardView } from '../components/DashboardView';

// Track calls passed to mocked components
const { editorCalls, rendererCalls } = vi.hoisted(() => ({
  editorCalls: {
    selectedWidgetId: null as string | null,
    onWidgetSelect: null as ((id: string | null) => void) | null,
    lastSchema: null as unknown,
  },
  rendererCalls: {
    designMode: false,
    selectedWidgetId: null as string | null,
    onWidgetClick: null as ((id: string | null) => void) | null,
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
}));

// Mock DashboardEditor to capture selection and show property panel
vi.mock('@object-ui/plugin-designer', () => ({
  DashboardEditor: (props: any) => {
    editorCalls.selectedWidgetId = props.selectedWidgetId;
    editorCalls.onWidgetSelect = props.onWidgetSelect;
    editorCalls.lastSchema = props.schema;
    const widget = props.schema?.widgets?.find((w: any) => w.id === props.selectedWidgetId);
    return (
      <div data-testid="dashboard-editor">
        <span data-testid="editor-selected">{props.selectedWidgetId ?? 'none'}</span>
        {widget && (
          <div data-testid="editor-property-panel">
            <span data-testid="editor-widget-title">{widget.title}</span>
          </div>
        )}
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
  editorCalls.lastSchema = null;
  rendererCalls.designMode = false;
  rendererCalls.selectedWidgetId = null;
  rendererCalls.onWidgetClick = null;
});

const renderDashboardView = async () => {
  const result = render(
    <MemoryRouter initialEntries={['/dashboard/crm-dashboard']}>
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

const openDrawer = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('dashboard-edit-button'));
  });
  // Wait for lazy-loaded DashboardEditor to resolve
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
};

describe('Dashboard Design Mode — Non-modal Drawer Interaction', () => {
  it('should open drawer with non-modal behavior (no blocking overlay)', async () => {
    await renderDashboardView();

    await openDrawer();

    // Drawer should be open
    expect(screen.getByTestId('design-drawer')).toBeInTheDocument();
    // Design mode should be enabled
    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('true');
    // Both renderer and editor should be visible simultaneously
    expect(screen.getByTestId('dashboard-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-editor')).toBeInTheDocument();
  });

  it('should allow clicking preview widgets while drawer is open', async () => {
    await renderDashboardView();
    await openDrawer();

    // Click widget in preview area — this verifies the drawer doesn't block clicks
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Widget should be selected in both renderer and editor
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w1');
    expect(screen.getByTestId('editor-selected')).toHaveTextContent('w1');
  });

  it('should show property panel in editor when preview widget is clicked', async () => {
    await renderDashboardView();
    await openDrawer();

    // Click widget in preview
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });

    // Property panel should show the selected widget's properties
    expect(screen.getByTestId('editor-property-panel')).toBeInTheDocument();
    expect(screen.getByTestId('editor-widget-title')).toHaveTextContent('Total Revenue');
  });

  it('should show property panel when clicking editor widget list item', async () => {
    await renderDashboardView();
    await openDrawer();

    // Click widget in editor list
    await act(async () => {
      fireEvent.click(screen.getByTestId('editor-widget-w2'));
    });

    // Property panel should show for the clicked widget
    expect(screen.getByTestId('editor-property-panel')).toBeInTheDocument();
    expect(screen.getByTestId('editor-widget-title')).toHaveTextContent('Revenue Trends');
    // Preview should also reflect the selection
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w2');
  });

  it('should switch selection between different widgets', async () => {
    await renderDashboardView();
    await openDrawer();

    // Select w1
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('editor-widget-title')).toHaveTextContent('Total Revenue');

    // Switch to w3
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w3'));
    });
    expect(screen.getByTestId('editor-widget-title')).toHaveTextContent('Pipeline by Stage');
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w3');
  });

  it('should deselect when clicking empty space in preview', async () => {
    await renderDashboardView();
    await openDrawer();

    // Select a widget
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('editor-property-panel')).toBeInTheDocument();

    // Deselect by calling onWidgetClick(null) (simulates background click)
    await act(async () => {
      rendererCalls.onWidgetClick?.(null);
    });

    // Property panel should be hidden
    expect(screen.queryByTestId('editor-property-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
  });

  it('should clear selection when drawer is closed', async () => {
    await renderDashboardView();

    // Open drawer and select
    await openDrawer();
    await act(async () => {
      fireEvent.click(screen.getByTestId('renderer-widget-w1'));
    });
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('w1');

    // Close the drawer
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    const sheetCloseBtn = closeButtons.find((btn) =>
      btn.closest('[data-testid="design-drawer"]'),
    );
    if (sheetCloseBtn) {
      await act(async () => {
        fireEvent.click(sheetCloseBtn);
      });
    }

    // Selection should be cleared
    expect(screen.getByTestId('renderer-design-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('renderer-selected')).toHaveTextContent('none');
  });
});
