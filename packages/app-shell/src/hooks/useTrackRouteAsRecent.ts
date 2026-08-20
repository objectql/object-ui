/**
 * useTrackRouteAsRecent
 *
 * Watches `pathname` and records the current entity (object / dashboard /
 * page / report) into `RecentItemsProvider`. Encapsulates the URL parsing
 * logic that previously lived inline in `AppContent.tsx` so it can be reused
 * by other shells and tested in isolation.
 *
 * The hook understands the standard console URL layout:
 *
 *   /apps/:appName/:objectName
 *   /apps/:appName/dashboard/:id
 *   /apps/:appName/page/:id
 *   /apps/:appName/report/:id
 *
 * It also understands the Studio metadata-admin item routes so that browsing
 * metadata records "recently viewed" entries:
 *
 *   /apps/:appName/metadata/:type/:name
 *   /apps/:appName/metadata/:type/:name/history
 *
 * Pass `objects` (the list available in the current app) so we can resolve
 * a human-readable label for object routes.
 *
 * @module
 */
import { useEffect, useRef } from 'react';
import { useRecentItems } from '../context/RecentItemsProvider.js';

interface ObjectLike {
  name: string;
  label?: string;
}

export interface UseTrackRouteAsRecentOptions {
  /** Active route path. Usually `useLocation().pathname`. */
  pathname: string;
  /** Currently selected app name. Used to build the `href` and namespace. */
  appName: string | undefined;
  /** Objects available in the current app — used to resolve labels. */
  objects?: ObjectLike[];
  /** Optional override; defaults to `/apps`. */
  basePathSegment?: string;
  /** When `true`, the effect is suspended (e.g. when shell is hydrating). */
  disabled?: boolean;
}

/** Segments after `appName` that are NOT object names but route prefixes. */
const ROUTE_PREFIXES = new Set(['view', 'record', 'page', 'dashboard', 'design', 'report']);

function titleize(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Decode a URL path segment, falling back to the raw value on malformed input. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function useTrackRouteAsRecent({
  pathname,
  appName,
  objects = [],
  basePathSegment = 'apps',
  disabled = false,
}: UseTrackRouteAsRecentOptions): void {
  const { addRecentItem } = useRecentItems();

  // Hold `objects` in a ref so we don't re-fire the tracking effect every
  // time the parent passes a new array reference (which would happen on
  // every render in idiomatic React). Only the route should drive the effect.
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  useEffect(() => {
    if (disabled || !appName) return;

    const parts = pathname.split('/').filter(Boolean);
    // Expect: [basePathSegment, appName, ...rest]
    if (parts[0] !== basePathSegment || parts[1] !== appName) return;

    const seg2 = parts[2];
    const seg3 = parts[3];
    const basePath = `/${basePathSegment}/${appName}`;

    // Studio metadata-admin item routes:
    //   /apps/:app/metadata/:type/:name        (view / edit a metadata item)
    //   /apps/:app/metadata/:type/:name/history
    // Record the specific item as recently-viewed. The bare list route
    // (/metadata/:type) and the create route (/metadata/:type/new) are skipped
    // to keep the list focused on concrete resources. Placed before the
    // object-name branch since `metadata` is a route prefix, not an object.
    if (seg2 === 'metadata') {
      const metaType = parts[3];
      const metaName = parts[4];
      if (metaType && metaName && metaName !== 'new') {
        addRecentItem({
          id: `metadata:${metaType}:${safeDecode(metaName)}`,
          label: safeDecode(metaName),
          href: `${basePath}/metadata/${metaType}/${metaName}`,
          type: 'metadata',
        });
      }
      return;
    }

    if (seg2 && !ROUTE_PREFIXES.has(seg2)) {
      const obj = objectsRef.current.find(o => o.name === seg2);
      if (obj) {
        addRecentItem({
          id: `object:${obj.name}`,
          label: obj.label || obj.name,
          href: `${basePath}/${obj.name}`,
          type: 'object',
        });
      }
      return;
    }

    if (!seg3) return;

    switch (seg2) {
      case 'dashboard':
        addRecentItem({
          id: `dashboard:${seg3}`,
          label: titleize(seg3),
          href: `${basePath}/dashboard/${seg3}`,
          type: 'dashboard',
        });
        break;
      case 'page':
        addRecentItem({
          id: `page:${seg3}`,
          label: titleize(seg3),
          href: `${basePath}/page/${seg3}`,
          type: 'page',
        });
        break;
      case 'report':
        addRecentItem({
          id: `report:${seg3}`,
          label: titleize(seg3),
          href: `${basePath}/report/${seg3}`,
          type: 'report',
        });
        break;
      default:
        break;
    }
    // Intentionally drives off route changes only. `addRecentItem` is stable
    // per provider, and `objects` is read through a ref to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, appName, basePathSegment, disabled]);
}
