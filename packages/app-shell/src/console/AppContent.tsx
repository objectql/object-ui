/**
 * AppContent — inner SPA rendered under /apps/:appName/*.
 *
 * Owns the per-app shell: ConsoleLayout, CommandPalette, KeyboardShortcutsDialog,
 * route table for object/dashboard/report/page views, and the global ModalForm
 * used by ObjectView edit actions. The outer routing skeleton (BrowserRouter,
 * AuthGuard, AdapterProvider, MetadataProvider, theme/toaster, /home, /login,
 * /organizations) is provided by `createConsole` from @object-ui/app-shell.
 */

import { Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, lazy, Suspense, useMemo, type ReactNode } from 'react';
import { useAssistant } from '../assistant/assistantBus';
import { ModalForm } from '@object-ui/plugin-form';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { toast } from 'sonner';
import { useActionRunner, useGlobalUndo, useMutationInvalidationBridge, notifyDataChanged } from '@object-ui/react';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import type { ConnectionState } from '@object-ui/data-objectstack';
import { useAuth } from '@object-ui/auth';
import { useMetadata } from '../providers/MetadataProvider';
import { useAdapter } from '../providers/AdapterProvider';
import { usePreviewDrafts } from '../preview/PreviewModeContext';
import { PreviewDraftEmptyState } from '../preview/PreviewDraftEmptyState';
import { ExpressionProvider, evaluateVisibility } from '../providers/ExpressionProvider';
import { useTrackRouteAsRecent } from '../hooks/useTrackRouteAsRecent';
import { resolveRecordFormTarget, resolveFormViewLayout, resolveNavigateCreateUrl, resolveNavigateEditUrl, resolvePostCreateTarget } from '../utils/recordFormNavigation';
import { deriveRecordSurface, deriveRecordFlowSurface } from '@object-ui/plugin-view';
import { RECORD_FORM_PARAM, RECORD_FORM_OBJECT_PARAM, RECORD_FORM_LINK_PARAM } from '../urlParams';
import { matchAppBySegment } from '../utils/appRoute';
import { resolveHref, type NavTemplateContext } from '@object-ui/layout';
import { ExpressionEvaluator } from '@object-ui/core';

// Components (eagerly loaded — always needed)
import { ConsoleLayout } from '../layout/ConsoleLayout';
import { CommandPalette } from '../chrome/CommandPalette';
import { ErrorBoundary } from '../chrome/ErrorBoundary';
import { LoadingScreen } from '../chrome/LoadingScreen';
import { ObjectView } from '../views/ObjectView';
import { KeyboardShortcutsDialog } from '../chrome/KeyboardShortcutsDialog';
import { OnboardingWalkthrough } from '../chrome/OnboardingWalkthrough';
import { RouteFader } from '../chrome/RouteFader';
import { NavigationSyncEffect } from '../hooks/useNavigationSync';

// Route-based code splitting — lazy-load less-frequently-used routes
const RecordDetailView = lazy(() => import('../views/RecordDetailView').then(m => ({ default: m.RecordDetailView })));
const DashboardView = lazy(() => import('../views/DashboardView').then(m => ({ default: m.DashboardView })));
const PageView = lazy(() => import('../views/PageView').then(m => ({ default: m.PageView })));
const ReportView = lazy(() => import('../views/ReportView').then(m => ({ default: m.ReportView })));
const SearchResultsPage = lazy(() => import('../views/SearchResultsPage').then(m => ({ default: m.SearchResultsPage })));
const RecordFormPage = lazy(() => import('../views/RecordFormPage').then(m => ({ default: m.RecordFormPage })));
const ComponentNavView = lazy(() => import('../views/ComponentNavView').then(m => ({ default: m.ComponentNavView })));
const ObjectDataPage = lazy(() => import('../views/ObjectDataPage').then(m => ({ default: m.ObjectDataPage })));

// Metadata admin — mounted under /apps/:app/metadata. Lives at the top
// level so URLs read like a normal nested resource (RFC-style) instead of
// piggy-backing on the legacy ComponentRegistry fan-out.
const MetadataDirectoryPage = lazy(() => import('../views/metadata-admin').then(m => ({ default: m.MetadataDirectoryPage })));
const StudioHomePage = lazy(() => import('../views/metadata-admin').then(m => ({ default: m.StudioHomePage })));
const MetadataResourceListPage = lazy(() => import('../views/metadata-admin').then(m => ({ default: m.MetadataResourceListPage })));
const MetadataResourceEditPage = lazy(() => import('../views/metadata-admin').then(m => ({ default: m.MetadataResourceEditPage })));
const MetadataResourceHistoryPage = lazy(() => import('../views/metadata-admin').then(m => ({ default: m.MetadataResourceHistoryPage })));
const MetadataDiagnosticsPage = lazy(() => import('../views/metadata-admin').then(m => ({ default: m.MetadataDiagnosticsPage })));

// App authoring + dashboard editor pages — sourced from
// @object-ui/plugin-designer so third-party hosts can opt out by not
// registering these routes.
const CreateAppPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.CreateAppPage })));
const EditAppPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.EditAppPage })));
const DashboardDesignPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.DashboardDesignPage })));

