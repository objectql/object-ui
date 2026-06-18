/**
 * useHomeInbox
 *
 * One-shot fetch of the inbox streams the Home work-dashboard surfaces:
 *   - pendingApprovalsCount — items waiting on the user (REST endpoint)
 *   - notifications         — latest in-app inbox messages (assignments/@mentions)
 *   - activities            — recent human activity feed (sys_activity)
 *
 * Everything degrades silently to empty on 404 / error so deployments without
 * the approvals plugin, the inbox pipeline, or a `sys_activity` object still
 * render Home. Unlike the top-bar bell (AppHeader) this does NOT poll — Home is
 * a landing surface, one fetch on mount is enough; the bell stays the live
 * source of truth. Query shapes mirror AppHeader so the two never diverge.
 *
 * @module
 */
import { useEffect, useRef, useState } from 'react';
import { useAdapter } from '../providers/AdapterProvider';
import { useAuth } from '@object-ui/auth';
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
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [notifications, setNotifications] = useState<HomeNotification[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Recent activity (sys_activity). Raw rows use plugin-audit's column names
  // (actor_name / summary / object_name / timestamp); map onto ActivityItem and
  // keep only real human actions — drop sys_*/ai_* system churn (UUID-titled,
  // actor "System"). Degrades to [] if the object is absent.
  useEffect(() => {
    if (!dataSource) return;
    let cancelled = false;
    Promise.resolve(
      dataSource.find('sys_activity', { $orderby: { timestamp: 'desc' }, $top: 20 }) as Promise<any>,
    )
      .then((res) => {
        if (cancelled || !mountedRef.current) return;
        const rows: any[] = Array.isArray(res?.data) ? res.data : [];
        const mapped: ActivityItem[] = rows
          .filter((r) => {
            if (!r || typeof r.type !== 'string') return false;
            if (!(r.summary ?? '').toString().trim()) return false;
            const actor = String(r.actor_name ?? '').trim();
            return actor.length > 0 && actor.toLowerCase() !== 'system';
          })
          .map((r) => {
            let when = r.timestamp;
            if (!when || when === 'NOW()' || Number.isNaN(Date.parse(when))) when = r.created_at;
            const raw = String(r.type);
            const type: ActivityItem['type'] =
              raw === 'commented' || raw === 'mentioned' ? 'comment'
                : raw === 'deleted' ? 'delete'
                  : raw === 'created' ? 'create'
                    : 'update';
            return {
              id: String(r.id),
              type,
              objectName: r.object_name ?? '',
              recordId: r.record_id ?? undefined,
              user: r.actor_name ?? 'System',
              description: r.summary ?? '',
              timestamp: when ?? '',
            };
          })
          .slice(0, limit);
        setActivities(mapped);
      })
      .catch(() => { /* missing / error → empty */ });
    return () => { cancelled = true; };
  }, [dataSource, limit]);

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

  // Pending-approvals count (framework REST endpoint). 404 / error → 0.
  useEffect(() => {
    if (!user?.id) return;
    const serverUrl = (import.meta.env?.VITE_SERVER_URL || '').replace(/\/$/, '');
    const identities: string[] = [];
    if (user.id) identities.push(user.id);
    if ((user as any).email) identities.push((user as any).email);
    for (const r of (((user as any).roles || []) as string[])) { if (r) identities.push(`role:${r}`); }
    if (identities.length === 0) return;
    let cancelled = false;
    const qs = new URLSearchParams({ status: 'pending', approverId: identities.join(',') });
    fetch(`${serverUrl}/api/v1/approvals/requests?${qs}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        const seen = new Set<string>();
        for (const row of ((payload?.data || []) as { id: string }[])) seen.add(row.id);
        if (!cancelled && mountedRef.current) setPendingApprovalsCount(seen.size);
      })
      .catch(() => { /* transient / 404 → keep 0 */ });
    return () => { cancelled = true; };
  }, [user?.id]);

  return { pendingApprovalsCount, notifications, activities };
}
