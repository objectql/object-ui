// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Home's metadata-authoring CTAs are gated on the SERVER's capability answer
 * (objectstack#8270).
 *
 * ## The defect
 *
 * On the EE single-database multi-tenant deployment a workspace owner holds
 * `org_owner` + `organization_admin` but NOT `manage_metadata`. `HomePage`
 * gated its builder cover on `useIsWorkspaceAdmin()`, which reads the session's
 * POSITIONS (spelled `roles` until framework ADR-0090 D3 renamed it; see
 * objectui#5389) and finds `org_owner` there — so that owner saw "Build an app"
 * as the most prominent thing on their home page,
 * followed it into `/studio`, filled in the new-package dialog, and got a raw
 * English capability refusal at submit.
 *
 * The maintainer ruled (2026-08-13) that the missing grant is INTENDED — hosted
 * tenants do not author metadata — so the fix is presentational: the authoring
 * entry points are withheld with a visible, localized reason instead of leading
 * into a refusal.
 *
 * ## Why this file drives the REAL provider
 *
 * The ruling requires the gate to *consume the server's answer* rather than
 * re-derive permission logic client-side. Mocking `usePermissions` would assert
 * against a hand-written stand-in for that derivation and prove nothing about
 * it, so these cases mount the real `MePermissionsProvider` over the real
 * `/me/permissions` payload shape (`initialPermissions`, the provider's own
 * test/SSR seam) and let the genuine `systemPermissions` → `hasCapabilities`
 * path run. The payload in `eePayload` is the one recorded on the issue.
 *
 * ## Why `t` returns «key»
 *
 * The reason copy must resolve THROUGH i18n — an untranslated English sentence
 * at the point of refusal is half of what the card is about. A `t` that echoed
 * `defaultValue` would render identical text whether or not the key were wired,
 * so it echoes the KEY instead: an assertion on `«home.build.noCapability»`
 * fails if the string is ever hardcoded. That the key exists in all ten packs,
 * and that the call site's inline default matches `en`, is enforced separately
 * and mechanically by `all-locales-key-parity.test.ts` and `check:i18n-keys`.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// The persona under test is an ADMIN by role in every case below — that is
// precisely the defect: role said yes, capability said no, and only role was
// consulted. Cases that vary the capability keep this fixed at `true`.
vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Zhang San', email: 'zhangsan@acme-test.com' } }),
  useIsWorkspaceAdmin: () => true,
}));

// An authoring-capable AI agent IS deployed in every case, so "Build with AI"
// is held back only by the capability gate under test and never by the
// unrelated cloud#816 agent-availability gate.
vi.mock('@object-ui/plugin-chatbot', () => ({
  useAgents: () => ({ agents: [{ name: 'builder' }] }),
  isAskAgent: () => false,
  agentHasCapability: () => true,
}));

let appsFixture: any[] = [];

