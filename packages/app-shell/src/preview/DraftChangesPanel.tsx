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
 * Each entry expands into a field-level diff (objects) / changed-key summary
 * (everything else), lazily fetched on first expand. This is the review
 * surface that turns Publish from a leap of faith into an informed click.
 *
 * Read-only by default: fetches `_drafts` + published lists on open, and
 * never writes. When the caller passes `onPublish`, the panel additionally
 * renders a confirm footer — review-then-publish in one surface — but the
 * publish action itself still belongs to the caller.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FilePlus2, FilePen, Loader2, Rocket } from 'lucide-react';
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
import { diffFields } from '../views/metadata-admin/previews/object-fields-io';

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
 * Some framework reads wrap the body in a `{ type, name, item }` envelope
 * (draft reads do; published reads return the bare body). Unwrap defensively.
 */
function unwrapItem(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.item && typeof p.item === 'object') return p.item as Record<string, unknown>;
  return p;
}

async function fetchItemBody(
  type: string,
  name: string,
  opts: { draft?: boolean; packageId?: string | null } = {},
): Promise<Record<string, unknown> | null> {
  const params: string[] = [];
  if (opts.draft) params.push('state=draft');
  if (opts.packageId) params.push(`package=${encodeURIComponent(opts.packageId)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const res = await fetch(
    `/api/v1/meta/${encodeURIComponent(type)}/${encodeURIComponent(name)}${qs}`,
    { credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return unwrapItem(await res.json());
}

export interface EntryChangeDetail {
  /** Field-level diff — present when either side carries a `fields` map. */
  fields: {
    added: string[];
    changed: Array<{ name: string; keys: string[] }>;
    removed: string[];
  } | null;
  /** Top-level keys (other than `fields`) whose values differ. */
  changedKeys: string[];
}

/** Stable equality for metadata values (small JSON — order-sensitive is fine). */
function valueEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * What publishing this draft actually changes, computed client-side from the
 * published body (null when the item is NEW) and the pending draft body.
 * `fields` gets the dedicated designer diff; every other top-level key is
 * compared wholesale — enough to answer "which parts of this item move".
 */
export function computeChangeDetail(
  published: Record<string, unknown> | null,
  draft: Record<string, unknown> | null,
): EntryChangeDetail {
  const pub = published ?? {};
  const cur = draft ?? {};
  let fields: EntryChangeDetail['fields'] = null;
  if (pub.fields != null || cur.fields != null) {
    const d = diffFields(pub.fields, cur.fields);
    fields = {
      added: Object.values(d.byName)
        .filter((e) => e.status === 'added')
        .map((e) => e.name)
        .sort(),
      changed: Object.values(d.byName)
        .filter((e) => e.status === 'changed')
        .map((e) => ({ name: e.name, keys: e.changedKeys }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      removed: d.removed.map((e) => e.name).sort(),
    };
  }
  const keys = new Set([...Object.keys(pub), ...Object.keys(cur)]);
  keys.delete('fields');
  const changedKeys = [...keys]
    .filter((k) => !valueEqual((pub as Record<string, unknown>)[k], (cur as Record<string, unknown>)[k]))
    .sort();
  return { fields, changedKeys };
}

/**
 * Lazily-loaded drill-in for one draft entry: published vs draft, rendered as
 * added / changed / removed field rows plus a changed-top-level-keys strip.
 */
function EntryDetail({ entry }: { entry: DraftChangeEntry }) {
  const { t } = useObjectTranslation();
  const [detail, setDetail] = useState<EntryChangeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [published, draft] = await Promise.all([
          // A NEW item 404s on the published read — that's data, not an error.
          fetchItemBody(entry.type, entry.name, { packageId: entry.packageId }),
          fetchItemBody(entry.type, entry.name, { draft: true, packageId: entry.packageId }),
        ]);
        if (!cancelled) setDetail(computeChangeDetail(published, draft));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.type, entry.name, entry.packageId]);

  if (error) {
    return (
      <p className="px-2 py-1 text-xs text-destructive">
        {t('preview.changes.detailLoadFailed', { defaultValue: 'Could not load change detail:' })}{' '}
        {error}
      </p>
    );
  }
  if (!detail) {
    return (
      <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('preview.changes.detailLoading', { defaultValue: 'Loading detail…' })}
      </p>
    );
  }

  const { fields, changedKeys } = detail;
  const hasFieldRows = !!fields && (fields.added.length > 0 || fields.changed.length > 0 || fields.removed.length > 0);
  if (!hasFieldRows && changedKeys.length === 0) {
    return (
      <p className="px-2 py-1 text-xs text-muted-foreground">
        {t('preview.changes.detailNone', {
          defaultValue: 'No differences detected — the draft matches the published version.',
        })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1" data-testid="draft-entry-detail">
      {fields?.added.map((name) => (
        <p key={`+${name}`} className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
          + {name}
        </p>
      ))}
      {fields?.changed.map((f) => (
        <p key={`~${f.name}`} className="font-mono text-xs text-amber-700 dark:text-amber-400">
          ~ {f.name}
          {f.keys.length > 0 && <span className="text-muted-foreground"> · {f.keys.join(', ')}</span>}
        </p>
      ))}
      {fields?.removed.map((name) => (
        <p key={`-${name}`} className="font-mono text-xs text-red-700 line-through dark:text-red-400">
          − {name}
        </p>
      ))}
      {changedKeys.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('preview.changes.detailChangedKeys', { defaultValue: 'Also changed:' })}{' '}
          <span className="font-mono">{changedKeys.join(', ')}</span>
        </p>
      )}
    </div>
  );
}

export interface DraftChangesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, list only pending drafts belonging to this package (Studio is package-scoped). */
  packageId?: string | null;
  /**
   * When provided, the panel renders a confirm footer whose button invokes
   * this — turning the panel into the review-then-publish step. The caller
   * still owns the actual publish request and closing the panel on success.
   */
  onPublish?: () => void | Promise<void>;
  /** Disables the confirm button and shows a spinner while the caller publishes. */
  publishing?: boolean;
}

export function DraftChangesPanel({
  open,
  onOpenChange,
  packageId,
  onPublish,
  publishing = false,
}: DraftChangesPanelProps) {
  const { t } = useObjectTranslation();
  const [entries, setEntries] = useState<DraftChangeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
      <SheetContent
        side="right"
        className="flex w-[420px] flex-col sm:max-w-[420px]"
        data-testid="draft-changes-panel"
      >
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
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
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
                    const isExpanded = expanded.has(key);
                    return (
                      <li key={key} className="rounded-md border text-sm">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(key)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/50"
                          data-testid="draft-entry-toggle"
                        >
                          {isExpanded ? (
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
                        {isExpanded && (
                          <div className="border-t bg-muted/20">
                            <EntryDetail entry={entry} />
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
        {onPublish && (entries?.length ?? 0) > 0 && !error && (
          <div className="mt-auto flex flex-col gap-2 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t('preview.changes.confirmNote', {
                count: entries!.length,
                defaultValue:
                  'Publishing releases all {{count}} pending drafts of this package atomically.',
              })}
            </p>
            <Button
              size="sm"
              onClick={() => void onPublish()}
              disabled={publishing}
              data-testid="draft-changes-publish"
            >
              {publishing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('preview.changes.publishConfirm', { defaultValue: 'Publish all' })}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
