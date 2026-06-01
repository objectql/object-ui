/**
 * InboxPopover
 *
 * UX P0-2: a single "inbox" surface that bundles the three things that
 * used to occupy separate top-bar buttons:
 *   - Notifications (mentions, assignments, system alerts)
 *   - Approvals (pending approval requests for the user)
 *   - Activity (recent activity feed across the org)
 *
 * Rendered as a single bell button + popover with a tabbed body. The badge
 * shows the combined unread count (notifications + approvals) so users
 * still see at-a-glance pressure.
 *
 * @module
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@object-ui/components';
import { Bell, CheckSquare, Activity as ActivityIcon } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import type { ActivityItem } from './ActivityFeed';
import { useNavigationContext } from '../context/NavigationContext';

export interface InboxNotification {
  id: string;
  /** FK → sys_notification (L2 event) — keys the read-state receipt (ADR-0030). */
  notification_id?: string | null;
  receipt_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  /** Deep-link target carried by the inbox materialization. */
  action_url?: string | null;
  source_object?: string | null;
  source_id?: string | null;
  actor_name?: string | null;
  is_read?: boolean;
  created_at?: string;
}

export interface InboxPopoverProps {
  notifications: InboxNotification[];
  unreadCount: number;
  pendingApprovalsCount: number;
  activities: ActivityItem[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function InboxPopover({
  notifications,
  unreadCount,
  pendingApprovalsCount,
  activities,
  onMarkAllRead,
  onMarkRead,
}: InboxPopoverProps) {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const { currentAppName } = useNavigationContext();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notifications' | 'approvals' | 'activity'>('notifications');
  // Sub-filter inside Notifications: default to Unread so users see what
  // actually needs their attention first. The popover caps at 20 rows from
  // the server (`?view=mine` already scopes to current user), so we filter
  // client-side — switching tabs never re-fetches.
  const [notifFilter, setNotifFilter] = useState<'unread' | 'all'>('unread');

  const totalBadge = unreadCount + pendingApprovalsCount;
  const ariaLabel = t('sidebar.inboxAriaLabel', { defaultValue: 'Open inbox' }) as string;

  // Pulse the bell once whenever the unread/approval pressure increases.
  // We track the previous total in a ref so the very first render (when
  // the counts arrive from the server) doesn't trigger a spurious pulse.
  const prevTotalRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const prev = prevTotalRef.current;
    if (prev !== null && totalBadge > prev) {
      setPulse(true);
      const timeout = window.setTimeout(() => setPulse(false), 1200);
      return () => window.clearTimeout(timeout);
    }
    prevTotalRef.current = totalBadge;
    return undefined;
  }, [totalBadge]);
  // Keep prev in sync after the pulse window so a subsequent increase
  // (e.g. 3 → 5 right after 5 settled) re-triggers the animation.
  useEffect(() => {
    if (!pulse) prevTotalRef.current = totalBadge;
  }, [pulse, totalBadge]);

  const goToApprovals = () => {
    setOpen(false);
    const app = currentAppName ?? params.appName;
    navigate(app ? `/apps/${app}/system/approvals` : '/apps/setup/system/approvals');
  };

  const goToAllNotifications = () => {
    setOpen(false);
    // Route through the setup app's sys_inbox_message list view — the
    // canonical full-page inbox (ADR-0030 L5), outside per-app sidebars. The
    // `?view=mine` query selects the user-scoped "Notifications" view, matching
    // the popover scope.
    navigate('/apps/setup/sys_inbox_message?view=mine');
  };

  const goToAllActivity = () => {
    setOpen(false);
    // Mirror of goToAllNotifications: drill from the popover Activity tab
    // (capped at 20 rows) into the full sys_activity list page. Org-wide
    // scope — no `?view=` qualifier — to match what the popover already shows.
    navigate('/apps/setup/sys_activity');
  };

