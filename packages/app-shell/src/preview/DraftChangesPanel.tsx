/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * "What will publishing change?" — the draft changeset, answered before the
 * user commits. Lists every pending ADR-0033 draft grouped by metadata type,
 * and classifies each as NEW (no published version exists — publishing adds
 * it) or UPDATE (a published version exists — publishing overwrites it).
 * This is the review surface that turns Publish from a leap of faith into an
 * informed click; the per-item designer diff remains the deep-dive.
 *
 * Read-only: fetches `_drafts` + per-item `/published` probes on open, and
 * never writes. Publishing stays with the caller (DraftPreviewBar / chat).
 */

import { useCallback, useEffect, useState } from 'react';
import { FilePlus2, FilePen, Loader2 } from 'lucide-react';
import {
  Badge,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';

export interface DraftChangeEntry {
  type: string;
  name: string;
  packageId: string | null;
  /** `new` = no published version; `update` = overwrites one; undefined = probing. */
  kind?: 'new' | 'update';
}

/** Pending drafts straight from the ADR-0033 `_drafts` endpoint. */
async function listPendingDrafts(): Promise<DraftChangeEntry[]> {
  const res = await fetch('/api/v1/meta/_drafts', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`_drafts HTTP ${res.status}`);
  const data = (await res.json()) as
    | Array<Record<string, unknown>>
    | { drafts?: Array<Record<string, unknown>> };
  const list = Array.isArray(data) ? data : data?.drafts ?? [];
  return list
    .filter((d) => typeof d?.type === 'string' && typeof d?.name === 'string')
    .map((d) => ({
      type: d.type as string,
      name: d.name as string,
      packageId: typeof d.packageId === 'string' && d.packageId ? (d.packageId as string) : null,
    }));
}

/**
 * Names that exist in the PUBLISHED world for a type — the plain (no
 * `preview=draft`) list. One request classifies every draft of that type:
 * a draft whose name is absent here is NEW; present means publish UPDATES it.
 * (A per-item `/published` probe would be O(drafts) requests, and the REST
 * tree has no such sub-route — the generic :name handler answers anything.)
 */
async function publishedNamesOf(type: string): Promise<Set<string>> {
  const res = await fetch(`/api/v1/meta/${encodeURIComponent(type)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`published list HTTP ${res.status}`);
  const data = (await res.json()) as unknown[] | { items?: unknown[] };
  const list = Array.isArray(data) ? data : data?.items ?? [];
  return new Set(
    (list as Array<{ name?: unknown }>)
      .map((it) => (typeof it?.name === 'string' ? it.name : null))
      .filter((n): n is string => n !== null),
  );
}

export interface DraftChangesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DraftChangesPanel({ open, onOpenChange }: DraftChangesPanelProps) {
  const { t } = useObjectTranslation();
  const [entries, setEntries] = useState<DraftChangeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(null);
    setError(null);
    try {
      const drafts = await listPendingDrafts();
      setEntries(drafts);
      // Classify new-vs-update per TYPE: one published-list read covers every
      // draft of that type. A type whose read fails stays unclassified
      // (rendered neutrally) rather than failing the whole panel.
      const types = [...new Set(drafts.map((d) => d.type))];
      await Promise.all(
        types.map(async (type) => {
          let published: Set<string> | null = null;
          try {
            published = await publishedNamesOf(type);
          } catch {
            return;
          }
          setEntries((prev) =>
            prev
              ? prev.map((entry) =>
                  entry.type === type
                    ? { ...entry, kind: published!.has(entry.name) ? 'update' : 'new' }
                    : entry,
                )
              : prev,
          );
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const byType = new Map<string, DraftChangeEntry[]>();
  for (const entry of entries ?? []) {
    const bucket = byType.get(entry.type) ?? [];
    bucket.push(entry);
    byType.set(entry.type, bucket);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]" data-testid="draft-changes-panel">
        <SheetHeader>
          <SheetTitle>
            {t('preview.changes.title', { defaultValue: 'Pending changes' })}
          </SheetTitle>
          <SheetDescription>
            {t('preview.changes.description', {
              defaultValue: 'What publishing will change. New items are added; updates overwrite the live version.',
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          {error ? (
            <p className="text-sm text-destructive">
              {t('preview.changes.loadFailed', { defaultValue: 'Could not load pending changes:' })}{' '}
              {error}
            </p>
          ) : entries === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('preview.changes.loading', { defaultValue: 'Loading pending changes…' })}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('preview.changes.empty', { defaultValue: 'Nothing pending — every draft has been published.' })}
            </p>
          ) : (
            [...byType.entries()].map(([type, items]) => (
              <div key={type}>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {type} · {items.length}
                </h4>
                <ul className="flex flex-col gap-1">
                  {items.map((entry) => (
                    <li
                      key={`${entry.type}:${entry.name}`}
                      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      {entry.kind === 'new' ? (
                        <FilePlus2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : entry.kind === 'update' ? (
                        <FilePen className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.name}</span>
                      {entry.kind ? (
                        <Badge
                          variant="outline"
                          className={
                            entry.kind === 'new'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }
                        >
                          {entry.kind === 'new'
                            ? t('preview.changes.kindNew', { defaultValue: 'New' })
                            : t('preview.changes.kindUpdate', { defaultValue: 'Update' })}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
