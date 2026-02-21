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
import type { NavigationItem } from '@object-ui/types';
import { NavigationRenderer, filterNavigationItems } from '../NavigationRenderer';
import { SidebarProvider } from '@object-ui/components';

/** Wrap component in required providers */
function renderNav(
  items: NavigationItem[],
  props: Partial<React.ComponentProps<typeof NavigationRenderer>> = {},
  initialEntries: string[] = ['/'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SidebarProvider defaultOpen={true}>
        <NavigationRenderer items={items} basePath="/apps/test" {...props} />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const objectItem: NavigationItem = {
  id: 'nav-accounts',
  type: 'object',
  label: 'Accounts',
  icon: 'Users',
  objectName: 'account',
};

const dashboardItem: NavigationItem = {
  id: 'nav-dash',
  type: 'dashboard',
  label: 'Sales Dashboard',
  icon: 'LayoutDashboard',
  dashboardName: 'sales-overview',
};

const pageItem: NavigationItem = {
  id: 'nav-page',
  type: 'page',
  label: 'Home Page',
  icon: 'Home',
  pageName: 'home',
};

const reportItem: NavigationItem = {
  id: 'nav-report',
  type: 'report',
  label: 'Monthly Report',
  icon: 'BarChart',
  reportName: 'monthly',
};

const urlItem: NavigationItem = {
  id: 'nav-url',
  type: 'url',
  label: 'Documentation',
  icon: 'ExternalLink',
  url: 'https://docs.example.com',
  target: '_blank',
};

const actionItem: NavigationItem = {
  id: 'nav-action',
  type: 'action',
  label: 'Create Record',
  icon: 'Plus',
};

const groupItem: NavigationItem = {
  id: 'nav-group',
  type: 'group',
  label: 'Sales',
  icon: 'Briefcase',
  children: [objectItem, dashboardItem],
  defaultOpen: true,
};

const separatorItem: NavigationItem = {
  id: 'nav-sep',
  type: 'separator',
  label: '',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NavigationRenderer', () => {
  // --- Basic rendering of 7 navigation types ---

  it('renders object navigation item as link', () => {
    renderNav([objectItem]);
    expect(screen.getByText('Accounts')).toBeTruthy();
    const link = screen.getByText('Accounts').closest('a');
    expect(link?.getAttribute('href')).toBe('/apps/test/account');
  });

  it('renders dashboard navigation item', () => {
    renderNav([dashboardItem]);
    expect(screen.getByText('Sales Dashboard')).toBeTruthy();
    const link = screen.getByText('Sales Dashboard').closest('a');
    expect(link?.getAttribute('href')).toBe('/apps/test/dashboard/sales-overview');
  });

  it('renders page navigation item', () => {
    renderNav([pageItem]);
    expect(screen.getByText('Home Page')).toBeTruthy();
    const link = screen.getByText('Home Page').closest('a');
    expect(link?.getAttribute('href')).toBe('/apps/test/page/home');
  });

  it('renders report navigation item', () => {
    renderNav([reportItem]);
    expect(screen.getByText('Monthly Report')).toBeTruthy();
    const link = screen.getByText('Monthly Report').closest('a');
    expect(link?.getAttribute('href')).toBe('/apps/test/report/monthly');
  });

  it('renders url navigation item as external link', () => {
    renderNav([urlItem]);
    expect(screen.getByText('Documentation')).toBeTruthy();
    const link = screen.getByText('Documentation').closest('a');
    expect(link?.getAttribute('href')).toBe('https://docs.example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('renders action navigation item as button', () => {
    const onAction = vi.fn();
    renderNav([actionItem], { onAction });
    expect(screen.getByText('Create Record')).toBeTruthy();
  });

  it('renders group with children', () => {
    renderNav([groupItem]);
    expect(screen.getByText('Sales')).toBeTruthy();
    expect(screen.getByText('Accounts')).toBeTruthy();
    expect(screen.getByText('Sales Dashboard')).toBeTruthy();
  });

  it('renders separator', () => {
    const { container } = renderNav([objectItem, separatorItem, pageItem]);
    expect(screen.getByText('Accounts')).toBeTruthy();
    expect(screen.getByText('Home Page')).toBeTruthy();
    // Separator is rendered as a Separator component (role="none" or hr)
    const separators = container.querySelectorAll('[role="none"], hr, [data-orientation]');
    expect(separators.length).toBeGreaterThan(0);
  });

  // --- Visibility guards ---

  it('hides items with visible=false', () => {
    const hiddenItem: NavigationItem = {
      ...objectItem,
      id: 'nav-hidden',
      visible: false,
    };
    renderNav([hiddenItem]);
    expect(screen.queryByText('Accounts')).toBeNull();
  });

  it('shows items with visible=true', () => {
    const visibleItem: NavigationItem = {
      ...objectItem,
      id: 'nav-visible',
      visible: true,
    };
    renderNav([visibleItem]);
    expect(screen.getByText('Accounts')).toBeTruthy();
  });

  it('evaluates visibility expression via callback', () => {
    const item: NavigationItem = {
      ...objectItem,
      id: 'nav-expr',
      visible: '${user.isAdmin}',
    };
    const evalVis = vi.fn().mockReturnValue(false);
    renderNav([item], { evaluateVisibility: evalVis });
    expect(evalVis).toHaveBeenCalledWith('${user.isAdmin}');
    expect(screen.queryByText('Accounts')).toBeNull();
  });

  // --- Permission guards ---

  it('hides items when permission check fails', () => {
    const item: NavigationItem = {
      ...objectItem,
      id: 'nav-perm',
      requiredPermissions: ['account:read'],
    };
    const checkPerm = vi.fn().mockReturnValue(false);
    renderNav([item], { checkPermission: checkPerm });
    expect(checkPerm).toHaveBeenCalledWith(['account:read']);
    expect(screen.queryByText('Accounts')).toBeNull();
  });

  it('shows items when permission check passes', () => {
    const item: NavigationItem = {
      ...objectItem,
      id: 'nav-perm-ok',
      requiredPermissions: ['account:read'],
    };
    const checkPerm = vi.fn().mockReturnValue(true);
    renderNav([item], { checkPermission: checkPerm });
    expect(screen.getByText('Accounts')).toBeTruthy();
  });

  it('shows all items when no permission checker is provided', () => {
    const item: NavigationItem = {
      ...objectItem,
      id: 'nav-no-checker',
      requiredPermissions: ['account:admin'],
    };
    renderNav([item]);
    expect(screen.getByText('Accounts')).toBeTruthy();
  });

  // --- Badges ---

  it('renders badge on navigation items', () => {
    const item: NavigationItem = {
      ...objectItem,
      id: 'nav-badge',
      badge: 42,
    };
    renderNav([item]);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders string badge', () => {
    const item: NavigationItem = {
      ...objectItem,
      id: 'nav-badge-str',
      badge: 'New',
    };
    renderNav([item]);
    expect(screen.getByText('New')).toBeTruthy();
  });

  // --- Ordering ---

  it('sorts items by order field', () => {
    const items: NavigationItem[] = [
      { ...objectItem, id: 'b', label: 'B', order: 2 },
      { ...pageItem, id: 'a', label: 'A', order: 1 },
      { ...reportItem, id: 'c', label: 'C', order: 3 },
    ];
    const { container } = renderNav(items);
    const labels = Array.from(container.querySelectorAll('span'))
      .map((el) => el.textContent)
      .filter((t) => ['A', 'B', 'C'].includes(t ?? ''));
    expect(labels).toEqual(['A', 'B', 'C']);
  });

  // --- Mixed groups and leaf items ---

  it('renders mixed groups and leaf items correctly', () => {
    const items: NavigationItem[] = [
      pageItem,
      groupItem,
      reportItem,
    ];
    renderNav(items);
    expect(screen.getByText('Home Page')).toBeTruthy();
    expect(screen.getByText('Sales')).toBeTruthy();
    expect(screen.getByText('Monthly Report')).toBeTruthy();
  });

  // --- Active route highlighting ---

  it('highlights active route', () => {
    renderNav([objectItem], {}, ['/apps/test/account']);
    const link = screen.getByText('Accounts').closest('a');
    // The parent button should have data-active="true" set by SidebarMenuButton
    const button = link?.closest('[data-active]');
    expect(button?.getAttribute('data-active')).toBe('true');
  });

  // --- Empty items ---

  it('renders nothing for empty items array', () => {
    const { container } = renderNav([]);
    // Should render the wrapper SidebarGroup but no menu items
    expect(container.querySelectorAll('a').length).toBe(0);
  });

  // --- P1.7: Search filtering ---

  describe('search filtering', () => {
    it('filters items by search query (case-insensitive)', () => {
      const items: NavigationItem[] = [
        { ...objectItem, id: 'n1', label: 'Accounts' },
        { ...pageItem, id: 'n2', label: 'Settings' },
        { ...reportItem, id: 'n3', label: 'Account Report' },
      ];
      renderNav(items, { searchQuery: 'account' });
      expect(screen.getByText('Accounts')).toBeTruthy();
      expect(screen.getByText('Account Report')).toBeTruthy();
      expect(screen.queryByText('Settings')).toBeNull();
    });

    it('shows all items when search query is empty', () => {
      const items: NavigationItem[] = [
        { ...objectItem, id: 'n1', label: 'Accounts' },
        { ...pageItem, id: 'n2', label: 'Settings' },
      ];
      renderNav(items, { searchQuery: '' });
      expect(screen.getByText('Accounts')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
    });

    it('filters group children and keeps group if any child matches', () => {
      const group: NavigationItem = {
        id: 'g1',
        type: 'group',
        label: 'Sales',
        children: [
          { id: 'c1', type: 'object', label: 'Opportunities', objectName: 'opp' },
          { id: 'c2', type: 'object', label: 'Contacts', objectName: 'contact' },
        ],
        defaultOpen: true,
      };
      renderNav([group], { searchQuery: 'oppo' });
      expect(screen.getByText('Sales')).toBeTruthy();
      expect(screen.getByText('Opportunities')).toBeTruthy();
      expect(screen.queryByText('Contacts')).toBeNull();
    });

    it('removes group entirely if no children match', () => {
      const group: NavigationItem = {
        id: 'g1',
        type: 'group',
        label: 'Sales',
        children: [
          { id: 'c1', type: 'object', label: 'Opportunities', objectName: 'opp' },
        ],
        defaultOpen: true,
      };
      renderNav([group], { searchQuery: 'zzz' });
      expect(screen.queryByText('Sales')).toBeNull();
      expect(screen.queryByText('Opportunities')).toBeNull();
    });

    it('excludes separators during search', () => {
      const items: NavigationItem[] = [
        { ...objectItem, id: 'n1', label: 'Accounts' },
        separatorItem,
        { ...pageItem, id: 'n2', label: 'Settings' },
      ];
      const { container } = renderNav(items, { searchQuery: 'acc' });
      expect(screen.getByText('Accounts')).toBeTruthy();
      expect(screen.queryByText('Settings')).toBeNull();
    });
  });

  // --- P1.7: Pin/Favorites ---

  describe('pin favorites', () => {
    it('renders pin button when enablePinning is true', () => {
      renderNav([objectItem], { enablePinning: true, onPinToggle: vi.fn() });
      expect(screen.getByLabelText('Pin Accounts')).toBeTruthy();
    });

    it('does not render pin button when enablePinning is false', () => {
      renderNav([objectItem]);
      expect(screen.queryByLabelText('Pin Accounts')).toBeNull();
    });

    it('calls onPinToggle with correct arguments when pin is clicked', () => {
      const onPinToggle = vi.fn();
      renderNav([objectItem], { enablePinning: true, onPinToggle });
      fireEvent.click(screen.getByLabelText('Pin Accounts'));
      expect(onPinToggle).toHaveBeenCalledWith('nav-accounts', true);
    });

    it('renders unpin button for pinned items', () => {
      const pinnedItem: NavigationItem = {
        ...objectItem,
        id: 'nav-pinned',
        pinned: true,
      };
      renderNav([pinnedItem], { enablePinning: true, onPinToggle: vi.fn() });
      // Pinned item appears in both Favorites and main nav, so use getAllBy
      const unpinButtons = screen.getAllByLabelText('Unpin Accounts');
      expect(unpinButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onPinToggle with false when unpinning', () => {
      const onPinToggle = vi.fn();
      const pinnedItem: NavigationItem = {
        ...objectItem,
        id: 'nav-pinned',
        pinned: true,
      };
      renderNav([pinnedItem], { enablePinning: true, onPinToggle });
      // Pinned item appears in both Favorites and main nav
      const unpinButtons = screen.getAllByLabelText('Unpin Accounts');
      fireEvent.click(unpinButtons[0]);
      expect(onPinToggle).toHaveBeenCalledWith('nav-pinned', false);
    });

    it('renders favorites section for pinned items', () => {
      const items: NavigationItem[] = [
        { ...objectItem, id: 'n1', label: 'Accounts', pinned: true },
        { ...pageItem, id: 'n2', label: 'Settings' },
      ];
      renderNav(items, { enablePinning: true, onPinToggle: vi.fn() });
      expect(screen.getByText('Favorites')).toBeTruthy();
    });

    it('does not render favorites section when no items are pinned', () => {
      renderNav([objectItem], { enablePinning: true, onPinToggle: vi.fn() });
      expect(screen.queryByText('Favorites')).toBeNull();
    });

    it('collects pinned items from nested groups into favorites', () => {
      const group: NavigationItem = {
        id: 'g1',
        type: 'group',
        label: 'Sales',
        children: [
          { id: 'c1', type: 'object', label: 'Pinned Child', objectName: 'opp', pinned: true },
          { id: 'c2', type: 'object', label: 'Normal Child', objectName: 'contact' },
        ],
        defaultOpen: true,
      };
      renderNav([group], { enablePinning: true, onPinToggle: vi.fn() });
      expect(screen.getByText('Favorites')).toBeTruthy();
    });

    it('renders pin button on action items', () => {
      renderNav([actionItem], { enablePinning: true, onPinToggle: vi.fn() });
      expect(screen.getByLabelText('Pin Create Record')).toBeTruthy();
    });
  });

  // --- P1.7: Drag reorder ---

  describe('drag reorder', () => {
    it('renders drag handles when enableReorder is true', () => {
      const items: NavigationItem[] = [
        { ...objectItem, id: 'n1', label: 'Item A' },
        { ...pageItem, id: 'n2', label: 'Item B' },
      ];
      const { container } = renderNav(items, { enableReorder: true, onReorder: vi.fn() });
      // DndContext renders sortable wrappers
      expect(screen.getByText('Item A')).toBeTruthy();
      expect(screen.getByText('Item B')).toBeTruthy();
    });

    it('does not render drag handles when enableReorder is false', () => {
      const items: NavigationItem[] = [
        { ...objectItem, id: 'n1', label: 'Item A' },
      ];
      const { container } = renderNav(items);
      // No GripVertical icons should be present
      const grips = container.querySelectorAll('.cursor-grab');
      expect(grips.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// filterNavigationItems (unit tests)
// ---------------------------------------------------------------------------

describe('filterNavigationItems', () => {
  const items: NavigationItem[] = [
    { id: 'n1', type: 'object', label: 'Accounts', objectName: 'account' },
    { id: 'n2', type: 'page', label: 'Settings', pageName: 'settings' },
    { id: 'n3', type: 'dashboard', label: 'Sales Dashboard', dashboardName: 'sales' },
    { id: 'sep', type: 'separator', label: '' },
    {
      id: 'g1',
      type: 'group',
      label: 'Reports',
      children: [
        { id: 'r1', type: 'report', label: 'Monthly Report', reportName: 'monthly' },
        { id: 'r2', type: 'report', label: 'Account Summary', reportName: 'account-sum' },
      ],
    },
  ];

  it('returns all items for empty query', () => {
    expect(filterNavigationItems(items, '')).toEqual(items);
  });

  it('returns all items for whitespace-only query', () => {
    expect(filterNavigationItems(items, '   ')).toEqual(items);
  });

  it('filters leaf items by label (case-insensitive)', () => {
    const result = filterNavigationItems(items, 'account');
    expect(result.map((i) => i.id)).toContain('n1');
    expect(result.map((i) => i.id)).not.toContain('n2');
  });

  it('keeps groups with matching children', () => {
    const result = filterNavigationItems(items, 'monthly');
    const group = result.find((i) => i.id === 'g1');
    expect(group).toBeTruthy();
    expect(group?.children?.length).toBe(1);
    expect(group?.children?.[0].id).toBe('r1');
  });

  it('removes groups with no matching children', () => {
    const result = filterNavigationItems(items, 'settings');
    expect(result.find((i) => i.id === 'g1')).toBeUndefined();
  });

  it('excludes separators during search', () => {
    const result = filterNavigationItems(items, 'account');
    expect(result.find((i) => i.type === 'separator')).toBeUndefined();
  });

  it('matches partial label substrings', () => {
    const result = filterNavigationItems(items, 'dash');
    expect(result.map((i) => i.id)).toContain('n3');
  });

  it('returns empty array when nothing matches', () => {
    const result = filterNavigationItems(items, 'zzzzz');
    expect(result).toEqual([]);
  });

  it('matches group children containing search term "account"', () => {
    const result = filterNavigationItems(items, 'account');
    const group = result.find((i) => i.id === 'g1');
    expect(group).toBeTruthy();
    expect(group?.children?.map((c) => c.id)).toEqual(['r2']);
  });
});
