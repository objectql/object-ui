// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * #4235 — Home's action centre said "You're all caught up" to a user with nine
 * unread messages, and showed no badge.
 *
 * ## What the card reported, and what it actually was
 *
 * The card read the symptom as a WRONG SOURCE: `useHomeInbox` polls
 * `sys_inbox_message` rather than `/api/v1/notifications`. Measured, the source
 * is right and sanctioned. ADR-0030 names the table read as the consumer
 * channel in three places — the L5 row of its object model ("**the bell reads
 * `sys_inbox_message`**"), the P0 phase ("UI bell reads `sys_inbox_message`"),
 * and the cross-repo cut-over ("Repoint the Console bell … to
 * **`sys_inbox_message`** (the `mine` view), joining `sys_notification_receipt`
 * for read-state") — and `/api/v1/notifications` is a PROJECTION of those very
 * rows: `MessagingService.listInbox` reads `sys_inbox_message` where
 * `user_id`, ordered `created_at desc`, joined with the same receipts. Reading
 * the table is reading the API's own source, one hop earlier.
 *
 * ## The condition that decided it — and it is not staleness
 *
 * Two QA runs on the SAME console pin `09987b68` recorded opposite things:
 * objectstack#7514 saw this panel empty with 9 unread, objectstack#7517 used it
 * as the WORKING control against the dead bell. Both are true, of different
 * users. objectstack#7344 measured the mechanism in a browser on 2026-08-10:
 *
 *     [Security] Access denied: operation 'find' on object 'sys_inbox_message'
 *     is not permitted for positions [org_member, contributor, finance, everyone]
 *
 * — every inbox read `403 PERMISSION_DENIED` for a plain member, because no
 * shipped permission set granted the object, while `/api/v1/notifications`
 * (a dedicated authenticated route, not the generic data API) answered with
 * their unread rows. An admin session read the table and the card worked. So
 * the flip is the SIGNED-IN USER'S PERMISSION SET, not the console build.
 *
 * The 403 itself is closed server-side by objectstack#7586 (owner-scoped member
 * grants, merged 2026-08-11). What is NOT closed, and is what these cases pin,
 * is that the console turned that denial into good news: `useHomeInbox` caught
 * every failure to `[]`, and `HomeActionCenter` renders the affirmative empty
 * copy on an empty array. Any future denial, outage or malformed answer
 * reproduces the identical silent lie — the grant fixed one cause of a symptom
 * that had no cause-independent guard.
 *
 * ## The oracle
 *
 * Real `useHomeInbox` + real `HomeActionCenter`, wired as `HomePage` wires them,
 * against a fake adapter. Nothing about the REST layer is pinned here — the
 * adapter boundary is where a denial becomes a rejected promise, and that is the
 * hop under test.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    language: 'en',
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key),
  }),
}));

/** `null` is the pre-auth / still-settling session, not a user with no mail. */
let userFixture: { id: string } | null = { id: 'u1' };
vi.mock('@object-ui/auth', () => ({ useAuth: () => ({ user: userFixture }) }));

/** What `find('sys_inbox_message')` does for the current case. */
let inboxBehaviour: () => Promise<unknown> = async () => ({ data: [] });
const findCalls: Array<{ object: string; query: unknown }> = [];
const fakeAdapter = {
  find: (object: string, query: unknown) => {
    findCalls.push({ object, query });
    if (object === 'sys_inbox_message') return inboxBehaviour();
    return Promise.resolve({ data: [] });
  },
};
/** `null` is "no adapter yet" — the other half of the not-asked-yet state. */
let adapterFixture: unknown = fakeAdapter;
vi.mock('../../../providers/AdapterProvider', () => ({ useAdapter: () => adapterFixture }));

/**
 * The other two feeds are #4197's shared store and are not this card's subject;
 * stubbing them keeps the approvals addend a dial this suite can set directly.
 */
let approvalsFixture = 0;
vi.mock('../../../hooks/sharedUserFeeds', () => ({
  useSharedPendingApprovalsCount: () => approvalsFixture,
  useHumanActivityFeed: () => [],
}));

