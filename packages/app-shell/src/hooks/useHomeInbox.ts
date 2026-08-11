/**
 * useHomeInbox
 *
 * The inbox streams the Home work-dashboard surfaces:
 *   - pendingApprovalsCount — items waiting on the user (REST endpoint)
 *   - notifications         — latest in-app inbox messages (assignments/@mentions)
 *   - activities            — recent human activity feed (sys_activity)
 *
 * Everything degrades silently to empty on 404 / error so deployments without
 * the approvals plugin, the inbox pipeline, or a `sys_activity` object still
 * render Home.
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
import { useHumanActivityFeed, useSharedPendingApprovalsCount } from './sharedUserFeeds';
import type { ActivityItem } from '../layout/ActivityFeed';

export interface HomeNotification {
  id: string;
  title: string;
  actionUrl?: string;
  createdAt?: string;
}

export interface HomeInboxData {
  pendingApprovalsCount: number;
  notifications: HomeNotification[];
  activities: ActivityItem[];
}

export function useHomeInbox(limit = 5): HomeInboxData {
  const dataSource = useAdapter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<HomeNotification[]>([]);
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
    if (!dataSource || !user?.id) return;
    let cancelled = false;
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
      })
      .catch(() => { /* inbox pipeline absent → empty */ });
    return () => { cancelled = true; };
  }, [dataSource, user?.id, limit]);

  return { pendingApprovalsCount, notifications, activities };
}
