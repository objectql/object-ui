/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0037 Live Canvas — the result pane of a build session. Chat on the
 * left, the user's app rendered from the DRAFT overlay on the right, taking
 * shape while they talk.
 *
 * Deliberately an iframe onto `/apps/:name?preview=draft`: the canvas mounts
 * the EXISTING app renderers in preview mode through the same route a user
 * could open by hand — no second renderer, no canvas-only store (ADR-0037
 * boundary rules: one truth, the canvas never edits in place). Per-artifact
 * invalidations from the chat coalesce into a reload of the pane, so during
 * an `apply_blueprint` the app grows step-by-step with the build tree.
 */

import { useEffect, useRef } from 'react';
import { X, Eye } from 'lucide-react';
import { Button } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';

export interface LiveCanvasProps {
  /** The drafted app to render (its `app` metadata name). */
  appName: string;
  /**
   * ADR-0045: the build was materialized — the app is live (real tables and
   * seed rows) but unlisted. The canvas then renders the REAL app URL: full
   * data, full interaction; the in-app UnpublishedAppBar narrates the state.
   * False (default) keeps the ADR-0037 draft-overlay preview for mutations.
   */
  materialized?: boolean;
  /** Bump to reload the pane (the host coalesces invalidation storms). */
  refreshKey: number;
  onClose: () => void;
}

/**
 * The SPA's mount prefix for ABSOLUTE urls (the iframe bypasses the router's
 * basename, unlike navigate()). The console ships under `/_console`; bare
 * mounts (tests, custom hosts) fall back to ''.
 */
function spaBase(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.startsWith('/_console') ? '/_console' : '';
}

/** Canvas iframe target: the REAL app once materialized, the draft overlay otherwise. */
function canvasSrc(appName: string, materialized: boolean): string {
  const base = `${spaBase()}/apps/${encodeURIComponent(appName)}`;
  return materialized ? base : `${base}?preview=draft`;
}

export function LiveCanvas({ appName, materialized = false, refreshKey, onClose }: LiveCanvasProps) {
  const { t } = useObjectTranslation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Materialized world swap: changing src on the SAME iframe element
  // navigates it in place (no white-flash remount).
  useEffect(() => {
    if (!iframeRef.current) return;
    const next = canvasSrc(appName, materialized);
    try {
      if (iframeRef.current.getAttribute('src') !== next) iframeRef.current.setAttribute('src', next);
    } catch {
      /* not ready — the mount src covers it */
    }
  }, [appName, materialized]);

  // Refresh in place (src reload) instead of remounting the iframe — keeps
  // the pane from flashing white on every invalidation.
  useEffect(() => {
    if (refreshKey > 0) {
      try {
        iframeRef.current?.contentWindow?.location.reload();
      } catch {
        /* cross-origin or not ready — the next mount picks it up */
      }
    }
  }, [refreshKey]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col border-l" data-testid="live-canvas">
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        <span className="min-w-0 flex-1 truncate">
          {materialized
            ? t('console.ai.liveCanvasUnlisted', {
                app: appName,
                defaultValue: 'Live app — {{app}} (unlisted until published)',
              })
            : t('console.ai.liveCanvas', {
                app: appName,
                defaultValue: 'Live preview — {{app}} (draft)',
              })}
        </span>
        <Button size="sm" variant="ghost" onClick={onClose} data-testid="live-canvas-close">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        title={`Draft preview: ${appName}`}
        src={canvasSrc(appName, materialized)}
        className="h-full w-full flex-1 border-0 bg-background"
        data-testid="live-canvas-frame"
      />
    </div>
  );
}
