// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Zero-app console: the `component/metadata/*` destinations must resolve, and
 * anything unmatched must say so (objectui#3610).
 *
 * ## The defect
 *
 * With zero published apps, the system fallback sidebar offers two entries that
 * both land inside `AppContent`'s no-`activeApp` branch:
 *
 *     sys-datasources -> /apps/setup/component/metadata/resource?type=datasource
 *     sys-objects     -> /apps/setup/system/metadata/object
 *
 * `isMetadataRoute` is a substring test (`pathname.includes('/metadata')`), so
 * both URLs pass the "no apps configured" guard and enter the no-`activeApp`
 * `<Routes>`. That branch declared `create-app`, `system/marketplace*` and
 * `metadata*` only — no `component/…` at all — and, unlike the with-`activeApp`
 * branch, no trailing `path="*"`. A `<Routes>` with no match renders `null`:
 * a fully blank screen, no 404, no error, no empty state.
 *
 * ## Which spelling is canonical — MEASURED, and the opposite of the guess
 *
 * The dispatch presumed `component/metadata/resource?type=` was the canonical
 * shape (because `apps/console`'s `MetadataRedirect` rewrites *into* it). It is
 * not. In the with-`activeApp` branch `component/metadata/resource/*` is not a
 * page at all — it is declared under the comment *"Legacy: old metadata routes
 * built before the REST-style nesting landed. Redirect to the new
 * /metadata/:type/... shape"* and renders `LegacyMetadataRedirect`
 * (`console/AppContent.tsx`). The canonical spelling is `metadata/:type`, which
 * both branches already declare as the real `MetadataResourceListPage`.
 *
 * So the two spellings are NOT two pages: one is an alias that 302s to the
 * other. That makes the fix a pure mirror — declare the same legacy-alias
 * redirect in the no-app branch that the with-app branch already declares, and
 * the alias lands on a route the no-app branch has had all along. No navigation
 * URL changes, and the alias keeps its single canonical destination. The
 * assertions below pin the resulting *pathname*, so a future change that made
 * `component/metadata/resource` render a second copy of the page instead of
 * redirecting would turn this file red.
 *
 * ## Scope of the stubs
 *
 * This file measures ROUTING — which route matches, which URL results, what
 * ends up on screen. The metadata-admin pages and the designer are stubbed;
 * their internals are other files' subject.
 *
 * `systemRoutesStub` below transcribes the host fragment from
 * `apps/console/src/AppContent.tsx` (`systemRoutes` + its `MetadataRedirect`).
 * app-shell cannot import from `apps/` — different Vitest project, and the
 * redirect is a module-private function — so the rewrite is copied verbatim,
 * including its `prefix` regex, and this comment is the pointer back to the
 * original. It is the `sys-objects` leg of the chain: without it that URL's
 * two-hop route to the same dead end is invisible here.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — everything that takes part in the routing decision (AppContent's
// guards, its nested <Routes>, react-router's matching) stays real.
// ---------------------------------------------------------------------------

// The metadata-admin pages sit behind `React.lazy(() => import('../views/metadata-admin'))`.
// Stubbing the module keeps the assertions off the transform pipeline entirely
// (AGENTS.md §测试纪律: never let an unbounded module load race a bounded
// `findBy` window). The list page echoes its `:type` param so the assertions can
// tell "the right resource page" from "a resource page".
vi.mock('../../views/metadata-admin', () => ({
  MetadataDirectoryPage: () => <div data-testid="metadata-directory-page">directory</div>,
  StudioHomePage: () => <div data-testid="studio-home-page">studio</div>,
  MetadataResourceListPage: () => {
    const { type } = useParams<{ type?: string }>();
    return <div data-testid="metadata-resource-list-page">{type}</div>;
  },
  MetadataResourceEditPage: () => <div data-testid="metadata-resource-edit-page" />,
  MetadataResourceHistoryPage: () => <div data-testid="metadata-resource-history-page" />,
  MetadataDiagnosticsPage: () => <div data-testid="metadata-diagnostics-page" />,
}));

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

/** The zero-app deployment this whole branch exists for. */
const refreshMetadata = vi.fn(async () => {});
vi.mock('../../providers/MetadataProvider', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadata: () => ({
    apps: [],
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

/** Reports the live URL so a redirect chain is visible as a URL, not just a screen. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

/**
 * VERBATIM transcription of `apps/console/src/AppContent.tsx`'s `MetadataRedirect`
 * (the `system/metadata/*` legs of its `systemRoutes` fragment). Keep the regex
 * and the target construction identical to the original — this stub is what makes
 * the `sys-objects` hop measurable from inside app-shell.
 */
function MetadataRedirectStub() {
  const { metadataType, itemName } = useParams<{ metadataType?: string; itemName?: string }>();
  const location = useLocation();
  const prefix = location.pathname.replace(/\/(system\/)?metadata(\/.*)?$/, '');
  const base = `${prefix}/component/metadata/resource`;
  const target = !metadataType
    ? `${prefix}/component/metadata/directory`
    : itemName
      ? `${base}/${itemName}?type=${metadataType}`
      : `${base}?type=${metadataType}`;
  return <Navigate to={target} replace />;
}

/**
 * The host's `extraRoutesNoApp` fragment, reduced to the entries this file
 * depends on. `apps/console/src/AppContent.tsx` passes the SAME fragment to both
 * `extraRoutes` and `extraRoutesNoApp`; with zero apps only the latter is
 * reachable.
 */
const systemRoutesStub = (
  <>
    <Route path="system" element={<div data-testid="system-hub-page">system hub</div>} />
    <Route path="system/metadata" element={<MetadataRedirectStub />} />
    <Route path="system/metadata/:metadataType" element={<MetadataRedirectStub />} />
    <Route path="system/metadata/:metadataType/:itemName" element={<MetadataRedirectStub />} />
  </>
);

/**
 * The reference host's route tree, reduced to the parts that decide this
 * question. Mirrors `apps/console/src/App.tsx`.
 */
function renderConsoleAt(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <LocationProbe />
      <Routes>
        <Route path="/apps/:appName/*" element={<AppContent extraRoutesNoApp={systemRoutesStub} />} />
        <Route path="/" element={<div data-testid="root-landing">landing</div>} />
        <Route path="/home" element={<div data-testid="home-launcher">home</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>,
  );
}

const pathname = () => screen.getByTestId('pathname').textContent;

describe('AppContent — zero-app component/metadata destinations (objectui#3610)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sys-datasources: /apps/setup/component/metadata/resource?type=datasource renders the resource page', async () => {
    // The white screen this issue is about. The URL passes `isMetadataRoute`
    // (substring `/metadata`) and so enters the no-`activeApp` branch, which
    // used to declare nothing matching `component/…` and had no catch-all.
    renderConsoleAt('/apps/setup/component/metadata/resource?type=datasource');

    const page = await screen.findByTestId('metadata-resource-list-page');
    expect(page).toBeInTheDocument();
    // Which page: the `type` search param must survive the alias hop as the
    // canonical path segment.
    expect(page).toHaveTextContent('datasource');
    // The direction of the hop — `component/metadata/resource` is the ALIAS,
    // `metadata/:type` is canonical. Asserting the screen alone would stay
    // green if the alias grew a second copy of the page.
    expect(pathname()).toBe('/apps/setup/metadata/datasource');
    // Not the "no apps configured" screen, and not bounced to the host landing.
    expect(screen.queryByTestId('create-first-app-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('root-landing')).not.toBeInTheDocument();
  });

  it('sys-objects: the /apps/setup/system/metadata/object detour reaches the same resource page', async () => {
    // The non-obvious half, pinned on its own because it would regress
    // silently: this URL is rewritten by the HOST (`MetadataRedirect`) onto the
    // legacy alias, which the shell then rewrites onto the canonical route.
    // Three route tables, two redirects, zero apps.
    renderConsoleAt('/apps/setup/system/metadata/object');

    const page = await screen.findByTestId('metadata-resource-list-page');
    expect(page).toBeInTheDocument();
    expect(page).toHaveTextContent('object');
    expect(pathname()).toBe('/apps/setup/metadata/object');
    expect(screen.queryByTestId('root-landing')).not.toBeInTheDocument();
  });

  it('the typeless legacy directory alias reaches the metadata directory', async () => {
    // `system/metadata` with no `:metadataType` takes `MetadataRedirect`'s other
    // arm, onto `component/metadata/directory` — the second alias the with-app
    // branch declares, and the second blank screen without it.
    renderConsoleAt('/apps/setup/system/metadata');

    expect(await screen.findByTestId('metadata-directory-page')).toBeInTheDocument();
    expect(pathname()).toBe('/apps/setup/metadata');
  });

  it('an unmatched URL inside this branch renders "not found" instead of a blank screen', async () => {
    // The general fix. `/system` flips `isSystemRoute`, so this enters the
    // branch; nothing declares `system/no-such-page`. Before the catch-all,
    // `<Routes>` rendered `null` — an indistinguishable-from-crashed blank page.
    renderConsoleAt('/apps/setup/system/no-such-page');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(pathname()).toBe('/apps/setup/system/no-such-page');
    // A 404, not a bounce and not the empty state.
    expect(screen.queryByTestId('root-landing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('create-first-app-btn')).not.toBeInTheDocument();
  });

  it('an unmatched component/metadata/* spelling gets the same "not found"', async () => {
    // The alias routes are narrow on purpose (`directory`, `resource/*`) — a
    // near-miss must be reportable rather than blank.
    renderConsoleAt('/apps/setup/component/metadata/nonsense');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(pathname()).toBe('/apps/setup/component/metadata/nonsense');
  });

  it('MEASUREMENT: /apps/setup/no-such-page never reaches this branch — it is the no-apps empty state', async () => {
    // Correction to the acceptance criterion's example URL. A path with no
    // `/system`, no `/metadata` and no `create-app` fails all three flags the
    // branch is gated on, so the `!activeApp` guard above it wins and shows
    // "no apps configured". The catch-all added here is NOT what such a URL
    // hits, and this pins that boundary so the two screens don't get conflated.
    renderConsoleAt('/apps/setup/no-such-page');

    expect(await screen.findByTestId('create-first-app-btn')).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });
});