import { useHomeInbox } from '../../../hooks/useHomeInbox';
import { HomeActionCenter } from '../HomeRail';

/** Exactly `HomePage`'s wiring of the two — the seam the card indicts. */
function HomeActionCenterHost() {
  const { pendingApprovalsCount, notifications, notificationsStatus } = useHomeInbox();
  return (
    <HomeActionCenter
      pendingApprovalsCount={pendingApprovalsCount}
      notifications={notifications}
      notificationsStatus={notificationsStatus}
      onOpenApprovals={() => {}}
      onOpenNotification={() => {}}
      t={(key: string, options?: any) => String(options?.defaultValue ?? key)}
    />
  );
}

/** The QA shape: nine unread rows for this user, as the L5 channel writes them. */
const NINE_UNREAD = Array.from({ length: 9 }, (_, i) => ({
  id: `ibx_${i + 1}`,
  user_id: 'u1',
  notification_id: `ntf_${i + 1}`,
  topic: 'approval.reminder',
  title: `Approval request ${i + 1} needs your decision`,
  action_url: `/apps/crm/sys_approval_request/record/a_${i + 1}`,
  created_at: `2026-08-0${i + 1}T09:00:00Z`,
}));

const CAUGHT_UP = "You're all caught up";
const ERROR_COPY = 'An unexpected error occurred.';
const LOADING_COPY = 'Loading...';

/**
 * The objectstack#7344 rejection, verbatim in shape: the generic data API
 * refusing `find` on the object. NOT a 404 — the object exists, this caller may
 * not read it, and that difference is the whole point of the pair below.
 */
function permissionDenied(): Promise<never> {
  const err = new Error(
    "Access denied: operation 'find' on object 'sys_inbox_message' is not permitted",
  ) as Error & { httpStatus?: number; code?: string };
  err.httpStatus = 403;
  err.code = 'PERMISSION_DENIED';
  return Promise.reject(err);
}

/** The deployment that never installed the messaging pipeline. */
function objectMissing(): Promise<never> {
  const err = new Error('Object not found: sys_inbox_message') as Error & {
    httpStatus?: number;
    code?: string;
  };
  err.httpStatus = 404;
  err.code = 'OBJECT_NOT_FOUND';
  return Promise.reject(err);
}

/** The card's badge: rendered by `Card` only when the count is > 0. */
function badgeText(): string | null {
  const heading = screen.getByText('Needs your attention');
  const badge = heading.parentElement?.querySelector('span.tabular-nums');
  return badge ? badge.textContent : null;
}

beforeEach(() => {
  userFixture = { id: 'u1' };
  adapterFixture = fakeAdapter;
  approvalsFixture = 0;
  inboxBehaviour = async () => ({ data: [] });
  findCalls.length = 0;
});

