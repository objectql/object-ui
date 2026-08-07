// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The System Hub / system-navigation entries under `/apps/:app/system/…` reach
 * the framework-owned system objects instead of failing (objectui#3655).
 *
 * ## What was wrong
 *
 * `SystemHubPage`'s cards and both sidebars' `sys-*` cluster emit five
 * `/apps/setup/system/{users,organizations,roles,positions,permissions}` URLs.
 * They were real routes until `apps/console` was slimmed for third-party
 * customisation (cccdf84d7), which deleted the bespoke wrapper pages on the
 * grounds that "these objects are now contributed by framework plugins … and
 * resolved via the generic /apps/setup/<object_name> route". The producers were
 * never retargeted and nothing redeclared the URLs, so all five fell through to
 * app-shell's tail — where the failure they got depended on how long the word
 * was, because `ShorthandRecordRedirect`'s `looksLikeRecordId` treats any
 * URL-safe segment of 6+ chars as a record id:
 *
 *   users (5), roles (5)                       -> RouteNotFound, "Page not found"
 *   organizations (13), positions (9),         -> rewritten to
 *   permissions (11)                              `…/system/record/<word>` and
 *                                                 rendered as a record of an
 *                                                 object literally named `system`
 *
 * Same cluster, same click, two unrelated failure screens — and the second is
 * the worse one, because a record page for a nonexistent object reads as a
 * backend/data problem rather than a dead link.
 *
 * ## What this file measures
 *
 * It renders app-shell's REAL `AppContent` (`DefaultAppContent`) with this
 * host's REAL `systemRoutes` fragment, so the tail routes under test —
 * `:objectName`, `:objectName/record/:recordId`, `ShorthandRecordRedirect`,
 * `RouteNotFound` — are the shipped ones, not a transcription. That matters
 * here more than usual: the defect IS the interaction between this fragment and
 * that tail, and a hand-copied tail would be free to agree with whatever the
 * fragment does.
 *
 * `ChainRecorder` records every location the router settles on, so "one hop" is
 * an assertion rather than an inference; the pre-fix landings above are
 * reachable by deleting the four `system/*` routes from `systemRoutes` (the
 * `object-view` probes go red and the chain returns to `Page not found` /
 * `…/system/record/<word>`).
 *
 * ## Two branches, and the `permissions` gap
 *
 * `AppContent` has two route tables and this host passes the same fragment to
 * both. With an active app the redirect target resolves (`:objectName` renders
 * `ObjectView`); on a zero-app deployment there is no `:objectName` route at
 * all, so the target lands on the "No Apps Configured" empty state — measured
 * and pinned below rather than asserted away, because a deployment with no apps
 * in its metadata also has no `sys_user` to show.
 *
 * `system/permissions` is deliberately still broken: the framework splits this
 * console's "Permissions" into `sys_capability` and `sys_permission_set` and
 * nothing in the issue picks one. Its unchanged landing is pinned so the gap is
 * visible, and so whichever mapping is chosen has to come here to change it.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

// AGENTS.md §测试纪律 — the lazily-imported page modules are stubbed so no
// unbounded `import()` races a bounded assertion window. The paths are
// relative to app-shell's OWN source tree (`@object-ui/app-shell` is aliased to
// `packages/app-shell/src` by `apps/console/vite.config.ts`), which is what
// makes these resolve to the same module ids app-shell imports internally.
vi.mock('../../../../packages/app-shell/src/views/metadata-admin', () => ({
  MetadataDirectoryPage: () => <div data-testid="metadata-directory-page">directory</div>,
  StudioHomePage: () => <div data-testid="studio-home-page">studio</div>,
  MetadataResourceListPage: () => {
    const { type } = useParams<{ type?: string }>();
    return <div data-testid="metadata-resource-list-page">{type}</div>;
  },
  MetadataResourceEditPage: () => <div data-testid="metadata-resource-edit-page" />,
  MetadataResourceHistoryPage: () => <div data-testid="metadata-resource-history-page" />,
  MetadataDiagnosticsPage: () => <div data-testid="metadata-diagnostics-page" />,
  MetadataResourceRouter: () => <div data-testid="metadata-resource-router" />,
  registerMetadataResource: () => {},
}));

vi.mock('../../../../packages/app-shell/src/console/marketplace/MarketplacePage', () => ({
  MarketplacePage: () => <div data-testid="marketplace-page">marketplace</div>,
}));
vi.mock('../../../../packages/app-shell/src/console/marketplace/MarketplaceInstalledPage', () => ({
  MarketplaceInstalledPage: () => <div data-testid="marketplace-installed-page" />,
}));
vi.mock('../../../../packages/app-shell/src/console/marketplace/MarketplacePackagePage', () => ({
  MarketplacePackagePage: () => <div data-testid="marketplace-package-page" />,
}));

vi.mock('@object-ui/plugin-designer', () => ({
  CreateAppPage: () => <div data-testid="create-app-page">create app</div>,
  EditAppPage: () => <div data-testid="edit-app-page" />,
  DashboardDesignPage: () => <div data-testid="dashboard-design-page" />,
}));

vi.mock('../../../../packages/app-shell/src/layout/ConsoleLayout', () => ({
  ConsoleLayout: ({ activeAppName, children }: { activeAppName?: string; children?: React.ReactNode }) => (
    <div data-testid="console-layout" data-active-app={activeAppName}>
      {children}
    </div>
  ),
}));
vi.mock('../../../../packages/app-shell/src/chrome/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../../../../packages/app-shell/src/chrome/KeyboardShortcutsDialog', () => ({ KeyboardShortcutsDialog: () => null }));
vi.mock('../../../../packages/app-shell/src/chrome/OnboardingWalkthrough', () => ({ OnboardingWalkthrough: () => null }));

/** Echoes `:objectName` — this is the probe the whole fix is measured against. */
vi.mock('../../../../packages/app-shell/src/views/ObjectView', () => ({
  ObjectView: () => {
    const { objectName } = useParams<{ objectName?: string }>();
    return <div data-testid="object-view">{objectName}</div>;
  },
}));

/** Echoes every param, so "a record page for the object `system`" is a fact. */
vi.mock('../../../../packages/app-shell/src/views/RecordDetailView', () => ({
  RecordDetailView: () => {
    const params = useParams();
    return <div data-testid="record-detail-view">{JSON.stringify(params)}</div>;
  },
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
vi.mock('../../../../packages/app-shell/src/providers/AdapterProvider', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAdapter: () => dataSourceStub,
}));

/**
 * `setup` is a real app in any framework deployment (it ships in
 * `@objectstack/platform-objects`), which is why the with-app branch is the one
 * a user normally reaches these URLs in.
 */
const APPS = [{ name: 'setup', label: 'Setup', isDefault: true, navigation: [] }];
let metadataApps: unknown[] = APPS;
vi.mock('../../../../packages/app-shell/src/providers/MetadataProvider', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadata: () => ({
    apps: metadataApps,
    objects: [],
    loading: false,
    ensureType: undefined,
    error: null,
    refresh: vi.fn(async () => {}),
  }),
}));

