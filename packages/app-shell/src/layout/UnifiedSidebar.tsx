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
import { NavigationRenderer, hasVisibleNavigationItems } from '@object-ui/layout';
import type { NavigationArea, NavigationItem } from '@object-ui/types';
import { useMetadata } from '../providers/MetadataProvider';
import { useExpressionContext, evaluateVisibility } from '../providers/ExpressionProvider';
import { usePermissions } from '@object-ui/permissions';
import { useAuth, useIsWorkspaceAdmin } from '@object-ui/auth';
import { useRecentItems } from '../hooks/useRecentItems';
import { useFavorites } from '../hooks/useFavorites';
import { useNavPins } from '../hooks/useNavPins';
import { useNavActionDispatch } from '../hooks/useNavActionDispatch';
import { resolveI18nLabel, matchAppBySegment, appRouteSegment } from '../utils';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
// useObjectLabel provides appLabel/appDescription for convention-based
// i18n lookup — `{ns}.apps.{name}.label` resolves to the translated label
// loaded from /api/v1/i18n/translations/:locale.
import { useNavigationContext } from '../context/NavigationContext';
import {
  useAppContextSelectors,
  contextSelectorQueryKey,
  STUDIO_PACKAGE_SELECTOR_ID,
} from './ContextSelectors';
import { LocalizedSidebarTrigger } from './LocalizedSidebarTrigger';

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
  const { user, activeOrganization } = useAuth();
  const isWorkspaceAdmin = useIsWorkspaceAdmin();
  // `type: 'action'` nav items dispatch through here (framework#4509). The
  // sidebar renders inside ConsoleShell's GlobalActionRuntimeProvider, so this
  // resolves to the fully-wired console runner — confirm/param/result dialogs
  // included — with no provider of its own.
  const dispatchNavAction = useNavActionDispatch();

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
  // Filter switcher to non-hidden apps; active-app lookup spans all so
  // direct navigation to /apps/account still renders.
  const activeApps = apps.filter((a: any) => a.active !== false && a.hidden !== true);
  // ADR-0048 (A) — route segment may be a package id; match by it (name fallback).
  const activeApp = matchAppBySegment(apps.filter((a: any) => a.active !== false), activeAppName || currentAppName) || activeApps[0];

  // Drag-reorder and pin persistence
  const { applyOrder, handleReorder } = useNavOrder(activeApp?.name || 'home');
  const { togglePin, applyPins } = useNavPins();

  // Visibility evaluation
  const { evaluator } = useExpressionContext();
  const evalVis = React.useCallback(
    (expr: string | boolean | undefined) => evaluateVisibility(expr, evaluator),
    [evaluator],
  );

  // Permission check for nav `requiredPermissions` entries.
  //
  // Two authored forms:
  //  - `object:action` → object CRUD gate.
  //  - bare name → an ADR-0066 system capability, checked against the union of
  //    the user's permission-set `systemPermissions` (from /me/permissions) —
  //    the SAME subset rule the server applies to `AppSchema.requiredPermissions`.
  //    This used to be misread as `can(<name>, 'read')` only, so a nav item
  //    requiring a capability was hidden even from users whose permission set
  //    granted it (admins included) — `requiredPermissions` degenerated into a
  //    "hide from everyone" switch. The object-read fallback stays for nav
  //    items that gate on a plain object name.
  const { can, hasCapabilities } = usePermissions();
  const checkPerm = React.useCallback(
    (permissions: string[]) => permissions.every((perm: string) => {
      const parts = perm.split(':');
      if (parts.length >= 2) {
        return can(parts[0], parts[1] as any);
      }
      return hasCapabilities([perm]) || can(perm, 'read');
    }),
    [can, hasCapabilities],
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

  // Area management.
  //
  // Area visibility is DERIVED from the items inside (objectui#3311 /
  // objectui#3319): the switcher offers an area iff at least one of its
  // navigation items survives the same item-level guards NavigationRenderer
  // applies (`visible`, `requiredPermissions`, runtime capabilities,
  // action-dispatcher presence). The active area is elected among the
  // VISIBLE areas only, so the user is never landed in — or stranded on —
  // an area that renders nothing. Same derivation as `AppSchemaRenderer`
  // (@object-ui/layout); the predicate is shared, not re-implemented.
  const areas: NavigationArea[] = activeApp?.areas || [];
  const visibleAreas = areas.filter((area) =>
    hasVisibleNavigationItems(area.navigation, {
      evaluateVisibility: evalVis,
      checkPermission: checkPerm,
      checkCapability: checkCap,
      // This sidebar always wires `onAction={dispatchNavAction}` on its
      // NavigationRenderer (framework#4509), so `action` items render and
      // count as area content.
      hasActionHandler: !!dispatchNavAction,
    }),
  );
  const [activeAreaId, setActiveAreaId] = React.useState<string | null>(
    () => visibleAreas.length > 0 ? visibleAreas[0].id : null,
  );

  const visibleAreaIds = visibleAreas.map((a) => a.id).join(',');

  // Re-elect when the app changes or the visible-area set changes. Keeping
  // `prev` whenever it is still visible means merely REVEALING a new area
  // never steals the user's current selection.
  React.useEffect(() => {
    if (visibleAreas.length > 0) {
      setActiveAreaId(prev => visibleAreas.some((a) => a.id === prev) ? prev : visibleAreas[0].id);
    } else {
      setActiveAreaId(null);
    }
  }, [activeApp?.name, visibleAreaIds]);

  // Resolve navigation items. The render-time `?? visibleAreas[0]` fallback
  // covers the frame between a gating change hiding the active area and the
  // effect above re-electing.
  const activeArea = visibleAreas.find((a) => a.id === activeAreaId) ?? visibleAreas[0];
  const appNavigation: NavigationItem[] = activeArea?.navigation || activeApp?.navigation || [];

  // App-level context selectors (e.g. Studio's package scope). Their
  // values are injected into nav items as `{<id>}` template vars so a
  // single dropdown transparently scopes every secondary menu.
  const { contextValues, element: contextSelectorsUI } = useAppContextSelectors(
    activeApp?.name || 'home',
    activeApp?.contextSelectors,
    t,
  );

  // Home navigation items. For workspace admins we surface the full system
  // ("Administration") nav right here on /home — previously the home context
  // showed ONLY a "Home" link, so a fresh env (no apps yet) rendered a bare
  // centered page with the real menu nowhere in sight. Mirrors AppSidebar's
  // `systemFallbackNavigation` (sans the deprecated manual "Create App").
  // Non-admins get just Home — system administration is owner/admin-gated.
  const homeNavigation: NavigationItem[] = React.useMemo(() => {
    const items: NavigationItem[] = [
      { id: 'home-dashboard', label: t('home.nav', { defaultValue: 'Home' }), type: 'url' as const, url: '/home', icon: 'home' },
      // Package documentation portal (ADR-0046) — visible to all users, not
      // just workspace admins, so it lives in the base items rather than the
      // admin cluster below.
      { id: 'docs', label: t('layout.systemNav.documentation', { defaultValue: 'Documentation' }), type: 'url' as const, url: '/docs', icon: 'book-open' },
    ];
    if (isWorkspaceAdmin) {
      // #3590 — `sys-settings` targets the system hub `/apps/setup/system`, not
      // the bare `/apps/setup`. This cluster exists FOR the fresh env described
      // above (no apps yet), and that is precisely where bare `/apps/setup` is a
      // dead link: with zero apps it renders `AppContent`'s "No Apps Configured"
      // empty state (`isSystemRoute` keys on a `/system` segment), so an admin
      // landing on `/home` — `resolveLandingPath([])` — had no way through. The
      // `/system` form resolves in BOTH branches (`extraRoutesNoApp` with no
      // active app, `extraRoutes` once one exists), so an app-bearing deployment
      // now reaches the hub here instead of whatever app `/apps/setup` fell back
      // to. Every sibling below already spells `/apps/setup/system/...`.
      const adminItems: NavigationItem[] = [
        { id: 'sys-settings', label: t('layout.systemNav.systemSettings', { defaultValue: 'System Settings' }), type: 'url' as const, url: '/apps/setup/system', icon: 'settings' },
        { id: 'sys-apps', label: t('layout.systemNav.applications', { defaultValue: 'Applications' }), type: 'url' as const, url: '/apps/setup/system/apps', icon: 'layout-grid' },
        { id: 'sys-marketplace', label: t('layout.systemNav.appMarketplace', { defaultValue: 'App Marketplace' }), type: 'url' as const, url: '/apps/setup/system/marketplace', icon: 'store' },
        { id: 'sys-objects', label: t('layout.systemNav.objectManager', { defaultValue: 'Object Manager' }), type: 'url' as const, url: '/apps/setup/system/metadata/object', icon: 'database' },
        // #3660 — canonical `…/metadata/datasource`, not the legacy
        // `…/component/metadata/resource?type=datasource` alias. See the twin
        // entry in `AppSidebar.systemFallbackNavigation` for the full note: the
        // alias renders `LegacyMetadataRedirect`, a bare `<Navigate>` onto this
        // very URL, so pointing here removes a hop without moving the landing
        // page. The alias route itself is untouched.
        { id: 'sys-datasources', label: t('layout.systemNav.datasources', { defaultValue: 'Datasources' }), type: 'url' as const, url: '/apps/setup/metadata/datasource', icon: 'database' },
        { id: 'sys-users', label: t('layout.systemNav.users', { defaultValue: 'Users' }), type: 'url' as const, url: '/apps/setup/system/users', icon: 'users' },
        { id: 'sys-orgs', label: t('layout.systemNav.organizations', { defaultValue: 'Organizations' }), type: 'url' as const, url: '/apps/setup/system/organizations', icon: 'building-2' },
        { id: 'sys-roles', label: t('layout.systemNav.roles', { defaultValue: 'Roles' }), type: 'url' as const, url: '/apps/setup/system/roles', icon: 'shield' },
        { id: 'sys-config', label: t('layout.systemNav.configuration', { defaultValue: 'Configuration' }), type: 'url' as const, url: '/apps/setup/system/settings', icon: 'sliders-horizontal' },
      ];
      items.push({
        id: 'sys-administration',
        label: t('layout.systemNav.administration', { defaultValue: 'Administration' }),
        type: 'group' as const,
        icon: 'shield',
        // Opened by default (objectui#3609). `NavigationRenderer`'s unauthored
        // default auto-collapses groups with >= 8 children, a heuristic meant
        // for one long section among many inside an app's navigation. Here the
        // group is not one section among many — on `/home` it IS the admin's
        // navigation, and this cluster exists for the zero-app deployment whose
        // whole complaint was "no way through". Nine entries behind a closed
        // disclosure would re-create that, so the spec's `expanded` is stated
        // explicitly rather than left to the count heuristic.
        expanded: true,
        children: adminItems,
      });
    }
    return items;
  }, [t, isWorkspaceAdmin]);

  // Determine which navigation to show based on context
  const navigationItems = context === 'home' ? homeNavigation : appNavigation;
  const basePath = context === 'app' && activeApp ? `/apps/${appRouteSegment(activeApp)}` : '';
  const isStudioApp = context === 'app' && activeApp?.name === 'studio';
  // Studio's home link carries the active package scope. Read (and re-emit)
  // it through the SAME per-selector key derivation the selector writes with,
  // instead of assuming the literal `package` key — for `active_package` the
  // derivation resolves to `package`, so existing links are byte-identical,
  // and the two halves can no longer drift apart (objectui#3500).
  const studioScopeKey = contextSelectorQueryKey(STUDIO_PACKAGE_SELECTOR_ID);
  const studioScopeValue = contextValues[STUDIO_PACKAGE_SELECTOR_ID];
  const studioHomeSearch = React.useMemo(() => {
    if (!isStudioApp) return '';
    const packageId = new URLSearchParams(location.search).get(studioScopeKey) || studioScopeValue;
    return packageId ? `?${studioScopeKey}=${encodeURIComponent(packageId)}` : '';
  }, [studioScopeValue, isStudioApp, location.search, studioScopeKey]);

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
              <SidebarMenuButton asChild className="min-h-[44px] text-[15px] font-medium rounded-xl">
                <Link to="/home" onClick={() => setOpenMobile(false)} data-testid="mobile-sidebar-home">
                  <Home className="h-5 w-5" />
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

          {/* Area Switcher — offered only when MULTIPLE areas are visible;
              area visibility is derived from the items inside (#3319) */}
           {visibleAreas.length > 1 && (
             <SidebarGroup>
               <SidebarGroupLabel className="flex items-center gap-1.5">
                 <Layers className="h-3.5 w-3.5" />
                 {t('sidebar.area', { defaultValue: 'Area' })}
               </SidebarGroupLabel>
               <SidebarGroupContent>
                 <SidebarMenu>
                   {visibleAreas.map((area) => {
                     const AreaIcon = getIcon(area.icon);
                     const isActiveArea = area.id === activeArea?.id;
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
             onAction={dispatchNavAction}
             t={t}
             templateContext={{ currentUserId: user?.id ?? null, currentOrgId: activeOrganization?.id ?? null, contextValues }}
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
           {/* ONE navigation renderer, both arms (objectui#3609).

               This arm used to hand-roll
               `homeNavigation.map(item => <Link to={item.url || '/home'}>)`.
               That map does not recurse, so `type: 'group'` was simply
               unsupported here — and home navigation is the only navigation
               that groups. The nine-entry Administration cluster collapsed into
               a single row; a group carries no `url` of its own, so
               `|| '/home'` pointed that row back at the page the user was
               already standing on, and not one child ever reached the DOM.
               `resolveLandingPath([])` sends a fresh-deployment admin to
               exactly this screen, and `HomePage` deliberately dropped its own
               System card because "the system entries are already in the nav" —
               so the net effect was an admin with no route into system
               administration at all.

               Routing this arm through the SAME `NavigationRenderer` the app
               arm uses (above) removes the divergence instead of teaching a
               second renderer to recurse: groups render as Collapsibles, and
               every entry passes the same item-level `visible` /
               `requiredPermissions` / runtime-capability guards. The component
               takes `basePath` as a prop and reads only `useLocation()` — it
               has no `activeApp` coupling — so nothing had to be loosened to
               reuse it here.

               `basePath=""` is what this arm's `basePath` already computes to
               (`context === 'app' && activeApp ? … : ''`), and every home entry
               is `type: 'url'`, whose href resolution is verbatim — so the two
               surviving top-level links keep byte-identical hrefs.

               Deliberately NOT forwarded from the app arm:
               - `enablePinning` / `enableReorder` — both persist under
                 `useNavOrder(activeApp?.name || 'home')`, and in the home
                 context `activeApp` resolves to the FIRST app rather than to
                 home, so home navigation would adopt that app's saved root
                 order. A pinned section would also land directly above this
                 arm's own "Starred" group. Separate product decisions, not part
                 of unflattening a group.
               - `resolveGroupLabel` / `resolveItemLabel` — keyed on
                 `activeApp.name`, which does not denote this context. Home
                 labels are already resolved through `t()` where the items are
                 constructed. */}
           <NavigationRenderer
             items={homeNavigation}
             basePath=""
             evaluateVisibility={evalVis}
             checkPermission={checkPerm}
             checkCapability={checkCap}
             resolveObjectLabel={(objectName, fallback) => resolveNavObjectLabel({ name: objectName, label: fallback })}
             resolveDashboardLabel={(dashboardName, fallback) => resolveNavDashboardLabel({ name: dashboardName, label: fallback })}
             resolveViewLabel={(objectName, viewName, fallback) => resolveNavViewLabel(objectName, viewName, fallback)}
             onAction={dispatchNavAction}
             t={t}
             templateContext={{ currentUserId: user?.id ?? null, currentOrgId: activeOrganization?.id ?? null, contextValues }}
           />

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
        <LocalizedSidebarTrigger className="w-full justify-start pl-2 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:pl-0" />
      </SidebarFooter>
    </Sidebar>
    {/* Mobile bottom-tab navigation removed — the drawer (☰) already
        surfaces the full navigation tree, so a bottom strip of the
        first 5 leaves was pure duplication and ate ~52px of vertical
        space. Pattern follows Notion / Linear (drawer-only). */}
    </>
  );
}
