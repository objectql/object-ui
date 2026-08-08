/**
 * AppContent — console-specific thin wrapper around DefaultAppContent.
 *
 * The full inner-SPA shell (ConsoleLayout, CommandPalette, ObjectView etc.)
 * lives in @object-ui/app-shell as DefaultAppContent. This wrapper only
 * injects console-specific system routes (SystemHub / AppManagement /
 * Profile) plus the optional legacy metadata editor — third-party hosts
 * that don't need those routes use DefaultAppContent directly.
 */

import { lazy, Suspense, useMemo } from 'react';
import { Route, useParams, useLocation, Navigate } from 'react-router-dom';
import { DefaultAppContent, LoadingScreen } from '@object-ui/app-shell';
import { MePermissionsProvider } from '@object-ui/permissions';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { LocalizationFetchProvider } from './LocalizationFetchProvider';
import {
  UploadProvider,
  createObjectStackUploadAdapter,
} from '@object-ui/providers';

const SystemHubPage = lazy(() => import('./pages/system/SystemHubPage').then(m => ({ default: m.SystemHubPage })));
const AppManagementPage = lazy(() => import('./pages/system/AppManagementPage').then(m => ({ default: m.AppManagementPage })));
const ProfilePage = lazy(() => import('./pages/system/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ApprovalsInboxPage = lazy(() => import('./pages/system/ApprovalsInboxPage').then(m => ({ default: m.ApprovalsInboxPage })));
const AiPendingActionsPage = lazy(() => import('./pages/system/AiPendingActionsPage').then(m => ({ default: m.AiPendingActionsPage })));
const AuditLogPage = lazy(() => import('./pages/system/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const SettingsHub = lazy(() => import('./pages/settings/SettingsHub').then(m => ({ default: m.SettingsHub })));
const SettingsView = lazy(() => import('./pages/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const DeveloperHubPage = lazy(() => import('./pages/developer/DeveloperHubPage').then(m => ({ default: m.DeveloperHubPage })));
const ApiConsolePage = lazy(() => import('./pages/developer/ApiConsolePage').then(m => ({ default: m.ApiConsolePage })));
const FlowRunsPage = lazy(() => import('./pages/developer/FlowRunsPage').then(m => ({ default: m.FlowRunsPage })));
const PublicFormsPage = lazy(() => import('./pages/developer/PublicFormsPage').then(m => ({ default: m.PublicFormsPage })));
const IntegrationsPage = lazy(() => import('./pages/developer/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
// ADR-0048 — package docs are viewed inside their package container:
// /apps/:packageId/docs/:name (DocPage is a default export), with an
// app-scoped index at /apps/:packageId/docs (AppDocsIndex).
const DocPage = lazy(() => import('./pages/DocPage'));
const AppDocsIndex = lazy(() => import('./pages/AppDocsIndex'));
const DocsSlug = lazy(() => import('./pages/DocsSlug'));
const DocsLayout = lazy(() => import('./pages/DocsLayout'));

// Note: marketplace routes (`system/marketplace`, `system/marketplace/:packageId`)
// are registered by DefaultAppContent in @object-ui/app-shell so they're
// available to every host (including framework/console).

/**
 * Forwards legacy `system/objects[/:objectName]` URLs to the metadata-admin
 * engine, preserving the active-app prefix. The engine routes are the
 * REST-style `…/metadata/object/:name` (edit) and `…/metadata/object` (list),
 * declared by `DefaultAppContent` in `@object-ui/app-shell`.
 *
 * NOT `…/component/metadata/resource/:name?type=object` (objectui#3639).
 * That spelling pre-dates the REST-style nesting and is no longer a page at
 * all: app-shell declares it as a legacy *alias* whose element is
 * `LegacyMetadataRedirect`, i.e. a second `<Navigate>` onto precisely the
 * target built below. Emitting it here bought a redundant hop and, worse,
 * documented the alias as if it were canonical. The alias route itself stays
 * (bookmarks and external links still land on it) — we simply stop feeding it
 * from our own code.
 */
function ObjectRedirect() {
  const { objectName } = useParams<{ objectName?: string }>();
  const location = useLocation();
  const prefix = location.pathname.replace(/\/(system\/)?objects(\/.*)?$/, '');
  const target = objectName
    ? `${prefix}/metadata/object/${objectName}`
    : `${prefix}/metadata/object`;
  return <Navigate to={target} replace />;
}

/**
 * Forwards legacy `system/metadata[/:metadataType[/:itemName]]` URLs to the
 * metadata-admin engine's own REST-style routes: `…/metadata` (directory),
 * `…/metadata/:type` (one type's list), `…/metadata/:type/:name` (one item).
 * The legacy page-based editor was removed once the server's `/api/v1/meta`
 * endpoint started emitting JSON Schema per type, letting the engine render
 * every type generically.
 *
 * Those really are the engine's routes now — unlike the `component/metadata/…`
 * spelling this used to emit, which is itself a legacy alias that only
 * `<Navigate>`s onto the same destinations (objectui#3639). Two notes on
 * staying byte-identical to what that alias hop produced: `:type` is
 * percent-encoded (the alias carried it through `?type=` and the alias hop
 * encoded it back into the path), while `:name` is passed through verbatim
 * (the alias hop forwarded its path tail untouched).
 */
function MetadataRedirect() {
  const { metadataType, itemName } = useParams<{ metadataType?: string; itemName?: string }>();
  const location = useLocation();
  // Strip an optional leading `system/` too — legacy nav uses
  // `…/system/metadata/:type`, and the engine routes live at the app root
  // (`…/metadata/…`), not under `system/`.
  const prefix = location.pathname.replace(/\/(system\/)?metadata(\/.*)?$/, '');
  const base = `${prefix}/metadata`;
  const target = !metadataType
    ? base
    : itemName
      ? `${base}/${encodeURIComponent(metadataType)}/${itemName}`
      : `${base}/${encodeURIComponent(metadataType)}`;
  return <Navigate to={target} replace />;
}

/**
 * Forwards the retired `system/{users,organizations,roles,positions,permissions}`
 * console pages onto the canonical object routes served by the generic
 * `…/:objectName` route in `@object-ui/app-shell` (objectui#3655).
 *
 * These five were real routes until `apps/console` was slimmed for third-party
 * customisation (cccdf84d7): "Delete bespoke /system/* wrapper pages
 * (User/Role/Permission/Audit/Org) … these objects are now contributed by
 * framework plugins (plugin-auth, -security, -audit) into the Setup app
 * navigation and resolved via the generic /apps/setup/<object_name> route."
 * The pages went; the URLs did not — `SystemHubPage`'s cards and both sidebars'
 * `sys-*` cluster still emit them, and so do bookmarks. Nothing declared them
 * afterwards, so they fell through to app-shell's tail and produced TWO
 * different failures depending on the word's length (`looksLikeRecordId`
 * requires 6+ chars): `users` / `roles` reached `RouteNotFound`, while
 * `organizations` / `positions` were rewritten to
 * `…/system/record/<word>` and rendered `RecordDetailView` for an
 * object literally named `system`. Both landings are measured in
 * `__tests__/AppContent.systemHubRoutes.test.tsx`.
 *
 * The object names are the framework's, not this repo's — read off
 * `platform-objects`' Setup-app navigation contributions and plugin-security's:
 *
 *   users         -> sys_user          (`nav_users`)
 *   organizations -> sys_organization  (`nav_organizations`, the LIST — the
 *                                       record-scoped `nav_organization`
 *                                       needs a runtime `{current_org_id}`
 *                                       that a static redirect cannot resolve)
 *   roles         -> sys_position      (ADR-0090 D3 renamed `sys_role` ->
 *                                       `sys_position`; the sidebar's "Roles"
 *                                       and the hub's "Positions" are the same
 *                                       surface under old/new vocabulary)
 *   positions     -> sys_position      (`nav_positions`)
 *   permissions   -> sys_permission_set(`nav_permission_sets`; this one was
 *                                       held back in PR #3673 and is resolved
 *                                       by objectui#3655's decision A — the
 *                                       reasoning is recorded at the route
 *                                       block below)
 *
 * Same shape as `ObjectRedirect` / `MetadataRedirect` above (a legacy URL is
 * translated, the page is not resurrected), including their treatment of
 * `location.search` / `location.hash`: neither is forwarded. None of these
 * URLs has ever carried one.
 */
function SystemObjectRedirect({ objectName }: { objectName: string }) {
  const location = useLocation();
  // The matched path is always `<prefix>/system/<one segment>`; anchoring at
  // the end keeps an app segment that happens to be spelled `system` intact.
  const prefix = location.pathname.replace(/\/system\/[^/]+\/?$/, '');
  return <Navigate to={`${prefix}/${objectName}`} replace />;
}

// Exported for `__tests__/AppContent.legacyRedirects.test.tsx`, which mounts
// this exact fragment in a bare `MemoryRouter` to measure the redirect chain.
// Transcribing the routes into the test instead would let the copy drift from
// the original — which is precisely how the `component/metadata/resource`
// spelling survived here long after it stopped being canonical (objectui#3639).
export const systemRoutes = (
  <>
    <Route path="system" element={<Suspense fallback={<LoadingScreen />}><SystemHubPage /></Suspense>} />
    <Route path="system/apps" element={<Suspense fallback={<LoadingScreen />}><AppManagementPage /></Suspense>} />
    <Route path="system/profile" element={<Suspense fallback={<LoadingScreen />}><ProfilePage /></Suspense>} />
    <Route path="system/approvals" element={<Suspense fallback={<LoadingScreen />}><ApprovalsInboxPage /></Suspense>} />
    <Route path="system/ai-approvals" element={<Suspense fallback={<LoadingScreen />}><AiPendingActionsPage /></Suspense>} />
    <Route path="system/audit-log" element={<Suspense fallback={<LoadingScreen />}><AuditLogPage /></Suspense>} />
    <Route path="system/settings" element={<Suspense fallback={<LoadingScreen />}><SettingsHub /></Suspense>} />
    <Route path="system/settings/:namespace" element={<Suspense fallback={<LoadingScreen />}><SettingsView /></Suspense>} />
    <Route path="developer" element={<Suspense fallback={<LoadingScreen />}><DeveloperHubPage /></Suspense>} />
    <Route path="developer/api-console" element={<Suspense fallback={<LoadingScreen />}><ApiConsolePage /></Suspense>} />
    <Route path="developer/flow-runs" element={<Suspense fallback={<LoadingScreen />}><FlowRunsPage /></Suspense>} />
    <Route path="developer/public-forms" element={<Suspense fallback={<LoadingScreen />}><PublicFormsPage /></Suspense>} />
    <Route path="developer/integrations" element={<Suspense fallback={<LoadingScreen />}><IntegrationsPage /></Suspense>} />
    {/* ADR-0048 — package docs under the package container: app-scoped index
        (/apps/:packageId/docs) + single-doc viewer (/apps/:packageId/docs/:name) */}
    {/* ADR-0046 §6 — the docs layout fetches book + doc once and shares it with
        the app-scoped index, book landings, and reader (one segment resolves to
        a book landing or redirects a flat doc to /docs/<book>/<name>). */}
    <Route path="docs" element={<Suspense fallback={<LoadingScreen />}><DocsLayout /></Suspense>}>
      <Route index element={<Suspense fallback={<LoadingScreen />}><AppDocsIndex /></Suspense>} />
      <Route path=":slug" element={<Suspense fallback={<LoadingScreen />}><DocsSlug /></Suspense>} />
      <Route path=":slug/:name" element={<Suspense fallback={<LoadingScreen />}><DocPage /></Suspense>} />
    </Route>
    {/* Legacy URL redirects → metadata-admin engine (zero-cost compatibility). */}
    <Route path="system/objects" element={<ObjectRedirect />} />
    <Route path="system/objects/:objectName" element={<ObjectRedirect />} />
    <Route path="system/metadata" element={<MetadataRedirect />} />
    <Route path="system/metadata/:metadataType" element={<MetadataRedirect />} />
    <Route path="system/metadata/:metadataType/:itemName" element={<MetadataRedirect />} />
    {/* Legacy URL redirects → the framework-owned system objects (objectui#3655).
        All five resolve now. `system/permissions` was the one held back in PR
        #3673: the framework splits what this console calls "Permissions" into
        TWO Setup entries, and picking one on a hunch would have bound every
        future click and bookmark to a surface nobody chose.

          `sys_capability`     (nav "Capabilities") — ADR-0066 layer 1, the
            DEFINITION registry of "what can be done". Its own docblock says it
            is what the ADR "loosely floats" as `sys_permission` — the name the
            retired page used — so LINEAGE points here.
          `sys_permission_set` (nav "Permission Sets") — ADR-0066 layer 2, the
            grant/assignment container the permissions docs call "the only
            capability container" (object CRUD + field security + access depth
            + system capabilities). FUNCTION points here.

        Decided as A, `sys_permission_set` (objectui#3655): the card that emits
        this URL reads "Manage permission rules and assignments", and
        rules-and-assignments is layer 2 — the definition catalog is what you
        reference BY NAME from a set, not what you assign. Deliberately a
        transitional alias: option C (retiring this bespoke card wall together
        with the hub, already `@deprecated`) stays open and does not conflict,
        because a redirect keeps old bookmarks resolving either way.

        One correction worth leaving here, since it circulated while this was
        open: the "capabilities are platform-locked, permission sets are the
        admin-CRUD one" reading does NOT survive a re-read of the framework.
        BOTH objects are `managedBy: 'config'` with `protection.lock:
        'no-overlay'`, and both docblocks say the lock is on the SCHEMA while
        tenants/admins may add rows. The layer-1 / layer-2 split above is the
        distinction that actually holds. */}
    <Route path="system/users" element={<SystemObjectRedirect objectName="sys_user" />} />
    <Route path="system/organizations" element={<SystemObjectRedirect objectName="sys_organization" />} />
    <Route path="system/roles" element={<SystemObjectRedirect objectName="sys_position" />} />
    <Route path="system/positions" element={<SystemObjectRedirect objectName="sys_position" />} />
    <Route path="system/permissions" element={<SystemObjectRedirect objectName="sys_permission_set" />} />
  </>
);

export function AppContent() {
  const serverUrl = import.meta.env.VITE_SERVER_URL || '';
  const endpoint = `${serverUrl}/api/v1/auth/me/permissions`;
  const localizationEndpoint = `${serverUrl}/api/v1/auth/me/localization`;
  // Wire ImageField / FileField / CommentAttachment to the ObjectStack
  // storage service. Memoised so the adapter (and any in-flight uploads)
  // survive re-renders of AppContent's parents.
  const uploadAdapter = useMemo(
    () => createObjectStackUploadAdapter({ baseUrl: serverUrl }),
    [serverUrl],
  );
  // [#2926 ④] /me/permissions must carry the Bearer token like every other
  // data call (same wrapper AdapterProvider uses) — with the cookie-only
  // default fetch, a token-only session resolved as anonymous and FLS
  // rendering fell open (restricted fields rendered editable).
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);
  return (
    <MePermissionsProvider
      endpoint={endpoint}
      fetcher={authFetch}
      loadingFallback={<LoadingScreen />}
      // Without this, the provider's error state renders `loadingFallback` too —
      // an eternal spinner with a `retry` nobody can reach. The provider already
      // re-attempts a transient failure (a cold environment kernel answers 503 +
      // `Retry-After` while it warms, objectstack#4159); this is what the user
      // sees once those are exhausted, and `LoadingScreen` has carried the
      // error + retry affordance all along.
      errorFallback={(err, retry) => <LoadingScreen error={err.message} onRetry={retry} />}
    >
      <LocalizationFetchProvider endpoint={localizationEndpoint}>
        <UploadProvider adapter={uploadAdapter}>
          <DefaultAppContent extraRoutes={systemRoutes} extraRoutesNoApp={systemRoutes} />
        </UploadProvider>
      </LocalizationFetchProvider>
    </MePermissionsProvider>
  );
}
