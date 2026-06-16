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
 * Forwards legacy `system/objects/:objectName` URLs to the metadata-admin
 * engine's edit route, preserving the active-app prefix. The engine route is
 * `…/component/metadata/resource/<name>?type=object`.
 */
function ObjectRedirect() {
  const { objectName } = useParams<{ objectName?: string }>();
  const location = useLocation();
  const prefix = location.pathname.replace(/\/objects(\/.*)?$/, '');
  const target = objectName
    ? `${prefix}/component/metadata/resource/${objectName}?type=object`
    : `${prefix}/component/metadata/resource?type=object`;
  return <Navigate to={target} replace />;
}

/**
 * Forwards legacy `system/metadata/:metadataType[/:itemName]` URLs to the
 * metadata-admin engine. The legacy page-based editor was removed once the
 * server's `/api/v1/meta` endpoint started emitting JSON Schema per type,
 * letting the engine render every type generically.
 */
function MetadataRedirect() {
  const { metadataType, itemName } = useParams<{ metadataType?: string; itemName?: string }>();
  const location = useLocation();
  const prefix = location.pathname.replace(/\/metadata(\/.*)?$/, '');
  const base = `${prefix}/component/metadata/resource`;
  const target = !metadataType
    ? `${prefix}/component/metadata/directory`
    : itemName
      ? `${base}/${itemName}?type=${metadataType}`
      : `${base}?type=${metadataType}`;
  return <Navigate to={target} replace />;
}

const systemRoutes = (
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
  </>
);

export function AppContent() {
  const serverUrl = import.meta.env.VITE_SERVER_URL || '';
  const endpoint = `${serverUrl}/api/v1/auth/me/permissions`;
  // Wire ImageField / FileField / CommentAttachment to the ObjectStack
  // storage service. Memoised so the adapter (and any in-flight uploads)
  // survive re-renders of AppContent's parents.
  const uploadAdapter = useMemo(
    () => createObjectStackUploadAdapter({ baseUrl: serverUrl }),
    [serverUrl],
  );
  return (
    <MePermissionsProvider endpoint={endpoint} loadingFallback={<LoadingScreen />}>
      <UploadProvider adapter={uploadAdapter}>
        <DefaultAppContent extraRoutes={systemRoutes} extraRoutesNoApp={systemRoutes} />
      </UploadProvider>
    </MePermissionsProvider>
  );
}
