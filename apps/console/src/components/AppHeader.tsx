/**
 * AppHeader
 *
 * Top header bar for the console application. Renders breadcrumb navigation
 * derived from the current route, along with search, notifications, theme
 * toggle, and connection status indicators.
 * @module
 */

import { Fragment } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SidebarTrigger,
  Button,
  Separator,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@object-ui/components';
import { Search, HelpCircle, ChevronDown } from 'lucide-react';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@object-ui/react';
import { PresenceAvatars, type PresenceUser } from '@object-ui/collaboration';
import { ModeToggle } from './mode-toggle';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ConnectionStatus } from './ConnectionStatus';
import { ActivityFeed, type ActivityItem } from './ActivityFeed';
import type { ConnectionState } from '../dataSource';
import { useAdapter } from '../context/AdapterProvider';
import { useObjectTranslation } from '@object-ui/i18n';

/** Convert a slug like "crm_dashboard" or "audit-log" to "Crm Dashboard" / "Audit Log" */
function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Fallback presence users when API is unavailable
const FALLBACK_PRESENCE_USERS: PresenceUser[] = [
  { userId: 'u1', userName: 'Alice Chen', color: '#3498db', status: 'active', lastActivity: new Date().toISOString() },
  { userId: 'u2', userName: 'Bob Smith', color: '#2ecc71', status: 'idle', lastActivity: new Date().toISOString() },
  { userId: 'u3', userName: 'Carol Li', color: '#e74c3c', status: 'active', lastActivity: new Date().toISOString() },
];

