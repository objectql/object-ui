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
import { formatMetadataError, formatPublishFailures, type PublishFailure } from './metadataError';
import { loadPackageSurfaces } from './packageSurfaces';
import { buildObjectSkeleton, buildFlowSkeleton, buildAppSkeleton, buildPermissionSkeleton } from './skeletons';
import { t, tFormat, useMetadataLocale } from '../metadata-admin/i18n';
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
  const locale = useMetadataLocale();
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
      toast.success(tFormat('engine.studio.pkg.created', locale, { name }));
      setOpen(false);
      setCreating(false);
      setNewName('');
      setNewId('');
      setIdTouched(false);
      navigate(`/studio/${encodeURIComponent(id)}/data`);
    } catch (e) {
      setErr(formatMetadataError(e));
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
        title={t('engine.studio.pkg.switchTitle', locale)}
      >
        <Boxes className="h-4 w-4" /> {current?.name ?? packageId}
        {current && !current.writable && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-300">
            <Lock className="h-2.5 w-2.5" /> {t('engine.studio.pkg.readonly', locale)}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border bg-background p-1.5 shadow-lg">
            <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('engine.studio.pkg.heading', locale)}
            </p>
            <div className="max-h-64 overflow-auto">
              {pkgs === null && <p className="px-2 py-2 text-[11px] text-muted-foreground">{t('engine.studio.loading', locale)}</p>}
              {pkgs?.length === 0 && <p className="px-2 py-2 text-[11px] text-muted-foreground">{t('engine.studio.pkg.none', locale)}</p>}
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
                      {t('engine.studio.pkg.writable', locale)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                      <Lock className="h-2.5 w-2.5" /> {t('engine.studio.pkg.readonly', locale)}
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
                    placeholder={t('engine.studio.pkg.namePlaceholder', locale)}
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
                    placeholder={t('engine.studio.pkg.idPlaceholder', locale)}
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
                      {t('engine.studio.pkg.createWritable', locale)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                    >
                      {t('engine.studio.cancel', locale)}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> {t('engine.studio.pkg.new', locale)}
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
  const locale = useMetadataLocale();

  // Courtesy gate (ADR-0057 D10): a read-only code/installed package refuses
  // authoring server-side (ADR-0070), so don't let the user build up doomed
  // local edits first — disable the authoring affordances up front. Unknown
  // writability (fetch failed / still loading) stays ungated; the server gate
  // remains the authority either way.
  const [pkgWritable, setPkgWritable] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setPkgWritable(null);
    fetchPackages()
      .then((list) => {
        if (!cancelled) setPkgWritable(list.find((p) => p.id === packageId)?.writable ?? null);
      })
      .catch(() => {
        /* unknown — leave ungated */
      });
    return () => {
      cancelled = true;
    };
  }, [packageId]);
  const readOnly = pkgWritable === false;

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
      const payload = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string; details?: { issues?: unknown } };
        data?: { failed?: PublishFailure[] };
      } | null;
      if (!res.ok || payload?.success === false) {
        // Hard failure (e.g. package not found) — carry the field-anchored issues.
        throw Object.assign(new Error(payload?.error?.message || `HTTP ${res.status}`), {
          issues: payload?.error?.details?.issues,
        });
      }
      const failed = payload?.data?.failed ?? [];
      if (failed.length > 0) {
        // Partial publish: some drafts did NOT go live. The server returns 200
        // with them buried in `failed[]`, so the UI used to claim success and
        // swallow the reason — surface which drafts failed and why instead.
        toast.error(formatPublishFailures(failed));
      } else {
        toast.success(t('engine.studio.publishedAll', locale));
        setChangesOpen(false);
      }
      setPublishNonce((n) => n + 1);
    } catch (e) {
      toast.error(formatMetadataError(e));
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
  // Scaffold the new app's navigation from the package's objects (default on) —
  // otherwise a fresh app has zero menu items and every object must be wired by
  // hand in the Interfaces pillar (objectui#2262).
  const [appAddObjects, setAppAddObjects] = React.useState(true);

  const loadPackageObjects = React.useCallback(async (): Promise<Array<{ name: string; label: string }>> => {
    // Published objects + pending DRAFT objects, merged — a fresh package's
    // objects are usually still drafts (same merge the Data pillar rail does).
    const [list, draftHeaders] = await Promise.all([
      shellClient.list('object', { packageId }) as Promise<Array<Record<string, unknown>>>,
      shellClient.listDrafts({ packageId, type: 'object' }).catch(() => [] as Array<{ name?: string }>),
    ]);
    const items = (list || [])
      .map((o) => ({ name: String(o.name ?? ''), label: String(o.label ?? o.name ?? '') }))
      .filter((o) => o.name);
    const known = new Set(items.map((o) => o.name));
    for (const d of draftHeaders) {
      if (d.name && !known.has(d.name)) items.push({ name: d.name, label: d.name });
    }
    return items;
  }, [shellClient, packageId]);

  const doCreateApp = React.useCallback(async () => {
    const label = appLabel.trim();
    const name = toFieldName(appName.trim() || label);
    if (!label || !name || name === 'field') return;
    setAppBusy(true);
    try {
      const navObjects = appAddObjects ? await loadPackageObjects().catch(() => []) : [];
      await shellClient.save(
        'app',
        name,
        buildAppSkeleton(name, label, navObjects),
        { mode: 'draft', packageId },
      );
      toast.success(tFormat('engine.studio.app.savedDraft', locale, { label }));
      setAppDraftPending(label);
      setAppCreating(false);
      setAppLabel('');
      setAppName('');
      setAppNameTouched(false);
      setDraftNonce((n) => n + 1);
    } catch (e) {
      toast.error(formatMetadataError(e));
    } finally {
      setAppBusy(false);
    }
  }, [appLabel, appName, appAddObjects, loadPackageObjects, shellClient, packageId]);

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
            title={t('engine.studio.home', locale)}
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
                {t(`engine.studio.pillar.${p.key}`, locale)}
              </Link>
            ))}
          </nav>

          {/* Package-level draft review + one atomic publish (replaces per-item 发布) */}
          <div className="ml-auto flex items-center gap-2">
            {packageApp ? (
              <button
                type="button"
                onClick={() => window.open(`/apps/${encodeURIComponent(packageApp.name)}`, '_blank')}
                title={tFormat('engine.studio.app.openTitle', locale, { label: packageApp.label })}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('engine.studio.app.open', locale)}
              </button>
            ) : appDraftPending ? (
              <span
                title={t('engine.studio.app.willOpenAfterPublish', locale)}
                className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300"
              >
                {tFormat('engine.studio.app.pending', locale, { label: appDraftPending })}
              </span>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAppCreating((v) => !v)}
                  disabled={readOnly}
                  title={readOnly ? t('engine.studio.pkg.readonlyHint', locale) : t('engine.studio.app.noneTitle', locale)}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('engine.studio.app.create', locale)}
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
                        placeholder={t('engine.studio.app.namePlaceholder', locale)}
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
                        placeholder={t('engine.studio.app.idPlaceholder', locale)}
                        className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
                      />
                      <label className="flex cursor-pointer items-center gap-1.5 px-0.5 py-0.5 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={appAddObjects}
                          onChange={(e) => setAppAddObjects(e.target.checked)}
                          className="h-3 w-3 accent-primary"
                        />
                        {t('engine.studio.app.scaffoldNav', locale)}
                      </label>
                      <button
                        type="button"
                        onClick={() => void doCreateApp()}
                        disabled={appBusy || !appLabel.trim() || !toFieldName(appName.trim() || appLabel) || toFieldName(appName.trim() || appLabel) === 'field'}
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {appBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        {t('engine.studio.createDraft', locale)}
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
              {t('engine.studio.changes', locale)}{hasPending ? ` · ${pendingCount}` : ''}
            </button>
            <button
              type="button"
              // Publish is review-then-confirm: open the pending-changes panel,
              // whose footer button fires the actual atomic package publish —
              // never straight from this header click (objectui#2261).
              onClick={() => setChangesOpen(true)}
              disabled={publishing || !hasPending || readOnly}
              title={
                readOnly
                  ? t('engine.studio.pkg.readonlyHint', locale)
                  : hasPending
                    ? t('engine.studio.publishTitle', locale)
                    : t('engine.studio.publishNoneTitle', locale)
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              {t('engine.studio.publish', locale)}
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          {tab === 'data' ? (
            <DataPillar packageId={packageId} publishNonce={publishNonce} onDraftSaved={onDraftSaved} readOnly={readOnly} />
          ) : tab === 'automations' ? (
            <AutomationsPillar packageId={packageId} publishNonce={publishNonce} onDraftSaved={onDraftSaved} readOnly={readOnly} />
          ) : tab === 'access' ? (
            <AccessPillar packageId={packageId} publishNonce={publishNonce} onDraftSaved={onDraftSaved} readOnly={readOnly} />
          ) : (
            <InterfacesPillar
              packageId={packageId}
              publishNonce={publishNonce}
              draftNonce={draftNonce}
              onDraftSaved={onDraftSaved}
              onCreateApp={readOnly ? undefined : () => setAppCreating(true)}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>

      <DraftChangesPanel
        open={changesOpen}
        onOpenChange={setChangesOpen}
        packageId={packageId}
        onPublish={readOnly ? undefined : doPublish}
        publishing={publishing}
      />
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
/**
 * StudioNavItemInspector — right-panel editor for the selected nav item while
 * editing an app's navigation. The Studio adds flat top-level items
 * (`navigation[i]`), so binding is a business-friendly object picker rather
 * than the raw path field of the generic AppNavInspector: picking an object
 * writes `{ object }` (which the runtime resolves to that object's record
 * list) and, if the label is still the placeholder, adopts the object's label.
 */
function StudioNavItemInspector({
  navId,
  appDraft,
  objects,
  onNavPatch,
  onClear,
}: {
  navId: string;
  appDraft: Record<string, unknown>;
  objects: Array<{ name: string; label: string }>;
  onNavPatch: (patch: Record<string, unknown>) => void;
  onClear: () => void;
}): React.ReactElement {
  const locale = useMetadataLocale();
  const idx = React.useMemo(() => {
    const m = /^navigation\[(\d+)\]$/.exec(navId);
    return m ? Number(m[1]) : -1;
  }, [navId]);
  const nav = React.useMemo(
    () => (Array.isArray(appDraft.navigation) ? (appDraft.navigation as Array<Record<string, unknown>>) : []),
    [appDraft],
  );
  const node = idx >= 0 ? nav[idx] : null;
  if (!node) {
    return (
      <div className="px-2 py-10 text-center text-xs text-muted-foreground">{t('engine.studio.nav.selectItem', locale)}</div>
    );
  }
  const patch = (updates: Record<string, unknown>) => {
    onNavPatch({ navigation: nav.map((n, i) => (i === idx ? { ...n, ...updates } : n)) });
  };
  const boundObject = String(node.object ?? node.objectName ?? '');
  const curLabel = String(node.label ?? node.title ?? node.name ?? '');
  // A nav card is a placeholder until its label is edited or a target adopts a
  // real label. Match both the legacy English sentinel and the locale-specific
  // default from AppNavCanvas so items created in any locale are recognized.
  const isPlaceholder =
    !curLabel || curLabel === 'New item' || curLabel === t('engine.appNav.newItem', locale);
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{t('engine.studio.nav.label', locale)}</label>
        <input
          value={curLabel}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={t('engine.studio.nav.labelPlaceholder', locale)}
          className="w-full rounded border bg-background px-2 py-1 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{t('engine.studio.nav.linkObject', locale)}</label>
        <select
          value={boundObject}
          onChange={(e) => {
            const objName = e.target.value;
            const obj = objects.find((o) => o.name === objName);
            if (!objName) {
              // Unbind → back to an (invalid, dropped-on-save) placeholder.
              patch({ type: undefined, objectName: undefined, object: undefined });
              return;
            }
            // Emit a spec-complete ObjectNavItem: the app schema's nav is a
            // discriminated union on `type` and BaseNavItem requires a
            // snake_case `id`. Missing either fails "navigation.0: Invalid
            // input" at save. `object`/`path` are cleared so no stray keys
            // linger from the blank placeholder.
            patch({
              id: (node.id as string) || `nav_${objName}`,
              type: 'object',
              objectName: objName,
              object: undefined,
              path: undefined,
              label: isPlaceholder && obj ? obj.label : curLabel,
            });
          }}
          className="w-full rounded border bg-background px-2 py-1 text-xs"
        >
          <option value="">{t('engine.studio.nav.chooseObject', locale)}</option>
          {objects.map((o) => (
            <option key={o.name} value={o.name}>
              {o.label} ({o.name})
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {boundObject ? t('engine.studio.nav.boundHint', locale) : t('engine.studio.nav.unboundHint', locale)}
        </p>
        {objects.length === 0 && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {t('engine.studio.nav.noObjects', locale)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
      >
        {t('engine.studio.deselect', locale)}
      </button>
    </div>
  );
}

function InterfacesPillar({
  packageId,
  publishNonce = 0,
  draftNonce = 0,
  onDraftSaved,
  onCreateApp,
  readOnly = false,
}: {
  packageId: string;
  publishNonce?: number;
  /** Bumped when a draft is saved elsewhere (e.g. the header's create-app flow) — a
   * re-resolve signal so a just-created app appears without a reload. */
  draftNonce?: number;
  onDraftSaved?: () => void;
  /** Invoked from the empty state when this package has no app, to open the
   * header's create-app flow (single source of truth for app creation). */
  onCreateApp?: () => void;
  /** Courtesy gate: hide/disable nav-authoring affordances. */
  readOnly?: boolean;
}): React.ReactElement {
  const client = useMetadataClient();
  const locale = useMetadataLocale();

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
  // App resolution status — tells "still loading" apart from "this package has
  // no app", so the canvas shows a real empty state instead of an endless
  // spinner.
  const [appStatus, setAppStatus] = React.useState<'loading' | 'ready' | 'missing'>('loading');
  // Objects in THIS package (published ∪ draft) — the nav item inspector's
  // object picker, so nav can be wired to sibling objects before publishing.
  const [pkgObjects, setPkgObjects] = React.useState<Array<{ name: string; label: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pub, drafts] = await Promise.all([
          client.list('object', { packageId }) as Promise<Array<Record<string, unknown>>>,
          client.listDrafts({ packageId, type: 'object' }).catch(() => [] as Array<Record<string, unknown>>),
        ]);
        if (cancelled) return;
        const byName = new Map<string, { name: string; label: string }>();
        for (const raw of [...(pub || []), ...(drafts || [])]) {
          const o = raw as Record<string, unknown>;
          const name = String(o.name ?? '');
          if (!name || byName.has(name)) continue;
          byName.set(name, { name, label: String(o.label ?? o.name ?? name) });
        }
        setPkgObjects([...byName.values()]);
      } catch {
        /* non-fatal — picker just stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId, publishNonce, draftNonce]);

  // Resolve THIS package's App → load its navigation tree. The query is scoped
  // to the package (`list('app', { packageId })`) so a design surface only ever
  // shows the current package's app — never another package's. `list()` sees
  // published metadata only, so a freshly-created (unpublished) app is found via
  // `listDrafts()` instead, keeping it designable before its first publish.
  React.useEffect(() => {
    let cancelled = false;
    setAppStatus('loading');
    (async () => {
      try {
        const published = (await client.list('app', { packageId })) as Array<Record<string, unknown>>;
        if (cancelled) return;
        let name = published?.[0]?.name ? String(published[0].name) : null;
        let label = published?.[0]
          ? String(published[0].label ?? published[0].name ?? packageId)
          : packageId;
        if (!name) {
          const drafts = await client.listDrafts({ packageId, type: 'app' });
          if (cancelled) return;
          const d = drafts?.[0];
          if (d?.name) {
            name = String(d.name);
            label = String(d.name);
          }
        }
        if (!name) {
          setAppStatus('missing');
          return;
        }
        setAppLabel(label);
        setAppName(name);
        const [layRaw, appDraftResp] = await Promise.all([
          client.layered<Record<string, unknown>>('app', name),
          client.getDraft<Record<string, unknown>>('app', name).catch(() => null),
        ]);
        if (cancelled) return;
        const lay = layRaw as { effective?: Record<string, unknown>; code?: Record<string, unknown> };
        const eff = (lay.effective ?? lay.code ?? {}) as Record<string, unknown>;
        const appDraftBody = extractDraftBody(appDraftResp);
        const body = appDraftBody ? { ...eff, ...appDraftBody } : eff;
        if (typeof body.label === 'string' || typeof body.name === 'string') {
          setAppLabel(String(body.label ?? body.name ?? label));
        }
        setAppDraft(body);
        setNavHasDraft(!!appDraftBody);
        setAppStatus('ready');
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
        if (!cancelled) {
          setError(formatMetadataError(e));
          setAppStatus('missing');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId, publishNonce, draftNonce]);

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
        if (!cancelled) setError(formatMetadataError(e));
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
      setError(formatMetadataError(e));
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
      // "Add nav item" inserts a blank placeholder that only becomes a valid,
      // spec-conformant item once a target is picked in the inspector. Drop
      // still-untargeted placeholders (no `type`) so one stray blank can't fail
      // the whole app's spec validation ("navigation.N: Invalid input"), and
      // backfill a snake_case id defensively.
      const rawNav = Array.isArray(appDraft.navigation) ? appDraft.navigation : [];
      const cleanedNav = rawNav
        .filter((n) => n && typeof (n as Record<string, unknown>).type === 'string')
        .map((n, i) => {
          const item = n as Record<string, unknown>;
          return typeof item.id === 'string' && item.id ? item : { ...item, id: `nav_item_${i + 1}` };
        });
      await client.save('app', appName, { ...appDraft, navigation: cleanedNav }, { mode: 'draft', packageId });
      setNavHasDraft(true);
      setNavDirty(false);
      onDraftSaved?.();
    } catch (e) {
      setError(formatMetadataError(e));
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
          <span className="text-[11px] text-muted-foreground">{t('engine.studio.if.pickLeft', locale)}</span>
        )}
        {hasDraft && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
            {t('engine.studio.unpublishedDraft', locale)}
          </span>
        )}
        <button
          onClick={doSave}
          disabled={!current || !isEditable || !!saving || readOnly}
          title={readOnly ? t('engine.studio.pkg.readonlyHint', locale) : undefined}
          className="ml-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {saving === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t('engine.studio.saveDraft', locale)}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* real App navigation tree */}
        <nav className={(editNav ? 'w-72' : 'w-52') + ' flex shrink-0 flex-col border-r'}>
          <div className="shrink-0 border-b px-2 py-1.5">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{tFormat('engine.studio.if.navHeading', locale, { app: appLabel })}</p>
              {appStatus === 'ready' && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setEditNav((v) => !v);
                    setNavSel(null);
                  }}
                  title={editNav ? t('engine.studio.if.doneEditTitle', locale) : t('engine.studio.if.editNavTitle', locale)}
                  className={
                    'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ' +
                    (editNav ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')
                  }
                >
                  {editNav ? (
                    <>
                      <Check className="h-3 w-3" /> {t('engine.studio.done', locale)}
                    </>
                  ) : (
                    <>
                      <Pencil className="h-3 w-3" /> {t('engine.studio.edit', locale)}
                    </>
                  )}
                </button>
              )}
            </div>
            {editNav && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {navHasDraft && (
                  <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                    {t('engine.studio.unpublished', locale)}
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
                  {t('engine.studio.saveDraft', locale)}
                </button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {appStatus === 'missing' && !error ? (
              <div className="px-2 py-3">
                <p className="text-[11px] text-muted-foreground">{t('engine.studio.if.noApp', locale)}</p>
                {onCreateApp && (
                  <button
                    type="button"
                    onClick={onCreateApp}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" /> {t('engine.studio.app.create', locale)}
                  </button>
                )}
              </div>
            ) : editNav ? (
              // Edit mode renders AppNavCanvas even when the nav is empty — it
              // carries its own "Add nav item" affordance, so a fresh app can be
              // built up from nothing.
              <AppNavCanvas
                draft={appDraft}
                rootKey="navigation"
                onPatch={onNavPatch}
                selection={navSel}
                onSelectionChange={(s) => setNavSel(s ? { kind: s.kind, id: s.id } : null)}
              />
            ) : navTree.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {error
                  ? t('engine.studio.loadFailed', locale)
                  : appStatus === 'loading'
                    ? t('engine.studio.loading', locale)
                    : t('engine.studio.if.noNavItems', locale)}
              </p>
            ) : (
              <NavTree nodes={navTree} active={current} onPick={setCurrent} />
            )}
          </div>
        </nav>

        {/* canvas */}
        <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              <Eye className="h-3 w-3" /> {t('engine.studio.if.previewIsRuntime', locale)}
            </span>
            {current && (
              <span className="text-[11px] text-muted-foreground">
                {current.type} · {current.name}
              </span>
            )}
          </div>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-line">
              {error}
            </div>
          )}
          <div className="rounded-lg border bg-background p-4">
            {appStatus === 'missing' && !error ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('engine.studio.if.noAppTitle', locale)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('engine.studio.if.noAppHint', locale)}</p>
                </div>
                {onCreateApp && (
                  <button
                    type="button"
                    onClick={onCreateApp}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('engine.studio.app.create', locale)}
                  </button>
                )}
              </div>
            ) : !current ? (
              <div className="py-16 text-center text-sm text-muted-foreground">{t('engine.studio.if.pickLeft', locale)}</div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('engine.studio.loading', locale)}
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
                {tFormat('engine.studio.if.readonlyPreview', locale, { type: current.type })}
              </div>
            )}
          </div>
          {isEditable ? (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MousePointer2 className="h-3 w-3" /> {t('engine.studio.if.editHint', locale)}
            </p>
          ) : current?.type === 'object' ? (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Database className="h-3 w-3" /> {t('engine.studio.if.objectHintPre', locale)}<span className="font-medium">Data</span>{t('engine.studio.if.objectHintPost', locale)}
            </p>
          ) : null}
        </main>

        {/* inspector */}
        <aside className="w-72 shrink-0 overflow-auto border-l">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="text-[13px] font-medium">{t('engine.studio.inspector.props', locale)}</span>
            {selection && (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('engine.studio.deselect', locale)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </header>
          <div className="p-3">
            {editNav && navSel ? (
              <StudioNavItemInspector
                navId={navSel.id}
                appDraft={appDraft}
                objects={pkgObjects}
                onNavPatch={onNavPatch}
                onClear={() => setNavSel(null)}
              />
            ) : selection && Inspector && current ? (
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
                {t('engine.studio.inspector.emptyLine1', locale)}
                <br />
                {t('engine.studio.inspector.emptyLine2', locale)}
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
  readOnly = false,
}: {
  packageId: string;
  publishNonce?: number;
  onDraftSaved?: () => void;
  /** Courtesy gate: hide/disable metadata-authoring affordances (records stay usable). */
  readOnly?: boolean;
}): React.ReactElement {
  const client = useMetadataClient();
  const adapter = useAdapter();
  const locale = useMetadataLocale();
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
        if (items.length === 0 && !readOnly) setCreating(true);
      } catch (e) {
        if (!cancelled) setError(formatMetadataError(e));
      } finally {
        if (!cancelled) setObjectsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId, readOnly]);

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
        if (!cancelled) setError(formatMetadataError(e));
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
  // Guarded in addition to being hidden — it's also reachable through
  // GridFieldAuthoringProvider/ObjectFormDesigner.
  const addField = React.useCallback(() => {
    if (readOnly) return;
    const view = readFields(objDraft.fields);
    const name = nextFieldName(view.entries.map((e) => e.name));
    view.entries.push(newField(name, 'text', t('engine.studio.data.newFieldLabel', locale)));
    setObjDraft((d) => ({ ...d, fields: writeFields(view) }));
    setDirty(true);
    setFieldSel({ kind: 'field', id: name });
  }, [objDraft, readOnly]);

  // "+ new object": create a fresh object as a DRAFT in this package (runtime
  // create — same path the classic Studio editor uses), seeded with one text
  // field so the form/grid isn't empty. It stays draft-only (no physical table)
  // until the package publish, so we land on 表单·布局 — the metadata-level
  // surface that never fires data SQL.
  const doCreateObject = React.useCallback(async () => {
    if (readOnly) return;
    const label = newLabel.trim();
    const name = toFieldName(newName.trim() || label);
    if (!label || !name || name === 'field') return; // CJK label → identifier must be typed
    if (objects.some((o) => o.name === name)) {
      setError(tFormat('engine.studio.data.idExists', locale, { name }));
      return;
    }
    setCreateBusy(true);
    setError(null);
    try {
      const body = buildObjectSkeleton(name, label, t('engine.studio.data.nameFieldLabel', locale));
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
      setError(formatMetadataError(e));
    } finally {
      setCreateBusy(false);
    }
  }, [newLabel, newName, objects, client, packageId, onDraftSaved, readOnly]);

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
      setError(formatMetadataError(e));
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
        setError(formatMetadataError(e));
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
            <span>{tFormat('engine.studio.data.fieldCount', locale, { count: fieldCount })}</span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">{t('engine.studio.data.pickObject', locale)}</span>
        )}
        {hasDraft && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
            {t('engine.studio.unpublishedDraft', locale)}
          </span>
        )}
        <button
          onClick={doSave}
          disabled={!current || !dirty || !!saving || readOnly}
          title={readOnly ? t('engine.studio.pkg.readonlyHint', locale) : undefined}
          className="ml-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {saving === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t('engine.studio.saveDraft', locale)}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-52 shrink-0 flex-col border-r">
          <div className="shrink-0 p-2 pb-1">
            <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">{t('engine.studio.data.objects', locale)}</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('engine.studio.data.searchObjects', locale)}
              className="h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 pt-1">
            {objects.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {error ? t('engine.studio.loadFailed', locale) : objectsLoaded ? t('engine.studio.data.noObjects', locale) : t('engine.studio.loading', locale)}
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
            {readOnly ? (
              <p
                title={t('engine.studio.pkg.readonlyHint', locale)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground"
              >
                <Lock className="h-3 w-3" /> {t('engine.studio.pkg.readonly', locale)}
              </p>
            ) : creating ? (
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
                  placeholder={t('engine.studio.data.labelPlaceholder', locale)}
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
                  placeholder={t('engine.studio.data.idPlaceholder', locale)}
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
                    {t('engine.studio.createDraft', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    {t('engine.studio.cancel', locale)}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t('engine.studio.data.newObject', locale)}
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
                <p className="text-sm font-medium">{t('engine.studio.data.firstObjectTitle', locale)}</p>
                <p className="max-w-sm text-[11px] leading-5 text-muted-foreground">
                  {t('engine.studio.data.firstObjectHint', locale)}
                </p>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">{t('engine.studio.data.pickObject', locale)}</div>
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
                    {t('engine.studio.data.tab.records', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('form')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (viewMode === 'form' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {t('engine.studio.data.tab.form', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('rules')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (viewMode === 'rules' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {t('engine.studio.data.tab.rules', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('settings')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (viewMode === 'settings' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {t('engine.studio.data.tab.settings', locale)}
                  </button>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  <Eye className="h-3 w-3" />{' '}
                  {viewMode === 'grid'
                    ? t('engine.studio.data.badge.grid', locale)
                    : viewMode === 'rules'
                      ? t('engine.studio.data.badge.rules', locale)
                      : viewMode === 'settings'
                        ? t('engine.studio.data.badge.settings', locale)
                        : formMode === 'layout'
                          ? t('engine.studio.data.badge.formLayout', locale)
                          : t('engine.studio.data.badge.formPreview', locale)}
                </span>
                {(viewMode === 'grid' || viewMode === 'form') && !readOnly && (
                  <button
                    type="button"
                    onClick={addField}
                    title={t('engine.studio.data.addFieldTitle', locale)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('engine.studio.data.addField', locale)}
                  </button>
                )}
              </div>
              {error && (
                <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive whitespace-pre-line">
                  {error}
                </div>
              )}
              {viewMode === 'rules' ? (
                <ObjectValidationsPanel draft={objDraft} onPatch={onPatch} disabled={readOnly} />
              ) : viewMode === 'settings' ? (
                <ObjectSettingsPanel
                  name={current.name}
                  draft={objDraft}
                  onPatch={onPatch}
                  locale={locale}
                  disabled={readOnly}
                />
              ) : viewMode === 'grid' && !hasBaseline ? (
                /* Draft-only object: no physical table until the package publish —
                 * rendering the runtime grid would fire data SQL against a table
                 * that doesn't exist. Say so instead of erroring. */
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-center">
                  <p className="text-sm font-medium">{t('engine.studio.data.draftObjectTitle', locale)}</p>
                  <p className="max-w-md text-[11px] leading-5 text-muted-foreground">
                    {t('engine.studio.data.draftObjectHint', locale)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('form');
                      setFormMode('layout');
                    }}
                    className="mt-1 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    {t('engine.studio.data.goDesignFields', locale)}
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
                    // Read-only package: keep the per-column inspector (view props)
                    // but drop add-column and drag-reorder — both are doomed writes.
                    ...(readOnly
                      ? {}
                      : {
                          onAddColumn: addField,
                          addColumnLabel: t('engine.studio.data.addField', locale),
                          onReorderFields: doReorderFields,
                        }),
                    onEditColumn: (fieldName) => {
                      // ignore non-field columns (e.g. the row-actions column)
                      if (readFields(objDraft.fields).entries.some((e) => e.name === fieldName)) {
                        setFieldSel({ kind: 'field', id: fieldName });
                      }
                    },
                    editColumnLabel: t('engine.studio.data.editFieldProps', locale),
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
                <MousePointer2 className="h-3 w-3" /> {t('engine.studio.data.gridHint', locale)}
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
                    {t('engine.studio.data.form.layout', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMode('preview')}
                    className={
                      'rounded px-2.5 py-0.5 ' +
                      (formMode === 'preview' ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {t('engine.studio.data.form.preview', locale)}
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {formMode === 'layout' ? t('engine.studio.data.form.layoutBadge', locale) : t('engine.studio.data.form.previewBadge', locale)}
                </span>
                {/* Preview renders the PUBLISHED definition on purpose: a draft with
                  * structural changes has no physical columns yet (DDL lands at
                  * publish), so a draft-with-data preview would break. Publishing is
                  * a deliberate user action — say so instead of silently lying. */}
                {formMode === 'preview' && (dirty || hasDraft) && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
                    {t('engine.studio.data.form.previewWarn', locale)}
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
                  readOnly={readOnly}
                />
              ) : !hasBaseline ? (
                /* Draft-only object: there is no published definition to preview yet. */
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-center">
                  <p className="text-sm font-medium">{t('engine.studio.data.form.noPublishedTitle', locale)}</p>
                  <p className="max-w-md text-[11px] leading-5 text-muted-foreground">
                    {t('engine.studio.data.form.noPublishedHint', locale)}
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
                <MousePointer2 className="h-3 w-3" /> {t('engine.studio.data.formHint', locale)}
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
              <span className="text-[13px] font-medium">{t('engine.studio.data.fieldProps', locale)}</span>
              <button
                type="button"
                onClick={() => setFieldSel(null)}
                className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('engine.studio.close', locale)}
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
                readOnly,
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
/** Runtime enable/bound state for a flow (from `GET /automation/_status`). */
interface FlowRuntimeState {
  name: string;
  enabled?: boolean;
  bound?: boolean;
}

/**
 * A flow's live status in the Automations rail: a colored dot + On/Off, from the
 * engine's runtime state (persisted `status` is intent; this is what's actually
 * live). Renders nothing for a flow the engine doesn't know yet (never published)
 * — the amber "unpublished draft" chip already covers that case.
 */
export function FlowStatusDot({ state, locale }: { state?: { enabled: boolean; bound: boolean }; locale: string }): React.ReactElement | null {
  if (!state) return null;
  const { enabled, bound } = state;
  const title = enabled
    ? bound
      ? t('engine.studio.auto.onBound', locale)
      : t('engine.studio.auto.onUnbound', locale)
    : t('engine.studio.auto.offTitle', locale);
  return (
    <span title={title} className="inline-flex shrink-0 items-center gap-1">
      <span className={'h-1.5 w-1.5 rounded-full ' + (enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
      <span className={'text-[10px] ' + (enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
        {enabled ? t('engine.studio.auto.on', locale) : t('engine.studio.auto.off', locale)}
      </span>
    </span>
  );
}

function AutomationsPillar({
  packageId,
  publishNonce = 0,
  onDraftSaved,
  readOnly = false,
}: {
  packageId: string;
  publishNonce?: number;
  onDraftSaved?: () => void;
  /** Courtesy gate: hide/disable flow-authoring affordances. */
  readOnly?: boolean;
}): React.ReactElement {
  const client = useMetadataClient();
  const locale = useMetadataLocale();
  const [flows, setFlows] = React.useState<Surface[]>([]);
  const [current, setCurrent] = React.useState<Surface | null>(null);
  const [draft, setDraft] = React.useState<Record<string, unknown>>({});
  const [selection, setSelection] = React.useState<MetadataSelection | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState<false | 'draft' | 'publish'>(false);
  const [hasDraft, setHasDraft] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Tells "still fetching the list" apart from "fetched, package has no flows"
  // — without it the empty rail showed an endless "加载中…" for a fresh package.
  const [listed, setListed] = React.useState(false);
  // Inline create — a fresh package starts with zero flows, so the pillar must
  // offer a way to author the first one (mirrors the object/app creators).
  const [creating, setCreating] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [createBusy, setCreateBusy] = React.useState(false);
  const Preview = getMetadataPreview(current?.type ?? '');
  const inspector = getMetadataInspector('flow');
  const isEditable = !!Preview;

  // Runtime enable/bound state per flow (GET /automation/_status). Persisted
  // `status` is intent; this is what's actually live in the engine — the truth
  // behind the rail's status dots. Refetched after a publish (publishNonce);
  // degrades silently on an older backend / offline (dots just don't render).
  const [flowStatus, setFlowStatus] = React.useState<Record<string, { enabled: boolean; bound: boolean }>>({});
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/automation/_status', { credentials: 'include', headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { data?: { flows?: FlowRuntimeState[] }; flows?: FlowRuntimeState[] } | null;
        const list = payload?.data?.flows ?? payload?.flows ?? [];
        if (cancelled || !Array.isArray(list)) return;
        const map: Record<string, { enabled: boolean; bound: boolean }> = {};
        for (const s of list) if (s?.name) map[s.name] = { enabled: s.enabled !== false, bound: !!s.bound };
        setFlowStatus(map);
      } catch {
        /* offline / older backend → no dots */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publishNonce]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Published flows ∪ pending DRAFT flows — `list()` only sees
        // published/active metadata, so a just-authored flow that hasn't been
        // published yet (or a fresh writable-base package whose flows are all
        // drafts) would render an empty rail even though "Changes · N" shows the
        // draft exists. Mirrors the Data / Interfaces / Access pillars, which all
        // merge their drafts. Keyed on `publishNonce` too so drafts that go live
        // collapse back into the published rail after a package publish.
        const items = await loadPackageSurfaces(client, 'flow', packageId);
        if (cancelled) return;
        setFlows(items);
        setCurrent((c) => c ?? items[0] ?? null);
      } catch (e) {
        if (!cancelled) setError(formatMetadataError(e));
      } finally {
        if (!cancelled) setListed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId, publishNonce]);

  const doCreateFlow = React.useCallback(async () => {
    const label = newLabel.trim();
    const name = toFieldName(newName.trim() || label);
    if (!label || !name || name === 'field') return;
    setCreateBusy(true);
    setError(null);
    try {
      // Minimal valid, autolaunched skeleton: start → end. The designer fills in
      // the trigger + nodes; publishing it is a separate, user-initiated step.
      const skeleton = buildFlowSkeleton(
        name,
        label,
        t('engine.studio.auto.nodeStart', locale),
        t('engine.studio.auto.nodeEnd', locale),
      );
      await client.save('flow', name, skeleton, { mode: 'draft', packageId });
      const item: Surface = { type: 'flow', name, label };
      setFlows((fs) => [...fs.filter((f) => f.name !== name), item]);
      setCurrent(item);
      setHasDraft(true);
      setCreating(false);
      setNewLabel('');
      setNewName('');
      onDraftSaved?.();
      toast.success(tFormat('engine.studio.auto.savedDraft', locale, { label }));
    } catch (e) {
      setError(formatMetadataError(e));
    } finally {
      setCreateBusy(false);
    }
  }, [newLabel, newName, client, packageId, onDraftSaved]);

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
        if (!cancelled) setError(formatMetadataError(e));
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
      setError(formatMetadataError(e));
    } finally {
      setSaving(false);
    }
  }, [client, current, draft, onDraftSaved]);

  // Enable/disable persists via the flow's deployment `status` (active = on,
  // obsolete = off) — the engine honors it on the next publish. The switch flips
  // it and saves the draft immediately; the change goes live when the package is
  // published (so "review before enabling" is preserved).
  const flowEnabled = draft.status !== 'obsolete' && draft.status !== 'invalid';
  const toggleEnabled = React.useCallback(async () => {
    if (!current) return;
    const next = !(draft.status !== 'obsolete' && draft.status !== 'invalid');
    const nextDraft = { ...draft, status: next ? 'active' : 'obsolete' };
    setDraft(nextDraft);
    setSaving('draft');
    setError(null);
    try {
      await client.save('flow', current.name, nextDraft, { mode: 'draft', packageId });
      setHasDraft(true);
      onDraftSaved?.();
      toast.success(next ? t('engine.studio.auto.enabledToast', locale) : t('engine.studio.auto.disabledToast', locale));
    } catch (e) {
      setError(formatMetadataError(e));
    } finally {
      setSaving(false);
    }
  }, [client, current, draft, packageId, onDraftSaved, locale]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground">{t('engine.studio.auto.defaultOff', locale)}</span>
        {hasDraft && (
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">
            {t('engine.studio.unpublishedDraft', locale)}
          </span>
        )}
        {current && (
          <button
            type="button"
            role="switch"
            aria-checked={flowEnabled}
            onClick={toggleEnabled}
            disabled={!isEditable || !!saving}
            title={flowEnabled ? t('engine.studio.auto.disableTitle', locale) : t('engine.studio.auto.enableTitle', locale)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
          >
            <span className={'relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ' + (flowEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')}>
              <span className={'inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ' + (flowEnabled ? 'translate-x-3' : 'translate-x-0.5')} />
            </span>
            {flowEnabled ? t('engine.studio.auto.enabled', locale) : t('engine.studio.auto.disabled', locale)}
          </button>
        )}
        <button
          onClick={doSave}
          disabled={!current || !isEditable || !!saving || readOnly}
          title={readOnly ? t('engine.studio.pkg.readonlyHint', locale) : undefined}
          className="ml-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {saving === 'draft' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t('engine.studio.saveDraft', locale)}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-52 shrink-0 flex-col overflow-auto border-r p-2">
          <div className="flex items-center gap-1 px-2 pb-1 pt-1">
            <p className="flex-1 text-[11px] font-medium text-muted-foreground">{t('engine.studio.auto.heading', locale)}</p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                title={t('engine.studio.auto.newTitle', locale)}
                className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
              >
                <Plus className="h-3 w-3" /> {t('engine.studio.new', locale)}
              </button>
            )}
          </div>
          {flows.length > 0 &&
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
                <FlowStatusDot state={flowStatus[f.name]} locale={locale} />
              </button>
            ))}
          {flows.length === 0 && !creating && (
            <p className="px-2 py-3 text-[11px] text-muted-foreground">
              {error ? t('engine.studio.loadFailed', locale) : !listed ? t('engine.studio.loading', locale) : t('engine.studio.auto.none', locale)}
            </p>
          )}
          {creating && (
            <div className="mt-1 space-y-1.5 rounded-md border bg-muted/30 p-2">
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doCreateFlow();
                  if (e.key === 'Escape') setCreating(false);
                }}
                placeholder={t('engine.studio.auto.namePlaceholder', locale)}
                className="w-full rounded border bg-background px-2 py-1 text-xs"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doCreateFlow();
                  if (e.key === 'Escape') setCreating(false);
                }}
                placeholder={t('engine.studio.auto.idPlaceholder', locale)}
                className="w-full rounded border bg-background px-2 py-1 font-mono text-[11px]"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void doCreateFlow()}
                  disabled={!newLabel.trim() || createBusy}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                >
                  {createBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  {t('engine.studio.createDraft', locale)}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded border px-2 py-1 text-[11px] hover:bg-muted"
                >
                  {t('engine.studio.cancel', locale)}
                </button>
              </div>
            </div>
          )}
        </nav>

        <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              <Workflow className="h-3 w-3" /> {t('engine.studio.auto.canvasHint', locale)}
            </span>
            {current && <span className="text-[11px] text-muted-foreground">flow · {current.name}</span>}
          </div>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-line">
              {error}
            </div>
          )}
          <div className="rounded-lg border bg-background p-4">
            {!current ? (
              <div className="py-16 text-center text-sm text-muted-foreground">{t('engine.studio.auto.pick', locale)}</div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('engine.studio.loading', locale)}
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
              <MousePointer2 className="h-3 w-3" /> {t('engine.studio.auto.editHint', locale)}
            </p>
          )}
        </main>

        <aside className="w-72 shrink-0 overflow-auto border-l">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="text-[13px] font-medium">{t('engine.studio.auto.config', locale)}</span>
            {selection && (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('engine.studio.deselect', locale)}
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
                {t('engine.studio.auto.emptyLine1', locale)}
                <br />
                {t('engine.studio.auto.emptyLine2', locale)}
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
 * main: the Salesforce-style PermissionMatrixEditPage (objects × CRUD/VAMA +
 * field-level R/W).
 *
 * Scope note (ADR-0086 P0/P1/P2): the pillar is scoped to the current package.
 * The left rail lists only permission sets this package owns — the metadata API
 * filters `permission` by the record-level `package_id` provenance server-side
 * (P1), so environment-owned platform defaults (`admin_full_access`,
 * `member_default`, …) are excluded by the backend. The object MATRIX lists only
 * the objects this package declares, and Save merges just that slice back,
 * leaving other packages' contributed rows untouched (P0). Save writes a package
 * DRAFT and publishes with the whole package via the top-bar Publish (P2, D6).
 */
function AccessPillar({
  packageId,
  publishNonce,
  onDraftSaved,
  readOnly = false,
}: {
  packageId: string;
  publishNonce?: number;
  onDraftSaved?: () => void;
  /** Courtesy gate: hide/disable permission-authoring affordances. */
  readOnly?: boolean;
}): React.ReactElement {
  const client = useMetadataClient();
  const locale = useMetadataLocale();
  const [perms, setPerms] = React.useState<
    Array<{ name: string; label: string; isProfile?: boolean }>
  >([]);
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
      // Scope the rail to this package server-side (ADR-0086 P1): the metadata
      // API filters `permission` by the record-level `package_id` provenance, so
      // it returns only the sets this package owns — environment-owned platform
      // defaults (`admin_full_access`, `member_default`, …) are excluded by the
      // backend, not the client. (The `?package=` list rows don't echo the
      // provenance columns, so a client-side filter can't do this.)
      //
      // ADR-0086 P2 (D6): a package permission set is draft/published metadata,
      // so the rail shows published ∪ pending-draft sets — a set created (or
      // renamed) as a draft but not yet published must still appear, just like
      // the Data/Interfaces pillars merge their drafts. Draft headers are
      // already package-scoped by `listDrafts({ packageId })`.
      const [list, drafts] = await Promise.all([
        client.list('permission', { packageId }) as Promise<Array<Record<string, unknown>>>,
        client.listDrafts({ packageId, type: 'permission' }).catch(() => []),
      ]);
      const byName = new Map<string, { name: string; label: string; isProfile?: boolean }>();
      for (const p of list || []) {
        const name = String(p.name ?? (p as Record<string, unknown>).id ?? '');
        if (!name) continue;
        byName.set(name, {
          name,
          label: String(p.label ?? p.name ?? ''),
          isProfile: !!(p as Record<string, unknown>).isProfile,
        });
      }
      for (const d of (drafts as Array<{ name?: string }>) || []) {
        const name = String(d?.name ?? '');
        if (!name || byName.has(name)) continue;
        byName.set(name, { name, label: name });
      }
      const scoped = [...byName.values()];
      setPerms(scoped);
      setCurrent((c) => c ?? scoped[0]?.name ?? null);
    } catch (e) {
      setError(formatMetadataError(e));
    } finally {
      setLoaded(true);
    }
  }, [client, packageId]);

  React.useEffect(() => {
    void load();
    // Re-read after a package publish so drafts that went live collapse into
    // the published rail (ADR-0086 P2).
  }, [load, publishNonce]);

  const doCreate = React.useCallback(async () => {
    const label = newLabel.trim();
    const name = toFieldName(newName.trim() || label);
    if (!label || !name || name === 'field') return;
    setBusy(true);
    try {
      // Package door → create as a DRAFT stamped with this package (D6/D7),
      // published atomically with the rest of the package.
      await client.save('permission', name, buildPermissionSkeleton(name, label), { mode: 'draft', packageId });
      toast.success(tFormat('engine.studio.access.created', locale, { label }));
      setCreating(false);
      setNewLabel('');
      setNewName('');
      setNameTouched(false);
      onDraftSaved?.();
      await load();
      setCurrent(name);
    } catch (e) {
      toast.error(formatMetadataError(e));
    } finally {
      setBusy(false);
    }
  }, [client, newLabel, newName, load, packageId, onDraftSaved, locale]);

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
          <span className="text-[13px] font-medium text-foreground">{t('engine.studio.access.title', locale)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5">{t('engine.studio.access.subtitle', locale)}</span>
        </span>
        <span
          title={t('engine.studio.access.bannerTitle', locale)}
          className="ml-auto rounded bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300"
        >
          {t('engine.studio.access.banner', locale)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-52 shrink-0 flex-col border-r">
          <div className="p-2 pb-0">
            <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">{t('engine.studio.access.heading', locale)}</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('engine.studio.access.search', locale)}
              className="mb-1 h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 pt-1">
            {perms.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                {error ? t('engine.studio.loadFailed', locale) : loaded ? t('engine.studio.access.none', locale) : t('engine.studio.loading', locale)}
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
                  placeholder={t('engine.studio.access.labelPlaceholder', locale)}
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
                  placeholder={t('engine.studio.access.idPlaceholder', locale)}
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
                    {t('engine.studio.create', locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    {t('engine.studio.cancel', locale)}
                  </button>
                </div>
              </div>
            ) : readOnly ? (
              <p
                title={t('engine.studio.pkg.readonlyHint', locale)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground"
              >
                <Lock className="h-3 w-3" /> {t('engine.studio.pkg.readonly', locale)}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t('engine.studio.access.new', locale)}
              </button>
            )}
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto">
          {current ? (
            /* The existing Salesforce-style matrix page, embedded unchanged —
             * objects × CRUD/VAMA/lifecycle up top, per-object field-level R/W
             * below, its own Save + destructive-change guard included. */
            <PermissionMatrixEditPage
              key={current}
              type="permission"
              name={current}
              packageId={packageId}
              publishNonce={publishNonce}
              onDraftSaved={onDraftSaved}
            />
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {loaded && perms.length === 0 ? t('engine.studio.access.emptyMain', locale) : t('engine.studio.access.pick', locale)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default StudioDesignSurface;
