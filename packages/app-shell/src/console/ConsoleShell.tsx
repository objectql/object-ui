/**
 * Console building blocks — composable JSX elements that consumers assemble in
 * their own App.tsx to build the console routing tree.
 *
 * Previously this module exported a `createConsole(config)` factory that hid the
 * routing tree behind a config object. In practice every real project wants to
 * edit the routes directly (add /billing, tweak AuthGuard behaviour, reorder
 * providers), so we now export the pieces and let consumers write ~40 lines of
 * JSX in App.tsx. See examples/console-starter/src/App.tsx for a minimal example,
 * apps/console/src/App.tsx for one with custom system routes + CreateApp.
 */

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthGuard, useAuth, createAuthenticatedFetch } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import { SchemaRendererProvider, ActionProvider, NotificationProvider } from '@object-ui/react';
import { NotificationAlerts, NotificationSnackbar } from '@object-ui/components';
import { presentNotificationToast } from '../chrome/notificationToast';
import { useActionModal } from '../hooks/useActionModal';
import { useConsoleActionRuntime } from '../hooks/useConsoleActionRuntime';
import { createObjectStackUserStateAdapter } from '@object-ui/data-objectstack';
import { AdapterProvider, useAdapter } from '../providers/AdapterProvider';
import { withSettleSignal } from '../observability/settleSignal';
import { MetadataProvider, useMetadata } from '../providers/MetadataProvider';
import { useAiSurfaceEnabled } from '../hooks/useAiSurface';
import { PreviewModeProvider } from '../preview/PreviewModeContext';
import { NavigationProvider } from '../context/NavigationContext';
import { FavoritesProvider } from '../context/FavoritesProvider';
import { RecentItemsProvider } from '../context/RecentItemsProvider';
import { FlowPaletteRecentsProvider } from '../context/FlowPaletteRecentsProvider';
import {
  UserStateAdaptersProvider,
  useAttachUserStateAdapters,
} from '../context/UserStateAdapters';
import { ThemeProvider } from '../chrome/ThemeProvider';
import { LoadingScreen } from '../chrome/LoadingScreen';
import { RemediationOverlay } from './RemediationOverlay';

// The console's every pre-React / pre-auth gate (Suspense fallback, adapter
// not ready, org/auth loading) renders this. It used to be a bare, unbranded
// "Loading…" line — ~8s of blank chrome before the login redirect on a cold
// /_console load (framework#2615 P3). Delegate to the branded, boot-safe
// splash (logo + product name + step list) that the rest of the shell already
// uses, so the cold load looks like the product from the first frame.
export function LoadingFallback() {
  return <LoadingScreen />;
}

/**
 * The console ROOT action runtime — the same level the global
 * SchemaRendererProvider (dataSource) sits, so it reaches EVERY field widget,
 * including a relation field inside a create/edit form that renders in a Radix
 * Dialog portal (which sits above the lower per-view ActionProviders).
 *
 * It started as a modal-only provider (what lets a lookup's inline "create the
 * referenced record" open that object's OWN create form). But an
 * `ActionProvider` also decides what a `useAction()` consumer BELOW it can
 * dispatch, and this one carried no `handlers` map — so every `action:button`
 * outside ObjectView / RecordDetailView / PageView / DeclaredActionsBar bound
 * to a runner that could only open modals. A `type: 'flow'` action there failed
 * with "Flow handler not registered", which is one way a screen flow becomes
 * unlaunchable (framework#3528); `api` and `script` were equally dead.
 *
 * It now carries the shared console runtime's api / flow / script handlers and
 * its confirm / param / result / screen-flow dialogs, so those action types
 * work anywhere by default. Richer per-view providers still override it where
 * they apply.
 *
 * `modal` deliberately stays on the CLIENT-side `useActionModal` handler rather
 * than the runtime's server-action mapping: a modal action at this level is the
 * inline-create affordance above, not a server endpoint. Registering it in
 * `handlers` would take precedence over `onModal` and reroute those clicks to
 * `/api/v1/actions/...`.
 *
 * Must render inside MetadataProvider (useActionModal reads useMetadata).
 */
