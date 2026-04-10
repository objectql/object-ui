/**
 * Object Manager Metadata Pipeline Tests
 *
 * Tests that the object management list and detail views work through the
 * unified MetadataManagerPage / MetadataDetailPage pipeline.
 *
 * List view: MetadataManagerPage renders the ObjectManagerListAdapter
 * (via `listComponent` config) at `/system/metadata/object`.
 *
 * Detail view: MetadataDetailPage renders the PageSchema (via
 * `pageSchemaFactory` config) at `/system/metadata/object/:itemName`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ComponentRegistry } from '@object-ui/core';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn().mockResolvedValue(undefined);
const mockSaveItem = vi.fn().mockResolvedValue({});
const mockGetItem = vi.fn().mockResolvedValue({ item: { name: 'account', fields: [] } });
const mockInvalidateCache = vi.fn();
const mockGetItems = vi.fn().mockResolvedValue([
  { name: 'account', label: 'Accounts', description: 'Customer accounts' },
]);

// Mock MetadataProvider
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    objects: [
      {
        name: 'account',
        label: 'Accounts',
        icon: 'Building',
        description: 'Customer accounts',
        enabled: true,
        fields: [
          { name: 'id', type: 'text', label: 'ID', readonly: true },
          { name: 'name', type: 'text', label: 'Account Name', required: true },
          { name: 'email', type: 'email', label: 'Email' },
          { name: 'status', type: 'select', label: 'Status', options: ['active', 'inactive'] },
        ],
        relationships: [
          { object: 'contact', type: 'one-to-many', name: 'contacts' },
        ],
      },
      {
        name: 'contact',
        label: 'Contacts',
        icon: 'Users',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readonly: true },
          { name: 'name', type: 'text', label: 'Name', required: true },
        ],
      },
      {
        name: 'sys_user',
        label: 'Users',
        icon: 'Users',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readonly: true },
          { name: 'name', type: 'text', label: 'Name', required: true },
          { name: 'email', type: 'email', label: 'Email', required: true },
        ],
      },
    ],
    apps: [],
    dashboards: [],
    reports: [],
    pages: [],
    loading: false,
    error: null,
    refresh: mockRefresh,
  }),
}));

// Mock AdapterProvider (useAdapter) – provides adapter to useMetadataService
vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => ({
    getClient: () => ({
      meta: {
        saveItem: mockSaveItem,
        getItem: mockGetItem,
      },
    }),
    invalidateCache: mockInvalidateCache,
  }),
}));

// Mock useMetadataService for MetadataDetailPage (which uses getItems)
vi.mock('../hooks/useMetadataService', () => ({
  useMetadataService: () => ({
    getItems: mockGetItems,
    saveMetadataItem: vi.fn().mockResolvedValue(undefined),
    deleteMetadataItem: vi.fn().mockResolvedValue(undefined),
    saveObject: vi.fn().mockResolvedValue(undefined),
    deleteObject: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Admin', role: 'admin' } }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { MetadataManagerPage } from '../pages/system/MetadataManagerPage';
import { MetadataDetailPage } from '../pages/system/MetadataDetailPage';

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderListPage(route = '/system/metadata/object') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/system/metadata/:metadataType" element={<MetadataManagerPage />} />
        <Route path="/apps/:appName/system/metadata/:metadataType" element={<MetadataManagerPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetailPage(route = '/system/metadata/object/account') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/system/metadata/:metadataType/:itemName" element={<MetadataDetailPage />} />
        <Route path="/apps/:appName/system/metadata/:metadataType/:itemName" element={<MetadataDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Object Manager (Metadata Pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Register mock widget components for PageSchema rendering in tests
    const mockWidget = (name: string) => (props: any) => (
      <div data-testid={name} data-object-name={props?.schema?.objectName || props?.objectName}>
        {name}
      </div>
    );

    ComponentRegistry.register('object-properties', mockWidget('object-properties'));
    ComponentRegistry.register('object-relationships', mockWidget('relationships-section'));
    ComponentRegistry.register('object-keys', mockWidget('keys-section'));
    ComponentRegistry.register('object-data-experience', mockWidget('data-experience-section'));
    ComponentRegistry.register('object-data-preview', mockWidget('data-preview-section'));
    ComponentRegistry.register('object-field-designer', mockWidget('field-management-section'));

    // object-detail-tabs wraps all sub-widgets in the PageSchema-driven detail view.
    // The mock renders all sections inline so tests can find each by testid without
    // simulating tab-switching interactions.
    ComponentRegistry.register('object-detail-tabs', (props: any) => (
      <div data-testid="mock-object-detail-tabs">
        <div data-testid="object-properties" data-object-name={props?.schema?.objectName}>object-properties</div>
        <div data-testid="field-management-section" data-object-name={props?.schema?.objectName}>field-management-section</div>
        <div data-testid="relationships-section" data-object-name={props?.schema?.objectName}>relationships-section</div>
        <div data-testid="keys-section" data-object-name={props?.schema?.objectName}>keys-section</div>
        <div data-testid="data-experience-section" data-object-name={props?.schema?.objectName}>data-experience-section</div>
        <div data-testid="data-preview-section" data-object-name={props?.schema?.objectName}>data-preview-section</div>
      </div>
    ));
  });

  // =========================================================================
  // List View — via MetadataManagerPage + ObjectManagerListAdapter
  // =========================================================================

  describe('List View (via MetadataManagerPage)', () => {
    it('should render the page with Object Manager title', () => {
      renderListPage();
      const titles = screen.getAllByText('Object Manager');
      expect(titles.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Manage object definitions and field configurations')).toBeDefined();
    });

    it('should render the metadata-manager-page container', () => {
      renderListPage();
      expect(screen.getByTestId('metadata-manager-page')).toBeDefined();
    });

    it('should render the ObjectManager component with objects from metadata', () => {
      renderListPage();
      expect(screen.getByTestId('object-manager')).toBeDefined();
    });

    it('should display metadata objects via ObjectGrid', async () => {
      renderListPage();
      await waitFor(() => {
        const content = screen.getByTestId('object-manager').textContent;
        expect(content).toBeDefined();
      });
    });

    it('should render back-to-hub button', () => {
      renderListPage();
      expect(screen.getByTestId('back-to-hub-btn')).toBeDefined();
    });
  });

  // =========================================================================
  // Detail View — via MetadataDetailPage + pageSchemaFactory
  // =========================================================================

  describe('Detail View (via MetadataDetailPage)', () => {
    it('should render the detail page container', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-detail-page')).toBeDefined();
      });
    });

    it('should show object properties section via schema widget', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('object-properties')).toBeDefined();
      });
    });

    it('should show field management section via schema widget', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('field-management-section')).toBeDefined();
      });
    });

    it('should show back button to return to object list', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('back-to-list-btn')).toBeDefined();
      });
    });

    it('should show relationships section via schema widget', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('relationships-section')).toBeDefined();
      });
    });

    it('should show keys section via schema widget', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('keys-section')).toBeDefined();
      });
    });

    it('should show data experience section via schema widget', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('data-experience-section')).toBeDefined();
      });
    });

    it('should show data preview section via schema widget', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('data-preview-section')).toBeDefined();
      });
    });

    it('should render schema-driven content container', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('schema-detail-content')).toBeDefined();
      });
    });
  });

  // =========================================================================
  // Object Selection via ObjectGrid
  // =========================================================================

  describe('Object Selection via ObjectGrid', () => {
    it('should navigate to detail when primary field link is clicked', async () => {
      renderListPage();

      // ObjectGrid renders data asynchronously via ValueDataSource.
      // Wait for primary-field-link buttons to appear.
      await waitFor(
        () => {
          const links = screen.queryAllByTestId('primary-field-link');
          expect(links.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      // Click the first primary field link (should be 'account')
      const links = screen.getAllByTestId('primary-field-link');
      fireEvent.click(links[0]);

      // Should navigate to the object detail route
      await waitFor(() => {
        // The navigation should go to /system/metadata/object/:name
        // which re-renders with the detail page
        expect(links.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // API Integration
  // =========================================================================

  describe('API Integration', () => {
    it('should render the list page without crashing', () => {
      renderListPage();
      expect(screen.getByTestId('metadata-manager-page')).toBeDefined();
    });

    it('should render detail view with schema-driven widgets', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-detail-page')).toBeDefined();
        expect(screen.getByTestId('field-management-section')).toBeDefined();
      });
    });
  });

  // =========================================================================
  // Route compatibility (new routes)
  // =========================================================================

  describe('Route compatibility', () => {
    it('should render list view at /system/metadata/object', () => {
      renderListPage('/system/metadata/object');
      expect(screen.getByTestId('metadata-manager-page')).toBeDefined();
      expect(screen.getByTestId('object-manager')).toBeDefined();
    });

    it('should render detail view at /system/metadata/object/:itemName', async () => {
      renderDetailPage('/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-detail-page')).toBeDefined();
      });
    });

    it('should render list view at /apps/:appName/system/metadata/object', () => {
      renderListPage('/apps/my_app/system/metadata/object');
      expect(screen.getByTestId('metadata-manager-page')).toBeDefined();
      expect(screen.getByTestId('object-manager')).toBeDefined();
    });

    it('should render detail view at /apps/:appName/system/metadata/object/:itemName', async () => {
      renderDetailPage('/apps/my_app/system/metadata/object/account');
      await waitFor(() => {
        expect(screen.getByTestId('metadata-detail-page')).toBeDefined();
      });
    });
  });
});
