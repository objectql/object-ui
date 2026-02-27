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
import { useNavigate, Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
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
} from 'lucide-react';
import { NavigationRenderer } from '@object-ui/layout';
import type { NavigationItem } from '@object-ui/types';
import { useMetadata } from '../context/MetadataProvider';
import { useExpressionContext, evaluateVisibility } from '../context/ExpressionProvider';
import { useAuth, getUserInitials } from '@object-ui/auth';
import { usePermissions } from '@object-ui/permissions';
import { useRecentItems } from '../hooks/useRecentItems';
import { useFavorites } from '../hooks/useFavorites';
import { useNavPins } from '../hooks/useNavPins';
import { resolveI18nLabel } from '../utils';
import { useObjectTranslation } from '@object-ui/i18n';

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
 * Supports camelCase, PascalCase, and kebab-case icon names.
 */
function getIcon(name?: string): React.ComponentType<any> {
  if (!name) return LucideIcons.Database;

  // 1. Direct match (PascalCase or camelCase)
  if ((LucideIcons as any)[name]) {
    return (LucideIcons as any)[name];
  }

  // 2. Try converting kebab-case to PascalCase (e.g. "shopping-cart" -> "ShoppingCart")
  const pascalName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
    
  if ((LucideIcons as any)[pascalName]) {
      return (LucideIcons as any)[pascalName];
  }

  // 3. Fallback
  return LucideIcons.Database;
}

export function AppSidebar({ activeAppName, onAppChange }: { activeAppName: string, onAppChange: (name: string) => void }) {
  const { isMobile } = useSidebar();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useObjectTranslation();

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
  
  const { apps: metadataApps } = useMetadata();
  const apps = metadataApps || [];
  // Filter out inactive apps
  const activeApps = apps.filter((a: any) => a.active !== false);
  const activeApp = activeApps.find((a: any) => a.name === activeAppName) || activeApps[0];

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

  const basePath = activeApp ? `/apps/${activeAppName}` : '';

  // Fallback system navigation when no active app exists
  const systemFallbackNavigation: NavigationItem[] = React.useMemo(() => [
    { id: 'sys-settings', label: 'System Settings', type: 'url' as const, url: '/system', icon: 'settings' },
    { id: 'sys-apps', label: 'Applications', type: 'url' as const, url: '/system/apps', icon: 'layout-grid' },
    { id: 'sys-users', label: 'Users', type: 'url' as const, url: '/system/users', icon: 'users' },
    { id: 'sys-orgs', label: 'Organizations', type: 'url' as const, url: '/system/organizations', icon: 'building-2' },
    { id: 'sys-roles', label: 'Roles', type: 'url' as const, url: '/system/roles', icon: 'shield' },
    { id: 'sys-create-app', label: 'Create App', type: 'url' as const, url: '/create-app', icon: 'plus' },
  ], []);

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
                      {resolveI18nLabel(activeApp.description, t) || `${activeApps.length} Apps Available`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch Application
                </DropdownMenuLabel>
                {activeApps.map((app: any) => (
                  <DropdownMenuItem
                    key={app.name}
                    onClick={() => onAppChange(app.name)}
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
                <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate(`/apps/${activeAppName}/create-app`)} data-testid="add-app-btn">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Add App</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate(`/apps/${activeAppName}/edit-app/${activeAppName}`)} data-testid="edit-app-btn">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Pencil className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Edit App</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 p-2" onClick={() => navigate(`/apps/${activeAppName}/system/apps`)} data-testid="manage-all-apps-btn">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Settings className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Manage All Apps</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            ) : (
            /* No-app fallback header */
            <SidebarMenuButton
              size="lg"
              onClick={() => navigate('/system')}
              data-testid="system-sidebar-header"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Settings className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">System Console</span>
                <span className="truncate text-xs text-muted-foreground">No apps configured</span>
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
                 <LucideIcons.Layers className="h-3.5 w-3.5" />
                 Area
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

           {/* Navigation Search */}
           <SidebarGroup className="py-0">
             <SidebarGroupContent className="relative">
               <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
               <SidebarInput
                 placeholder="Search navigation..."
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
             searchQuery={navSearchQuery}
             enablePinning
             onPinToggle={togglePin}
             enableReorder
             onReorder={handleReorder}
           />

           {/* Record Favorites */}
           {favorites.length > 0 && (
             <SidebarGroup>
               <SidebarGroupLabel className="flex items-center gap-1.5">
                 <Star className="h-3.5 w-3.5" />
                 Favorites
               </SidebarGroupLabel>
               <SidebarGroupContent>
                 <SidebarMenu>
                   {favorites.slice(0, 8).map(item => (
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
                         aria-label={`Remove ${item.label} from favorites`}
                       >
                         <StarOff className="h-3 w-3" />
                       </SidebarMenuAction>
                     </SidebarMenuItem>
                   ))}
                 </SidebarMenu>
               </SidebarGroupContent>
             </SidebarGroup>
           )}

           {/* Recent Items (default collapsed) */}
           {recentItems.length > 0 && (
             <SidebarGroup>
               <SidebarGroupLabel
                 className="flex items-center gap-1.5 cursor-pointer select-none"
                 onClick={() => setRecentExpanded(prev => !prev)}
               >
                 <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${recentExpanded ? 'rotate-90' : ''}`} />
                 <Clock className="h-3.5 w-3.5" />
                 Recent
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
           </>
         ) : (
           /* Fallback system navigation when no apps are configured */
           <SidebarGroup data-testid="system-fallback-nav">
             <SidebarGroupLabel className="flex items-center gap-1.5">
               <Settings className="h-3.5 w-3.5" />
               System
             </SidebarGroupLabel>
             <SidebarGroupContent>
               <SidebarMenu>
                 {systemFallbackNavigation.map((item) => {
                   const NavIcon = getIcon(item.icon);
                   return (
                     <SidebarMenuItem key={item.id}>
                       <SidebarMenuButton asChild tooltip={item.label as string}>
                         <Link to={(item as any).url || '/system'}>
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
                    <AvatarImage src={user?.image ?? '/avatars/user.jpg'} alt={user?.name ?? 'User'} />
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
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.image ?? '/avatars/user.jpg'} alt={user?.name ?? 'User'} />
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
                    onClick={() => navigate(activeApp ? `/apps/${activeAppName}/system` : '/system')}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    {isMobile && (
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background/95 backdrop-blur-sm px-2 py-1 sm:hidden safe-area-bottom">
        {(activeApp ? resolvedNavigation : systemFallbackNavigation).filter((n: any) => n.type !== 'group').slice(0, 5).map((item: any) => {
          const NavIcon = getIcon(item.icon);
          const baseUrl = activeApp ? `/apps/${activeAppName}` : '';
          let href = item.url || '#';
          if (item.type === 'object') {
            href = `${baseUrl}/${item.objectName}`;
            if (item.viewName) href += `/view/${item.viewName}`;
          }
          else if (item.type === 'dashboard') href = item.dashboardName ? `${baseUrl}/dashboard/${item.dashboardName}` : '#';
          else if (item.type === 'page') href = item.pageName ? `${baseUrl}/page/${item.pageName}` : '#';
          return (
            <Link key={item.id} to={href} className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] justify-center">
              <NavIcon className="h-5 w-5" />
              <span className="text-[10px] truncate max-w-[60px]">{resolveI18nLabel(item.label, t)}</span>
            </Link>
          );
        })}
      </div>
    )}
    </>
  );
}
