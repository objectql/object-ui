// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Sidebar "System Settings" entry — must target the system HUB (objectui#3590).
 *
 * ## The defect, and why both sidebars carry it
 *
 * `AppContent` decides which branch renders by string-matching the pathname:
 * `isSystemRoute = location.pathname.includes('/system')`. Only that flag mounts
 * the host's `extraRoutesNoApp` fragment, where `apps/console/src/AppContent.tsx`
 * declares `<Route path="system" />` → `SystemHubPage`. A **bare** `/apps/setup`
 * therefore matches no pseudo-route except `isSetupRoute`, falls into the
 * `!activeApp && !isCreateAppRoute && !isSystemRoute && !isMetadataRoute` guard
 * and re-renders the "No Apps Configured" empty state. On a zero-app deployment
 * `/apps/setup` IS that empty state's own URL.
 *
 * Both sidebars pointed their `sys-settings` entry at that bare URL, in clusters
 * whose every OTHER entry already spells `/apps/setup/system/...`:
 *
 * - `AppSidebar.systemFallbackNavigation` renders ONLY when `activeApp` is falsy,
 *   and `activeApp` there is `matched || activeApps[0]` — falsy exactly when the
 *   deployment has zero active+visible apps. So its head entry was dead in the
 *   one situation the cluster exists for. Pinned by the first test below, which
 *   renders with `apps: []`.
 * - `UnifiedSidebar.homeNavigation`'s Administration cluster is the `/home`
 *   admin nav added so a fresh env (no apps yet) still has a real menu —
 *   `resolveLandingPath([])` sends exactly that user to `/home`. Same head entry,
 *   same bare URL. Its entry is corrected too, but is DORMANT: the second test
 *   measures why (the home arm renders groups flat, so no child of the cluster
 *   reaches the DOM at all) rather than asserting an href that never renders.
 *
 * These assert the URL the entry CARRIES, not a navigation: what the URL then
 * resolves to is `AppContent`'s question, and is pinned end-to-end (click →
 * mounted hub) in `console/__tests__/AppContent.noAppsCta.test.tsx`.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — providers and console-only chrome, matching the sibling sidebar
// suites. @object-ui/components and @object-ui/layout stay REAL so the hrefs
// asserted below are the ones each sidebar's own render path actually emits.
// ---------------------------------------------------------------------------

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
  useObjectLabel: () => ({
    objectLabel: ({ label }: { label?: string }) => label,
    viewLabel: (_o: string, _v: string, fallback?: string) => fallback,
    dashboardLabel: ({ label }: { label?: string }) => label,
    navGroupLabel: (_a: string, _g: string, fallback?: string) => fallback,
  }),
}));

// Both clusters below are admin surfaces — UnifiedSidebar's Administration group
// is gated on `useIsWorkspaceAdmin`.
vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), isAuthEnabled: false, activeOrganization: null }),
  useIsWorkspaceAdmin: () => true,
  getUserInitials: () => 'U',
}));

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({ can: () => true, hasCapabilities: () => true }),
}));

/** The zero-app deployment this whole screen exists for. */
vi.mock('../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ apps: [], objects: [] }),
}));

vi.mock('../../providers/ExpressionProvider', () => ({
  useExpressionContext: () => ({ evaluator: null }),
  evaluateVisibility: (expr: unknown) => expr !== false && expr !== 'false',
}));

vi.mock('../../utils', () => ({
  resolveI18nLabel: (label: unknown) => (typeof label === 'string' ? label : ''),
  matchAppBySegment: (apps: Array<{ name?: string }>, segment?: string) =>
    apps.find((a) => a?.name === segment),
  appRouteSegment: (app: { name?: string }) => app?.name,
}));

// Lazy lucide DynamicIcon would suspend mid-test; a null icon keeps each link's
// accessible name equal to its label text.
vi.mock('../../utils/getIcon', () => ({ getIcon: () => () => null }));