function GlobalActionRuntimeProvider({ dataSource, children }: { dataSource: unknown; children: ReactNode }) {
  const { modalHandler, modalElement } = useActionModal(dataSource);
  const runtime = useConsoleActionRuntime({ dataSource });
  return (
    <ActionProvider
      context={runtime.actionProviderProps.context}
      onConfirm={runtime.actionProviderProps.onConfirm}
      onToast={runtime.actionProviderProps.onToast}
      onNavigate={runtime.actionProviderProps.onNavigate}
      onParamCollection={runtime.actionProviderProps.onParamCollection}
      onResultDialog={runtime.actionProviderProps.onResultDialog}
      onModal={modalHandler}
      handlers={{
        api: runtime.apiHandler,
        flow: runtime.flowHandler,
        script: runtime.serverActionHandler,
      }}
    >
      {children}
      {runtime.dialogs}
      {modalElement}
    </ActionProvider>
  );
}

/**
 * ConsoleShell — top-level provider stack shared by every console route.
 * Wraps children in ThemeProvider + NavigationProvider + FavoritesProvider +
 * NotificationProvider + Suspense so lazy route components get a default
 * loading fallback, dark/light/system theme switching, and a notification
 * system that honors the spec `displayType`.
 *
 * Place this inside a <BrowserRouter> and around your <Routes>:
 *
 *   <BrowserRouter>
 *     <ConsoleShell>
 *       <Routes>...</Routes>
 *     </ConsoleShell>
 *   </BrowserRouter>
 *
 * ── Notification surfaces (#3014) ──
 * Each spec display type has its own presentation, so the shell mounts the ones
 * with a single global home and leaves the rest to their owners:
 *
 *   toast     → `presentNotificationToast` (sonner, via `onToast`)
 *   snackbar  → <NotificationSnackbar />   here — it anchors itself bottom-center
 *   alert     → <NotificationAlerts />     here — a blocking dialog is global
 *   banner    → <NotificationBanners />    in `ConsoleLayout`, at the top of the
 *                                          content area, next to the draft /
 *                                          unpublished bars it sits with
 *   inline    → nothing here, by contract — an inline notification is rendered
 *               by the surface that RAISED it (`<NotificationInline scope=…/>`),
 *               which is the whole difference between it and a banner
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="object-ui-theme">
      {/* `defaultDuration` matches ConsoleToaster's 4s toast default and
          `maxVisible` its `visibleToasts={4}`, so a snackbar and a toast raised
          together disappear together and the banner stack caps like the toast
          stack. No `defaultPosition`: nothing declared means the sonner
          container keeps placing toasts (it also serves the console's direct
          `toast.*` calls) and the snackbar keeps its own bottom anchor — a
          notification that DECLARES a position still overrides both. */}
      <NotificationProvider config={{ defaultDuration: 4000, maxVisible: 4 }} onToast={presentNotificationToast}>
        <NavigationProvider>
          <UserStateAdaptersProvider>
            <FavoritesProvider>
              <RecentItemsProvider>
                <FlowPaletteRecentsProvider>
                  <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
                  {/* ADR-0069 — full-screen gate (expired password / required MFA) above all routes */}
                  <RemediationOverlay />
                  <NotificationSnackbar />
                  <NotificationAlerts />
                </FlowPaletteRecentsProvider>
              </RecentItemsProvider>
            </FavoritesProvider>
          </UserStateAdaptersProvider>
        </NavigationProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

/**
 * ConnectedShell — mounts the data layer (AdapterProvider + MetadataProvider).
 * Use this around any route element that needs metadata access, i.e. anything
 * rendering objects / dashboards / pages.
 */
export function ConnectedShell({ children }: { children: ReactNode }) {
  return (
    <AdapterProvider>
      {/* ADR-0037: one URL flag (?preview=draft) flips the whole metadata
          tree below into the draft-overlaid world. Above MetadataProvider so
          the provider itself reads through the right source. */}
      <PreviewModeProvider>
        <ConnectedShellInner>{children}</ConnectedShellInner>
      </PreviewModeProvider>
    </AdapterProvider>
  );
}

// Authenticated fetch for `provider: 'api'` view data sources (#2725): custom
// endpoints get the same Authorization / X-Tenant-ID / Accept-Language headers
// as the native adapter channel, so a cookie whose HMAC signature rotated
// (e.g. dev-server restart) no longer strands them on 401. `sameOriginOnly`
// keeps the bearer token off third-party hosts a view's URL may point at, and
// withSettleSignal keeps these requests visible to the ADR-0054 C5 idle probe.
const apiProviderFetch = withSettleSignal(createAuthenticatedFetch({ sameOriginOnly: true }));

