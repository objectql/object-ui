import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  Badge,
  Input,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@object-ui/components';
import { ChevronRight, Search } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'outline';
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface SidebarNavProps {
    items: NavItem[] | NavGroup[];
    title?: string;
    className?: string;
    collapsible?: "offcanvas" | "icon" | "none";
    searchEnabled?: boolean;
    searchPlaceholder?: string;
}

function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return 'items' in item && !('href' in item);
}

function NavItemRenderer({ item, pathname }: { item: NavItem; pathname: string }) {
  if (item.children && item.children.length > 0) {
    return (
      <Collapsible asChild defaultOpen className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title}>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              {item.badge != null && (
                <Badge variant={item.badgeVariant || 'default'} className="ml-auto mr-1 h-5 min-w-5 px-1 text-xs">
                  {item.badge}
                </Badge>
              )}
              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child) => (
                <SidebarMenuSubItem key={child.href}>
                  <SidebarMenuSubButton asChild isActive={pathname === child.href}>
                    <NavLink to={child.href}>
                      {child.icon && <child.icon />}
                      <span>{child.title}</span>
                      {child.badge != null && (
                        <Badge variant={child.badgeVariant || 'default'} className="ml-auto h-5 min-w-5 px-1 text-xs">
                          {child.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
        <NavLink to={item.href}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {item.badge != null && (
            <Badge variant={item.badgeVariant || 'default'} className="ml-auto h-5 min-w-5 px-1 text-xs">
              {item.badge}
            </Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function SidebarNav({ items, title = "Application", className, collapsible = "icon", searchEnabled = false, searchPlaceholder = "Search..." }: SidebarNavProps) {
  const location = useLocation();
  const [search, setSearch] = React.useState('');

  const flatItems: Array<{ groupLabel?: string; items: NavItem[] }> = React.useMemo(() => {
    if (items.length === 0) return [];
    if (isNavGroup(items[0])) {
      return (items as NavGroup[]).map(g => ({ groupLabel: g.label, items: g.items }));
    }
    return [{ items: items as NavItem[] }];
  }, [items]);

  const filteredGroups = React.useMemo(() => {
    if (!search) return flatItems;
    const lowerSearch = search.toLowerCase();
    return flatItems.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.title.toLowerCase().includes(lowerSearch) ||
        item.children?.some(child => child.title.toLowerCase().includes(lowerSearch))
      ),
    })).filter(group => group.items.length > 0);
  }, [flatItems, search]);

  return (
    <Sidebar className={className} collapsible={collapsible}>
      <SidebarContent>
        {searchEnabled && (
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        )}
        {filteredGroups.map((group, gIdx) => (
          <SidebarGroup key={group.groupLabel || gIdx}>
            <SidebarGroupLabel>{group.groupLabel || title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItemRenderer key={item.href} item={item} pathname={location.pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
