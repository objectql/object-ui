// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AppSidebar — derived area visibility (objectui#3319).
 *
 * The inline area switcher must follow the same derivation the layout
 * package's `AppSchemaRenderer` adopted in #3311: an area appears in the
 * switcher iff `hasVisibleNavigationItems` (shared predicate from
 * `@object-ui/layout`, NOT a local copy) finds at least one item that
 * survives the item-level guards, and the ACTIVE area is elected among the
 * visible areas only. No authorable area-level key is involved.
 *
 * NB (lesson from #3322): a gated fixture is only load-bearing when it sits
 * in the area that would otherwise be ACTIVE — the first/active area is the
 * only one whose navigation actually renders, so gating an item elsewhere
 * asserts nothing.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NavigationArea } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Mocks — providers and console-only chrome. @object-ui/components and
// @object-ui/layout stay REAL so the shared predicate and the item-level
// guards inside NavigationRenderer are actually exercised.
// ---------------------------------------------------------------------------

// Partial mock: @object-ui/components also imports from @object-ui/i18n
// (createSafeTranslation), so the rest of the module must stay real.
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
  useAuth: () => ({ user: null, signOut: vi.fn(), isAuthEnabled: false, activeOrganization: null }),
  useWorkspaceAdminStatus: () => ({ isAdmin: false, isResolved: true }),
  getUserInitials: () => 'U',
}));

// Mutable permission state — swapped per test, re-read on every render.
let permissionsState: {
  can: (objectName: string, action: string) => boolean;
  hasCapabilities: (caps: string[]) => boolean;
};
vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => permissionsState,
}));

let metadataState: { apps: unknown[]; objects: unknown[] };
vi.mock('../../providers/MetadataProvider', () => ({
  useMetadata: () => metadataState,
}));

vi.mock('../../providers/ExpressionProvider', () => ({
  useExpressionContext: () => ({ evaluator: null }),
  // Mirrors the real evaluateVisibility's literal handling — enough for
  // fixtures gating with `visible: false`.
  evaluateVisibility: (expr: unknown) => expr !== false && expr !== 'false',
}));

vi.mock('../../utils', () => ({
  resolveKeyedI18nLabel: (label: unknown) => (typeof label === 'string' ? label : ''),
  matchAppBySegment: (apps: Array<{ name?: string }>, segment?: string) =>
    apps.find((a) => a?.name === segment),
  appRouteSegment: (app: { name?: string }) => app?.name,
}));

// Lazy lucide DynamicIcon would suspend mid-test; a null icon is enough here.
vi.mock('../../utils/getIcon', () => ({ getIcon: () => () => null }));

vi.mock('../../hooks/useRecentItems', () => ({ useRecentItems: () => ({ recentItems: [] }) }));
vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({ favorites: [], removeFavorite: vi.fn() }),
}));
vi.mock('../../hooks/useNavPins', () => ({
  useNavPins: () => ({ togglePin: vi.fn(), applyPins: (items: unknown) => items }),
}));
vi.mock('../ContextSelectors', () => ({
  useAppContextSelectors: () => ({ contextValues: {}, element: null }),
}));

import { SidebarProvider } from '@object-ui/components';
import { AppSidebar } from '../AppSidebar';

// ---------------------------------------------------------------------------
// Fixtures — labels are pairwise distinct so a hit is unambiguous.
// ---------------------------------------------------------------------------

const salesArea: NavigationArea = {
  id: 'area-sales',
  label: 'Sales',
  navigation: [{ id: 'a1', type: 'object', label: 'Opportunities', objectName: 'opportunity' }],
};

const serviceArea: NavigationArea = {
  id: 'area-service',
  label: 'Service',
  navigation: [{ id: 'a2', type: 'object', label: 'Cases', objectName: 'case' }],
};

const marketingArea: NavigationArea = {
  id: 'area-marketing',
  label: 'Marketing',
  navigation: [{ id: 'a3', type: 'object', label: 'Campaigns', objectName: 'campaign' }],
};

