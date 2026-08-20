/**
 * sharedUserFeeds — ONE fetch per user-scoped feed, however many consumers mount
 *
 * Two console surfaces read the same two user-scoped streams:
 *
 *   | feed                     | producer                                   | consumers                          |
 *   | ------------------------ | ------------------------------------------ | ---------------------------------- |
 *   | pending approvals count  | `GET /api/v1/approvals/requests?status=…`  | AppHeader bell badge + Approvals   |
 *   |                          |                                            | tab; Home's To-do card             |
 *   | recent activity          | `find('sys_activity', top 20, desc)`       | AppHeader bell Activity tab;       |
 *   |                          |                                            | Home's activity card               |
 *   | inbox messages           | `find('sys_inbox_message', top 20, desc)`  | AppHeader bell Notifications tab   |
 *   |                          | ⋈ `find('sys_notification_receipt')`       | + badge; Home's action centre      |
 *
 * Both consumers live in this package and, on `/home`, mount in the same tree
 * (`HomeLayout` renders the bell, `HomePage` renders the cards) — so each of
 * them owning its own effect meant the same read went out twice per page. That
 * is exactly the trade-off #4197 refused to accept as the price of un-gating
 * the bell: the fix is one fetch feeding both, not two fetches agreeing.
 *
 * The inbox feed joined them last (#4225). #4197 had left it out because the
 * two consumers asked genuinely different questions of the same object — and
 * #4316 measured what that cost: `useHomeInbox` never read the receipts, so
 * Home's "Needs your attention" counted messages the user had already read
 * while the bell two hundred pixels above correctly showed zero. Two panels,
 * one page load, disagreeing about the same rows. Deriving both from ONE feed
 * is what makes that disagreement structurally impossible rather than merely
 * fixed: there is no second read left to drift.
 *
 * Neither feed is app-scoped, so neither is gated on the header's `isApp`
 * flag. `isApp` still means something — it hides genuinely app-shell chrome
 * (presence avatars, the connection dot) — but the approvals inbox and the
 * activity feed are scoped to the *user* and the *tenant*, not to whichever
 * app happens to be in the URL. Gating them there is what left the bell's
 * Approvals and Activity tabs permanently empty on Home / Organizations / the
 * full-page AI screen, and what made the badge (`unread + approvals`) read a
 * different number on Home than inside an app for the same user.
 *
 * Why a module-scoped store rather than a context provider: both consumers are
 * already inside `@object-ui/app-shell`, so sharing needs no new dependency
 * edge — and a store needs no provider mounted above every call site, so the
 * one-fetch guarantee holds no matter where a consumer is rendered (the bell
 * is mounted by four different layouts). The dedupe is structural: consumers
 * cannot opt out of it by mounting somewhere unexpected.
 *
 * @module
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useAuth } from '@object-ui/auth';
import { errorCodeIs } from '@object-ui/types';
// Re-exported from `@object-ui/react` — import it through the provider module
// so a consumer that stubs the provider stubs this too.
import { useAdapter } from '../providers/AdapterProvider.js';
import { bearerAuthHeaders } from '../utils/authToken.js';
import type { ActivityItem } from '../layout/ActivityFeed.js';
import type { InboxNotification } from '../layout/inboxGrouping.js';

/** Approvals poll cadence — the bell's original 30s (M11.C15). */
const APPROVALS_POLL_MS = 30_000;
/** Inbox poll cadence — the bell's original 10s (ADR-0030 L5, #4110). */
const INBOX_POLL_MS = 10_000;
/**
 * Cadence while the tab is backgrounded. The bell's own poller carried this
 * (60s hidden against 10s foregrounded) plus an immediate refetch when the
 * user comes back, and consolidating the poll into the store had to bring
 * both along — a shared feed that polled a hidden tab at its foreground rate
 * would have been a regression riding in on a de-duplication fix (#4225).
 */
const HIDDEN_POLL_MS = 60_000;
/**
 * Ceiling for the failure backoff, likewise lifted from the bell's poller and
 * now applied to every feed: a feed whose read keeps failing must not keep
 * hammering the server at its foreground cadence.
 */
