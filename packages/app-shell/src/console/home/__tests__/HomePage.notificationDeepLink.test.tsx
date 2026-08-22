// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Home's "Needs your attention" rows follow a notification's deep link INTO an
 * app (objectui#5179).
 *
 * ## The defect
 *
 * `action_url` is **app-relative** by contract. The producer says so in as many
 * words — `service-messaging`'s `actionUrlFor()` synthesizes
 * `/{object}/{id}` "so the materialization is self-sufficient for navigation
 * (ADR-0030 L5)" — and its own pins carry that shape (`/showcase_task/t_42`,
 * `/opportunities/42`). It names a RECORD, not a console route: the app that
 * hosts it is the client's to resolve, exactly as for `sys_inbox_message` and
 * `sys_activity` next door.
 *
 * `onOpenNotification` navigated `n.actionUrl` verbatim, so the app-relative
 * path was handed to the router as if it were absolute. `/showcase_task/t_42`
 * matches no route, the console's catch-all (`apps/console/src/App.tsx`,
 * `<Route path="*" element={<Navigate to="/" replace />} />`) forwards it to
 * `/`, and `RootLandingRedirect` resolves that to `/apps/<default app>` — the
 * app landing page, which is precisely what the card reports.
 *
 * ## Why the existing pin did not catch it
 *
 * `HomePage.inboxLinksTarget.test.tsx`'s CONTROL case seeds
 * `actionUrl: '/apps/acme/invoice/42'` — a path already carrying its `/apps/`
 * segment, i.e. the one shape that survives being navigated verbatim. The
 * producer never emits it. These cases seed the shape the producer actually
 * emits.
 *
 * ## What these cases assert
 *
 * The RESOLVED TARGET — the argument `navigate()` receives — per the card's
 * ruling that a test asserting only "navigation happened" passes against the
 * bug. Nothing about the far end: whether the record renders is the card's
 * second, already-verified control.
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

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Ada', email: 'ada@example.com' } }),
  useWorkspaceAdminStatus: () => ({ isAdmin: false, isResolved: true }),
}));

vi.mock('@object-ui/plugin-chatbot', () => ({
  useAgents: () => ({ agents: [] }),
  isAskAgent: () => false,
  agentHasCapability: () => false,
}));

let appsFixture: any[] = [];
let currentAppNameFixture: string | undefined;

vi.mock('../../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ apps: appsFixture, loading: false }),
}));

vi.mock('../../../context/NavigationContext', () => ({
  useNavigationContext: () => ({ currentAppName: currentAppNameFixture }),
}));

let notificationsFixture: any[] = [];

vi.mock('../../../hooks/useRecentItems', () => ({ useRecentItems: () => ({ recentItems: [] }) }));
vi.mock('../../../hooks/useFavorites', () => ({ useFavorites: () => ({ favorites: [] }) }));
vi.mock('../../../hooks/useHomeInbox', () => ({
  useHomeInbox: () => ({
    pendingApprovalsCount: 0,
    notifications: notificationsFixture,
    unreadTopicCount: notificationsFixture.length,
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

/** Click the seeded notification row and read the argument `navigate()` got. */
async function clickNotification(): Promise<string> {
  const user = userEvent.setup();
  render(<HomePage />);
  await user.click(screen.getByText('Weekly digest'));
  expect(navigateMock).toHaveBeenCalledTimes(1);
  return navigateMock.mock.calls[0][0] as string;
}

describe('Home notification rows follow the deep link to the record (objectui#5179)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    appsFixture = [app('setup'), app('crm')];
    currentAppNameFixture = 'crm';
    notificationsFixture = [
      { id: 'n1', title: 'Weekly digest', actionUrl: '/showcase_task/t_42' },
    ];
  });

  it('hosts the app-relative action_url under the app the user last had open', async () => {
    // The exact shape `actionUrlFor()` synthesizes from `source: {object, id}`.
    expect(await clickNotification()).toBe('/apps/crm/showcase_task/t_42');
  });

  it('does NOT navigate the app-relative path verbatim', async () => {
    // The bug, stated as its own case: `/showcase_task/t_42` matches no route,
    // so the console catch-all forwards it to `/` and the landing resolver
    // lands the user on the default app's home — with the notification already
    // marked read, so the pointer to the record is gone.
    const target = await clickNotification();
    expect(target).not.toBe('/showcase_task/t_42');
    expect(target.startsWith('/apps/')).toBe(true);
  });

  it('resolves the host app on a cold landing at /home, where no app is remembered', async () => {
    // Home renders OUTSIDE `/apps/:appName/*`, so there is no route segment to
    // read and `currentAppName` is undefined until the user has opened an app.
    // An unresolved host is what produced the bare path in the first place.
    appsFixture = [app('crm'), app('hr')];
    currentAppNameFixture = undefined;
    expect(await clickNotification()).toBe('/apps/crm/showcase_task/t_42');
  });

  it('does not resurrect a remembered app that is no longer active', async () => {
    // Same re-check `resolveHostAppSegment` already applies to the inbox and
    // activity drills — a link into a deactivated app is not reachable either.
    appsFixture = [app('hr')];
    currentAppNameFixture = 'crm';
    expect(await clickNotification()).toBe('/apps/hr/showcase_task/t_42');
  });

  it('CONTROL: a target that already names its app is followed verbatim', async () => {
    // An explicit `payload.url` wins over the synthesized link at the producer
    // and may already be a full console route. Hosting it twice
    // (`/apps/crm/apps/acme/...`) would break the case that works today.
    notificationsFixture = [
      { id: 'n1', title: 'Weekly digest', actionUrl: '/apps/acme/invoice/42' },
    ];
    expect(await clickNotification()).toBe('/apps/acme/invoice/42');
  });

  it('CONTROL: a notification with no action_url still opens the full inbox', async () => {
    // The objectui#4074 fallback arm — unchanged, and pinned next door in
    // `HomePage.inboxLinksTarget.test.tsx`. Repeated here so a change to the
    // deep-link path cannot quietly swallow the no-link case.
    notificationsFixture = [{ id: 'n1', title: 'Weekly digest' }];
    expect(await clickNotification()).toBe('/apps/crm/sys_inbox_message?view=mine');
  });
});
