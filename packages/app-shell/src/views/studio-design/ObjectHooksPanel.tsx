/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — Hooks view.
 *
 * Unlike validations/actions (inline arrays on the object draft), hooks are a
 * SEPARATE `hook` metadata type whose `object` field targets one object, a
 * list, or `*`. So this panel fetches them (client.list) and persists each one
 * on its own (client.save('hook', …, { mode: 'draft' })) — the object's Save
 * draft doesn't cover them.
 *
 * Master-detail, editable: a left list of the hooks that fire on this object,
 * and on the right the platform's own generic metadata form (SchemaForm) — the
 * same surface the metadata admin uses to edit a hook — with a per-hook Save.
 * There's no curated `hook` inspector, so SchemaForm synthesises a structured
 * form from the hook's shape.
 */

import React from 'react';
import { Webhook, Plus, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { SchemaForm } from '../metadata-admin/SchemaForm';
import { getMetadataDefaultInspector } from '../metadata-admin/default-inspector-registry';
import { useMetadataClient } from '../metadata-admin/useMetadata';
import { t, tFormat, useMetadataLocale } from '../metadata-admin/i18n';
import { formatMetadataError } from './metadataError';

interface HookItem {
  name?: string;
  label?: string;
  object?: string | string[];
  async?: boolean;
  [key: string]: unknown;
}

/** The body out of a getDraft() envelope (`{ item: {...} }`). */
function draftBody(resp: unknown): HookItem | null {
  if (!resp || typeof resp !== 'object' || !('item' in resp)) return null;
  const body = (resp as { item?: unknown }).item;
  return body && typeof body === 'object' && Object.keys(body).length > 0 ? (body as HookItem) : null;
}

/** Does this hook's `object` target match the object we're viewing? */
function targetsObject(hook: HookItem, objectName: string): boolean {
  const target = hook.object;
  if (target === '*') return true;
  if (typeof target === 'string') return target === objectName;
  if (Array.isArray(target)) return target.includes(objectName) || target.includes('*');
  return false;
}

/** A fresh, unique, snake_case hook name scoped to the object. */
function nextHookName(objectName: string, existing: string[]): string {
  const base = (objectName || 'hook').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const taken = new Set(existing);
  let i = existing.length + 1;
  let name = `${base}_hook_${i}`;
  while (taken.has(name)) name = `${base}_hook_${++i}`;
  return name;
}

export function ObjectHooksPanel({
  objectName,
  packageId,
  disabled,
  hookSchema,
}: {
  objectName: string;
  packageId: string;
  disabled?: boolean;
  /**
   * The live server JSONSchema for the `hook` type (`/meta/types`). Drives the
   * SchemaForm so the fields, enums and grouping come from the real hook
   * metadata contract rather than being synthesised from the value shape.
   */
  hookSchema?: Record<string, unknown>;
}) {
  const locale = useMetadataLocale();
  const client = useMetadataClient();
  // Curated hook authoring surface (object picker + events + dedicated body
  // editor); falls back to the generic SchemaForm if unregistered.
  const HookInspector = getMetadataDefaultInspector('hook');
  const [hooks, setHooks] = React.useState<HookItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<HookItem | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // `list()` only sees PUBLISHED hooks; a freshly-created (or edited)
        // hook is a draft, so also pull draft headers and hydrate each body
        // (headers carry no `object`, so we must load them to filter + edit).
        // Drafts win over the published row of the same name.
        const [pub, draftHeaders] = await Promise.all([
          client.list('hook', { packageId }) as Promise<HookItem[]>,
          client.listDrafts({ packageId, type: 'hook' }).catch(() => [] as Array<{ name?: string }>),
        ]);
        const draftNames = (draftHeaders || []).map((d) => String(d.name ?? '')).filter(Boolean);
        const bodies = await Promise.all(
          draftNames.map((n) => client.getDraft('hook', n).then(draftBody).catch(() => null)),
        );
        if (cancelled) return;
        const byName = new Map<string, HookItem>();
        for (const h of pub || []) {
          if (h?.name && targetsObject(h, objectName)) byName.set(String(h.name), h);
        }
        draftNames.forEach((n, i) => {
          const body = bodies[i];
          if (body && targetsObject(body, objectName)) byName.set(n, body);
        });
        setHooks([...byName.values()]);
      } catch (e) {
        if (!cancelled) setError(formatMetadataError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId, objectName, nonce]);

  // Load the selected hook into an editable draft (once per selection change).
  React.useEffect(() => {
    const hook = hooks.find((h) => h.name === selected) ?? null;
    setDraft(hook ? { ...hook } : null);
    setDirty(false);
  }, [selected, hooks]);

  const save = React.useCallback(async () => {
    if (!draft?.name) return;
    setSaving(true);
    setError(null);
    try {
      await client.save('hook', String(draft.name), draft, { mode: 'draft', packageId });
      toast.success(tFormat('engine.studio.hooks.saved', locale, { label: String(draft.label || draft.name) }));
      setDirty(false);
      setNonce((n) => n + 1);
    } catch (e) {
      setError(formatMetadataError(e));
    } finally {
      setSaving(false);
    }
  }, [client, draft, packageId, locale]);

  const addHook = React.useCallback(async () => {
    const name = nextHookName(objectName, hooks.map((h) => String(h.name ?? '')));
    // A complete, *valid* skeleton so the immediate save passes: hooks require
    // an object, at least one event, and a valid body discriminator.
    const fresh: HookItem = {
      name,
      label: t('engine.studio.hooks.newLabel', locale),
      object: objectName,
      events: ['beforeInsert'],
      body: { language: 'js', source: 'return;' },
      priority: 100,
      async: false,
    };
    setSaving(true);
    setError(null);
    try {
      await client.save('hook', name, fresh, { mode: 'draft', packageId });
      setNonce((n) => n + 1);
      setSelected(name);
    } catch (e) {
      setError(formatMetadataError(e));
    } finally {
      setSaving(false);
    }
  }, [client, objectName, hooks, packageId, locale]);

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* hook list */}
      <div className="flex w-72 shrink-0 flex-col rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Webhook className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{t('engine.studio.data.tab.hooks', locale)}</span>
          <span className="text-[11px] text-muted-foreground">({hooks.length})</span>
          {!disabled && (
            <button
              type="button"
              onClick={addHook}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> {t('engine.studio.new', locale)}
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">{t('engine.studio.loading', locale)}</p>
          ) : hooks.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] leading-5 text-muted-foreground">{t('engine.studio.hooks.none', locale)}</p>
          ) : (
            hooks.map((h) => (
              <button
                key={String(h.name)}
                type="button"
                onClick={() => setSelected(h.name ?? null)}
                className={
                  'flex w-full items-center gap-2 border-b px-3 py-2 text-left text-[12px] ' +
                  (selected === h.name ? 'bg-muted' : 'hover:bg-muted/50')
                }
              >
                <Webhook className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{h.label || h.name}</span>
                {h.async && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {t('engine.studio.hooks.async', locale)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* detail — the platform's generic metadata form */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
        {error && (
          <div className="border-b border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive whitespace-pre-line">
            {error}
          </div>
        )}
        {!draft ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-muted-foreground">
            {t('engine.studio.hooks.pick', locale)}
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{String(draft.label || draft.name)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || saving}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {t('engine.studio.hooks.save', locale)}
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {HookInspector ? (
                // eslint-disable-next-line react-hooks/static-components -- getMetadataDefaultInspector returns a registered component (stable), not one created during render
                <HookInspector
                  type="hook"
                  name={String(draft.name ?? '')}
                  draft={draft as Record<string, unknown>}
                  onPatch={(patch) => {
                    setDraft((d) => ({ ...(d as HookItem), ...patch }));
                    setDirty(true);
                  }}
                  readOnly={!!disabled}
                  locale={locale}
                  serverSchema={hookSchema}
                />
              ) : (
                <div className="p-3">
                  <SchemaForm
                    schema={hookSchema}
                    value={draft as Record<string, unknown>}
                    onChange={(next) => {
                      setDraft(next as HookItem);
                      setDirty(true);
                    }}
                    readOnly={!!disabled}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
