/**
 * MetadataManagerPage Tests
 *
 * Tests for the generic, registry-driven metadata manager page that handles
 * listing and deleting metadata items for any registered type.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// --- Mock MetadataService ---
const mockGetItems = vi.fn().mockResolvedValue([]);
const mockDeleteMetadataItem = vi.fn().mockResolvedValue(undefined);
const mockSaveMetadataItem = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useMetadataService', () => ({
  useMetadataService: () => ({
    getItems: mockGetItems,
    deleteMetadataItem: mockDeleteMetadataItem,
    saveMetadataItem: mockSaveMetadataItem,
  }),
}));

const mockRefresh = vi.fn().mockResolvedValue(undefined);
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: [],
    dashboards: [],
    reports: [],
    pages: [],
    loading: false,
    error: null,
    refresh: mockRefresh,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Admin', role: 'admin' } }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Import after mocks
import { MetadataManagerPage } from '../pages/system/MetadataManagerPage';
import { toast } from 'sonner';

function renderWithRoute(metadataType: string) {
  return render(
    <MemoryRouter initialEntries={[`/system/metadata/${metadataType}`]}>
      <Routes>
        <Route path="/system/metadata/:metadataType" element={<MetadataManagerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItems.mockResolvedValue([]);
});

describe('MetadataManagerPage', () => {
  describe('with known metadata type (dashboard)', () => {
    it('should render page heading and description', async () => {
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByText('Dashboards')).toBeInTheDocument();
        expect(screen.getByText('Manage dashboard layouts and widgets')).toBeInTheDocument();
      });
    });

    it('should show loading indicator while fetching', () => {
      mockGetItems.mockReturnValue(new Promise(() => {})); // never resolves
      renderWithRoute('dashboard');
      expect(screen.getByTestId('metadata-loading')).toBeInTheDocument();
    });

    it('should display items from MetadataService', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'sales_dashboard', label: 'Sales Dashboard', description: 'Sales KPIs' },
        { name: 'ops_dashboard', label: 'Operations', description: 'Ops overview' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-item-sales_dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('metadata-item-ops_dashboard')).toBeInTheDocument();
      });
    });

    it('should show empty state when no items', async () => {
      mockGetItems.mockResolvedValue([]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-empty')).toBeInTheDocument();
      });
    });

    it('should filter items by search query', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'sales_dashboard', label: 'Sales Dashboard' },
        { name: 'ops_dashboard', label: 'Operations' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-item-sales_dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('metadata-item-ops_dashboard')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('metadata-search-input'), {
        target: { value: 'sales' },
      });
      await waitFor(() => {
        expect(screen.getByTestId('metadata-item-sales_dashboard')).toBeInTheDocument();
        expect(screen.queryByTestId('metadata-item-ops_dashboard')).not.toBeInTheDocument();
      });
    });

    it('should filter out soft-deleted items', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'active_dash', label: 'Active' },
        { name: 'deleted_dash', label: 'Deleted', _deleted: true },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-item-active_dash')).toBeInTheDocument();
        expect(screen.queryByTestId('metadata-item-deleted_dash')).not.toBeInTheDocument();
      });
    });

    it('should delete item on double-click (confirm pattern)', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'test_dash', label: 'Test Dashboard' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-item-test_dash')).toBeInTheDocument();
      });

      // First click: arm deletion
      fireEvent.click(screen.getByTestId('delete-test_dash-btn'));
      // Wait for React to process the state update
      await waitFor(() => {
        expect(screen.getByTestId('delete-test_dash-btn')).toBeInTheDocument();
      });
      // Second click: confirm
      fireEvent.click(screen.getByTestId('delete-test_dash-btn'));

      await waitFor(() => {
        expect(mockDeleteMetadataItem).toHaveBeenCalledWith('dashboard', 'test_dash');
        expect(mockRefresh).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Dashboard "test_dash" deleted');
      });
    });

    it('should show count badge', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'd1', label: 'D1' },
        { name: 'd2', label: 'D2' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-count-badge')).toHaveTextContent('2 dashboards');
      });
    });

    it('should navigate back to hub on back button click', async () => {
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('back-to-hub-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('back-to-hub-btn'));
      expect(mockNavigate).toHaveBeenCalledWith('/system');
    });
  });

  describe('with known metadata type (page)', () => {
    it('should render correct heading for page type', async () => {
      renderWithRoute('page');
      await waitFor(() => {
        expect(screen.getByText('Pages')).toBeInTheDocument();
        expect(screen.getByText('Manage custom page definitions')).toBeInTheDocument();
      });
    });
  });

  describe('with known metadata type (report)', () => {
    it('should render correct heading for report type', async () => {
      renderWithRoute('report');
      await waitFor(() => {
        expect(screen.getByText('Reports')).toBeInTheDocument();
      });
    });
  });

  describe('with unknown metadata type', () => {
    it('should show unknown type message', () => {
      renderWithRoute('nonexistent');
      expect(screen.getByText(/Unknown metadata type: nonexistent/)).toBeInTheDocument();
    });
  });

  describe('MetadataService.getItems call', () => {
    it('should call getItems with the correct metadata type', async () => {
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(mockGetItems).toHaveBeenCalledWith('dashboard');
      });
    });

    it('should call getItems with report type', async () => {
      renderWithRoute('report');
      await waitFor(() => {
        expect(mockGetItems).toHaveBeenCalledWith('report');
      });
    });
  });

  describe('create functionality', () => {
    it('should show create button for editable types', async () => {
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('create-metadata-btn')).toBeInTheDocument();
      });
    });

    it('should open form dialog when create button is clicked', async () => {
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('create-metadata-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('create-metadata-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('metadata-form-dialog')).toBeInTheDocument();
      });
    });

    it('should call saveMetadataItem on create form submit', async () => {
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('create-metadata-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('create-metadata-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('metadata-form-dialog')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('metadata-field-name'), {
        target: { value: 'new_dash' },
      });
      fireEvent.change(screen.getByTestId('metadata-field-label'), {
        target: { value: 'New Dash' },
      });
      fireEvent.click(screen.getByTestId('metadata-form-submit-btn'));

      await waitFor(() => {
        expect(mockSaveMetadataItem).toHaveBeenCalledWith(
          'dashboard',
          'new_dash',
          expect.objectContaining({ name: 'new_dash', label: 'New Dash' }),
        );
        expect(toast.success).toHaveBeenCalledWith('Dashboard "new_dash" created');
      });
    });
  });

  describe('edit functionality', () => {
    it('should show edit button for each item', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'test_dash', label: 'Test Dashboard' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('edit-test_dash-btn')).toBeInTheDocument();
      });
    });

    it('should open edit form dialog when edit button is clicked', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'test_dash', label: 'Test Dashboard', description: 'Desc' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('edit-test_dash-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('edit-test_dash-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('metadata-form-dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit Dashboard')).toBeInTheDocument();
      });
    });

    it('should pre-fill edit form with item values', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'test_dash', label: 'Test Dashboard', description: 'Some desc' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('edit-test_dash-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('edit-test_dash-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('metadata-field-name')).toHaveValue('test_dash');
        expect(screen.getByTestId('metadata-field-label')).toHaveValue('Test Dashboard');
        expect(screen.getByTestId('metadata-field-description')).toHaveValue('Some desc');
      });
    });
  });

  describe('item navigation to detail', () => {
    it('should navigate to detail page when item card is clicked', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'sales_dash', label: 'Sales Dashboard' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-item-sales_dash')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('metadata-item-sales_dash'));
      expect(mockNavigate).toHaveBeenCalledWith('/system/metadata/dashboard/sales_dash');
    });
  });

  describe('grid list mode (report type)', () => {
    it('should render grid/table layout for types with listMode grid', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'sales_report', label: 'Sales Report', description: 'Q1 Sales' },
        { name: 'ops_report', label: 'Ops Report', description: 'Ops data' },
      ]);
      renderWithRoute('report');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-grid')).toBeInTheDocument();
      });
      // Should render items in the grid
      expect(screen.getByTestId('metadata-item-sales_report')).toBeInTheDocument();
      expect(screen.getByTestId('metadata-item-ops_report')).toBeInTheDocument();
    });

    it('should render column headers in grid mode', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'test_report', label: 'Test Report', description: 'Test desc' },
      ]);
      renderWithRoute('report');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-grid')).toBeInTheDocument();
      });
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Label')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should render edit/delete buttons in grid rows', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'test_report', label: 'Test Report' },
      ]);
      renderWithRoute('report');
      await waitFor(() => {
        expect(screen.getByTestId('edit-test_report-btn')).toBeInTheDocument();
        expect(screen.getByTestId('delete-test_report-btn')).toBeInTheDocument();
      });
    });

    it('should navigate to detail page when grid row is clicked', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'sales_report', label: 'Sales Report' },
      ]);
      renderWithRoute('report');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-item-sales_report')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('metadata-item-sales_report'));
      expect(mockNavigate).toHaveBeenCalledWith('/system/metadata/report/sales_report');
    });

    it('should show empty state in grid mode when no items', async () => {
      mockGetItems.mockResolvedValue([]);
      renderWithRoute('report');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-empty')).toBeInTheDocument();
      });
    });
  });

  describe('permission integration', () => {
    it('should show create/edit/delete buttons for admin users (mocked as admin)', async () => {
      mockGetItems.mockResolvedValue([
        { name: 'test_dash', label: 'Test Dashboard' },
      ]);
      renderWithRoute('dashboard');
      await waitFor(() => {
        expect(screen.getByTestId('create-metadata-btn')).toBeInTheDocument();
        expect(screen.getByTestId('edit-test_dash-btn')).toBeInTheDocument();
        expect(screen.getByTestId('delete-test_dash-btn')).toBeInTheDocument();
      });
    });
  });
});