const MAX_BACKOFF_MS = 120_000;
/**
 * How long a fetched value stays authoritative. It is the dedupe window: a
 * second consumer mounting inside it is served the cached value instead of
 * issuing its own read, which covers the common case where the header mounts
 * a beat before the page body does.
 */
const FRESH_MS = 30_000;
/**
 * How many times a RETIRED feed re-probes before it is retired for good, and
 * how long it waits between those probes (#4289).
 *
 * `markUnavailable()` used to be a one-way door: `unavailable` was set, and
 * `refresh`, `schedule` and `onVisibilityChange` all returned early on it, so
 * only a key change (a different user or adapter) or a page reload could revive
 * the feed. That is sound for the case it was written for — a deployment
 * without the approvals plugin / `sys_activity` / the messaging pipeline will
 * answer 404 forever, and re-asking is pure noise — but `isMissingResource` is
 * STATUS-shaped, not code-shaped: `httpStatus === 404` alone qualifies, and the
 * ObjectStack client stamps `httpStatus` from `res.status` on every non-ok
 * response before it looks at the body. So a 404 from anywhere in the transport
 * (an edge router mid-deploy, a host's catch-all before the API is mounted)
 * enters this door wearing the same clothes as the registry's considered
 * `OBJECT_NOT_FOUND` — and used to cost the page its inbox until reload, on
 * BOTH surfaces at once now that the bell and Home read one feed (#4225).
 *
 * A bounded re-probe separates them without giving either the wrong answer: the
 * lost race is recovered within a probe cadence, and the genuinely-absent
 * object costs `UNAVAILABLE_PROBE_LIMIT` extra reads over the page's whole
 * lifetime and is then silent — against the ~360/hour an un-retired 10s poll
 * would have issued. Nothing about the retired STATE changes: the status stays
 * `ready`, the value stays empty, and the affirmative empty copy stays earned
 * (#4315). Exported because the pins assert the ceiling, and a ceiling whose
 * number lives only in the test is not the same ceiling as the code's.
 */
export const UNAVAILABLE_PROBE_LIMIT = 3;
/** @see UNAVAILABLE_PROBE_LIMIT */
export const UNAVAILABLE_PROBE_MS = 60_000;

/**
 * Stable empty value — `useSyncExternalStore` re-renders in a loop if
 * `getSnapshot` hands back a fresh reference each call, so the "nothing yet"
 * value must be one shared array (cf. `EMPTY_PRESENCE_USERS` in AppHeader).
 */
const NO_ACTIVITIES: ActivityItem[] = [];
/** The same stable-empty rule, for the inbox feed. */
const NO_MESSAGES: InboxNotification[] = [];

/**
 * Whether a feed's value is an ANSWER — one dialect for every feed here.
 *
 *  - `idle`    — nothing asked yet (no adapter, no signed-in user, post-reset).
 *  - `loading` — asked, still in flight, no prior answer to show.
 *  - `ready`   — the read answered. Only here does an empty value mean the
 *                feed is genuinely empty. A MISSING resource (404 /
 *                `OBJECT_NOT_FOUND`) is `ready` too: this deployment has no
 *                such object, so nothing is waiting — that is an answer.
 *  - `error`   — the read failed (denied, unreachable, malformed). The value
 *                is the last one known, or empty; either way it is not an
 *                answer to the question being asked now.
 *
 * The same four words as `MetadataTypeStatus` (`providers/MetadataProvider`)
 * and `HomeInboxStatus` (`useHomeInbox`), deliberately: #4300 ruled one status
 * dialect for this exact question, and #4235 applied it to the inbox. The
 * store used to have none — every failure was swallowed into "keep the last
 * value", which is indistinguishable from a successful re-read returning the
 * same thing. #4225 filled that gap for ALL feeds at once rather than adding a
 * second, inbox-only dialect beside it.
 */
export type SharedFeedStatus = 'idle' | 'loading' | 'ready' | 'error';

/** A feed's value together with whether that value is an answer. */
export interface SharedFeedSnapshot<T> {
  value: T;
  status: SharedFeedStatus;
}

