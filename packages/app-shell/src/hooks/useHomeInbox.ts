/**
 * useHomeInbox
 *
 * One-shot fetch of the two inbox streams worth surfacing on the Home
 * launcher rail: the pending-approvals count and the recent activity feed.
 * Both degrade silently to empty on 404 / error so deployments without the
 * approvals plugin or a `sys_activity` object still render the rail.
 *
 * Unlike the top-bar bell (AppHeader), this does NOT poll — Home is a landing
 * surface, so a single fetch on mount is enough; the bell stays the live
 * source of truth. Mirrors AppHeader's query shapes so the two never diverge.
 *
 * @module
 */
import { useEffect, useRef, useState } from 'react';
import { useAdapter } from '../providers/AdapterProvider';
import { useAuth } from '@object-ui/auth';
import type { ActivityItem } from '../layout/ActivityFeed';

export interface HomeInboxData {
  pendingApprovalsCount: number;
  activities: ActivityItem[];
}

export function useHomeInbox(limit = 5): HomeInboxData {
  const dataSource = useAdapter();
  const { user } = useAuth();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Recent activity (sys_activity). Raw rows use plugin-audit's column names
  // (actor_name / summary / object_name / timestamp); map them onto ActivityItem
  // and drop content-less noise (login/logout/system rows with no summary) so
  // the rail shows meaningful edits, not blank lines. Degrades to [] if absent.
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
          .filter((r) => r && typeof r.type === 'string' && (r.summary ?? '').toString().trim())
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

  return { pendingApprovalsCount, activities };
}
