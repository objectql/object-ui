/**
 * UnifiedSidebar
 *
 * Airtable-style contextual sidebar that dynamically switches between Home and App navigation.
 * Features:
 * - Persistent across all authenticated routes
 * - Context-aware navigation (Home vs App)
 * - Pinned bottom area (Settings, Help, User Profile)
 * - Smooth transitions between contexts
 * - Back to Home navigation from App context
 * - App switcher dropdown
 *
 * @module
 */

import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getIcon } from '../utils/getIcon';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarTrigger,
  useSidebar,
} from '@object-ui/components';
import {
  Clock,
  Star,
  StarOff,
  ChevronRight,
  Home,
  Layers,
} from 'lucide-react';
import { NavigationRenderer } from '@object-ui/layout';
import type { NavigationItem } from '@object-ui/types';
import { useMetadata } from '../providers/MetadataProvider';
import { useExpressionContext, evaluateVisibility } from '../providers/ExpressionProvider';
import { usePermissions } from '@object-ui/permissions';
import { useAuth } from '@object-ui/auth';
import { useRecentItems } from '../hooks/useRecentItems';
import { useFavorites } from '../hooks/useFavorites';
import { useNavPins } from '../hooks/useNavPins';
import { resolveI18nLabel } from '../utils';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
// useObjectLabel provides appLabel/appDescription for convention-based
// i18n lookup — `{ns}.apps.{name}.label` resolves to the translated label
// loaded from /api/v1/i18n/translations/:locale.
import { useNavigationContext } from '../context/NavigationContext';
import { useAppContextSelectors } from './ContextSelectors';

// ---------------------------------------------------------------------------
// useNavOrder – localStorage-persisted drag-and-drop reorder for nav items
// ---------------------------------------------------------------------------

function useNavOrder(appName: string) {
  const storageKey = `objectui-nav-order-${appName}`;

  const [orderMap, setOrderMap] = React.useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
      const result: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(v) && v.every((i: unknown) => typeof i === 'string')) {
          result[k] = v as string[];
        }
      }
      return result;
    } catch {
      return {};
    }
  });

  const persist = React.useCallback(
    (next: Record<string, string[]>) => {
      setOrderMap(next);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* full */ }
    },
    [storageKey],
  );

  const applyOrder = React.useCallback(
    (items: NavigationItem[]): NavigationItem[] => {
      const saved = orderMap['__root__'];
      if (!saved) return items;
      const byId = new Map(items.map(i => [i.id, i]));
      const ordered: NavigationItem[] = [];
      for (const id of saved) {
        const item = byId.get(id);
        if (item) { ordered.push(item); byId.delete(id); }
      }
      byId.forEach(item => ordered.push(item));
      return ordered;
    },
    [orderMap],
  );

  const handleReorder = React.useCallback(
    (reorderedItems: NavigationItem[]) => {
      const ids = reorderedItems.map(i => i.id);
      persist({ ...orderMap, __root__: ids });
    },
    [orderMap, persist],
  );

  return { applyOrder, handleReorder };
}

/**
 * Lazy-resolved Lucide icon — see ../utils/getIcon for impl.
 * The local symbol is kept for backwards compat with existing call sites
 * within this file.
 */

interface UnifiedSidebarProps {
  /** When in app context, the active app name */
  activeAppName?: string;
  /** Callback when user switches apps */
  onAppChange?: (name: string) => void;
}

function isMetadataDirectoryItem(item: NavigationItem): boolean {
  return (item as any).componentRef === 'metadata:directory';
}

function isPackagesItem(item: NavigationItem): boolean {
  return (item as any).componentRef === 'developer:packages';
}

function isOverviewGroup(item: NavigationItem): boolean {
  if (item.type !== 'group') return false;
  const id = String(item.id ?? '').toLowerCase();
  const label = typeof item.label === 'string' ? item.label.toLowerCase() : '';
  return id === 'overview' || label === 'overview';
}

