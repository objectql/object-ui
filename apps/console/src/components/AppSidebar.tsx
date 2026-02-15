/**
 * AppSidebar
 *
 * Collapsible sidebar navigation for the console. Displays the active app's
 * objects, dashboards, pages, and reports as grouped menu items, with an
 * app-switcher dropdown and user profile footer.
 * @module
 */

import * as React from 'react';
import { useLocation, Link } from 'react-router-dom';
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
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@object-ui/components';
import {
  ChevronsUpDown, 
  Plus, 
  Settings, 
  LogOut, 
  Database,
  ChevronRight,
  Clock,
  Star,
  StarOff,
} from 'lucide-react';
import { useMetadata } from '../context/MetadataProvider';
import { useExpressionContext, evaluateVisibility } from '../context/ExpressionProvider';
import { useAuth, getUserInitials } from '@object-ui/auth';
import { usePermissions } from '@object-ui/permissions';
import { useRecentItems } from '../hooks/useRecentItems';
import { useFavorites } from '../hooks/useFavorites';
import { resolveI18nLabel } from '../utils';

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

  /** Apply saved order to a flat list of items sharing the same parent group. */
  const applyOrder = React.useCallback(
    (groupKey: string, items: any[]): any[] => {
      const saved = orderMap[groupKey];
      if (!saved) return items;
      const byId = new Map(items.map(i => [i.id, i]));
      const ordered: any[] = [];
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

  /** Persist a new ordering for a group. */
  const saveOrder = React.useCallback(
    (groupKey: string, ids: string[]) => {
      persist({ ...orderMap, [groupKey]: ids });
    },
    [orderMap, persist],
  );

  return { applyOrder, saveOrder };
}

/** Shared drag state so we avoid prop-drilling. */
const DndContext = React.createContext<{
  dragItemId: string | null;
  dragGroupKey: string | null;
  dropTargetId: string | null;
  onDragStart: (groupKey: string, itemId: string) => void;
  onDragOver: (e: React.DragEvent, itemId: string) => void;
  onDrop: (e: React.DragEvent, groupKey: string, items: any[]) => void;
  onDragEnd: () => void;
} | null>(null);

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

  // Drag-and-drop reorder state
  const { applyOrder, saveOrder } = useNavOrder(activeAppName);
  const [dragItemId, setDragItemId] = React.useState<string | null>(null);
  const [dragGroupKey, setDragGroupKey] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);

  const dndValue = React.useMemo(() => ({
    dragItemId,
    dragGroupKey,
    dropTargetId,
    onDragStart: (groupKey: string, itemId: string) => {
      setDragGroupKey(groupKey);
      setDragItemId(itemId);
    },
    onDragOver: (e: React.DragEvent, itemId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetId(itemId);
    },
    onDrop: (e: React.DragEvent, groupKey: string, items: any[]) => {
      e.preventDefault();
      if (!dragItemId || groupKey !== dragGroupKey) return;
      const ids = items.map((i: any) => i.id);
      const fromIdx = ids.indexOf(dragItemId);
      const toIdx = ids.indexOf(dropTargetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const reordered = [...ids];
      reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, dragItemId);
      saveOrder(groupKey, reordered);
    },
    onDragEnd: () => {
      setDragItemId(null);
      setDragGroupKey(null);
      setDropTargetId(null);
    },
  }), [dragItemId, dragGroupKey, dropTargetId, saveOrder]);

  return (
    <DndContext.Provider value={dndValue}>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
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
                     {/* App Logo - use branding logo if available */}
                     {logo ? (
                       <img src={logo} alt={resolveI18nLabel(activeApp.label)} className="size-6 object-contain" />
                     ) : (
                       React.createElement(getIcon(activeApp.icon), { className: "size-4" })
                     )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{resolveI18nLabel(activeApp.label)}</span>
                    <span className="truncate text-xs">
                      {resolveI18nLabel(activeApp.description) || `${activeApps.length} Apps Available`}
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
                    {app.label}
                    {activeApp.name === app.name && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Add App</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
         <NavigationTree items={activeApp.navigation || []} activeAppName={activeAppName} applyOrder={applyOrder} />

         {/* Favorites */}
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
                       onClick={(e) => { e.stopPropagation(); removeFavorite(item.id); }}
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

         {/* Recent Items */}
         {recentItems.length > 0 && (
           <SidebarGroup>
             <SidebarGroupLabel className="flex items-center gap-1.5">
               <Clock className="h-3.5 w-3.5" />
               Recent
             </SidebarGroupLabel>
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
                  <DropdownMenuItem>
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
        {(activeApp.navigation || []).filter((n: any) => n.type !== 'group').slice(0, 5).map((item: any) => {
          const NavIcon = getIcon(item.icon);
          const baseUrl = `/apps/${activeAppName}`;
          let href = '#';
          if (item.type === 'object') href = `${baseUrl}/${item.objectName}`;
          else if (item.type === 'dashboard') href = item.dashboardName ? `${baseUrl}/dashboard/${item.dashboardName}` : '#';
          else if (item.type === 'page') href = item.pageName ? `${baseUrl}/page/${item.pageName}` : '#';
          return (
            <Link key={item.id} to={href} className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] justify-center">
              <NavIcon className="h-5 w-5" />
              <span className="text-[10px] truncate max-w-[60px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    )}
    </DndContext.Provider>
  );
}

function NavigationTree({ items, activeAppName, applyOrder }: { items: any[], activeAppName: string, applyOrder: (groupKey: string, items: any[]) => any[] }) {
    const hasGroups = items.some(i => i.type === 'group');

    // If no explicit groups, wrap everything in one default group
    if (!hasGroups) {
        const groupKey = '__root__';
        const ordered = applyOrder(groupKey, items);
        return (
            <SidebarGroup>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {ordered.map(item => <NavigationItemRenderer key={item.id} item={item} activeAppName={activeAppName} groupKey={groupKey} groupItems={ordered} applyOrder={applyOrder} />)}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        );
    }

    // If there are groups, we need to handle mixed content
    // We group consecutive non-group items into an implicit SidebarGroup
    const renderedItems: React.ReactNode[] = [];
    let currentBuffer: any[] = [];
    
    // Helper to flush buffer
    const flushBuffer = (keyPrefix: string) => {
        if (currentBuffer.length === 0) return;
        const groupKey = keyPrefix;
        const ordered = applyOrder(groupKey, currentBuffer);
        renderedItems.push(
            <SidebarGroup key={`${keyPrefix}-group`}>
                <SidebarGroupContent>
                     <SidebarMenu>
                        {ordered.map(item => (
                            <NavigationItemRenderer key={item.id} item={item} activeAppName={activeAppName} groupKey={groupKey} groupItems={ordered} applyOrder={applyOrder} />
                        ))}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        );
        currentBuffer = [];
    };

    items.forEach((item, index) => {
        if (item.type === 'group') {
            flushBuffer(`auto-${index}`);
            renderedItems.push(<NavigationItemRenderer key={item.id} item={item} activeAppName={activeAppName} groupKey={item.id} groupItems={[]} applyOrder={applyOrder} />);
        } else {
            currentBuffer.push(item);
        }
    });
    
    flushBuffer('auto-end');

    return <>{renderedItems}</>;
}

function NavigationItemRenderer({ item, activeAppName, groupKey, groupItems, applyOrder }: { item: any, activeAppName: string, groupKey: string, groupItems: any[], applyOrder: (groupKey: string, items: any[]) => any[] }) {
    const Icon = getIcon(item.icon);
    const location = useLocation();
    const [isOpen, setIsOpen] = React.useState(item.expanded !== false);
    const { evaluator } = useExpressionContext();
    const dnd = React.useContext(DndContext);
    const { can } = usePermissions();

    // Evaluate visibility expression (supports boolean, string, and ${} template expressions)
    const isVisible = evaluateVisibility(item.visible ?? item.visibleOn, evaluator);
    if (!isVisible) {
        return null;
    }

    // Permission check: skip items that require permissions the user doesn't have
    if (item.requiredPermissions?.length) {
        const hasPermission = item.requiredPermissions.every((perm: string) => {
            const parts = perm.split(':');
            const [object, action] = parts.length >= 2
                ? [parts[0], parts[1]]
                : [item.objectName || perm, 'read'];
            return can(object, action as any);
        });
        if (!hasPermission) return null;
    }

    if (item.type === 'group') {
        const children: any[] = item.children ?? [];
        const orderedChildren = applyOrder(groupKey, children);
        return (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <SidebarGroup>
                    <SidebarGroupLabel asChild>
                        <CollapsibleTrigger className="flex w-full items-center justify-between">
                            {item.label}
                            <ChevronRight className={`ml-auto transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {orderedChildren.map((child: any) => (
                                    <NavigationItemRenderer key={child.id} item={child} activeAppName={activeAppName} groupKey={groupKey} groupItems={orderedChildren} applyOrder={applyOrder} />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </CollapsibleContent>
                </SidebarGroup>
            </Collapsible>
        );
    }

    // Determine href based on navigation item type
    let href = '#';
    let isExternal = false;
    const baseUrl = `/apps/${activeAppName}`;
    
    if (item.type === 'object') {
        href = `${baseUrl}/${item.objectName}`;
        // Add view parameter if specified
        if (item.viewName) {
            href += `/view/${item.viewName}`;
        }
    } else if (item.type === 'page') {
        href = item.pageName ? `${baseUrl}/page/${item.pageName}` : '#';
        // Add URL parameters if specified
        if (item.params) {
            const params = new URLSearchParams(item.params);
            href += `?${params.toString()}`;
        }
    } else if (item.type === 'dashboard') {
        href = item.dashboardName ? `${baseUrl}/dashboard/${item.dashboardName}` : '#';
    } else if (item.type === 'report') {
        href = item.reportName ? `${baseUrl}/report/${item.reportName}` : '#';
    } else if (item.type === 'url') {
        href = item.url || '#';
        isExternal = item.target === '_blank';
    }

    const isActive = location.pathname.startsWith(href) && href !== '#';
    const isDragOver = dnd?.dropTargetId === item.id && dnd?.dragItemId !== item.id && dnd?.dragGroupKey === groupKey;

    return (
        <SidebarMenuItem
            draggable
            onDragStart={(e: React.DragEvent) => {
                e.dataTransfer.effectAllowed = 'move';
                dnd?.onDragStart(groupKey, item.id);
            }}
            onDragOver={(e: React.DragEvent) => dnd?.onDragOver(e, item.id)}
            onDrop={(e: React.DragEvent) => dnd?.onDrop(e, groupKey, groupItems)}
            onDragEnd={() => dnd?.onDragEnd()}
            className={isDragOver ? 'border-t-2 border-primary' : ''}
        >
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                {isExternal ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                    </a>
                ) : (
                    <Link to={href} className="py-2.5 sm:py-2">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                    </Link>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
