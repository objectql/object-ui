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
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SchemaRenderer, useAdapter, SchemaRendererProvider } from '@object-ui/react';
import { GridFieldAuthoringProvider } from '@object-ui/components';
import { ObjectView as PluginObjectView } from '@object-ui/plugin-view';
import { ListView } from '@object-ui/plugin-list';
import { ObjectForm } from '@object-ui/plugin-form';
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
  GitBranch,
  Rocket,
  ChevronDown,
  Lock,
  ExternalLink,
  Home as HomeIcon,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { getMetadataPreview, type MetadataSelection } from '../metadata-admin/preview-registry';
import { PermissionMatrixEditPage } from '../metadata-admin/PermissionMatrixEditor';
import { getMetadataInspector } from '../metadata-admin/inspector-registry';
import { useMetadataClient } from '../metadata-admin/useMetadata';
import { AppNavCanvas } from '../metadata-admin/previews/AppNavCanvas';
import {
  readFields,
  writeFields,
  newField,
  toFieldName,
  toFieldNameLoose,
} from '../metadata-admin/previews/object-fields-io';
import { ObjectFormDesigner } from './ObjectFormDesigner';
import { ObjectValidationsPanel } from './ObjectValidationsPanel';
import { ObjectSettingsPanel } from './ObjectSettingsPanel';
import { fetchPackages, createBasePackage, PACKAGE_ID_RE, type PkgEntry } from './packages-io';
import { DraftChangesPanel } from '../../preview/DraftChangesPanel';
import { toast } from 'sonner';

const PILLARS: ReadonlyArray<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: 'data', label: 'Data', Icon: Database },
  { key: 'automations', label: 'Automations', Icon: Workflow },
  { key: 'interfaces', label: 'Interfaces', Icon: LayoutDashboard },
  { key: 'access', label: 'Access', Icon: Shield },
];

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

/** Top-bar package switcher: list app packages (可写 base vs 只读 code), switch by
 * navigation, and create a new writable base inline (POST /packages {id,name}). */
