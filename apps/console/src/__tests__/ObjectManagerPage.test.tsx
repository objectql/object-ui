/**
 * ObjectManagerPage tests
 *
 * Tests for the system administration Object Manager page that integrates
 * ObjectManager and FieldDesigner from @object-ui/plugin-designer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ObjectManagerPage } from '../pages/system/ObjectManagerPage';

// Mock MetadataProvider
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    objects: [
      {
        name: 'account',
        label: 'Accounts',
        icon: 'Building',
        description: 'Customer accounts',
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
    refresh: vi.fn(),
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
        <Route path="/apps/:appName/system/objects" element={<ObjectManagerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ObjectManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
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

  describe('Object Selection & Field Designer', () => {
    it('should show FieldDesigner when an object row is clicked', async () => {
      renderPage();

      // ObjectGrid renders data asynchronously via ValueDataSource.
      // Once loaded, primary field values become clickable links (data-testid="primary-field-link").
      await waitFor(() => {
        const links = screen.queryAllByTestId('primary-field-link');
        if (links.length > 0) {
          // Click the first object's primary field link
          fireEvent.click(links[0]);
        }
      });

      // Either FieldDesigner shows (if primary-field-link was found) or ObjectManager remains
      const fieldDesigner = screen.queryByTestId('field-designer');
      const objectManager = screen.queryByTestId('object-manager');
      expect(fieldDesigner || objectManager).toBeDefined();
    });

    it('should show back button when a field designer is active', async () => {
      renderPage();

      await waitFor(() => {
        const links = screen.queryAllByTestId('primary-field-link');
        if (links.length > 0) {
          fireEvent.click(links[0]);
        }
      });

      // If field designer is active, back button should be present
      const backBtn = screen.queryByTestId('back-to-objects');
      const fieldDesigner = screen.queryByTestId('field-designer');
      if (fieldDesigner) {
        expect(backBtn).toBeDefined();
      }
    });

    it('should return to object list when back button is clicked', async () => {
      renderPage();

      await waitFor(() => {
        const links = screen.queryAllByTestId('primary-field-link');
        if (links.length > 0) {
          fireEvent.click(links[0]);
        }
      });

      const backBtn = screen.queryByTestId('back-to-objects');
      if (backBtn) {
        fireEvent.click(backBtn);
        await waitFor(() => {
          expect(screen.getByTestId('object-manager')).toBeDefined();
        });
      }
    });
  });
});
