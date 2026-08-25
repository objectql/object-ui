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
  FileText, Database, LayoutDashboard, File, CircleAlert,
} from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import type { ActivityItem } from '../../layout/ActivityFeed.js';
import type { HomeInboxStatus, HomeNotification } from '../../hooks/useHomeInbox.js';
import type { RecentItem } from '../../hooks/useRecentItems.js';
import { recentItemTypeLabel } from './recentItemTypeLabel.js';
import { timeAgo } from '../../utils/relativeTime.js';

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

/**
 * "You're all caught up" is an ASSERTION about the user's inbox, so it may only
 * be made once the inbox has answered (#4235).
 *
 * `notifications` arriving empty says nothing on its own: until #4235 the hook
 * behind it swallowed every failed read to `[]`, so a `403 PERMISSION_DENIED`
 * on `sys_inbox_message` (objectstack#7344, browser-measured for every non-admin
 * persona) reached this component wearing the exact shape of an empty inbox —
 * and the panel cheerfully told a user with nine unread messages that there was
 * nothing to do, with no badge. `notificationsStatus` is the missing bit, and
 * gating on it is why that pair is now unreachable: an unanswered read renders
 * the quiet notice below, never the affirmative copy.
 *
 * Same rule #4300 landed for the app list ("an unloadable app list is UNKNOWN,
 * not 'no default app'"), and the same status vocabulary.
 */
export function HomeActionCenter({
  pendingApprovalsCount,
  notifications,
  unreadTopicCount,
  notificationsStatus,
  onOpenApprovals,
  onOpenNotification,
  t,
}: {
  pendingApprovalsCount: number;
  /** The PREVIEW: newest-first, one row per title, capped by `useHomeInbox`. */
  notifications: HomeNotification[];
  /**
   * The TOTAL waiting in the inbox — every unread topic, not just the ones this
   * card has room for (#4329).
   *
   * Required, and separate from `notifications` for the same reason
   * `notificationsStatus` is: `notifications.length` was the badge until this
   * card learned the difference, which made the badge report the size of a
   * capped list. Nine unread showed "9" on the bell and "5" here, on one page,
   * about one set of rows. A call site that cannot say how much is waiting must
   * not be able to badge its own preview length by saying nothing.
   */
  unreadTopicCount: number;
  /**
   * Required, not optional-with-a-default: a call site that cannot say whether
   * its rows are an answer must not be able to reach the affirmative copy by
   * saying nothing.
   */
  notificationsStatus: HomeInboxStatus;
  onOpenApprovals: () => void;
  onOpenNotification: (n: HomeNotification) => void;
  t: TFn;
}) {
  const { language } = useObjectTranslation();
  // "How much needs you", which is the question the badge asks and the question
  // the bell answers with the same number. The list below is a preview of it —
  // fewer rows than this whenever the cap or the title fold bites, and that
  // gap is the point rather than a defect: badge = total, list = preview.
  const total = pendingApprovalsCount + unreadTopicCount;
  const answered = notificationsStatus === 'ready';
  return (
    <Card icon={CheckSquare} accent count={total} title={t('home.actionCenter.title', { defaultValue: 'Needs your attention' })}>
      {/*
        Rendered ALONGSIDE the list, not only instead of it: when approvals are
        known and the inbox read failed, the panel is showing half an answer,
        and saying so is the same honesty the empty case owes.
      */}
      {!answered && (
        <div
          className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
          data-testid="home-action-unanswered"
        >
          {notificationsStatus === 'error' ? (
            <>
              <CircleAlert className="h-4 w-4 text-amber-500" />
              {t('errors.unknown', { defaultValue: 'An unexpected error occurred.' })}
            </>
          ) : (
            t('common.loading', { defaultValue: 'Loading…' })
          )}
        </div>
      )}
      {/*
        Gated on the TOTAL, not on the rows on show: "You're all caught up" is a
        claim about the inbox, so it may only be made when the inbox is empty —
        never merely because this card had nothing renderable to list. (The one
        state where the two differ is an unread message with no title at all,
        which the list cannot render: the card then shows its badge and no row,
        rather than telling the user they are caught up while the bell above
        badges the same message.)
      */}
      {total === 0 ? (
        answered && (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCheck className="h-4 w-4 text-emerald-500" />
            {t('home.actionCenter.empty', { defaultValue: "You're all caught up" })}
          </div>
        )
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
              meta={recentItemTypeLabel(t, it.type)}
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
    <Card icon={Activity} title={t('sidebar.activityFeed', { defaultValue: 'Activity feed' })}>
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
