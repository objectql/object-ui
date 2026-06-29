// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * StudioDesignSurface — the open-source WYSIWYG design surface (ADR-0080).
 *
 * Routed as /studio/:packageId/{data|automations|interfaces} — three pillars,
 * each composed AROUND existing renderers (no new editor code):
 *   - Interfaces: the real App navigation tree → live canvas (getMetadataPreview)
 *     + inspector (getMetadataInspector), edits persisting via draft → publish.
 *   - Data: the package's objects → fields + record grid.
 *   - Automations: flows → FlowPreview (default OFF / review-then-enable).
 *
 * Open-core boundary: the left AI copilot is NOT part of the open-source
 * surface — it is an injected slot (`aiSlot`) the cloud edition fills.
 */

import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { SchemaRenderer, useAdapter } from '@object-ui/react';
import { GridFieldAuthoringProvider } from '@object-ui/components';
import {
  Boxes,
  FileText,
  Database,
  LayoutDashboard,
  BarChart3,
  Table2,
  Folder,
  Compass,
  Workflow,
  SlidersHorizontal,
  MousePointer2,
  Eye,
  Loader2,
  Save,
  Pencil,
  Check,
  Plus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getMetadataPreview, type MetadataSelection } from '../metadata-admin/preview-registry';
import { getMetadataInspector } from '../metadata-admin/inspector-registry';
import { useMetadataClient } from '../metadata-admin/useMetadata';
import { AppNavCanvas } from '../metadata-admin/previews/AppNavCanvas';
import { readFields, writeFields, newField } from '../metadata-admin/previews/object-fields-io';

const PILLARS = [
  { key: 'data', label: 'Data' },
  { key: 'automations', label: 'Automations' },
  { key: 'interfaces', label: 'Interfaces' },
] as const;

interface Surface {
  type: string;
  name: string;
  label: string;
}

interface NavNode {
  id?: string;
  label?: string;
  type?: string;
  icon?: string;
  children?: NavNode[];
  pageName?: string;
  page?: string;
  objectName?: string;
  object?: string;
  dashboardName?: string;
  dashboard?: string;
  reportName?: string;
  report?: string;
  viewName?: string;
  view?: string;
  [k: string]: unknown;
}

const KIND_ICON: Record<string, LucideIcon> = {
  group: Folder,
  page: FileText,
  object: Database,
  dashboard: LayoutDashboard,
  report: BarChart3,
  view: Table2,
};
const navIcon = (type?: string): LucideIcon => KIND_ICON[type ?? ''] ?? Compass;

/** Resolve a leaf nav node → the surface {type,name} it binds to. */
function resolveSurface(node: NavNode): Surface | null {
  const label = String(node.label ?? '');
  switch (node.type) {
    case 'page':
      return node.pageName || node.page ? { type: 'page', name: String(node.pageName || node.page), label } : null;
    case 'object':
      return node.objectName || node.object
        ? { type: 'object', name: String(node.objectName || node.object), label }
        : null;
    case 'dashboard':
      return node.dashboardName || node.dashboard
        ? { type: 'dashboard', name: String(node.dashboardName || node.dashboard), label }
        : null;
    case 'report':
      return node.reportName || node.report
        ? { type: 'report', name: String(node.reportName || node.report), label }
        : null;
    case 'view':
      return node.viewName || node.view ? { type: 'view', name: String(node.viewName || node.view), label } : null;
    default:
      return null;
  }
}

/** Normalize the framework draft envelope `{ type, name, item }` → body | null. */
function extractDraftBody(resp: unknown): Record<string, unknown> | null {
  if (!resp || typeof resp !== 'object') return null;
  const env = resp as Record<string, unknown>;
  if (!('item' in env)) return null;
  const body = env.item;
  if (!body || typeof body !== 'object') return null;
  return Object.keys(body as object).length > 0 ? (body as Record<string, unknown>) : null;
}

export interface StudioDesignSurfaceProps {
  /** Open-core slot — the cloud edition injects its AI copilot panel here. */
  aiSlot?: React.ReactNode;
}