vi.mock('../../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ apps: appsFixture, loading: false }),
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
vi.mock('../../../runtime-config', () => ({
  getRuntimeConfig: () => ({ branding: { productName: 'ObjectStack' } }),
  // objectui#5504 — Home now asks the runtime whether it has a marketplace at
  // all. `true` keeps every case in this file on the pre-existing behaviour;
  // the gate itself is covered by `HomePage.marketplaceDisabled.test.tsx`,
  // which drives the REAL module instead of this stand-in.
  isMarketplaceEnabled: () => true,
}));

import { HomePage } from '../HomePage';

/**
 * The `/me/permissions` answer recorded on objectstack#8270 for the EE
 * workspace owner. `systemPermissions` is present and NON-empty — it simply
 * does not contain `manage_metadata`.
 */
const eePayload = (systemPermissions?: string[]): MePermissionsResponse =>
  ({
    authenticated: true,
    userId: 'u1',
    tenantId: 'acme',
    roles: ['org_owner', 'everyone'],
    permissionSets: ['organization_admin', 'member_default'],
    ...(systemPermissions ? { systemPermissions } : {}),
    objects: {},
    fields: {},
  }) as MePermissionsResponse;

const OWNER_CAPS = ['manage_org_users', 'setup.access', 'setup.write'];

function renderHome(permissions: MePermissionsResponse) {
  return render(
    <MePermissionsProvider initialPermissions={permissions}>
      <HomePage />
    </MePermissionsProvider>,
  );
}

describe('HomePage authoring-CTA capability gate (objectstack#8270)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    appsFixture = [{ name: 'crm', label: 'CRM' }];
  });

  describe('the ruled case — admin by role, no `manage_metadata`', () => {
    it('disables both builder CTAs and says why, in the user’s language', async () => {
      renderHome(eePayload(OWNER_CAPS));

      expect(screen.getByTestId('home-build-app')).toBeDisabled();
      expect(screen.getByTestId('home-start-template')).toBeDisabled();
      // The reason is on screen — not only in a tooltip, and not English text
      // baked into the component.
      expect(screen.getByTestId('home-authoring-gate-reason')).toHaveTextContent(
        '«home.build.noCapability»',
      );
    });

    it('does not navigate into the dead end when the withheld CTA is clicked', async () => {
      const user = userEvent.setup();
      renderHome(eePayload(OWNER_CAPS));

      await user.click(screen.getByTestId('home-build-app'));
      await user.click(screen.getByTestId('home-start-template'));

      // `/studio` is where the new-package dialog lives; reaching it was the
      // whole defect. A disabled button must not merely look inert.
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('withholds the marketplace shortcut too — it targets the same route', () => {
      // Gating "Start with a template" while leaving this live would make the
      // gate cosmetic: both navigate to /apps/setup/system/marketplace.
      renderHome(eePayload(OWNER_CAPS));
      expect(screen.queryByTestId('browse-marketplace-btn')).toBeNull();
    });

    it('withholds "Build with AI" — its output is metadata nobody here may publish', () => {
      renderHome(eePayload(OWNER_CAPS));
      expect(screen.queryByTestId('home-build-with-ai')).toBeNull();
    });
  });

  describe('the capability present — nothing is withheld', () => {
    it('leaves every authoring CTA live and routes "Build an app" to /studio', async () => {
      const user = userEvent.setup();
      renderHome(eePayload([...OWNER_CAPS, 'manage_metadata']));

      const build = screen.getByTestId('home-build-app');
      expect(build).toBeEnabled();
      expect(screen.getByTestId('home-start-template')).toBeEnabled();
      expect(screen.getByTestId('browse-marketplace-btn')).toBeInTheDocument();
      expect(screen.getByTestId('home-build-with-ai')).toBeInTheDocument();
      // No reason line when there is nothing to explain.
      expect(screen.queryByTestId('home-authoring-gate-reason')).toBeNull();

      await user.click(build);
      expect(navigateMock).toHaveBeenCalledWith('/studio');
    });
  });

  describe('unknown capabilities fail OPEN', () => {
    it('keeps the CTAs live when the backend reports no capabilities at all', () => {
      // A deployment predating ADR-0066 sends no `systemPermissions` at all —
      // the key is OMITTED from the response. `MePermissionsProvider` now
      // preserves that as `undefined`, distinct from a genuinely empty grant,
      // and `hasCapabilities` fails OPEN on it. Reading it as "denied" would
      // strip the product's front door from every admin on such a deployment;
      // the server still refuses the write either way, so unknown opens (the
      // doctrine `useCapabilityGate` states for ADR-0066 gates).
      renderHome(eePayload(undefined));

      expect(screen.getByTestId('home-build-app')).toBeEnabled();
      expect(screen.getByTestId('home-start-template')).toBeEnabled();
      expect(screen.queryByTestId('home-authoring-gate-reason')).toBeNull();
    });
  });

  describe('a REPORTED empty systemPermissions is not confused with absent (objectui#4656)', () => {
    it('disables the CTAs when the backend explicitly reports zero capabilities', () => {
      // Distinct from the case above: `systemPermissions` is PRESENT here —
      // literally `[]` — meaning the server gave a real answer: this session
      // holds no system capabilities at all. Before objectui#4656 this was
      // indistinguishable from the omitted-field case (both collapsed to `[]`
      // upstream) and so incorrectly fell open too; a real empty grant must
      // gate exactly like any other reported set that lacks the capability.
      renderHome(eePayload([]));

      expect(screen.getByTestId('home-build-app')).toBeDisabled();
      expect(screen.getByTestId('home-start-template')).toBeDisabled();
      expect(screen.getByTestId('home-authoring-gate-reason')).toHaveTextContent(
        '«home.build.noCapability»',
      );
    });
  });

  describe('the zero-app workspace', () => {
    beforeEach(() => {
      appsFixture = [];
    });

    it('explains the posture instead of telling the owner to build something', () => {
      // This branch renders before the builder cover exists, and its admin copy
      // ("set up your first application from the Administration menu") is the
      // same dead end in prose. A brand-new EE workspace lands here first.
      renderHome(eePayload(OWNER_CAPS));

      expect(screen.getByTestId('home-authoring-gate-reason-empty')).toHaveTextContent(
        '«home.build.noCapability»',
      );
      expect(screen.queryByText('«home.welcomeAdminDescriptionNoAi»')).toBeNull();
      expect(screen.queryByText('«home.welcomeAdminDescription»')).toBeNull();
      expect(screen.queryByTestId('home-build-with-ai')).toBeNull();
    });

    it('keeps the ordinary admin welcome when the capability IS held', () => {
      renderHome(eePayload([...OWNER_CAPS, 'manage_metadata']));

      expect(screen.queryByTestId('home-authoring-gate-reason-empty')).toBeNull();
      expect(screen.getByTestId('home-build-with-ai')).toBeInTheDocument();
    });
  });
});