const gatedSales: NavigationArea = {
  ...salesArea,
  navigation: [{ ...salesArea.navigation[0], visible: false }],
};

function sidebarUi(areas: NavigationArea[]) {
  metadataState = {
    apps: [{ name: 'crm', label: 'CRM', active: true, areas }],
    objects: [],
  };
  return (
    <MemoryRouter initialEntries={['/apps/crm']}>
      <SidebarProvider>
        <AppSidebar activeAppName="crm" onAppChange={() => {}} />
      </SidebarProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  permissionsState = { can: () => true, hasCapabilities: () => true };
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppSidebar derived area visibility (#3319)', () => {
  it('keeps every area in the switcher when every area has a visible item', () => {
    render(sidebarUi([salesArea, serviceArea, marketingArea]));
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    // First area is active — only its navigation renders.
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.queryByText('Cases')).not.toBeInTheDocument();

    // Switching among visible areas still works.
    fireEvent.click(screen.getByText('Marketing'));
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.queryByText('Opportunities')).not.toBeInTheDocument();
  });

  it('keeps a PARTIALLY gated area visible and active, hiding only the gated item', () => {
    const partialSales: NavigationArea = {
      ...salesArea,
      navigation: [
        { ...salesArea.navigation[0], visible: false },
        { id: 'a1b', type: 'object', label: 'Quotes', objectName: 'quote' },
      ],
    };
    render(sidebarUi([partialSales, serviceArea]));
    // The area survives (it still has a visible item) and stays active…
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Quotes')).toBeInTheDocument();
    // …but the gated ITEM does not render (real NavigationRenderer guard).
    expect(screen.queryByText('Opportunities')).not.toBeInTheDocument();
  });

  it('hides an area whose items are ALL gated and elects the first VISIBLE area', () => {
    render(sidebarUi([gatedSales, serviceArea, marketingArea]));
    // The fully gated area is not offered in the switcher…
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    // …and never auto-activated: the first VISIBLE area's navigation renders.
    expect(screen.getByText('Cases')).toBeInTheDocument();
    expect(screen.queryByText('Opportunities')).not.toBeInTheDocument();
  });

  it('hides the switcher entirely when only one area remains visible', () => {
    render(sidebarUi([gatedSales, serviceArea]));
    // One visible area = nothing to switch between: no switcher rows at all,
    // but the visible area's navigation still renders.
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();
  });

  it('renders no switcher and no area navigation when every area is fully gated', () => {
    render(
      sidebarUi([
        gatedSales,
        { ...serviceArea, navigation: [{ ...serviceArea.navigation[0], visible: false }] },
      ]),
    );
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Opportunities')).not.toBeInTheDocument();
    expect(screen.queryByText('Cases')).not.toBeInTheDocument();
  });

  it('re-elects when the ACTIVE area is gated away, and a mere reveal does not steal the selection', () => {
    const adminSales: NavigationArea = {
      ...salesArea,
      navigation: [{ ...salesArea.navigation[0], requiredPermissions: ['sales:admin'] }],
    };
    const areas = [adminSales, serviceArea, marketingArea];

    const view = render(sidebarUi(areas));
    // Permission granted: Sales is visible and active.
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();

    // Permission revoked (`object:action` form → can('sales','admin') false):
    // Sales derives hidden, drops out of the switcher, and the sidebar
    // re-elects the first visible area.
    permissionsState = {
      can: (objectName, action) => !(objectName === 'sales' && action === 'admin'),
      hasCapabilities: () => true,
    };
    view.rerender(sidebarUi(areas));
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();
    expect(screen.queryByText('Opportunities')).not.toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();

    // Permission granted again: Sales REAPPEARS in the switcher, but the
    // user's current selection is not yanked away — Service stays active.
    permissionsState = { can: () => true, hasCapabilities: () => true };
    view.rerender(sidebarUi(areas));
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();
    expect(screen.queryByText('Opportunities')).not.toBeInTheDocument();
  });
});