/**
 * The runner produces the feed's next value, or `undefined` to leave the last
 * one in place. Which of the two "no value" cases it is has to be said out
 * loud, because the store can no longer guess:
 *
 *  - `markUnavailable()` retires the feed for the rest of the page — the
 *    deployment does not have the approvals plugin / the `sys_activity`
 *    object / the messaging pipeline, so retrying is pure noise. That is an
 *    ANSWER (`ready`).
 *  - `markFailed()` reports a read that should have worked and did not. The
 *    last value stays on screen, the status goes `error`, and the next poll
 *    backs off. A thrown error is equivalent — the runner may just let it fly.
 */
type FeedRunner<T> = (ctx: {
  markUnavailable: () => void;
  markFailed: () => void;
}) => Promise<T | undefined>;

/**
 * One feed's shared state. Consumers `attach` (from an effect) and read via
 * `useSyncExternalStore`; the first one in starts the fetch and the poll, the
 * last one out stops it.
 */
class SharedFeed<T> {
  /**
   * The published snapshot. Cached as ONE object and replaced only when the
   * value or the status actually changes: `useSyncExternalStore` re-renders in
   * a loop if `getSnapshot` hands back a fresh reference each call, so pairing
   * the value with its status must not mean building a new pair per read.
   */
  private snapshot: SharedFeedSnapshot<T>;
  private key: string | null = null;
  private readonly listeners = new Set<() => void>();
  private runner: FeedRunner<T> | null = null;
  private consumers = 0;
  private inFlight = false;
  private unavailable = false;
  /** When the feed last retired or spent a probe — gates the probe cadence. */
  private retiredAt = 0;
  /** Re-probes left before the retirement becomes permanent (#4289). */
  private probesLeft = UNAVAILABLE_PROBE_LIMIT;
  private fetchedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Current inter-poll delay: `pollMs`, doubled per failure, capped. */
  private backoffMs: number;
  private visibilityBound = false;

