/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#5203 — the produced inbox row carries exactly what it declares.
 *
 * ## What this is the other half of
 *
 * `InboxNotification` (`layout/inboxGrouping.ts`) used to declare an
 * `actor_name` that was dead at both ends: `mergeInboxRows` below never mapped
 * it, neither consumer (`InboxPopover`, `useHomeInbox`) read it, and
 * `sys_inbox_message` declares no actor column for it to be mapped FROM. The
 * declaration was removed; `inboxGrouping.test.ts` carries the TYPE PIN that
 * stops it being re-declared.
 *
 * A type pin alone cannot see the direction this contract is most likely to rot
 * in, because that direction does not go through the type at all: the producer
 * builds its row from an explicit field-by-field literal, and the cheap
 * "improvement" is to spread the raw `sys_inbox_message` record into it
 * (`{ ...m, is_read }`). That compiles, it is invisible to `tsc`, and it
 * silently re-admits every raw column the backend happens to grow — including
 * an `actor_name` — as an undeclared de-facto field on the UI shape. So this
 * suite feeds the producer a raw row LOADED with columns it does not map and
 * asserts the produced row's key set, not just the absence of one key.
 *
 * ## Reverse verification (direction predicted BEFORE running, measured in this PR)
 *
 *   - replace the producer's explicit literal with a `{ ...m }` pass-through ⇒
 *     both cases here go RED (extra keys present, `actor_name` among them),
 *     while the `inboxGrouping.test.ts` type pin stays GREEN — which is why the
 *     type pin cannot stand in for this one, and both are here;
 *   - re-declare `actor_name` on `InboxNotification` ⇒ this suite stays GREEN
 *     (a declaration nobody fills changes no runtime shape) and the type pin
 *     goes RED. Opposite directions, one per instrument.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/** One signed-in user — the inbox feed reads nothing without one. */
vi.mock('@object-ui/auth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

/**
 * A `sys_inbox_message` row as the L5 materialization writes it, PLUS the
 * columns the UI shape does not map. `severity` and `delivery_id` are real
 * columns on the object today; `actor_name` is deliberately NOT (this is the
 * hypothetical future column the retired field was an invitation to add) — the
 * point of including it is that the producer's answer must be the same either
 * way: an unmapped column does not reach the UI shape.
 */
const RAW_ROW = {
  id: 'ibx_1',
  user_id: 'u1',
  notification_id: 'ntf_1',
  delivery_id: 'dlv_1',
  topic: 'collab.assignment',
  title: 'Assigned to you: Ship it',
  body_md: 'Zhang San assigned you a task.',
  severity: 'info',
  action_url: '/apps/crm/showcase_task/t_42',
  created_at: '2026-08-18T09:00:00Z',
  actor_name: 'Li Si',
};

/** The keys `mergeInboxRows` maps — the whole of `InboxNotification`. */
const DECLARED_KEYS = [
  'action_url',
  'body',
  'created_at',
  'id',
  'is_read',
  'notification_id',
  'receipt_id',
  'title',
  'type',
];

const fakeAdapter = {
  find: (object: string) => {
    if (object === 'sys_inbox_message') return Promise.resolve({ data: [RAW_ROW] });
    // Receipts and activity answer emptily — neither is this suite's subject.
    return Promise.resolve({ data: [] });
  },
  getClient: () => undefined,
};
vi.mock('../../providers/AdapterProvider', () => ({ useAdapter: () => fakeAdapter }));

import { useSharedInboxFeed, __resetSharedUserFeeds } from '../sharedUserFeeds';

/** Let the attach-time read settle without moving the clock past a poll. */
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  // Module-scoped stores outlive any one render tree.
  __resetSharedUserFeeds();
  // Approvals degrade to 0 (404) so nothing here depends on the REST feed.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('objectui#5203 — the inbox producer maps fields, it does not pass rows through', () => {
  it('produces exactly the declared key set from a raw row carrying more', async () => {
    const { result } = renderHook(() => useSharedInboxFeed());
    await settle();

    expect(result.current.status).toBe('ready');
    expect(result.current.value).toHaveLength(1);

    const row = result.current.value[0];
    expect(Object.keys(row).sort()).toEqual(DECLARED_KEYS);
    // The mapping itself still works — otherwise the key-set assertion above
    // could be satisfied by a producer that maps nothing.
    expect(row.title).toBe('Assigned to you: Ship it');
    expect(row.type).toBe('collab.assignment');
    expect(row.body).toBe('Zhang San assigned you a task.');
    expect(row.action_url).toBe('/apps/crm/showcase_task/t_42');
  });

  it('does not carry `actor_name` even when the raw row has one', async () => {
    // The card's field by name, so a future reader grepping for it lands here
    // rather than on one of the live `actor_name` fields elsewhere in this
    // package (`sys_activity` -> `ActivityItem`, approval activity rows).
    const { result } = renderHook(() => useSharedInboxFeed());
    await settle();

    // Via `unknown`: `InboxNotification` has no index signature, which is the
    // point — the key being probed is not addressable on the declared shape.
    const row = result.current.value[0] as unknown as Record<string, unknown>;
    expect(Object.hasOwn(row, 'actor_name')).toBe(false);
    expect(row.actor_name).toBeUndefined();
  });
});
