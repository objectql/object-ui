/**
 * useHomeInbox
 *
 * The inbox streams the Home work-dashboard surfaces:
 *   - pendingApprovalsCount — items waiting on the user (REST endpoint)
 *   - notifications         — latest in-app inbox messages (assignments/@mentions)
 *   - activities            — recent human activity feed (sys_activity)
 *
 * A deployment without the approvals plugin, the inbox pipeline or a
 * `sys_activity` object still renders Home: a MISSING object (404 /
 * `OBJECT_NOT_FOUND`) is an answer — this deployment has no inbox, so nothing is
 * waiting — and degrades to empty, exactly as `sharedUserFeeds.markUnavailable`
 * treats its own feeds.
 *
 * Every OTHER failure is NOT an answer, and `notificationsStatus` is what says
 * so (#4235). This hook used to swallow all of them to `[]`, which handed the
 * Home action centre the empty array and nothing else — so a denial arrived
 * wearing the shape of good news and the panel said "You're all caught up".
 * Measured, that is not hypothetical: objectstack#7344 recorded every non-admin
 * session taking `403 PERMISSION_DENIED` on this exact read
 * (`operation 'find' on object 'sys_inbox_message' is not permitted for
 * positions [org_member, contributor, finance, everyone]`) while
 * `/api/v1/notifications` — a projection of the very same rows — answered with
 * their unread messages. Admin sessions read the rows and saw the card work.
 * One build, one console pin, opposite screenshots, decided by who was signed in.
 *
 * The vocabulary is `MetadataProvider`'s per-type status, deliberately — see
 * #4300, which fixed the same class ("an unloadable app list is UNKNOWN, not
 * 'no default app'") and ruled one source of truth, no second dialect.
 *
 * Approvals and activity are NOT fetched here (#4197). Both come from
 * `sharedUserFeeds`, which the top-bar bell reads too — on `/home` the bell and
 * these cards mount in one tree, so two owners meant the same read went out
 * twice per page. One fetch now feeds both, which is also what makes the bell's
 * badge and this card structurally incapable of showing different numbers.
 * What is still fetched here is the inbox-message list, whose query is Home's
 * own (top-`limit` titles, no read-state receipts).
 *
 * @module
 */
import { useEffect, useRef, useState } from 'react';
import { useAdapter } from '../providers/AdapterProvider';
import { useAuth } from '@object-ui/auth';
import { errorCodeIs } from '@object-ui/types';
import { useHumanActivityFeed, useSharedPendingApprovalsCount } from './sharedUserFeeds';
import type { ActivityItem } from '../layout/ActivityFeed';

export interface HomeNotification {
  id: string;
  title: string;
  actionUrl?: string;
  createdAt?: string;
}

/**
 * Whether `notifications` is an ANSWER about the user's inbox.
 *
 *  - `idle`    — not asked yet (no adapter, or no signed-in user).
 *  - `loading` — asked, still in flight.
 *  - `ready`   — the read answered. `notifications` is that answer, and only
 *                here does an empty array mean the inbox is genuinely empty.
 *  - `error`   — the read failed (denied, unreachable, malformed). The empty
 *                array is the absence of an answer, not an empty inbox.
 *
 * Same four words as `MetadataTypeStatus` (`providers/MetadataProvider`), on
 * purpose: #4300 ruled one status dialect for this exact question.
 */
export type HomeInboxStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface HomeInboxData {
  pendingApprovalsCount: number;
  notifications: HomeNotification[];
  /** Whether `notifications` is an answer — see {@link HomeInboxStatus}. */
  notificationsStatus: HomeInboxStatus;
  activities: ActivityItem[];
}

/**
 * A missing OBJECT, as opposed to a failed read of a present one. The
 * ObjectStack client throws `httpStatus` (not `status`) with an error code —
 * same predicate `sharedUserFeeds` and `AppHeader` apply to their own reads.
 */
function isMissingResource(err: unknown): boolean {
  const e = err as { httpStatus?: number; status?: number } | null;
  return e?.httpStatus === 404 || e?.status === 404 || errorCodeIs(err, 'OBJECT_NOT_FOUND');
}

export function useHomeInbox(limit = 5): HomeInboxData {
  const dataSource = useAdapter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<HomeNotification[]>([]);
  const [notificationsStatus, setNotificationsStatus] = useState<HomeInboxStatus>('idle');
  const mountedRef = useRef(true);

  // Shared with the top-bar bell — one read each, not one per consumer (#4197).
  // `useHumanActivityFeed` is Home's narrower cut of the bell's rows: real
  // human actions only, dropping the sys_*/ai_* churn (actor "System").
  const pendingApprovalsCount = useSharedPendingApprovalsCount();
  const activities = useHumanActivityFeed(limit);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Latest in-app inbox messages (assignments / @mentions / alerts).
  useEffect(() => {
    // Nothing asked yet — NOT an empty inbox. A console still settling its
    // adapter or its session must not be reported as "all caught up".
    if (!dataSource || !user?.id) {
      setNotificationsStatus('idle');
      return;
    }
    let cancelled = false;
    setNotificationsStatus('loading');
    Promise.resolve(
      dataSource.find('sys_inbox_message', {
        $filter: { user_id: user.id },
        $orderby: { created_at: 'desc' },
        $top: limit,
      }) as Promise<any>,
    )
      .then((res) => {
        if (cancelled || !mountedRef.current) return;
        const rows: any[] = Array.isArray(res?.data) ? res.data : [];
        const seenTitles = new Set<string>();
        const deduped = rows
          .filter((m) => m && (m.title ?? '').toString().trim())
          .map((m) => ({
            id: String(m.id),
            title: String(m.title),
            actionUrl: m.action_url ?? undefined,
            createdAt: m.created_at ?? undefined,
          }))
          // Collapse repeated identical notifications (e.g. recurring digests)
          // — keep the most recent of each title (rows are newest-first).
          .filter((n) => (seenTitles.has(n.title) ? false : (seenTitles.add(n.title), true)));
        setNotifications(deduped);
        setNotificationsStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled || !mountedRef.current) return;
        // A missing object is an answer: this deployment has no inbox pipeline,
        // so nothing is waiting on the user and the empty state is honest.
        // Every other failure — the objectstack#7344 denial included — is not.
        setNotificationsStatus(isMissingResource(err) ? 'ready' : 'error');
      });
    return () => { cancelled = true; };
  }, [dataSource, user?.id, limit]);

  return { pendingApprovalsCount, notifications, notificationsStatus, activities };
}