// Marketplace pages — first-class platform feature; mounted at `system/marketplace`
// under any active app so admins can browse + install from inside the runtime.
const MarketplacePage = lazy(() => import('./marketplace/MarketplacePage').then(m => ({ default: m.MarketplacePage })));
const MarketplacePackagePage = lazy(() => import('./marketplace/MarketplacePackagePage').then(m => ({ default: m.MarketplacePackagePage })));
const MarketplaceInstalledPage = lazy(() => import('./marketplace/MarketplaceInstalledPage').then(m => ({ default: m.MarketplaceInstalledPage })));

interface AppContentProps {
  /**
   * Extra <Route> elements appended to the inner /apps/:appName/* router.
   * Hosts can use this to mount console-specific routes (e.g. /system, legacy
   * metadata editor) without forking AppContent.
   */
  extraRoutes?: ReactNode;
  /**
   * Extra <Route> elements rendered when there is no active app but the URL
   * matches a special path (create-app, system). Mirrors `extraRoutes` for
   * the no-app branch.
   */
  extraRoutesNoApp?: ReactNode;
}

/**
 * Bridges the global chat's "Review N change(s)" affordance (ADR-0033 Phase B)
 * to the metadata designer. The chat publishes a review target on `assistantBus`;
 * this navigator — which lives inside the app router and knows the app base —
 * routes to `/apps/:appName/metadata/:type/:name?review=1`, where the designer
 * reloads the pending draft and opens its review/diff.
 */
function DraftReviewNavigator({ appName }: { appName: string | undefined }) {
  const { reviewSeq, reviewTarget } = useAssistant();
  const navigate = useNavigate();
  const lastSeq = useRef(reviewSeq);
  useEffect(() => {
    if (reviewSeq === lastSeq.current || !reviewTarget || !appName) return;
    lastSeq.current = reviewSeq;
    const { type, name } = reviewTarget;
    navigate(
      `/apps/${appName}/metadata/${encodeURIComponent(type)}/${encodeURIComponent(name)}?review=1`,
    );
  }, [reviewSeq, reviewTarget, appName, navigate]);
  return null;
}

