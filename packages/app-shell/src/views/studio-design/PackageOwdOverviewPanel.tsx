// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PackageOwdOverviewPanel — the package-scoped Record Sharing Baseline (OWD)
 * overview (objectui#2505).
 *
 * A sibling surface in the Studio Access pillar, next to the permission-set
 * rail. Where the per-object Settings tab (`ObjectSettingsPanel`) edits one
 * object's `sharingModel` / `externalSharingModel` at a time, this table
 * surveys — and batch-edits — the OWD baseline of EVERY object the package
 * owns (published ∪ pending drafts, the same merge the pillars do).
 *
 * Ownership boundary (ADR-0090 / permission-model.md): every row here has the
 * same owner — the package author. This is an aggregation of N per-object
 * editing entry points within one ownership boundary, NOT a merge of OWD into
 * the per-principal permission-set matrix (which was considered and rejected).
 * It has no principal dimension.
 *
 *   • Save = per-object metadata DRAFTs under the package scope — byte-for-byte
 *     what the per-object Settings tab writes, just N objects in one action.
 *     Publish then flows through the unchanged package security-domain gate.
 *   • Row validation `external ≤ internal` (ADR-0090 D11) is surfaced inline
 *     and blocks Save, reusing `isExternalWider` from `owd-sharing.ts`.
 *   • `controlled_by_parent` rows show the master link (read-only) instead of
 *     an external dial, mirroring the per-object settings behavior.
 *   • Read-only packages render badges only (the pillar's courtesy gate).
 */

import * as React from 'react';
import { ShieldCheck, Save, Loader2, Lock, ArrowUpRight, AlertTriangle } from 'lucide-react';
import type { MetadataClient } from '@object-ui/data-objectstack';
import { t, tFormat, type SupportedLocale } from '../metadata-admin/i18n';
import { formatMetadataError } from './metadataError';
import { isExternalWider, deriveMasterObject } from './owd-sharing';
import { toast } from 'sonner';

/** Normalize the framework draft envelope `{ type, name, item }` → body | null. */
function extractDraftBody(resp: unknown): Record<string, unknown> | null {
  if (!resp || typeof resp !== 'object') return null;
  const env = resp as Record<string, unknown>;
  if (!('item' in env)) return null;
  const body = env.item;
  if (!body || typeof body !== 'object') return null;
  return Object.keys(body as object).length > 0 ? (body as Record<string, unknown>) : null;
}

/** A single object's loaded OWD baseline (already merged over any pending draft). */
interface OwdRow {
  name: string;
  label: string;
  /** Authored `sharingModel`; '' when unset (defaults to private, ADR-0090 D1). */
  internal: string;
  /** Authored `externalSharingModel`; '' when unset. */
  external: string;
  /** Master (parent) object for `controlled_by_parent` rows, if resolvable. */
  master?: string;
  /** True when this object already has an unpublished draft. */
  hasDraft: boolean;
}

/** The user's working value for one row ('' = unset). */
interface OwdEdit {
  internal: string;
  external: string;
}

const OWD_OPTION_KEYS: ReadonlyArray<{ value: string; key: string }> = [
  { value: 'private', key: 'engine.studio.settings.sharingPrivate' },
  { value: 'public_read', key: 'engine.studio.settings.sharingPublicRead' },
  { value: 'public_read_write', key: 'engine.studio.settings.sharingPublicReadWrite' },
  { value: 'controlled_by_parent', key: 'engine.studio.settings.sharingControlledByParent' },
];

/** Short localized label for an OWD value; unset → "(not set — defaults to Private)". */
function owdLabel(value: string, locale: SupportedLocale): string {
  if (!value) return t('engine.studio.settings.sharingUnset', locale);
  const hit = OWD_OPTION_KEYS.find((o) => o.value === value);
  return hit ? t(hit.key, locale) : value;
}

export interface PackageOwdOverviewPanelProps {
  client: MetadataClient;
  packageId: string;
  /** Bumped on package publish → re-read the freshly published baseline. */
  publishNonce?: number;
  /** Notify the surface so its pending-changes counter refreshes after a save. */
  onDraftSaved?: () => void;
  /** Courtesy gate: read-only packages render badges only (ADR-0057 D10). */
  readOnly?: boolean;
  locale: SupportedLocale;
  /** Object to scroll to / highlight (deep-link from the permission matrix badge). */
  highlightObject?: string | null;
}

export function PackageOwdOverviewPanel({
  client,
  packageId,
  publishNonce = 0,
  onDraftSaved,
  readOnly = false,
  locale,
  highlightObject,
}: PackageOwdOverviewPanelProps): React.ReactElement {
  const [rows, setRows] = React.useState<OwdRow[]>([]);
  const [edits, setEdits] = React.useState<Record<string, OwdEdit>>({});
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoaded(false);
    setLoadError(null);
    try {
      // Objects this package owns: published records ∪ pending draft headers
      // (the same union the Data / Access rails build). `list()` sees published
      // metadata only, so a draft-only object appears via `listDrafts()`.
      const [list, draftHeaders] = await Promise.all([
        client.list<Record<string, unknown>>('object', { packageId }),
        client.listDrafts({ packageId, type: 'object' }).catch(() => [] as Array<{ name?: string }>),
      ]);
      const publishedLabel = new Map<string, string>();
      const names: string[] = [];
      const seen = new Set<string>();
      for (const raw of list || []) {
        const item = ((raw as { item?: unknown }).item ?? raw) as Record<string, unknown>;
        const name = String(item.name ?? '');
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push(name);
        publishedLabel.set(name, String(item.label ?? name));
      }
      for (const d of draftHeaders || []) {
        const name = String(d?.name ?? '');
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push(name);
      }

      // The list row carries `sharingModel` but not reliably `fields` (needed
      // for the master link), and never the pending-draft value — so read each
      // object's merged body (layered ∪ its draft), exactly as the per-object
      // Settings tab does, and derive every column from that one source.
      const built = await Promise.all(
        names.map(async (name): Promise<OwdRow> => {
          const [layRaw, draftResp] = await Promise.all([
            client.layered<Record<string, unknown>>('object', name).catch(() => null),
            client.getDraft<Record<string, unknown>>('object', name).catch(() => null),
          ]);
          const lay = (layRaw ?? {}) as { effective?: Record<string, unknown>; code?: Record<string, unknown> };
          const baseline = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
          const draftBody = extractDraftBody(draftResp);
          const body = draftBody ? { ...baseline, ...draftBody } : baseline;
          const internal = typeof body.sharingModel === 'string' ? body.sharingModel : '';
          return {
            name,
            label: String(body.label ?? publishedLabel.get(name) ?? name),
            internal,
            external: typeof body.externalSharingModel === 'string' ? body.externalSharingModel : '',
            master: internal === 'controlled_by_parent' ? deriveMasterObject(body.fields) : undefined,
            hasDraft: !!draftBody,
          };
        }),
      );
      built.sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name));
      setRows(built);
      // Reset working edits to the freshly loaded baseline.
      setEdits(Object.fromEntries(built.map((r) => [r.name, { internal: r.internal, external: r.external }])));
    } catch (e) {
      setLoadError(formatMetadataError(e));
    } finally {
      setLoaded(true);
    }
  }, [client, packageId]);

  React.useEffect(() => {
    void load();
  }, [load, publishNonce]);

  // Deep-link highlight — scroll the linked object's row into view.
  const rowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  React.useEffect(() => {
    if (!highlightObject || !loaded) return;
    const el = rowRefs.current[highlightObject];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightObject, loaded]);

  const setEdit = React.useCallback((name: string, patch: Partial<OwdEdit>) => {
    setEdits((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }, []);

  // A row is dirty when its working value differs from the loaded baseline;
  // invalid when the external baseline is wider than the internal one (D11).
  const rowState = React.useMemo(() => {
    return rows.map((r) => {
      const e = edits[r.name] ?? { internal: r.internal, external: r.external };
      const dirty = e.internal !== r.internal || e.external !== r.external;
      const invalid = isExternalWider(e.internal, e.external);
      return { row: r, edit: e, dirty, invalid };
    });
  }, [rows, edits]);

  const dirtyCount = rowState.filter((s) => s.dirty).length;
  const hasInvalid = rowState.some((s) => s.invalid);

  const doSave = React.useCallback(async () => {
    const changed = rowState.filter((s) => s.dirty && !s.invalid);
    if (changed.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Each changed row lands as that object's package-scoped DRAFT: read the
      // fresh merged body, apply just the OWD pair (unset → drop the key), and
      // save. Identical to the per-object Settings write, N times — publish
      // then goes through the same package security-domain gate unchanged.
      for (const s of changed) {
        const [layRaw, draftResp] = await Promise.all([
          client.layered<Record<string, unknown>>('object', s.row.name).catch(() => null),
          client.getDraft<Record<string, unknown>>('object', s.row.name).catch(() => null),
        ]);
        const lay = (layRaw ?? {}) as { effective?: Record<string, unknown>; code?: Record<string, unknown> };
        const baseline = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        const draftBody = extractDraftBody(draftResp);
        const next: Record<string, unknown> = { ...baseline, ...(draftBody ?? {}) };
        if (s.edit.internal) next.sharingModel = s.edit.internal;
        else delete next.sharingModel;
        if (s.edit.external) next.externalSharingModel = s.edit.external;
        else delete next.externalSharingModel;
        await client.save('object', s.row.name, next, { mode: 'draft', packageId });
      }
      toast.success(tFormat('engine.studio.owd.saved', locale, { count: changed.length }));
      onDraftSaved?.();
      await load();
    } catch (e) {
      setSaveError(formatMetadataError(e));
    } finally {
      setSaving(false);
    }
  }, [rowState, client, packageId, onDraftSaved, load, locale]);

  const canSave = !readOnly && !saving && dirtyCount > 0 && !hasInvalid;

  return (
    <div className="flex h-full flex-col" data-testid="owd-overview">
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-[15px] font-semibold leading-none text-foreground">
            {t('engine.studio.owd.title', locale)}
          </span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {t('engine.studio.owd.subtitle', locale)}
          </span>
        </span>
        {readOnly ? (
          <span
            title={t('engine.studio.pkg.readonlyHint', locale)}
            className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <Lock className="h-3 w-3" /> {t('engine.studio.pkg.readonly', locale)}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void doSave()}
            disabled={!canSave}
            data-testid="owd-save"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirtyCount > 0
              ? tFormat('engine.studio.owd.save', locale, { count: dirtyCount })
              : t('engine.studio.owd.saveNone', locale)}
          </button>
        )}
      </div>

      <p className="border-b px-4 py-2 text-[11px] text-muted-foreground">
        {t('engine.studio.owd.description', locale)}
      </p>

      {hasInvalid && (
        <p
          data-testid="owd-invalid-banner"
          className="flex items-center gap-1.5 border-b bg-amber-400/10 px-4 py-2 text-[11px] text-amber-600 dark:text-amber-400"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('engine.studio.owd.blockedSave', locale)}
        </p>
      )}
      {saveError && (
        <p className="border-b bg-destructive/10 px-4 py-2 text-[11px] text-destructive">{saveError}</p>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!loaded ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t('engine.studio.loading', locale)}</p>
        ) : loadError ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t('engine.studio.owd.loadFailed', locale)}</p>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t('engine.studio.owd.none', locale)}</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">{t('engine.studio.owd.colObject', locale)}</th>
                <th className="px-2 py-1.5 font-medium">{t('engine.studio.owd.colInternal', locale)}</th>
                <th className="px-2 py-1.5 font-medium">{t('engine.studio.owd.colExternal', locale)}</th>
              </tr>
            </thead>
            <tbody>
              {rowState.map(({ row, edit, dirty, invalid }) => {
                const isParent = edit.internal === 'controlled_by_parent';
                return (
                  <tr
                    key={row.name}
                    ref={(el) => {
                      rowRefs.current[row.name] = el;
                    }}
                    data-testid={`owd-row-${row.name}`}
                    className={
                      'border-b align-top ' +
                      (highlightObject === row.name ? 'bg-primary/5' : '')
                    }
                  >
                    <td className="px-2 py-2">
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{row.label}</span>
                          {dirty && (
                            <span
                              data-testid={`owd-dirty-${row.name}`}
                              className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300"
                            >
                              {t('engine.studio.owd.unsaved', locale)}
                            </span>
                          )}
                          {row.hasDraft && !dirty && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {t('engine.studio.unpublishedDraft', locale)}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{row.name}</span>
                      </span>
                    </td>

                    {/* Internal (sharingModel) */}
                    <td className="px-2 py-2">
                      {readOnly ? (
                        <span className="text-muted-foreground">{owdLabel(edit.internal, locale)}</span>
                      ) : (
                        <select
                          value={edit.internal}
                          data-testid={`owd-internal-${row.name}`}
                          onChange={(e) => setEdit(row.name, { internal: e.target.value })}
                          className="w-full min-w-[13rem] rounded border bg-background px-2 py-1 text-[12px]"
                        >
                          <option value="">{t('engine.studio.settings.sharingUnset', locale)}</option>
                          {OWD_OPTION_KEYS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {t(o.key, locale)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* External (externalSharingModel) — or the master link for
                        controlled_by_parent rows (no external dial). */}
                    <td className="px-2 py-2">
                      {isParent ? (
                        <span
                          data-testid={`owd-master-${row.name}`}
                          title={t('engine.studio.owd.masterTip', locale)}
                          className="inline-flex items-center gap-1 text-muted-foreground"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          {row.master
                            ? tFormat('engine.studio.owd.byParent', locale, { master: row.master })
                            : t('engine.studio.owd.byParentUnknown', locale)}
                        </span>
                      ) : readOnly ? (
                        <span className="text-muted-foreground">{owdLabel(edit.external, locale)}</span>
                      ) : (
                        <>
                          <select
                            value={edit.external}
                            data-testid={`owd-external-${row.name}`}
                            onChange={(e) => setEdit(row.name, { external: e.target.value })}
                            className={
                              'w-full min-w-[13rem] rounded border bg-background px-2 py-1 text-[12px] ' +
                              (invalid ? 'border-amber-500' : '')
                            }
                          >
                            <option value="">{t('engine.studio.settings.sharingExternalUnset', locale)}</option>
                            {OWD_OPTION_KEYS.filter((o) => o.value !== 'controlled_by_parent').map((o) => (
                              <option key={o.value} value={o.value}>
                                {t(o.key, locale)}
                              </option>
                            ))}
                          </select>
                          {invalid && (
                            <span
                              data-testid={`owd-error-${row.name}`}
                              className="mt-1 block text-[11px] text-amber-600 dark:text-amber-500"
                            >
                              {t('engine.studio.owd.widerError', locale)}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PackageOwdOverviewPanel;
