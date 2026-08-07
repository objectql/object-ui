// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * No-apps empty state — "Create Your First App" must reach the DECLARED
 * create-app route (objectui#3573).
 *
 * ## Measured URL shapes (why the entries below are the real-world ones)
 *
 * `AppContent` is mounted by the reference host at ONE place only —
 * `apps/console/src/App.tsx`: `<Route path="/apps/:appName/*" />`. The empty
 * state's precondition (`AppContent.tsx`, the `!activeApp && !isCreateAppRoute
 * && !isSystemRoute && !isMetadataRoute` guard) can therefore only be reached
 * when the `:appName` segment did NOT resolve to an app AND the URL is one of
 * the built-in pseudo-routes (otherwise `requestedAppMissing` short-circuits to
 * the "App not available" screen instead). Subtracting the three pseudo-routes
 * the guard itself excludes leaves exactly one family:
 *
 *     /apps/setup                 and   /apps/setup/<anything not
 *                                       system|metadata|create-app>
 *
 * which is precisely where the sidebar's no-active-app system navigation and
 * the empty state's own `go-to-settings-btn` send a zero-app user
 * (`layout/AppSidebar.tsx` systemFallbackNavigation → `/apps/setup`).
 *
 * `/` is NOT such a URL: with zero apps `RootLandingRedirect` resolves to
 * `/home` and `AppContent` never mounts. So the empty state always renders
 * INSIDE the `/apps/:appName/*` subtree — which is what makes a relative
 * navigation well-founded, and is pinned by the last test here.
 *
 * ## What the fix is (and why the obvious relative form is NOT it)
 *
 * The CTA used to call `navigate('/create-app')` — absolute, so it resolved
 * against the ROOT route tree, which declares no such path; the host's trailing
 * `<Route path="*">` bounced the user to `/`. The `create-app` route is
 * declared by `AppContent` itself (both the no-active-app branch and the
 * with-app branch), i.e. INSIDE the `/apps/:appName/*` subtree.
 *
 * MEASURED, against the installed react-router 7.18: a plain relative
 * `navigate('create-app')` does NOT fix this. `getResolveToMatches` gives the
 * LEAF match's FULL `pathname` — splat INCLUDED — as the resolution base (in
 * v6 this was the `v7_relativeSplatPath` future flag; v7 hardcodes it). So the
 * relative form is depth-dependent: right at `/apps/setup`, but from
 * `/apps/setup/sys_inbox_message` it builds
 * `/apps/setup/sys_inbox_message/create-app`, which matches no route inside the
 * no-active-app `<Routes>` and renders a BLANK screen. The two CTA tests below
 * cover both depths precisely so that trap stays pinned.
 *
 * The fix therefore builds the app-scoped URL `/apps/<segment>/create-app` —
 * the platform's canonical app URL contract (ADR-0048, `utils/appRoute.ts`),
 * the same target `layout/AppSidebar.tsx`'s add-app entry already builds, and
 * the same base every other navigation in `AppContent.tsx` uses.
 *
 * NOTE ON SCOPE: `@object-ui/plugin-designer` is stubbed below — this file
 * measures ROUTING (which route matches, which URL results), not the app
 * designer's internals.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — providers and the lazily-imported designer pages. Everything that
// takes part in the ROUTING decision (AppContent's own guards, its nested
// <Routes>, react-router's relative resolution) stays real.
// ---------------------------------------------------------------------------

// The CTA's target sits behind `React.lazy(() => import('@object-ui/plugin-designer'))`.
// Stubbing it keeps the assertion off the transform pipeline entirely (AGENTS.md
// §测试纪律: never let an unbounded module load race a bounded `findBy` window).
vi.mock('@object-ui/plugin-designer', () => ({
  CreateAppPage: () => <div data-testid="create-app-page">create app</div>,
  EditAppPage: () => <div data-testid="edit-app-page" />,
  DashboardDesignPage: () => <div data-testid="dashboard-design-page" />,
}));

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
  useObjectLabel: () => ({
    objectLabel: ({ label }: { label?: string }) => label,
  }),
}));

vi.mock('@object-ui/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({
    user: null,
    getAuthConfig: async () => ({ features: {} }),
    activeOrganization: null,
  }),
  useIsWorkspaceAdmin: () => false,
}));

const dataSourceStub = {
  onConnectionStateChange: () => () => {},
  getConnectionState: () => 'connected',
};
vi.mock('../../providers/AdapterProvider', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAdapter: () => dataSourceStub,
}));

/** The zero-app deployment this whole screen exists for. */
const NO_APPS: unknown[] = [];
const refreshMetadata = vi.fn(async () => {});
vi.mock('../../providers/MetadataProvider', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadata: () => ({
    apps: NO_APPS,
    objects: [],
    loading: false,
    // `undefined` — no bucket preloading to await, so the shell is ready on
    // first render (mirrors a host that ships metadata eagerly).
    ensureType: undefined,
    error: null,
    refresh: refreshMetadata,
  }),
}));