export function AppContent({ extraRoutes, extraRoutesNoApp }: AppContentProps = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const { user, getAuthConfig } = useAuth();
  const dataSource = useAdapter();

  // Deployment-level feature flags from `/api/v1/auth/config`. Used by
  // CEL predicates on metadata actions (e.g. `sys_organization`'s
  // create button is hidden when `multiOrgEnabled === false`). We keep
  // it empty until the fetch resolves so predicates default to "visible"
  // and we don't briefly hide UI on slow networks.
  const [features, setFeatures] = useState<Record<string, any>>({});
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setFeatures((cfg?.features as Record<string, any>) ?? {});
      })
      .catch(() => {
        /* leave empty — predicates default to visible */
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  const navigate = useNavigate();
  const location = useLocation();
  const { appName } = useParams();
  const { apps, objects: allObjects, loading: metadataLoading, ensureType, error: metadataError, refresh: refreshMetadata } = useMetadata();
  const previewDrafts = usePreviewDrafts();
  const { t } = useObjectTranslation();
  const { objectLabel } = useObjectLabel();

  // Preload the metadata buckets that the routes under /apps/:appName/* assume
  // are fully loaded by render time (the lazy MetadataProvider only eagerly
  // loads `app`).
  const [scopeMetaReady, setScopeMetaReady] = useState(!ensureType);
  useEffect(() => {
    if (!ensureType) {
      setScopeMetaReady(true);
      return;
    }
    let cancelled = false;
    Promise.all([
      ensureType('object'),
      ensureType('dashboard'),
      ensureType('report'),
      ensureType('page'),
    ]).finally(() => {
      if (!cancelled) setScopeMetaReady(true);
    });
    return () => { cancelled = true; };
  }, [ensureType]);

  // Hidden apps (`App.hidden`) are excluded from app-listing surfaces
  // (sidebar switcher, home grid, app switcher). The active app for the
  // current route is still looked up across ALL apps so /apps/account
  // resolves correctly; only the fallback (no appName → first app)
  // skips hidden apps to avoid landing the user on a personal-settings
  // app by default.
  const activeApps = apps.filter((a: any) => a.active !== false);
  const launcherApps = activeApps.filter((a: any) => a.hidden !== true);
  // ADR-0048 (A) — the route segment is the package id; resolve by it,
  // falling back to the app name (legacy/alias URL).
  // Built-in pseudo-routes under /apps/* that are NOT metadata apps (create-app,
  // system/*, metadata/*, setup). They must keep working — and may fall back to
  // a default app — regardless of whether the segment resolves to an app.
  const isCreateAppRoute = location.pathname.endsWith('/create-app');
  const isSystemRoute = location.pathname.includes('/system');
  const isMetadataRoute = location.pathname.includes('/metadata');
  const isSetupRoute =
    location.pathname === '/apps/setup' || location.pathname.startsWith('/apps/setup/');
  const isSpecialRoute = isCreateAppRoute || isSystemRoute || isMetadataRoute || isSetupRoute;

  const matchedApp = matchAppBySegment(apps, appName);
  const activeApp =
    matchedApp ||
    // Fall back to a default/first app only when NO specific app was requested
    // (bare /apps, the default redirect) OR for a built-in pseudo-route above.
    // A normal unmatched appName must NOT silently render a DIFFERENT app — the
    // readiness guard below shows loading / not-available instead. (Fixes "the
    // preview / nav renders the WRONG app right after building a new one".)
    ((!appName || isSpecialRoute)
      ? (launcherApps.find((a: any) => a.isDefault === true) || launcherApps[0])
      : undefined);

  // A normal app was requested but isn't present in the loaded metadata — the
  // post-publish readiness lag, or a genuinely-missing app. Applies in BOTH
  // preview and published mode (preview already guarded this; published used to
  // fall through to the wrong-app fallback above — the bug). Pseudo-routes are
  // excluded so they keep their default-app fallback.
  const requestedAppMissing = !!appName && !matchedApp && !isSpecialRoute;

  // Post-publish readiness: when a requested app isn't in the loaded metadata,
  // re-check ONCE (the registry can lag a beat behind a publish) before
  // concluding it's absent — so a just-built app resolves on its own instead
  // of flashing "not available", while we still never render a foreign app.
  const [missingRecheck, setMissingRecheck] = useState<'idle' | 'checking' | 'done'>('idle');
  useEffect(() => {
    if (!requestedAppMissing) {
      if (missingRecheck !== 'idle') setMissingRecheck('idle');
      return;
    }
    if (missingRecheck === 'idle' && !metadataLoading && !previewDrafts) {
      setMissingRecheck('checking');
      Promise.resolve(refreshMetadata()).finally(() => setMissingRecheck('done'));
    }
  }, [requestedAppMissing, metadataLoading, previewDrafts, missingRecheck, refreshMetadata]);

  useEffect(() => {
    if (!activeApp?.name) return;
    // ADR-0048 — build against the URL's own segment (`appName`, which may be the
    // package id) so the match works and the redirect keeps the same segment;
    // `activeApp.name` would flip a `/apps/<packageId>/…` URL to the name form.
    const seg = appName ?? activeApp.name;
    const packageMetadataPath = `/apps/${seg}/metadata/package`;
    if (
      location.pathname === packageMetadataPath ||
      location.pathname.startsWith(`${packageMetadataPath}/`)
    ) {
      navigate(`/apps/${seg}/component/developer/packages`, { replace: true });
    }
  }, [activeApp?.name, appName, location.pathname, navigate]);

  // #2604 — the create/edit overlay is URL-driven (`?form=new` / `?form=<id>`),
  // not component state: the record form is a TASK overlay over the origin
  // route, and putting its open-state in the URL makes browser Back close the
  // overlay (returning to the intact origin) instead of abandoning the route
  // with the overlay marooned on top. Same pattern as the detail drawer's
  // `?recordId=…` (useUrlOverlay / ADR-0054 C3). Open pushes a history entry;
  // every close strips the param with `replace` so no stale reopen-entry stays
  // ahead in history.
  const [searchParams, setSearchParams] = useSearchParams();
  const recordFormParam = searchParams.get(RECORD_FORM_PARAM);
  // #2604 D3 — child-task extension of the record-form URL contract:
  // `formObject` names the object the form edits when it is NOT the route's
  // object (a subtable child opened over its parent's detail); `formLink`
  // ("field:id") pre-links the parent on create. Keeping the whole task in
  // the URL means Back closes the overlay and a refresh reopens it still
  // correctly parent-linked — no transient component state to lose.
  const formObjectParam = searchParams.get(RECORD_FORM_OBJECT_PARAM);
  const formLinkParam = searchParams.get(RECORD_FORM_LINK_PARAM);
  const editingRecord = useMemo(
    () => (recordFormParam && recordFormParam !== 'new' ? { id: recordFormParam } : null),
    [recordFormParam],
  );
  const formLinkValues = useMemo(() => {
    if (!formLinkParam) return undefined;
    const i = formLinkParam.indexOf(':');
    if (i <= 0) return undefined;
    return { [formLinkParam.slice(0, i)]: formLinkParam.slice(i + 1) };
  }, [formLinkParam]);
  const [refreshKey, setRefreshKey] = useState(0);

  const isDialogOpen = !!recordFormParam;

  // Close the record-form overlay by stripping `?form` in place. Reads the
  // LIVE location (not the hook's render-time snapshot) so it stays a no-op
  // when a success handler already navigated away in the same tick (the
  // post-create redirect below).
  const closeRecordForm = useCallback(() => {
    const sp = new URLSearchParams(window.location.search);
    if (!sp.has(RECORD_FORM_PARAM) && !sp.has(RECORD_FORM_OBJECT_PARAM) && !sp.has(RECORD_FORM_LINK_PARAM)) return;
    sp.delete(RECORD_FORM_PARAM);
    sp.delete(RECORD_FORM_OBJECT_PARAM);
    sp.delete(RECORD_FORM_LINK_PARAM);
    setSearchParams(sp, { replace: true });
  }, [setSearchParams]);

  const { execute: executeAction, runner } = useActionRunner();

  // objectui#2269 — bridge every dataSource write (create/update/delete →
  // MutationEvent) onto the invalidation bus, ONCE for the whole console.
  // Readers (record detail, related lists, count badges) refetch in place;
  // nothing is remounted for a data refresh.
  useMutationInvalidationBridge(dataSource);

  useGlobalUndo({
    dataSource: dataSource ?? undefined,
    onUndo: (op: any) => {
      toast.info(`Undo: ${op.description}`, { duration: 4000 });
      setRefreshKey(k => k + 1);
      // Precisely-scoped invalidation — UndoableOperation carries the target
      // (objectName + recordId), so detail readers refresh in place too.
      if (op?.objectName) notifyDataChanged({ objectName: op.objectName, recordId: op.recordId });
    },
    onRedo: (op: any) => {
      toast.info(`Redo: ${op.description}`, { duration: 3000 });
      setRefreshKey(k => k + 1);
      if (op?.objectName) notifyDataChanged({ objectName: op.objectName, recordId: op.recordId });
    },
  });

  useEffect(() => {
    runner.registerHandler('crud_success', async (action: any) => {
      closeRecordForm();
      setRefreshKey(k => k + 1);
      toast.success(action.params?.message ?? 'Record saved successfully');
      return { success: true, reload: true };
    });

    runner.registerHandler('dialog_cancel', async () => {
      closeRecordForm();
      return { success: true };
    });

    // Page-mode navigation handlers — declarative counterparts to the
    // imperative `handleEdit` callback. These let JSON schemas open the
    // full-screen create/edit pages directly via `<action:button>` without
    // any custom code:
    //   { "action": "navigate_create", "params": { "objectName": "..." } }
    //   { "action": "navigate_edit",
    //     "params": { "objectName": "...", "recordId": "..." } }
    // The `objectName` param falls back to the action context's
    // `objectName` (set per view) so action buttons mounted inside an
    // ObjectView can omit it.
    // NOTE on duplication below: each handler reads `runner.getContext()`
    // INSIDE its closure (at action-invocation time) rather than once at
    // registration. Hoisting the call outside the registrations would
    // freeze the context to whatever it was when the effect last ran,
    // breaking dynamic per-view `runner.updateContext({ objectName, ... })`
    // calls (used by ObjectView / RecordDetailView). Keep the call where
    // it is.
    runner.registerHandler('navigate_create', async (action: any) => {
      const ctx = runner.getContext?.() ?? {};
      const result = resolveNavigateCreateUrl({
        action,
        context: ctx,
        defaultBaseUrl: `/apps/${appName ?? ''}`,
      });
      if (!result.success) return result;
      navigate(result.url);
      return { success: true };
    });

    runner.registerHandler('navigate_edit', async (action: any) => {
      const ctx = runner.getContext?.() ?? {};
      const result = resolveNavigateEditUrl({
        action,
        context: ctx,
        defaultBaseUrl: `/apps/${appName ?? ''}`,
      });
      if (!result.success) return result;
      navigate(result.url);
      return { success: true };
    });

    // NOTE: `flow` actions are handled at the per-view ActionProvider level
    // (RecordDetailView / ObjectView) so they share the same ActionRunner that
    // <action:button> renderers consume via useAction(). Do NOT register a
    // `flow` handler on this top-level useActionRunner — it lives on a
    // different ActionRunner instance and would never be invoked from the
    // record/list action buttons.
  }, [runner, navigate, appName, closeRecordForm]);

  useEffect(() => {
    if (!dataSource) return;
    const unsub = dataSource.onConnectionStateChange((event: any) => {
      setConnectionState(event.state);
      if (event.error) console.error('[Console] Connection error:', event.error);
    });
    setConnectionState(dataSource.getConnectionState());
    return unsub;
  }, [dataSource]);

  const cleanParts = location.pathname.split('/').filter(Boolean);
  let objectNameFromPath = cleanParts[2];
  if (
    objectNameFromPath === 'view' ||
    objectNameFromPath === 'record' ||
    objectNameFromPath === 'page' ||
    objectNameFromPath === 'dashboard' ||
    objectNameFromPath === 'design'
  ) {
    objectNameFromPath = '';
  }

  const currentObjectDef = allObjects.find((o: any) => o.name === objectNameFromPath);

  // The object the record-form overlay edits: the route's object by default,
  // or the `formObject` child override (#2604 D3 — subtable child task opened
  // over its parent's detail).
  const formObjectDef = formObjectParam
    ? allObjects.find((o: any) => o.name === formObjectParam)
    : currentObjectDef;
  const isChildFormTask = !!formObjectParam && formObjectParam !== currentObjectDef?.name;

  const handleCrudSuccess = useCallback(() => {
    const label = formObjectDef ? objectLabel(formObjectDef as any) : t('common.record', { defaultValue: 'Record' });
    executeAction({
      type: 'crud_success',
      params: {
        message: editingRecord
          ? t('form.updateSuccess', { object: label, defaultValue: `${label} updated successfully` })
          : t('form.createSuccess', { object: label, defaultValue: `${label} created successfully` }),
      },
    });
  }, [executeAction, editingRecord, formObjectDef, objectLabel, t]);

  const handleDialogCancel = useCallback(() => {
    executeAction({ type: 'dialog_cancel' });
  }, [executeAction]);

  // #2604 save invariant — *edit never moves you; create takes you to the
  // record you made.* Edit save: the origin route is untouched (crud_success
  // bumps refreshKey → origin refetches in place). Create save: land on the
  // new record's detail, on ITS derived surface — a light object's detail is
  // the drawer over the still-intact list; a heavy one is the detail route.
  // `replace: true` swaps out the transient `?form=…` entry so Back returns
  // to the pre-create origin.
  const handleRecordFormSuccess = useCallback(async (saved: any) => {
    // Child task (#2604 D3): the parent detail must stay EXACTLY as it was —
    // active tab, scroll, everything. So do NOT go through crud_success;
    // the child's open related lists refetch on their own via the
    // invalidation bus (#2269): the dataSource write already emitted a
    // MutationEvent that the bridge fans out — no manual notify needed.
    if (isChildFormTask) {
      const label = formObjectDef ? objectLabel(formObjectDef as any) : t('common.record', { defaultValue: 'Record' });
      toast.success(editingRecord
        ? t('form.updateSuccess', { object: label, defaultValue: `${label} updated successfully` })
        : t('form.createSuccess', { object: label, defaultValue: `${label} created successfully` }));
      closeRecordForm();
      return;
    }
    handleCrudSuccess();
    if (editingRecord || !currentObjectDef) return;
    const target = resolvePostCreateTarget({
      objectName: currentObjectDef.name,
      baseUrl: appName ? `/apps/${appName}` : (activeApp?.name ? `/apps/${activeApp.name}` : ''),
      pathname: location.pathname,
      search: window.location.search,
      surface: deriveRecordSurface(currentObjectDef),
      recordId: saved?.id ?? saved?._id,
    });
    if (target.kind !== 'none') navigate(target.url, { replace: true });
  }, [handleCrudSuccess, isChildFormTask, formObjectDef, editingRecord, currentObjectDef, appName, activeApp?.name, location.pathname, navigate, closeRecordForm, objectLabel, t]);

  // Track recent items on route change.
  useTrackRouteAsRecent({
    pathname: location.pathname,
    appName: activeApp?.name,
    objects: allObjects,
  });

  const handleEdit = (record: any) => {
    // Page-mode opt-in: when the object metadata declares
    // `editMode: 'page'`, route to the full-screen create/edit page instead
    // of opening the global ModalForm. Default behavior (modal) is
    // preserved for any object without the flag.
    const target = resolveRecordFormTarget({
      objectDef: currentObjectDef as any,
      baseUrl: appName ? `/apps/${appName}` : (activeApp?.name ? `/apps/${activeApp.name}` : ''),
      record,
    });
    if (target.kind === 'page') {
      navigate(target.url);
      return;
    }
    // Open the overlay via the URL (pushes one history entry → Back closes
    // the overlay, origin intact). `new` = create; a record id = edit.
    const rawId = record?.id ?? record?._id;
    const sp = new URLSearchParams(window.location.search);
    sp.set(RECORD_FORM_PARAM, rawId != null && rawId !== '' ? String(rawId) : 'new');
    // Top-level task on the route's own object — drop any stale child-task
    // overrides (see the record-form URL contract above).
    sp.delete(RECORD_FORM_OBJECT_PARAM);
    sp.delete(RECORD_FORM_LINK_PARAM);
    setSearchParams(sp);
  };

  const handleAppChange = (newAppName: string) => {
    navigate(`/apps/${newAppName}`);
  };

  const expressionEvaluator = useMemo(
    () => new ExpressionEvaluator({
      user: user ? { name: user.name, email: user.email, role: user.role ?? 'user' } : {},
      app: activeApp || {},
      data: editingRecord || {},
    }),
    [user, activeApp, editingRecord],
  );

  if (!dataSource || metadataLoading || !scopeMetaReady) return <LoadingScreen />;

  // ADR-0037 — preview mode renders its OWN empty/error states and never
  // falls through to the generic "No Apps Configured" guard below: inside a
  // draft preview (the Live Canvas iframe, or a hand-opened ?preview=draft
  // URL) that screen both lies ("nothing has been registered") and misdirects
  // ("Create Your First App") about an app the AI may have just drafted.
  if (previewDrafts && (requestedAppMissing || !activeApp)) {
    return (
      <PreviewDraftEmptyState
        appName={appName}
        error={metadataError}
        onRetry={() => void refreshMetadata()}
      />
    );
  }

  // (isCreateAppRoute / isSystemRoute / isMetadataRoute / isSetupRoute are
  // computed near the top — before activeApp — so the fallback + readiness
  // logic can use them. The metadata designer (Studio) in particular must stay
  // reachable with no active app: a fresh env where AI just drafted everything
  // has ZERO published apps, and that is the surface you review & publish from.)

  // A normal app was requested but isn't in the loaded metadata. Re-check once
  // for the post-publish lag, then say it's not available — NEVER render a
  // different app, and don't show the misleading "no apps configured" screen
  // below (there ARE apps). requestedAppMissing already excludes pseudo-routes.
  if (requestedAppMissing) {
    if (missingRecheck !== 'done') return <LoadingScreen />;
    return (
      <div className="h-screen flex items-center justify-center">
        <Empty>
          <EmptyTitle>{t('empty.appNotAvailable', { defaultValue: 'App not available' })}</EmptyTitle>
          <EmptyDescription>
            {t('empty.appNotAvailableDescription', {
              defaultValue: 'This app is not available yet — it may still be publishing. Try again in a moment.',
            })}
          </EmptyDescription>
          <div className="mt-4">
            <Button onClick={() => setMissingRecheck('idle')} data-testid="app-not-available-retry">
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  if (!activeApp && !isCreateAppRoute && !isSystemRoute && !isMetadataRoute) return (
    <div className="h-screen flex items-center justify-center">
      <Empty>
        <EmptyTitle>{t('empty.noAppsConfigured')}</EmptyTitle>
        <EmptyDescription>
          {t('empty.noAppsConfiguredDescription')}
        </EmptyDescription>
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <Button onClick={() => navigate('/create-app')} data-testid="create-first-app-btn">
            {t('empty.createFirstApp')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/apps/setup')} data-testid="go-to-settings-btn">
            {t('empty.systemSettings')}
          </Button>
        </div>
      </Empty>
    </div>
  );

  if (!activeApp && (isCreateAppRoute || isSystemRoute || isMetadataRoute)) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="create-app" element={<CreateAppPage />} />
          <Route path="system/marketplace" element={<MarketplacePage />} />
          <Route path="system/marketplace/installed" element={<MarketplaceInstalledPage />} />
          <Route path="system/marketplace/:packageId" element={<MarketplacePackagePage />} />
          {/* Studio / metadata designer — reachable with no active app so a
              fresh env can review + publish its first (AI-authored) drafts. */}
          <Route path="metadata" element={<MetadataDirectoryPage />} />
          <Route path="metadata/_diagnostics" element={<MetadataDiagnosticsPage />} />
          <Route path="metadata/:type" element={<MetadataResourceListPage />} />
          <Route path="metadata/:type/new" element={<MetadataResourceEditPage createMode />} />
          <Route path="metadata/:type/:name" element={<MetadataResourceEditPage />} />
          <Route path="metadata/:type/:name/history" element={<MetadataResourceHistoryPage />} />
          {extraRoutesNoApp}
        </Routes>
      </Suspense>
    );
  }

  const expressionUser = user
    ? {
        id: (user as any).id,
        name: user.name,
        email: user.email,
        role: user.role ?? 'user',
        roles: (user as any).roles,
        // Surface the platform-admin flag so action `visible` CEL predicates
        // gated on `ctx.user.isPlatformAdmin == true` (e.g. sys_environment
        // "Change Plan (admin)") evaluate correctly. Previously only
        // name/email/role were forwarded → isPlatformAdmin-gated actions were
        // hidden even for platform admins.
        isPlatformAdmin: (user as any).isPlatformAdmin ?? false,
      }
    : { name: 'Anonymous', email: '', role: 'guest', isPlatformAdmin: false };

  return (
    <ExpressionProvider user={expressionUser} app={activeApp} data={{}} features={features}>
      <NavigationSyncEffect />
      <ConsoleLayout
        activeAppName={activeApp.name}
        activeApp={activeApp}
        onAppChange={handleAppChange}
        objects={allObjects}
        connectionState={connectionState}
        userId={user?.id}
      >
        <CommandPalette
          apps={apps}
          activeApp={activeApp}
          objects={allObjects}
          onAppChange={handleAppChange}
          dataSource={dataSource}
        />
        <KeyboardShortcutsDialog />
        <OnboardingWalkthrough />
        <DraftReviewNavigator appName={appName} />
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <RouteFader className="h-full">
                <Routes>
                <Route
                  path="/"
                  element={(() => {
                    // When the app declares a landing target (home page or
                    // first nav route) honour it; otherwise — e.g. the
                    // metadata-admin "Studio" app whose nav is built from
                    // domains and has no single landing — render the rich
                    // overview instead of a blank `<Navigate to="">`.
                    const landing = resolveLandingRoute(activeApp, { currentUserId: user?.id ?? null });
                    return landing ? <Navigate to={landing} replace /> : <StudioHomePage />;
                  })()}
                />
                {/* Metadata admin routes — declared BEFORE the generic
                    `:objectName/...` routes so the static `metadata` prefix
                    wins React Router's score tiebreaker (both
                    `metadata/:type/:name` and `:objectName/view/:viewId`
                    score 16; declaration order breaks the tie). */}
                <Route
                  path="metadata/package/*"
                  element={<Navigate to={`/apps/${appName ?? activeApp.name}/component/developer/packages`} replace />}
                />
                <Route path="metadata">
                  <Route index element={<MetadataDirectoryPage />} />
                  <Route path="_diagnostics" element={<MetadataDiagnosticsPage />} />
                  <Route path=":type" element={<MetadataResourceListPage />} />
                  <Route path=":type/new" element={<MetadataResourceEditPage createMode />} />
                  <Route path=":type/:name" element={<MetadataResourceEditPage />} />
                  <Route path=":type/:name/history" element={<MetadataResourceHistoryPage />} />
                </Route>
                <Route path=":objectName" element={
                  <ObjectView dataSource={dataSource} objects={allObjects} onEdit={handleEdit} externalRefreshKey={refreshKey} />
                } />
                <Route path=":objectName/new" element={
                  <RecordFormPage mode="create" />
                } />
                <Route path=":objectName/view/:viewId" element={
                  <ObjectView dataSource={dataSource} objects={allObjects} onEdit={handleEdit} externalRefreshKey={refreshKey} />
                } />
                {/* ADR-0055: parameterized bare data surface — URL `filter[...]`
                    conditions over everything row-level security permits, NOT
                    anchored to any saved view. `data` is a reserved segment
                    alongside `new` / `view` / `record`. */}
                <Route path=":objectName/data" element={
                  <ObjectDataPage dataSource={dataSource} objects={allObjects} />
                } />
                <Route path=":objectName/record/:recordId" element={
                  <RecordDetailView dataSource={dataSource} objects={allObjects} onEdit={handleEdit} />
                } />
                <Route path=":objectName/record/:recordId/edit" element={
                  <RecordFormPage mode="edit" />
                } />
                <Route path="dashboard/:dashboardName" element={<DashboardView dataSource={dataSource} />} />
                <Route path="report/:reportName" element={<ReportView dataSource={dataSource} />} />
                <Route path="page/:pageName" element={<PageView />} />
                <Route path="component/:ns/:name/*" element={<ComponentNavView />} />
                {/* Legacy: old metadata routes built before the REST-style nesting
                    landed. Redirect to the new /metadata/:type/... shape. */}
                <Route path="component/metadata/directory" element={<LegacyMetadataRedirect mode="directory" />} />
                <Route path="component/metadata/resource/*" element={<LegacyMetadataRedirect mode="resource" />} />
                <Route path="design/dashboard/:dashboardName" element={<DashboardDesignPage />} />
                <Route path="search" element={<SearchResultsPage />} />
                <Route path="create-app" element={<CreateAppPage />} />
                <Route path="edit-app/:editAppName" element={<EditAppPage />} />
                <Route path="system/marketplace" element={<MarketplacePage />} />
                <Route path="system/marketplace/installed" element={<MarketplaceInstalledPage />} />
                <Route path="system/marketplace/:packageId" element={<MarketplacePackagePage />} />
                {extraRoutes}
                {/* Shorthand-deep-link redirect: a bare `/{:objectName}/:maybeRecordId`
                    URL is ambiguous — it could be a view id or a record id. When
                    the second segment matches a record-id shape (URL-safe, ≥6
                    chars, not a reserved word like `new` / `view` / `record`)
                    we forward it to the canonical record route. This catches:
                    - middle/Cmd-click links that legacy producers built before
                      the URL builder was fixed
                    - externally shared / pasted links (email, Slack)
                    - copy-paste of a record id appended to an object URL */}
                <Route path=":objectName/:maybeRecordId" element={<ShorthandRecordRedirect />} />
                {/* Catch-all: render an explicit "not found" instead of a blank
                    page so users always know when a URL didn't resolve. */}
                <Route path="*" element={<RouteNotFound />} />
              </Routes>
              </RouteFader>
            </Suspense>
          </ErrorBoundary>
          {formObjectDef && (
            <ModalForm
              key={`${formObjectDef.name}:${editingRecord?.id || 'new'}`}
              schema={{
                type: 'object-form',
                formType: 'modal',
                objectName: formObjectDef.name,
                mode: editingRecord ? 'edit' : 'create',
                recordId: editingRecord?.id,
                // Child create task (#2604 D3): pre-link the parent from the
                // `formLink` URL param (refresh-safe — the link survives).
                ...(formLinkValues && !editingRecord ? { initialValues: formLinkValues } : {}),
                // #2604 D1: create/edit follow the flow-surface derivation —
                // field-heavy → full-screen modal (the same big canvas the
                // detail page gets, with overlay return semantics); light
                // objects keep the existing auto-sized modal (ModalForm
                // infers from columns when modalSize is unset). Derived
                // default only — anything spread later (form view layout)
                // would win. Child tasks size to the CHILD object's def.
                ...(deriveRecordFlowSurface(
                  formObjectDef,
                  isChildFormTask
                    ? (editingRecord ? 'child-edit' : 'child-create')
                    : (editingRecord ? 'edit' : 'create'),
                ).size === 'full'
                  ? { modalSize: 'full' as const }
                  : {}),
                // Honor the object's DEFAULT FORM VIEW: curated sections (field
                // selection + order + grouping), `contentLayout: 'tabbed'` when the
                // view is tabbed, and inline child collections (master-detail).
                // When the view declares sections they drive the modal layout and
                // win over the flat `fields` list below; otherwise this resolves to
                // {} and `fields` (every field, raw schema order) is used as before.
                // `formType` stays 'modal' (the container). (#1890 / ADR-0050.)
                ...resolveFormViewLayout(formObjectDef as any),
                title: editingRecord
                  ? t('form.editTitle', { object: objectLabel(formObjectDef as any) })
                  : t('form.createTitle', { object: objectLabel(formObjectDef as any) }),
                description: editingRecord
                  ? t('form.editDescription', { object: objectLabel(formObjectDef as any) })
                  : t('form.createDescription', { object: objectLabel(formObjectDef as any) }),
                open: isDialogOpen,
                onOpenChange: (open: boolean) => { if (!open) closeRecordForm(); },
                layout: 'vertical',
                fields: formObjectDef.fields
                  ? (Array.isArray(formObjectDef.fields)
                      ? formObjectDef.fields
                          .filter((f: any) => {
                            if (typeof f === 'string') return true;
                            return evaluateVisibility(f.visible, expressionEvaluator);
                          })
                          .map((f: any) => typeof f === 'string' ? f : f.name)
                      : Object.entries(formObjectDef.fields)
                          .filter(([_, f]: [string, any]) => evaluateVisibility(f.visible, expressionEvaluator))
                          .map(([key]: [string, any]) => key))
                  : [],
                onSuccess: handleRecordFormSuccess,
                onCancel: handleDialogCancel,
                showSubmit: true,
                showCancel: true,
                submitText: editingRecord
                  ? t('form.update', { defaultValue: t('common.save', { defaultValue: 'Save' }) })
                  : t('form.create', { defaultValue: t('common.create', { defaultValue: 'Create' }) }),
                cancelText: t('common.cancel'),
              }}
              dataSource={dataSource}
            />
          )}
      </ConsoleLayout>
    </ExpressionProvider>
  );
}

function findFirstRoute(items: any[], ctx?: NavTemplateContext): string {
  if (!items || items.length === 0) return '';
  for (const item of items) {
    if (item.type === 'object' || item.type === 'page' || item.type === 'dashboard' || item.type === 'report') {
      const route = buildItemRoute(item, ctx);
      if (route) return route;
      continue;
    }
    if (item.type === 'url') continue;
    if (item.type === 'group' && item.children) {
      const childRoute = findFirstRoute(item.children, ctx);
      if (childRoute !== '') return childRoute;
    }
  }
  return '';
}

// Build the per-item route segment without recursing through groups —
// used when `homePageId` resolved to an exact match and we just need to
// know how to address it. Delegates to the layout package's resolveHref()
// so `recordId`/`recordMode`/`componentRef` semantics stay consistent
// with the sidebar.
function buildItemRoute(item: any, ctx?: NavTemplateContext): string {
  if (!item) return '';
  if (item.type === 'url' || item.type === 'action' || item.type === 'separator' || item.type === 'group') return '';
  const { href, external } = resolveHref(item, '', ctx);
  if (external || !href || href === '#') return '';
  // resolveHref returns leading-slash paths (`/sys_user/...`); the
  // Navigate target inside <Routes basename="/apps/:appName"> wants a
  // *relative* path so it composes with the app base.
  return href.replace(/^\//, '');
}

function findNavItemById(items: any[], id: string): any | undefined {
  if (!items) return undefined;
  for (const item of items) {
    if (item.id === id) return item;
    if (item.type === 'group' && item.children) {
      const hit = findNavItemById(item.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * Resolves the route to navigate to when the user lands on the bare
 * `/console/apps/:appName` URL. Honors the app's explicit
 * `homePageId` (Salesforce-style "Default Landing"); falls back to the
 * first reachable nav item only when no homePageId is set or it points
 * at something that doesn't yield a route. This is what lets the CRM
 * example open on the Sales Dashboard instead of the Lead list.
 */
function resolveLandingRoute(activeApp: any, ctx?: NavTemplateContext): string {
  const homePageId: string | undefined = activeApp?.homePageId;
  const navigation = activeApp?.navigation || [];
  if (homePageId) {
    const item = findNavItemById(navigation, homePageId);
    const route = buildItemRoute(item, ctx);
    if (route) return route;
  }
  return findFirstRoute(navigation, ctx);
}

/**
 * Heuristic: distinguish a record id from a route fragment.
 *
 * Record ids in this system are URL-safe slugs (alnum + `_` / `-`), typically
 * 8+ chars (often 16+). They never collide with reserved second-segment
 * keywords used by the route table (`new`, `view`, `record`, `dashboard`,
 * `report`, `page`, `design`, `search`, `create-app`, `edit-app`).
 */
const RESERVED_SECOND_SEGMENTS = new Set([
  'new', 'view', 'record', 'edit',
  'dashboard', 'report', 'page',
  'design', 'search', 'create-app', 'edit-app',
  'metadata',
]);

function looksLikeRecordId(segment: string | undefined): boolean {
  if (!segment) return false;
  if (RESERVED_SECOND_SEGMENTS.has(segment)) return false;
  // Allow URL-safe slug chars; reject anything with `/`, `?`, `#`, spaces.
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return false;
  // Most record ids are at least 6 chars (UUID, ULID, nanoid all >=8).
  return segment.length >= 6;
}

/**
 * Translates pre-refactor metadata admin URLs
 * (`/apps/:app/component/metadata/resource/:name?type=:type`,
 *  `/apps/:app/component/metadata/directory`) into the new REST-style
 * shape (`/apps/:app/metadata/:type/:name`). Keeps bookmarks and any
 * still-unmigrated link producers working.
 */
function LegacyMetadataRedirect({ mode }: { mode: 'directory' | 'resource' }) {
  const location = useLocation();
  const appBase = location.pathname.replace(/\/component\/metadata\/.*$/, '');
  if (mode === 'directory') {
    return <Navigate to={`${appBase}/metadata${location.search}${location.hash}`} replace />;
  }
  const sp = new URLSearchParams(location.search);
  const type = sp.get('type') ?? '';
  const tail = location.pathname.match(/\/component\/metadata\/resource(\/.*)?$/)?.[1] ?? '';
  const target = type
    ? `${appBase}/metadata/${encodeURIComponent(type)}${tail}${location.hash}`
    : `${appBase}/metadata${location.hash}`;
  return <Navigate to={target} replace />;
}

/**
 * Redirects `/apps/:appName/:objectName/:recordId` shorthand to the
 * canonical `/apps/:appName/:objectName/record/:recordId` so externally
 * shared / pasted links work, and legacy URL producers that built the
 * shorthand keep functioning.
 */
function ShorthandRecordRedirect() {
  const { objectName, maybeRecordId } = useParams();
  const location = useLocation();
  if (objectName && looksLikeRecordId(maybeRecordId)) {
    const target = `${location.pathname.replace(/\/$/, '').replace(`/${maybeRecordId}`, `/record/${maybeRecordId}`)}${location.search}${location.hash}`;
    return <Navigate to={target} replace />;
  }
  return <RouteNotFound />;
}

/**
 * Visible "not found" fallback rendered for any unmatched URL inside the
 * console app shell. Previously these URLs produced a fully blank content
 * area with no indication that anything had gone wrong — users would think
 * the app had crashed. An explicit Empty state with a "back to app home"
 * action turns an opaque failure into a recoverable one.
 */
function RouteNotFound() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <Empty>
        <EmptyTitle>{t('console.notFound.title', { defaultValue: 'Page not found' })}</EmptyTitle>
        <EmptyDescription>
          {t('console.notFound.description', { defaultValue: 'The URL you followed does not match any view in this app.' })}
        </EmptyDescription>
        <div className="mt-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            {t('console.notFound.back', { defaultValue: 'Go back' })}
          </Button>
        </div>
      </Empty>
    </div>
  );
}
