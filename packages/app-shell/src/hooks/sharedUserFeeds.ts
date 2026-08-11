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
 *
 * Both consumers live in this package and, on `/home`, mount in the same tree
 * (`HomeLayout` renders the bell, `HomePage` renders the cards) — so each of
 * them owning its own effect meant the same read went out twice per page. That
 * is exactly the trade-off #4197 refused to accept as the price of un-gating
 * the bell: the fix is one fetch feeding both, not two fetches agreeing.
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
import { useAdapter } from '../providers/AdapterProvider';
import { bearerAuthHeaders } from '../utils/authToken';
import type { ActivityItem } from '../layout/ActivityFeed';

/** Approvals poll cadence — the bell's original 30s (M11.C15). */
const APPROVALS_POLL_MS = 30_000;
/**
 * How long a fetched value stays authoritative. It is the dedupe window: a
 * second consumer mounting inside it is served the cached value instead of
 * issuing its own read, which covers the common case where the header mounts
 * a beat before the page body does.
 */
const FRESH_MS = 30_000;

/**
 * Stable empty value — `useSyncExternalStore` re-renders in a loop if
 * `getSnapshot` hands back a fresh reference each call, so the "nothing yet"
 * value must be one shared array (cf. `EMPTY_PRESENCE_USERS` in AppHeader).
 */
const NO_ACTIVITIES: ActivityItem[] = [];

/**
 * The runner produces the feed's next value, or `undefined` to leave the last
 * one in place (a transient error, a non-OK response). `markUnavailable()`
 * retires the feed for the rest of the page — the deployment does not have the
 * approvals plugin / the `sys_activity` object, so retrying is pure noise.
 */
type FeedRunner<T> = (ctx: { markUnavailable: () => void }) => Promise<T | undefined>;

/**
 * One feed's shared state. Consumers `attach` (from an effect) and read via
 * `useSyncExternalStore`; the first one in starts the fetch and the poll, the
 * last one out stops it.
 */
class SharedFeed<T> {
  private value: T;
  private key: string | null = null;
  private readonly listeners = new Set<() => void>();
  private runner: FeedRunner<T> | null = null;
  private consumers = 0;
  private inFlight = false;
  private unavailable = false;
  private fetchedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly empty: T,
    /** Re-fetch cadence while at least one consumer is mounted; 0 = fetch once. */
    private readonly pollMs: number,
  ) {
    this.value = empty;
  }

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.listeners.add(onStoreChange);
    return () => {
      this.listeners.delete(onStoreChange);
    };
  };

  getSnapshot = (): T => this.value;

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
      this.fetchedAt = 0;
      this.publish(this.empty);
    }
    // Freshest closure wins — it holds the current adapter / identities.
    this.runner = runner;
    this.consumers += 1;
    if (this.consumers === 1) this.schedule();
    void this.refresh();
    return () => {
      this.consumers = Math.max(0, this.consumers - 1);
      if (this.consumers === 0) this.stopPolling();
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
    if (!runner || this.unavailable || this.inFlight) return;
    if (!force && this.fetchedAt && Date.now() - this.fetchedAt < FRESH_MS) return;
    this.inFlight = true;
    try {
      const next = await runner({
        markUnavailable: () => {
          this.unavailable = true;
          this.stopPolling();
        },
      });
      if (next !== undefined) {
        this.fetchedAt = Date.now();
        this.publish(next);
      }
    } catch {
      // Transient — keep the last value; the next poll / mount retries.
    } finally {
      this.inFlight = false;
    }
  }

  private schedule(): void {
    if (this.pollMs <= 0 || this.unavailable || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh(true).finally(() => {
        if (this.consumers > 0) this.schedule();
      });
    }, this.pollMs);
  }

  private stopPolling(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private publish(next: T): void {
    if (Object.is(next, this.value)) return;
    this.value = next;
    for (const listener of [...this.listeners]) listener();
  }

  /** Test seam — drop all cached state between cases. Listeners are left alone. */
  reset(): void {
    this.stopPolling();
    this.value = this.empty;
    this.key = null;
    this.runner = null;
    this.consumers = 0;
    this.inFlight = false;
    this.unavailable = false;
    this.fetchedAt = 0;
  }
}

/**
 * Subscribe to a shared feed. A `null` key means "nothing to fetch yet" (no
 * signed-in user, no adapter) — the consumer still reads the snapshot, it just
 * does not drive a fetch.
 */
function useSharedFeed<T>(feed: SharedFeed<T>, key: string | null, runner: FeedRunner<T>): T {
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
  return value;
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

  return useSharedFeed(approvalsFeed, key, async ({ markUnavailable }) => {
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
    if (!res.ok) return undefined;
    const payload = await res.json().catch(() => null);
    const seen = new Set<string>();
    for (const row of (payload?.data || []) as { id: string }[]) seen.add(row.id);
    return seen.size;
  });
}

// ── Recent activity ──────────────────────────────────────────────────────────

const activityFeed = new SharedFeed<ActivityItem[]>(NO_ACTIVITIES, 0);

/**
 * Stable string id per adapter instance, so swapping the adapter (tenant
 * switch) drops the previous tenant's rows instead of serving them from cache.
 */
const adapterKeys = new WeakMap<object, string>();
let adapterSeq = 0;
function adapterKey(adapter: unknown): string | null {
  if (!adapter || typeof adapter !== 'object') return null;
  let key = adapterKeys.get(adapter as object);
  if (!key) {
    key = `sys_activity@${++adapterSeq}`;
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

/** The ObjectStack client throws `httpStatus` (not `status`) with an error code. */
function isMissingResource(err: unknown): boolean {
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

  return useSharedFeed(activityFeed, adapterKey(dataSource), async ({ markUnavailable }) => {
    if (!dataSource) return undefined;
    const res = await Promise.resolve(
      dataSource.find('sys_activity', { $orderby: { timestamp: 'desc' }, $top: 20 }) as Promise<{
        data?: unknown[];
      }>,
    ).catch((err: unknown) => {
      if (isMissingResource(err)) markUnavailable();
      return null;
    });
    if (!res) return undefined;
    return mapActivityRows(Array.isArray(res.data) ? res.data : []);
  });
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

/**
 * Test seam: drop every shared feed's cached value, key and in-flight state so
 * cases do not inherit each other's reads. Not part of the public surface.
 */
export function __resetSharedUserFeeds(): void {
  approvalsFeed.reset();
  activityFeed.reset();
}
