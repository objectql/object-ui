// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Home's inbox / activity drills — which APP hosts them (objectui#4074).
 *
 * ## The defect
 *
 * objectstack#7231 fixed ONE producer on this page (the pending-approvals card,
 * pinned next door in `HomePage.approvalsTarget.test.tsx`) and left its two
 * siblings hardcoding the same dead app:
 *
 *   - `onOpenNotification`'s FALLBACK branch → `/apps/setup/sys_inbox_message?view=mine`
 *   - `HomeActivity onViewAll`               → `/apps/setup/sys_activity`
 *
 * `sys_inbox_message` and `sys_activity` are framework-owned objects, reachable
 * at `/apps/{any app}/{object}` exactly like `system/approvals` — so naming
 * `setup` in the URL is a claim about the APP, not about the page. Two browser
 * verifications on the card measured what that claim costs: a business user
 * whose app list does not contain `setup` lands on "You don't have access", and
 * EVERY user is switched out of the app they were in (sidebar and app switcher
 * flip to Setup) with no announcement.
 *
 * ## What these cases assert, and what they deliberately do not
 *
 * They assert the RESOLVED TARGET — the argument `navigate()` receives. They say
 * nothing about what renders at the far end: objectstack#7344 (no shipped
 * permission set grants `sys_inbox_message`) is a second, independent cause, so
 * the destination may still show the no-access empty state after this fix. The
 * routing fix is necessary, not sufficient, and pinning the far end here would
 * pin someone else's defect.
 *
 * ## Scope of the stubs
 *
 * Same shape as `HomePage.approvalsTarget.test.tsx`: every hook `HomePage` calls
 * for an unrelated surface is stubbed at its module boundary, while `HomeRail` /
 * `HomeAppsStrip` — which own the buttons and their testids — stay real, because
 * "the click reaches the right URL" is not assertable through a stubbed button.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
    language: 'en',
  }),
}));

let isAdminFixture = false;
vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Ada', email: 'ada@example.com' } }),
  useIsWorkspaceAdmin: () => isAdminFixture,
}));

vi.mock('@object-ui/plugin-chatbot', () => ({
  useAgents: () => ({ agents: [] }),
  isAskAgent: () => false,
  agentHasCapability: () => false,
}));

// --- the app list + the remembered app: the two inputs under test -----------
let appsFixture: any[] = [];
let currentAppNameFixture: string | undefined;

vi.mock('../../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ apps: appsFixture, loading: false }),
}));

vi.mock('../../../context/NavigationContext', () => ({
  useNavigationContext: () => ({ currentAppName: currentAppNameFixture }),
}));

// --- the inbox feed: notifications with and without an `action_url` ---------
let notificationsFixture: any[] = [];
let activitiesFixture: any[] = [];

