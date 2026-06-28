// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * StudioDesignSurface — the open-source WYSIWYG design surface (ADR-0080).
 *
 * Three zones — single-App nav · live canvas · property inspector — composed
 * AROUND the existing metadata-admin registry (`getMetadataPreview` /
 * `getMetadataInspector`), the runtime `SchemaRenderer`, and the shared
 * `MetadataClient`. Design-time is literally run-time (same renderer, same
 * metadata), and edits persist through the real draft → publish pipeline.
 *
 * Open-core boundary: the left AI copilot is NOT part of the open-source
 * surface. It is an injected slot (`aiSlot`) the cloud edition fills; the OSS
 * build renders three zones.
 */

import * as React from 'react';
import { SchemaRenderer } from '@object-ui/react';
import {
  Boxes,
  FileText,
  SlidersHorizontal,
  MousePointer2,
  Eye,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import { getMetadataPreview, type MetadataSelection } from '../metadata-admin/preview-registry';
import { getMetadataInspector } from '../metadata-admin/inspector-registry';
import { useMetadataClient } from '../metadata-admin/useMetadata';

const PILLARS = ['Data', 'Automations', 'Interfaces'] as const;

interface NavItem {
  type: string;
  name: string;
  label: string;
}

/**
 * Normalize the framework draft envelope `{ type, name, item }` into the draft
 * body or null (mirrors ResourceEditPage.extractDraftBody — a "no draft" stub
 * still carries type/name/label keys, so the `item` key is the only signal).
 */
function extractDraftBody(resp: unknown): Record<string, unknown> | null {
  if (!resp || typeof resp !== 'object') return null;
  const env = resp as Record<string, unknown>;
  if (!('item' in env)) return null;
  const body = env.item;
  if (!body || typeof body !== 'object') return null;
  return Object.keys(body as object).length > 0 ? (body as Record<string, unknown>) : null;
}

export interface StudioDesignSurfaceProps {
  /**
   * Open-core slot. The cloud edition injects its AI copilot panel here
   * (rendered as the far-left zone). The open-source build leaves it
   * undefined, so the surface renders three zones.
   */
  aiSlot?: React.ReactNode;
}

export function StudioDesignSurface({ aiSlot }: StudioDesignSurfaceProps): React.ReactElement {
  const client = useMetadataClient();
  const locale = 'zh-CN';

  const [nav, setNav] = React.useState<NavItem[]>([]);
  const [current, setCurrent] = React.useState<NavItem | null>(null);
  const [draft, setDraft] = React.useState<Record<string, unknown>>({});
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState<false | 'draft' | 'publish'>(false);
  const [hasDraft, setHasDraft] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load the single-App nav: the env's pages become the menu items (a later
  // slice resolves the real App.navigation tree; pages are the demonstrable
  // Interface surfaces today). First item auto-opens.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await client.list('page')) as Array<Record<string, unknown>>;
        if (cancelled) return;
        const items: NavItem[] = (list || [])
          .map((p) => ({ type: 'page', name: String(p.name ?? ''), label: String(p.label ?? p.name ?? '') }))
          .filter((p) => !!p.name);
        setNav(items);
        setCurrent((cur) => cur ?? items[0] ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Load the selected surface's draft (effective baseline + pending overlay),
  // mirroring ResourceEditPage's load.
  React.useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelection(null);
    (async () => {
      try {
        const [lay, draftResp] = await Promise.all([
          client.layered<Record<string, unknown>>(current.type, current.name),
          client.getDraft<Record<string, unknown>>(current.type, current.name).catch(() => null),
        ]);
        if (cancelled) return;
        const baseline = ((lay as { effective?: unknown; code?: unknown }).effective ??
          (lay as { code?: unknown }).code ??
          {}) as Record<string, unknown>;
        const draftBody = extractDraftBody(draftResp);
        setDraft(draftBody ? { ...baseline, ...draftBody } : baseline);
        setHasDraft(!!draftBody);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, current]);

  const onPatch = React.useCallback(
    (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );

  const doSave = React.useCallback(async () => {
    if (!current) return;
    setSaving('draft');
    setError(null);
    try {
      await client.save(current.type, current.name, draft, { mode: 'draft' });
      setHasDraft(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current, draft]);

  const doPublish = React.useCallback(async () => {
    if (!current) return;
    setSaving('publish');
    setError(null);
    try {
      await client.publish(current.type, current.name);
      setHasDraft(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current]);

  const Preview = getMetadataPreview(current?.type ?? 'page');
  const Inspector = getMetadataInspector(current?.type ?? 'page');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* ── Zone 0 · AI copilot — OPEN-CORE SLOT (cloud-injected; absent in OSS) ── */}
      {aiSlot ? (
        <aside className="w-64 shrink-0 overflow-auto border-r bg-muted/40">{aiSlot}</aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar: three pillars + draft/publish */}
        <header className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
              <Boxes className="h-4 w-4" /> Showcase
            </span>
            <span className="text-muted-foreground">·</span>
            <nav className="flex gap-1">
              {PILLARS.map((p) => (
                <span
                  key={p}
                  className={
                    'rounded-md px-2.5 py-1 text-xs ' +
                    (p === 'Interfaces'
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground')
                  }
                >
                  {p}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasDraft && (
              <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
                未发布草稿
              </span>
            )}
            <button
              onClick={doSave}
              disabled={!current || !!saving}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              {saving === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存草稿
            </button>
            <button
              onClick={doPublish}
              disabled={!current || !hasDraft || !!saving}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              发布
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ── Zone 1 · single-App nav (real pages; click switches the canvas) ── */}
          <nav className="w-48 shrink-0 overflow-auto border-r p-2">
            <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">单一 App · 页面</p>
            {nav.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {error ? '加载失败' : '加载中…'}
              </p>
            )}
            {nav.map((it) => (
              <button
                key={it.name}
                onClick={() => setCurrent(it)}
                className={
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ' +
                  (current?.name === it.name ? 'bg-muted font-medium' : 'text-foreground/90 hover:bg-muted/60')
                }
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{it.label}</span>
              </button>
            ))}
          </nav>

          {/* ── Zone 2 · canvas (live render of the real surface = runtime) ── */}
          <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                <Eye className="h-3 w-3" /> 预览即运行 · 同一渲染器
              </span>
              {current && (
                <span className="text-[11px] text-muted-foreground">
                  {current.type} · {current.name}
                </span>
              )}
            </div>
            {error && (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <div className="rounded-lg border bg-background p-4">
              {loading || !current ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
                </div>
              ) : Preview ? (
                <Preview
                  type={current.type}
                  name={current.name}
                  draft={draft}
                  editing
                  selection={selection}
                  onSelectionChange={setSelection}
                  onPatch={onPatch}
                  locale={locale}
                />
              ) : (
                <SchemaRenderer schema={{ ...draft, type: current.type } as never} />
              )}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MousePointer2 className="h-3 w-3" /> 点选积木 → 右侧直接改 · 改完「保存草稿」→「发布」
            </p>
          </main>

          {/* ── Zone 3 · inspector (selected block's property schema) ── */}
          <aside className="w-72 shrink-0 overflow-auto border-l">
            <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-[13px] font-medium">属性</span>
              {selection?.label && (
                <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {selection.label}
                </span>
              )}
            </header>
            <div className="p-3">
              {selection && Inspector && current ? (
                <Inspector
                  type={current.type}
                  name={current.name}
                  draft={draft}
                  selection={selection}
                  onPatch={onPatch}
                  onClearSelection={() => setSelection(null)}
                  onSelectionChange={setSelection}
                  readOnly={false}
                  locale={locale}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-2 py-10 text-center text-xs text-muted-foreground">
                  <MousePointer2 className="h-5 w-5" />
                  在画布里点选一个积木,
                  <br />
                  它的属性会在这里直接编辑。
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default StudioDesignSurface;
