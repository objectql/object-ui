// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AppSidebar's two IMPERATIVE "Settings" senders — must target the system HUB
 * (objectui#3611).
 *
 * ## Why these two are separate from the ones #3590 fixed
 *
 * #3590 / PR #3608 retargeted the `sys-settings` NAV ENTRY (a declarative
 * `url:` on a navigation item, asserted as an `href` in
 * `systemNavSettingsTarget.test.tsx`) and the empty state's CTA. The two sites
 * pinned here are neither: they are `onClick={() => navigate(...)}` handlers,
 * so they carry no `href` and no navigation item to inspect. They were outside
 * #3590's declared file surface and stayed on the bare URL.
 *
 * ## The defect
 *
 * `AppContent` mounts the system hub only when `isSystemRoute`
 * (`pathname.includes('/system')`) holds. A bare `/apps/setup` therefore falls
 * into the `!activeApp && !isCreateAppRoute && !isSystemRoute && !isMetadataRoute`
 * guard and renders the "No Apps Configured" empty state — on a zero-app
 * deployment `/apps/setup` IS that empty state's own URL. Both senders below
 * spelled it, so both looped in place.
 *
 * `system-sidebar-header` is the sharpest of the two: it renders ONLY in the
 * `activeApp` falsy branch, i.e. it is unreachable EXCEPT in exactly the state
 * where its old target was broken. The user-menu entry renders in every
 * deployment but is only *broken* in the zero-app one.
 *
 * ## What is asserted, and what is not
 *
 * These assert the URL each handler SENDS. What that URL then resolves to is
 * `AppContent`'s question and is pinned end-to-end (click -> mounted hub) in
 * `console/__tests__/AppContent.noAppsCta.test.tsx`.
 *
 * The dropdown primitives are replaced with passthroughs (same technique, and
 * same reason, as `WorkspaceSwitcher.test.tsx`): the subject here is the
 * constant the handler closes over, not Radix's open/close choreography, and
 * jsdom + Radix's modal `pointer-events: none` makes driving the real menu a
 * source of flake unrelated to anything this file is measuring.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — providers and console-only chrome, matching the sibling sidebar
// suites. `@object-ui/layout` stays REAL so the fallback nav cluster below is
// the one AppSidebar's own render path emits.
// ---------------------------------------------------------------------------

/** The imperative target under test. `MemoryRouter`/`Link`/`useLocation` stay real. */
const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

// Passthrough dropdown primitives so the footer menu's items render without
// interaction. Everything else in @object-ui/components (Sidebar*, Avatar) is
// the real implementation.
vi.mock('@object-ui/components', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div role="menuitem" onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
  useObjectLabel: () => ({
    objectLabel: ({ label }: { label?: string }) => label,
    viewLabel: (_o: string, _v: string, fallback?: string) => fallback,
    dashboardLabel: ({ label }: { label?: string }) => label,
  }),
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
    signOut: vi.fn(),
    isAuthEnabled: false,
    activeOrganization: null,
  }),
  useWorkspaceAdminStatus: () => ({ isAdmin: true, isResolved: true }),
  getUserInitials: () => 'U',
}));

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({ can: () => true, hasCapabilities: () => true }),
}));

/** The zero-app deployment both senders exist for. */
vi.mock('../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ apps: [], objects: [] }),
}));

vi.mock('../../providers/ExpressionProvider', () => ({
  useExpressionContext: () => ({ evaluator: null }),
  evaluateVisibility: (expr: unknown) => expr !== false && expr !== 'false',
}));

vi.mock('../../utils', () => ({
  resolveKeyedI18nLabel: (label: unknown) => (typeof label === 'string' ? label : ''),
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
vi.mock('../../context/NavigationContext', () => ({
  useNavigationContext: () => ({ context: 'app', currentAppName: 'setup' }),
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

/** The system hub — the reachable target, and what every sibling entry prefixes. */
const SYSTEM_HUB = '/apps/setup/system';
/** The empty state's OWN url — what both senders used to spell. */
const BARE_SETUP = '/apps/setup';

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={[BARE_SETUP]}>
      <SidebarProvider>
        <AppSidebar activeAppName="setup" onAppChange={() => {}} />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
});

describe('AppSidebar imperative Settings senders (objectui#3611)', () => {
  it('the no-app sidebar header sends to the system hub, not back to the empty state', async () => {
    const user = userEvent.setup();
    renderSidebar();

    // Precondition: with zero apps this really is the no-active-app branch —
    // otherwise the header under test would not be on screen at all and the
    // assertion below would be vacuous.
    expect(screen.getByTestId('system-fallback-nav')).toBeInTheDocument();

    await user.click(screen.getByTestId('system-sidebar-header'));

    expect(navigate).toHaveBeenCalledWith(SYSTEM_HUB);
    // The regression: bare `/apps/setup` re-renders the very empty state this
    // header is drawn on top of.
    expect(navigate).not.toHaveBeenCalledWith(BARE_SETUP);
  });

  it('the user-menu Settings entry sends to the system hub', async () => {
    const user = userEvent.setup();
    renderSidebar();

    // `Settings` is an exact match — it does not collide with the fallback
    // cluster's `System Settings` link.
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));

    expect(navigate).toHaveBeenCalledWith(SYSTEM_HUB);
    expect(navigate).not.toHaveBeenCalledWith(BARE_SETUP);
  });

  it('REGRESSION: the sibling app-switcher entry that was already hub-scoped is unchanged', () => {
    renderSidebar();

    // `sys-settings`, corrected by #3590, is the anchor that made these two the
    // odd ones out. It is a declarative `url:` (an href), not a navigate() —
    // which is exactly why #3590's sweep did not reach the two above.
    expect(screen.getByRole('link', { name: 'System Settings' })).toHaveAttribute(
      'href',
      SYSTEM_HUB,
    );
  });
});
