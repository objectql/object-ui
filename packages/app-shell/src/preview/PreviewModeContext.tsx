/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0037 Live Canvas — preview mode plumbing.
 *
 * One URL flag (`?preview=draft`) flips the whole renderer tree into
 * "as-if-published" mode: metadata reads overlay pending ADR-0033 drafts on
 * the active registry, so an unpublished app/view/dashboard renders exactly
 * what Publish would make real. The canvas (and the Preview button in chat)
 * navigate with this flag; everything below just reads the context.
 *
 * Read-only by design: preview changes the SOURCE of metadata reads, never
 * writes, and Publish remains the single commit gate.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const PreviewModeContext = createContext<boolean>(false);

/** Query flag that switches the console into draft-preview mode. */
export const PREVIEW_QUERY_FLAG = 'preview';
export const PREVIEW_QUERY_VALUE = 'draft';

/** True when `search` (a `location.search` string) carries `preview=draft`. */
export function isPreviewSearch(search: string): boolean {
  return new URLSearchParams(search).get(PREVIEW_QUERY_FLAG) === PREVIEW_QUERY_VALUE;
}

/**
 * Provides the preview-mode flag to the tree. Reads the router location
 * LIVE, so entering/leaving `?preview=draft` flips consumers without a
 * remount. `force` overrides the URL — the Live Canvas mounts its embedded
 * renderer subtree with `force` so the canvas is always a draft window
 * regardless of the host page's own URL.
 */
export function PreviewModeProvider({ force, children }: { force?: boolean; children: ReactNode }) {
  const location = useLocation();
  const fromUrl = useMemo(() => isPreviewSearch(location.search), [location.search]);
  return (
    <PreviewModeContext.Provider value={force ?? fromUrl}>
      {children}
    </PreviewModeContext.Provider>
  );
}

/**
 * Whether the current tree renders the draft-overlaid world. Defaults to
 * false outside a provider, so surfaces that never mount preview (login,
 * bare pages) keep reading published metadata only.
 */
export function usePreviewDrafts(): boolean {
  return useContext(PreviewModeContext);
}