  const handleNotificationClick = (n: InboxNotification) => {
    onMarkRead(n.id);
    const app = currentAppName ?? params.appName;
    // Prefer the materialization's action_url (ADR-0030). The messaging
    // pipeline synthesizes an app-relative `/{object}/{id}` link from the
    // event's source when a producer didn't set an explicit url.
    if (n.action_url) {
      setOpen(false);
      const url = n.action_url;
      if (/^https?:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (url.startsWith('/apps/')) {
        navigate(url);
        return;
      }
      const rel = url.startsWith('/') ? url : `/${url}`;
      navigate(app ? `/apps/${app}${rel}` : rel);
      return;
    }
    // Back-compat fallback: explicit source object/record pointer.
    if (n.source_object && n.source_id) {
      setOpen(false);
      const target = app
        ? `/apps/${app}/${n.source_object}/${n.source_id}`
        : `/objects/${n.source_object}/${n.source_id}`;
      navigate(target);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 relative shrink-0 ${pulse ? 'motion-safe:animate-bounce' : ''}`}
          aria-label={ariaLabel}
          title={t('sidebar.inbox', { defaultValue: 'Inbox' }) as string}
        >
          <Bell className="h-4 w-4" />
          {totalBadge > 0 && (
            <span
              key={totalBadge}
              className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] leading-4 text-white text-center px-1 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in-0 motion-safe:duration-200"
            >
              {totalBadge > 9 ? '9+' : totalBadge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-96 p-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <div className="text-sm font-semibold">
            {t('sidebar.inbox', { defaultValue: 'Inbox' })}
          </div>
          {tab === 'notifications' && unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('notifications.markAllRead', { defaultValue: 'Mark all read' })}
            </button>
          )}
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-1 h-9">
            <TabsTrigger value="notifications" className="text-xs gap-1.5 data-[state=active]:bg-transparent">
              <Bell className="h-3.5 w-3.5" />
              {t('sidebar.notifications', { defaultValue: 'Notifications' })}
              {unreadCount > 0 && (
                <span
                  key={`notif-${unreadCount}`}
                  className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-200"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs gap-1.5 data-[state=active]:bg-transparent">
              <CheckSquare className="h-3.5 w-3.5" />
              {t('sidebar.approvals', { defaultValue: 'Approvals' })}
              {pendingApprovalsCount > 0 && (
                <span
                  key={`appr-${pendingApprovalsCount}`}
                  className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] text-white motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-200"
                >
                  {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5 data-[state=active]:bg-transparent">
              <ActivityIcon className="h-3.5 w-3.5" />
              {t('sidebar.activityFeed', { defaultValue: 'Activity' })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="m-0 max-h-80 overflow-auto">
            {/* Unread/All sub-filter. Keeps the surface compact (matches the
                Linear / GitHub inbox pattern) without bloating the primary
                Tabs strip. */}
            <div className="flex items-center gap-1 border-b px-2 py-1.5">
              <button
                type="button"
                onClick={() => setNotifFilter('unread')}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  notifFilter === 'unread'
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('notifications.filterUnread', { defaultValue: 'Unread' })}
                {unreadCount > 0 && (
                  <span className="ml-1 text-[10px] opacity-70">{unreadCount}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setNotifFilter('all')}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  notifFilter === 'all'
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('notifications.filterAll', { defaultValue: 'All' })}
              </button>
            </div>
            {(() => {
              const visible =
                notifFilter === 'unread'
                  ? notifications.filter((n) => !n.is_read)
                  : notifications;
              if (visible.length === 0) {
                return (
                  <div className="px-3 py-8 text-sm text-muted-foreground text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
                    {notifFilter === 'unread'
                      ? t('notifications.emptyUnread', { defaultValue: "You're all caught up" })
                      : t('notifications.empty', { defaultValue: 'No notifications' })}
                  </div>
                );
              }
              return (
                <ul className="divide-y">
                  {visible.map((n, idx) => (
                    <li
                      key={n.id}
                      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
                      style={{ animationDelay: `${Math.min(idx, 6) * 20}ms` }}
                    >
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors duration-150 ${n.is_read ? '' : 'bg-accent/40'}`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary transition-opacity duration-200 ${n.is_read ? 'opacity-0' : 'opacity-100'}`}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium leading-tight truncate">{n.title}</div>
                            {n.body && (
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {timeAgo(n.created_at)}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
            {/* Footer link to the dedicated /sys_inbox_message list. The popover
                only shows the 20 most-recent rows; users need a path to the
                full inbox for bulk operations and older history. */}
            <div className="border-t px-3 py-2 text-center">
              <button
                type="button"
                onClick={goToAllNotifications}
                className="text-xs text-primary hover:underline"
              >
                {t('notifications.viewAll', { defaultValue: 'View all notifications' })}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="approvals" className="m-0 max-h-80 overflow-auto">
            <div className="px-3 py-6 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
              {pendingApprovalsCount > 0 ? (
                <>
                  <CheckSquare className="mx-auto h-6 w-6 text-amber-500 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300" />
                  <div className="mt-2 text-sm font-medium">
                    {t('notifications.approvalsPending', {
                      defaultValue: '{{count}} pending approvals',
                      count: pendingApprovalsCount,
                    })}
                  </div>
                  <Button size="sm" className="mt-3" onClick={goToApprovals}>
                    {t('notifications.viewApprovals', { defaultValue: 'View approvals' })}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    {t('notifications.noPendingApprovals', {
                      defaultValue: 'No pending approvals',
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={goToApprovals}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    {t('notifications.openApprovalsInbox', { defaultValue: 'Open Approvals Inbox' })}
                  </button>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="m-0 max-h-80 overflow-auto">
            {activities.length === 0 ? (
              <div className="px-3 py-8 text-sm text-muted-foreground text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
                {t('layout.activityFeed.empty', { defaultValue: 'No recent activity' })}
              </div>
            ) : (
              <ul className="divide-y">
                {activities.slice(0, 20).map((a, idx) => (
                  <li
                    key={a.id}
                    className="px-3 py-2.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
                    style={{ animationDelay: `${Math.min(idx, 6) * 20}ms` }}
                  >
                    <div className="text-sm leading-tight truncate">
                      <span className="font-medium">{a.user}</span>{' '}
                      <span className="text-muted-foreground">{a.description}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {timeAgo(a.timestamp)} · {a.objectName}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {/* Footer link to dedicated /sys_activity list. Symmetric with
                the Notifications tab footer — the popover caps at 20 rows;
                users need a path to the full activity stream. Rendered even
                in the empty state so users can still browse historical data. */}
            <div className="border-t px-3 py-2 text-center">
              <button
                type="button"
                onClick={goToAllActivity}
                className="text-xs text-primary hover:underline"
              >
                {t('layout.activityFeed.viewAll', { defaultValue: 'View all activity' })}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
