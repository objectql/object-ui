import * as React from 'react';
import { useLocation, Link } from 'react-router-dom';
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
} from '@object-ui/components';
import { 
  ChevronsUpDown, 
  Plus, 
  Settings, 
  LogOut, 
  LayoutDashboard,
  Database,
  Users,
  CheckSquare,
  Activity,
  Briefcase,
  FileText
} from 'lucide-react';
import appConfig from '../../objectstack.config';

// Icon Map
const ICONS: Record<string, any> = {
  'dashboard': LayoutDashboard,
  'users': Users,
  'user': Users,
  'check-square': CheckSquare,
  'activity': Activity,
  'briefcase': Briefcase,
  'file-text': FileText,
  'database': Database,
};

function getIcon(name?: string) {
  if (!name) return Database;
  return ICONS[name] || Database;
}

export function AppSidebar({ activeAppName, onAppChange }: { activeAppName: string, onAppChange: (name: string) => void }) {
  const { isMobile } = useSidebar();
  
  const apps = appConfig.apps || [];
  const activeApp = apps.find((a: any) => a.name === activeAppName) || apps[0];

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
                     ) : activeApp.icon ? (
                       React.createElement(getIcon(activeApp.icon), { className: "size-4" })
                     ) : (
                       <Database className="size-4" />
                     )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{activeApp.label}</span>
                    <span className="truncate text-xs">
                      {activeApp.description || `${apps.length} Apps Available`}
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
                {apps.map((app: any) => (
                  <DropdownMenuItem
                    key={app.name}
                    onClick={() => onAppChange(app.name)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border">
                      {app.icon ? React.createElement(getIcon(app.icon), { className: "size-3" }) : <Database className="size-3" />}
                    </div>
                    {app.label}
                    {/* {activeApp.name === app.name && <Check className="ml-auto h-4 w-4" />} */}
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
         <NavigationTree items={activeApp.navigation || []} />
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
                    <AvatarImage src="/avatars/user.jpg" alt="User" />
                    <AvatarFallback className="rounded-lg">ME</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">John Doe</span>
                    <span className="truncate text-xs">admin@example.com</span>
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
                      <AvatarImage src="/avatars/user.jpg" alt="User" />
                      <AvatarFallback className="rounded-lg">ME</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">John Doe</span>
                      <span className="truncate text-xs">admin@example.com</span>
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
                <DropdownMenuItem>
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

function NavigationTree({ items }: { items: any[] }) {
    const hasGroups = items.some(i => i.type === 'group');

    if (hasGroups) {
        return (
            <>
                {items.map(item => <NavigationItemRenderer key={item.id} item={item} />)}
            </>
        );
    }

    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map(item => <NavigationItemRenderer key={item.id} item={item} />)}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function NavigationItemRenderer({ item }: { item: any }) {
    const Icon = getIcon(item.icon);
    const location = useLocation();

    // Handle visibility condition from spec (visible field)
    // In a real implementation, this would evaluate the expression
    // For now, we'll just check if it exists and is not explicitly false
    if (item.visible === 'false' || item.visible === false) {
        return null;
    }

    if (item.type === 'group') {
        return (
            <SidebarGroup>
                <SidebarGroupLabel>{item.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {item.children?.map((child: any) => (
                            <NavigationItemRenderer key={child.id} item={child} />
                        ))}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        );
    }

    // Determine href based on navigation item type
    let href = '#';
    let isExternal = false;
    
    if (item.type === 'object') {
        href = `/${item.objectName}`;
    } else if (item.type === 'page') {
        href = item.pageName ? `/page/${item.pageName}` : '#';
    } else if (item.type === 'dashboard') {
        href = item.dashboardName ? `/dashboard/${item.dashboardName}` : '#';
    } else if (item.type === 'url') {
        href = item.url || '#';
        isExternal = item.target === '_blank';
    }

    const isActive = location.pathname === href; // Simple active check

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                {isExternal ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                    </a>
                ) : (
                    <Link to={href}>
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                    </Link>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
