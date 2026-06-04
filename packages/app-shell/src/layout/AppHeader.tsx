/**
 * AppHeader — unified top bar
 *
 * Supabase-style top bar used across the whole console:
 *   [Logo] [/ App ▾ / Object ▾ ...]                       [actions] [user ▾]
 *
 * Variants:
 *   - `app`  (default when `appName` is present): sidebar trigger + AppSwitcher
 *              + breadcrumb path. Used by `ConsoleLayout` inside `/apps/:appName/*`.
 *   - `home` : no breadcrumb; displays the product wordmark (from
 *              `getProductName()`, default "ObjectOS") next to the brand
 *              logo. Used by `/home`.
 *   - `orgs` : no breadcrumb; logo + "Organizations" title. Used by the
 *              `/organizations` landing page.
 *
 * The user avatar dropdown includes the organization (workspace) switcher at
 * the top so the same chrome lets users change orgs from any page.
 * @module
 */

import { useLocation, useParams, Link, useNavigate } from 'react-router-dom';
import {
  SidebarTrigger,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  Avatar,
  AvatarImage,
  AvatarFallback,
  cn,
} from '@object-ui/components';
import {
  Search,
  HelpCircle,
  ChevronDown,
  Check,
  Lock,
  LogOut,
  Boxes,
  Layers,
  Bot,
  User,
} from 'lucide-react';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOffline } from '@object-ui/react';
import { PresenceAvatars, useTenantPresence, type PresenceUser } from '@object-ui/collaboration';
import { ModeToggle } from './ModeToggle';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ConnectionStatus } from './ConnectionStatus';
import type { ActivityItem } from './ActivityFeed';
import { InboxPopover } from './InboxPopover';
import { AppSwitcher } from './AppSwitcher';
import type { ConnectionState } from '@object-ui/data-objectstack';
import { useAdapter } from '../providers/AdapterProvider';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import type { BreadcrumbItem as BreadcrumbItemType } from '@object-ui/types';
import { useAuth, getUserInitials } from '@object-ui/auth';
import { useMetadata } from '../providers/MetadataProvider';
import { resolveI18nLabel } from '../utils';
import { getIcon } from '../utils/getIcon';
import { useMobileViewSwitcher } from './MobileViewSwitcherContext';
import { useNavigationContext } from '../context/NavigationContext';
import { getProductName } from '../runtime-config';

