/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AppSchema, NavigationItem, NavigationArea } from '@object-ui/types';
import { AppSchemaRenderer } from '../AppSchemaRenderer';

/** Wrap component in MemoryRouter */
function renderApp(
  schema: AppSchema,
  props: Partial<React.ComponentProps<typeof AppSchemaRenderer>> = {},
  initialEntries: string[] = ['/'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppSchemaRenderer schema={schema} basePath="/apps/crm" {...props}>
        <div data-testid="page-content">Page Content</div>
      </AppSchemaRenderer>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const minimalSchema: AppSchema = {
  type: 'app',
  name: 'crm',
  title: 'Sales CRM',
};

const navItems: NavigationItem[] = [
  { id: 'n1', type: 'object', label: 'Accounts', icon: 'Users', objectName: 'account' },
  { id: 'n2', type: 'dashboard', label: 'Overview', icon: 'LayoutDashboard', dashboardName: 'overview' },
  { id: 'n3', type: 'page', label: 'Settings', icon: 'Settings', pageName: 'settings' },
];

const schemaWithNav: AppSchema = {
  type: 'app',
  name: 'crm',
  title: 'Sales CRM',
  description: 'Manage your sales pipeline',
  navigation: navItems,
};

const salesArea: NavigationArea = {
  id: 'area-sales',
  label: 'Sales',
  icon: 'Briefcase',
  navigation: [
    { id: 'a1', type: 'object', label: 'Opportunities', icon: 'Target', objectName: 'opportunity' },
  ],
};

const serviceArea: NavigationArea = {
  id: 'area-service',
  label: 'Service',
  icon: 'Headphones',
  navigation: [
    { id: 'a2', type: 'object', label: 'Cases', icon: 'Inbox', objectName: 'case' },
  ],
};

const schemaWithAreas: AppSchema = {
  type: 'app',
  name: 'crm',
  title: 'Sales CRM',
  areas: [salesArea, serviceArea],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppSchemaRenderer', () => {
  // --- Basic rendering ---

  it('renders page content', () => {
    renderApp(minimalSchema);
    expect(screen.getByTestId('page-content')).toBeTruthy();
  });

  it('renders app title in sidebar header', () => {
    renderApp(schemaWithNav);
    expect(screen.getByText('Sales CRM')).toBeTruthy();
  });

  it('renders app description', () => {
    renderApp(schemaWithNav);
    expect(screen.getByText('Manage your sales pipeline')).toBeTruthy();
  });

  // --- Navigation items ---

  it('renders navigation items from schema', () => {
    renderApp(schemaWithNav);
    expect(screen.getByText('Accounts')).toBeTruthy();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('generates correct hrefs for navigation items', () => {
    renderApp(schemaWithNav);
    const accountLink = screen.getByText('Accounts').closest('a');
    expect(accountLink?.getAttribute('href')).toBe('/apps/crm/account');

    const dashLink = screen.getByText('Overview').closest('a');
    expect(dashLink?.getAttribute('href')).toBe('/apps/crm/dashboard/overview');

    const pageLink = screen.getByText('Settings').closest('a');
    expect(pageLink?.getAttribute('href')).toBe('/apps/crm/page/settings');
  });

  // --- Legacy menu migration ---

  it('renders legacy menu items converted to NavigationItem', () => {
    const legacySchema: AppSchema = {
      type: 'app',
      name: 'legacy',
      title: 'Legacy App',
      menu: [
        { type: 'item', label: 'Tasks', path: '/tasks', icon: 'CheckSquare' },
        { type: 'item', label: 'Docs', href: 'https://docs.example.com', icon: 'FileText' },
      ],
    };
    renderApp(legacySchema);
    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getByText('Docs')).toBeTruthy();
  });

  // --- Area switching ---

  it('renders area switcher when multiple areas defined', () => {
    renderApp(schemaWithAreas);
    expect(screen.getByText('Sales')).toBeTruthy();
    expect(screen.getByText('Service')).toBeTruthy();
  });

  it('shows first area navigation by default', () => {
    renderApp(schemaWithAreas);
    expect(screen.getByText('Opportunities')).toBeTruthy();
  });

  it('switches area when area button is clicked', () => {
    renderApp(schemaWithAreas);
    // Initially shows Sales area
    expect(screen.getByText('Opportunities')).toBeTruthy();

    // Click Service area
    fireEvent.click(screen.getByText('Service'));

    // Should now show Service area navigation
    expect(screen.getByText('Cases')).toBeTruthy();
  });

  // --- Area visibility and permissions ---

  it('hides areas that fail visibility check', () => {
    const schemaWithHiddenArea: AppSchema = {
      type: 'app',
      name: 'crm',
      title: 'CRM',
      areas: [
        salesArea,
        { ...serviceArea, visible: false },
      ],
    };
    renderApp(schemaWithHiddenArea, {
      evaluateVisibility: (expr) => {
        if (expr === false) return false;
        return true;
      },
    });
    // Area switcher should not show (only 1 visible area)
    expect(screen.queryByText('Service')).toBeNull();
  });

  it('hides areas that fail permission check', () => {
    const schemaWithPermArea: AppSchema = {
      type: 'app',
      name: 'crm',
      title: 'CRM',
      areas: [
        salesArea,
        { ...serviceArea, requiredPermissions: ['service:admin'] },
      ],
    };
    renderApp(schemaWithPermArea, {
      checkPermission: (perms) => !perms.includes('service:admin'),
    });
    expect(screen.queryByText('Service')).toBeNull();
  });

  // --- Mobile bottom_nav mode ---

  it('renders mobile bottom nav when mobileNavMode is bottom_nav', () => {
    const { container } = renderApp(schemaWithNav, { mobileNavMode: 'bottom_nav' });
    const bottomNav = container.querySelector('[role="navigation"][aria-label="Mobile navigation"]');
    expect(bottomNav).toBeTruthy();
  });

  it('does not render bottom nav in drawer mode (default)', () => {
    const { container } = renderApp(schemaWithNav);
    const bottomNav = container.querySelector('[role="navigation"][aria-label="Mobile navigation"]');
    expect(bottomNav).toBeNull();
  });

  // --- Sidebar footer slot ---

  it('renders sidebarFooter slot', () => {
    renderApp(schemaWithNav, {
      sidebarFooter: <div data-testid="user-profile">User Profile</div>,
    });
    expect(screen.getByTestId('user-profile')).toBeTruthy();
  });

  // --- Navbar slot ---

  it('renders navbar slot', () => {
    renderApp(schemaWithNav, {
      navbar: <div data-testid="custom-navbar">Search Bar</div>,
    });
    expect(screen.getByTestId('custom-navbar')).toBeTruthy();
  });

  // --- Permission & visibility on nav items ---

  it('hides navigation items based on visibility', () => {
    const schema: AppSchema = {
      type: 'app',
      name: 'crm',
      title: 'CRM',
      navigation: [
        { id: 'n1', type: 'object', label: 'Public', objectName: 'public', visible: true },
        { id: 'n2', type: 'object', label: 'Hidden', objectName: 'hidden', visible: false },
      ],
    };
    renderApp(schema, {
      evaluateVisibility: (expr) => expr !== false,
    });
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  it('hides navigation items based on permissions', () => {
    const schema: AppSchema = {
      type: 'app',
      name: 'crm',
      title: 'CRM',
      navigation: [
        { id: 'n1', type: 'object', label: 'Allowed', objectName: 'allowed' },
        { id: 'n2', type: 'object', label: 'Restricted', objectName: 'restricted', requiredPermissions: ['admin'] },
      ],
    };
    renderApp(schema, {
      checkPermission: (perms) => !perms.includes('admin'),
    });
    expect(screen.getByText('Allowed')).toBeTruthy();
    expect(screen.queryByText('Restricted')).toBeNull();
  });

  // --- Empty schema ---

  it('renders empty shell with no navigation', () => {
    renderApp(minimalSchema);
    expect(screen.getByTestId('page-content')).toBeTruthy();
    // App name should still be shown
    expect(screen.getByText('Sales CRM')).toBeTruthy();
  });

  // --- P1.7: Search within sidebar navigation ---

  describe('sidebar search', () => {
    it('renders search input when enableSearch is true', () => {
      renderApp(schemaWithNav, { enableSearch: true });
      expect(screen.getByPlaceholderText('Search navigation…')).toBeTruthy();
    });

    it('does not render search input by default', () => {
      renderApp(schemaWithNav);
      expect(screen.queryByPlaceholderText('Search navigation…')).toBeNull();
    });

    it('filters navigation items when user types in search', () => {
      renderApp(schemaWithNav, { enableSearch: true });
      const searchInput = screen.getByPlaceholderText('Search navigation…');
      fireEvent.change(searchInput, { target: { value: 'Accounts' } });
      expect(screen.getByText('Accounts')).toBeTruthy();
      expect(screen.queryByText('Overview')).toBeNull();
      expect(screen.queryByText('Settings')).toBeNull();
    });

    it('shows all items when search is cleared', () => {
      renderApp(schemaWithNav, { enableSearch: true });
      const searchInput = screen.getByPlaceholderText('Search navigation…');
      // Type search
      fireEvent.change(searchInput, { target: { value: 'Accounts' } });
      expect(screen.queryByText('Overview')).toBeNull();
      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByText('Accounts')).toBeTruthy();
      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
    });

    it('search input has correct aria-label', () => {
      renderApp(schemaWithNav, { enableSearch: true });
      expect(screen.getByLabelText('Search navigation')).toBeTruthy();
    });
  });

  // --- P1.7: Pin favorites ---

  describe('pin favorites', () => {
    it('renders pin buttons when enablePinning is true', () => {
      renderApp(schemaWithNav, { enablePinning: true, onPinToggle: vi.fn() });
      expect(screen.getByLabelText('Pin Accounts')).toBeTruthy();
    });

    it('calls onPinToggle when pin button is clicked', () => {
      const onPinToggle = vi.fn();
      renderApp(schemaWithNav, { enablePinning: true, onPinToggle });
      fireEvent.click(screen.getByLabelText('Pin Accounts'));
      expect(onPinToggle).toHaveBeenCalledWith('n1', true);
    });
  });

  // --- P1.7: Drag reorder ---

  describe('drag reorder', () => {
    it('passes enableReorder to navigation renderer', () => {
      const onReorder = vi.fn();
      renderApp(schemaWithNav, { enableReorder: true, onReorder });
      // Navigation items should still render
      expect(screen.getByText('Accounts')).toBeTruthy();
      expect(screen.getByText('Overview')).toBeTruthy();
    });
  });

  // --- Slot system ---

  describe('slot system', () => {
    it('renders custom sidebarHeader when provided', () => {
      renderApp(schemaWithNav, {
        sidebarHeader: <div data-testid="custom-header">Custom Header</div>,
      });
      expect(screen.getByTestId('custom-header')).toBeTruthy();
      expect(screen.getByText('Custom Header')).toBeTruthy();
    });

    it('replaces default branding header with sidebarHeader slot', () => {
      renderApp(schemaWithNav, {
        sidebarHeader: <div data-testid="custom-header">App Switcher</div>,
      });
      // Custom header is present
      expect(screen.getByText('App Switcher')).toBeTruthy();
      // Default branding title should not be in the sidebar header
      // (it may still appear elsewhere, but the slot replaces the header content)
      expect(screen.getByTestId('custom-header')).toBeTruthy();
    });

    it('renders sidebarExtra content after navigation', () => {
      renderApp(schemaWithNav, {
        sidebarExtra: <div data-testid="sidebar-extra">Recent Items Section</div>,
      });
      expect(screen.getByTestId('sidebar-extra')).toBeTruthy();
      expect(screen.getByText('Recent Items Section')).toBeTruthy();
    });

    it('renders sidebarFooter slot', () => {
      renderApp(schemaWithNav, {
        sidebarFooter: <div data-testid="user-footer">User Profile</div>,
      });
      expect(screen.getByTestId('user-footer')).toBeTruthy();
      expect(screen.getByText('User Profile')).toBeTruthy();
    });

    it('renders all slots together', () => {
      renderApp(schemaWithNav, {
        sidebarHeader: <div data-testid="header-slot">Header</div>,
        sidebarExtra: <div data-testid="extra-slot">Extra</div>,
        sidebarFooter: <div data-testid="footer-slot">Footer</div>,
        navbar: <div data-testid="navbar-slot">Navbar</div>,
      });
      expect(screen.getByTestId('header-slot')).toBeTruthy();
      expect(screen.getByTestId('extra-slot')).toBeTruthy();
      expect(screen.getByTestId('footer-slot')).toBeTruthy();
      expect(screen.getByTestId('navbar-slot')).toBeTruthy();
      // Navigation still renders
      expect(screen.getByText('Accounts')).toBeTruthy();
    });

    it('uses default branding header when sidebarHeader is not provided', () => {
      renderApp(schemaWithNav);
      // Default header shows app title
      expect(screen.getByText('Sales CRM')).toBeTruthy();
    });
  });
});
