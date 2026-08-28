/**
 * useNavPins
 *
 * Thin shim over `useFavorites` that exposes the legacy pin API used by
 * `NavigationRenderer`. Pin state for sidebar navigation items is stored as
 * `type: 'nav'` favorites with `pinned: true` and `navId` pointing back at
 * the originating `NavigationItem.id`. Backed by the same backend channel as
 * regular favorites (UserDataAdapter), so pins now sync across devices.
 *
 * Migration from the old `objectui-nav-pins` localStorage key happens once
 * on `<FavoritesProvider>` mount — see `migrateLegacyNavPins`.
 *
 * @module
 */

import { useCallback, useMemo } from 'react';
import type { NavigationItem } from '@object-ui/types';
import { resolveHref } from '@object-ui/layout';
import { useFavorites } from '../context/FavoritesProvider.js';

const MAX_PINS = 20;

/**
 * Synthesize the `href` for a NavigationItem in isolation from a sidebar.
 *
 * Delegates to `@object-ui/layout`'s `resolveHref` so all routing
 * semantics (recordId templates, componentRef, viewName, …) stay
 * consistent with what the sidebar renders.
 *
 * Returns an empty string for non-routable item types or unresolved
 * `#` placeholders; consumers should treat empty href as "fall back
 * to live nav tree". Template variables on `recordId` are NOT resolved
 * here (no auth context at pin-storage time) — the pinned href will
 * gracefully degrade to the list view in that case, matching what
 * `resolveHref` does when its templateContext is missing.
 */
function deriveHref(item: NavigationItem, basePath = ''): string {
  const { href, external } = resolveHref(item, basePath);
  if (external) return href;
  if (!href || href === '#') return '';
  return href;
}

function favoriteIdFor(navId: string): string {
  return `nav:${navId}`;
}

export function useNavPins() {
  const {
    favorites,
    addFavorite,
    removeFavorite,
    setPinned,
    pinnedNavIds,
  } = useFavorites();

  const togglePin = useCallback(
    (itemId: string, pinned: boolean, item?: NavigationItem, basePath?: string) => {
      const favId = favoriteIdFor(itemId);
      if (pinned) {
        // If a NavigationItem is provided, register/refresh the favorite with
        // proper label/href so backend sync carries portable data. Otherwise
        // just flip the flag — the existing favorite (if any) keeps its data.
        if (item) {
          addFavorite({
            id: favId,
            label: item.label,
            href: deriveHref(item, basePath ?? ''),
            type: 'nav',
            navId: itemId,
            pinned: true,
          });
          // addFavorite is idempotent by id — for an already-present favorite
          // that may have been unpinned via setPinned(false), flip the flag
          // back on explicitly.
          setPinned(favId, true);
        } else {
          setPinned(favId, true);
        }
      } else {
        // Unpinning a nav favorite removes it entirely — nav-pins exist
        // solely to surface the item in the sidebar Pinned section.
        removeFavorite(favId);
      }
    },
    [addFavorite, removeFavorite, setPinned],
  );

  const isPinned = useCallback(
    (itemId: string) => pinnedNavIds.has(itemId),
    [pinnedNavIds],
  );

  /**
   * Apply pinned state to a navigation item tree. Returns new items with
   * `pinned` property set based on stored pin state. Caps the displayed pin
   * count at `MAX_PINS` — additional `pinnedNavIds` (e.g. coming from another
   * device with a larger cap) are silently ignored at render time.
   */
  const applyPins = useCallback(
    (items: NavigationItem[]): NavigationItem[] => {
      if (pinnedNavIds.size === 0) {
        // Fast path: drop any stale `pinned: true` left by previous renders.
        let anyStale = false;
        for (const it of items) if (it.pinned) { anyStale = true; break; }
        if (!anyStale) return items;
      }
      let pinCount = 0;
      const walk = (list: NavigationItem[]): NavigationItem[] =>
        list.map(item => {
          const shouldPin = pinnedNavIds.has(item.id) && pinCount < MAX_PINS;
          if (shouldPin) pinCount++;
          const children = item.children?.length ? walk(item.children) : item.children;
          if (shouldPin !== (item.pinned ?? false) || children !== item.children) {
            return { ...item, pinned: shouldPin, children };
          }
          return item;
        });
      return walk(items);
    },
    [pinnedNavIds],
  );

  const clearPins = useCallback(() => {
    // Remove every nav-pin favorite — content favorites are untouched.
    for (const f of favorites) {
      if (f.type === 'nav') removeFavorite(f.id);
    }
  }, [favorites, removeFavorite]);

  const pinnedIds = useMemo(() => Array.from(pinnedNavIds), [pinnedNavIds]);

  return { pinnedIds, togglePin, isPinned, applyPins, clearPins };
}

// Re-export the type for legacy import paths.
export type { FavoriteItem } from '../context/FavoritesProvider.js';