vi.mock('../../hooks/useRecentItems', () => ({ useRecentItems: () => ({ recentItems: [] }) }));
vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({ favorites: [], removeFavorite: vi.fn() }),
}));
vi.mock('../../hooks/useNavPins', () => ({
  useNavPins: () => ({ togglePin: vi.fn(), applyPins: (items: unknown) => items }),
}));
vi.mock('../../hooks/useNavActionDispatch', () => ({
  useNavActionDispatch: () => vi.fn(),
}));
// The `/home` shell — the context whose navigation carries the admin cluster.
vi.mock('../../context/NavigationContext', () => ({
  useNavigationContext: () => ({ context: 'home', currentAppName: undefined }),
}));
vi.mock('../ContextSelectors', () => ({
  useAppContextSelectors: () => ({ contextValues: {}, element: null }),
  contextSelectorQueryKey: (id: string) => (id === 'active_package' ? 'package' : id),
  STUDIO_PACKAGE_SELECTOR_ID: 'active_package',
}));
vi.mock('../LocalizedSidebarTrigger', () => ({
  LocalizedSidebarTrigger: () => null,
}));

import { SidebarProvider } from '@object-ui/components';
import { AppSidebar } from '../AppSidebar';
import { UnifiedSidebar } from '../UnifiedSidebar';

/** The system hub — the reachable target, and what every sibling entry prefixes. */
const SYSTEM_HUB = '/apps/setup/system';

beforeEach(() => {
  localStorage.clear();
});

describe('sidebar system-settings target (objectui#3590)', () => {
  it('AppSidebar: the no-active-app fallback cluster heads at the system hub', () => {
    render(
      <MemoryRouter initialEntries={['/apps/setup']}>
        <SidebarProvider>
          <AppSidebar activeAppName="setup" onAppChange={() => {}} />
        </SidebarProvider>
      </MemoryRouter>,
    );

    // Precondition: with zero apps this really is the fallback cluster, not an
    // app's own navigation — otherwise the assertion below would be vacuous.
    expect(screen.getByTestId('system-fallback-nav')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'System Settings' })).toHaveAttribute(
      'href',
      SYSTEM_HUB,
    );
    // The regression: bare `/apps/setup` re-renders the empty state this cluster
    // is displayed on top of.
    expect(screen.getByRole('link', { name: 'System Settings' })).not.toHaveAttribute(
      'href',
      '/apps/setup',
    );
    // The rest of the cluster was already hub-scoped; kept as the consistency
    // anchor that made the head entry the odd one out.
    expect(screen.getByRole('link', { name: 'Applications' })).toHaveAttribute(
      'href',
      `${SYSTEM_HUB}/apps`,
    );
  });

  it('MEASUREMENT: UnifiedSidebar renders the /home Administration cluster FLAT, so its retargeted entry is dormant', () => {
    // Measured while retargeting `UnifiedSidebar`'s `sys-settings` entry: that
    // entry is not reachable today, so the corrected URL is dormant rather than
    // user-visible, and this file cannot honestly assert a navigation for it.
    //
    // Why: `UnifiedSidebar` runs ONE ternary on `context === 'app' && activeApp`
    // (line ~437). Only the APP arm renders `<NavigationRenderer>`, which is what
    // descends into `type: 'group'` children. The HOME arm hand-rolls
    // `homeNavigation.map(item => <Link to={item.url || '/home'}>)` — no
    // recursion — so the whole 9-item Administration group collapses into a
    // single link, and a group carries no `url`, so it falls back to `/home`:
    // the page the admin is already on.
    //
    // The URL constant was corrected anyway (objectui#3590), so whoever fixes
    // the flattening does not ship a dead `/apps/setup` link behind it. This pin
    // records the measurement, and goes red the moment the group renders its
    // children — which is the signal to replace it with the real href assertion.
    render(
      <MemoryRouter initialEntries={['/home']}>
        <SidebarProvider>
          <UnifiedSidebar activeAppName="" />
        </SidebarProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: 'System Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Applications' })).not.toBeInTheDocument();
  });
});
