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
import { useAssistant } from '../assistant/assistantBus.js';
import { ModalForm } from '@object-ui/plugin-form';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { toast } from 'sonner';
import { useActionRunner, useGlobalUndo, useMutationInvalidationBridge, notifyDataChanged, FilterScopeProvider } from '@object-ui/react';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import type { AppAccessVerdict, ConnectionState } from '@object-ui/data-objectstack';
import { useAuth, useWorkspaceAdminStatus } from '@object-ui/auth';
import { useMetadata } from '../providers/MetadataProvider.js';
import { useAdapter } from '../providers/AdapterProvider.js';
import { usePreviewDrafts } from '../preview/PreviewModeContext.js';
import { PreviewDraftEmptyState } from '../preview/PreviewDraftEmptyState.js';
import { ExpressionProvider, evaluateVisibility } from '../providers/ExpressionProvider.js';
import { useTrackRouteAsRecent } from '../hooks/useTrackRouteAsRecent.js';
import { resolveRecordFormTarget, resolveFormViewLayout, resolveNavigateCreateUrl, resolveNavigateEditUrl, resolvePostCreateTarget } from '../utils/recordFormNavigation.js';
import { deriveRecordSurface, deriveRecordFlowSurface } from '@object-ui/plugin-view';
import { RECORD_FORM_PARAM, RECORD_FORM_OBJECT_PARAM, RECORD_FORM_LINK_PARAM } from '../urlParams.js';
import { matchAppBySegment } from '../utils/appRoute.js';
import { resolveHref, type NavTemplateContext } from '@object-ui/layout';
import { ExpressionEvaluator } from '@object-ui/core';

// Components (eagerly loaded — always needed)
import { ConsoleLayout } from '../layout/ConsoleLayout.js';
import { CommandPalette } from '../chrome/CommandPalette.js';
import { ErrorBoundary } from '../chrome/ErrorBoundary.js';
import { LoadingScreen } from '../chrome/LoadingScreen.js';
import { ObjectView } from '../views/ObjectView.js';
import { KeyboardShortcutsDialog } from '../chrome/KeyboardShortcutsDialog.js';
import { OnboardingWalkthrough } from '../chrome/OnboardingWalkthrough.js';
import { RouteFader } from '../chrome/RouteFader.js';
import { NavigationSyncEffect } from '../hooks/useNavigationSync.js';

// Route-based code splitting — lazy-load less-frequently-used routes
const RecordDetailView = lazy(() => import('../views/RecordDetailView.js').then(m => ({ default: m.RecordDetailView })));
const DashboardView = lazy(() => import('../views/DashboardView.js').then(m => ({ default: m.DashboardView })));
const PageView = lazy(() => import('../views/PageView.js').then(m => ({ default: m.PageView })));
const ReportView = lazy(() => import('../views/ReportView.js').then(m => ({ default: m.ReportView })));
const SearchResultsPage = lazy(() => import('../views/SearchResultsPage.js').then(m => ({ default: m.SearchResultsPage })));
const RecordFormPage = lazy(() => import('../views/RecordFormPage.js').then(m => ({ default: m.RecordFormPage })));
const ComponentNavView = lazy(() => import('../views/ComponentNavView.js').then(m => ({ default: m.ComponentNavView })));
const ObjectDataPage = lazy(() => import('../views/ObjectDataPage.js').then(m => ({ default: m.ObjectDataPage })));

// Metadata admin — mounted under /apps/:app/metadata. Lives at the top
// level so URLs read like a normal nested resource (RFC-style) instead of
// piggy-backing on the legacy ComponentRegistry fan-out.
const MetadataDirectoryPage = lazy(() => import('../views/metadata-admin/index.js').then(m => ({ default: m.MetadataDirectoryPage })));
const StudioHomePage = lazy(() => import('../views/metadata-admin/index.js').then(m => ({ default: m.StudioHomePage })));
const MetadataResourceListPage = lazy(() => import('../views/metadata-admin/index.js').then(m => ({ default: m.MetadataResourceListPage })));
const MetadataResourceEditPage = lazy(() => import('../views/metadata-admin/index.js').then(m => ({ default: m.MetadataResourceEditPage })));
const MetadataResourceHistoryPage = lazy(() => import('../views/metadata-admin/index.js').then(m => ({ default: m.MetadataResourceHistoryPage })));
const MetadataDiagnosticsPage = lazy(() => import('../views/metadata-admin/index.js').then(m => ({ default: m.MetadataDiagnosticsPage })));

