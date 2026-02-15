/**
 * MetadataProvider
 *
 * Provides runtime metadata (apps, objects, dashboards, reports, pages) fetched
 * from the ObjectStack API via ObjectStackAdapter, replacing the static
 * objectstack.shared imports in production builds.
 *
 * In MSW/dev mode the mock server serves the same metadata shape, so the
 * provider works identically in both dev and production.
 *
 * @module
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { ObjectStackAdapter } from '../dataSource';

export interface MetadataState {
  apps: any[];
  objects: any[];
  dashboards: any[];
  reports: any[];
  pages: any[];
  loading: boolean;
  error: Error | null;
}

export interface MetadataContextValue extends MetadataState {
  /** Re-fetch all metadata from the API (cache invalidation). */
  refresh: () => Promise<void>;
}

const MetadataCtx = createContext<MetadataContextValue | null>(null);

interface MetadataProviderProps {
  children: ReactNode;
  adapter: ObjectStackAdapter;
}

/** Extract the items array from an API response, defaulting to []. */
function extractItems(res: unknown): any[] {
  if (res && typeof res === 'object' && 'items' in res && Array.isArray((res as { items: unknown[] }).items)) {
    return (res as { items: unknown[] }).items;
  }
  return [];
}

/**
 * Fetch all metadata categories in parallel from the ObjectStack API.
 */
async function fetchAllMetadata(adapter: ObjectStackAdapter): Promise<Omit<MetadataState, 'loading' | 'error'>> {
  const client = adapter.getClient();

  const [appsRes, objectsRes, dashboardsRes, reportsRes, pagesRes] = await Promise.all([
    client.meta.getItems('app').catch(() => ({ items: [] })),
    client.meta.getItems('object').catch(() => ({ items: [] })),
    client.meta.getItems('dashboard').catch(() => ({ items: [] })),
    client.meta.getItems('report').catch(() => ({ items: [] })),
    client.meta.getItems('page').catch(() => ({ items: [] })),
  ]);

  return {
    apps: extractItems(appsRes),
    objects: extractItems(objectsRes),
    dashboards: extractItems(dashboardsRes),
    reports: extractItems(reportsRes),
    pages: extractItems(pagesRes),
  };
}

export function MetadataProvider({ children, adapter }: MetadataProviderProps) {
  const [state, setState] = useState<MetadataState>({
    apps: [],
    objects: [],
    dashboards: [],
    reports: [],
    pages: [],
    loading: true,
    error: null,
  });

  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchAllMetadata(adapterRef.current);
      setState({ ...data, loading: false, error: null });
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err instanceof Error ? err : new Error(String(err)) }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAllMetadata(adapter);
        if (!cancelled) {
          setState({ ...data, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const value: MetadataContextValue = { ...state, refresh };

  return <MetadataCtx.Provider value={value}>{children}</MetadataCtx.Provider>;
}

/**
 * Hook to access the runtime metadata from the ObjectStack API.
 * Must be used inside a <MetadataProvider>.
 */
export function useMetadata(): MetadataContextValue {
  const ctx = useContext(MetadataCtx);
  if (!ctx) {
    throw new Error('useMetadata must be used within a <MetadataProvider>');
  }
  return ctx;
}