export function UnifiedSidebar({ activeAppName }: UnifiedSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const { t } = useObjectTranslation();
  const { objectLabel: resolveNavObjectLabel, dashboardLabel: resolveNavDashboardLabel, navGroupLabel: resolveNavGroupLabel, viewLabel: resolveNavViewLabel } = useObjectLabel();
  const { context, currentAppName } = useNavigationContext();
  const { user } = useAuth();

  // Swipe-from-left-edge gesture to open sidebar on mobile
  React.useEffect(() => {
    const EDGE_THRESHOLD = 30;
    const SWIPE_DISTANCE = 50;
    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (touchStartX < EDGE_THRESHOLD && deltaX > SWIPE_DISTANCE && isMobile) {
        document.querySelector('[data-sidebar="trigger"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile]);

  const { recentItems } = useRecentItems();
  const { favorites, removeFavorite } = useFavorites();

  const { apps: metadataApps, objects: metadataObjects } = useMetadata();
  const apps = metadataApps || [];
  // Filter switcher to non-hidden apps; active-app lookup spans all so
  // direct navigation to /apps/account still renders.
  const activeApps = apps.filter((a: any) => a.active !== false && a.hidden !== true);
  const activeApp = apps.find((a: any) => a.name === (activeAppName || currentAppName) && a.active !== false) || activeApps[0];

  // Drag-reorder and pin persistence
  const { applyOrder, handleReorder } = useNavOrder(activeApp?.name || 'home');
  const { togglePin, applyPins } = useNavPins();

  // Area management
  const areas: any[] = activeApp?.areas || [];
  const [activeAreaId, setActiveAreaId] = React.useState<string | null>(
    () => areas.length > 0 ? areas[0].id : null,
  );

  React.useEffect(() => {
    if (areas.length > 0) {
      setActiveAreaId(prev => areas.some((a: any) => a.id === prev) ? prev : areas[0].id);
    } else {
      setActiveAreaId(null);
    }
  }, [activeApp?.name, areas.length]);

  // Resolve navigation items
  const activeArea = areas.find((a: any) => a.id === activeAreaId);
  const appNavigation: NavigationItem[] = activeArea?.navigation || activeApp?.navigation || [];

  // App-level context selectors (e.g. Studio's package scope). Their
  // values are injected into nav items as `{<id>}` template vars so a
  // single dropdown transparently scopes every secondary menu.
  const { contextValues, element: contextSelectorsUI } = useAppContextSelectors(
    activeApp?.name || 'home',
    activeApp?.contextSelectors,
    t,
  );

  // Home navigation items
  const homeNavigation: NavigationItem[] = React.useMemo(() => [
    { id: 'home-dashboard', label: t('home.nav', { defaultValue: 'Home' }), type: 'url' as const, url: '/home', icon: 'home' },
  ], [t]);

  // Determine which navigation to show based on context
  const navigationItems = context === 'home' ? homeNavigation : appNavigation;
  const basePath = context === 'app' && activeApp ? `/apps/${activeApp.name}` : '';
  const isStudioApp = context === 'app' && activeApp?.name === 'studio';
  const studioHomeSearch = React.useMemo(() => {
    if (!isStudioApp) return '';
    const packageId = new URLSearchParams(location.search).get('package') || contextValues.active_package;
    return packageId ? `?package=${encodeURIComponent(packageId)}` : '';
  }, [contextValues.active_package, isStudioApp, location.search]);

  const studioNavigationItems = React.useMemo(() => {
    if (context !== 'app' || activeApp?.name !== 'studio') return navigationItems;
    const packageManagementLabel = t('sidebar.packageManagement', {
      defaultValue: 'Package management',
    });
    const walk = (items: NavigationItem[]): NavigationItem[] =>
      items.flatMap((item) => {
        if (isMetadataDirectoryItem(item)) return [];
        const children = item.children?.length ? walk(item.children) : item.children;
        if (item.type === 'group' && children?.length === 0) return [];
        if (isPackagesItem(item)) {
          return [{
            ...item,
            type: 'url' as const,
            label: packageManagementLabel,
            url: `${basePath}/component/developer/packages${studioHomeSearch}`,
            children,
          }];
        }
        if (children !== item.children) {
          return [{ ...item, children }];
        }
        return [item];
      });
    return walk(navigationItems).flatMap((item) => {
      if (!isOverviewGroup(item)) return [item];
      return item.children ?? [];
    });
  }, [activeApp?.name, basePath, context, navigationItems, studioHomeSearch, t]);

  // Apply saved order and pin state
  const processedNavigation = React.useMemo(() => {
    const ordered = applyOrder(studioNavigationItems);
    return applyPins(ordered);
  }, [studioNavigationItems, applyOrder, applyPins]);

  // Recent section collapsed by default
  const [recentExpanded, setRecentExpanded] = React.useState(false);

  // Visibility evaluation
  const { evaluator } = useExpressionContext();
  const evalVis = React.useCallback(
    (expr: string | boolean | undefined) => evaluateVisibility(expr, evaluator),
    [evaluator],
  );

  // Permission check
  const { can } = usePermissions();
  const checkPerm = React.useCallback(
    (permissions: string[]) => permissions.every((perm: string) => {
      const parts = perm.split(':');
      const [object, action] = parts.length >= 2
        ? [parts[0], parts[1]]
        : [perm, 'read'];
      return can(object, action as any);
    }),
    [can],
  );

  // Runtime capability gate: hide nav items targeting objects/services
  // not registered in this runtime (e.g. cloud-only `sys_app`).
  const registeredObjectNames = React.useMemo(
    () => new Set<string>((metadataObjects || []).map((o: any) => o?.name).filter(Boolean)),
    [metadataObjects],
  );
  const checkCap = React.useCallback(
    (kind: 'object' | 'service', name: string): boolean => {
      if (kind === 'object') {
        if (registeredObjectNames.size === 0) return true;
        return registeredObjectNames.has(name);
      }
      return true;
    },
    [registeredObjectNames],
  );

  const isStudioHomeActive = isStudioApp && location.pathname.replace(/\/+$/, '') === basePath;

  return (
    <>
    <Sidebar collapsible="icon" className="!top-14 !h-[calc(100svh-3.5rem)]">
      {/* Mobile-only "Home" affordance — the desktop topbar exposes Home
          via the platform logo + AppSwitcher pill, but those are hidden
          on phones. Without this row, users entering an app on mobile
          have no way back out: there's no path-separator, no back arrow,
          and the bottom tab bar only switches between objects inside the
          current app. Render it inside the sheet header so it survives
          the SidebarHeader vs SidebarContent split. */}
      {isMobile && context === 'app' && (
        <SidebarHeader className="border-b p-1.5">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-9 text-sm font-medium">
                <Link to="/home" onClick={() => setOpenMobile(false)} data-testid="mobile-sidebar-home">
                  <Home className="h-4 w-4" />
                  <span>{t('home.nav', { defaultValue: 'Home' })}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}
      <SidebarContent className="pt-2">
        <div className="transition-opacity duration-200 ease-in-out">
          {context === 'app' && activeApp ? (
           <>
          {/* App-level context selectors (e.g. package scope) */}
          {contextSelectorsUI && (
            <SidebarGroup className="group-data-[state=collapsed]:hidden px-2 pb-1">
              <div className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/25 p-1.5 shadow-xs">
                <SidebarGroupContent>
                  {contextSelectorsUI}
                </SidebarGroupContent>
              </div>
            </SidebarGroup>
          )}

          {isStudioApp && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isStudioHomeActive}
                      tooltip={t('home.nav', { defaultValue: 'Home' })}
                    >
                      <Link to={{ pathname: basePath, search: studioHomeSearch }}>
                        <Home className="h-4 w-4" />
                        <span>{t('home.nav', { defaultValue: 'Home' })}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Area Switcher */}
           {areas.length > 1 && (
             <SidebarGroup>
               <SidebarGroupLabel className="flex items-center gap-1.5">
                 <Layers className="h-3.5 w-3.5" />
                 {t('sidebar.area', { defaultValue: 'Area' })}
               </SidebarGroupLabel>
               <SidebarGroupContent>
                 <SidebarMenu>
                   {areas.map((area: any) => {
                     const AreaIcon = getIcon(area.icon);
                     const isActiveArea = area.id === activeAreaId;
                     return (
                       <SidebarMenuItem key={area.id}>
                         <SidebarMenuButton
                           isActive={isActiveArea}
                           tooltip={area.label}
                           onClick={() => setActiveAreaId(area.id)}
                         >
                           <AreaIcon className="h-4 w-4" />
                           <span>{area.label}</span>
                         </SidebarMenuButton>
                       </SidebarMenuItem>
                     );
                   })}
                 </SidebarMenu>
               </SidebarGroupContent>
             </SidebarGroup>
           )}

           {/* App Navigation tree */}
           <NavigationRenderer
             items={processedNavigation}
             basePath={basePath}
             evaluateVisibility={evalVis}
             checkPermission={checkPerm}
             checkCapability={checkCap}
             enablePinning={!isMobile}
             onPinToggle={togglePin}
             enableReorder={!isMobile}
             onReorder={handleReorder}
             resolveObjectLabel={(objectName, fallback) => resolveNavObjectLabel({ name: objectName, label: fallback })}
             resolveDashboardLabel={(dashboardName, fallback) => resolveNavDashboardLabel({ name: dashboardName, label: fallback })}
             resolveGroupLabel={activeApp ? (groupId, fallback) => resolveNavGroupLabel(activeApp.name, groupId, fallback) : undefined}
             resolveItemLabel={activeApp ? (itemId, fallback) => (
               activeApp.name === 'studio' && fallback === t('sidebar.packageManagement', { defaultValue: 'Package management' })
                 ? fallback
                 : resolveNavGroupLabel(activeApp.name, itemId, fallback)
             ) : undefined}
             resolveViewLabel={(objectName, viewName, fallback) => resolveNavViewLabel(objectName, viewName, fallback)}
             t={t}
             templateContext={{ currentUserId: user?.id ?? null, contextValues }}
           />

           {/* Recent Items */}
           {recentItems.length > 0 && (
             <SidebarGroup>
               <SidebarGroupLabel
                 className="flex items-center gap-1.5 cursor-pointer select-none"
                 onClick={() => setRecentExpanded(prev => !prev)}
               >
                 <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${recentExpanded ? 'rotate-90' : ''}`} />
                 <Clock className="h-3.5 w-3.5" />
                 {t('sidebar.recent', { defaultValue: 'Recent' })}
               </SidebarGroupLabel>
               {recentExpanded && (
               <SidebarGroupContent>
                 <SidebarMenu>
                   {recentItems.slice(0, 5).map(item => (
                     <SidebarMenuItem key={item.id}>
                       <SidebarMenuButton asChild tooltip={item.label}>
                         <Link to={item.href}>
                           <span className="text-muted-foreground">
                             {item.type === 'dashboard' ? '📊' : item.type === 'report' ? '📈' : '📄'}
                           </span>
                           <span className="truncate">{item.label}</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   ))}
                 </SidebarMenu>
               </SidebarGroupContent>
               )}
             </SidebarGroup>
           )}

           {/* Favorites — nav-pinned entries (type 'nav') are rendered in
               the Pinned section above by NavigationRenderer, so we filter
               them out here to avoid showing them twice. */}
           {favorites.some(f => f.type !== 'nav') && (
             <SidebarGroup>
               <SidebarGroupLabel className="flex items-center gap-1.5">
                 <Star className="h-3.5 w-3.5" />
                 {t('sidebar.favorites', { defaultValue: 'Favorites' })}
               </SidebarGroupLabel>
               <SidebarGroupContent>
                 <SidebarMenu>
                   {favorites.filter(f => f.type !== 'nav').slice(0, 8).map(item => (
                     <SidebarMenuItem key={item.id}>
                       <SidebarMenuButton asChild tooltip={item.label}>
                         <Link to={item.href}>
                           <span className="text-muted-foreground">
                             {item.type === 'dashboard' ? '📊' : item.type === 'report' ? '📈' : item.type === 'page' ? '📄' : '📋'}
                           </span>
                           <span className="truncate">{item.label}</span>
                         </Link>
                       </SidebarMenuButton>
                       <SidebarMenuAction
                         showOnHover
                         onClick={(e: any) => { e.stopPropagation(); removeFavorite(item.id); }}
                         aria-label={t('sidebar.removeFromFavorites', { defaultValue: 'Remove {{name}} from favorites', name: item.label })}
                       >
                         <StarOff className="h-3 w-3" />
                       </SidebarMenuAction>
                     </SidebarMenuItem>
                   ))}
                 </SidebarMenu>
               </SidebarGroupContent>
             </SidebarGroup>
           )}
           </>
         ) : (
           /* Home Navigation */
           <>
           <SidebarGroup>
             <SidebarGroupContent>
               <SidebarMenu>
                 {homeNavigation.map((item) => {
                   const NavIcon = getIcon(item.icon);
                   const isActive = location.pathname === item.url;
                   return (
                     <SidebarMenuItem key={item.id}>
                       <SidebarMenuButton asChild tooltip={item.label as string} isActive={isActive}>
                         <Link to={item.url || '/home'}>
                           <NavIcon className="h-4 w-4" />
                           <span>{item.label as string}</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   );
                 })}
               </SidebarMenu>
             </SidebarGroupContent>
           </SidebarGroup>

           {/* Starred Apps */}
           {favorites.filter(f => f.type === 'object' || f.type === 'dashboard' || f.type === 'page').length > 0 && (
             <SidebarGroup>
               <SidebarGroupLabel className="flex items-center gap-1.5">
                 <Star className="h-3.5 w-3.5" />
                 {t('sidebar.starred', { defaultValue: 'Starred' })}
               </SidebarGroupLabel>
               <SidebarGroupContent>
                 <SidebarMenu>
                   {favorites.filter(f => f.type === 'object' || f.type === 'dashboard' || f.type === 'page').slice(0, 8).map(item => (
                     <SidebarMenuItem key={item.id}>
                       <SidebarMenuButton asChild tooltip={item.label}>
                         <Link to={item.href}>
                           <span className="text-muted-foreground">
                             {item.type === 'dashboard' ? '📊' : item.type === 'page' ? '📄' : '📋'}
                           </span>
                           <span className="truncate">{item.label}</span>
                         </Link>
                       </SidebarMenuButton>
                       <SidebarMenuAction
                         showOnHover
                         onClick={(e: any) => { e.stopPropagation(); removeFavorite(item.id); }}
                         aria-label={t('sidebar.removeFromFavorites', { defaultValue: 'Remove {{name}} from favorites', name: item.label })}
                       >
                         <StarOff className="h-3 w-3" />
                       </SidebarMenuAction>
                     </SidebarMenuItem>
                   ))}
                 </SidebarMenu>
               </SidebarGroupContent>
             </SidebarGroup>
           )}
           </>
         )}
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t p-1">
        <SidebarTrigger className="w-full justify-start pl-2 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:pl-0" />
      </SidebarFooter>
    </Sidebar>
    {/* Mobile bottom-tab navigation removed — the drawer (☰) already
        surfaces the full navigation tree, so a bottom strip of the
        first 5 leaves was pure duplication and ate ~52px of vertical
        space. Pattern follows Notion / Linear (drawer-only). */}
    </>
  );
}
