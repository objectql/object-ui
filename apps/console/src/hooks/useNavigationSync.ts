/**
 * useNavigationSync
 *
 * Synchronizes the App navigation tree when Pages or Dashboards are
 * created, deleted, or renamed.  Pure utility helpers are exported for
 * unit-testing; the React hook wires them to the adapter / metadata
 * context and shows sonner toasts with an undo action.
 *
 * @module
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { NavigationItem, AppSchema } from '@object-ui/types';
import { useAdapter } from '../context/AdapterProvider';
import { useMetadata } from '../context/MetadataProvider';

// ============================================================================
// Pure utility helpers (exported for testing)
// ============================================================================

let _idCounter = 0;
/** Generate a simple unique id for a new navigation item. */
export function generateNavId(prefix = 'nav'): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

/**
 * Add a navigation item to the end of a navigation array (immutable).
 */
export function addNavigationItem(
  navigation: NavigationItem[],
  item: NavigationItem,
): NavigationItem[] {
  return [...navigation, item];
}

/**
 * Recursively remove all navigation items that match a given type and name.
 * Returns a new array (immutable).
 */
export function removeNavigationItems(
  navigation: NavigationItem[],
  type: 'page' | 'dashboard',
  name: string,
): NavigationItem[] {
  return navigation
    .filter((item) => {
      if (item.type === type) {
        if (type === 'page' && item.pageName === name) return false;
        if (type === 'dashboard' && item.dashboardName === name) return false;
      }
      return true;
    })
    .map((item) => {
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: removeNavigationItems(item.children, type, name),
        };
      }
      return item;
    });
}

/**
 * Recursively rename all navigation items that reference the old name.
 * Returns a new array (immutable).
 */
export function renameNavigationItems(
  navigation: NavigationItem[],
  type: 'page' | 'dashboard',
  oldName: string,
  newName: string,
): NavigationItem[] {
  return navigation.map((item) => {
    let updated = item;

    if (type === 'page' && item.type === 'page' && item.pageName === oldName) {
      updated = { ...item, pageName: newName };
    } else if (type === 'dashboard' && item.type === 'dashboard' && item.dashboardName === oldName) {
      updated = { ...item, dashboardName: newName };
    }

    if (updated.children && updated.children.length > 0) {
      return {
        ...updated,
        children: renameNavigationItems(updated.children, type, oldName, newName),
      };
    }
    return updated;
  });
}

/**
 * Shallow-structural equality check for two NavigationItem arrays.
 * Works reliably because NavigationItem objects are plain serializable JSON
 * whose key ordering is deterministic (we control object creation).
 */