// App authoring + dashboard editor pages — sourced from
// @object-ui/plugin-designer so third-party hosts can opt out by not
// registering these routes.
const CreateAppPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.CreateAppPage })));
const EditAppPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.EditAppPage })));
const DashboardDesignPage = lazy(() => import('@object-ui/plugin-designer').then(m => ({ default: m.DashboardDesignPage })));

// Marketplace pages — first-class platform feature; mounted at `system/marketplace`
// under any active app so admins can browse + install from inside the runtime.
const MarketplacePage = lazy(() => import('./marketplace/MarketplacePage.js').then(m => ({ default: m.MarketplacePage })));
const MarketplacePackagePage = lazy(() => import('./marketplace/MarketplacePackagePage.js').then(m => ({ default: m.MarketplacePackagePage })));
const MarketplaceInstalledPage = lazy(() => import('./marketplace/MarketplaceInstalledPage.js').then(m => ({ default: m.MarketplaceInstalledPage })));

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

/**
 * The predicate-evaluation identity `ExpressionProvider` binds as
 * `current_user` / `ctx.user` / `os.user`.
 *
 * Extracted from `AppContent`'s body in objectui#5424 so the SHAPE it
 * advertises is assertable on its own — the defect it carried was a key that
 * was always `undefined`, which no render-level assertion can see.
 *
 * `roles` is deliberately ABSENT, not merely empty. It used to be forwarded as
 * `roles: (user as any).roles`, and the protocol-17 session face emits no
 * `roles` key at all (framework ADR-0090 D3 renamed it to `positions` with no
 * deprecation window — measured in objectui#5389), so the key reached every CEL
 * predicate as `undefined`: an author writing `'manager' in current_user.roles`
 * got a shape that answered, wrongly, rather than one that was plainly not
 * there. `positions` below is the published spelling and carries the same
 * names. Not paired as a fallback — that is what ADR-0090 D3 forbids
 * (`packages/auth/src/types.ts`).
 *
 * The signed-out branch never had `roles` either, so removing it also makes the
 * two branches agree on one shape.
 */
export function buildExpressionUser(user: unknown): Record<string, unknown> {
  const u = user as
    | { id?: string; name?: string; email?: string; role?: string; [key: string]: unknown }
    | null
    | undefined;
  if (!u) {
    return { name: 'Anonymous', email: '', role: 'guest', isPlatformAdmin: false, positions: [] };
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role ?? 'user',
    // Surface the platform-admin flag so action `visible` CEL predicates
    // gated on `ctx.user.isPlatformAdmin == true` (e.g. sys_environment
    // "Change Plan (admin)") evaluate correctly. Previously only
    // name/email/role were forwarded → isPlatformAdmin-gated actions were
    // hidden even for platform admins.
    isPlatformAdmin: u.isPlatformAdmin ?? false,
    // Positions are what the SERVER binds as `current_user` for per-option
    // `visibleWhen` authorization gating (ADR-0058; framework EvalUser —
    // objectui#2284). Forwarding them lets a position-gated option
    // (`'admin' in current_user.positions`) hide client-side too, instead
    // of failing open as visible and only being rejected on submit.
    positions: u.positions ?? [],
  };
}

