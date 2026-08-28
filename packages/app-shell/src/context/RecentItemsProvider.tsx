/**
 * RecentItemsProvider
 *
 * Shared "recently-accessed" state with optional backend persistence. Mirrors
 * the design of `FavoritesProvider`:
 *
 * - localStorage-first: instant first paint, works offline / pre-auth.
 * - Hydrates from `UserDataAdapter<RecentItem>` when one is attached via
 *   `UserStateAdaptersProvider` (typically by `ConnectedShell`'s bridge).
 * - Writes are debounced and pushed to the adapter; localStorage stays in
 *   sync as a cold-start cache.
 * - Storage key is scoped by `user.id` to avoid cross-account leakage.
 *
 * The legacy `useRecentItems()` import path (`hooks/useRecentItems`) is
 * preserved via a re-export shim so existing call sites keep working.
 *
 * @module
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@object-ui/auth';
import {
  createDebouncedFlush,
  scopedKey,
  useStorageSync,
  useUserStateAdapter,
} from './UserStateAdapters.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentItem {
  /** Unique key, e.g. "object:contact" or "dashboard:sales_overview" */
  id: string;
  label: string;
  href: string;
  type: 'object' | 'dashboard' | 'page' | 'report' | 'record' | 'metadata';
  /** ISO timestamp of last visit */
  visitedAt: string;
}

interface RecentItemsContextValue {
  recentItems: RecentItem[];
  addRecentItem: (item: Omit<RecentItem, 'visitedAt'>) => void;
  clearRecentItems: () => void;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_BASE_KEY = 'objectui-recent-items';
const MAX_RECENT = 8;

function loadRecent(userId?: string | null): RecentItem[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_BASE_KEY, userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentItem[], userId?: string | null) {
  try {
    localStorage.setItem(scopedKey(STORAGE_BASE_KEY, userId), JSON.stringify(items));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const RecentItemsContext = createContext<RecentItemsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function RecentItemsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const adapter = useUserStateAdapter<RecentItem>('recent');

  const [recentItems, setRecentItems] = useState<RecentItem[]>(() => loadRecent(userId));

  useEffect(() => {
    setRecentItems(loadRecent(userId));
  }, [userId]);

  // Cross-tab sync — see FavoritesProvider for the rationale.
  useStorageSync<RecentItem[]>(scopedKey(STORAGE_BASE_KEY, userId), value => {
    setRecentItems(
      Array.isArray(value)
        ? value.filter(it => it && typeof (it as any).id === 'string').slice(0, MAX_RECENT)
        : [],
    );
  });

  const hydrationToken = useRef(0);
  useEffect(() => {
    if (!adapter) return;
    const token = ++hydrationToken.current;
    let cancelled = false;
    void (async () => {
      try {
        const remote = await adapter.load();
        if (cancelled || token !== hydrationToken.current) return;
        const sane = (Array.isArray(remote) ? remote : [])
          .filter(it => it && typeof (it as any).id === 'string')
          .slice(0, MAX_RECENT);
        setRecentItems(sane);
        saveRecent(sane, userId);
      } catch {
        // ignore — degrade to localStorage
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, userId]);

  const flusher = useMemo(
    () => createDebouncedFlush<RecentItem[]>(async items => {
      if (adapter) await adapter.save(items);
    }, 500),
    [adapter],
  );
  useEffect(() => () => { void flusher.flush(); }, [flusher]);

  const commit = useCallback(
    (next: RecentItem[]) => {
      saveRecent(next, userId);
      if (adapter) flusher.schedule(next);
    },
    [userId, adapter, flusher],
  );

  const addRecentItem = useCallback(
    (item: Omit<RecentItem, 'visitedAt'>) => {
      setRecentItems(prev => {
        const filtered = prev.filter(r => r.id !== item.id);
        const updated = [
          { ...item, visitedAt: new Date().toISOString() },
          ...filtered,
        ].slice(0, MAX_RECENT);
        commit(updated);
        return updated;
      });
    },
    [commit],
  );

  const clearRecentItems = useCallback(() => {
    setRecentItems([]);
    commit([]);
  }, [commit]);

  const value = useMemo<RecentItemsContextValue>(
    () => ({ recentItems, addRecentItem, clearRecentItems }),
    [recentItems, addRecentItem, clearRecentItems],
  );

  return (
    <RecentItemsContext.Provider value={value}>
      {children}
    </RecentItemsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access shared "recently-accessed" state.
 *
 * Falls back to a no-op implementation when used outside a
 * `<RecentItemsProvider>` (e.g. unit tests that only render presentational
 * components).
 */
export function useRecentItems(): RecentItemsContextValue {
  const ctx = useContext(RecentItemsContext);
  if (!ctx) {
    return {
      recentItems: [],
      addRecentItem: () => {},
      clearRecentItems: () => {},
    };
  }
  return ctx;
}
