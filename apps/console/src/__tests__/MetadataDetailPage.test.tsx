/**
 * MetadataDetailPage Tests
 *
 * Tests for the generic, registry-driven metadata detail page that shows
 * a single metadata item and supports editing via the MetadataFormDialog.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// --- Mock MetadataService ---
const mockGetItems = vi.fn().mockResolvedValue([]);
const mockSaveMetadataItem = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useMetadataService', () => ({
  useMetadataService: () => ({
    getItems: mockGetItems,
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
import { MetadataDetailPage } from '../pages/system/MetadataDetailPage';

function renderWithRoute(metadataType: string, itemName: string) {
  return render(
    <MemoryRouter initialEntries={[`/system/metadata/${metadataType}/${itemName}`]}>
      <Routes>
        <Route
          path="/system/metadata/:metadataType/:itemName"
          element={<MetadataDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItems.mockResolvedValue([]);
});

describe('MetadataDetailPage', () => {
  describe('with known type and existing item', () => {
    beforeEach(() => {
      mockGetItems.mockResolvedValue([
        { name: 'sales_dash', label: 'Sales Dashboard', description: 'Sales KPIs' },
        { name: 'ops_dash', label: 'Operations', description: 'Ops overview' },
      ]);
    });

    it('should render item details', async () => {
      renderWithRoute('dashboard', 'sales_dash');
      await waitFor(() => {
        expect(screen.getByTestId('detail-card')).toBeInTheDocument();
      });
      // "Sales Dashboard" appears in both heading and detail card
      expect(screen.getAllByText('Sales Dashboard').length).toBeGreaterThanOrEqual(1);
    });

    it('should show edit button', async () => {
      renderWithRoute('dashboard', 'sales_dash');
      await waitFor(() => {
        expect(screen.getByTestId('detail-edit-btn')).toBeInTheDocument();
      });
    });

    it('should show back button that navigates to list', async () => {
      renderWithRoute('dashboard', 'sales_dash');
      await waitFor(() => {
        expect(screen.getByTestId('back-to-list-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('back-to-list-btn'));
      expect(mockNavigate).toHaveBeenCalledWith('/system/metadata/dashboard');
    });

    it('should open edit dialog when edit button clicked', async () => {
      renderWithRoute('dashboard', 'sales_dash');
      await waitFor(() => {
        expect(screen.getByTestId('detail-edit-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('detail-edit-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('metadata-form-dialog')).toBeInTheDocument();
      });
    });

    it('should display field values from the item', async () => {
      renderWithRoute('dashboard', 'sales_dash');
      await waitFor(() => {
        expect(screen.getByTestId('detail-card')).toBeInTheDocument();
      });
      // "sales_dash" appears in both the heading subtitle and the detail card
      expect(screen.getAllByText('sales_dash').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Sales Dashboard').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Sales KPIs')).toBeInTheDocument();
    });
  });

  describe('with item not found', () => {
    it('should show not found message', async () => {
      mockGetItems.mockResolvedValue([]);
      renderWithRoute('dashboard', 'nonexistent');
      await waitFor(() => {
        expect(screen.getByTestId('detail-not-found')).toBeInTheDocument();
      });
    });
  });

  describe('with unknown metadata type', () => {
    it('should show unknown type message', () => {
      renderWithRoute('nonexistent_type', 'some_item');
      expect(screen.getByText(/Unknown metadata type: nonexistent_type/)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator while fetching', () => {
      mockGetItems.mockReturnValue(new Promise(() => {})); // never resolves
      renderWithRoute('dashboard', 'sales_dash');
      expect(screen.getByTestId('detail-loading')).toBeInTheDocument();
    });
  });

  describe('redirect for custom page types', () => {
    it('should redirect object type to /system/objects/:name', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/system/metadata/object/account']}>
          <Routes>
            <Route
              path="/system/metadata/:metadataType/:itemName"
              element={<MetadataDetailPage />}
            />
            <Route
              path="/system/objects/:objectName"
              element={<div data-testid="object-detail-redirect-target">Redirected</div>}
            />
          </Routes>
        </MemoryRouter>,
      );
      // The Navigate component should redirect to the object detail route
      expect(screen.getByTestId('object-detail-redirect-target')).toBeInTheDocument();
      expect(screen.getByText('Redirected')).toBeInTheDocument();
    });
  });
});
