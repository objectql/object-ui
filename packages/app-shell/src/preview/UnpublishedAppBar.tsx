/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0045 — the "unpublished app" banner. Renders while the CURRENT app is
 * materialized-but-unlisted (`app.hidden === true`): the app is fully real —
 * tables, data, interactions — but end users can't see it (launchers exclude
 * it; the REST gate strips it for non-builders). The banner narrates that
 * state and offers the one action that matters: Publish, which simply flips
 * visibility (`hidden: false`) — instant and reversible, per ADR-0045.
 *
 * Sibling of DraftPreviewBar (the ADR-0037 draft-overlay watermark): that bar
 * owns mutation preview (`?preview=draft`); this one owns the materialize
 * regime. In preview mode this bar yields — the draft bar already narrates.
 */

import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { EyeOff, History, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { useMetadata } from '../providers/MetadataProvider';
import { matchAppBySegment } from '../utils/appRoute';
import { CommitTimeline } from './CommitTimeline';
import { usePreviewDrafts } from './PreviewModeContext';

export function UnpublishedAppBar() {
  const preview = usePreviewDrafts();
  const { appName } = useParams();
  const location = useLocation();
  const { apps, refresh } = useMetadata();
  const { t } = useObjectTranslation();
  const [publishing, setPublishing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // The draft-preview watermark owns the preview tree; never stack both bars.
  if (preview) return null;
  const routeApp = appName ?? location.pathname.match(/\/apps\/([^/?#]+)/)?.[1];
  if (!routeApp) return null;
  const app = matchAppBySegment(apps ?? [], routeApp);
  if (!app || (app as any).hidden !== true) return null;
  // ADR-0067 — the package this app belongs to keys its commit timeline.
  const packageId =
    (app as { packageId?: string })?.packageId ?? (app as { _packageId?: string })?._packageId ?? null;

  const publish = async () => {
    setPublishing(true);
    try {
      // Publish = the ADR-0045 visibility flip: one metadata write, no
      // lifecycle machinery. Body is the full current app with hidden:false
      // (the meta save endpoint replaces the overlay row).
      const res = await fetch(`/api/v1/meta/app/${encodeURIComponent(routeApp)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...(app as Record<string, unknown>), hidden: false }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error((payload as any)?.error?.message ?? (payload as any)?.error ?? `HTTP ${res.status}`);
      }
      toast.success(
        t('preview.unpublishedBar.published', {
          defaultValue: 'Published! The app is now visible to your users.',
        }),
      );
      refresh?.();
    } catch (e) {
      toast.error(
        `${t('preview.unpublishedBar.publishFailed', { defaultValue: 'Publish failed' })}: ${(e as Error).message}`,
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <div
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-amber-300/70 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        data-testid="unpublished-app-bar"
      >
        <EyeOff className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate">
          {t('preview.unpublishedBar.message', {
            defaultValue:
              'Unpublished app — fully functional, but only builders can see it. Publish to make it visible to your users.',
          })}
        </p>
        {packageId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setHistoryOpen(true)}
            data-testid="unpublished-app-history"
          >
            <History className="mr-1 h-3.5 w-3.5" />
            {t('preview.history.button', { defaultValue: 'History' })}
          </Button>
        ) : null}
        <Button size="sm" onClick={publish} disabled={publishing} data-testid="unpublished-app-publish">
          <Rocket className="mr-1 h-3.5 w-3.5" />
          {publishing
            ? t('preview.unpublishedBar.publishing', { defaultValue: 'Publishing…' })
            : t('preview.unpublishedBar.publish', { defaultValue: 'Publish' })}
        </Button>
      </div>
      {packageId ? (
        <CommitTimeline
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          packageId={packageId}
          onReverted={refresh}
        />
      ) : null}
    </>
  );
}
