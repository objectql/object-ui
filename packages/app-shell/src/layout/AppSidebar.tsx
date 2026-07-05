/**
 * AppSidebar
 *
 * Collapsible sidebar navigation for the console. Delegates navigation
 * rendering to `NavigationRenderer` from `@object-ui/layout` (using
 * @dnd-kit drag-to-reorder and pin/unpin), while keeping Console-specific
 * features: app switcher dropdown, user footer, favorites, recent items,
 * and mobile swipe gesture.
 * @module
 */

import * as React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { getIcon as resolveIcon } from '../utils/getIcon';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarInput,
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
  useSidebar,
} from '@object-ui/components';
import {
  ChevronsUpDown,
  Plus,
  Settings,
  LogOut,
  Database,
  Clock,
  Star,
  StarOff,
  Search,
  Pencil,
  ChevronRight,
  Home,
  ListTree,
} from 'lucide-react';
import { NavigationRenderer, resolveHref, resolveActiveNavItem } from '@object-ui/layout';
import type { NavigationItem } from '@object-ui/types';
import { useMetadata } from '../providers/MetadataProvider';
import { useExpressionContext, evaluateVisibility } from '../providers/ExpressionProvider';
import { useAuth, useIsWorkspaceAdmin, getUserInitials } from '@object-ui/auth';
import { usePermissions } from '@object-ui/permissions';
import { useRecentItems } from '../hooks/useRecentItems';
import { useFavorites } from '../hooks/useFavorites';
import { useNavPins } from '../hooks/useNavPins';
import { resolveI18nLabel, matchAppBySegment, appRouteSegment } from '../utils';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
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
      // Validate shape: must be a plain object with string[] values
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

  /** Apply saved order to a flat list of navigation items. */
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
      // Append any items not in the saved order (newly added)
      byId.forEach(item => ordered.push(item));
      return ordered;
    },
    [orderMap],
  );

  /** Persist reordered items from NavigationRenderer's onReorder callback. */
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
 * Resolve a Lucide icon component by name string.
 * Delegates to the shared lazy `getIcon` helper which returns a wrapper
 * around lucide-react `DynamicIcon` so individual icons are code-split.
 */
const getIcon = resolveIcon;

