/**
 * useNavPins
 *
 * Tracks user-pinned navigation items with localStorage persistence.
 * Pinned items are shown at the top of the sidebar as a "Pinned" section.
 * Works alongside the existing `useFavorites` hook (record-level favorites).
 * @module
 */

import { useState, useCallback, useEffect } from 'react';
import type { NavigationItem } from '@object-ui/types';

const STORAGE_KEY = 'objectui-nav-pins';
const MAX_PINS = 20;

function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function savePins(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage full — silently ignore
  }
}

export function useNavPins() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPins);

  // Sync from storage on mount
  useEffect(() => {
    setPinnedIds(loadPins());
  }, []);

  const togglePin = useCallback((itemId: string, pinned: boolean) => {
    setPinnedIds(prev => {
      const filtered = prev.filter(id => id !== itemId);
      const updated = pinned
        ? [...filtered, itemId].slice(0, MAX_PINS)
        : filtered;
      savePins(updated);
      return updated;
    });
  }, []);

  const isPinned = useCallback(
    (itemId: string) => pinnedIds.includes(itemId),
    [pinnedIds],
  );

  /**
   * Apply pinned state to a navigation item tree.
   * Returns new items with `pinned` property set based on stored pin state.
   */
  const applyPins = useCallback(
    (items: NavigationItem[]): NavigationItem[] => {
      return items.map(item => {
        const pinned = pinnedIds.includes(item.id);
        const children = item.children?.length
          ? applyPins(item.children)
          : item.children;
        if (pinned !== (item.pinned ?? false) || children !== item.children) {
          return { ...item, pinned, children };
        }
        return item;
      });
    },
    [pinnedIds],
  );

  const clearPins = useCallback(() => {
    setPinnedIds([]);
    savePins([]);
  }, []);

  return { pinnedIds, togglePin, isPinned, applyPins, clearPins };
}