function ConnectedShellInner({ children }: { children: ReactNode }) {
  const adapter = useAdapter();
  const { language } = useObjectTranslation();
  // ── Session gate (objectui#4042) ──
  //
  // Everything below this line reads `/api/v1/meta/*`, which requires a
  // session. Mounting the metadata tree while `GET /auth/get-session` is still
  // in flight fires `meta/object` + `meta/view` + `meta/app` blind: on an
  // unauthenticated visitor they all come back 401, and the console's landing
  // route (`<Route path="/">`) mounts this shell with no AuthGuard above it, so
  // simply opening `/_console/` produced a screenful of red `HTTP request
  // failed` before the login form was even drawn.
  //
  // Waiting for auth to RESOLVE is the whole gate. We deliberately do not gate
  // on `isAuthenticated`: a consumer that mounts ConnectedShell outside an
  // AuthGuard still renders through once the session answer is known (unchanged
  // behaviour, including a legitimate 401 that must stay visible), and the
  // console's own login bounce is the route guard's job. `useAuth()` outside an
  // AuthProvider reports `isLoading: false`, so a provider-less embed is
  // untouched.
  //
  // Post-login flow is unchanged — AuthGuard already withholds every protected
  // route until auth resolves, so on those routes this gate is already open by
  // the time the shell mounts and the same queries fire, once each.
  const { isLoading: isAuthLoading } = useAuth();

  // ── Language switch → relabel without a page refresh (issue #1319) ──
  //
  // Static UI strings already flip reactively through react-i18next, and
  // metadata labels that have a translation key resolve client-side via
  // `useObjectLabel`. The gap is *server-resolved* labels (object/field/view
  // labels, action-dialog text) with no client key: renderers fetch those into
  // local state keyed by object name, so they never re-fetch on a language
  // change and the UI ends up half-translated until a hard refresh.
  //
  // We close the gap in two moves, both keyed off `language`:
  //   1. Drop the adapter's locale-blind metadata cache (render phase, before
  //      any child re-fetches) so the next read hits the network. This runs in
  //      render — not an effect — because the remount below mounts children
  //      (and their fetch effects) before a parent effect here would fire, so
  //      an effect-based clear would race and serve the stale entry.
  //   2. Remount the metadata subtree via `key={language}` so every renderer's
  //      fetch effect re-runs; combined with the new `Accept-Language` header
  //      (see `createAuthenticatedFetch`) the refetch comes back in the new
  //      locale. The adapter — and its live connection — sits above the key and
  //      is preserved, so this is an in-app relabel, not a reconnect.
  const lastLanguage = useRef<string | null>(null);
  if (adapter && lastLanguage.current !== null && lastLanguage.current !== language) {
    adapter.clearCache?.();
  }
  if (adapter) lastLanguage.current = language;

  if (!adapter || isAuthLoading) return <LoadingFallback />;
  // Expose the adapter via SchemaRendererContext so descendant hooks like
  // useDiscovery() (used to gate the global AI chatbot) can resolve it.
  return (
    <SchemaRendererProvider dataSource={adapter} apiFetch={apiProviderFetch}>
      <MetadataProvider key={language} adapter={adapter}>
        <UserStateBridge />
        <GlobalActionRuntimeProvider dataSource={adapter}>
          {children}
        </GlobalActionRuntimeProvider>
      </MetadataProvider>
    </SchemaRendererProvider>
  );
}

/**
 * UserStateBridge — once we have an authenticated user + a connected data
 * adapter, plug ObjectStack-backed persistence into the favorites and
 * recent-items providers. Renders nothing.
 *
 * Failure modes (object schema not configured, network errors, etc.) are
 * absorbed by the adapter itself — the UI then transparently falls back to
 * localStorage-only behaviour.
 */
function UserStateBridge() {
  const { user } = useAuth();
  const dataSource = useAdapter();
  const attach = useAttachUserStateAdapters();

  useEffect(() => {
    if (!user?.id || !dataSource) {
      attach('favorites', null);
      attach('recent', null);
      attach('flowPaletteRecents', null);
      return;
    }
    const favorites = createObjectStackUserStateAdapter({
      dataSource,
      userId: user.id,
      key: 'ui.favorites',
    });
    const recent = createObjectStackUserStateAdapter({
      dataSource,
      userId: user.id,
      key: 'ui.recent',
    });
    const flowPaletteRecents = createObjectStackUserStateAdapter<string>({
      dataSource,
      userId: user.id,
      key: 'ui.flow.palette.recents',
    });
    attach('favorites', favorites);
    attach('recent', recent);
    attach('flowPaletteRecents', flowPaletteRecents);
    return () => {
      attach('favorites', null);
      attach('recent', null);
      attach('flowPaletteRecents', null);
    };
  }, [user?.id, dataSource, attach]);

  return null;
}

