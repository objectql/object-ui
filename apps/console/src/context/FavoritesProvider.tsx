/**
 * FavoritesProvider
 *
 * React Context + Provider for shared favorites state across all consumers
 * (HomePage, AppCard, AppSidebar, UnifiedSidebar, StarredApps).
 *
 * Replaces the standalone `useFavorites` hook pattern — all callers now share
 * a single state instance so that toggling a star in AppCard immediately
 * reflects in HomePage's Starred section and sidebar.
 *
 * Persistence: localStorage (key: "objectui-favorites", max 20 items).
 *
 * TODO: Migrate persistence to server-side storage via the adapter/API layer
 * (e.g. PUT /api/user/preferences) so favorites sync across devices and browsers.
 * The provider should accept an optional `persistenceAdapter` prop that implements
 * `load(): Promise<FavoriteItem[]>` and `save(items: FavoriteItem[]): Promise<void>`.
 * When the adapter is provided, localStorage should be used only as a fallback
 * during the initial load while the server response is in-flight.
 *
 * @module
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteItem {
  /** Unique key, e.g. "object:contact" or "dashboard:sales_overview" */
  id: string;
  label: string;
  href: string;
  type: 'object' | 'dashboard' | 'page' | 'report';
  /** ISO timestamp of when the item was favorited */
  favoritedAt: string;
}

interface FavoritesContextValue {
  favorites: FavoriteItem[];
  addFavorite: (item: Omit<FavoriteItem, 'favoritedAt'>) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (item: Omit<FavoriteItem, 'favoritedAt'>) => void;
  isFavorite: (id: string) => boolean;
  clearFavorites: () => void;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'objectui-favorites';
const MAX_FAVORITES = 20;

function loadFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface FavoritesProviderProps {
  children: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites);

  // Re-sync from storage on mount (handles cases where storage was written
  // before this provider was mounted, e.g. on initial page load).
  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const addFavorite = useCallback(
    (item: Omit<FavoriteItem, 'favoritedAt'>) => {
      setFavorites(prev => {
        if (prev.some(f => f.id === item.id)) return prev;
        const updated = [
          { ...item, favoritedAt: new Date().toISOString() },
          ...prev,
        ].slice(0, MAX_FAVORITES);
        saveFavorites(updated);
        return updated;
      });
    },
    [],
  );

  const removeFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const updated = prev.filter(f => f.id !== id);
      saveFavorites(updated);
      return updated;
    });
  }, []);

  const toggleFavorite = useCallback(
    (item: Omit<FavoriteItem, 'favoritedAt'>) => {
      setFavorites(prev => {
        const exists = prev.some(f => f.id === item.id);
        const updated = exists
          ? prev.filter(f => f.id !== item.id)
          : [{ ...item, favoritedAt: new Date().toISOString() }, ...prev].slice(
              0,
              MAX_FAVORITES,
            );
        saveFavorites(updated);
        return updated;
      });
    },
    [],
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    saveFavorites([]);
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      // Inlined here so useMemo sees the freshest `favorites` without needing
      // a separate useCallback([favorites]) entry in the deps array.
      isFavorite: (id: string) => favorites.some(f => f.id === id),
      clearFavorites,
    }),
    // addFavorite / removeFavorite / toggleFavorite / clearFavorites are all
    // stable (useCallback with [] deps) and never cause extra re-renders.
    [favorites, addFavorite, removeFavorite, toggleFavorite, clearFavorites],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access shared favorites state.
 *
 * Must be used inside `<FavoritesProvider>`.
 */
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return ctx;
}