const actionRunnerStub = { registerHandler: vi.fn(), getContext: () => ({}) };
vi.mock('@object-ui/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useActionRunner: () => ({ execute: vi.fn(), runner: actionRunnerStub }),
  useGlobalUndo: () => {},
  useMutationInvalidationBridge: () => {},
}));

import { AppContent } from '../AppContent';

/** Reports the live URL so a bounce is visible as a URL, not just a screen. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

/**
 * The reference host's route tree, reduced to the parts that decide this
 * question: the `/apps/:appName/*` subtree, the landing route, and the
 * trailing catch-all that used to swallow `/create-app`.
 * Mirrors `apps/console/src/App.tsx`.
 */
function renderConsoleAt(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <LocationProbe />
      <Routes>
        <Route path="/apps/:appName/*" element={<AppContent />} />
        <Route path="/" element={<div data-testid="root-landing">landing</div>} />
        <Route path="/home" element={<div data-testid="home-launcher">home</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>,
  );
}

const pathname = () => screen.getByTestId('pathname').textContent;

describe('AppContent — no-apps empty state CTA (objectui#3573)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state at /apps/setup — the measured entry URL', async () => {
    renderConsoleAt('/apps/setup');
    expect(await screen.findByTestId('create-first-app-btn')).toBeInTheDocument();
  });

  it('renders it deeper in the same pseudo-route subtree too', async () => {
    renderConsoleAt('/apps/setup/sys_inbox_message');
    expect(await screen.findByTestId('create-first-app-btn')).toBeInTheDocument();
  });

  it('CTA opens the declared create-app route instead of bouncing to the landing page', async () => {
    renderConsoleAt('/apps/setup');
    fireEvent.click(await screen.findByTestId('create-first-app-btn'));

    expect(await screen.findByTestId('create-app-page')).toBeInTheDocument();
    expect(pathname()).toBe('/apps/setup/create-app');
    // The regression this pins: the absolute `/create-app` matched no root
    // route, so the host's `<Route path="*">` replaced it with `/`.
    expect(screen.queryByTestId('root-landing')).not.toBeInTheDocument();
  });

  it('resolves from a deeper splat URL to the SAME create-app route', async () => {
    // The depth trap: react-router 7 resolves a relative `to` against the leaf
    // match's full pathname (splat included), so a relative `create-app` would
    // build `/apps/setup/sys_inbox_message/create-app` here — matching nothing,
    // rendering blank. The splat segment must NOT reach the target URL.
    renderConsoleAt('/apps/setup/sys_inbox_message');
    fireEvent.click(await screen.findByTestId('create-first-app-btn'));

    expect(await screen.findByTestId('create-app-page')).toBeInTheDocument();
    expect(pathname()).toBe('/apps/setup/create-app');
    expect(screen.queryByTestId('root-landing')).not.toBeInTheDocument();
  });

  it('leaves the sibling go-to-settings CTA on its absolute /apps/setup target', async () => {
    renderConsoleAt('/apps/setup/sys_inbox_message');
    fireEvent.click(await screen.findByTestId('go-to-settings-btn'));

    expect(pathname()).toBe('/apps/setup');
    expect(screen.queryByTestId('root-landing')).not.toBeInTheDocument();
    // NB: this asserts CURRENT behaviour, it does not bless it. `/apps/setup`
    // bare IS this empty state's own URL (`isSystemRoute` needs a `/system`
    // segment), so on a zero-app deployment this sibling CTA is a no-op loop —
    // filed separately as #3590. Kept here only to prove the #3573 fix did not
    // touch it; update this expectation together with #3590.
    expect(await screen.findByTestId('create-first-app-btn')).toBeInTheDocument();
  });

  it('MEASUREMENT: a non-pseudo /apps/:appName URL never reaches this empty state', async () => {
    // Evidence for the URL-family claim in the file header: an unresolved app
    // segment that is not a pseudo-route takes the "App not available" branch,
    // so `/apps/setup*` really is the only family the CTA has to work from.
    renderConsoleAt('/apps/crm');
    expect(await screen.findByTestId('app-not-available-retry')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('create-first-app-btn')).not.toBeInTheDocument();
    });
  });
});