/**
 * RequireOrganization — redirects to /organizations when the multi-tenant
 * feature is enabled (user has orgs but no active one). Single-tenant
 * deployments (empty organizations list) render through.
 */
export function RequireOrganization({ children }: { children: ReactNode }) {
  const { activeOrganization, organizations, isOrganizationsLoading, getAuthConfig } = useAuth();
  // Multi-org (cloud) deployments route a brand-new, org-less user into the
  // guided "Create your workspace" flow; single-tenant self-host renders through.
  const [multiOrgEnabled, setMultiOrgEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then((cfg: any) => { if (!cancelled) setMultiOrgEnabled(cfg?.features?.multiOrgEnabled !== false); })
      .catch(() => { if (!cancelled) setMultiOrgEnabled(false); });
    return () => { cancelled = true; };
  }, [getAuthConfig]);
  if (isOrganizationsLoading) return <LoadingFallback />;
  const orgList = organizations ?? [];
  const orgFeatureEnabled = orgList.length > 0 || !!activeOrganization;
  if (orgFeatureEnabled && !activeOrganization) return <Navigate to="/organizations" replace />;
  // No org at all: on multi-org, send them to /organizations (the create
  // screen); wait for the flag so we don't flash /home then redirect.
  if (orgList.length === 0 && !activeOrganization) {
    if (multiOrgEnabled === null) return <LoadingFallback />;
    if (multiOrgEnabled) return <Navigate to="/organizations" replace />;
  }
  return <>{children}</>;
}

/**
 * RequireAiSurface — gate for the `/ai*` routes. The console is edition-agnostic
 * (MIT, runtime-gated): a Community Edition runtime serves no AI agent, so a
 * stale `/ai` bookmark or external link must not land on a broken/empty chat.
 * When the server serves no agent it redirects to `redirectTo` (home) instead.
 *
 * Availability is the live agent catalog (see {@link useAiSurfaceEnabled}) — the
 * same signal every other AI entry point now gates on, so the route is reachable
 * from exactly the entry points that are visible (no shown CTA that bounces back
 * to home, no hidden FAB to a working route). Waits for the catalog to resolve
 * before deciding so the redirect never flashes on first paint.
 */
export function RequireAiSurface({
  children,
  redirectTo = '/home',
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const { enabled, isLoading } = useAiSurfaceEnabled();
  if (isLoading) return <LoadingFallback />;
  if (!enabled) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

/**
 * AuthenticatedRoute — convenience wrapper composing AuthGuard + ConnectedShell
 * (+ optional RequireOrganization). Covers the common case for protected
 * routes. For bespoke needs, compose the primitives directly.
 */
export function AuthenticatedRoute({
  children,
  requireOrganization = true,
  loginPath = '/login',
}: {
  children: ReactNode;
  requireOrganization?: boolean;
  loginPath?: string;
}) {
  return (
    <AuthGuard fallback={<Navigate to={loginPath} />} loadingFallback={<LoadingFallback />}>
      <ConnectedShell>
        {requireOrganization ? <RequireOrganization>{children}</RequireOrganization> : children}
      </ConnectedShell>
    </AuthGuard>
  );
}

/**
 * RootRedirect — element for <Route path="/" />. Waits for metadata to load
 * then sends the user to /home.
 */
export function RootRedirect() {
  const { loading } = useMetadata();
  if (loading) return <LoadingFallback />;
  return <Navigate to="/home" replace />;
}

/**
 * SystemRedirect — forwards legacy /system/* URLs to the canonical
 * /apps/setup/system/* location so bookmarks keep working. Suffix is preserved.
 *
 * #3611 — the bare `/system` bookmark used to land on the bare `/apps/setup`,
 * which on a zero-app deployment is the "No Apps Configured" empty state's own
 * URL. Every suffixed bookmark was already forwarded to `/apps/setup/system…`;
 * the bare one now agrees with them instead of dropping the `system` segment
 * that makes the hub mount at all.
 */
export function SystemRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/system/, '');
  const target = suffix ? `/apps/setup/system${suffix}` : '/apps/setup/system';
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}