describe('Home action centre — the affirmative empty state needs an ANSWER (#4235)', () => {
  it('does not claim "all caught up" when the inbox read was DENIED', async () => {
    // The headline case. Nine unread rows exist; this session may not read
    // them. Before #4235 the denial landed as `[]` and the panel said the user
    // was done for the day — the exact pair objectstack#7514 screenshotted.
    inboxBehaviour = permissionDenied;

    render(<HomeActionCenterHost />);

    await waitFor(() => expect(screen.getByTestId('home-action-unanswered')).toBeInTheDocument());
    expect(screen.queryByText(CAUGHT_UP)).not.toBeInTheDocument();
    expect(screen.getByText(ERROR_COPY)).toBeInTheDocument();
  });

  it('does not claim it while the session is still settling (no user yet)', async () => {
    // The unauthenticated / pre-auth arm of the same rule: the effect returns
    // before asking anything, so `[]` here has never been an inbox answer.
    userFixture = null;
    inboxBehaviour = async () => ({ data: NINE_UNREAD });

    render(<HomeActionCenterHost />);

    expect(screen.queryByText(CAUGHT_UP)).not.toBeInTheDocument();
    expect(screen.getByText(LOADING_COPY)).toBeInTheDocument();
    expect(findCalls.filter((c) => c.object === 'sys_inbox_message')).toHaveLength(0);
  });

  it('does not claim it while no adapter has been provided yet', async () => {
    adapterFixture = null;

    render(<HomeActionCenterHost />);

    expect(screen.queryByText(CAUGHT_UP)).not.toBeInTheDocument();
    expect(screen.getByTestId('home-action-unanswered')).toBeInTheDocument();
  });

  it('says so even when the approvals half DID answer', async () => {
    // Half an answer is still not an empty inbox. The list renders the known
    // approvals row AND the notice — the panel never silently drops the half it
    // failed to read.
    approvalsFixture = 2;
    inboxBehaviour = permissionDenied;

    render(<HomeActionCenterHost />);

    await waitFor(() => expect(screen.getByText(ERROR_COPY)).toBeInTheDocument());
    expect(screen.getByTestId('home-action-approvals')).toBeInTheDocument();
    expect(screen.queryByText(CAUGHT_UP)).not.toBeInTheDocument();
  });

  it('CONTROL: a successful, genuinely empty inbox still says "all caught up"', async () => {
    // The copy is not being retired — it is being earned. A quiet workspace
    // must still look intentional rather than broken.
    inboxBehaviour = async () => ({ data: [] });

    render(<HomeActionCenterHost />);

    await waitFor(() => expect(screen.getByText(CAUGHT_UP)).toBeInTheDocument());
    expect(screen.queryByTestId('home-action-unanswered')).not.toBeInTheDocument();
    expect(badgeText()).toBeNull();
  });

  it('CONTROL: a deployment with no inbox object at all is an ANSWER, not an error', async () => {
    // The other polarity of the same predicate, and the reason it is not "any
    // rejection is an error": a community build without service-messaging has
    // no inbox, so nothing is waiting — the hook's documented degradation, and
    // the same `isMissingResource` split `sharedUserFeeds` applies to its feeds.
    // Get this wrong and every such deployment reads an error on Home forever.
    inboxBehaviour = objectMissing;

    render(<HomeActionCenterHost />);

    await waitFor(() => expect(screen.getByText(CAUGHT_UP)).toBeInTheDocument());
    expect(screen.queryByText(ERROR_COPY)).not.toBeInTheDocument();
  });
});

describe('Home action centre — nine unread rows are listed and badged (#4235)', () => {
  it('lists the QA payload and badges it, instead of an empty panel', async () => {
    // The other half of the reported pair: no badge. With the read answering —
    // which is what objectstack#7586 restored for members — the rows are on
    // show and the badge carries their count.
    inboxBehaviour = async () => ({ data: NINE_UNREAD });

    render(<HomeActionCenterHost />);

    await waitFor(() =>
      expect(screen.getByText('Approval request 1 needs your decision')).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Approval request \d+ needs your decision/)).toHaveLength(9);
    expect(badgeText()).toBe('9');
    expect(screen.queryByText(CAUGHT_UP)).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-action-unanswered')).not.toBeInTheDocument();
  });

  it('reads the ADR-0030 `mine` window — user-scoped, newest first', async () => {
    // Pins the source the card questioned, so a later "route it through the
    // notifications API" change has to argue with ADR-0030 rather than slip past
    // it. `/api/v1/notifications` projects exactly this query one hop later.
    inboxBehaviour = async () => ({ data: NINE_UNREAD });

    render(<HomeActionCenterHost />);

    await waitFor(() =>
      expect(screen.getByText('Approval request 1 needs your decision')).toBeInTheDocument(),
    );
    const inboxRead = findCalls.find((c) => c.object === 'sys_inbox_message');
    expect(inboxRead?.query).toMatchObject({
      $filter: { user_id: 'u1' },
      $orderby: { created_at: 'desc' },
      $top: 5,
    });
  });

  it('badges the approvals-only case without the inbox contributing (#4197 control)', async () => {
    approvalsFixture = 3;
    inboxBehaviour = async () => ({ data: [] });

    render(<HomeActionCenterHost />);

    await waitFor(() => expect(screen.getByTestId('home-action-approvals')).toBeInTheDocument());
    expect(badgeText()).toBe('3');
    expect(screen.queryByText(CAUGHT_UP)).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-action-unanswered')).not.toBeInTheDocument();
  });
});
