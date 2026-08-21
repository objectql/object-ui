// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Home stops offering the metadata-authoring front door on a deployment whose
 * own runtime config says authoring is not offered here (objectui#5521).
 *
 * ## The defect
 *
 * On the composed hosted-SaaS shape (`OS_TENANCY_POSTURE=isolated`), Home led a
 * plain tenant with "Build an app — start from scratch, design objects, forms,
 * automations and interfaces". Behind it: `/api/v1/meta/*` → 403 and a
 * ToolRegistry holding zero authoring handlers. The lockdown criterion for that
 * shape is two-part — UI entry hidden AND API refused — and only the backend
 * half was green.
 *
 * `features.aiStudio` is the server's own answer to "is AI-driven metadata
 * authoring offered by this runtime". It was *wrong* on this shape until
 * cloud#1471 derived it from the same resolution that decides the agent mount;
 * before that it leaked a default `true` and honouring it here would have
 * hidden nothing. It is truthful now, and this page did not read it.
 *
 * ## Why HIDDEN rather than dimmed
 *
 * The flag's declared meaning, on both sides of the wire, is *hide*:
 * `RuntimeFeatures.aiStudio` documents "when false, the SPA hides the AI
 * authoring affordances", and the serving plugin documents "set false to
 * force-hide the authoring UI". The sibling `features.marketplace` means
 * something different — reachability of a route — which is why objectui#5504
 * correctly rendered *it* as a dimmed card plus a visible reason. Two flags,
 * two declared meanings, two presentations.
 *
 * ## Why these cases drive the REAL runtime-config module
 *
 * Verbatim from `HomePage.marketplaceDisabled.test.tsx`: the claim under test is
 * that the gate consumes the SERVER's `features.aiStudio`, so every case boots
 * the genuine `initRuntimeConfig()` over a stubbed `GET /api/v1/runtime/config`
 * rather than mocking an accessor. Mocking the accessor would pass against a
 * page that never asks the server anything.
 *
 * ## Why `t` returns «key»
 *
 * The reason lines must resolve THROUGH i18n. Verbatim from
 * `HomePage.authoringCapabilityGate.test.tsx`, which states the argument in full.
 *
 * ## Guarding the vacuum
 *
 * The acceptance condition is that something does NOT render, which an empty
 * page reproduces perfectly. So every denial case also asserts the furniture it
 * is denying *around* — the app tile the strip renders and the sibling template
 * cover — and the counter-probes drive the SAME fixture through the SAME helper
 * with the flag flipped and find the card. An empty render fails the denials'
 * counter-assertions; a gate stuck open fails the denials; a gate that swept the
 * whole cover fails the sibling assertion. None of the three can pass alone.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
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

/**
 * A `GET /api/v1/runtime/config` answer, as the server sends it.
 *
 * `features` is spread from a caller-supplied partial rather than built from
 * named booleans, so a case can OMIT `aiStudio` entirely — the fail-open case
 * below turns on the difference between "absent" and "false", and a signature
 * taking `aiStudio: boolean` could not express it.
 */
const serverConfig = (features: Record<string, unknown>) => ({
  cloudUrl: 'https://cloud.objectos.ai',
  singleEnvironment: true,
  features: { installLocal: true, marketplace: true, autoPublishAiBuilds: true, ...features },
  branding: { productName: 'ObjectOS', productShortName: 'ObjectOS' },
});

async function bootOn(body: Record<string, unknown>) {
  resetRuntimeConfigForTesting();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
  await initRuntimeConfig();
}

/**
 * An admin who MAY author metadata — so the PRINCIPAL half of the gate is wide
 * open and only the DEPLOYMENT flag can move the verdict. Without
 * `manage_metadata` here, every denial below would pass for the wrong reason.
 */
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

describe('Home on a runtime reporting features.aiStudio: false (objectui#5521)', () => {
  beforeEach(async () => {
    await bootOn(serverConfig({ aiStudio: false }));
  });

  it('withholds the "Build an app" cover entirely — not dimmed, gone', () => {
    renderHome();

    expect(screen.queryByTestId('home-build-app')).toBeNull();
    // Counter-probe against a page that rendered NOTHING: the strip behind the
    // cover is still there with the workspace's app on it.
    expect(screen.getByTestId('app-tile-crm')).toBeInTheDocument();
  });

  it('leaves the sibling template cover standing — this gate is not a cover-wide sweep', () => {
    renderHome();

    // "Start with a template" installs a marketplace package; that is not AI
    // metadata authoring and it answers to its own flags. A gate that swept the
    // whole builder cover would remove it from every runtime that merely
    // switched AI Studio off, and would still pass the assertion above.
    const template = screen.getByTestId('home-start-template');
    expect(template).toBeInTheDocument();
    expect(template).toBeEnabled();
  });

  it('offers no route into the authoring surface it just withheld', () => {
    renderHome();

    // The withheld card's destination. Nothing on the rendered page may reach
    // `/studio` on its own — `StudioRoute` would bounce this principal anyway,
    // and walking them there to be bounced is the defect, not the remedy.
    expect(navigateMock).not.toHaveBeenCalledWith('/studio');
  });

  it('does not borrow the per-principal reason line to explain a deployment fact', () => {
    renderHome();

    // `home.build.noCapability` says the account lacks "Manage Metadata". This
    // admin HOLDS it (see `permissions()`); the surface is absent for everyone.
    // Rendering that line here would be the objectui#5557 misdirection —
    // sending a viewer to ask for a permission that would not help them.
    expect(screen.queryByTestId('home-authoring-gate-reason')).toBeNull();
  });
});

describe('Home on the measured composed hosted-SaaS shape (objectui#5521)', () => {
  it('withholds authoring while keeping objectui#5504’s explained marketplace state', async () => {
    // Both flags false at once — the shape the card measured. The two gates must
    // compose rather than shadow each other.
    await bootOn(serverConfig({ aiStudio: false, marketplace: false, installLocal: false }));
    renderHome();

    expect(screen.queryByTestId('home-build-app')).toBeNull();
    expect(screen.getByTestId('home-start-template')).toBeDisabled();
    expect(screen.getByTestId('home-marketplace-disabled-reason')).toHaveTextContent(
      '«home.template.marketplaceDisabled»',
    );
    expect(screen.queryByTestId('browse-marketplace-btn')).toBeNull();
    expect(screen.getByTestId('app-tile-crm')).toBeInTheDocument();
  });
});

describe('Home on a runtime that DOES offer AI Studio', () => {
  it('keeps the "Build an app" cover exactly as before', async () => {
    // Same fixture, same helper, one flag flipped — so the denials above cannot
    // be passing because the card never renders in this suite at all.
    await bootOn(serverConfig({ aiStudio: true }));
    renderHome();

    const build = screen.getByTestId('home-build-app');
    expect(build).toBeInTheDocument();
    expect(build).toBeEnabled();
  });

  it('fails OPEN when the runtime reports no aiStudio key at all', async () => {
    // A server predating the flag answers a `features` map without it. Absent is
    // not `false`: withholding the product's front door on an unanswered
    // question is the worse direction, and it is the doctrine `!== false`
    // already encodes for `features.marketplace`.
    await bootOn(serverConfig({}));
    renderHome();

    expect(screen.getByTestId('home-build-app')).toBeEnabled();
  });

  it('fails OPEN when the runtime answers no config at all', async () => {
    resetRuntimeConfigForTesting();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await initRuntimeConfig();

    renderHome();

    expect(screen.getByTestId('home-build-app')).toBeEnabled();
  });
});
