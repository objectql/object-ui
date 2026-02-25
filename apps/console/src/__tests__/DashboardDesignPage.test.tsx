/**
 * DashboardDesignPage Tests
 *
 * Tests the Dashboard Design route integration (/design/dashboard/:dashboardName)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardDesignPage } from '../pages/DashboardDesignPage';

// Mock MetadataProvider
const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: [],
    dashboards: [
      {
        name: 'sales-dashboard',
        type: 'dashboard',
        title: 'Sales Dashboard',
        label: 'Sales Dashboard',
        columns: 3,
        widgets: [
          { id: 'w1', title: 'Revenue', type: 'metric', layout: { x: 0, y: 0, w: 1, h: 1 } },
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

// Mock plugin-designer to avoid complex component tree
vi.mock('@object-ui/plugin-designer', () => ({
  DashboardEditor: ({ schema, onChange, readOnly }: any) => (
    <div data-testid="dashboard-editor">
      <span>DashboardEditor: {schema.title || schema.name}</span>
      <button data-testid="trigger-change" onClick={() => onChange({ ...schema, title: 'Updated Dashboard' })}>
        Change
      </button>
      {readOnly && <span>read-only</span>}
    </div>
  ),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const renderWithRouter = (dashboardName: string) =>
  render(
    <MemoryRouter initialEntries={[`/design/dashboard/${dashboardName}`]}>
      <Routes>
        <Route path="/design/dashboard/:dashboardName" element={<DashboardDesignPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('DashboardDesignPage', () => {
  it('should render the dashboard editor for a known dashboard', () => {
    renderWithRouter('sales-dashboard');

    expect(screen.getByTestId('dashboard-design-page')).toBeInTheDocument();
    expect(screen.getByText(/Edit Dashboard/)).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-editor')).toBeInTheDocument();
  });

  it('should show 404 for unknown dashboard', () => {
    renderWithRouter('unknown-dashboard');

    expect(screen.getByText(/Dashboard.*not found/i)).toBeInTheDocument();
  });

  it('should render back button', () => {
    renderWithRouter('sales-dashboard');

    expect(screen.getByTestId('dashboard-design-back')).toBeInTheDocument();
  });

  it('should pass schema to the editor', () => {
    renderWithRouter('sales-dashboard');

    expect(screen.getByText(/DashboardEditor: Sales Dashboard/)).toBeInTheDocument();
  });

  it('should call onChange when editor triggers a change', () => {
    renderWithRouter('sales-dashboard');

    fireEvent.click(screen.getByTestId('trigger-change'));
    // After change, editor should reflect updated schema
    expect(screen.getByText(/DashboardEditor: Updated Dashboard/)).toBeInTheDocument();
  });

  it('should save via Ctrl+S keyboard shortcut', async () => {
    renderWithRouter('sales-dashboard');

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    });

    // Should call dataSource.update with the dashboard schema
    expect(mockUpdate).toHaveBeenCalledWith('sys_dashboard', 'sales-dashboard', expect.objectContaining({ type: 'dashboard' }));
  });

  it('should refresh metadata after save via onChange', async () => {
    renderWithRouter('sales-dashboard');
    mockRefresh.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-change'));
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should refresh metadata after Ctrl+S save', async () => {
    renderWithRouter('sales-dashboard');
    mockRefresh.mockClear();

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });
});
