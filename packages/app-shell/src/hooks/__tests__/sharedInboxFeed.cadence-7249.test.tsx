/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#7249 — ONE cadence, owned by the shared feed, however many consumers
 * mount.
 *
 * ## What the card reported, and what was actually measured
 *
 * The card reported the console HOME issuing the inbox pair
 * (`sys_inbox_message?top=20` + `sys_notification_receipt?top=200`) every
 * **2000 ms** — five times `INBOX_POLL_MS` — against ~10 s on an app page, and
 * read that asymmetry as a second scheduler on Home racing the shared feed.
 *
 * Re-measured against the same backend (showcase, objectstack `main`), signed in
 * as the same seeded admin, in a controlled Playwright context — 60 s idle,
 * every request to the two reads recorded:
 *
 *   | surface                                   | inbox pairs / 60 s | gaps (ms)     |
 *   | ----------------------------------------- | ------------------ | ------------- |
 *   | `/_console/home` (the card's own URL)     | 6                  | 10054-10077   |
 *   | `/home` on this package's dev build       | 6                  | 10042-10089   |
 *   | `/home`, after 4x home<->app route churn  | 6                  | 10074-10091   |
 *   | `/home`, tab hidden                       | 1                  | (60 s)        |
 *
 * The 2 s cadence did not reproduce on any of them, and `approvals/requests`
 * held its own 30 s. There is no second scheduler: `useHomeInbox` and
 * `useInboxBell` both fetch nothing, and `useClientNotifications` — the other
 * candidate — has no call sites in this repo at all.
 *
 * ## Why a pin, then, if nothing is broken
 *
 * Because "one cadence, owned by the shared feed" was true only by measurement,
 * and nothing in the suite said so. The neighbouring pins
 * (`sharedInboxFeed.twoSurfaces`) assert the MOUNT-time dedupe — one read for
 * the bell and Home together, a late consumer served without re-reading — which
 * is a different claim: it is satisfied by any number of schedulers that happen
 * to agree on the first tick. Nothing advanced a clock and counted, so a
 * consumer that grew its own `setInterval` would have kept every existing pin
 * green and cost a browser dogfood to find. It cost one here.
 *
 * That is the whole content of this file: the cadence is a property of the FEED,
 * not of how many consumers mount or which page they mount on, and it is now
 * enforced rather than measured. #4197 / #4225 / #4316 each fought for one read
 * feeding both surfaces; this is the clock-domain half of that invariant.
 *
 * ## Reverse verification (prediction first, measured in this PR)
 *
 *   - set `INBOX_POLL_MS` to 2_000 — the cadence the card reported — and the
 *     two counting cases go RED (25 reads against the bound of 7) while every
 *     other inbox pin, `twoSurfaces` included, stays GREEN. That asymmetry is
 *     the point: it is the exact defect the card described, and the existing
 *     suite cannot see it.
 *   - give `useHomeInbox` a second scheduler of its own and
 *     "one feed's cadence, not one per consumer" goes RED while the single-
 *     consumer case stays green — a second scheduler is not a faster one.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

let userFixture: { id: string } | null = { id: 'u1' };
vi.mock('@object-ui/auth', () => ({ useAuth: () => ({ user: userFixture }) }));

const findCalls: Array<{ object: string }> = [];
const fakeAdapter = {
  find: (object: string) => {
    findCalls.push({ object });
    return Promise.resolve({ data: [] });
  },
  getClient: () => undefined,
};
vi.mock('../../providers/AdapterProvider', () => ({ useAdapter: () => fakeAdapter }));

import { useSharedInboxFeed, __resetSharedUserFeeds } from '../sharedUserFeeds';
import { useHomeInbox } from '../useHomeInbox';

/** The declared foreground cadence (`INBOX_POLL_MS`), restated as the pin's unit. */
const INBOX_POLL_MS = 10_000;
/** The declared backgrounded cadence (`HIDDEN_POLL_MS`). */
const HIDDEN_POLL_MS = 60_000;
/** The measurement window both counting cases use. */
const WINDOW_MS = 60_000;
/**
 * Reads a 60 s window may contain at the declared cadence: the attach-time read
 * plus one per tick. Written as the arithmetic rather than as `7` so the bound
 * moves with the cadence instead of having to be re-derived by hand.
 */
const READS_IN_WINDOW = 1 + WINDOW_MS / INBOX_POLL_MS;

const inboxReads = () => findCalls.filter((c) => c.object === 'sys_inbox_message').length;
const receiptReads = () =>
  findCalls.filter((c) => c.object === 'sys_notification_receipt').length;

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

/** Drive `document.hidden`, which is the only input the scheduler reads. */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  userFixture = { id: 'u1' };
  findCalls.length = 0;
  setHidden(false);
  // Module-scoped stores outlive any one render tree.
  __resetSharedUserFeeds();
  // Approvals degrade to 0 (404) so the REST feed is not this suite's subject.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('objectui#7249 — the inbox feed holds ONE declared cadence', () => {
  it('polls at INBOX_POLL_MS with the bell and Home mounted together', async () => {
    // The card's surface: on `/home` the bell (`useSharedInboxFeed`, mounted by
    // the header) and the action centre (`useHomeInbox`) are both up. The read
    // count over the window is the whole assertion — a second scheduler, or a
    // cadence quietly faster than the declared one, can only make it larger.
    renderHook(() => {
      useSharedInboxFeed();
      useHomeInbox();
    });
    await settle();

    expect(inboxReads()).toBe(1);

    await advance(WINDOW_MS);

    expect(inboxReads()).toBe(READS_IN_WINDOW);
    // The join travels with the rows: the receipt read is issued by the same
    // runner, so it can neither lag the message read nor double it. The card's
    // `top=200` receipt read is exactly as frequent as the pair, no more.
    expect(receiptReads()).toBe(inboxReads());
  });

  it('is one FEED cadence, not one per consumer', async () => {
    // Three consumers on one page must cost what one costs. This is the claim
    // the mount-time dedupe pins cannot make: they stop at the first tick,
    // where N schedulers still look like one.
    renderHook(() => {
      useSharedInboxFeed();
      useSharedInboxFeed();
      useHomeInbox();
    });
    await settle();
    await advance(WINDOW_MS);

    const withThree = inboxReads();

    __resetSharedUserFeeds();
    findCalls.length = 0;

    renderHook(() => useSharedInboxFeed());
    await settle();
    await advance(WINDOW_MS);

    expect(withThree).toBe(inboxReads());
    expect(withThree).toBe(READS_IN_WINDOW);
  });

  it('throttles to HIDDEN_POLL_MS while the tab is backgrounded', async () => {
    // The hidden cadence measured on the real page (1 pair per 60 s), pinned so
    // a future change cannot let a backgrounded tab poll at the foreground rate
    // — the regression #4225 explicitly refused to let ride along.
    setHidden(true);

    renderHook(() => useSharedInboxFeed());
    await settle();
    expect(inboxReads()).toBe(1);

    await advance(HIDDEN_POLL_MS);

    expect(inboxReads()).toBe(2);
  });

  it('coming back to the tab refreshes once, and does not leave a faster loop behind', async () => {
    // The visibility handler refreshes immediately so the bell is current when
    // the user looks at it. That is one extra read at the moment of return —
    // not a cadence change, which is the failure this case exists to exclude.
    setHidden(true);
    renderHook(() => useSharedInboxFeed());
    await settle();
    expect(inboxReads()).toBe(1);

    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(inboxReads()).toBe(2);

    await advance(WINDOW_MS);

    // One window at the foreground cadence after the return read — the return
    // does not compound into a second scheduler.
    expect(inboxReads()).toBe(2 + WINDOW_MS / INBOX_POLL_MS);
  });
});