export function AppContent({ extraRoutes, extraRoutesNoApp }: AppContentProps = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const { user, getAuthConfig, activeOrganization } = useAuth();
  // objectui#4473 — read at the top (hooks are unconditional); consumed by the
  // no-app guard far below, where the comment explains what it decides.
  const { isAdmin: isWorkspaceAdmin, isResolved: isWorkspaceAdminResolved } = useWorkspaceAdminStatus();
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
  //
  // ⛔ `hidden` only — never `_unpublished` (objectstack#6955 / #4829 A1). The
  // publish gate is enforced server-side; duplicating it here would strand a
  // builder on their own unpublished app.
  const activeApps = apps.filter((a: any) => a.active !== false);
  const launcherApps = activeApps.filter((a: any) => a.hidden !== true);
  // ADR-0048 (A) — the route segment is the package id; resolve by it,
  // falling back to the app name (legacy/alias URL).
  // Built-in pseudo-routes under /apps/* that are NOT metadata apps (create-app,
  // system/*, metadata/*, setup). They must keep working — and may fall back to
  // a default app — regardless of whether the segment resolves to an app.
  // #3638 — `system` / `metadata` are matched as whole path SEGMENTS, not as
  // substrings. `pathname.includes('/system')` was also true for any segment
  // that merely STARTS with `system` (`system_log`, `system_setting`,
  // `systems`), and likewise for `metadata` (`metadata_import`, …). That made
  // `isSpecialRoute` true for an ordinary `/apps/:app/:objectName` URL whose
  // object name happened to start that way — which suppressed
  // `requestedAppMissing` below and let a MISTYPED app name silently render a
  // DIFFERENT app (the exact failure the comment on the fallback describes).
  // Every real pseudo-route spells them as full segments — `system/marketplace`,
  // `system/metadata/:type`, `metadata/:type`, `component/metadata/resource` —
  // so the segment test keeps all of them true (pinned in
  // `__tests__/AppContent.pseudoRouteSegments.test.tsx`).
  const pathSegments = location.pathname.split('/');
  const isCreateAppRoute = location.pathname.endsWith('/create-app');
  const isSystemRoute = pathSegments.includes('system');
  const isMetadataRoute = pathSegments.includes('metadata');
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
  //
  // objectui#4522 — the run is stored WITH the app it ran for and read back
  // only for that app. Held loose from a name, it was a flag for "a re-check
  // HAS run", reset on exactly one condition: `requestedAppMissing` going
  // false. Two missing apps in a row never satisfy that — `requestedAppMissing`
  // is true before the transition and true after it — so the state rode across
  // as 'done' and the SECOND app got no re-check at all. An app reached second
  // in one mount (launcher, then a typo'd URL, then the real freshly-published
  // app; or two attempts while a build lands) was shown "not available" with no
  // refresh behind it. Same keying as `accessProbe` below, deliberately: one
  // pattern in this file, not two.
  const [missingRecheckRun, setMissingRecheckRun] =
    useState<{ app: string; phase: 'checking' | 'done' } | null>(null);
  const missingRecheck: 'idle' | 'checking' | 'done' =
    missingRecheckRun && missingRecheckRun.app === appName ? missingRecheckRun.phase : 'idle';
  useEffect(() => {
    if (!requestedAppMissing) {
      // ⛔ The `if` is load-bearing — do not "simplify" it into an
      // unconditional `setMissingRecheckRun(null)` (or the functional form
      // `run => run === null ? run : null`, which reads as if React's bailout
      // covers it). `refreshMetadata` is a dep of this effect and its identity
      // comes from the HOST's metadata context: the shipped `MetadataProvider`
      // memoizes it, but a host — or a test — that hands back a fresh function
      // each render makes this effect run after every render. With no state
      // update in the body that is a no-op; with one, it is an infinite render
      // loop, and the surface it starves is the LAZY route inside
      // `ConsoleLayout`, which then never mounts. Measured while landing
      // objectui#4522: 4250 un-acted updates in one second and a permanently
      // empty content area on `/apps/setup/system/record/workgroups`, pinned
      // now by `apps/console/src/__tests__/AppContent.systemHubRoutes.test.tsx`
      // and by the resolved-app case in this state's own test file.
      if (missingRecheckRun !== null) setMissingRecheckRun(null);
      return;
    }
    if (missingRecheck === 'idle' && !metadataLoading && !previewDrafts && appName) {
      const rechecked = appName;
      setMissingRecheckRun({ app: rechecked, phase: 'checking' });
      // Settled BY NAME rather than by the `cancelled` flag the probe below
      // uses: this effect re-runs on its own state change, so a cleanup-based
      // cancel would fire on the way out of 'checking' and strand the check
      // there forever. A refresh landing late for a previous app leaves the
      // current app's run untouched.
      Promise.resolve(refreshMetadata()).finally(() =>
        setMissingRecheckRun(run => (run?.app === rechecked ? { app: rechecked, phase: 'done' } : run)),
      );
    }
  }, [requestedAppMissing, metadataLoading, previewDrafts, missingRecheck, missingRecheckRun, appName, refreshMetadata]);

  // objectui#4252 — WHY the app is missing, once the re-check above has settled
  // and it still is. The list this reads is the generic metadata list route
  // `GET /api/v1/meta/:type`, requested with the SINGULAR type segment `app`
  // (`MetadataProvider` → `client.meta.getItems('app')`), and the server filters
  // it per session (`filterAppForUser`, `packages/rest/src/rest-server.ts`), so
  // a withheld app and a nonexistent one are byte-identical in the list: both
  // absent. Everything this component can read
  // from the list has therefore already been read, and the remaining question
  // has to be asked of the BY-NAME route, which answers it explicitly since
  // objectstack#8013 (403 `PERMISSION_DENIED` for exists-but-unauthorized; 404
  // for every kind of absence). The maintainer ruling put the answer there
  // rather than as a flag in the list, so nothing below re-reads the list.
  //
  // Only the measured verdict `denied` changes what renders. `unknown` — an
  // absent app, an unreachable server, a host that injected an adapter without
  // the probe — keeps the existing screen exactly as it is today: this fix
  // exists because the console asserted a state it had not measured, and
  // guessing in the other direction would be the same defect mirrored.
  // The verdict is stored WITH the app it describes, and read back only for
  // that app. Two missing apps in a row keep `requestedAppMissing` true the
  // whole way across, so nothing in this branch is reset by the transition — a
  // verdict held loose from its name would ride into the next URL and answer
  // for an app it never probed, telling a user their typo is a permission
  // problem. (`missingRecheck` above had the same shape and the same defect —
  // costing one skipped refresh rather than a wrong screen, which is why it was
  // filed separately; objectui#4522 keyed it the same way.)
  const [accessProbe, setAccessProbe] = useState<{ app: string; verdict: AppAccessVerdict } | null>(null);
  useEffect(() => {
    if (!requestedAppMissing || previewDrafts || missingRecheck !== 'done' || !appName) {
      // Cleared on the way out too, so the Retry button below (which returns
      // `missingRecheck` to 'idle') re-asks instead of replaying an answer.
      setAccessProbe(p => (p === null ? p : null));
      return;
    }
    if (accessProbe?.app === appName) return;
    const probe = dataSource?.probeAppAccess;
    if (typeof probe !== 'function') {
      // AGENTS #1 — the console is protocol-agnostic: a host may inject a
      // DataSource that cannot answer this. Degrade to today's copy.
      setAccessProbe({ app: appName, verdict: 'unknown' });
      return;
    }
    let cancelled = false;
    const probed = appName;
    void Promise.resolve(probe.call(dataSource, probed))
      .then(verdict => { if (!cancelled) setAccessProbe({ app: probed, verdict }); })
      .catch(() => { if (!cancelled) setAccessProbe({ app: probed, verdict: 'unknown' }); });
    return () => { cancelled = true; };
  }, [requestedAppMissing, previewDrafts, missingRecheck, appName, accessProbe, dataSource]);
  // Never the previous app's answer: while a probe for a newly-requested app is
  // in flight, this is null and the branch below waits rather than rendering the
  // one it already has.
  const accessVerdict: AppAccessVerdict | null =
    accessProbe && accessProbe.app === appName ? accessProbe.verdict : null;

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
    if (target.kind === 'none') return;
    if (target.kind === 'detail-page') {
      // The new record's detail is a fresh route carrying no `?from=` trail,
      // so on its own it renders NO back affordance — a dead-end. Thread the
      // create's originating route as a history-state `from`, mirroring
      // ObjectView's list-row navigation (which is why clicking a row DOES
      // yield a back link). The origin is a list/view route, not a record, so
      // it rides history state rather than the record-only `?from=` trail.
      const originSp = new URLSearchParams(window.location.search);
      originSp.delete(RECORD_FORM_PARAM);
      originSp.delete(RECORD_FORM_OBJECT_PARAM);
      originSp.delete(RECORD_FORM_LINK_PARAM);
      const originQs = originSp.toString();
      const originPath = `${location.pathname}${originQs ? `?${originQs}` : ''}`;
      const originLabel = objectLabel(currentObjectDef as any);
      navigate(target.url, {
        replace: true,
        state: originLabel ? { from: { pathname: originPath, label: originLabel } } : undefined,
      });
      return;
    }
    navigate(target.url, { replace: true });
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

  // objectui#5619 — `isWorkspaceAdminResolved` belongs in this readiness gate
  // for the same reason `metadataLoading` does: everything below branches on
  // the verdict. The guard at the "no active app" strand turns a `false` into a
  // `<Navigate to="/home" replace>` that the later flip to `true` cannot undo,
  // and the chrome this mounts (ConsoleLayout -> UnifiedSidebar / AppHeader)
  // reads the same verdict to decide which navigation exists. Waiting for three
  // of four inputs and acting on the fourth mid-flight is the defect itself.
  //
  // Deliberately NOT a mask over one page (objectui#5621 correctly removed the
  // last of those): this is the ONE readiness gate this surface already has,
  // and it withholds every consequence shape at once — the redirect, both
  // marketplace refusals routed below, and the nav entries.
  //
  // Cost, measured: `useWorkspaceAdminStatus` reports `isResolved` the instant
  // `isAdmin` is true, so any admin the session already identifies (the
  // `positions[]` leg, which is every admin on a session minted with an active
  // organization stamped) waits exactly zero extra frames. What does wait is
  // the viewer whose verdict genuinely is not known yet — and for them a
  // LoadingScreen is the honest frame, not a screen built on a guess.
  if (!dataSource || metadataLoading || !scopeMetaReady || !isWorkspaceAdminResolved) return <LoadingScreen />;

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
    if (missingRecheck !== 'done' || accessVerdict === null) return <LoadingScreen />;
    // objectui#4252 — the app EXISTS and this session may not open it. Say that,
    // and say it as the permanent decision it is: the old copy named a transient
    // deploy state, which sent a downstream acceptance round chasing a platform
    // defect for two test batches over a missing permission-set binding.
    //
    // No Retry here — retrying a permission decision cannot change it, and a
    // button that promises otherwise is the same misdirection one layer down.
    // The way back is `/home` instead, because this screen (like every no-app
    // surface in this file) returns ABOVE the single `ConsoleLayout` mount and
    // so carries no header, no navigation and no workspace switcher — the
    // objectui#4473 strand, which a dead end here would recreate. Router-relative
    // for the same reason as that fix: `<Navigate>`/`navigate` resolve through
    // the host's `basename`, and `/home` is part of the outer skeleton every
    // host mounting this component provides (see this file's header).
    if (accessVerdict === 'denied') {
      return (
        <div className="h-screen flex items-center justify-center">
          <Empty data-testid="app-access-denied">
            <EmptyTitle>
              {t('empty.appAccessDenied', { defaultValue: "You don't have access to this app" })}
            </EmptyTitle>
            <EmptyDescription>
              {t('empty.appAccessDeniedDescription', {
                defaultValue:
                  'This app exists, but your account is not authorized to open it. Ask an administrator to grant you access.',
              })}
            </EmptyDescription>
            <div className="mt-4">
              <Button onClick={() => navigate('/home')} data-testid="app-access-denied-home">
                {t('empty.appAccessDeniedHome', { defaultValue: 'Back to home' })}
              </Button>
            </div>
          </Empty>
        </div>
      );
    }
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
            <Button onClick={() => setMissingRecheckRun(null)} data-testid="app-not-available-retry">
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  // objectui#4473 — a viewer with NO app to enter here must not be left on a
  // chrome-less screen. The app list arrives from `GET /api/v1/meta/:type` with
  // the SINGULAR type segment `app`, and the server filters that list PER
  // SESSION (`filterAppForUser`, `packages/rest/src/rest-server.ts`), so an
  // empty list on a `member` means "nothing here is yours to open", not "this
  // workspace has no apps" — and switching
  // organization lands exactly there: `WorkspaceSwitcher` reloads onto the
  // console root, `RootLandingRedirect` resolves the landing from the app
  // metadata `MetadataProvider` seeded out of sessionStorage (the PREVIOUS
  // org's, keyed by type only), and the resulting `/apps/setup` settles with an
  // empty list. Every no-app surface in this file returns ABOVE the single
  // `ConsoleLayout` mount, so what renders has no header, no navigation and no
  // workspace switcher: no way back except editing the URL by hand.
  //
  // The bounce is role-aware because that is what the empty state below already
  // presupposes, not as a stand-in for per-app access: its copy asserts a
  // WORKSPACE-level fact ("no apps are registered") that a per-user-filtered
  // list cannot establish, and offers two actions — create an app, open system
  // settings — that a non-admin cannot perform. For a workspace admin it stays
  // the deliberate first-run surface (#3573 / #3590). For everyone else `/home`
  // is the honest destination: it renders inside the shell (top bar + workspace
  // switcher) and already carries the role-aware copy for this state ("No
  // applications yet — your workspace is being set up…", `home/HomePage.tsx`).
  // `replace`, so the strand is not left in history behind them.
  //
  // Router-relative on purpose: `<Navigate>` resolves through the host's
  // `basename`, so the console's `/_console` mount is preserved without
  // building a URL by hand (`resolveConsoleUrl` is for full-page navigations
  // that leave the router — see `organizations/resolveHomeUrl.ts`). `/home` is
  // part of the outer skeleton every host that mounts this component provides
  // (see this file's header), and `RequireAiSurface` in `ConsoleShell.tsx`
  // already bounces the same way for a surface this runtime cannot serve.
  //
  // Telling "you may not enter THIS app" apart from "this app is not published"
  // is the other half of #4473 and stays gated on the backend permission-denied
  // envelope (objectstack#8013 → objectui#4252). Nothing here waits on it: the
  // guard reads only the per-user-filtered list that ships today.
  if (!activeApp && !isCreateAppRoute && !isSystemRoute && !isMetadataRoute && !isWorkspaceAdmin) {
    return <Navigate to="/home" replace />;
  }

  if (!activeApp && !isCreateAppRoute && !isSystemRoute && !isMetadataRoute) return (
    <div className="h-screen flex items-center justify-center">
      <Empty>
        <EmptyTitle>{t('empty.noAppsConfigured')}</EmptyTitle>
        <EmptyDescription>
          {t('empty.noAppsConfiguredDescription')}
        </EmptyDescription>
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          {/* #3573 — target the APP-SCOPED route, not the host root. `create-app`
              is declared by THIS component (the no-active-app branch just below,
              and the with-app router further down), i.e. inside the
              `/apps/:appName/*` subtree — never at the root. The former absolute
              `/create-app` resolved against the HOST's root route tree, which
              declares no such path, so the host's trailing catch-all silently
              bounced the user back to the landing page: a dead first-screen CTA.
              A plain relative `navigate('create-app')` does NOT fix it either —
              react-router 7 resolves a relative `to` against the LEAF match's
              FULL pathname, splat INCLUDED (`getResolveToMatches`), so from
              `/apps/setup/<anything>` it builds `/apps/setup/<anything>/create-app`,
              which matches no route and renders a blank screen. `/apps/<segment>`
              is the platform's canonical app URL (ADR-0048) and is what every
              other navigation in this file — and AppSidebar's own add-app entry —
              builds, so build it here too. (This branch is only reachable under
              `/apps/setup…`: it requires `isSetupRoute`, the one pseudo-route the
              guard above does not exclude — so `appName` is always present here.) */}
          <Button onClick={() => navigate(`/apps/${appName}/create-app`)} data-testid="create-first-app-btn">
            {t('empty.createFirstApp')}
          </Button>
          {/* #3590 — the system hub lives at `/apps/setup/system`, NOT at the
              bare `/apps/setup`. Being inside the `/apps/:appName/*` subtree is
              necessary but NOT sufficient: `isSystemRoute` keys on a `/system`
              segment, so bare `/apps/setup` fails every pseudo-route test above
              except `isSetupRoute` and falls straight back into THIS guard —
              i.e. it is this empty state's own URL, and the click was a no-op
              loop. `/apps/setup/system` flips `isSystemRoute`, which is exactly
              the switch that mounts `extraRoutesNoApp` (the branch just below)
              where the host declares `system` → SystemHubPage. Spelled the same
              absolute way as the sidebar's whole `sys-*` cluster
              (`/apps/setup/system/...`); `appName` is provably `setup` here, so
              the two forms coincide. */}
          <Button variant="outline" onClick={() => navigate('/apps/setup/system')} data-testid="go-to-settings-btn">
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
          {/* #3610 — the legacy metadata aliases, mirrored from the with-app
              branch below. They are NOT a second copy of the page: both render
              `LegacyMetadataRedirect`, which forwards onto the canonical
              `metadata/:type…` routes declared just above. Declaring them here
              is what stopped the zero-app console rendering a blank screen: the
              fallback navigation then aimed `sys-datasources` at an alias, and
              carried `sys-objects` onto one via the host's
              `system/metadata/:type` rewrite. Both pass `isMetadataRoute` (a
              `metadata` path segment — a substring test until #3638) and so land
              in THIS branch, which declared no `component/…` route at all —
              every one of them rendered a blank screen. #3610 mirrored the
              routes rather than re-point that navigation, because inventing a
              zero-app-only spelling would have given the alias a second
              canonical destination. #3660 re-pointed `sys-datasources` anyway —
              at the shared `metadata/:type` routes above, so no second spelling
              was created — and #3739 did the same for `sys-objects` and the
              home "Manage Objects" card, whose chain had already left these two
              routes at #3658, when the host stopped rewriting onto the alias.
              What is left for these two is bookmarks and external links: the
              arrivals that can never be re-pointed. */}
          <Route path="component/metadata/directory" element={<LegacyMetadataRedirect mode="directory" />} />
          <Route path="component/metadata/resource/*" element={<LegacyMetadataRedirect mode="resource" />} />
          {extraRoutesNoApp}
          {/* #3610 — same catch-all the with-app branch has carried all along.
              A `<Routes>` with no match renders `null`, i.e. a blank page that
              is indistinguishable from a crash: no 404, no error, nothing to
              report. This branch is the one a zero-app deployment lives in, so
              it is precisely where an unresolved URL most needs to say so. */}
          <Route path="*" element={<RouteNotFound />} />
        </Routes>
      </Suspense>
    );
  }

  const expressionUser = buildExpressionUser(user);

  return (
    <ExpressionProvider user={expressionUser} app={activeApp} data={{}} features={features}>
      {/* Session scope for `{current_user_id}` / `{current_org_id}` filter
          placeholders. Mounted here rather than folded into the expression
          scope above: that one is the predicate evaluation context (it carries
          no organization), and widening it for filter resolution would couple
          two unrelated contracts. Renderer packages deliberately do not depend
          on @object-ui/auth, so the shell supplies the values (framework
          #3574). */}
      <FilterScopeProvider
        currentUserId={user?.id ?? null}
        currentOrgId={activeOrganization?.id ?? null}
      >
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
      </FilterScopeProvider>
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

// Build the per-item route segment without recursing through groups — the
// caller has already picked the item and just needs to know how to address
// it. Delegates to the layout package's resolveHref() so
// `recordId`/`recordMode`/`componentRef` semantics stay consistent with the
// sidebar.
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

/**
 * Resolves the route to navigate to when the user lands on the bare
 * `/console/apps/:appName` URL: the app's landing page is its FIRST reachable
 * navigation item, in `order` — `findFirstRoute` walks groups and skips the
 * item types that address nothing (`url`, `separator`, `action`). Which app
 * the ROOT lands on is a separate question, decided by `isDefault`.
 *
 * This used to honour an explicit `app.homePageId`. Spec 17.0.0 retired that
 * key (objectstack#4667, premise corrected in #4709 / objectui#3287): it was
 * an ID cross-reference with no referential integrity, so a dangling id fell
 * back to the first item *silently*. If the capability returns, the correct
 * encoding is a flag on the navigation item itself (`navigation[].landing`),
 * which cannot dangle — hence this function is kept as the seam even though it
 * now has a single expression.
 */
function resolveLandingRoute(activeApp: any, ctx?: NavTemplateContext): string {
  return findFirstRoute(activeApp?.navigation || [], ctx);
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
