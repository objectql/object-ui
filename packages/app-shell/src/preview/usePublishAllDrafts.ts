/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * One-click "publish everything pending" — shared by the Home pending-drafts
 * banner and the ADR-0037 draft-preview bar, so both surfaces publish through
 * the SAME governed path and report the SAME health.
 *
 * Package-bound drafts go through `POST /packages/:id/publish-drafts` — the
 * path that orders structure-before-seeds server-side and runs the ADR-0038
 * L3 runtime probes; findings surface as a loud warning toast instead of a
 * blind "Published!". Package-less drafts fall back to by-reference publish
 * (structure first, seeds last) so they never dead-end.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { publishHealthFromResponse, type PublishHealth } from '@object-ui/plugin-chatbot';
import { useMetadataClient } from '../views/metadata-admin/useMetadata';

type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

export interface PublishAllResult {
  ok: boolean;
  /** Count of drafts the call attempted to publish. */
  attempted: number;
}

export function usePublishAllDrafts(t: TranslateFn) {
  const client = useMetadataClient();
  const [publishing, setPublishing] = useState(false);

  const publishAll = useCallback(async (): Promise<PublishAllResult> => {
    setPublishing(true);
    try {
      const pending = (((await client.listDrafts?.({})) as any[]) || [])
        .filter((d) => d && typeof d.type === 'string' && typeof d.name === 'string')
        .map((d) => ({
          type: d.type as string,
          name: d.name as string,
          packageId: typeof d.packageId === 'string' && d.packageId ? (d.packageId as string) : null,
        }));
      if (pending.length === 0) {
        toast.info(t('home.pendingDrafts.nothing', { defaultValue: 'Nothing to publish.' }));
        return { ok: true, attempted: 0 };
      }

      const packageIds = [...new Set(pending.map((d) => d.packageId).filter((p): p is string => p !== null))];
      const orphans = pending.filter((d) => d.packageId === null);

      const seedProblems: string[] = [];
      const probeProblems: string[] = [];
      let seededRows = 0;
      const recordHealth = (health: PublishHealth | undefined) => {
        if (!health) return;
        if (health.seedError) seedProblems.push(health.seedError);
        if (typeof health.seededRows === 'number') seededRows += health.seededRows;
        for (const issue of health.issues ?? []) {
          if (issue.severity === 'error') probeProblems.push(issue.message);
        }
      };

      for (const packageId of packageIds) {
        const res = await fetch(`/api/v1/packages/${encodeURIComponent(packageId)}/publish-drafts`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: '{}',
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || (payload as any)?.success === false) {
          throw new Error((payload as any)?.error?.message || `HTTP ${res.status}`);
        }
        recordHealth(publishHealthFromResponse(payload));
      }

      const ordered = [
        ...orphans.filter((d) => d.type !== 'seed'),
        ...orphans.filter((d) => d.type === 'seed'),
      ];
      for (const d of ordered) {
        const res = await client.publishDraft(d.type, d.name);
        const seedApplied = (res as any)?.seedApplied;
        if (seedApplied && seedApplied.success === false) {
          seedProblems.push(seedApplied.error ?? `${d.name}: sample data failed to load`);
        }
      }

      if (probeProblems.length > 0) {
        toast.warning(
          t('home.pendingDrafts.probeWarn', { defaultValue: 'Published, but verification found problems.' }),
          { description: probeProblems[0] },
        );
      } else if (seedProblems.length > 0) {
        toast.warning(
          t('home.pendingDrafts.seedWarn', { defaultValue: 'Published, but some sample data failed to load.' }),
          { description: seedProblems[0] },
        );
      } else {
        toast.success(
          seededRows > 0
            ? t('home.pendingDrafts.publishedVerified', {
                count: seededRows,
                defaultValue: 'Published & verified — {{count}} sample row(s) live.',
              })
            : t('home.pendingDrafts.published', { defaultValue: 'Published! Your changes are live.' }),
        );
      }
      return { ok: true, attempted: pending.length };
    } catch (e) {
      toast.error(
        `${t('home.pendingDrafts.publishFailed', { defaultValue: 'Publish failed' })}: ${(e as Error).message}`,
      );
      return { ok: false, attempted: 0 };
    } finally {
      setPublishing(false);
    }
  }, [client, t]);

  return { publishAll, publishing };
}
