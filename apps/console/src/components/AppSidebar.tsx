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
} from 'lucide-react';
import appConfig from '../../objectstack.shared';
import { useExpressionContext, evaluateVisibility } from '../context/ExpressionProvider';
import { useAuth, getUserInitials } from '@object-ui/auth';

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
  
  const apps = appConfig.apps || [];
  // Filter out inactive apps
  const activeApps = apps.filter((a: any) => a.active !== false);
  const activeApp = activeApps.find((a: any) => a.name === activeAppName) || activeApps[0];

  // Extract branding information from spec
  const logo = activeApp?.branding?.logo;
  const primaryColor = activeApp?.branding?.primaryColor;

  return (
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
                       <img src={logo} alt={activeApp.label} className="size-6 object-contain" />
                     ) : (
                       React.createElement(getIcon(activeApp.icon), { className: "size-4" })
                     )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{activeApp.label}</span>
                    <span className="truncate text-xs">
                      {activeApp.description || `${activeApps.length} Apps Available`}
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
         <NavigationTree items={activeApp.navigation || []} activeAppName={activeAppName} />
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
  );
}

function NavigationTree({ items, activeAppName }: { items: any[], activeAppName: string }) {
    const hasGroups = items.some(i => i.type === 'group');

    // If no explicit groups, wrap everything in one default group
    if (!hasGroups) {
        return (
            <SidebarGroup>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {items.map(item => <NavigationItemRenderer key={item.id} item={item} activeAppName={activeAppName} />)}
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
        renderedItems.push(
            <SidebarGroup key={`${keyPrefix}-group`}>
                <SidebarGroupContent>
                     <SidebarMenu>
                        {currentBuffer.map(item => (
                            <NavigationItemRenderer key={item.id} item={item} activeAppName={activeAppName} />
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
            renderedItems.push(<NavigationItemRenderer key={item.id} item={item} activeAppName={activeAppName} />);
        } else {
            currentBuffer.push(item);
        }
    });
    
    flushBuffer('auto-end');

    return <>{renderedItems}</>;
}

function NavigationItemRenderer({ item, activeAppName }: { item: any, activeAppName: string }) {
    const Icon = getIcon(item.icon);
    const location = useLocation();
    const [isOpen, setIsOpen] = React.useState(item.expanded !== false);
    const { evaluator } = useExpressionContext();

    // Evaluate visibility expression (supports boolean, string, and ${} template expressions)
    const isVisible = evaluateVisibility(item.visible ?? item.visibleOn, evaluator);
    if (!isVisible) {
        return null;
    }

    if (item.type === 'group') {
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
                                {item.children?.map((child: any) => (
                                    <NavigationItemRenderer key={child.id} item={child} activeAppName={activeAppName} />
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

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                {isExternal ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                    </a>
                ) : (
                    <Link to={href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                    </Link>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
