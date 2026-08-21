// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Home stops recommending a marketplace this runtime does not have
 * (objectui#5504).
 *
 * ## The defect, and why the ORDERING is the injury
 *
 * `apps/objectos-ee/deploy/.env.example` ships `OS_CLOUD_URL=off` as its factory
 * default. On that stack Home still led with "Start with a template — install a
 * template app from the marketplace" and carried a "Browse App Marketplace"
 * shortcut; both navigate to `/apps/setup/system/marketplace`, which 404s there.
 * The page recommended first and errored afterwards. Withholding the entry is
 * the fix; making the error card politer would not have been.
 *
 * ## Why these cases drive the REAL runtime-config module
 *
 * Same argument as `MarketplacePage.disabledState.test.tsx`: the claim under
 * test is that the gate consumes the SERVER's derived `features.marketplace`
 * (objectstack#8356), so these cases boot the genuine `initRuntimeConfig()`
 * over a stubbed `/api/v1/runtime/config` payload rather than mocking the
 * accessor. The neighbouring HomePage suites mock `../../../runtime-config`
 * precisely because they are about something else.
 *
 * ## Why `t` returns «key»
 *
 * The reason line must resolve THROUGH i18n — a hardcoded English sentence at
 * the point of refusal is half of what this card is about — so `t` echoes the
 * KEY rather than `defaultValue`. Verbatim from
 * `HomePage.authoringCapabilityGate.test.tsx`, which states the argument in
 * full.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MePermissionsProvider, type MePermissionsResponse } from '@object-ui/permissions';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    t: (key: string) => `«${key}»`,
    language: 'en',
  }),
  useObjectLabel: () => ({ appLabel: (app: any) => String(app?.label ?? app?.name ?? '') }),
}));

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Zhang San', email: 'zhangsan@acme-test.com' } }),
  useIsWorkspaceAdmin: () => true,
}));

vi.mock('@object-ui/plugin-chatbot', () => ({
  useAgents: () => ({ agents: [{ name: 'builder' }] }),
  isAskAgent: () => false,
  agentHasCapability: () => true,
}));

vi.mock('../../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ apps: [{ name: 'crm', label: 'CRM' }], loading: false }),
}));

vi.mock('../../../context/NavigationContext', () => ({
  useNavigationContext: () => ({ currentAppName: undefined }),
}));

// --- surfaces unrelated to this gate ---------------------------------------
vi.mock('../../../hooks/useRecentItems', () => ({ useRecentItems: () => ({ recentItems: [] }) }));
vi.mock('../../../hooks/useFavorites', () => ({ useFavorites: () => ({ favorites: [] }) }));
vi.mock('../../../hooks/useHomeInbox', () => ({
  useHomeInbox: () => ({
    pendingApprovalsCount: 0,
    notifications: [],
    unreadTopicCount: 0,
    activities: [],
  }),
}));
vi.mock('../../../hooks/useAiSurface', () => ({ resolveAiApiBase: () => '' }));
vi.mock('../../../views/metadata-admin/useMetadata', () => ({
  useMetadataClient: () => ({ listDrafts: async () => [] }),
}));
vi.mock('../../../preview/usePublishAllDrafts', () => ({
  usePublishAllDrafts: () => ({ publishAll: async () => ({ ok: true }), publishing: false }),
}));

import { initRuntimeConfig, resetRuntimeConfigForTesting } from '../../../runtime-config';
import { HomePage } from '../HomePage';

/** A `GET /api/v1/runtime/config` answer, as the server sends it. */
const serverConfig = (cloudUrl: string, marketplace: boolean) => ({
  cloudUrl,
  singleEnvironment: true,
  features: { installLocal: true, marketplace, aiStudio: true, autoPublishAiBuilds: true },
  branding: { productName: 'ObjectOS', productShortName: 'ObjectOS' },
});

async function bootOn(body: Record<string, unknown>) {
  resetRuntimeConfigForTesting();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
  await initRuntimeConfig();
}

/** An admin who MAY author metadata — so only the marketplace gate is in play. */
const permissions = (): MePermissionsResponse =>
  ({
    authenticated: true,
    userId: 'u1',
    tenantId: 'acme',
    roles: ['org_owner', 'everyone'],
    permissionSets: ['organization_admin', 'member_default'],
    systemPermissions: ['manage_org_users', 'setup.access', 'setup.write', 'manage_metadata'],
    objects: {},
    fields: {},
  }) as MePermissionsResponse;

function renderHome() {
  return render(
    <MePermissionsProvider initialPermissions={permissions()}>
      <HomePage />
    </MePermissionsProvider>,
  );
}

beforeEach(() => {
  navigateMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetRuntimeConfigForTesting();
});

describe('Home on a runtime deployed with OS_CLOUD_URL=off (objectui#5504)', () => {
  beforeEach(async () => {
    await bootOn(serverConfig('', false));
  });

  it('greys out the template cover and says why, in the user’s language', () => {
    renderHome();

    expect(screen.getByTestId('home-start-template')).toBeDisabled();
    expect(screen.getByTestId('home-marketplace-disabled-reason')).toHaveTextContent(
      '«home.template.marketplaceDisabled»',
    );
  });

  it('withholds the "Browse App Marketplace" shortcut — it targets the same 404', () => {
    renderHome();
    expect(screen.queryByTestId('browse-marketplace-btn')).toBeNull();
  });

  it('does not navigate into the dead end when the withheld cover is clicked', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByTestId('home-start-template'));

    // The greyed-out cover must be genuinely inert, not merely look it: landing
    // on the red card is the injury this card is about.
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('leaves the marketplace-independent builder entry alone', () => {
    // "Build an app" goes to /studio and needs no catalog. A gate that swept it
    // up would remove the product front door from every air-gapped deployment.
    renderHome();
    expect(screen.getByTestId('home-build-app')).toBeEnabled();
  });
});

describe('Home on a runtime that HAS a marketplace', () => {
  it('recommends it exactly as before', async () => {
    await bootOn(serverConfig('https://cloud.objectos.ai', true));
    const user = userEvent.setup();
    renderHome();

    const template = screen.getByTestId('home-start-template');
    expect(template).toBeEnabled();
    expect(screen.getByTestId('browse-marketplace-btn')).toBeInTheDocument();
    // No reason line when there is nothing to explain.
    expect(screen.queryByTestId('home-marketplace-disabled-reason')).toBeNull();

    await user.click(template);
    expect(navigateMock).toHaveBeenCalledWith('/apps/setup/system/marketplace');
  });

  it('fails OPEN when the runtime answers no config at all', async () => {
    resetRuntimeConfigForTesting();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await initRuntimeConfig();

    renderHome();

    // A build predating `/api/v1/runtime/config` keeps its defaults. Withholding
    // a working capability on an unanswered question is the worse direction.
    expect(screen.getByTestId('home-start-template')).toBeEnabled();
    expect(screen.getByTestId('browse-marketplace-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('home-marketplace-disabled-reason')).toBeNull();
  });
});