vi.mock('../../../hooks/useRecentItems', () => ({ useRecentItems: () => ({ recentItems: [] }) }));
vi.mock('../../../hooks/useFavorites', () => ({ useFavorites: () => ({ favorites: [] }) }));
vi.mock('../../../hooks/useHomeInbox', () => ({
  useHomeInbox: () => ({
    pendingApprovalsCount: 0,
    notifications: notificationsFixture,
    unreadTopicCount: notificationsFixture.length,
    activities: activitiesFixture,
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
  // objectui#5577 — same treatment for the AI-authoring gate, which Home now
  // reads through `isAiStudioEnabled()` rather than inline. An explicit factory
  // replaces the WHOLE module, so an export it does not list is `undefined` at
  // the call site — i.e. omitting this line is a TypeError here, not a default.
  // `true` keeps every case in this file on the pre-existing behaviour; the gate
  // itself is covered by `HomePage.aiStudioDisabled.test.tsx`, which drives the
  // REAL module instead of this stand-in.
  isAiStudioEnabled: () => true,
}));

import { HomePage } from '../HomePage';

const app = (name: string, extra: Record<string, unknown> = {}) => ({ name, label: name, ...extra });

async function clickAndReadTarget(open: (user: ReturnType<typeof userEvent.setup>) => Promise<void>) {
  const user = userEvent.setup();
  render(<HomePage />);
  await open(user);
  expect(navigateMock).toHaveBeenCalledTimes(1);
  return navigateMock.mock.calls[0][0] as string;
}

/** Click the "Needs your attention" row for the single seeded notification. */
const clickNotification = () =>
  clickAndReadTarget(async (user) => {
    await user.click(screen.getByText('Weekly digest'));
  });

/** Click HomeActivity's "View all activity" footer link. */
const clickViewAllActivity = () =>
  clickAndReadTarget(async (user) => {
    await user.click(screen.getByText('View all activity'));
  });

describe('Home inbox/activity drills resolve the host app (objectui#4074)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    appsFixture = [app('setup'), app('crm')];
    currentAppNameFixture = 'crm';
    isAdminFixture = false;
    notificationsFixture = [{ id: 'n1', title: 'Weekly digest' }];
    activitiesFixture = [];
  });

  describe('the notification fallback branch (no action_url)', () => {
    it('opens the inbox inside the app the user last had open', async () => {
      // The branch neither browser verification could exercise — both seeded
      // notifications carried an `action_url`. This is its pin.
      expect(await clickNotification()).toBe('/apps/crm/sys_inbox_message?view=mine');
    });

    it('CONTROL: an explicit action_url is still followed verbatim', async () => {
      // The fallback must not start rewriting targets the messaging pipeline
      // already resolved (ADR-0030) — only the `||` arm is in scope here.
      notificationsFixture = [
        { id: 'n1', title: 'Weekly digest', actionUrl: '/apps/acme/invoice/42' },
      ];
      expect(await clickNotification()).toBe('/apps/acme/invoice/42');
    });

    it('falls back to the first active app on a cold landing at /home', async () => {
      appsFixture = [app('crm'), app('hr')];
      currentAppNameFixture = undefined;
      const target = await clickNotification();
      expect(target).toBe('/apps/crm/sys_inbox_message?view=mine');
      expect(target).not.toContain('/apps/setup/');
    });

    it('does not resurrect a remembered app that is no longer active', async () => {
      appsFixture = [app('hr')];
      currentAppNameFixture = 'crm';
      expect(await clickNotification()).toBe('/apps/hr/sys_inbox_message?view=mine');
    });

    it('CONTROL: a user whose last-open app IS setup still lands in setup', async () => {
      // The tail of the fallback order is not "never setup" — it is "the app
      // this user can actually open", and for an admin sitting in Setup that
      // app is setup.
      appsFixture = [app('setup'), app('crm')];
      currentAppNameFixture = 'setup';
      expect(await clickNotification()).toBe('/apps/setup/sys_inbox_message?view=mine');
    });
  });

  describe('the activity drill', () => {
    beforeEach(() => {
      activitiesFixture = [
        { id: 'a1', user: 'Ada', description: 'updated an account', objectName: 'account', timestamp: new Date().toISOString() },
      ];
    });

    it('opens the activity list inside the app the user last had open', async () => {
      expect(await clickViewAllActivity()).toBe('/apps/crm/sys_activity');
    });

    it('falls back to the first active app on a cold landing at /home', async () => {
      appsFixture = [app('crm'), app('hr')];
      currentAppNameFixture = undefined;
      const target = await clickViewAllActivity();
      expect(target).toBe('/apps/crm/sys_activity');
      expect(target).not.toContain('/apps/setup/');
    });

    it('addresses the app by its package segment when it has one', async () => {
      appsFixture = [app('crm', { _packageId: 'acme-crm' })];
      currentAppNameFixture = 'acme-crm';
      expect(await clickViewAllActivity()).toBe('/apps/acme-crm/sys_activity');
    });
  });

  it('CONTROL: the admin-scoped marketplace link is NOT swept in and stays on setup', async () => {
    // objectui#4074 excludes `/apps/setup/system/marketplace` (and the sibling
    // `/apps/setup/system/apps`) by name: an admin-only surface where `setup` is
    // the deliberate target, not an oversight. A fix that "helpfully" resolved
    // it too would be out of scope.
    isAdminFixture = true;
    appsFixture = [app('setup'), app('crm')];
    currentAppNameFixture = 'crm';

    const target = await clickAndReadTarget(async (user) => {
      await user.click(screen.getByTestId('browse-marketplace-btn'));
    });
    expect(target).toBe('/apps/setup/system/marketplace');
  });
});