function humanizeSlug(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Muted `/` separator between path segments */
function PathSep() {
  return (
    <span className="select-none text-muted-foreground/40 mx-1.5 text-base font-light" aria-hidden>
      /
    </span>
  );
}


// No fake fallback presence — render nothing when the API has no data so the
// header doesn't ship phantom collaborators in production.
const EMPTY_PRESENCE_USERS: PresenceUser[] = [];

export type AppHeaderVariant = 'app' | 'home' | 'orgs';

export interface AppHeaderProps {
  variant?: AppHeaderVariant;
  appName?: string;
  objects?: any[];
  connectionState?: ConnectionState;
  presenceUsers?: PresenceUser[];
  activities?: ActivityItem[];
  activeAppName?: string;
  onAppChange?: (name: string) => void;
}

export function AppHeader({
  variant,
  appName,
  objects,
  connectionState,
  presenceUsers,
  activities,
  activeAppName,
  onAppChange,
}: AppHeaderProps) {
  const resolvedVariant: AppHeaderVariant = variant ?? (appName ? 'app' : 'home');
  const isApp = resolvedVariant === 'app';

  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const { isOnline } = useOffline();
  const {
    user,
    signOut,
    isAuthEnabled,
    organizations,
    activeOrganization,
    isOrganizationsLoading,
  } = useAuth();
  const dataSource = useAdapter();
  const { t } = useObjectTranslation();
  const { objectLabel, dashboardLabel, pageLabel, reportLabel, viewLabel, appLabel } = useObjectLabel();
  const { apps: metadataApps, dashboards: metadataDashboards, pages: metadataPages, reports: metadataReports } = useMetadata();
  const { currentAppName, recordTitle } = useNavigationContext();
  const mobileSwitcher = useMobileViewSwitcher();

  const [apiActivities, setApiActivities] = useState<ActivityItem[] | null>(null);
  /**
   * In-header notifications (ADR-0030). Polled from `sys_inbox_message` (the L5
   * in-app materialization, `mine` scope) joined with `sys_notification_receipt`
   * for read-state — the bell no longer reads the re-modeled `sys_notification`
   * L2 event (which carries no recipient/read columns).
   */
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    /** FK → sys_notification (L2 event); keys the read-state receipt. */
    notification_id?: string | null;
    /** Existing receipt row id (if any) — lets mark-read UPDATE in place. */
    receipt_id?: string | null;
    type: string;
    title: string;
    body?: string | null;
    /** Deep-link target carried by the materialization (action_url). */
    action_url?: string | null;
    source_object?: string | null;
    source_id?: string | null;
    actor_name?: string | null;
    is_read?: boolean;
    created_at?: string;
  }>>([]);
  // Once the server returns 404 for these collections we stop retrying for
  // the lifetime of the page — they're optional features and re-requesting
  // on every navigation creates console noise + wasted round trips.
  const activityUnavailableRef = useRef(false);
  const notificationsUnavailableRef = useRef(false);

  // Tracks whether the component is still mounted. Used by the pollers to
  // decide whether to apply an in-flight fetch's result, independent of any
  // single effect run's `cancelled` flag — so a fetch that outlives the
  // effect run that started it (because deps settled mid-flight during
  // bootstrap) still populates state instead of being silently dropped.
  const mountedRef = useRef(true);
  useEffect(() => {
    // Reset on (re)mount too, so StrictMode's mount→cleanup→mount cycle
    // doesn't leave it latched false and silence the pollers.
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // In-flight guards: during bootstrap the poller effects re-run several
  // times as `dataSource` / `isApp` / `user.id` settle, and each run kicks
  // an immediate fetch. Without these the same query fired 5× concurrently
  // (nothing cached yet) and flooded the backend. They coalesce to one.
  const notifInFlightRef = useRef(false);
  const approvalsInFlightRef = useRef(false);
  const activityInFlightRef = useRef(false);

  /** M11.C15: pending approvals count for the topbar shortcut. */
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const approvalsUnavailableRef = useRef(false);

  const fetchPresenceAndActivities = useCallback(async () => {
    if (!dataSource || !isApp) return;
    // ObjectStack client throws Error objects with `httpStatus` (not `status`)
    // and a `code` like `object_not_found` when the underlying object isn't
    // registered on the server. Either signal means the feature is
    // unavailable — disable it for the rest of the page.
    const isMissingResource = (err: any): boolean =>
      err?.httpStatus === 404 || err?.status === 404 || err?.code === 'object_not_found';

    // Tenant-wide presence ("who else is online?") is intentionally NOT
    // probed here. Presence is real-time ephemeral state that does not
    // belong in a regular REST collection. The feature is staged behind a
    // transport-level provider (<PresenceProvider>) which is not yet
    // wired — see ROADMAP for the realtime plan.
    if (activityUnavailableRef.current) return;
    // In-flight dedupe: this callback's identity changes as dataSource/isApp
    // settle during bootstrap, re-firing the mount effect below; coalesce the
    // immediate fetches into one instead of N (sys_activity fired 3×+).
    if (activityInFlightRef.current) return;
    activityInFlightRef.current = true;
    try {
      const activityResult = await dataSource
        .find('sys_activity', { $orderby: { timestamp: 'desc' }, $top: 20 })
        .catch((err: any) => {
          if (isMissingResource(err)) activityUnavailableRef.current = true;
          return { data: [] as Record<string, unknown>[] };
        });
      if (activityResult.data?.length) {
        const items = (activityResult.data as Record<string, unknown>[]).filter(
          (a): a is ActivityItem & Record<string, unknown> => typeof a.type === 'string'
        );
        if (items.length) setApiActivities(items);
      }
    } catch { /* fallback below */ } finally {
      activityInFlightRef.current = false;
    }
  }, [dataSource, isApp]);

  useEffect(() => { fetchPresenceAndActivities(); }, [fetchPresenceAndActivities]);

  /**
   * Poll the signed-in user's in-app inbox (ADR-0030 L5).
   *
   * Two scoped reads, joined client-side:
   *   - `sys_inbox_message` filtered by `user_id` (the `mine` materialization),
   *     20 most-recent — the notification rows themselves.
   *   - `sys_notification_receipt` filtered by `user_id` + `channel:'inbox'` —
   *     the read-state spine. A message is unread until its event has a
   *     `read`/`clicked`/`dismissed` receipt; the unread count drives the badge.
   *
   * - Adaptive interval: 10s while the tab is foregrounded so the bell reflects
   *   mentions / assignments within seconds without a server-push transport.
   * - Immediate refetch on `visibilitychange` when the user returns to the tab.
   * - On transient errors, exponential backoff (cap 2 min), reset on success.
   * - Tolerates 404 so deployments without the messaging pipeline degrade
   *   silently.
   *
   * Full server-push (SSE / WebSocket) is tracked separately; this adaptive
   * poll keeps perceived latency ~5s and is sufficient for pilots up to ~50
   * concurrent users.
   */
  useEffect(() => {
    if (!dataSource || !isApp || !user?.id) return;
    if (notificationsUnavailableRef.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ACTIVE_INTERVAL_MS = 10_000;
    const HIDDEN_INTERVAL_MS = 60_000;
    const MAX_BACKOFF_MS = 120_000;
    let backoffMs = ACTIVE_INTERVAL_MS;
    const isMissingResource = (err: any): boolean =>
      err?.httpStatus === 404 || err?.status === 404 || err?.code === 'object_not_found';
    const READ_STATES = new Set(['read', 'clicked', 'dismissed']);
    const fetchOnce = async () => {
      if (notifInFlightRef.current) return;
      notifInFlightRef.current = true;
      try {
        const [inboxRes, receiptRes] = await Promise.all([
          dataSource.find('sys_inbox_message', {
            $filter: { user_id: user.id },
            $orderby: { created_at: 'desc' },
            $top: 20,
          }) as Promise<any>,
          // Read-state spine. Best-effort: if receipts are unavailable the
          // inbox still renders (everything shows unread) rather than erroring.
          (dataSource.find('sys_notification_receipt', {
            $filter: { user_id: user.id, channel: 'inbox' },
            $top: 200,
          }) as Promise<any>).catch(() => ({ data: [] })),
        ]);
        if (!mountedRef.current) return;
        const rows: any[] = Array.isArray(inboxRes?.data) ? inboxRes.data : [];
        const receipts: any[] = Array.isArray(receiptRes?.data) ? receiptRes.data : [];
        // notification_id → { id, state } (most-advanced receipt wins).
        const receiptByNotif = new Map<string, { id: string; state: string }>();
        for (const r of receipts) {
          const nid = r?.notification_id != null ? String(r.notification_id) : '';
          if (!nid) continue;
          const prev = receiptByNotif.get(nid);
          // Prefer a read/clicked/dismissed receipt over a plain delivered one.
          if (!prev || (!READ_STATES.has(prev.state) && READ_STATES.has(r.state))) {
            receiptByNotif.set(nid, { id: String(r.id), state: String(r.state) });
          }
        }
        const merged = rows.map((m) => {
          const nid = m?.notification_id != null ? String(m.notification_id) : null;
          const rec = nid ? receiptByNotif.get(nid) : undefined;
          return {
            id: String(m.id),
            notification_id: nid,
            receipt_id: rec?.id ?? null,
            type: m.topic ?? 'notification',
            title: m.title ?? '',
            body: m.body_md ?? null,
            action_url: m.action_url ?? null,
            is_read: rec ? READ_STATES.has(rec.state) : false,
            created_at: m.created_at,
          };
        });
        setNotifications(merged);
        backoffMs = ACTIVE_INTERVAL_MS;
      } catch (err: any) {
        if (isMissingResource(err)) {
          notificationsUnavailableRef.current = true;
          return;
        }
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      } finally {
        notifInFlightRef.current = false;
      }
    };
    const scheduleNext = () => {
      if (cancelled || notificationsUnavailableRef.current) return;
      const hidden = typeof document !== 'undefined' && document.hidden;
      const delay = hidden ? HIDDEN_INTERVAL_MS : backoffMs;
      timer = setTimeout(async () => {
        await fetchOnce();
        scheduleNext();
      }, delay);
    };
    const onVisibilityChange = () => {
      if (cancelled) return;
      if (typeof document === 'undefined' || document.hidden) return;
      if (timer) { clearTimeout(timer); timer = null; }
      backoffMs = ACTIVE_INTERVAL_MS;
      fetchOnce().finally(scheduleNext);
    };
    fetchOnce().finally(scheduleNext);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [dataSource, isApp, user?.id]);

  /**
   * M11.C15: poll pending-approvals count for the topbar shortcut badge.
   * Hits the framework's `/api/v1/approvals/requests?status=pending`
   * endpoint with the user's identities (id, email, role:<r>). Degrades
   * silently to zero on 404 (approvals plugin not installed).
   *
   * The endpoint accepts a comma-separated `approverId` and matches a
   * request when ANY identity is a pending approver, so this issues ONE
   * request per poll. (It previously looped one fetch per identity, firing
   * N near-simultaneous calls every cycle — the dominant duplicate-request
   * offender on the control plane. Requires framework with multi-approverId
   * support; ship the framework + console SHA bumps together.)
   */
  useEffect(() => {
    if (!isApp || !user?.id) return;
    if (approvalsUnavailableRef.current) return;
    const serverUrl = (import.meta.env?.VITE_SERVER_URL || '').replace(/\/$/, '');
    const base = `${serverUrl}/api/v1/approvals/requests`;
    const identities: string[] = [];
    if (user.id) identities.push(user.id);
    if ((user as any).email) identities.push((user as any).email);
    for (const r of ((user as any).roles || []) as string[]) {
      if (r) identities.push(`role:${r}`);
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const POLL_MS = 30_000;
    const fetchOnce = async () => {
      if (identities.length === 0) return;
      // In-flight dedupe: bootstrap re-runs this effect a few times; coalesce
      // the immediate fetches into one instead of firing them concurrently.
      if (approvalsInFlightRef.current) return;
      approvalsInFlightRef.current = true;
      try {
        const qs = new URLSearchParams({ status: 'pending', approverId: identities.join(',') });
        const res = await fetch(`${base}?${qs}`, { credentials: 'include' });
        if (res.status === 404) { approvalsUnavailableRef.current = true; return; }
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        const seen = new Set<string>();
        for (const row of (payload?.data || []) as { id: string }[]) seen.add(row.id);
        // Apply if still mounted (not gated on this run's `cancelled`, so the
        // single in-flight fetch survives a bootstrap re-run mid-flight).
        if (mountedRef.current) setPendingApprovalsCount(seen.size);
      } catch { /* transient — keep last value */ } finally {
        approvalsInFlightRef.current = false;
      }
    };
    const schedule = () => {
      if (cancelled || approvalsUnavailableRef.current) return;
      timer = setTimeout(async () => { await fetchOnce(); schedule(); }, POLL_MS);
    };
    fetchOnce().finally(schedule);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [isApp, user?.id]);

  const unreadCount = notifications.reduce((n, x) => n + (x.is_read ? 0 : 1), 0);

  // Read-state lives in `sys_notification_receipt`, keyed
  // (notification_id, user_id, channel) — ADR-0030. Marking read UPDATEs the
  // existing `delivered` receipt to `read` (the inbox channel always writes one
  // on materialization); we INSERT only as a fallback for the rare row whose
  // receipt is missing. Rows without a `notification_id` (legacy/synthetic)
  // can't be keyed, so they update optimistically but don't persist.
  const writeReadReceipt = useCallback(async (n: { notification_id?: string | null; receipt_id?: string | null }, now: string) => {
    if (!dataSource || !n.notification_id) return;
    if (n.receipt_id) {
      await dataSource.update('sys_notification_receipt', n.receipt_id, { state: 'read', at: now });
    } else {
      await dataSource.create('sys_notification_receipt', {
        notification_id: n.notification_id,
        user_id: user?.id,
        channel: 'inbox',
        state: 'read',
        at: now,
        created_at: now,
      });
    }
  }, [dataSource, user?.id]);

  const markNotificationRead = useCallback(async (id: string) => {
    const target = notifications.find(n => n.id === id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (!target) return;
    try { await writeReadReceipt(target, new Date().toISOString()); } catch { /* best-effort */ }
  }, [notifications, writeReadReceipt]);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (!unread.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    const now = new Date().toISOString();
    await Promise.all(unread.map(n => writeReadReceipt(n, now).catch(() => {})));
  }, [notifications, writeReadReceipt]);

  const tenantPresence = useTenantPresence();
  const activeUsers = presenceUsers ?? (tenantPresence.length > 0 ? tenantPresence : EMPTY_PRESENCE_USERS);
  const activeActivities = activities ?? apiActivities ?? [];
  const orgList = organizations ?? [];
  const hasOrgSection = isOrganizationsLoading || orgList.length > 0 || !!activeOrganization;

  // Build path segments (only used in `app` variant)
  const pathParts = location.pathname.split('/').filter(Boolean);
  const appNameFromRoute = params.appName || pathParts[1];
  const routeType = pathParts[2];
  const baseHref = `/apps/${appNameFromRoute}`;

  const safeObjects = objects ?? [];

  // Filter objects to only those belonging to the current app via its navigation
  const appNameKey = activeAppName || currentAppName || appNameFromRoute;
  const currentApp = (metadataApps || []).find((a: any) => a.name === appNameKey);
  const appNavObjectNames = new Set<string>();
  const collectNavObjects = (items: any[]) => {
    for (const item of items || []) {
      if (item.type === 'object' && item.objectName) appNavObjectNames.add(item.objectName);
      if (item.children) collectNavObjects(item.children);
    }
  };
  collectNavObjects(currentApp?.navigation || []);
  for (const area of currentApp?.areas || []) collectNavObjects(area.navigation || []);
  const appObjects = appNavObjectNames.size > 0
    ? safeObjects.filter((o: any) => appNavObjectNames.has(o.name))
    : safeObjects.filter((o: any) => !o.name.startsWith('sys_') && !o.name.startsWith('auth_'));

  const objectSiblings = appObjects.map((o: any) => ({
    label: objectLabel(o),
    href: `${baseHref}/${o.name}`,
  }));

  const extraSegments: BreadcrumbItemType[] = [];

  if (isApp) {
    if (routeType === 'dashboard') {
      extraSegments.push({ label: t('console.breadcrumb.dashboards'), href: baseHref });
      if (pathParts[3]) {
        const dashboardName = pathParts[3];
        const dashboardDef = (metadataDashboards || []).find((d: any) => d.name === dashboardName);
        const fallback = dashboardDef?.label || humanizeSlug(dashboardName);
        extraSegments.push({ label: dashboardLabel({ name: dashboardName, label: fallback }) });
      }
    } else if (routeType === 'page') {
      extraSegments.push({ label: t('console.breadcrumb.pages'), href: baseHref });
      if (pathParts[3]) {
        const pageName = pathParts[3];
        const pageDef = (metadataPages || []).find((p: any) => p.name === pageName);
        const fallback = pageDef?.label || humanizeSlug(pageName);
        extraSegments.push({ label: pageLabel({ name: pageName, label: fallback }) });
      }
    } else if (routeType === 'report') {
      extraSegments.push({ label: t('console.breadcrumb.reports'), href: baseHref });
      if (pathParts[3]) {
        const reportName = pathParts[3];
        const reportDef = (metadataReports || []).find((r: any) => r.name === reportName);
        const fallback = reportDef?.label || humanizeSlug(reportName);
        extraSegments.push({ label: reportLabel({ name: reportName, label: fallback }) });
      }
    } else if (routeType === 'system') {
      extraSegments.push({ label: t('console.breadcrumb.system') });
      if (pathParts[3]) extraSegments.push({ label: humanizeSlug(pathParts[3]) });
    } else if (routeType) {
      const currentObject = safeObjects.find((o: any) => o.name === routeType);
      if (currentObject) {
        extraSegments.push({
          label: objectLabel(currentObject),
          href: `${baseHref}/${routeType}`,
          siblings: objectSiblings,
        });
        if (pathParts[3] === 'record' && pathParts[4]) {
          const shortId = pathParts[4].length > 12 ? `${pathParts[4].slice(0, 8)}…` : pathParts[4];
          const trimmedTitle = recordTitle?.trim();
          const displayTitle = trimmedTitle && trimmedTitle.length > 48
            ? `${trimmedTitle.slice(0, 45)}…`
            : trimmedTitle;
          extraSegments.push({ label: displayTitle || `#${shortId}` });
        } else if (pathParts[3] === 'view' && pathParts[4]) {
          // Prefer the view's metadata label (e.g. "Lead Pipeline") over a
          // humanized slug ("Kanban By Status") so the breadcrumb matches the
          // tab label users clicked.
          const viewName = pathParts[4];
          const definedViews = (currentObject as any).listViews || (currentObject as any).list_views || {};
          const viewDef = (definedViews as Record<string, any>)[viewName];
          const fallbackLabel = (viewDef && (viewDef.label || viewDef.title)) || humanizeSlug(viewName);
          const localizedViewLabel = viewLabel(currentObject.name, viewName, fallbackLabel);
          extraSegments.push({ label: localizedViewLabel });
        }
      }
    }
  }

  const lastSegmentLabel = extraSegments[extraSegments.length - 1]?.label || appName || '';

  return (
    <div className="flex items-center justify-between w-full h-full">
      {/* ── LEFT: Logo / App / Object path ── */}
      <div className="flex items-center min-w-0 flex-1">
        {/* Platform logo — links to home. Hidden on mobile when inside an
            app: the sidebar (opened via the SidebarTrigger ☰) already
            exposes the home affordance, so duplicating it in the topbar
            just steals horizontal space from the page title. */}
        <Link
          to="/home"
          className={cn(
            "flex items-center justify-center h-7 w-7 shrink-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
            isApp && "hidden sm:flex"
          )}
          title={getProductName()}
        >
          <Layers className="h-4 w-4" />
        </Link>

        {resolvedVariant === 'home' && (
          <span className="hidden sm:inline ml-2 text-sm font-semibold tracking-tight">
            {getProductName()}
          </span>
        )}

        {resolvedVariant === 'orgs' && (
          <>
            <PathSep />
            <span className="text-sm font-medium text-foreground/80 px-1.5">
              {t('organizations.title', { defaultValue: 'Organizations' })}
            </span>
          </>
        )}

        {isApp && (
          <>
            {/* Keep the sidebar trigger visible through narrow desktop widths,
                where the sidebar may already be collapsed into icon mode. */}
            <SidebarTrigger className="lg:hidden shrink-0 ml-1" aria-label={t('common.toggleSidebar') || 'Toggle sidebar'} />

            {/* App dropdown — desktop/tablet only. On mobile the sidebar
                already shows the active app at its top, so a second app
                pill in the topbar is pure noise. */}
            {activeAppName && onAppChange ? (
              <>
                <span className="hidden sm:flex items-center"><PathSep /></span>
                <div className="hidden sm:flex items-center">
                  <AppSwitcher activeAppName={activeAppName} onAppChange={onAppChange} />
                </div>
              </>
            ) : appName ? (
              <>
                <span className="hidden sm:flex items-center"><PathSep /></span>
                <span className="hidden sm:inline text-sm font-medium text-foreground/80 px-1.5">{appName}</span>
              </>
            ) : null}

            {/* Extra path segments */}
            {extraSegments.map((seg, i) => {
              const isLast = i === extraSegments.length - 1;
              return (
                <span key={i} className="hidden sm:flex items-center min-w-0">
                  <PathSep />
                  {seg.siblings && seg.siblings.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-foreground ${!isLast ? 'text-foreground/60' : 'text-foreground/80'}`}>
                        {seg.label}
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" sideOffset={8} className="w-56 max-h-72 overflow-y-auto">
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                          Switch Object
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {seg.siblings.map((sibling) => (
                          <DropdownMenuItem key={sibling.href} asChild>
                            <Link to={sibling.href} className="w-full">{sibling.label}</Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : seg.href ? (
                    <Link
                      to={seg.href}
                      className={`rounded-md px-1.5 py-1 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground truncate max-w-[160px] ${isLast ? 'text-foreground/80' : 'text-foreground/60'}`}
                    >
                      {seg.label}
                    </Link>
                  ) : (
                    <span className={`px-1.5 py-1 text-sm font-medium truncate max-w-[160px] ${isLast ? 'text-foreground/80' : 'text-foreground/60'}`}>
                      {seg.label}
                    </span>
                  )}
                </span>
              );
            })}

            {/* Mobile: current page label or view switcher */}
            {mobileSwitcher && mobileSwitcher.views.length > 0 ? (
              mobileSwitcher.views.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="sm:hidden flex items-center gap-0.5 min-w-0 ml-1 rounded-md px-1.5 py-1 text-sm font-medium hover:bg-accent active:bg-accent/80 transition-colors"
                      aria-label="Switch view"
                    >
                      <span className="truncate max-w-[180px]">
                        {mobileSwitcher.triggerLabel ??
                          mobileSwitcher.views.find((v) => v.id === mobileSwitcher.activeViewId)?.label ??
                          lastSegmentLabel}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[220px] max-w-[280px]">
                    {mobileSwitcher.views.map((v) => {
                      const isActive = v.id === mobileSwitcher.activeViewId;
                      return (
                        <DropdownMenuItem
                          key={v.id}
                          onSelect={() => {
                            if (!isActive) mobileSwitcher.onChange(v.id);
                          }}
                          className="gap-2"
                        >
                          {v.icon ? (
                            <span className="shrink-0 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{v.icon}</span>
                          ) : null}
                          <span className="flex-1 truncate">{v.label}</span>
                          {v.locked ? (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                          ) : null}
                          {isActive ? (
                            <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
                          ) : null}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-sm font-medium sm:hidden truncate min-w-0 ml-1">
                  {mobileSwitcher.triggerLabel ?? mobileSwitcher.views[0].label}
                </span>
              )
            ) : (
              <span className="text-sm font-medium sm:hidden truncate min-w-0 ml-1">
                {lastSegmentLabel}
              </span>
            )}
          </>
        )}
      </div>

      {/* ── RIGHT: actions (grouped: search | notifications/help | preferences/account) ── */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 [&>*+*[data-topbar-group]]:ml-1 [&>[data-topbar-group]+[data-topbar-group]]:border-l [&>[data-topbar-group]+[data-topbar-group]]:border-border/60 [&>[data-topbar-group]+[data-topbar-group]]:pl-1 sm:[&>[data-topbar-group]+[data-topbar-group]]:pl-2 sm:[&>[data-topbar-group]+[data-topbar-group]]:ml-2">
        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
            Offline
          </div>
        )}

        {/* Connection Status — app only */}
        {isApp && connectionState && <ConnectionStatus state={connectionState} />}

        {/* Presence Avatars — app only */}
        {isApp && activeUsers.length > 0 && (
          <div className="hidden md:flex items-center shrink-0" title="Users currently online">
            <PresenceAvatars users={activeUsers} size="sm" maxVisible={3} showStatus />
          </div>
        )}

        {/* Group 1: Search */}
        <div data-topbar-group className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* Search — desktop */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="hidden lg:flex relative items-center gap-2 w-48 xl:w-64 h-8 px-3 text-sm rounded-md border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs">
              {t('console.search', { defaultValue: 'Search…' })}
            </span>
            <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          {/* Search — mobile/tablet */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8 shrink-0"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            aria-label={t('console.search', { defaultValue: 'Search…' })}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Group 2: Inbox (notifications + approvals + activity) & Help */}
        <div data-topbar-group className="flex items-center gap-0.5 shrink-0">
          {/*
           * UX P0-2: a single bell consolidates what used to be three
           * separate top-bar buttons (ActivityFeed, Approvals, Notifications).
           * Reduces visual noise and removes the duplicated "9+" badges.
           */}
          <InboxPopover
            notifications={notifications}
            unreadCount={unreadCount}
            pendingApprovalsCount={pendingApprovalsCount}
            activities={activeActivities}
            onMarkAllRead={markAllRead}
            onMarkRead={markNotificationRead}
          />

          {/* AI Assistant */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            asChild
            aria-label={t('topbar.aiAssistant', { defaultValue: 'AI Assistant' })}
          >
            <Link to="/ai">
              <Bot className="h-4 w-4" />
            </Link>
          </Button>

          {/* Help */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden md:flex shrink-0"
            asChild
            aria-label={t('sidebar.helpTooltip', { defaultValue: 'Help & Documentation' })}
          >
            <a href="https://docs.objectstack.ai" target="_blank" rel="noopener noreferrer">
              <HelpCircle className="h-4 w-4" />
            </a>
          </Button>
        </div>

        {/* Group 3: Account (theme + lang moved into avatar dropdown) */}
        <div data-topbar-group className="flex items-center gap-0.5 shrink-0">        {/* User Profile + Organization switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
              <Avatar className="h-7 w-7 rounded-full">
                <AvatarImage src={user?.image} alt={user?.name ?? 'User'} />
                <AvatarFallback className="rounded-full bg-primary text-primary-foreground text-xs">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-64 rounded-lg" sideOffset={4}>
            {/* User identity */}
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user?.image} alt={user?.name ?? 'User'} />
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.name ?? 'User'}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email ?? ''}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {/*
               * Profile — land directly on the Account app's profile_card
               * component. We link to the explicit component route rather than
               * `/apps/account` because the bare app path does not reliably
               * resolve to the first (component-type) nav item, leaving the
               * avatar menu's account entry dead. Entering at the component
               * route still mounts the Account app shell (Inbox / Security /
               * Developer remain reachable from its sidebar).
               */}
              <DropdownMenuItem
                onClick={() => navigate('/apps/account/component/account/profile_card')}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                {t('user.profile', { defaultValue: 'Profile' })}
              </DropdownMenuItem>
              {hasOrgSection && (
                <DropdownMenuItem onClick={() => navigate('/organizations')} className="cursor-pointer">
                  <Boxes className="mr-2 h-4 w-4" />
                  {t('organizations.mine', { defaultValue: 'My Organizations' })}
                </DropdownMenuItem>
              )}
              {/*
               * Hidden apps (App.hidden === true) surface here instead
               * of in the App Switcher. This is the standard pattern for
               * personal-settings-style apps that would feel out of place
               * next to business apps — Personal Settings, etc. The `account`
               * app is represented by the explicit Profile link above, so it
               * is filtered out here to avoid a duplicate (dead) entry.
               */}
              {(metadataApps || [])
                .filter((a: any) => a.active !== false && a.hidden === true && a.name !== 'account')
                .map((app: any) => {
                  const AppIcon = getIcon(app.icon);
                  const label = appLabel({ name: app.name, label: resolveI18nLabel(app.label, t) });
                  return (
                    <DropdownMenuItem
                      key={`hidden_app_${app.name}`}
                      onClick={() => navigate(`/apps/${app.name}`)}
                      className="cursor-pointer"
                    >
                      <AppIcon className="mr-2 h-4 w-4" />
                      {label}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuGroup>

            {/*
             * UX P0-2: theme + locale switchers used to be standalone
             * top-bar buttons. They're rarely-used preferences so they live
             * under the avatar dropdown now, freeing top-bar real estate.
             * Each is rendered as a non-interactive label + the existing
             * control so the dropdown handles outside-click / esc cleanly.
             */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground uppercase tracking-wide px-2">
              {t('user.preferences', { defaultValue: 'Preferences' })}
            </DropdownMenuLabel>
            <div className="flex items-center justify-between px-2 py-1.5 text-sm">
              <span className="text-foreground/80">
                {t('user.theme', { defaultValue: 'Theme' })}
              </span>
              <ModeToggle />
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 text-sm">
              <span className="text-foreground/80">
                {t('user.language', { defaultValue: 'Language' })}
              </span>
              <LocaleSwitcher />
            </div>

            {isAuthEnabled && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('user.logout', { defaultValue: 'Log out' })}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