export function AppHeader({ appName, objects, connectionState, presenceUsers, activities }: { appName: string, objects: any[], connectionState?: ConnectionState, presenceUsers?: PresenceUser[], activities?: ActivityItem[] }) {
    const location = useLocation();
    const params = useParams();
    const { isOnline } = useOffline();
    const dataSource = useAdapter();
    const { t } = useObjectTranslation();

    const [apiPresenceUsers, setApiPresenceUsers] = useState<PresenceUser[] | null>(null);
    const [apiActivities, setApiActivities] = useState<ActivityItem[] | null>(null);

    const fetchPresenceAndActivities = useCallback(async () => {
      if (!dataSource) return;
      try {
        const [presenceResult, activityResult] = await Promise.all([
          dataSource.find('sys_presence').catch(() => ({ data: [] })),
          dataSource.find('sys_activity', { $orderby: { timestamp: 'desc' }, $top: 20 }).catch(() => ({ data: [] })),
        ]);
        if (presenceResult.data?.length) {
          const data = presenceResult.data as Record<string, unknown>[];
          const users = data.filter(
            (u): u is PresenceUser & Record<string, unknown> => typeof u.userId === 'string'
          );
          if (users.length) setApiPresenceUsers(users);
        }
        if (activityResult.data?.length) {
          const data = activityResult.data as Record<string, unknown>[];
          const items = data.filter(
            (a): a is ActivityItem & Record<string, unknown> => typeof a.type === 'string'
          );
          if (items.length) setApiActivities(items);
        }
      } catch {
        // Fallback to defaults handled below
      }
    }, [dataSource]);

    useEffect(() => { fetchPresenceAndActivities(); }, [fetchPresenceAndActivities]);

    const activeUsers = presenceUsers ?? apiPresenceUsers ?? FALLBACK_PRESENCE_USERS;
    const activeActivities = activities ?? apiActivities ?? [];
    
    // Parse the current route to build breadcrumbs
    const pathParts = location.pathname.split('/').filter(Boolean);
    // pathParts: ['apps', 'crm_app', 'contact', 'view', 'all'] or ['apps', 'crm_app', 'dashboard', 'crm_dashboard']
    
    const appNameFromRoute = params.appName || pathParts[1];
    const routeType = pathParts[2]; // 'contact', 'dashboard', 'page', 'report'
    const baseHref = `/apps/${appNameFromRoute}`;
    
    // Build sibling links for quick navigation dropdown
    const objectSiblings = objects.map((o: any) => ({
      label: o.label || o.name,
      href: `${baseHref}/${o.name}`,
    }));

    // Determine breadcrumb items with optional siblings for dropdown
    const breadcrumbItems: { label: string; href?: string; siblings?: { label: string; href: string }[] }[] = [
      { label: appName, href: baseHref }
    ];
    
    if (routeType === 'dashboard') {
      breadcrumbItems.push({ label: t('console.breadcrumb.dashboards'), href: `${breadcrumbItems[0].href}` });
      if (pathParts[3]) {
        breadcrumbItems.push({ label: humanizeSlug(pathParts[3]) });
      }
    } else if (routeType === 'page') {
      breadcrumbItems.push({ label: t('console.breadcrumb.pages'), href: `${breadcrumbItems[0].href}` });
      if (pathParts[3]) {
        breadcrumbItems.push({ label: humanizeSlug(pathParts[3]) });
      }
    } else if (routeType === 'report') {
      breadcrumbItems.push({ label: t('console.breadcrumb.reports'), href: `${breadcrumbItems[0].href}` });
      if (pathParts[3]) {
        breadcrumbItems.push({ label: humanizeSlug(pathParts[3]) });
      }
    } else if (routeType === 'system') {
      breadcrumbItems.push({ label: t('console.breadcrumb.system') });
      if (pathParts[3]) {
        breadcrumbItems.push({ label: humanizeSlug(pathParts[3]) });
      }
    } else if (routeType) {
      // Object route
      const currentObject = objects.find((o: any) => o.name === routeType);
      if (currentObject) {
        breadcrumbItems.push({ 
          label: currentObject.label || routeType,
          href: `/apps/${appNameFromRoute}/${routeType}`,
          siblings: objectSiblings,
        });
        
        // Check if viewing a specific record
        if (pathParts[3] === 'record' && pathParts[4]) {
          const shortId = pathParts[4].length > 12 ? `${pathParts[4].slice(0, 8)}…` : pathParts[4];
          breadcrumbItems.push({ label: `#${shortId}` });
        } else if (pathParts[3] === 'view' && pathParts[4]) {
          breadcrumbItems.push({ label: humanizeSlug(pathParts[4]) });
        }
      }
    }

    return (
        <div className="flex items-center justify-between w-full h-full px-2 sm:px-3 md:px-4 gap-1.5 sm:gap-2">
             <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                {/* Mobile sidebar trigger */}
                <SidebarTrigger className="md:hidden shrink-0" />
                <Separator orientation="vertical" className="h-4 md:hidden shrink-0" />
                
                <Breadcrumb className="hidden sm:flex min-w-0">
                  <BreadcrumbList>
                    {breadcrumbItems.map((item, index) => (
                      <Fragment key={index}>
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                          {index === breadcrumbItems.length - 1 || !item.href ? (
                            item.siblings && item.siblings.length > 1 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium">
                                  {item.label}
                                  <ChevronDown className="h-3 w-3" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                                  {item.siblings.map((sibling) => (
                                    <DropdownMenuItem key={sibling.href} asChild>
                                      <Link to={sibling.href} className="w-full">{sibling.label}</Link>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <BreadcrumbPage className="truncate max-w-[200px]">{item.label}</BreadcrumbPage>
                            )
                          ) : item.siblings && item.siblings.length > 1 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                {item.label}
                                <ChevronDown className="h-3 w-3" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                                {item.siblings.map((sibling) => (
                                  <DropdownMenuItem key={sibling.href} asChild>
                                    <Link to={sibling.href} className="w-full">{sibling.label}</Link>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={item.href} className="truncate max-w-[150px]">{item.label}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </Fragment>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
                
                {/* Mobile: Just show current page */}
                <span className="text-sm font-medium sm:hidden truncate min-w-0">
                  {breadcrumbItems[breadcrumbItems.length - 1]?.label || appName}
                </span>
             </div>
             
             <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 shrink-0">
                {/* Offline indicator */}
                {!isOnline && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-medium">
                    <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    Offline
                  </div>
                )}

                {/* Connection Status */}
                {connectionState && <ConnectionStatus state={connectionState} />}

                {/* Presence Avatars */}
                {activeUsers.length > 0 && (
                  <div className="hidden md:flex items-center shrink-0" title="Users currently online">
                    <PresenceAvatars users={activeUsers} size="sm" maxVisible={3} showStatus />
                  </div>
                )}
                
                {/* Search - Desktop — opens ⌘K command palette */}
                <button
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                  className="hidden lg:flex relative items-center gap-2 w-50 xl:w-70 h-8 px-3 text-sm rounded-md border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Search className="h-4 w-4" />
                  <span className="flex-1 text-left">Search...</span>
                  <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </button>
                
                {/* Search button - Mobile/Tablet */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8 shrink-0"
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                >
                  <Search className="h-4 w-4" />
                </Button>
                
                {/* Activity Feed */}
                <div className="hidden sm:flex shrink-0 relative">
                  <ActivityFeed activities={activeActivities} />
                </div>
                
                {/* Help */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex shrink-0">
                  <HelpCircle className="h-4 w-4" />
                </Button>
                
                {/* Theme toggle */}
                <div className="hidden sm:flex shrink-0">
                  <ModeToggle />
                </div>
                
                {/* Language switcher */}
                <div className="hidden sm:flex shrink-0">
                  <LocaleSwitcher />
                </div>
             </div>
        </div>
    );
}
