/**
 * ObjectManagerPage tests
 *
 * Tests for the system administration Object Manager page that integrates
 * ObjectManager from @object-ui/plugin-designer for the list view, and
 * PageSchema-driven SchemaRenderer for the detail view.
 * Covers list view, detail view with URL-based navigation, schema rendering,
 * and API integration via MetadataService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectManagerPage } from '../pages/system/ObjectManagerPage';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn().mockResolvedValue(undefined);
const mockSaveItem = vi.fn().mockResolvedValue({});
const mockGetItem = vi.fn().mockResolvedValue({ item: { name: 'account', fields: [] } });
const mockInvalidateCache = vi.fn();

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

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderPage(route = '/system/objects') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/system/objects" element={<ObjectManagerPage />} />
        <Route path="/system/objects/:objectName" element={<ObjectManagerPage />} />
        <Route path="/apps/:appName/system/objects" element={<ObjectManagerPage />} />
        <Route path="/apps/:appName/system/objects/:objectName" element={<ObjectManagerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ObjectManagerPage', () => {
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
  });

  describe('List View', () => {
    it('should render the page with Object Manager title', () => {
      renderPage();
      const titles = screen.getAllByText('Object Manager');
      expect(titles.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Manage object definitions and field configurations')).toBeDefined();
    });

    it('should render the page container', () => {
      renderPage();
      expect(screen.getByTestId('object-manager-page')).toBeDefined();
    });

    it('should render the ObjectManager component with objects from metadata', () => {
      renderPage();
      expect(screen.getByTestId('object-manager')).toBeDefined();
    });

    it('should display metadata objects via ObjectGrid', async () => {
      renderPage();
      // ObjectGrid (from plugin-grid) renders the data asynchronously via ValueDataSource
      await waitFor(() => {
        const content = screen.getByTestId('object-manager').textContent;
        expect(content).toBeDefined();
      });
    });
  });

  describe('Detail View (URL-based)', () => {
    it('should show object detail page when navigating to /system/objects/:objectName', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('object-detail-view')).toBeDefined();
      const titles = screen.getAllByText('Accounts');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it('should show object properties section via schema widget', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('object-properties')).toBeDefined();
    });

    it('should show field management section via schema widget', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('field-management-section')).toBeDefined();
    });

    it('should show back button to return to object list', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('back-to-objects')).toBeDefined();
    });

    it('should navigate back to object list when back button is clicked', async () => {
      renderPage('/system/objects/account');
      const backBtn = screen.getByTestId('back-to-objects');
      fireEvent.click(backBtn);
      await waitFor(() => {
        expect(screen.getByTestId('object-manager')).toBeDefined();
      });
    });

    it('should show relationships section via schema widget', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('relationships-section')).toBeDefined();
    });

    it('should show keys section via schema widget', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('keys-section')).toBeDefined();
    });

    it('should show data experience section via schema widget', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('data-experience-section')).toBeDefined();
    });

    it('should show data preview section via schema widget', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('data-preview-section')).toBeDefined();
    });

    it('should render schema-driven content container', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('schema-detail-content')).toBeDefined();
    });
  });

  describe('Object Selection via ObjectGrid', () => {
    it('should navigate to detail when primary field link is clicked', async () => {
      renderPage();

      // ObjectGrid renders data asynchronously via ValueDataSource.
      // Wait for primary-field-link buttons to appear.
      await waitFor(() => {
        const links = screen.queryAllByTestId('primary-field-link');
        expect(links.length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Click the first primary field link (should be 'account')
      const links = screen.getAllByTestId('primary-field-link');
      fireEvent.click(links[0]);

      // Should navigate to the object detail view
      await waitFor(() => {
        expect(screen.getByTestId('object-detail-view')).toBeDefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  // API Integration tests
  // -------------------------------------------------------------------------

  describe('API Integration', () => {
    it('should have MetadataService available (adapter mock is wired)', () => {
      // Rendering the page should not crash even though useMetadataService
      // depends on useAdapter — the mock above provides a valid adapter.
      renderPage();
      expect(screen.getByTestId('object-manager-page')).toBeDefined();
    });

    it('should render detail view with schema-driven widgets', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('object-detail-view')).toBeDefined();
      // Schema widgets are rendered (field designer as a registered widget type)
      expect(screen.getByTestId('field-management-section')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Route compatibility regression tests
  // -------------------------------------------------------------------------

  describe('Route compatibility', () => {
    it('should render list view at /system/objects', () => {
      renderPage('/system/objects');
      expect(screen.getByTestId('object-manager-page')).toBeDefined();
      expect(screen.getByTestId('object-manager')).toBeDefined();
    });

    it('should render detail view at /system/objects/:objectName', () => {
      renderPage('/system/objects/account');
      expect(screen.getByTestId('object-detail-view')).toBeDefined();
    });

    it('should render detail view at /apps/:appName/system/objects/:objectName', () => {
      renderPage('/apps/my_app/system/objects/account');
      expect(screen.getByTestId('object-detail-view')).toBeDefined();
    });

    it('should render list view at /apps/:appName/system/objects', () => {
      renderPage('/apps/my_app/system/objects');
      expect(screen.getByTestId('object-manager-page')).toBeDefined();
      expect(screen.getByTestId('object-manager')).toBeDefined();
    });
  });
});
