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

vi.mock('../hooks/useMetadataService', () => ({
  useMetadataService: () => ({
    getItems: mockGetItems,
    deleteMetadataItem: mockDeleteMetadataItem,
    saveMetadataItem: vi.fn(),
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
});
