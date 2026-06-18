/**
 * HomeRail
 *
 * Right-rail blocks for the bento Home layout. Each is a self-contained,
 * data-light card that surfaces a launcher-relevant slice of the inbox:
 *   - HomeApprovals — items waiting on the user (the highest-value home block)
 *   - HomePinned    — starred items (reuses the favorites store)
 *   - HomeActivity  — recent activity feed (ambient "what's happening")
 *
 * All blocks render a graceful empty state so an empty workspace (or a
 * deployment without the approvals / activity features) still looks intentional.
 *
 * @module
 */
import { Button } from '@object-ui/components';
import { CheckSquare, Star, Activity, ArrowRight } from 'lucide-react';
import type { ActivityItem } from '../../layout/ActivityFeed';
import type { FavoriteItem } from '../../hooks/useFavorites';

type TFn = (key: string, opts?: any) => string;

/** Compact relative-time formatter (e.g. "2m", "3h", "1d"). */
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

function RailCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="flex-1 text-sm font-semibold tracking-tight">{title}</h2>
        {typeof count === 'number' && count > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground tabular-nums">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function HomeApprovals({ count, onOpen, t }: { count: number; onOpen: () => void; t: TFn }) {
  return (
    <RailCard icon={CheckSquare} title={t('home.rail.approvalsTitle', { defaultValue: 'Needs your attention' })} count={count}>
      {count > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('notifications.approvalsPending', { defaultValue: '{{count}} pending approvals', count })}
          </p>
          <Button size="sm" className="w-full" onClick={onOpen} data-testid="home-approvals-open">
            {t('notifications.viewApprovals', { defaultValue: 'View approvals' })}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="home-approvals-empty"
        >
          {t('notifications.noPendingApprovals', { defaultValue: 'No pending approvals' })}
        </button>
      )}
    </RailCard>
  );
}

export function HomePinned({ items, onOpen, t }: { items: FavoriteItem[]; onOpen: (href: string) => void; t: TFn }) {
  return (
    <RailCard icon={Star} title={t('home.starredApps.title', { defaultValue: 'Pinned' })}>
      <ul className="space-y-0.5">
        {items.slice(0, 6).map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onOpen(it.href)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-muted/60 active:scale-[0.99]"
            >
              <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate text-sm">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

export function HomeActivity({ items, onViewAll, t }: { items: ActivityItem[]; onViewAll: () => void; t: TFn }) {
  return (
    <RailCard icon={Activity} title={t('sidebar.activityFeed', { defaultValue: 'Activity' })}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('layout.activityFeed.empty', { defaultValue: 'No recent activity' })}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.slice(0, 5).map((a) => (
            <li key={a.id} className="text-sm leading-snug">
              <span className="font-medium">{a.user}</span>{' '}
              <span className="text-muted-foreground">{a.description}</span>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {timeAgo(a.timestamp)} · {a.objectName}
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onViewAll}
        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {t('layout.activityFeed.viewAll', { defaultValue: 'View all activity' })}
        <ArrowRight className="h-3 w-3" />
      </button>
    </RailCard>
  );
}
