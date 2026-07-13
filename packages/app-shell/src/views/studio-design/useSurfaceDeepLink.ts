// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared `?surface=<type>:<name>` deep-link plumbing for the Studio pillars.
 *
 * Every pillar rail (Data / Interfaces / Automations / Access) opens ONE
 * surface at a time and used to hand-roll the same two halves — or skip them:
 *
 *  1. CAPTURE: read the `?surface=` target once, at mount, so the pillar's
 *     list-load effect can open it instead of auto-picking the first item.
 *     Captured in a ref so later in-pillar selections don't re-trigger the
 *     restore, and kept out of that effect's deps (which are keyed on the
 *     package, not the URL).
 *  2. MIRROR: write the open surface back to `?surface=` (replace) whenever it
 *     changes, so the selection is shareable and reload-stable — the inverse
 *     of the capture. Only written once a surface is open: the first render
 *     has no selection yet, and clearing the param there would strip an
 *     incoming deep-link before it is applied.
 *
 * InterfacesPillar pioneered the pattern (#code-block-menu-nav); the Data
 * pillar grew the capture half for the app→Studio object bridge (#2446);
 * Automations/Access had neither, so their deep-links snapped back to the
 * first item. This hook is the single canonical implementation.
 */

import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DESIGNER_SURFACE_PARAM,
  parseSurfaceParam,
  formatSurfaceParam,
} from '../metadata-admin/nav-selection';

/** The surface identity carried in the URL param. */
export interface SurfaceTarget {
  type: string;
  name: string;
}

/**
 * Capture the mount-time `?surface=` target (returned) and mirror `current`
 * back to the URL as it changes. Pass the pillar's open surface — `null`
 * while nothing is selected yet.
 */
export function useSurfaceDeepLink(
  current: SurfaceTarget | null | undefined,
): SurfaceTarget | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRef = React.useRef(parseSurfaceParam(searchParams.get(DESIGNER_SURFACE_PARAM)));
  // Keyed on the identity, not the object — pillars recreate their Surface
  // objects on list reload, and a same-surface rewrite is a wasted render.
  const type = current?.type;
  const name = current?.name;
  React.useEffect(() => {
    if (!type || !name) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(DESIGNER_SURFACE_PARAM, formatSurfaceParam({ type, name }));
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, name]);
  return initialRef.current;
}

/**
 * Resolve a captured deep-link against the pillar's loaded rail: the matching
 * item when the target is of this pillar's surface type AND actually exists in
 * the list, else `undefined` so the caller falls back to its first-item
 * default. Pure — unit-tested without rendering a pillar.
 */
export function resolveSurfaceDeepLink<T extends { name: string }>(
  items: readonly T[],
  initial: SurfaceTarget | null,
  expectedType: string,
): T | undefined {
  if (!initial || initial.type !== expectedType) return undefined;
  return items.find((item) => item.name === initial.name);
}