function PackageSwitcher({ packageId, tab }: { packageId: string; tab: string }): React.ReactElement {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [pkgs, setPkgs] = React.useState<PkgEntry[] | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newId, setNewId] = React.useState('');
  const [idTouched, setIdTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchPackages()
      .then((parsed) => {
        if (!cancelled) setPkgs(parsed);
      })
      .catch(() => {
        /* leave null — switcher still works for navigation-free display */
      });
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  const current = pkgs?.find((p) => p.id === packageId) ?? null;

  const doCreate = React.useCallback(async () => {
    const name = newName.trim();
    const id = newId.trim();
    if (!name || !PACKAGE_ID_RE.test(id)) return;
    setBusy(true);
    setErr(null);
    try {
      await createBasePackage(id, name);
      toast.success(`软件包 ${name} 已创建(可写)`);
      setOpen(false);
      setCreating(false);
      setNewName('');
      setNewId('');
      setIdTouched(false);
      navigate(`/studio/${encodeURIComponent(id)}/data`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [newName, newId, navigate]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[13px] font-medium hover:bg-muted"
        title="切换 / 新建软件包"
      >
        <Boxes className="h-4 w-4" /> {current?.name ?? packageId}
        {current && !current.writable && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-300">
            <Lock className="h-2.5 w-2.5" /> 只读
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border bg-background p-1.5 shadow-lg">
            <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              软件包(应用)
            </p>
            <div className="max-h-64 overflow-auto">
              {pkgs === null && <p className="px-2 py-2 text-[11px] text-muted-foreground">加载中…</p>}
              {pkgs?.length === 0 && <p className="px-2 py-2 text-[11px] text-muted-foreground">暂无应用软件包</p>}
              {pkgs?.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/studio/${encodeURIComponent(p.id)}/${tab}`);
                  }}
                  className={
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ' +
                    (p.id === packageId ? 'bg-muted font-medium' : 'hover:bg-muted/60')
                  }
                >
                  <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">{p.id}</span>
                  </span>
                  {p.writable ? (
                    <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-300">
                      可写
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                      <Lock className="h-2.5 w-2.5" /> 只读
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-1 border-t pt-1.5">
              {creating ? (
                <div className="flex flex-col gap-1.5 px-1 pb-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      if (!idTouched) {
                        const slug = toFieldNameLoose(e.target.value).replace(/_/g, '-');
                        setNewId(slug ? `com.example.${slug}` : '');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void doCreate();
                      if (e.key === 'Escape') setCreating(false);
                    }}
                    placeholder="名称(如:维修中心)"
                    className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={newId}
                    onChange={(e) => {
                      setIdTouched(true);
                      setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void doCreate();
                      if (e.key === 'Escape') setCreating(false);
                    }}
                    placeholder="包 ID(如:com.example.repairs)"
                    className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
                  />
                  {err && <p className="text-[10px] text-destructive">{err}</p>}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void doCreate()}
                      disabled={busy || !newName.trim() || !PACKAGE_ID_RE.test(newId.trim())}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      创建可写软件包
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> 新建软件包(可写 base)
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export interface StudioDesignSurfaceProps {
  /** Open-core slot — the cloud edition injects its AI copilot panel here. */
  aiSlot?: React.ReactNode;
}

export function StudioDesignSurface({ aiSlot }: StudioDesignSurfaceProps): React.ReactElement {
  const params = useParams<{ packageId?: string; tab?: string }>();
  const packageId = params.packageId ?? 'com.example.showcase';
  const tab = params.tab ?? 'interfaces';

  // Package-level publish (ADR-0033/0037/0048): edits accumulate as per-item
  // drafts STAMPED with this package (each save passes packageId → the draft row's
  // sys_metadata.package_id). Publishing promotes exactly THIS package's drafts in
  // one atomic pass (POST /packages/:id/publish-drafts), reviewed as a whole in
  // DraftChangesPanel. There is no per-item publish.
  const [changesOpen, setChangesOpen] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState<number | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishNonce, setPublishNonce] = React.useState(0); // ↑ → pillars re-read the published baseline
  const [draftNonce, setDraftNonce] = React.useState(0); // ↑ → refresh the pending-draft count

  const refreshPending = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/meta/_drafts?packageId=${encodeURIComponent(packageId)}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return setPendingCount(null);
      const data = (await res.json()) as unknown;
      const list = (Array.isArray(data) ? data : ((data as { drafts?: unknown[] })?.drafts ?? [])) as unknown[];
      setPendingCount(list.length);
    } catch {
      setPendingCount(null);
    }
  }, [packageId]);

  React.useEffect(() => {
    void refreshPending();
  }, [refreshPending, publishNonce, draftNonce]);

  const doPublish = React.useCallback(async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/v1/packages/${encodeURIComponent(packageId)}/publish-drafts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}',
      });
      const payload = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
      if (!res.ok || payload?.success === false) throw new Error(payload?.error?.message || `HTTP ${res.status}`);
      toast.success('已发布本软件包的全部草稿(一次原子发布)');
      setChangesOpen(false);
      setPublishNonce((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
    await refreshPending();
  }, [packageId, refreshPending]);

  const onDraftSaved = React.useCallback(() => setDraftNonce((n) => n + 1), []);
  const hasPending = (pendingCount ?? 0) > 0;

  // Builder → running-app bridge (Airtable's Launch): the builder edits the
  // package (设计界面), the app is its published front-end. If this package
  // ships an app, offer 打开应用 — opened in a new tab so the builder context
  // survives. (App → builder is the reverse bridge, tracked separately.)
  const shellNavigate = useNavigate();
  const shellClient = useMetadataClient();
  const [packageApp, setPackageApp] = React.useState<{ name: string; label: string } | null>(null);
  // 创建应用 (package has no app yet): create a draft `app` item — the published
  // front-end's on-ramp. The button flips to 打开应用 after the package publish.
  const [appCreating, setAppCreating] = React.useState(false);
  const [appLabel, setAppLabel] = React.useState('');
  const [appName, setAppName] = React.useState('');
  const [appNameTouched, setAppNameTouched] = React.useState(false);
  const [appBusy, setAppBusy] = React.useState(false);
  const [appDraftPending, setAppDraftPending] = React.useState<string | null>(null);

  const doCreateApp = React.useCallback(async () => {
    const label = appLabel.trim();
    const name = toFieldName(appName.trim() || label);
    if (!label || !name || name === 'field') return;
    setAppBusy(true);
    try {
      await shellClient.save(
        'app',
        name,
        { name, label, active: true, navigation: [] },
        { mode: 'draft', packageId },
      );
      toast.success(`应用「${label}」已存为草稿 — 发布后即可打开`);
      setAppDraftPending(label);
      setAppCreating(false);
      setAppLabel('');
      setAppName('');
      setAppNameTouched(false);
      setDraftNonce((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAppBusy(false);
    }
  }, [appLabel, appName, shellClient, packageId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apps = (await shellClient.list('app', { packageId })) as Array<Record<string, unknown>>;
        const first = (apps || [])
          .map((a) => ({ name: String(a.name ?? ''), label: String(a.label ?? a.name ?? '') }))
          .filter((a) => a.name)[0];
        if (!cancelled) setPackageApp(first ?? null);
      } catch {
        if (!cancelled) setPackageApp(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shellClient, packageId, publishNonce]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {aiSlot ? <aside className="w-64 shrink-0 overflow-auto border-r bg-muted/40">{aiSlot}</aside> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-3 py-2">
          {/* Never a dead end: walk back to the platform Home / builder landing. */}
          <button
            type="button"
            onClick={() => shellNavigate('/home')}
            title="返回主页"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HomeIcon className="h-4 w-4" />
          </button>
          <PackageSwitcher packageId={packageId} tab={tab} />
          <span className="text-muted-foreground">·</span>
          <nav className="flex gap-1">
            {PILLARS.map((p) => (
              <Link
                key={p.key}
                to={`/studio/${packageId}/${p.key}`}
                className={
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ' +
                  (tab === p.key
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                }
              >
                <p.Icon className="h-3.5 w-3.5" />
                {p.label}
              </Link>
            ))}
          </nav>

          {/* Package-level draft review + one atomic publish (replaces per-item 发布) */}
          <div className="ml-auto flex items-center gap-2">
            {packageApp ? (
              <button
                type="button"
                onClick={() => window.open(`/apps/${encodeURIComponent(packageApp.name)}`, '_blank')}
                title={`打开应用「${packageApp.label}」(发布后的前端界面)`}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                打开应用
              </button>
            ) : appDraftPending ? (
              <span
                title="发布后这里会变成「打开应用」"
                className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300"
              >
                应用「{appDraftPending}」待发布
              </span>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAppCreating((v) => !v)}
                  title="这个软件包还没有应用(前端界面)— 创建一个"
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  创建应用
                </button>
                {appCreating && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAppCreating(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 flex w-72 flex-col gap-1.5 rounded-lg border bg-background p-2 shadow-lg">
                      <input
                        autoFocus
                        value={appLabel}
                        onChange={(e) => {
                          setAppLabel(e.target.value);
                          if (!appNameTouched) setAppName(toFieldNameLoose(e.target.value));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void doCreateApp();
                          if (e.key === 'Escape') setAppCreating(false);
                        }}
                        placeholder="应用名称(如:订单中心)"
                        className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        value={appName}
                        onChange={(e) => {
                          setAppNameTouched(true);
                          setAppName(toFieldNameLoose(e.target.value));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void doCreateApp();
                          if (e.key === 'Escape') setAppCreating(false);
                        }}
                        placeholder="标识符(如:orders_app)"
                        className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => void doCreateApp()}
                        disabled={appBusy || !appLabel.trim() || !toFieldName(appName.trim() || appLabel) || toFieldName(appName.trim() || appLabel) === 'field'}
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {appBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        创建(存为草稿)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setChangesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <GitBranch className="h-3.5 w-3.5" />
              变更{hasPending ? ` · ${pendingCount}` : ''}
            </button>
            <button
              type="button"
              onClick={doPublish}
              disabled={publishing || !hasPending}
              title={hasPending ? '一次性确认并发布全部待发布草稿(整包 · 一次原子发布)' : '没有待发布的草稿'}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              发布
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {tab === 'data' ? (
            <DataPillar packageId={packageId} publishNonce={publishNonce} onDraftSaved={onDraftSaved} />
          ) : tab === 'automations' ? (
            <AutomationsPillar packageId={packageId} publishNonce={publishNonce} onDraftSaved={onDraftSaved} />
          ) : tab === 'access' ? (
            <AccessPillar />
          ) : (
            <InterfacesPillar packageId={packageId} publishNonce={publishNonce} onDraftSaved={onDraftSaved} />
          )}
        </div>
      </div>

      <DraftChangesPanel open={changesOpen} onOpenChange={setChangesOpen} packageId={packageId} />
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
function InterfacesPillar({
  packageId,
  publishNonce = 0,
  onDraftSaved,
}: {
  packageId: string;
  publishNonce?: number;
  onDraftSaved?: () => void;
}): React.ReactElement {
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
  }, [client, current, isEditable, publishNonce]);

  const onPatch = React.useCallback(
    (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );
  const doSave = React.useCallback(async () => {
    if (!current) return;
    setSaving('draft');
    try {
      await client.save(current.type, current.name, draft, { mode: 'draft', packageId });
      setHasDraft(true);
      onDraftSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current, draft, onDraftSaved]);

  // nav editing — patch appDraft.navigation, then save/publish the App overlay
  const onNavPatch = React.useCallback((patch: Record<string, unknown>) => {
    setAppDraft((d) => ({ ...d, ...patch }));
    setNavDirty(true);
  }, []);
  const doNavSave = React.useCallback(async () => {
    if (!appName) return;
    setNavSaving('draft');
    try {
      await client.save('app', appName, appDraft, { mode: 'draft', packageId });
      setNavHasDraft(true);
      setNavDirty(false);
      onDraftSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNavSaving(false);
    }
  }, [client, appName, appDraft, onDraftSaved]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        {current ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="text-[13px] font-medium text-foreground">{current.label}</span>
            <span className="rounded bg-muted px-1.5 py-0.5">
              {current.type} · {current.name}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">从左侧选择一个菜单项</span>
        )}
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
            {selection && (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="取消选择"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
/**
 * Framework-managed/audit fields. They lead the raw metadata order but aren't
 * what a user manages in a data grid, so the Data pillar drops them from the
 * column set (mirrors ObjectGrid's regular-vs-system split) to open on the
 * meaningful fields first — the same way Airtable hides system columns.
 */
const STUDIO_SYSTEM_FIELD_NAMES = new Set<string>([
  '_id', 'id', 'organization_id', 'org_id', 'space_id',
  'created_at', 'created_by', 'updated_at', 'updated_by',
  'modified_at', 'modified_by', 'created_time', 'modified_time', 'updated_time',
  'deleted_at', 'deleted_by',
]);

/**
 * Render the Data pillar's records grid using the SAME rich list surface as the
 * runtime list pages — the standard toolbar (view switcher, search, sort, filter,
 * group, hide-fields) plus Airtable-style inline data management. This is the
 * plugin ObjectView's `renderListView` slot, so the object-view still owns data
 * fetching while ListView owns the toolbar + grid. Defined at module scope (not
 * inline) so it stays a static component reference.
 */
function renderStudioGridList(props: {
  schema: Record<string, unknown>;
  dataSource: unknown;
  onEdit?: (record: Record<string, unknown>) => void;
  className?: string;
  refreshKey?: number;
}): React.ReactElement {
  const { schema: listSchema, dataSource: ds, onEdit, className, refreshKey } = props;
  return (
    <ListView
      schema={
        {
          ...listSchema,
          viewType: 'grid',
          showSearch: true,
          showSort: true,
          showFilters: true,
          showGroup: true,
          showHideFields: true,
          inlineEdit: true,
          addDeleteRecordsInline: true,
        } as never
      }
      dataSource={ds as never}
      onEdit={onEdit}
      className={className}
      refreshKey={refreshKey}
    />
  );
}

function DataPillar({
  packageId,
  publishNonce = 0,
  onDraftSaved,
}: {
  packageId: string;
  publishNonce?: number;
  onDraftSaved?: () => void;
}): React.ReactElement {
  const client = useMetadataClient();
  const adapter = useAdapter();
  const locale = 'zh-CN';
  const [objects, setObjects] = React.useState<Surface[]>([]);
  const [objectsLoaded, setObjectsLoaded] = React.useState(false);
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
  // Records grid ⇄ Form ⇄ Validations ⇄ Settings — four views of the SAME
  // object. Grid/Form are the runtime renderer (same-renderer principle);
  // Validations edits `validations` rules; Settings edits object basics +
  // the ADR-0085 semantic roles. All patch the one `objDraft`.
  const [viewMode, setViewMode] = React.useState<'grid' | 'form' | 'rules' | 'settings'>('grid');
  // Within the Form view: 布局 (WYSIWYG drag/section designer) ⇄ 预览 (live form).
  const [formMode, setFormMode] = React.useState<'layout' | 'preview'>('layout');
  // Tracks which object's baseline is currently loaded — so we (re)load exactly
  // once per selected object and never clobber an in-progress draft.
  const loadedNameRef = React.useRef<string | null>(null);
  // Left-rail search + inline "new object" creator (design §4: rail = search + New).
  const [query, setQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);
  const [createBusy, setCreateBusy] = React.useState(false);
  // Whether the selected object exists beyond the draft (published/code baseline).
  // A draft-only object has NO physical table yet (DDL lands at publish), so the
  // Records grid must not fire data SQL against it.
  const [hasBaseline, setHasBaseline] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Published objects + pending DRAFT objects, merged. `list()` only
        // sees published/active metadata, so a freshly-created writable base
        // whose objects are all drafts would render an empty (previously:
        // forever-"loading") rail. Draft headers carry no label — show the
        // machine name until the draft body loads on selection.
        const [list, draftHeaders] = await Promise.all([
          client.list('object', { packageId }) as Promise<Array<Record<string, unknown>>>,
          client.listDrafts({ packageId, type: 'object' }).catch(() => []),
        ]);
        if (cancelled) return;
        const items = (list || [])
          .map((o) => ({ type: 'object', name: String(o.name ?? ''), label: String(o.label ?? o.name ?? '') }))
          .filter((o) => o.name);
        const known = new Set(items.map((o) => o.name));
        for (const d of draftHeaders) {
          if (d.name && !known.has(d.name)) {
            items.push({ type: 'object', name: d.name, label: d.name });
          }
        }
        setObjects(items);
        setCurrent((c) => c ?? items[0] ?? null);
        // First-run: an empty writable package opens the creator right away —
        // the first thing to do here is make an object, so put the inputs up.
        if (items.length === 0) setCreating(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setObjectsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId]);

  React.useEffect(() => {
    if (!current) return;
    // Load once per selected object. Bail if this object's baseline is already
    // loaded — a client-identity churn or a child remount must NOT re-fetch and
    // clobber the in-progress form-layout draft the designer is editing.
    // Keyed by object + publishNonce: a package publish (nonce++) re-reads the
    // fresh published baseline; otherwise we never clobber an in-progress draft.
    const loadKey = `${current.name}#${publishNonce}`;
    if (loadedNameRef.current === loadKey) return;
    loadedNameRef.current = loadKey;
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
        setHasBaseline(!!(lay.effective ?? lay.code));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, current, publishNonce]);

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

  // "+ new object": create a fresh object as a DRAFT in this package (runtime
  // create — same path the classic Studio editor uses), seeded with one text
  // field so the form/grid isn't empty. It stays draft-only (no physical table)
  // until the package publish, so we land on 表单·布局 — the metadata-level
  // surface that never fires data SQL.
  const doCreateObject = React.useCallback(async () => {
    const label = newLabel.trim();
    const name = toFieldName(newName.trim() || label);
    if (!label || !name || name === 'field') return; // CJK label → identifier must be typed
    if (objects.some((o) => o.name === name)) {
      setError(`标识符 "${name}" 已存在`);
      return;
    }
    setCreateBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        label,
        fields: { name: { type: 'text', label: '名称' } },
      };
      await client.save('object', name, body, { mode: 'draft', packageId });
      const surface: Surface = { type: 'object', name, label };
      setObjects((prev) => [...prev, surface]);
      setCurrent(surface);
      setViewMode('form');
      setFormMode('layout');
      setCreating(false);
      setNewLabel('');
      setNewName('');
      setNameTouched(false);
      onDraftSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateBusy(false);
    }
  }, [newLabel, newName, objects, client, packageId, onDraftSaved]);

  const doSave = React.useCallback(async () => {
    if (!current) return;
    setSaving('draft');
    setError(null);
    try {
      await client.save('object', current.name, objDraft, { mode: 'draft', packageId });
      setHasDraft(true);
      setDirty(false);
      onDraftSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current, objDraft, onDraftSaved]);

  // Drag-reorder columns → reorder the object's `fields` metadata (field display
  // order follows metadata order), saved as a DRAFT. Published later via the
  // package release — NOT auto-published per reorder as it used to be.
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
      setSaving('draft');
      setError(null);
      try {
        await client.save('object', current.name, body, { mode: 'draft', packageId });
        setHasDraft(true);
        setDirty(false);
        onDraftSaved?.();
        setGridVer((v) => v + 1); // remount so the grid reflects the new (draft) order
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [client, current, objDraft, onDraftSaved],
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
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-52 shrink-0 flex-col border-r">
          <div className="shrink-0 p-2 pb-1">
            <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">对象</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索对象…"
              className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 pt-1">
            {objects.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {error ? '加载失败' : objectsLoaded ? '还没有对象 — 在下方新建一个开始' : '加载中…'}
              </p>
            )}
            {objects
              .filter(
                (o) =>
                  !query.trim() ||
                  o.label.toLowerCase().includes(query.trim().toLowerCase()) ||
                  o.name.toLowerCase().includes(query.trim().toLowerCase()),
              )
              .map((o) => (
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
          </div>
          <div className="shrink-0 border-t p-2">
            {creating ? (
              <div className="flex flex-col gap-1.5">
                <input
                  autoFocus
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    if (!nameTouched) setNewName(toFieldNameLoose(e.target.value));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doCreateObject();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  placeholder="显示名(如:报修工单)"
                  className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={newName}
                  onChange={(e) => {
                    setNameTouched(true);
                    setNewName(toFieldNameLoose(e.target.value));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doCreateObject();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  placeholder="标识符(如:repair_ticket)"
                  className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void doCreateObject()}
                    disabled={createBusy || !newLabel.trim() || !toFieldName(newName.trim() || newLabel) || toFieldName(newName.trim() || newLabel) === 'field'}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {createBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    创建(存为草稿)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> 新建对象
              </button>
            )}
          </div>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
          {!current ? (
            objectsLoaded && objects.length === 0 ? (
              /* Fresh package: the first act is creating an object — say so and
               * point at the rail creator (already auto-opened). */
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <p className="text-sm font-medium">从第一个对象开始</p>
                <p className="max-w-sm text-[11px] leading-5 text-muted-foreground">
                  对象是应用的数据基座(如「订单」「客户」)。在左下角输入显示名与标识符即可创建;
                  之后为它设计字段、表单与自动化,最后一次发布。
                </p>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">选择一个对象</div>
            )
          ) : (
            <>
              <div className="mb-3 flex shrink-0 items-center gap-2">
                {/* view toggle — Records grid ⇄ Form, both the runtime renderer */}
                <div className="inline-flex rounded-md border p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (viewMode === 'grid' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    记录
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('form')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (viewMode === 'form' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    表单
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('rules')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (viewMode === 'rules' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    验证
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('settings')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (viewMode === 'settings' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    设置
                  </button>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  <Eye className="h-3 w-3" />{' '}
                  {viewMode === 'grid'
                    ? '运行态列表 · 同一渲染器'
                    : viewMode === 'rules'
                      ? '验证规则 · 草稿'
                      : viewMode === 'settings'
                        ? '对象设置 · 草稿'
                        : formMode === 'layout'
                          ? '表单设计 · 草稿'
                          : '运行态表单 · 已发布定义'}
                </span>
                {(viewMode === 'grid' || viewMode === 'form') && (
                  <button
                    type="button"
                    onClick={addField}
                    title="添加一个字段(随后在右侧设置类型与属性)"
                    className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> 添加字段
                  </button>
                )}
              </div>
              {error && (
                <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
                  {error}
                </div>
              )}
              {viewMode === 'rules' ? (
                <ObjectValidationsPanel draft={objDraft} onPatch={onPatch} />
              ) : viewMode === 'settings' ? (
                <ObjectSettingsPanel
                  name={current.name}
                  draft={objDraft}
                  onPatch={onPatch}
                  locale={locale}
                />
              ) : viewMode === 'grid' && !hasBaseline ? (
                /* Draft-only object: no physical table until the package publish —
                 * rendering the runtime grid would fire data SQL against a table
                 * that doesn't exist. Say so instead of erroring. */
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-center">
                  <p className="text-sm font-medium">未发布的新对象</p>
                  <p className="max-w-md text-[11px] leading-5 text-muted-foreground">
                    「记录」网格查询真实数据,而这个对象发布前还没有数据表。请先在「表单 · 布局」里设计字段与分组,
                    然后点顶栏「发布」— 发布后这里就是它的实时数据网格。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('form');
                      setFormMode('layout');
                    }}
                    className="mt-1 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    去「表单 · 布局」设计字段
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
              <>
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
                  {/* Provide the adapter as the dataSource context so the object-grid's
                    * inline-edit save can write back: the ListView only fetches and
                    * passes data inline, leaving the grid itself without a write dataSource. */}
                  <SchemaRendererProvider dataSource={adapter as never}>
                    <PluginObjectView
                      key={`${current.name}:${gridVer}`}
                      schema={
                        {
                          type: 'object-view',
                          objectName: current.name,
                          // No saved view exists in design mode, so show the object's
                          // own fields as columns (in metadata order), dropping
                          // framework-managed/audit fields so the grid opens on the
                          // meaningful columns first — the way Airtable does.
                          table: {
                            fields: readFields(objDraft.fields)
                              .entries.map((e) => e.name)
                              .filter((n) => !STUDIO_SYSTEM_FIELD_NAMES.has(n)),
                          },
                        } as never
                      }
                      dataSource={adapter as never}
                      renderListView={renderStudioGridList}
                    />
                  </SchemaRendererProvider>
                </GridFieldAuthoringProvider>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MousePointer2 className="h-3 w-3" /> 列头「+」加字段 · 笔形改属性 · 拖列头重排 · 改完「保存草稿」→「发布」
              </p>
              </>
              ) : (
              <>
              {/* form sub-mode: 布局 (WYSIWYG drag/section designer) ⇄ 预览 (live form) */}
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex rounded-md border p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFormMode('layout')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (formMode === 'layout' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    布局
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMode('preview')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (formMode === 'preview' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    预览
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {formMode === 'layout' ? '布局设计器 · 草稿(含未发布改动)' : '运行态表单 · 已发布定义'}
                </span>
                {/* Preview renders the PUBLISHED definition on purpose: a draft with
                  * structural changes has no physical columns yet (DDL lands at
                  * publish), so a draft-with-data preview would break. Publishing is
                  * a deliberate user action — say so instead of silently lying. */}
                {formMode === 'preview' && (dirty || hasDraft) && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
                    有未发布改动 — 此预览为发布前(已发布)的效果;草稿确认用「布局」,看发布后效果请先点顶栏「发布」
                  </span>
                )}
              </div>
              {formMode === 'layout' ? (
                <ObjectFormDesigner
                  draft={objDraft}
                  systemFieldNames={STUDIO_SYSTEM_FIELD_NAMES}
                  onChange={onPatch}
                  selectedField={fieldSel?.kind === 'field' ? fieldSel.id : null}
                  onSelectField={(name) => setFieldSel({ kind: 'field', id: name })}
                  onAddField={addField}
                />
              ) : !hasBaseline ? (
                /* Draft-only object: there is no published definition to preview yet. */
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-center">
                  <p className="text-sm font-medium">尚无已发布定义</p>
                  <p className="max-w-md text-[11px] leading-5 text-muted-foreground">
                    「预览」渲染已发布的运行态表单,而这个对象还未发布。在「布局」里确认草稿,点顶栏「发布」后即可预览。
                  </p>
                </div>
              ) : (
              <>
              {/* Form — the real runtime ObjectForm ("same renderer"): the object's
                * form exactly as an end user sees it. Clicking any rendered field
                * (event-delegated via the renderer's data-field) selects it into the
                * SAME field inspector the grid uses — one screen, no pillar switch. */}
              <style>{`
                /* Design preview: the form is a click-to-select canvas, not a data-entry
                 * form. Disable interaction on field contents so a click anywhere on a
                 * field routes to its [data-field] wrapper (→ select), and neutralize the
                 * create/cancel footer so nothing is submittable here. */
                .os-form-authoring [data-field]{border-radius:8px;cursor:pointer;transition:box-shadow .12s;padding:8px;margin:-8px 0;}
                .os-form-authoring [data-field] *{pointer-events:none;}
                .os-form-authoring [data-field]:hover{box-shadow:0 0 0 1px hsl(var(--border));}
                .os-form-authoring form > div:last-child:has(button){display:none;}
                ${
                  fieldSel?.kind === 'field'
                    ? `.os-form-authoring [data-field="${String(fieldSel.id).replace(/[^\w-]/g, '')}"]{box-shadow:0 0 0 2px hsl(var(--primary));}`
                    : ''
                }
              `}</style>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background p-6">
                <div
                  className="os-form-authoring mx-auto max-w-2xl"
                  onClick={(e) => {
                    const el = (e.target as HTMLElement).closest('[data-field]');
                    const name = el?.getAttribute('data-field');
                    if (name && readFields(objDraft.fields).entries.some((f) => f.name === name)) {
                      setFieldSel({ kind: 'field', id: name });
                    }
                  }}
                >
                  <SchemaRendererProvider dataSource={adapter as never}>
                    <ObjectForm
                      key={`${current.name}:${gridVer}:form`}
                      schema={
                        {
                          type: 'object-form',
                          objectName: current.name,
                          mode: 'create',
                          fields: readFields(objDraft.fields)
                            .entries.map((e) => e.name)
                            .filter((n) => !STUDIO_SYSTEM_FIELD_NAMES.has(n)),
                        } as never
                      }
                      dataSource={adapter as never}
                    />
                  </SchemaRendererProvider>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MousePointer2 className="h-3 w-3" /> 点选任意字段 → 右侧改属性 · 「添加字段」加字段 · 改完「保存草稿」→「发布」
              </p>
              </>
              )}
              </>
              )}
            </>
          )}
        </main>

        {/* field inspector — full type list + per-type config (reuses ObjectFieldInspector) */}
        {current && fieldSel && inspector && (
          <aside className="flex w-80 shrink-0 flex-col border-l">
            <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-[13px] font-medium">字段属性</span>
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
function AutomationsPillar({
  packageId,
  publishNonce = 0,
  onDraftSaved,
}: {
  packageId: string;
  publishNonce?: number;
  onDraftSaved?: () => void;
}): React.ReactElement {
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
  }, [client, current, publishNonce]);

  const onPatch = React.useCallback(
    (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );
  const doSave = React.useCallback(async () => {
    if (!current) return;
    setSaving('draft');
    setError(null);
    try {
      await client.save('flow', current.name, draft, { mode: 'draft', packageId });
      setHasDraft(true);
      onDraftSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, current, draft, onDraftSaved]);

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
            {selection && (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="取消选择"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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

/**
 * Access pillar — the permission workbench (builder-ui §7, ADR-0084's fourth
 * content pillar). Left rail: the environment's permission sets / profiles;
 * main: the existing Salesforce-style PermissionMatrixEditPage (objects ×
 * CRUD/VAMA + field-level R/W), embedded unchanged.
 *
 * Semantics note (v1, deliberate): permissions are PLATFORM-level authorization
 * objects, not package content — the matrix's own Save writes the ACTIVE item
 * directly (no draft, no package binding), so the shell's 变更/发布 does not
 * apply here. The banner says so instead of pretending otherwise.
 */
function AccessPillar(): React.ReactElement {
  const client = useMetadataClient();
  const [perms, setPerms] = React.useState<Array<{ name: string; label: string; isProfile?: boolean }>>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  // inline creator (same rail pattern as the Data pillar's object creator)
  const [creating, setCreating] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const list = (await client.list('permission')) as Array<Record<string, unknown>>;
      const items = (list || [])
        .map((p) => ({
          name: String(p.name ?? (p as Record<string, unknown>).id ?? ''),
          label: String(p.label ?? p.name ?? ''),
          isProfile: !!(p as Record<string, unknown>).isProfile,
        }))
        .filter((p) => p.name);
      setPerms(items);
      setCurrent((c) => c ?? items[0]?.name ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [client]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const doCreate = React.useCallback(async () => {
    const label = newLabel.trim();
    const name = toFieldName(newName.trim() || label);
    if (!label || !name || name === 'field') return;
    setBusy(true);
    try {
      await client.save('permission', name, { name, label, objects: {}, fields: {} });
      toast.success(`权限集「${label}」已创建`);
      setCreating(false);
      setNewLabel('');
      setNewName('');
      setNameTouched(false);
      await load();
      setCurrent(name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [client, newLabel, newName, load]);

  const filtered = perms.filter(
    (p) =>
      !query.trim() ||
      p.label.toLowerCase().includes(query.trim().toLowerCase()) ||
      p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium text-foreground">权限矩阵</span>
          <span className="rounded bg-muted px-1.5 py-0.5">对象 × CRUD · 字段级读写</span>
        </span>
        <span
          title="权限是平台级授权配置,矩阵内的「Save」保存即生效;不进入软件包草稿,顶栏「发布」不涉及它。"
          className="ml-auto rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300"
        >
          保存即生效 · 不走包草稿
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-52 shrink-0 flex-col border-r">
          <div className="p-2 pb-0">
            <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">权限集 / Profile</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索权限…"
              className="mb-1 h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 pt-1">
            {perms.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {error ? '加载失败' : loaded ? '还没有权限集 — 在下方新建一个' : '加载中…'}
              </p>
            )}
            {filtered.map((p) => (
              <button
                key={p.name}
                onClick={() => setCurrent(p.name)}
                className={
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ' +
                  (current === p.name ? 'bg-muted font-medium' : 'text-foreground/90 hover:bg-muted/60')
                }
              >
                <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{p.label}</span>
                {p.isProfile && (
                  <span className="rounded bg-muted px-1 py-px text-[9px] uppercase text-muted-foreground">
                    profile
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="shrink-0 border-t p-2">
            {creating ? (
              <div className="flex flex-col gap-1.5">
                <input
                  autoFocus
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    if (!nameTouched) setNewName(toFieldNameLoose(e.target.value));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doCreate();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  placeholder="显示名(如:销售权限)"
                  className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={newName}
                  onChange={(e) => {
                    setNameTouched(true);
                    setNewName(toFieldNameLoose(e.target.value));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doCreate();
                    if (e.key === 'Escape') setCreating(false);
                  }}
                  placeholder="标识符(如:sales_perms)"
                  className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void doCreate()}
                    disabled={busy || !newLabel.trim() || !toFieldName(newName.trim() || newLabel) || toFieldName(newName.trim() || newLabel) === 'field'}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    创建
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> 新建权限集
              </button>
            )}
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto">
          {current ? (
            /* The existing Salesforce-style matrix page, embedded unchanged —
             * objects × CRUD/VAMA/lifecycle up top, per-object field-level R/W
             * below, its own Save + destructive-change guard included. */
            <PermissionMatrixEditPage key={current} type="permission" name={current} />
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {loaded && perms.length === 0 ? '新建一个权限集开始配置' : '选择一个权限集'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default StudioDesignSurface;