export function AppSidebar({ activeAppName, onAppChange }: { activeAppName: string, onAppChange: (name: string) => void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { user, signOut, isAuthEnabled } = useAuth();
  const isWorkspaceAdmin = useIsWorkspaceAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useObjectTranslation();
  const { objectLabel: resolveNavObjectLabel, viewLabel: resolveNavViewLabel } = useObjectLabel();

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
        // Idempotent direct open (ADR-0054 C1) — no synthetic click dispatch.
        setOpenMobile(true);
      }
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, setOpenMobile]);

  const { recentItems } = useRecentItems();
  const { favorites, removeFavorite } = useFavorites();
  
  const { apps: metadataApps, objects: metadataObjects } = useMetadata();
  const apps = metadataApps || [];
  // Filter out inactive + hidden apps from the switcher list.
  const activeApps = apps.filter((a: any) => a.active !== false && a.hidden !== true);
  // The active-app lookup still spans ALL apps (incl. hidden) so a
  // direct /apps/account navigation keeps rendering the Account branding.
  // ADR-0048 (A) — route segment may be a package id; match by it (name fallback).
  const activeApp = matchAppBySegment(apps.filter((a: any) => a.active !== false), activeAppName) || activeApps[0];

  // Extract branding information from spec
  const logo = activeApp?.branding?.logo;
  const primaryColor = activeApp?.branding?.primaryColor;

  // Drag-reorder persistence via localStorage (adapted for @dnd-kit)
  const { applyOrder, handleReorder } = useNavOrder(activeAppName);

  // Navigation pin persistence via localStorage
  const { togglePin, applyPins } = useNavPins();

  // Area management — track selected area when app defines areas
  const areas: any[] = activeApp?.areas || [];
  const [activeAreaId, setActiveAreaId] = React.useState<string | null>(
    () => areas.length > 0 ? areas[0].id : null,
  );

  // Reset area when app changes or areas become available
  React.useEffect(() => {
    if (areas.length > 0) {
      setActiveAreaId(prev => areas.some((a: any) => a.id === prev) ? prev : areas[0].id);
    } else {
      setActiveAreaId(null);
    }
  }, [activeAppName, areas.length]);

  // Resolve navigation items: area navigation > flat navigation > empty
  const activeArea = areas.find((a: any) => a.id === activeAreaId);
  const resolvedNavigation: NavigationItem[] = activeArea?.navigation || activeApp?.navigation || [];

  // App-level context selectors (e.g. Studio's package scope). Their
  // values are injected into nav items as `{<id>}` template vars.
  const { contextValues, element: contextSelectorsUI } = useAppContextSelectors(
    activeAppName,
    activeApp?.contextSelectors,
    t,
  );

  // Apply saved order and pin state to navigation items
  const processedNavigation = React.useMemo(() => {
    const ordered = applyOrder(resolvedNavigation);
    return applyPins(ordered);
  }, [resolvedNavigation, applyOrder, applyPins]);

  // Search filter state for sidebar navigation
  const [navSearchQuery, setNavSearchQuery] = React.useState('');

  // Recent section collapsed by default
  const [recentExpanded, setRecentExpanded] = React.useState(false);

  // Visibility evaluation from Console expression context
  const { evaluator } = useExpressionContext();
  const evalVis = React.useCallback(
    (expr: string | boolean | undefined) => evaluateVisibility(expr, evaluator),
    [evaluator],
  );

  // Permission check from Console permissions context
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

  // Runtime capability checker — gates nav entries with `requiresObject` /
  // `requiresService` against the runtime's actual SchemaRegistry contents.
  // Currently we only probe registered objects (sourced from the metadata
  // provider, which fetches `GET /api/v1/meta/object` on mount). Service
  // gates default to pass since there is no client-side service registry
  // probe yet — callers should wire one when needed.
  const registeredObjectNames = React.useMemo(
    () => new Set<string>((metadataObjects || []).map((o: any) => o?.name).filter(Boolean)),
    [metadataObjects],
  );
  const checkCap = React.useCallback(
    (kind: 'object' | 'service', name: string): boolean => {
      if (kind === 'object') {
        // While metadata is still loading we have an empty set; show
        // entries by default to avoid a "menu flicker" where everything
        // disappears momentarily on first render.
        if (registeredObjectNames.size === 0) return true;
        return registeredObjectNames.has(name);
      }
      return true;
    },
    [registeredObjectNames],
  );

  const basePath = activeApp ? `/apps/${appRouteSegment(activeApp) ?? activeAppName}` : '';

  // Fallback system navigation when no active app exists — routes into the Setup app.
  // The marketplace entry is hidden from non-admin members (install is gated to
  // owner/admin on the server, so non-admins have no reason to see it).
  const systemFallbackNavigation: NavigationItem[] = React.useMemo(() => {
    const items: NavigationItem[] = [
      { id: 'sys-settings', label: t('layout.systemNav.systemSettings', { defaultValue: 'System Settings' }), type: 'url' as const, url: '/apps/setup', icon: 'settings' },
      { id: 'sys-apps', label: t('layout.systemNav.applications', { defaultValue: 'Applications' }), type: 'url' as const, url: '/apps/setup/system/apps', icon: 'layout-grid' },
    ];
    if (isWorkspaceAdmin) {
      items.push({ id: 'sys-marketplace', label: t('layout.systemNav.appMarketplace', { defaultValue: 'App Marketplace' }), type: 'url' as const, url: '/apps/setup/system/marketplace', icon: 'store' });
    }
    items.push(
      { id: 'sys-objects', label: t('layout.systemNav.objectManager', { defaultValue: 'Object Manager' }), type: 'url' as const, url: '/apps/setup/system/metadata/object', icon: 'database' },
      { id: 'sys-datasources', label: t('layout.systemNav.datasources', { defaultValue: 'Datasources' }), type: 'url' as const, url: '/apps/setup/component/metadata/resource?type=datasource', icon: 'database' },
      { id: 'sys-users', label: t('layout.systemNav.users', { defaultValue: 'Users' }), type: 'url' as const, url: '/apps/setup/system/users', icon: 'users' },
      { id: 'sys-orgs', label: t('layout.systemNav.organizations', { defaultValue: 'Organizations' }), type: 'url' as const, url: '/apps/setup/system/organizations', icon: 'building-2' },
      { id: 'sys-roles', label: t('layout.systemNav.roles', { defaultValue: 'Roles' }), type: 'url' as const, url: '/apps/setup/system/roles', icon: 'shield' },
      { id: 'sys-config', label: t('layout.systemNav.configuration', { defaultValue: 'Configuration' }), type: 'url' as const, url: '/apps/setup/system/settings', icon: 'sliders-horizontal' },
      // Manual "Create App" is deprecated in favour of the AI-first builder
      // (Build with AI on /home). Entry point removed; the /create-app route
      // remains reachable directly for any legacy deep links.
    );
    return items;
  }, [isWorkspaceAdmin, t]);

  return (
    <>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {activeApp ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div 
                    className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                    style={primaryColor ? { backgroundColor: primaryColor } : undefined}
                  >
                     {logo ? (
                       <img src={logo} alt={resolveI18nLabel(activeApp.label, t)} className="size-6 object-contain" />
                     ) : (
                       React.createElement(getIcon(activeApp.icon), { className: "size-4" })
                     )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{resolveI18nLabel(activeApp.label, t)}</span>
                    <span className="truncate text-xs">
                      {resolveI18nLabel(activeApp.description, t) || t('layout.appSwitcher.appsAvailable', { defaultValue: '{{count}} apps available', count: activeApps.length })}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t('layout.appSwitcher.switchApplication', { defaultValue: 'Switch Application' })}
                </DropdownMenuLabel>
                {activeApps.map((app: any) => (
                  <DropdownMenuItem
                    key={app.name}
                    onClick={() => onAppChange(appRouteSegment(app) ?? app.name)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border">
                      {app.icon ? React.createElement(getIcon(app.icon), { className: "size-3" }) : <Database className="size-3" />}
                    </div>
                    {resolveI18nLabel(app.label, t)}
                    {activeApp.name === app.name && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate('/home')} data-testid="home-link-btn">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Home className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">{t('layout.appSwitcher.home')}</div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate(`/apps/${appRouteSegment(activeApp) ?? activeAppName}/create-app`)} data-testid="add-app-btn">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">{t('layout.appSwitcher.addApp')}</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate(`/apps/${appRouteSegment(activeApp) ?? activeAppName}/edit-app/${activeAppName}`)} data-testid="edit-app-btn">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Pencil className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">{t('layout.appSwitcher.editApp')}</div>
                </DropdownMenuItem>
                {/* #2272 — jump into the app designer with the CURRENTLY
                    ACTIVE menu pre-selected. The active item is resolved
                    semantically (resolveActiveNavItem, the inverse of
                    resolveHref) and carried by its stable spec `id` via
                    `?sel=nav:<id>` — never by tree position. */}
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={() => {
                    const seg = appRouteSegment(activeApp) ?? activeAppName;
                    const active = resolveActiveNavItem(
                      processedNavigation,
                      location.pathname,
                      location.search,
                      basePath,
                      { currentUserId: user?.id ?? null, contextValues },
                    );
                    const sel = active ? `?sel=${encodeURIComponent(`nav:${active.id}`)}` : '';
                    navigate(`/apps/${seg}/metadata/app/${activeAppName}${sel}`);
                  }}
                  data-testid="edit-navigation-btn"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <ListTree className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">{t('layout.appSwitcher.editNavigation', { defaultValue: 'Edit Navigation' })}</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate('/apps/setup/system/apps')} data-testid="manage-all-apps-btn">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Settings className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">{t('layout.appSwitcher.manageAllApps')}</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            ) : (
            /* No-app fallback header */
            <SidebarMenuButton
              size="lg"
              onClick={() => navigate('/apps/setup')}
              data-testid="system-sidebar-header"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Settings className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{t('layout.appSwitcher.systemConsole')}</span>
                <span className="truncate text-xs text-muted-foreground">{t('layout.appSwitcher.noAppsConfigured')}</span>
              </div>
            </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
         {activeApp ? (
           <>
           {/* Area Switcher — shown when app defines areas */}
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

           {/* App-level context selectors (e.g. package scope) */}
           {contextSelectorsUI && (
             <SidebarGroup className="py-1">
               <SidebarGroupContent>
                 {contextSelectorsUI}
               </SidebarGroupContent>
             </SidebarGroup>
           )}

           {/* Navigation Search */}
           <SidebarGroup className="py-0">
             <SidebarGroupContent className="relative">
               <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-70" />
               <SidebarInput
                 placeholder={t('sidebar.searchNavigation', { defaultValue: 'Search navigation...' })}
                 value={navSearchQuery}
                 onChange={(e: any) => setNavSearchQuery(e.target.value)}
                 className="pl-8"
               />
             </SidebarGroupContent>
           </SidebarGroup>

           {/* Navigation tree — delegated to NavigationRenderer (@dnd-kit reorder + pin) */}
           <NavigationRenderer
             items={processedNavigation}
             basePath={basePath}
             evaluateVisibility={evalVis}
             checkPermission={checkPerm}
             checkCapability={checkCap}
             searchQuery={navSearchQuery}
             enablePinning
             onPinToggle={togglePin}
             enableReorder
             onReorder={handleReorder}
             resolveObjectLabel={(objectName, fallback) => resolveNavObjectLabel({ name: objectName, label: fallback })}
             resolveViewLabel={(objectName, viewName, fallback) => resolveNavViewLabel(objectName, viewName, fallback)}
             t={t}
             templateContext={{ currentUserId: user?.id ?? null, contextValues }}
           />

           {/* Recent Items (elevated position for quick access) */}
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

           {/* Record Favorites — nav-pinned entries (type 'nav') are
               rendered in the Pinned section above by NavigationRenderer,
               so we filter them out here to avoid showing them twice. */}
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
           /* Fallback system navigation when no apps are configured */
           <SidebarGroup data-testid="system-fallback-nav">
             <SidebarGroupLabel className="flex items-center gap-1.5">
               <Settings className="h-3.5 w-3.5" />
               {t('layout.appSwitcher.systemConsole', { defaultValue: 'System' })}
             </SidebarGroupLabel>
             <SidebarGroupContent>
               <SidebarMenu>
                 {systemFallbackNavigation.map((item) => {
                   const NavIcon = getIcon(item.icon);
                   return (
                     <SidebarMenuItem key={item.id}>
                       <SidebarMenuButton asChild tooltip={item.label}>
                         <Link to={(item as any).url || '/system'}>
                           <NavIcon className="h-4 w-4" />
                           <span>{item.label}</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   );
                 })}
               </SidebarMenu>
             </SidebarGroupContent>
           </SidebarGroup>
         )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
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
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
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
                  <DropdownMenuItem
                    onClick={() => navigate('/apps/setup')}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {t('user.settings', { defaultValue: 'Settings' })}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                {isAuthEnabled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => signOut()}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('user.logout', { defaultValue: 'Log out' })}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    {isMobile && (
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background/95 backdrop-blur-sm px-2 py-1 sm:hidden safe-area-bottom">
        {(() => {
          // Flatten group items so apps that organise navigation into groups
          // (e.g. Setup → Overview / Administration / …) still surface real
          // leaf links in the mobile bottom nav instead of rendering nothing.
          const source = activeApp ? resolvedNavigation : systemFallbackNavigation;
          const leaves: any[] = [];
          for (const item of source as any[]) {
            if (item.type === 'group') {
              for (const child of (item.children || item.items || [])) {
                if (child && child.type !== 'group') leaves.push(child);
              }
            } else {
              leaves.push(item);
            }
          }
          return leaves.slice(0, 5).map((item: any) => {
          const NavIcon = getIcon(item.icon);
          const baseUrl = activeApp ? `/apps/${appRouteSegment(activeApp) ?? activeAppName}` : '';
          const { href } = resolveHref(item, baseUrl, { currentUserId: user?.id ?? null });
          return (
            <Link key={item.id} to={href} className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] justify-center">
              <NavIcon className="h-5 w-5" />
              <span className="text-[10px] truncate max-w-[60px]">{resolveI18nLabel(item.label, t)}</span>
            </Link>
          );
          });
        })()}
      </div>
    )}
    </>
  );
}
