/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Standing "unpublished changes" affordance for the AI build surface
 * (objectui#5694).
 *
 * Before this bar, the ONLY way to publish a pending draft was the inline
 * 「发布 (N)」 button on whichever tool card staged it — buried however far up
 * the transcript the conversation had scrolled. In the 2026-08-22 staging E2E
 * (cloud#1584) a dashboard sat `state='draft'` through three repair rounds
 * with a working publish button off-screen the whole time; the user's actual
 * experience was a live menu entry answering 「未找到仪表板」.
 *
 * This bar floats above the composer while the conversation's bound package
 * has pending drafts: it survives scrolling, publishes through the SAME
 * governed path as the inline button and the Home banner
 * (`POST /packages/:id/publish-drafts` — the path that orders
 * structure-before-seeds and runs the ADR-0038 L3 probes), narrates probe
 * findings via the shared {@link publishHealthFromResponse} instead of a blind
 * "Published!", and disappears when the count reaches zero.
 *
 * Count freshness: re-read when the package binding changes and whenever the
 * turn goes idle (`idle` flips true) — tool results that stage or publish
 * drafts land inside a turn, so idle edges are exactly when the count can
 * have changed. Sibling surfaces: `preview/UnpublishedAppBar` (the ADR-0045
 * app-level publish gate — a DIFFERENT axis: an app can be live while sibling
 * artifacts are draft, which is exactly the case above) and the Home
 * pending-drafts banner (environment-wide, not package-scoped).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudUpload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { publishHealthFromResponse } from '@object-ui/plugin-chatbot';
import { useMetadataClient } from '../../views/metadata-admin/useMetadata.js';
import { useMetadata } from '../../providers/MetadataProvider.js';

export interface PendingDraftsBarProps {
  /** The conversation's bound package (ADR-0057 A1.a); undefined = not bound yet. */
  packageId: string | undefined;
  /** True while no turn is streaming — the count refetch trigger. */
  idle: boolean;
}

export function PendingDraftsBar({ packageId, idle }: PendingDraftsBarProps) {
  const client = useMetadataClient();
  const { refresh } = useMetadata();
  const { t } = useObjectTranslation();
  const [count, setCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  // `useMetadataClient` caches per baseUrl+env, but this bar must not depend
  // on that: an unstable client identity in the effect deps would refetch on
  // every render. Read it through a ref; the effect keys on the FACTS that
  // change the answer (binding, idleness, an explicit post-publish bump).
  const clientRef = useRef(client);
  clientRef.current = client;
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!packageId) {
      setCount(0);
      return;
    }
    if (!idle) return;
    let cancelled = false;
    void (async () => {
      try {
        const drafts = ((await clientRef.current.listDrafts?.({ packageId })) as unknown[]) || [];
        if (!cancelled) setCount(Array.isArray(drafts) ? drafts.length : 0);
      } catch {
        // An older server without the drafts surface: no signal, no bar.
        if (!cancelled) setCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idle, packageId, version]);

  const publish = useCallback(async () => {
    if (!packageId || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/v1/packages/${encodeURIComponent(packageId)}/publish-drafts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}',
      });
      const body = await res.json().catch(() => undefined);
      if (!res.ok) {
        const message =
          (body as { error?: { message?: string } } | undefined)?.error?.message ??
          t('console.ai.pendingDrafts.failed', { defaultValue: 'Publish failed.' });
        toast.error(message);
        return;
      }
      const health = publishHealthFromResponse(body);
      const problems = (health?.issues ?? []).filter((i) => i.severity === 'error');
      if (health?.seedError || problems.length > 0) {
        toast.warning(
          t('console.ai.pendingDrafts.publishedWithFindings', {
            defaultValue: 'Published, but the runtime probes reported problems: {{detail}}',
            detail: [health?.seedError, ...problems.map((p) => p.message)].filter(Boolean).join('; '),
          }),
        );
      } else {
        toast.success(t('console.ai.pendingDrafts.published', { defaultValue: 'All pending changes are live.' }));
      }
      // The launcher/nav may have just gained entries — refresh the shared
      // metadata so the user's next click finds them.
      try {
        await refresh?.();
      } catch {
        /* metadata refresh is best-effort */
      }
    } finally {
      setPublishing(false);
      setVersion((v) => v + 1);
    }
  }, [packageId, publishing, refresh, t]);

  if (!packageId || count <= 0) return null;

  return (
    <div
      data-testid="pending-drafts-bar"
      className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm shadow-sm backdrop-blur"
    >
      <span className="min-w-0 truncate">
        {t('console.ai.pendingDrafts.count', {
          defaultValue: '{{count}} change(s) are not published yet — users cannot see them.',
          count,
        })}
      </span>
      <Button size="sm" onClick={() => void publish()} disabled={publishing} className="shrink-0">
        {publishing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="mr-1 h-3.5 w-3.5" />}
        {t('console.ai.pendingDrafts.publish', { defaultValue: 'Publish' })}
      </Button>
    </div>
  );
}
