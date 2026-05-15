/**
 * AppHeader — unified top bar
 *
 * Supabase-style top bar used across the whole console:
 *   [Logo] [/ App ▾ / Object ▾ ...]                       [actions] [user ▾]
 *
 * Variants:
 *   - `app`  (default when `appName` is present): sidebar trigger + AppSwitcher
 *              + breadcrumb path. Used by `ConsoleLayout` inside `/apps/:appName/*`.
 *   - `home` : no breadcrumb; displays the "ObjectStack" wordmark next to the
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
} from '@object-ui/components';
import {
  Search,
  HelpCircle,
  ChevronDown,
  Settings,
  LogOut,
  User as UserIcon,
  Boxes,
} from 'lucide-react';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOffline } from '@object-ui/react';
import { PresenceAvatars, type PresenceUser } from '@object-ui/collaboration';
import { ModeToggle } from './ModeToggle';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ConnectionStatus } from './ConnectionStatus';
import { ActivityFeed, type ActivityItem } from './ActivityFeed';
import { AppSwitcher } from './AppSwitcher';
import type { ConnectionState } from '@object-ui/data-objectstack';
import { useAdapter } from '../providers/AdapterProvider';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import type { BreadcrumbItem as BreadcrumbItemType } from '@object-ui/types';
import { useAuth, getUserInitials } from '@object-ui/auth';
import { useMetadata } from '../providers/MetadataProvider';
import { useNavigationContext } from '../context/NavigationContext';

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
  const { objectLabel, dashboardLabel, pageLabel, reportLabel, viewLabel } = useObjectLabel();
  const { apps: metadataApps, dashboards: metadataDashboards, pages: metadataPages, reports: metadataReports } = useMetadata();
  const { currentAppName, recordTitle } = useNavigationContext();

  const [apiPresenceUsers, setApiPresenceUsers] = useState<PresenceUser[] | null>(null);
  const [apiActivities, setApiActivities] = useState<ActivityItem[] | null>(null);
  // Once the server returns 404 for these collections we stop retrying for
  // the lifetime of the page — they're optional features and re-requesting
  // on every navigation creates console noise + wasted round trips.
  const presenceUnavailableRef = useRef(false);
  const activityUnavailableRef = useRef(false);

  const fetchPresenceAndActivities = useCallback(async () => {
    if (!dataSource || !isApp) return;
    // ObjectStack client throws Error objects with `httpStatus` (not `status`)
    // and a `code` like `object_not_found` when the underlying object isn't
    // registered on the server. Either signal means the feature is
    // unavailable — disable it for the rest of the page.
    const isMissingResource = (err: any): boolean =>
      err?.httpStatus === 404 || err?.status === 404 || err?.code === 'object_not_found';

    const presenceP = presenceUnavailableRef.current
      ? Promise.resolve({ data: [] as Record<string, unknown>[] })
      : dataSource.find('sys_presence').catch((err: any) => {
          if (isMissingResource(err)) presenceUnavailableRef.current = true;
          return { data: [] as Record<string, unknown>[] };
        });
    const activityP = activityUnavailableRef.current
      ? Promise.resolve({ data: [] as Record<string, unknown>[] })
      : dataSource
          .find('sys_activity', { $orderby: { timestamp: 'desc' }, $top: 20 })
          .catch((err: any) => {
            if (isMissingResource(err)) activityUnavailableRef.current = true;
            return { data: [] as Record<string, unknown>[] };
          });
    try {
      const [presenceResult, activityResult] = await Promise.all([presenceP, activityP]);
      if (presenceResult.data?.length) {
        const users = (presenceResult.data as Record<string, unknown>[]).filter(
          (u): u is PresenceUser & Record<string, unknown> => typeof u.userId === 'string'
        );
        if (users.length) setApiPresenceUsers(users);
      }
      if (activityResult.data?.length) {
        const items = (activityResult.data as Record<string, unknown>[]).filter(
          (a): a is ActivityItem & Record<string, unknown> => typeof a.type === 'string'
        );
        if (items.length) setApiActivities(items);
      }
    } catch { /* fallback below */ }
  }, [dataSource, isApp]);

  useEffect(() => { fetchPresenceAndActivities(); }, [fetchPresenceAndActivities]);

  const activeUsers = presenceUsers ?? apiPresenceUsers ?? EMPTY_PRESENCE_USERS;
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
        {/* Platform logo — links to home */}
        <Link
          to="/home"
          className="flex items-center justify-center h-7 w-7 shrink-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          title="ObjectStack"
        >
          <Boxes className="h-4 w-4" />
        </Link>

        {resolvedVariant === 'home' && (
          <span className="hidden sm:inline ml-2 text-sm font-semibold tracking-tight">
            ObjectStack
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
            {/* Mobile sidebar trigger */}
            <SidebarTrigger className="md:hidden shrink-0 ml-1" aria-label={t('common.toggleSidebar') || 'Toggle sidebar'} />

            {/* App dropdown */}
            {activeAppName && onAppChange ? (
              <>
                <PathSep />
                <AppSwitcher activeAppName={activeAppName} onAppChange={onAppChange} />
              </>
            ) : appName ? (
              <>
                <PathSep />
                <span className="text-sm font-medium text-foreground/80 px-1.5">{appName}</span>
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
                      <DropdownMenuTrigger className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium transition-colors outline-none hover:bg-accent hover:text-foreground ${!isLast ? 'text-foreground/60' : 'text-foreground/80'}`}>
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

            {/* Mobile: current page label */}
            <span className="text-sm font-medium sm:hidden truncate min-w-0 ml-1">
              {lastSegmentLabel}
            </span>
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
              {t('console.search', { defaultValue: 'Search...' })}
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
            aria-label={t('console.search', { defaultValue: 'Search...' })}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Group 2: Notifications & Help */}
        <div data-topbar-group className="flex items-center gap-0.5 shrink-0">
          {/* Activity Feed */}
          <div className="hidden sm:flex shrink-0">
            <ActivityFeed activities={activeActivities} />
          </div>

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

        {/* Group 3: Preferences & account */}
        <div data-topbar-group className="flex items-center gap-0.5 shrink-0">
          {/* Theme toggle */}
          <div className="hidden sm:flex shrink-0">
            <ModeToggle />
          </div>

          {/* Language switcher */}
          <div className="hidden sm:flex shrink-0">
            <LocaleSwitcher />
          </div>

        {/* User Profile + Organization switcher */}
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
              {hasOrgSection && (
                <DropdownMenuItem onClick={() => navigate('/organizations')} className="cursor-pointer">
                  <Boxes className="mr-2 h-4 w-4" />
                  {t('organizations.mine', { defaultValue: 'My Organizations' })}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate('/apps/setup/system/profile')}>
                <UserIcon className="mr-2 h-4 w-4" />
                {t('user.profile', { defaultValue: 'Profile' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/apps/setup')}>
                <Settings className="mr-2 h-4 w-4" />
                {t('sidebar.settings', { defaultValue: 'Settings' })}
              </DropdownMenuItem>
            </DropdownMenuGroup>
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
