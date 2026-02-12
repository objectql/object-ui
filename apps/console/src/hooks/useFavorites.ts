/**
 * useFavorites
 *
 * Tracks user-favorited items (objects, dashboards, pages, reports) with
 * localStorage persistence. Exposes helpers to toggle, add, remove, and
 * retrieve favorites.
 * @module
 */

import { useState, useCallback, useEffect } from 'react';

export interface FavoriteItem {
  /** Unique key, e.g. "object:contact" or "dashboard:sales_overview" */
  id: string;
  label: string;
  href: string;
  type: 'object' | 'dashboard' | 'page' | 'report';
  /** ISO timestamp of when the item was favorited */
  favoritedAt: string;
}

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

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites);

  // Sync from storage on mount
  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const addFavorite = useCallback(
    (item: Omit<FavoriteItem, 'favoritedAt'>) => {
      setFavorites(prev => {
        // Don't add duplicates
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

  const isFavorite = useCallback(
    (id: string) => favorites.some(f => f.id === id),
    [favorites],
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    saveFavorites([]);
  }, []);

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite, clearFavorites };
}
