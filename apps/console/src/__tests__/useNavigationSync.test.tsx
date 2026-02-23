/**
 * useNavigationSync — unit tests
 *
 * Tests both the pure utility helpers (addNavigationItem, removeNavigationItems,
 * renameNavigationItems) and the React hook that wires them to the metadata
 * context + adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { NavigationItem } from '@object-ui/types';
import {
  addNavigationItem,
  removeNavigationItems,
  renameNavigationItems,
  navigationEqual,
} from '../hooks/useNavigationSync';

// ---------------------------------------------------------------------------
// Mock toast (sonner)
// ---------------------------------------------------------------------------
const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
    info: (...args: any[]) => toastInfo(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock adapter / metadata
// ---------------------------------------------------------------------------
const mockSaveItem = vi.fn().mockResolvedValue({ ok: true });
const mockRefresh = vi.fn().mockResolvedValue(undefined);

let mockApps: any[] = [];

vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => ({
    getClient: () => ({
      meta: { saveItem: mockSaveItem },
    }),
  }),
}));

vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: mockApps,
    refresh: mockRefresh,
  }),
}));

// Import after mocks are registered
const { useNavigationSync } = await import('../hooks/useNavigationSync');

// ===========================================================================
// Pure utility tests
// ===========================================================================

describe('addNavigationItem', () => {
  it('appends an item to the navigation array', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Home', pageName: 'home' },
    ];
    const newItem: NavigationItem = {
      id: '2',
      type: 'dashboard',
      label: 'Sales',
      dashboardName: 'sales',
    };
    const result = addNavigationItem(nav, newItem);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(newItem);
    // original array unchanged
    expect(nav).toHaveLength(1);
  });

  it('works with an empty array', () => {
    const newItem: NavigationItem = {
      id: '1',
      type: 'page',
      label: 'First',
      pageName: 'first',
    };
    const result = addNavigationItem([], newItem);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(newItem);
  });
});

describe('removeNavigationItems', () => {
  it('removes a top-level page item by name', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Home', pageName: 'home' },
      { id: '2', type: 'page', label: 'About', pageName: 'about' },
    ];
    const result = removeNavigationItems(nav, 'page', 'home');
    expect(result).toHaveLength(1);
    expect(result[0].pageName).toBe('about');
  });

  it('removes a top-level dashboard item by name', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'dashboard', label: 'Sales', dashboardName: 'sales' },
      { id: '2', type: 'page', label: 'Home', pageName: 'home' },
    ];
    const result = removeNavigationItems(nav, 'dashboard', 'sales');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('page');
  });

  it('recursively removes nested items inside groups', () => {
    const nav: NavigationItem[] = [
      {
        id: 'g1',
        type: 'group',
        label: 'Reports',
        children: [
          { id: '1', type: 'page', label: 'Analytics', pageName: 'analytics' },
          { id: '2', type: 'page', label: 'Users', pageName: 'users' },
        ],
      },
    ];
    const result = removeNavigationItems(nav, 'page', 'analytics');
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].pageName).toBe('users');
  });

  it('removes all occurrences across multiple groups', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'dashboard', label: 'Main', dashboardName: 'overview' },
      {
        id: 'g1',
        type: 'group',
        label: 'Group A',
        children: [
          { id: '2', type: 'dashboard', label: 'Overview', dashboardName: 'overview' },
        ],
      },
    ];
    const result = removeNavigationItems(nav, 'dashboard', 'overview');
    expect(result).toHaveLength(1); // only group remains
    expect(result[0].children).toHaveLength(0);
  });

  it('returns unchanged array when no match found', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Home', pageName: 'home' },
    ];
    const result = removeNavigationItems(nav, 'page', 'nonexistent');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(nav[0]);
  });

  it('does not remove items of a different type with the same name', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Sales', pageName: 'sales' },
      { id: '2', type: 'dashboard', label: 'Sales', dashboardName: 'sales' },
    ];
    const result = removeNavigationItems(nav, 'page', 'sales');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('dashboard');
  });
});

describe('renameNavigationItems', () => {
  it('renames a top-level page reference', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Home', pageName: 'home' },
    ];
    const result = renameNavigationItems(nav, 'page', 'home', 'landing');
    expect(result[0].pageName).toBe('landing');
    // original unchanged
    expect(nav[0].pageName).toBe('home');
  });

  it('renames a top-level dashboard reference', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'dashboard', label: 'Sales', dashboardName: 'sales' },
    ];
    const result = renameNavigationItems(nav, 'dashboard', 'sales', 'revenue');
    expect(result[0].dashboardName).toBe('revenue');
  });

  it('recursively renames nested references', () => {
    const nav: NavigationItem[] = [
      {
        id: 'g1',
        type: 'group',
        label: 'Group',
        children: [
          { id: '1', type: 'page', label: 'Old', pageName: 'old_page' },
        ],
      },
    ];
    const result = renameNavigationItems(nav, 'page', 'old_page', 'new_page');
    expect(result[0].children![0].pageName).toBe('new_page');
  });

  it('renames all occurrences across the tree', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'dashboard', label: 'D1', dashboardName: 'dash' },
      {
        id: 'g1',
        type: 'group',
        label: 'G',
        children: [
          { id: '2', type: 'dashboard', label: 'D2', dashboardName: 'dash' },
        ],
      },
    ];
    const result = renameNavigationItems(nav, 'dashboard', 'dash', 'new_dash');
    expect(result[0].dashboardName).toBe('new_dash');
    expect(result[1].children![0].dashboardName).toBe('new_dash');
  });

  it('returns unchanged array when no match found', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Home', pageName: 'home' },
    ];
    const result = renameNavigationItems(nav, 'page', 'nonexistent', 'new_name');
    expect(result).toEqual(nav);
  });

  it('does not rename items of a different type', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Sales', pageName: 'sales' },
      { id: '2', type: 'dashboard', label: 'Sales', dashboardName: 'sales' },
    ];
    const result = renameNavigationItems(nav, 'page', 'sales', 'new_sales');
    expect(result[0].pageName).toBe('new_sales');
    expect(result[1].dashboardName).toBe('sales'); // untouched
  });
});

describe('navigationEqual', () => {
  it('returns true for identical arrays', () => {
    const nav: NavigationItem[] = [
      { id: '1', type: 'page', label: 'Home', pageName: 'home' },
    ];
    expect(navigationEqual(nav, nav)).toBe(true);
  });

  it('returns true for structurally equal arrays', () => {
    const a: NavigationItem[] = [{ id: '1', type: 'page', label: 'Home', pageName: 'home' }];
    const b: NavigationItem[] = [{ id: '1', type: 'page', label: 'Home', pageName: 'home' }];
    expect(navigationEqual(a, b)).toBe(true);
  });

  it('returns false for different lengths', () => {
    const a: NavigationItem[] = [{ id: '1', type: 'page', label: 'Home', pageName: 'home' }];
    expect(navigationEqual(a, [])).toBe(false);
  });

  it('returns false for different content', () => {
    const a: NavigationItem[] = [{ id: '1', type: 'page', label: 'Home', pageName: 'home' }];
    const b: NavigationItem[] = [{ id: '1', type: 'page', label: 'Home', pageName: 'about' }];
    expect(navigationEqual(a, b)).toBe(false);
  });
});

// ===========================================================================
// Hook tests
// ===========================================================================

describe('useNavigationSync hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApps = [
      {
        name: 'crm',
        type: 'app',
        title: 'CRM',
        navigation: [
          { id: 'n1', type: 'page', label: 'Home', pageName: 'home' },
          { id: 'n2', type: 'dashboard', label: 'KPI', dashboardName: 'kpi' },
          {
            id: 'g1',
            type: 'group',
            label: 'Reports',
            children: [
              { id: 'n3', type: 'page', label: 'Analytics', pageName: 'analytics' },
              { id: 'n4', type: 'dashboard', label: 'Deep KPI', dashboardName: 'kpi' },
            ],
          },
        ],
      },
    ];
  });

  // -----------------------------------------------------------------------
  // syncPageCreated
  // -----------------------------------------------------------------------

  it('adds a page nav item and shows toast', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageCreated('crm', 'settings', 'Settings');
    });

    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const [type, name, schema] = mockSaveItem.mock.calls[0];
    expect(type).toBe('app');
    expect(name).toBe('crm');
    expect(schema.navigation).toHaveLength(4); // 3 original + 1 new
    const added = schema.navigation[3];
    expect(added.type).toBe('page');
    expect(added.pageName).toBe('settings');
    expect(added.label).toBe('Settings');

    expect(mockRefresh).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Settings'),
      expect.objectContaining({ action: expect.any(Object) }),
    );
  });

  // -----------------------------------------------------------------------
  // syncDashboardCreated
  // -----------------------------------------------------------------------

  it('adds a dashboard nav item and shows toast', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncDashboardCreated('crm', 'revenue', 'Revenue');
    });

    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const schema = mockSaveItem.mock.calls[0][2];
    expect(schema.navigation).toHaveLength(4);
    const added = schema.navigation[3];
    expect(added.type).toBe('dashboard');
    expect(added.dashboardName).toBe('revenue');
    expect(toastSuccess).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // syncPageDeleted
  // -----------------------------------------------------------------------

  it('removes page items recursively and shows toast', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageDeleted('crm', 'analytics');
    });

    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const schema = mockSaveItem.mock.calls[0][2];
    // Group should now have only 1 child (the dashboard)
    const group = schema.navigation.find((n: any) => n.type === 'group');
    expect(group.children).toHaveLength(1);
    expect(group.children[0].type).toBe('dashboard');
    expect(toastSuccess).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // syncDashboardDeleted
  // -----------------------------------------------------------------------

  it('removes all dashboard items matching the name and shows toast', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncDashboardDeleted('crm', 'kpi');
    });

    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const schema = mockSaveItem.mock.calls[0][2];
    // Top-level kpi removed + nested kpi removed
    expect(schema.navigation).toHaveLength(2); // home page + group
    const group = schema.navigation.find((n: any) => n.type === 'group');
    expect(group.children).toHaveLength(1); // only analytics page remains
    expect(toastSuccess).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // syncPageRenamed
  // -----------------------------------------------------------------------

  it('renames page references and shows toast', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageRenamed('crm', 'home', 'welcome');
    });

    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const schema = mockSaveItem.mock.calls[0][2];
    expect(schema.navigation[0].pageName).toBe('welcome');
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('welcome'),
      expect.any(Object),
    );
  });

  // -----------------------------------------------------------------------
  // syncDashboardRenamed
  // -----------------------------------------------------------------------

  it('renames all dashboard references and shows toast', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncDashboardRenamed('crm', 'kpi', 'metrics');
    });

    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const schema = mockSaveItem.mock.calls[0][2];
    expect(schema.navigation[1].dashboardName).toBe('metrics');
    const group = schema.navigation.find((n: any) => n.type === 'group');
    expect(group.children[1].dashboardName).toBe('metrics');
    expect(toastSuccess).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('does nothing when app is not found', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageCreated('nonexistent', 'page1');
    });

    expect(mockSaveItem).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('does not save when delete has no matching items', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageDeleted('crm', 'nonexistent');
    });

    expect(mockSaveItem).not.toHaveBeenCalled();
  });

  it('does not save when rename has no matching items', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageRenamed('crm', 'nonexistent', 'new_name');
    });

    expect(mockSaveItem).not.toHaveBeenCalled();
  });

  it('handles app with undefined navigation gracefully', async () => {
    mockApps = [{ name: 'empty_app', type: 'app', title: 'Empty' }];

    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageCreated('empty_app', 'first_page', 'First');
    });

    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const schema = mockSaveItem.mock.calls[0][2];
    expect(schema.navigation).toHaveLength(1);
    expect(schema.navigation[0].pageName).toBe('first_page');
  });

  it('shows error toast when save fails', async () => {
    mockSaveItem.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageCreated('crm', 'new_page');
    });

    expect(toastError).toHaveBeenCalledWith('Failed to update navigation');
  });

  it('toast undo restores previous navigation', async () => {
    const { result } = renderHook(() => useNavigationSync());

    await act(async () => {
      await result.current.syncPageCreated('crm', 'temp_page', 'Temp');
    });

    // Extract the undo callback from the toast call
    const toastCall = toastSuccess.mock.calls[0];
    const undoAction = toastCall[1]?.action?.onClick;
    expect(undoAction).toBeDefined();

    // Clear mocks and execute undo
    mockSaveItem.mockClear();
    mockRefresh.mockClear();

    await act(async () => {
      await undoAction();
    });

    // Should save the original navigation (without the temp_page)
    expect(mockSaveItem).toHaveBeenCalledTimes(1);
    const restoredSchema = mockSaveItem.mock.calls[0][2];
    expect(restoredSchema.navigation).toHaveLength(3); // original 3 items
    expect(toastInfo).toHaveBeenCalledWith('Navigation change undone');
  });
});