  constructor(
    private readonly empty: T,
    /** Re-fetch cadence while at least one consumer is mounted; 0 = fetch once. */
    private readonly pollMs: number,
  ) {
    this.snapshot = { value: empty, status: 'idle' };
    this.idleSnapshot = this.snapshot;
    this.backoffMs = pollMs;
  }

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange);
    return () => {
      this.listeners.delete(onStoreChange);
    };
  };

  getSnapshot = (): SharedFeedSnapshot<T> => this.snapshot;

  /**
   * What a consumer that is not driving a fetch reads: nothing, not asked.
   * A cached `ready` belongs to the key that earned it — a signed-out session
   * must not inherit the previous user's answer, nor their rows. One frozen
   * object so it is snapshot-stable like any other published value.
   */
  readonly idleSnapshot: SharedFeedSnapshot<T>;

  /**
   * Register a consumer. `key` identifies *whose* feed this is (the approver
   * identity list / the adapter instance); a different key means the previous
   * value belongs to someone else and is dropped rather than shown.
   *
   * Every consumer of a given feed derives its key from the same auth/adapter
   * context, so concurrent consumers always agree on it.
   */
  attach(key: string, runner: FeedRunner<T>): () => void {
    if (key !== this.key) {
      this.key = key;
      this.unavailable = false;
      this.retiredAt = 0;
      this.probesLeft = UNAVAILABLE_PROBE_LIMIT;
      this.fetchedAt = 0;
      this.backoffMs = this.pollMs;
      // A different key means the cached value belongs to someone else, and
      // so does the fact that it was an answer — back to `idle`, not `ready`.
      this.publish(this.empty, 'idle');
    }
    // Freshest closure wins — it holds the current adapter / identities.
    this.runner = runner;
    this.consumers += 1;
    if (this.consumers === 1) {
      this.bindVisibility();
      this.schedule();
    }
    void this.refresh();
    return () => {
      this.consumers = Math.max(0, this.consumers - 1);
      if (this.consumers === 0) {
        this.stopPolling();
        this.unbindVisibility();
      }
    };
  }

  /**
   * `force` is the poll tick: it bypasses the freshness window (which exists
   * to collapse mounts, not to defeat the cadence). Concurrent callers are
   * collapsed by `inFlight`, which is set synchronously before the first
   * `await` — so two consumers attaching in the same commit issue one read.
   */
  private async refresh(force = false): Promise<void> {
    const runner = this.runner;
    if (!runner || this.inFlight) return;
    // A retired feed is not dead, it is quiet: it still re-probes, a bounded
    // number of times and no faster than the probe cadence (#4289).
    const probing = this.unavailable;
    if (probing && !this.mayProbe()) return;
    if (!force && !probing && this.fetchedAt && Date.now() - this.fetchedAt < FRESH_MS) return;
    this.inFlight = true;
    // Only announce "loading" when there is no prior answer to show. A poll
    // tick over a `ready` feed must not flash its consumers back through the
    // loading state ten times a minute.
    if (this.snapshot.status === 'idle') this.publish(this.snapshot.value, 'loading');
    let failed = false;
    try {
      const next = await runner({
        // Already retired ⇒ this WAS a probe, and it came back missing again.
        // Spend it and stay exactly as we were; the status must not move.
        markUnavailable: () => (probing ? this.spendProbe() : this.retire()),
        markFailed: () => {
          failed = true;
        },
      });
      if (next !== undefined) {
        // An answer with a value: the feed is alive, whatever it was before.
        // This is the ONLY way out of retirement, and it restores the full
        // budget — a feed that has answered once has earned the next lost race.
        this.unavailable = false;
        this.probesLeft = UNAVAILABLE_PROBE_LIMIT;
        this.fetchedAt = Date.now();
        this.backoffMs = this.pollMs;
        this.publish(next, 'ready');
      } else if (failed) {
        // A probe that fails for some OTHER reason is still not an answer, and
        // it does not get to drag a retired feed into `error`: the surface has
        // been showing the earned empty state and a 404-then-500 sequence is no
        // reason to start telling a community build its inbox is broken. Spend
        // the probe, keep the state, let the next one decide (#4315).
        if (probing) this.spendProbe();
        else this.fail();
      }
    } catch {
      // Not swallowed into "keep the last value and say nothing": the value
      // stays, but consumers are told it is no longer an answer (#4225).
      if (probing) this.spendProbe();
      else this.fail();
    } finally {
      this.inFlight = false;
      // Re-arm from one place. `schedule` is a no-op while a timer is pending,
      // so the poll tick's own re-arm below is unaffected; what this adds is
      // the probe timer for a feed that has just retired (and for a
      // non-polled feed, whose only other scheduling point is attach).
      if (this.consumers > 0) this.schedule();
    }
  }

  /** Whether a retired feed is due another probe. */
  private mayProbe(): boolean {
    return this.probesLeft > 0 && Date.now() - this.retiredAt >= UNAVAILABLE_PROBE_MS;
  }

  /**
   * The resource is missing — an answer, so `ready` and the poll stops. What
   * used to be a one-way door now leaves the probe budget standing.
   */
  private retire(): void {
    this.unavailable = true;
    this.retiredAt = Date.now();
    // A missing resource IS an answer: this deployment has none, so nothing is
    // waiting. Degrading to empty and calling it `ready` is the split
    // `useHomeInbox` already applied to its own read (#4235).
    this.fetchedAt = Date.now();
    this.stopPolling();
    this.publish(this.snapshot.value, 'ready');
  }

  /** A probe that did not answer: spend one, publish nothing, stay retired. */
  private spendProbe(): void {
    this.probesLeft = Math.max(0, this.probesLeft - 1);
    this.retiredAt = Date.now();
    this.fetchedAt = Date.now();
    this.stopPolling();
  }

  /** A read that should have worked did not — report it and back the poll off. */
  private fail(): void {
    this.backoffMs = Math.min(Math.max(this.backoffMs, this.pollMs) * 2, MAX_BACKOFF_MS);
    this.publish(this.snapshot.value, 'error');
  }

  private schedule(): void {
    if (this.timer) return;
    // A retired feed schedules PROBES, not polls — including a feed whose
    // `pollMs` is 0 (`sys_activity` fetches once), whose only other re-read
    // point is a consumer attaching and which the retirement therefore used to
    // silence just as permanently.
    if (this.unavailable) {
      if (this.probesLeft <= 0) return;
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.refresh(true);
      }, UNAVAILABLE_PROBE_MS);
      return;
    }
    if (this.pollMs <= 0) return;
    // Backgrounded tabs poll at the slower cadence — but never FASTER than the
    // current backoff, so a failing feed stays backed off either way.
    const hidden = typeof document !== 'undefined' && document.hidden;
    const delay = hidden ? Math.max(HIDDEN_POLL_MS, this.backoffMs) : this.backoffMs;
    this.timer = setTimeout(() => {
      this.timer = null;
      // `refresh` re-arms in its own `finally`, for the poll tick and the probe
      // tick alike — one re-arm point, so a feed that changes state mid-read
      // (a poll that retires, a probe that revives) cannot end up scheduling
      // the cadence it just left.
      void this.refresh(true);
    }, delay);
  }

  /**
   * Coming back to the tab refetches immediately rather than waiting out a
   * hidden-cadence tick, so the bell is current within a beat of the user
   * looking at it — the behaviour its own poller had before #4225 moved it.
   */
  private readonly onVisibilityChange = (): void => {
    if (typeof document === 'undefined' || document.hidden) return;
    if (this.consumers === 0) return;
    // Returning to a tab is exactly when a bell should be current, so a retired
    // feed re-probes here too — but under the same cadence gate as the timer,
    // or a user switching tabs would spend the whole budget in three seconds
    // and turn a bounded recovery into a request storm (#4289).
    if (this.unavailable && !this.mayProbe()) return;
    this.stopPolling();
    if (!this.unavailable) this.backoffMs = this.pollMs;
    void this.refresh(true);
  };

  private bindVisibility(): void {
    if (this.pollMs <= 0 || this.visibilityBound) return;
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.visibilityBound = true;
  }

  private unbindVisibility(): void {
    if (!this.visibilityBound || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.visibilityBound = false;
  }

  private stopPolling(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private publish(next: T, status: SharedFeedStatus): void {
    if (Object.is(next, this.snapshot.value) && status === this.snapshot.status) return;
    this.snapshot = { value: next, status };
    for (const listener of [...this.listeners]) listener();
  }

  /** Test seam — drop all cached state between cases. Listeners are left alone. */
  reset(): void {
    this.stopPolling();
    this.unbindVisibility();
    this.snapshot = { value: this.empty, status: 'idle' };
    this.key = null;
    this.runner = null;
    this.consumers = 0;
    this.inFlight = false;
    this.unavailable = false;
    this.retiredAt = 0;
    this.probesLeft = UNAVAILABLE_PROBE_LIMIT;
    this.fetchedAt = 0;
    this.backoffMs = this.pollMs;
  }
}

/**
 * Subscribe to a shared feed. A `null` key means "nothing to fetch yet" (no
 * signed-in user, no adapter) — the consumer still reads the snapshot, it just
 * does not drive a fetch.
 */
function useSharedFeed<T>(
  feed: SharedFeed<T>,
  key: string | null,
  runner: FeedRunner<T>,
): SharedFeedSnapshot<T> {
  const value = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  // Latest-ref: the runner closes over values that change every render, but
  // only `key` may re-drive the attach effect. Declared first so it lands
  // before the attach effect on every commit.
  const runnerRef = useRef(runner);
  useEffect(() => {
    runnerRef.current = runner;
  });
  useEffect(() => {
    if (!key) return;
    return feed.attach(key, (ctx) => runnerRef.current(ctx));
  }, [feed, key]);
  // No key ⇒ this consumer has asked nothing, so it is told nothing — never
  // the cached answer to a question somebody else asked (#4235's `idle`).
  return key ? value : feed.idleSnapshot;
}

// ── Pending approvals ────────────────────────────────────────────────────────

const approvalsFeed = new SharedFeed<number>(0, APPROVALS_POLL_MS);

/**
 * The identities the endpoint matches a pending approver against: the user id,
 * their email, and `role:<r>` for each role. Sent as one comma-separated
 * `approverId` so this is ONE request rather than one per identity.
 */
function approverIdentities(user: unknown): string[] {
  const u = user as { id?: string; email?: string; roles?: string[] } | null | undefined;
  const identities: string[] = [];
  if (u?.id) identities.push(u.id);
  if (u?.email) identities.push(u.email);
  for (const role of u?.roles ?? []) if (role) identities.push(`role:${role}`);
  return identities;
}

/**
 * Count of approval requests waiting on the signed-in user.
 *
 * Feeds the bell's badge (second addend of `unread + approvals`) and its
 * Approvals tab, and Home's To-do card — from one polled request. Degrades to
 * 0 on 404 (approvals plugin not installed) and retires the poll.
 */
export function useSharedPendingApprovalsCount(): number {
  const { user } = useAuth();
  const identities = approverIdentities(user);
  // `user?.id` is the sign-in gate; identities is what the query needs.
  const key = user?.id && identities.length > 0 ? identities.join(',') : null;

  return useSharedFeed(approvalsFeed, key, async ({ markUnavailable, markFailed }) => {
    const serverUrl = (import.meta.env?.VITE_SERVER_URL || '').replace(/\/$/, '');
    const qs = new URLSearchParams({ status: 'pending', approverId: identities.join(',') });
    const res = await fetch(`${serverUrl}/api/v1/approvals/requests?${qs}`, {
      credentials: 'include',
      // Bearer too — see utils/authToken (#2548 split-origin fix).
      headers: bearerAuthHeaders(),
    });
    if (res.status === 404) {
      markUnavailable();
      return undefined;
    }
    if (!res.ok) {
      markFailed();
      return undefined;
    }
    const payload = await res.json().catch(() => null);
    const seen = new Set<string>();
    for (const row of (payload?.data || []) as { id: string }[]) seen.add(row.id);
    return seen.size;
  }).value;
}

// ── Recent activity ──────────────────────────────────────────────────────────

const activityFeed = new SharedFeed<ActivityItem[]>(NO_ACTIVITIES, 0);

/**
 * Stable string id per adapter instance, so swapping the adapter (tenant
 * switch) drops the previous tenant's rows instead of serving them from cache.
 * Feed-neutral: each feed composes it with whatever else scopes its rows (the
 * inbox adds the signed-in user id, since its query is `mine`).
 */
const adapterKeys = new WeakMap<object, string>();
let adapterSeq = 0;
function adapterKey(adapter: unknown): string | null {
  if (!adapter || typeof adapter !== 'object') return null;
  let key = adapterKeys.get(adapter as object);
  if (!key) {
    key = `adapter@${++adapterSeq}`;
    adapterKeys.set(adapter as object, key);
  }
  return key;
}

/**
 * Raw `sys_activity` rows carry plugin-audit's column names
 * (`summary` / `actor_name` / `object_name` / `timestamp`); casting them
 * straight through leaves every `ActivityItem` field undefined, which is what
 * once rendered the Activity tab as blank rows showing only a relative time.
 *
 * This is the shared superset: rows that name an action and say something.
 * Home narrows it further (human actors only) at its own call site.
 */
function mapActivityRows(rows: unknown[]): ActivityItem[] {
  return rows
    .filter((row): row is Record<string, unknown> => {
      if (!row || typeof row !== 'object') return false;
      const r = row as Record<string, unknown>;
      return typeof r.type === 'string' && String(r.summary ?? '').trim().length > 0;
    })
    .map((r) => {
      let when = r.timestamp as string | undefined;
      if (!when || when === 'NOW()' || Number.isNaN(Date.parse(when))) {
        when = r.created_at as string | undefined;
      }
      const raw = String(r.type);
      const type: ActivityItem['type'] =
        raw === 'commented' || raw === 'mentioned'
          ? 'comment'
          : raw === 'deleted'
            ? 'delete'
            : raw === 'created'
              ? 'create'
              : 'update';
      return {
        id: String(r.id),
        type,
        objectName: String(r.object_name ?? ''),
        recordId: r.record_id != null ? String(r.record_id) : undefined,
        user: String(r.actor_name ?? ''),
        description: String(r.summary ?? ''),
        timestamp: when ?? '',
      };
    });
}

/**
 * A missing OBJECT, as opposed to a failed read of a present one — the split
 * that decides whether an empty result is an answer. The ObjectStack client
 * throws `httpStatus` (not `status`) with an error code.
 *
 * Exported because all three inbox-surface readers need exactly this predicate
 * and used to carry a copy each — `sharedUserFeeds`, `AppHeader`'s poller and
 * `useHomeInbox` (#4225). Three copies of a predicate whose two branches mean
 * "degrade quietly" and "say the read failed" is three chances to drift on the
 * distinction #4235 exists to protect.
 */
export function isMissingResource(err: unknown): boolean {
  const e = err as { httpStatus?: number; status?: number } | null;
  return e?.httpStatus === 404 || e?.status === 404 || errorCodeIs(err, 'OBJECT_NOT_FOUND');
}

/**
 * The 20 most recent activity rows, tenant-wide, mapped onto `ActivityItem`.
 *
 * Not polled — it is a landing-surface feed on both consumers, and the bell
 * never polled it either. Degrades to empty when `sys_activity` is absent
 * (no plugin-audit) and retires the feed for the rest of the page.
 */
export function useSharedActivityFeed(): ActivityItem[] {
  const dataSource = useAdapter();

  return useSharedFeed(
    activityFeed,
    adapterKey(dataSource),
    async ({ markUnavailable, markFailed }) => {
      if (!dataSource) return undefined;
      const res = await Promise.resolve(
        dataSource.find('sys_activity', { $orderby: { timestamp: 'desc' }, $top: 20 }) as Promise<{
          data?: unknown[];
        }>,
      ).catch((err: unknown) => {
        // No `sys_activity` object ⇒ this deployment has no audit plugin, which
        // is an answer. Anything else is a read that failed and must say so.
        if (isMissingResource(err)) markUnavailable();
        else markFailed();
        return null;
      });
      if (!res) return undefined;
      return mapActivityRows(Array.isArray(res.data) ? res.data : []);
    },
  ).value;
}

/**
 * Home's narrower cut of the same rows: real human actions only — drop the
 * `sys_*` / `ai_*` system churn (actor "System", UUID titles) that the bell's
 * full feed still shows — capped at `limit`.
 */
export function useHumanActivityFeed(limit: number): ActivityItem[] {
  const all = useSharedActivityFeed();
  return useMemo(() => {
    const human = all.filter((a) => {
      const actor = a.user.trim();
      return actor.length > 0 && actor.toLowerCase() !== 'system';
    });
    return human.slice(0, limit);
  }, [all, limit]);
}

// ── Inbox messages ───────────────────────────────────────────────────────────

const inboxFeed = new SharedFeed<InboxNotification[]>(NO_MESSAGES, INBOX_POLL_MS);

/**
 * Receipt states that count as READ (ADR-0030). `delivered` is not one of them
 * — a message can carry a receipt and still be unread, which is the whole
 * reason read-state cannot be inferred from the receipt's mere existence.
 */
const READ_STATES = new Set(['read', 'clicked', 'dismissed']);

/**
 * Join the `mine` inbox rows to their read-state receipts — the merge the
 * bell's poller did inline, now the shared feed's single definition of what a
 * message IS. `useHomeInbox` never had this join at all (#4316), which is why
 * Home counted already-read messages as needing attention.
 */
function mergeInboxRows(rows: unknown[], receipts: unknown[]): InboxNotification[] {
  // notification_id → { id, state } (most-advanced receipt wins).
  const receiptByNotif = new Map<string, { id: string; state: string }>();
  for (const raw of receipts) {
    const r = raw as Record<string, unknown> | null;
    const nid = r?.notification_id != null ? String(r.notification_id) : '';
    if (!nid) continue;
    const state = String(r?.state ?? '');
    const prev = receiptByNotif.get(nid);
    // Prefer a read/clicked/dismissed receipt over a plain delivered one.
    if (!prev || (!READ_STATES.has(prev.state) && READ_STATES.has(state))) {
      receiptByNotif.set(nid, { id: String(r?.id), state });
    }
  }
  return rows.map((raw) => {
    const m = raw as Record<string, unknown>;
    const nid = m?.notification_id != null ? String(m.notification_id) : null;
    const rec = nid ? receiptByNotif.get(nid) : undefined;
    return {
      id: String(m.id),
      notification_id: nid,
      receipt_id: rec?.id ?? null,
      type: (m.topic as string) ?? 'notification',
      title: (m.title as string) ?? '',
      body: (m.body_md as string) ?? null,
      action_url: (m.action_url as string) ?? null,
      is_read: rec ? READ_STATES.has(rec.state) : false,
      created_at: m.created_at as string | undefined,
    } satisfies InboxNotification;
  });
}

/**
 * The signed-in user's 20 most recent in-app inbox messages, joined with their
 * read-state receipts (ADR-0030 L5, the `mine` materialization).
 *
 * Two scoped reads, joined client-side, polled at 10s while the tab is
 * foregrounded — the bell's cadence, now the store's:
 *   - `sys_inbox_message` filtered by `user_id`, newest first, `$top: 20`.
 *   - `sys_notification_receipt` filtered by `user_id` + `channel:'inbox'`.
 *     Best-effort: if receipts are unavailable the inbox still renders
 *     (everything shows unread) rather than erroring.
 *
 * This is the SUPERSET both consumers cut from. The bell lists all 20 and
 * badges the unread topics; Home's action centre takes the unread ones, newest
 * first, capped at its own smaller limit. Neither issues a read of its own, so
 * the two cannot disagree about a row's read-state — the #4316 defect is not
 * merely fixed here, it is unreachable.
 *
 * Degrades to empty when the messaging pipeline is absent (404 /
 * `OBJECT_NOT_FOUND`) and retires the poll; every other failure is reported as
 * `error` so a denial cannot reach a consumer wearing the shape of an empty
 * inbox (#4235, objectstack#7344).
 */
export function useSharedInboxFeed(): SharedFeedSnapshot<InboxNotification[]> {
  const dataSource = useAdapter();
  const { user } = useAuth();
  const userId = user?.id;
  // Scoped by adapter AND user: the query is `mine`, so another user's rows
  // must never be served from cache after a session switch.
  const adapter = adapterKey(dataSource);
  const key = adapter && userId ? `${adapter}:${userId}` : null;

  return useSharedFeed(inboxFeed, key, async ({ markUnavailable, markFailed }) => {
    if (!dataSource || !userId) return undefined;
    try {
      const [inboxRes, receiptRes] = await Promise.all([
        Promise.resolve(
          dataSource.find('sys_inbox_message', {
            $filter: { user_id: userId },
            $orderby: { created_at: 'desc' },
            $top: 20,
          }) as Promise<{ data?: unknown[] }>,
        ),
        Promise.resolve(
          dataSource.find('sys_notification_receipt', {
            $filter: { user_id: userId, channel: 'inbox' },
            $top: 200,
          }) as Promise<{ data?: unknown[] }>,
        ).catch(() => ({ data: [] as unknown[] })),
      ]);
      return mergeInboxRows(
        Array.isArray(inboxRes?.data) ? inboxRes.data : [],
        Array.isArray(receiptRes?.data) ? receiptRes.data : [],
      );
    } catch (err: unknown) {
      // No inbox object ⇒ no messaging pipeline in this deployment, so nothing
      // is waiting: an answer. A denial / outage / malformed reply is not.
      if (isMissingResource(err)) markUnavailable();
      else markFailed();
      return undefined;
    }
  });
}

/**
 * Test seam: drop every shared feed's cached value, key and in-flight state so
 * cases do not inherit each other's reads. Not part of the public surface.
 */
export function __resetSharedUserFeeds(): void {
  approvalsFeed.reset();
  activityFeed.reset();
  inboxFeed.reset();
}