export function StudioDesignSurface({ aiSlot }: StudioDesignSurfaceProps): React.ReactElement {
  const params = useParams<{ packageId?: string; tab?: string }>();
  const packageId = params.packageId ?? 'com.example.showcase';
  const tab = params.tab ?? 'interfaces';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {aiSlot ? <aside className="w-64 shrink-0 overflow-auto border-r bg-muted/40">{aiSlot}</aside> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-3 py-2">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
            <Boxes className="h-4 w-4" /> {packageId}
          </span>
          <span className="text-muted-foreground">·</span>
          <nav className="flex gap-1">
            {PILLARS.map((p) => (
              <Link
                key={p.key}
                to={`/studio/${packageId}/${p.key}`}
                className={
                  'rounded-md px-2.5 py-1 text-xs ' +
                  (tab === p.key
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted')
                }
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="min-h-0 flex-1">
          {tab === 'data' ? (
            <DataPillar packageId={packageId} />
          ) : tab === 'automations' ? (
            <AutomationsPillar packageId={packageId} />
          ) : (
            <InterfacesPillar packageId={packageId} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Recursive App-navigation tree (groups + typed leaves). */
function NavTree({
  nodes,
  active,
  onPick,
}: {
  nodes: NavNode[];
  active: Surface | null;
  onPick: (s: Surface) => void;
}): React.ReactElement {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === 'group' || (Array.isArray(node.children) && node.children.length)) {
          return (
            <div key={node.id ?? i} className="mb-1">
              <p className="flex items-center gap-1 px-2 pb-1 pt-3 text-[11px] text-muted-foreground">
                <Folder className="h-3 w-3" /> {node.label}
              </p>
              <div className="pl-1.5">
                <NavTree nodes={node.children ?? []} active={active} onPick={onPick} />
              </div>
            </div>
          );
        }
        const surface = resolveSurface(node);
        const Icon = navIcon(node.type);
        const isActive = !!surface && active?.type === surface.type && active?.name === surface.name;
        return (
          <button
            key={node.id ?? i}
            onClick={() => surface && onPick(surface)}
            disabled={!surface}
            title={surface ? `${surface.type} · ${surface.name}` : node.label}
            className={
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs disabled:opacity-40 ' +
              (isActive ? 'bg-muted font-medium' : 'text-foreground/90 hover:bg-muted/60')
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate">{node.label}</span>
            {surface && surface.type !== 'page' && (
              <span className="rounded bg-muted px-1 py-px text-[9px] uppercase text-muted-foreground">
                {surface.type}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

/** Interfaces pillar — real App nav · live canvas · inspector. */
function InterfacesPillar({ packageId }: { packageId: string }): React.ReactElement {
  const client = useMetadataClient();
  const locale = 'zh-CN';

  const [appLabel, setAppLabel] = React.useState<string>(packageId);
  const [appName, setAppName] = React.useState<string | null>(null);
  const [appDraft, setAppDraft] = React.useState<Record<string, unknown>>({});
  const navTree = React.useMemo<NavNode[]>(
    () => (Array.isArray(appDraft.navigation) ? (appDraft.navigation as NavNode[]) : []),
    [appDraft],
  );
  // nav editing — drag-drop reorder / rename / add / remove via AppNavCanvas
  const [editNav, setEditNav] = React.useState(false);
  const [navSel, setNavSel] = React.useState<{ kind: string; id: string } | null>(null);
  const [navDirty, setNavDirty] = React.useState(false);
  const [navHasDraft, setNavHasDraft] = React.useState(false);
  const [navSaving, setNavSaving] = React.useState<false | 'draft' | 'publish'>(false);
  const [current, setCurrent] = React.useState<Surface | null>(null);
  const [draft, setDraft] = React.useState<Record<string, unknown>>({});
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState<false | 'draft' | 'publish'>(false);
  const [hasDraft, setHasDraft] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Resolve the App by package id → load its navigation tree.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apps = (await client.list('app')) as Array<Record<string, unknown>>;
        if (cancelled) return;
        const app =
          (apps || []).find(
            (a) => a._packageId === packageId || a.packageId === packageId || a.name === packageId,
          ) ?? (apps || [])[0];
        if (!app) return;
        setAppLabel(String(app.label ?? app.name ?? packageId));
        setAppName(String(app.name));
        const [layRaw, appDraftResp] = await Promise.all([
          client.layered<Record<string, unknown>>('app', String(app.name)),
          client.getDraft<Record<string, unknown>>('app', String(app.name)).catch(() => null),
        ]);
        if (cancelled) return;
        const lay = layRaw as { effective?: Record<string, unknown>; code?: Record<string, unknown> };
        const eff = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        const appDraftBody = extractDraftBody(appDraftResp);
        const body = appDraftBody ? { ...eff, ...appDraftBody } : eff;
        setAppDraft(body);
        setNavHasDraft(!!appDraftBody);
        const tree = Array.isArray(body.navigation) ? (body.navigation as NavNode[]) : [];
        // auto-open the first resolvable leaf
        const firstLeaf = (function find(nodes: NavNode[]): Surface | null {
          for (const n of nodes) {
            if (n.type === 'group' || n.children?.length) {
              const r = find(n.children ?? []);
              if (r) return r;
            } else {
              const s = resolveSurface(n);
              if (s) return s;
            }
          }
          return null;
        })(tree);
        setCurrent((cur) => cur ?? firstLeaf);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId]);

  const Preview = getMetadataPreview(current?.type ?? '');
  const Inspector = getMetadataInspector(current?.type ?? '');
  // Object leaves render as a runtime records grid (preview = runtime); schema
  // editing is the Data pillar's job, so they are not draft-editable in this canvas.
  const isEditable = !!Preview && current?.type !== 'object';

  // Load the selected surface's draft (only for editable preview types).
  React.useEffect(() => {
    if (!current || !isEditable) {
      setDraft({});
      setHasDraft(false);
      return;
    }
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
        const body = extractDraftBody(draftResp);
        setDraft(body ? { ...baseline, ...body } : baseline);
        setHasDraft(!!body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, current, isEditable]);

  const onPatch = React.useCallback(
    (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );
  const doSave = React.useCallback(async () => {
    if (!current) return;
    setSaving('draft');
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
    try {
      await client.publish(current.type, current.name);
      setHasDraft(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current]);

  // nav editing — patch appDraft.navigation, then save/publish the App overlay
  const onNavPatch = React.useCallback((patch: Record<string, unknown>) => {
    setAppDraft((d) => ({ ...d, ...patch }));
    setNavDirty(true);
  }, []);
  const doNavSave = React.useCallback(async () => {
    if (!appName) return;
    setNavSaving('draft');
    try {
      await client.save('app', appName, appDraft, { mode: 'draft' });
      setNavHasDraft(true);
      setNavDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNavSaving(false);
    }
  }, [client, appName, appDraft]);
  const doNavPublish = React.useCallback(async () => {
    if (!appName) return;
    setNavSaving('publish');
    try {
      await client.publish('app', appName);
      setNavHasDraft(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNavSaving(false);
    }
  }, [client, appName]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-3 py-1.5">
        {hasDraft && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
            未发布草稿
          </span>
        )}
        <button
          onClick={doSave}
          disabled={!current || !isEditable || !!saving}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {saving === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存草稿
        </button>
        <button
          onClick={doPublish}
          disabled={!current || !isEditable || !hasDraft || !!saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          发布
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* real App navigation tree */}
        <nav className={(editNav ? 'w-72' : 'w-52') + ' flex shrink-0 flex-col border-r'}>
          <div className="shrink-0 border-b px-2 py-1.5">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{appLabel} · 导航</p>
              <button
                type="button"
                onClick={() => {
                  setEditNav((v) => !v);
                  setNavSel(null);
                }}
                title={editNav ? '完成编辑' : '编辑导航(拖拽排序 / 重命名 / 增删)'}
                className={
                  'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ' +
                  (editNav ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')
                }
              >
                {editNav ? (
                  <>
                    <Check className="h-3 w-3" /> 完成
                  </>
                ) : (
                  <>
                    <Pencil className="h-3 w-3" /> 编辑
                  </>
                )}
              </button>
            </div>
            {editNav && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {navHasDraft && (
                  <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                    未发布
                  </span>
                )}
                <button
                  onClick={doNavSave}
                  disabled={!navDirty || !!navSaving}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                >
                  {navSaving === 'draft' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  保存草稿
                </button>
                <button
                  onClick={doNavPublish}
                  disabled={!navHasDraft || !!navSaving}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                >
                  {navSaving === 'publish' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  发布
                </button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {navTree.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">{error ? '加载失败' : '加载中…'}</p>
            ) : editNav ? (
              <AppNavCanvas
                draft={appDraft}
                rootKey="navigation"
                onPatch={onNavPatch}
                selection={navSel}
                onSelectionChange={(s) => setNavSel(s ? { kind: s.kind, id: s.id } : null)}
              />
            ) : (
              <NavTree nodes={navTree} active={current} onPick={setCurrent} />
            )}
          </div>
        </nav>

        {/* canvas */}
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
            {!current ? (
              <div className="py-16 text-center text-sm text-muted-foreground">从左侧选择一个菜单项</div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
              </div>
            ) : current.type === 'object' ? (
              // Object nav leaf = the records list as the running app shows it
              // (preview = runtime). Schema editing lives in the Data pillar, so
              // here we render the object-view grid, not the field-form preview.
              <SchemaRenderer schema={{ type: 'object-view', objectName: current.name } as never} />
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
              <div className="py-12 text-center text-xs text-muted-foreground">
                {current.type} 暂用只读预览,设计能力建设中。
              </div>
            )}
          </div>
          {isEditable ? (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MousePointer2 className="h-3 w-3" /> 点选积木 → 右侧直接改 · 改完「保存草稿」→「发布」
            </p>
          ) : current?.type === 'object' ? (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Database className="h-3 w-3" /> 运行态列表预览 · 改字段 / 结构请到 <span className="font-medium">Data</span> 支柱
            </p>
          ) : null}
        </main>

        {/* inspector */}
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
  );
}

/** Next unused `field_N` name for a freshly-added field. */
function nextFieldName(existing: string[]): string {
  let i = existing.length + 1;
  let name = `field_${i}`;
  while (existing.includes(name)) name = `field_${++i}`;
  return name;
}

/**
 * Data pillar — the package's objects: a records grid (Airtable parity) plus
 * table-based field management. Add a field, or click a column header's edit
 * affordance, to open ObjectFieldInspector (full type list + per-type config)
 * in the right panel; changes persist via the object draft → publish overlay.
 */
function DataPillar({ packageId }: { packageId: string }): React.ReactElement {
  const client = useMetadataClient();
  const adapter = useAdapter();
  const locale = 'zh-CN';
  const [objects, setObjects] = React.useState<Surface[]>([]);
  const [current, setCurrent] = React.useState<Surface | null>(null);
  const [objDraft, setObjDraft] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // field management — a selected field opens ObjectFieldInspector (full type + config)
  const [fieldSel, setFieldSel] = React.useState<MetadataSelection | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [hasDraft, setHasDraft] = React.useState(false);
  const [saving, setSaving] = React.useState<false | 'draft' | 'publish'>(false);
  const [gridVer, setGridVer] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await client.list('object', { packageId })) as Array<Record<string, unknown>>;
        if (cancelled) return;
        const items = (list || [])
          .map((o) => ({ type: 'object', name: String(o.name ?? ''), label: String(o.label ?? o.name ?? '') }))
          .filter((o) => o.name);
        setObjects(items);
        setCurrent((c) => c ?? items[0] ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId]);

  React.useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFieldSel(null);
    setDirty(false);
    (async () => {
      try {
        const [layRaw, draftResp] = await Promise.all([
          client.layered<Record<string, unknown>>('object', current.name),
          client.getDraft<Record<string, unknown>>('object', current.name).catch(() => null),
        ]);
        if (cancelled) return;
        const lay = layRaw as { effective?: Record<string, unknown>; code?: Record<string, unknown> };
        const baseline = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        const draftBody = extractDraftBody(draftResp);
        setObjDraft(draftBody ? { ...baseline, ...draftBody } : baseline);
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

  const fieldCount = React.useMemo(() => readFields(objDraft.fields).entries.length, [objDraft]);

  const onPatch = React.useCallback((patch: Record<string, unknown>) => {
    setObjDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  }, []);

  // "+ add field": append a fresh text field and select it for editing in the panel.
  const addField = React.useCallback(() => {
    const view = readFields(objDraft.fields);
    const name = nextFieldName(view.entries.map((e) => e.name));
    view.entries.push(newField(name, 'text', '新字段'));
    setObjDraft((d) => ({ ...d, fields: writeFields(view) }));
    setDirty(true);
    setFieldSel({ kind: 'field', id: name });
  }, [objDraft]);

  const doSave = React.useCallback(async () => {
    if (!current) return;
    setSaving('draft');
    setError(null);
    try {
      await client.save('object', current.name, objDraft, { mode: 'draft' });
      setHasDraft(true);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current, objDraft]);

  const doPublish = React.useCallback(async () => {
    if (!current) return;
    setSaving('publish');
    setError(null);
    try {
      await client.publish('object', current.name);
      // Bust the data-layer object-schema cache (separate from the metadata client)
      // so the remounted grid re-fetches the new/edited columns without a reload.
      (adapter as { clearCache?: () => void } | null)?.clearCache?.();
      setHasDraft(false);
      setDirty(false);
      setGridVer((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [adapter, client, current]);

  // Drag-reorder columns → reorder the object's `fields` metadata (field display
  // order follows metadata order), then publish so the new order persists.
  const doReorderFields = React.useCallback(
    async (orderedNames: string[]) => {
      if (!current) return;
      const view = readFields(objDraft.fields);
      // Reorder only the visible fields among their own slots; keep system /
      // hidden fields (not shown as columns) in their original positions.
      const visible = new Set(orderedNames);
      const visibleInOrder = orderedNames
        .map((n) => view.entries.find((e) => e.name === n))
        .filter((e): e is (typeof view.entries)[number] => Boolean(e));
      let vi = 0;
      const entries = view.entries.map((e) => (visible.has(e.name) ? visibleInOrder[vi++] : e));
      const body = { ...objDraft, fields: writeFields({ ...view, entries }) };
      setObjDraft(body);
      setSaving('publish');
      setError(null);
      try {
        await client.save('object', current.name, body, { mode: 'draft' });
        await client.publish('object', current.name);
        (adapter as { clearCache?: () => void } | null)?.clearCache?.();
        setHasDraft(false);
        setDirty(false);
        setGridVer((v) => v + 1); // remount so the grid reflects the persisted order
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [client, current, objDraft, adapter],
  );

  const inspector = getMetadataInspector('object');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        {current ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="text-[13px] font-medium text-foreground">{current.label}</span>
            <span className="rounded bg-muted px-1.5 py-0.5">object · {current.name}</span>
            <span>{fieldCount} 字段</span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">选择一个对象</span>
        )}
        {hasDraft && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
            未发布草稿
          </span>
        )}
        <button
          onClick={doSave}
          disabled={!current || !dirty || !!saving}
          className="ml-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
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

      <div className="flex min-h-0 flex-1">
        <nav className="w-52 shrink-0 overflow-auto border-r p-2">
          <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">对象</p>
          {objects.length === 0 && (
            <p className="px-2 py-3 text-[11px] text-muted-foreground">{error ? '加载失败' : '加载中…'}</p>
          )}
          {objects.map((o) => (
            <button
              key={o.name}
              onClick={() => setCurrent(o)}
              className={
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ' +
                (current?.name === o.name ? 'bg-muted font-medium' : 'text-foreground/90 hover:bg-muted/60')
              }
            >
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{o.label}</span>
            </button>
          ))}
        </nav>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
          {!current ? (
            <div className="py-16 text-center text-sm text-muted-foreground">选择一个对象</div>
          ) : (
            <>
              <div className="mb-3 flex shrink-0 items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  <Eye className="h-3 w-3" /> 运行态列表 · 同一渲染器
                </span>
                <button
                  type="button"
                  onClick={addField}
                  title="添加一个字段(随后在右侧设置类型与属性)"
                  className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加字段
                </button>
              </div>
              {error && (
                <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
                  {error}
                </div>
              )}
              {/* Records grid — fields are the columns. Header "+" adds a field, the
                * per-column edit affordance opens the field editor, and dragging a
                * column header reorders the object's fields (all via the context). */}
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background">
                <GridFieldAuthoringProvider
                  value={{
                    onAddColumn: addField,
                    addColumnLabel: '添加字段',
                    onEditColumn: (fieldName) => {
                      // ignore non-field columns (e.g. the row-actions column)
                      if (readFields(objDraft.fields).entries.some((e) => e.name === fieldName)) {
                        setFieldSel({ kind: 'field', id: fieldName });
                      }
                    },
                    editColumnLabel: '编辑字段属性',
                    onReorderFields: doReorderFields,
                  }}
                >
                  <SchemaRenderer
                    key={`${current.name}:${gridVer}`}
                    schema={{ type: 'object-view', objectName: current.name } as never}
                  />
                </GridFieldAuthoringProvider>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MousePointer2 className="h-3 w-3" /> 列头「+」加字段 · 笔形改属性 · 拖列头重排 · 改完「保存草稿」→「发布」
              </p>
            </>
          )}
        </main>

        {/* field inspector — full type list + per-type config (reuses ObjectFieldInspector) */}
        {current && fieldSel && inspector && (
          <aside className="flex w-80 shrink-0 flex-col border-l">
            <header className="flex items-center gap-2 border-b px-3 py-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-[13px] font-medium">字段属性</span>
              <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {fieldSel.id}
              </span>
              <button
                type="button"
                onClick={() => setFieldSel(null)}
                className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {React.createElement(inspector, {
                type: 'object',
                name: current.name,
                draft: objDraft,
                selection: fieldSel,
                onPatch,
                onClearSelection: () => setFieldSel(null),
                onSelectionChange: setFieldSel,
                readOnly: false,
                locale,
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Automations pillar — flows: list → FlowPreview (default OFF / review-then-enable). */
function AutomationsPillar({ packageId }: { packageId: string }): React.ReactElement {
  const client = useMetadataClient();
  const locale = 'zh-CN';
  const [flows, setFlows] = React.useState<Surface[]>([]);
  const [current, setCurrent] = React.useState<Surface | null>(null);
  const [draft, setDraft] = React.useState<Record<string, unknown>>({});
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState<false | 'draft' | 'publish'>(false);
  const [hasDraft, setHasDraft] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const Preview = getMetadataPreview(current?.type ?? '');
  const inspector = getMetadataInspector('flow');
  const isEditable = !!Preview;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await client.list('flow', { packageId })) as Array<Record<string, unknown>>;
        if (cancelled) return;
        const items = (list || [])
          .map((f) => ({ type: 'flow', name: String(f.name ?? ''), label: String(f.label ?? f.name ?? '') }))
          .filter((f) => f.name);
        setFlows(items);
        setCurrent((c) => c ?? items[0] ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId]);

  React.useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelection(null);
    (async () => {
      try {
        const [layRaw, draftResp] = await Promise.all([
          client.layered<Record<string, unknown>>('flow', current.name),
          client.getDraft<Record<string, unknown>>('flow', current.name).catch(() => null),
        ]);
        if (cancelled) return;
        const lay = layRaw as { effective?: Record<string, unknown>; code?: Record<string, unknown> };
        const baseline = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
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
      await client.save('flow', current.name, draft, { mode: 'draft' });
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
      await client.publish('flow', current.name);
      setHasDraft(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground">默认 OFF · 审阅后再启用</span>
        {hasDraft && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
            未发布草稿
          </span>
        )}
        <button
          onClick={doSave}
          disabled={!current || !isEditable || !!saving}
          className="ml-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {saving === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存草稿
        </button>
        <button
          onClick={doPublish}
          disabled={!current || !isEditable || !hasDraft || !!saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          发布
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="w-52 shrink-0 overflow-auto border-r p-2">
          <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">自动化 · flow</p>
          {flows.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-muted-foreground">{error ? '加载失败' : '加载中…'}</p>
          ) : (
            flows.map((f) => (
              <button
                key={f.name}
                onClick={() => setCurrent(f)}
                className={
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ' +
                  (current?.name === f.name ? 'bg-muted font-medium' : 'text-foreground/90 hover:bg-muted/60')
                }
              >
                <Workflow className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{f.label}</span>
              </button>
            ))
          )}
        </nav>

        <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              <Workflow className="h-3 w-3" /> 可视化编排 · 点选节点配置
            </span>
            {current && <span className="text-[11px] text-muted-foreground">flow · {current.name}</span>}
          </div>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="rounded-lg border bg-background p-4">
            {!current ? (
              <div className="py-16 text-center text-sm text-muted-foreground">选择一个自动化</div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
              </div>
            ) : Preview ? (
              React.createElement(Preview, {
                type: current.type,
                name: current.name,
                draft,
                editing: true,
                selection,
                onSelectionChange: setSelection,
                onPatch,
                locale,
              })
            ) : (
              <pre className="overflow-auto text-[11px] text-muted-foreground">
                {JSON.stringify(draft, null, 2)}
              </pre>
            )}
          </div>
          {isEditable && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MousePointer2 className="h-3 w-3" /> 点选节点 → 右侧配置 · 改完「保存草稿」→「发布」
            </p>
          )}
        </main>

        <aside className="w-72 shrink-0 overflow-auto border-l">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="text-[13px] font-medium">配置</span>
            {selection?.label && (
              <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {selection.label}
              </span>
            )}
          </header>
          <div className="p-3">
            {selection && inspector && current ? (
              React.createElement(inspector, {
                type: 'flow',
                name: current.name,
                draft,
                selection,
                onPatch,
                onClearSelection: () => setSelection(null),
                onSelectionChange: setSelection,
                readOnly: false,
                locale,
              })
            ) : (
              <div className="flex flex-col items-center gap-2 px-2 py-10 text-center text-xs text-muted-foreground">
                <MousePointer2 className="h-5 w-5" />
                在画布里点选一个节点,
                <br />
                它的配置会在这里显示。
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default StudioDesignSurface;
