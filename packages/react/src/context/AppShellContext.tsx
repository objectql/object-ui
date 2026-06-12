import { createContext, useContext, useEffect, useState } from 'react';
import type { ObjectStackAdapter } from '@object-ui/data-objectstack';

// ---------------------------------------------------------------------------
// AdapterContext
// ---------------------------------------------------------------------------

export const AdapterCtx = createContext<ObjectStackAdapter | null>(null);

export function useAdapter(): ObjectStackAdapter | null {
  return useContext(AdapterCtx);
}

// ---------------------------------------------------------------------------
// MetadataContext
// ---------------------------------------------------------------------------

export interface MetadataState {
  apps: any[];
  objects: any[];
  dashboards: any[];
  reports: any[];
  pages: any[];
  loading: boolean;
  error: Error | null;
}

export type MetadataTypeStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface MetadataContextValue extends MetadataState {
  refresh: (type?: string) => Promise<void>;
  invalidate: (type: string, name?: string) => void;
  ensureType: (type: string) => Promise<any[]>;
  getItem: (type: string, name: string) => Promise<any | null>;
  getItemsByType: (type: string) => any[];
  /**
   * Per-type load status. Lazy types ('page', 'dashboard', …) return their
   * items array immediately — empty or stale while a (re)fetch is in flight —
   * so consumers that DIFF the list over time (e.g. NavigationSyncEffect)
   * must distinguish "empty because unloaded" from "actually empty" and only
   * trust snapshots taken while the type is 'ready'. Optional so hand-rolled
   * context values in tests keep working; absent means "always ready".
   */
  getTypeStatus?: (type: string) => MetadataTypeStatus;
}

export const MetadataCtx = createContext<MetadataContextValue | null>(null);

export function useMetadata(): MetadataContextValue {
  const ctx = useContext(MetadataCtx);
  if (!ctx) {
    // Graceful fallback: when a consumer is rendered outside a MetadataProvider
    // (common in unit tests that only need to assert on rendering), return an
    // empty no-op implementation rather than crash. Production code paths
    // should always wrap in <MetadataProvider>.
    return {
      apps: [],
      objects: [],
      dashboards: [],
      reports: [],
      pages: [],
      loading: false,
      error: null,
      refresh: async () => {},
      invalidate: () => {},
      ensureType: async () => [],
      getItem: async () => null,
      getItemsByType: () => [],
      getTypeStatus: () => 'ready',
    };
  }
  return ctx;
}

export function useMetadataItem(
  type: string,
  name: string | undefined | null,
): { item: any | null; loading: boolean; error: Error | null } {
  const { getItem } = useMetadata();
  const [state, setState] = useState<{ item: any | null; loading: boolean; error: Error | null }>({
    item: null,
    loading: !!name,
    error: null,
  });

  useEffect(() => {
    if (!name) {
      setState({ item: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    getItem(type, name)
      .then(item => {
        if (!cancelled) setState({ item, loading: false, error: null });
      })
      .catch(err => {
        if (!cancelled) {
          setState({
            item: null,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type, name, getItem]);

  return state;
}