export function navigationEqual(a: NavigationItem[], b: NavigationItem[]): boolean {
  if (a.length !== b.length) return false;
  // Fast-path: same reference
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseNavigationSyncReturn {
  /** Call after a new page has been created / saved for the first time. */
  syncPageCreated: (appName: string, pageName: string, label?: string) => Promise<void>;
  /** Call after a new dashboard has been created / saved for the first time. */
  syncDashboardCreated: (appName: string, dashboardName: string, label?: string) => Promise<void>;
  /** Call after a page has been deleted. */
  syncPageDeleted: (appName: string, pageName: string) => Promise<void>;
  /** Call after a dashboard has been deleted. */
  syncDashboardDeleted: (appName: string, dashboardName: string) => Promise<void>;
  /** Call after a page has been renamed. */
  syncPageRenamed: (appName: string, oldName: string, newName: string) => Promise<void>;
  /** Call after a dashboard has been renamed. */
  syncDashboardRenamed: (appName: string, oldName: string, newName: string) => Promise<void>;
}

/**
 * Hook that provides methods to keep the App navigation tree in sync with
 * Page / Dashboard CRUD operations.  Each method:
 *
 * 1. Finds the target app from metadata
 * 2. Mutates the `navigation` array (immutably)
 * 3. Persists via `client.meta.saveItem`
 * 4. Refreshes metadata cache
 * 5. Shows a toast with an **Undo** action
 */
export function useNavigationSync(): UseNavigationSyncReturn {
  const adapter = useAdapter();
  const { apps, refresh } = useMetadata();

  // Keep a ref so the undo closure always reads the latest adapter
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  /** Persist an updated app schema and refresh metadata. */
  const saveApp = useCallback(
    async (appName: string, schema: AppSchema) => {
      const client = adapterRef.current?.getClient();
      if (client) {
        await client.meta.saveItem('app', appName, schema);
      }
      await refreshRef.current?.();
    },
    [],
  );

  /** Find the current app schema from metadata by name. */
  const findApp = useCallback(
    (appName: string): AppSchema | undefined =>
      apps.find((a: any) => a.name === appName) as AppSchema | undefined,
    [apps],
  );

  // ------------------------------------------------------------------
  // Created
  // ------------------------------------------------------------------

  const syncPageCreated = useCallback(
    async (appName: string, pageName: string, label?: string) => {
      const app = findApp(appName);
      if (!app) return;

      const prev = app.navigation ?? [];
      const newItem: NavigationItem = {
        id: generateNavId('nav_page'),
        type: 'page',
        label: label || pageName,
        pageName,
        icon: 'FileText',
      };
      const updated = addNavigationItem(prev, newItem);
      const updatedApp: AppSchema = { ...app, navigation: updated };

      try {
        await saveApp(appName, updatedApp);
        toast.success(`Navigation updated: added page "${label || pageName}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await saveApp(appName, { ...app, navigation: prev });
                toast.info('Navigation change undone');
              } catch {
                toast.error('Failed to undo navigation change');
              }
            },
          },
        });
      } catch {
        toast.error('Failed to update navigation');
      }
    },
    [findApp, saveApp],
  );

  const syncDashboardCreated = useCallback(
    async (appName: string, dashboardName: string, label?: string) => {
      const app = findApp(appName);
      if (!app) return;

      const prev = app.navigation ?? [];
      const newItem: NavigationItem = {
        id: generateNavId('nav_dash'),
        type: 'dashboard',
        label: label || dashboardName,
        dashboardName,
        icon: 'LayoutDashboard',
      };
      const updated = addNavigationItem(prev, newItem);
      const updatedApp: AppSchema = { ...app, navigation: updated };

      try {
        await saveApp(appName, updatedApp);
        toast.success(`Navigation updated: added dashboard "${label || dashboardName}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await saveApp(appName, { ...app, navigation: prev });
                toast.info('Navigation change undone');
              } catch {
                toast.error('Failed to undo navigation change');
              }
            },
          },
        });
      } catch {
        toast.error('Failed to update navigation');
      }
    },
    [findApp, saveApp],
  );

  // ------------------------------------------------------------------
  // Deleted
  // ------------------------------------------------------------------

  const syncPageDeleted = useCallback(
    async (appName: string, pageName: string) => {
      const app = findApp(appName);
      if (!app) return;

      const prev = app.navigation ?? [];
      const updated = removeNavigationItems(prev, 'page', pageName);
      if (navigationEqual(updated, prev)) return; // nothing changed

      const updatedApp: AppSchema = { ...app, navigation: updated };

      try {
        await saveApp(appName, updatedApp);
        toast.success(`Navigation updated: removed page "${pageName}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await saveApp(appName, { ...app, navigation: prev });
                toast.info('Navigation change undone');
              } catch {
                toast.error('Failed to undo navigation change');
              }
            },
          },
        });
      } catch {
        toast.error('Failed to update navigation');
      }
    },
    [findApp, saveApp],
  );

  const syncDashboardDeleted = useCallback(
    async (appName: string, dashboardName: string) => {
      const app = findApp(appName);
      if (!app) return;

      const prev = app.navigation ?? [];
      const updated = removeNavigationItems(prev, 'dashboard', dashboardName);
      if (navigationEqual(updated, prev)) return;

      const updatedApp: AppSchema = { ...app, navigation: updated };

      try {
        await saveApp(appName, updatedApp);
        toast.success(`Navigation updated: removed dashboard "${dashboardName}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await saveApp(appName, { ...app, navigation: prev });
                toast.info('Navigation change undone');
              } catch {
                toast.error('Failed to undo navigation change');
              }
            },
          },
        });
      } catch {
        toast.error('Failed to update navigation');
      }
    },
    [findApp, saveApp],
  );

  // ------------------------------------------------------------------
  // Renamed
  // ------------------------------------------------------------------

  const syncPageRenamed = useCallback(
    async (appName: string, oldName: string, newName: string) => {
      const app = findApp(appName);
      if (!app) return;

      const prev = app.navigation ?? [];
      const updated = renameNavigationItems(prev, 'page', oldName, newName);
      if (navigationEqual(updated, prev)) return;

      const updatedApp: AppSchema = { ...app, navigation: updated };

      try {
        await saveApp(appName, updatedApp);
        toast.success(`Navigation updated: renamed page "${oldName}" → "${newName}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await saveApp(appName, { ...app, navigation: prev });
                toast.info('Navigation change undone');
              } catch {
                toast.error('Failed to undo navigation change');
              }
            },
          },
        });
      } catch {
        toast.error('Failed to update navigation');
      }
    },
    [findApp, saveApp],
  );

  const syncDashboardRenamed = useCallback(
    async (appName: string, oldName: string, newName: string) => {
      const app = findApp(appName);
      if (!app) return;

      const prev = app.navigation ?? [];
      const updated = renameNavigationItems(prev, 'dashboard', oldName, newName);
      if (navigationEqual(updated, prev)) return;

      const updatedApp: AppSchema = { ...app, navigation: updated };

      try {
        await saveApp(appName, updatedApp);
        toast.success(`Navigation updated: renamed dashboard "${oldName}" → "${newName}"`, {
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await saveApp(appName, { ...app, navigation: prev });
                toast.info('Navigation change undone');
              } catch {
                toast.error('Failed to undo navigation change');
              }
            },
          },
        });
      } catch {
        toast.error('Failed to update navigation');
      }
    },
    [findApp, saveApp],
  );

  return {
    syncPageCreated,
    syncDashboardCreated,
    syncPageDeleted,
    syncDashboardDeleted,
    syncPageRenamed,
    syncDashboardRenamed,
  };
}
