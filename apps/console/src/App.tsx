/**
 * ObjectStack Console — fork-ready runtime console template.
 *
 * Owns the full route tree including unauthenticated auth surfaces
 * (login, register, forgot/reset password, verify-email, setup,
 * oauth/consent, auth/device, accept-invitation). The legacy Account
 * SPA at `/_account/*` is being retired — these routes now live here
 * in the Console SPA so a single bundle covers the whole experience.
 *
 * Console-specific extras (system / settings / legacy metadata editor)
 * are injected via {@link AppContent}, which wraps `DefaultAppContent`
 * with extra `<Route>` children.
 */

import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, AuthGuard, useAuth } from '@object-ui/auth';
import { DevMasterDetail } from './dev/DevMasterDetail';
import { DevLists } from './dev/DevLists';
import { DevModal } from './dev/DevModal';
import { DevLookup } from './dev/DevLookup';
import {
  ConsoleShell,
  ConnectedShell,
  RequireOrganization,
  SystemRedirect,
  LoadingFallback,
  ConsoleToaster,
  DefaultHomeLayout,
  DefaultHomePage,
  DefaultOrganizationsLayout,
  DefaultOrganizationsPage,
  DefaultOrganizationLayout,
  DefaultMembersPage,
  DefaultInvitationsPage,
  DefaultSettingsPage,
  DefaultAiChatPage,
} from '@object-ui/app-shell';

import { AppContent } from './AppContent';
import { CloudAwareRootRedirect } from './components/CloudAwareRootRedirect';
import { FormPage } from './components/FormPage';
import { MetadataHmrReloader } from './components/MetadataHmrReloader';
import SharedRecordPage from './pages/SharedRecordPage';
import DocPage from './pages/DocPage';
import DocsIndex from './pages/DocsIndex';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { SetPasswordPage } from './pages/auth/SetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { VerifyEmailPromptPage } from './pages/auth/VerifyEmailPromptPage';
import { SetupPage } from './pages/auth/SetupPage';
import { OAuthConsentPage } from './pages/auth/OAuthConsentPage';
import { DeviceAuthPage } from './pages/auth/DeviceAuthPage';
import { AcceptInvitationPage } from './pages/auth/AcceptInvitationPage';

const AUTH_URL = `${import.meta.env.VITE_SERVER_URL || ''}/api/v1/auth`;

/**
 * Resolve the React Router basename from an explicit `<base href>` tag.
 *
 * The published Console build uses a relative Vite base (`./`) so the
 * same `dist/` works under any mount path. Hosts that embed the SPA
 * inject a `<base href="/path/">` into the served HTML (the framework
 * CLI does this automatically); standalone / dev runs have no `<base>`
 * and fall back to `'/'`.
 *
 * **Do not use `document.baseURI`** — when no `<base>` tag is present
 * it returns the *current document URL*, which would make the router
 * treat e.g. `/home` as its basename and cascade into `/home/home/home`
 * on every subsequent navigation.
 */
function resolveBasename(): string {
  try {
    if (typeof document === 'undefined') return '/';
    const baseEl = document.querySelector('base');
    const href = baseEl?.getAttribute('href');
    if (!href) return '/';
    const url = new URL(href, window.location.origin);
    const path = url.pathname.replace(/\/$/, '');
    return path || '/';
  } catch {
    return '/';
  }
}

const BASENAME = resolveBasename();

/**
 * ProtectedRoute — replaces app-shell's AuthenticatedRoute. Same composition
 * (AuthGuard + ConnectedShell + optional RequireOrganization) but redirects
 * unauthenticated visitors to the Console-hosted /login (preserving the
 * original Console path as `?redirect=…`).
 */
function LoginRedirect() {
  const location = useLocation();
  const redirect = location.pathname + location.search;
  const search = redirect && redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : '';
  return <Navigate to={`/login${search}`} replace />;
}

function ProtectedRoute({
  children,
  requireOrganization = true,
}: {
  children: ReactNode;
  requireOrganization?: boolean;
}) {
  return (
    <AuthGuard fallback={<LoginRedirect />} loadingFallback={<LoadingFallback />}>
      <ConnectedShell>
        {requireOrganization ? <RequireOrganization>{children}</RequireOrganization> : children}
      </ConnectedShell>
    </AuthGuard>
  );
}

/** Wraps `DefaultHomeLayout` so the FAB gets the signed-in user id. */
function HomeRoute() {
  const { user } = useAuth();
  return (
    <DefaultHomeLayout userId={user?.id}>
      <DefaultHomePage />
    </DefaultHomeLayout>
  );
}

