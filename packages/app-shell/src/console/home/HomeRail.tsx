/**
 * HomeRail
 *
 * Dashboard cards for the Home work-dashboard:
 *   - HomeActionCenter — "what needs me" (approvals + inbox notifications);
 *     the reason a business user opens Home, so it leads the page.
 *   - HomeContinue     — recent items, compact "pick up where you left off".
 *   - HomeActivity     — recent human activity feed (ambient context).
 *
 * Each renders a graceful empty state so a quiet workspace still looks
 * intentional rather than broken.
 *
 * @module
 */
import {
  CheckSquare, Activity, ArrowRight, CheckCheck, Bell, Clock,
  FileText, Database, LayoutDashboard, File,
} from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import type { ActivityItem } from '../../layout/ActivityFeed';
import type { HomeNotification } from '../../hooks/useHomeInbox';
import type { RecentItem } from '../../hooks/useRecentItems';
import { timeAgo } from '../../utils/relativeTime';

type TFn = (key: string, opts?: any) => string;

function Card({
  icon: Icon,
  title,
  count,
  accent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        'rounded-2xl bg-card/80 backdrop-blur-sm p-4 ' +
        (accent ? 'border border-primary/30' : 'border border-border/70')
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className={'h-4 w-4 ' + (accent ? 'text-primary' : 'text-muted-foreground')} />
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

function Row({
  icon: Icon,
  iconClass,
  label,
  meta,
  trailing,
  onClick,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  label: string;
  meta?: string;
  trailing?: React.ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted/60 active:scale-[0.99]"
      >
        <span className={'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ' + iconClass}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        {meta && <span className="shrink-0 text-[11px] text-muted-foreground">{meta}</span>}
        {trailing}
      </button>
    </li>
  );
}

export function HomeActionCenter({
  pendingApprovalsCount,
  notifications,
  onOpenApprovals,
  onOpenNotification,
  t,
}: {
  pendingApprovalsCount: number;
  notifications: HomeNotification[];
  onOpenApprovals: () => void;
  onOpenNotification: (n: HomeNotification) => void;
  t: TFn;
}) {
  const { language } = useObjectTranslation();
  const total = pendingApprovalsCount + notifications.length;
  return (
    <Card icon={CheckSquare} accent count={total} title={t('home.actionCenter.title', { defaultValue: 'Needs your attention' })}>
      {total === 0 ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <CheckCheck className="h-4 w-4 text-emerald-500" />
          {t('home.actionCenter.empty', { defaultValue: "You're all caught up" })}
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {pendingApprovalsCount > 0 && (
            <Row
              icon={CheckSquare}
              iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              label={t('notifications.approvalsPending', { defaultValue: '{{count}} pending approvals', count: pendingApprovalsCount })}
              trailing={<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              onClick={onOpenApprovals}
              testId="home-action-approvals"
            />
          )}
          {notifications.map((n) => (
            <Row
              key={n.id}
              icon={Bell}
              iconClass="bg-primary/10 text-primary"
              label={n.title}
              meta={timeAgo(n.createdAt, language)}
              onClick={() => onOpenNotification(n)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

const RECENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  object: Database,
  record: FileText,
  dashboard: LayoutDashboard,
  page: File,
};

// Soft per-type tint — gives the recent list life without competing with the
// vibrant app icons above it (apps stay the colourful primary layer).
const RECENT_TONE: Record<string, string> = {
  object: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  record: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  dashboard: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  page: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export function HomeContinue({ items, onOpen, t }: { items: RecentItem[]; onOpen: (href: string) => void; t: TFn }) {
  return (
    <Card icon={Clock} title={t('home.recentApps.title', { defaultValue: 'Recently Accessed' })}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('home.continueEmpty', { defaultValue: 'Items you open will show up here.' })}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((it) => (
            <Row
              key={it.id}
              icon={RECENT_ICON[it.type] || FileText}
              iconClass={RECENT_TONE[it.type] || 'bg-muted text-muted-foreground'}
              label={it.label}
              meta={t(`home.recentApps.itemType.${it.type}`, { defaultValue: it.type })}
              onClick={() => onOpen(it.href)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function HomeActivity({ items, onViewAll, t }: { items: ActivityItem[]; onViewAll: () => void; t: TFn }) {
  const { language } = useObjectTranslation();
  return (
    <Card icon={Activity} title={t('sidebar.activityFeed', { defaultValue: 'Activity' })}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('layout.activityFeed.empty', { defaultValue: 'No recent activity' })}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.slice(0, 5).map((a) => (
            <li key={a.id} className="text-sm leading-snug">
              <span className="font-medium">{a.user}</span>{' '}
              <span className="text-muted-foreground">{a.description}</span>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {timeAgo(a.timestamp, language)} · {a.objectName}
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
    </Card>
  );
}
