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
import { FilePlus2, FilePen, Loader2, ChevronDown, ChevronRight, Rocket } from 'lucide-react';
import {
  Badge,
  Button,
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
async function listPendingDrafts(packageId?: string | null): Promise<DraftChangeEntry[]> {
  const qs = packageId ? `?packageId=${encodeURIComponent(packageId)}` : '';
  const res = await fetch(`/api/v1/meta/_drafts${qs}`, {
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

/**
 * Per-item drill-in: what publishing this one draft changes, as summary lines.
 * For objects the `fields` map is diffed field-by-field (added/removed/changed);
 * every other type lists its changed top-level properties. NEW items list what
 * they ship instead of a diff (there is no published baseline to compare).
 */
async function loadEntryDetail(entry: DraftChangeEntry): Promise<string[]> {
  const base = `/api/v1/meta/${encodeURIComponent(entry.type)}/${encodeURIComponent(entry.name)}`;
  const get = async (qs: string): Promise<Record<string, unknown> | null> => {
    const res = await fetch(`${base}${qs}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown> | { item?: Record<string, unknown> };
    // draft reads come back in a { type, name, item } envelope; published reads are bare
    return (data && typeof data === 'object' && 'item' in data ? (data.item as Record<string, unknown>) : data) ?? null;
  };
  const [draft, published] = await Promise.all([get('?state=draft'), entry.kind === 'update' ? get('') : Promise.resolve(null)]);
  if (!draft) return [];

  const lines: string[] = [];
  const draftFields = (draft.fields ?? {}) as Record<string, unknown>;
  const pubFields = ((published?.fields ?? {}) as Record<string, unknown>) || {};
  if (entry.type === 'object') {
    const names = new Set([...Object.keys(draftFields), ...Object.keys(pubFields)]);
    for (const f of names) {
      const inDraft = f in draftFields;
      const inPub = f in pubFields;
      if (inDraft && !inPub) lines.push(`+ field ${f}`);
      else if (!inDraft && inPub) lines.push(`− field ${f}`);
      else if (JSON.stringify(draftFields[f]) !== JSON.stringify(pubFields[f])) lines.push(`~ field ${f}`);
    }
  }
  // Non-field top-level properties (all types; objects too, e.g. label/validations)
  const skip = new Set(['fields', 'name']);
  const keys = new Set([...Object.keys(draft), ...Object.keys(published ?? {})].filter((k) => !skip.has(k)));
  for (const k of keys) {
    const dv = JSON.stringify(draft[k]);
    const pv = published ? JSON.stringify(published[k]) : undefined;
    if (published === null) {
      if (dv !== undefined) lines.push(`+ ${k}`);
    } else if (dv !== pv) {
      lines.push(`~ ${k}`);
    }
  }
  return lines;
}

export interface DraftChangesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, list only pending drafts belonging to this package (Studio is package-scoped). */
  packageId?: string | null;
  /**
   * When provided, the panel doubles as the publish CONFIRM step: a footer
   * button publishes everything listed. The caller keeps ownership of the
   * actual publish call (and closes the panel on success).
   */
  onPublish?: () => void | Promise<void>;
  /** True while the caller's publish call is in flight (spins the footer button). */
  publishing?: boolean;
}

export function DraftChangesPanel({ open, onOpenChange, packageId, onPublish, publishing }: DraftChangesPanelProps) {
  const { t } = useObjectTranslation();
  const [entries, setEntries] = useState<DraftChangeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, { loading?: boolean; error?: string; lines?: string[] }>>({});

  const toggleDetail = useCallback(
    (entry: DraftChangeEntry) => {
      const key = `${entry.type}:${entry.name}`;
      setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
      setDetails((prev) => {
        if (prev[key]) return prev; // already loaded / loading
        void loadEntryDetail(entry)
          .then((lines) => setDetails((p) => ({ ...p, [key]: { lines } })))
          .catch((e) => setDetails((p) => ({ ...p, [key]: { error: (e as Error).message } })));
        return { ...prev, [key]: { loading: true } };
      });
    },
    [],
  );

  const load = useCallback(async () => {
    setEntries(null);
    setError(null);
    try {
      const drafts = await listPendingDrafts(packageId);
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
  }, [packageId]);

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
                  {items.map((entry) => {
                    const key = `${entry.type}:${entry.name}`;
                    const isOpen = !!expanded[key];
                    const detail = details[key];
                    return (
                      <li key={key} className="rounded-md border text-sm">
                        <button
                          type="button"
                          onClick={() => toggleDetail(entry)}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
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
                        </button>
                        {isOpen && (
                          <div className="border-t bg-muted/30 px-2.5 py-1.5">
                            {detail?.loading ? (
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t('preview.changes.detailLoading', { defaultValue: 'Comparing with the live version…' })}
                              </span>
                            ) : detail?.error ? (
                              <span className="text-[11px] text-destructive">{detail.error}</span>
                            ) : detail?.lines?.length ? (
                              <ul className="flex flex-col gap-0.5">
                                {detail.lines.map((line) => (
                                  <li key={line} className="font-mono text-[11px] text-muted-foreground">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                {t('preview.changes.detailNone', { defaultValue: 'No property-level differences detected.' })}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
        {onPublish && (entries?.length ?? 0) > 0 && (
          <div className="border-t px-4 py-3">
            <Button
              className="w-full"
              onClick={() => void onPublish()}
              disabled={!!publishing}
              data-testid="draft-changes-publish"
            >
              {publishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
              {t('preview.changes.publishAll', {
                defaultValue: 'Publish {{count}} change(s)',
                count: entries?.length ?? 0,
              })}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