import { DefaultAppContent } from '@object-ui/app-shell';
import { systemRoutes } from '../AppContent';

/**
 * Records every distinct location the router settles on. `<Navigate replace>`
 * re-renders once per hop, so a one-hop rewrite shows up as exactly two
 * entries.
 */
const chain: string[] = [];
function ChainRecorder() {
  const location = useLocation();
  const here = location.pathname;
  if (chain[chain.length - 1] !== here) chain.push(here);
  return null;
}

function renderConsoleAt(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <ChainRecorder />
      <Routes>
        <Route
          path="/apps/:appName/*"
          element={<DefaultAppContent extraRoutes={systemRoutes} extraRoutesNoApp={systemRoutes} />}
        />
        <Route path="/" element={<div data-testid="root-landing">landing</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  metadataApps = APPS;
  chain.length = 0;
});

describe('system-hub entries reach the framework system objects (objectui#3655)', () => {
  /**
   * The four whose equivalent the framework names unambiguously. `roles` and
   * `positions` converge on ONE object on purpose: ADR-0090 D3 renamed
   * `sys_role` -> `sys_position`, so the sidebar's "Roles" and the hub's
   * "Positions" are the same surface in old and new vocabulary.
   */
  it.each([
    ['/apps/setup/system/users', '/apps/setup/sys_user', 'sys_user'],
    ['/apps/setup/system/organizations', '/apps/setup/sys_organization', 'sys_organization'],
    ['/apps/setup/system/roles', '/apps/setup/sys_position', 'sys_position'],
    ['/apps/setup/system/positions', '/apps/setup/sys_position', 'sys_position'],
  ])('%s reaches %s in ONE hop', async (url, target, objectName) => {
    renderConsoleAt(url);

    expect(await screen.findByTestId('object-view')).toHaveTextContent(objectName);
    // Two entries = a single `<Navigate>`. Before the fix `users` never left
    // its own URL (it rendered `RouteNotFound` in place) and `organizations` /
    // `positions` moved to `…/system/record/<word>` instead.
    expect(chain).toEqual([url, target]);
    expect(screen.queryByTestId('record-detail-view')).not.toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('preserves the app prefix rather than stripping to the root', () => {
    // `prefix` is cut with a regex off `location.pathname`; every case above
    // uses the same two-segment prefix, so a mistake there is invisible in them.
    renderConsoleAt('/apps/my-app/system/users');

    expect(chain).toEqual(['/apps/my-app/system/users', '/apps/my-app/sys_user']);
  });

  it('an app segment spelled `system` survives the rewrite', () => {
    // The regex is end-anchored precisely so the LAST `/system/<seg>` is the
    // one removed. An unanchored cut would leave `/apps` here.
    renderConsoleAt('/apps/system/system/users');

    expect(chain).toEqual(['/apps/system/system/users', '/apps/system/sys_user']);
  });

  /**
   * MEASUREMENT — deliberately unresolved. "Permissions" has TWO candidate
   * equivalents in the framework (`sys_capability`, the definition registry and
   * the object its own docblock identifies as the ADR's `sys_permission`; and
   * `sys_permission_set`, the grant container the permissions docs call "the
   * only capability container"). Choosing one here would silently commit every
   * click and bookmark to a surface nobody picked, so this leg keeps its
   * pre-fix landing until the mapping is decided. This assertion is expected to
   * be REPLACED, not merely to keep passing.
   */
  it('MEASUREMENT: system/permissions still lands on a record of the object `system`', async () => {
    renderConsoleAt('/apps/setup/system/permissions');

    const probe = await screen.findByTestId('record-detail-view');
    expect(probe).toHaveTextContent('"objectName":"system"');
    expect(probe).toHaveTextContent('"recordId":"permissions"');
    expect(chain).toEqual([
      '/apps/setup/system/permissions',
      '/apps/setup/system/record/permissions',
    ]);
  });

  /**
   * MEASUREMENT — the length-dependent split this issue is really about, taken
   * on the one URL the fix does not cover. `permissions` (11 chars) is judged a
   * record id; a hypothetical 5-char sibling would not be. Nothing here asks
   * for `looksLikeRecordId` to change — it is a separate question — but the
   * asymmetry is recorded so the next reader does not have to rediscover it.
   */
  it('MEASUREMENT: an undeclared SHORT system segment still reaches Page not found', async () => {
    renderConsoleAt('/apps/setup/system/teams');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(chain).toEqual(['/apps/setup/system/teams']);
  });
});

describe('zero-app branch — measured, not asserted away (objectui#3655)', () => {
  /**
   * The sidebars' `sys-*` cluster renders ONLY when there is no active app, so
   * this is the branch its Users / Organizations / Roles entries are clicked
   * in. `AppContent`'s no-active-app route table declares no `:objectName`
   * route, so the redirect target leaves the pseudo-route family
   * (`isSystemRoute` keys on a `system` path segment) and falls into the "No
   * Apps Configured" guard.
   *
   * That is the honest end state, not a regression hidden by a stub: a
   * deployment whose metadata carries zero apps also carries no `sys_user` to
   * render. What changes is only WHICH dead end is reached — previously all
   * five landed on `RouteNotFound` here, because `ShorthandRecordRedirect` is
   * not declared in this branch either (i.e. the length-dependent split above
   * does NOT exist on a zero-app deployment).
   */
  it.each([
    ['/apps/setup/system/users', '/apps/setup/sys_user'],
    ['/apps/setup/system/organizations', '/apps/setup/sys_organization'],
    ['/apps/setup/system/roles', '/apps/setup/sys_position'],
    ['/apps/setup/system/positions', '/apps/setup/sys_position'],
  ])('%s still redirects, and the target is the no-apps empty state', async (url, target) => {
    metadataApps = [];
    renderConsoleAt(url);

    expect(await screen.findByTestId('create-first-app-btn')).toBeInTheDocument();
    expect(chain).toEqual([url, target]);
    expect(screen.queryByTestId('object-view')).not.toBeInTheDocument();
  });

  it('MEASUREMENT: with no apps, an undeclared system URL reaches Page not found, never a record page', async () => {
    metadataApps = [];
    renderConsoleAt('/apps/setup/system/permissions');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByTestId('record-detail-view')).not.toBeInTheDocument();
    expect(chain).toEqual(['/apps/setup/system/permissions']);
  });
});
