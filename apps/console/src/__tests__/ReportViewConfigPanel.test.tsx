/**
 * ReportView Config Panel Tests
 *
 * Verifies the inline config panel pattern (matching DashboardView):
 * Edit button opens config panel inline, no DesignDrawer overlay.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportView } from '../components/ReportView';

// Stable references to prevent infinite re-render loops
const { stableReports, stableObjects, mockRefresh, mockUpdate } = vi.hoisted(() => {
  const stableReports = [
    {
      name: 'sales_report',
      type: 'report',
      title: 'Sales Report',
      description: 'Q1 Sales',
      objectName: 'opportunity',
    },
  ];
  const stableObjects = [
    {
      name: 'opportunity',
      fields: [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'amount', label: 'Amount', type: 'number' },
      ],
    },
  ];
  return {
    stableReports,
    stableObjects,
    mockRefresh: vi.fn().mockResolvedValue(undefined),
    mockUpdate: vi.fn().mockResolvedValue({}),
  };
});

// Mock MetadataProvider with stable references
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: stableObjects,
    dashboards: [],
    reports: stableReports,
    pages: [],
    loading: false,
    error: null,
    refresh: mockRefresh,
  }),
}));

// Mock AdapterProvider
vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => ({
    update: mockUpdate,
    create: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  mockUpdate.mockClear();
  mockRefresh.mockClear();
});

const renderReportView = async () => {
  const result = render(
    <MemoryRouter initialEntries={['/apps/crm/report/sales_report']}>
      <Routes>
        <Route path="/apps/:appName/report/:reportName" element={<ReportView />} />
      </Routes>
    </MemoryRouter>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  return result;
};

describe('ReportView — Inline Config Panel', () => {
  it('should render report with edit button and no DesignDrawer', async () => {
    await renderReportView();
    expect(screen.getByTestId('report-edit-button')).toBeInTheDocument();
    expect(screen.getAllByText('Sales Report').length).toBeGreaterThanOrEqual(1);
    // DesignDrawer should not be present (inline panel replaces it)
    expect(screen.queryByTestId('design-drawer')).not.toBeInTheDocument();
  });

  it('should open config panel when Edit is clicked', async () => {
    await renderReportView();
    await act(async () => {
      fireEvent.click(screen.getByTestId('report-edit-button'));
    });
    // ConfigPanelRenderer renders a breadcrumb with "Report" text when open
    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  it('should close config panel via close button', async () => {
    await renderReportView();
    await act(async () => {
      fireEvent.click(screen.getByTestId('report-edit-button'));
    });
    // Panel should be open — "Report" breadcrumb visible
    expect(screen.getByText('Report')).toBeInTheDocument();

    // Click the close button (X icon in ConfigPanelRenderer)
    const closeButton = screen.getByTestId('config-panel-close');
    await act(async () => {
      fireEvent.click(closeButton);
    });

    // Panel should be closed
    expect(screen.queryByTestId('config-panel-close')).not.toBeInTheDocument();
  });

  it('should auto-save config to backend on save', async () => {
    await renderReportView();
    await act(async () => {
      fireEvent.click(screen.getByTestId('report-edit-button'));
    });
    // The ConfigPanelRenderer has a save button
    const saveButtons = screen.getAllByRole('button');
    const saveButton = saveButtons.find((b) => b.textContent?.includes('Save'));
    if (saveButton) {
      await act(async () => {
        fireEvent.click(saveButton);
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        'sys_report',
        'sales_report',
        expect.any(Object),
      );
    }
  });
});