export function App() {
  return (
    <AuthProvider authUrl={AUTH_URL}>
      <ConsoleToaster position="bottom-right" />
      <MetadataHmrReloader />
      <BrowserRouter basename={BASENAME}>
        <ConsoleShell>
          <Routes>
            {/*
              * Public auth surfaces — render OUTSIDE ProtectedRoute so
              * unauthenticated visitors can reach them. Each page handles
              * its own redirect-once-authenticated logic.
              */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/*
              * Set an initial local password after SSO-as-owner entry on a
              * per-environment runtime. Public (session cookie already set by
              * the cloud sso-exchange) + shell-less, like the other auth
              * surfaces — see SetPasswordPage. The cloud auth-proxy redirects
              * here as `/set-password?next=…`.
              */}
            <Route path="/set-password" element={<SetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-email-prompt" element={<VerifyEmailPromptPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/oauth/consent" element={<OAuthConsentPage />} />
            <Route path="/auth/device" element={<DeviceAuthPage />} />
            <Route
              path="/accept-invitation/:invitationId"
              element={<AcceptInvitationPage />}
            />
            {/*
              * Public anonymous form — rendered OUTSIDE ProtectedRoute so
              * unauthenticated visitors can submit. The slug maps 1:1 to a
              * FormView whose `sharing.allowAnonymous === true`.
              */}
            <Route path="/f/:slug" element={<FormPage mode="public" />} />
            {/*
              * Public capability-token landing page. Lives outside
              * ProtectedRoute so anonymous visitors can open a share
              * link. The page itself talks directly to the framework
              * REST API and renders a read-only view.
              */}
            <Route path="/s/:token" element={<SharedRecordPage />} />
            {/* Internal authed form — same renderer, different submit path. */}
            <Route path="/forms/:name" element={
              <ProtectedRoute>
                <FormPage mode="internal" />
              </ProtectedRoute>
            } />
            {/* Package documentation (ADR-0046): a platform-level portal
              * lists every installed `doc` (grouped by package), and one
              * viewer route renders any item; cross-references between docs
              * resolve to that same viewer route. Both are app-independent. */}
            <Route path="/docs" element={
              <ProtectedRoute>
                <DocsIndex />
              </ProtectedRoute>
            } />
            <Route path="/docs/:name" element={
              <ProtectedRoute>
                <DocPage />
              </ProtectedRoute>
            } />
            <Route path="/home" element={
              <ProtectedRoute>
                <HomeRoute />
              </ProtectedRoute>
            } />
            {/* Dev-only: ADR-0001 master-detail subform verification harness. */}
            <Route path="/dev/master-detail" element={
              <ProtectedRoute>
                <DevMasterDetail />
              </ProtectedRoute>
            } />
            {/* Dev-only: lightweight list primitives (definition-list, repeater). */}
            <Route path="/dev/lists" element={
              <ProtectedRoute>
                <DevLists />
              </ProtectedRoute>
            } />
            {/* Dev-only: action modal transport (center/side/bottom/fullscreen). */}
            <Route path="/dev/modal" element={
              <ProtectedRoute>
                <DevModal />
              </ProtectedRoute>
            } />
            {/* Dev-only: line-item grid with a lookup cell. */}
            <Route path="/dev/lookup" element={
              <ProtectedRoute>
                <DevLookup />
              </ProtectedRoute>
            } />
            <Route path="/organizations" element={
              <ProtectedRoute requireOrganization={false}>
                <DefaultOrganizationsLayout><DefaultOrganizationsPage /></DefaultOrganizationsLayout>
              </ProtectedRoute>
            } />
            {/*
              * Organization management — single-org admin surface reached
              * from the "Manage" button on the organizations list. The
              * layout resolves the org by `:slug`, makes it active, and
              * renders Members / Invitations / Settings tabs into its
              * Outlet. `requireOrganization={false}` because the layout
              * itself drives org activation from the slug.
              */}
            <Route path="/organizations/:slug" element={
              <ProtectedRoute requireOrganization={false}>
                <DefaultOrganizationLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="members" replace />} />
              <Route path="members" element={<DefaultMembersPage />} />
              <Route path="invitations" element={<DefaultInvitationsPage />} />
              <Route path="settings" element={<DefaultSettingsPage />} />
            </Route>
            <Route path="/system/*" element={<SystemRedirect />} />
            <Route path="/ai" element={
              <ProtectedRoute>
                <DefaultAiChatPage />
              </ProtectedRoute>
            } />
            <Route path="/ai/:conversationId" element={
              <ProtectedRoute>
                <DefaultAiChatPage />
              </ProtectedRoute>
            } />
            <Route path="/apps/:appName/*" element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            } />
            <Route path="/" element={<ConnectedShell><CloudAwareRootRedirect /></ConnectedShell>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConsoleShell>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Re-export AppContent so tests/extenders that import { AppContent } from './App'
// keep working.
export { AppContent } from './AppContent';
