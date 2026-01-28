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
} from '@object-ui/components';

export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SidebarNavProps {
    items: NavItem[];
    title?: string;
    className?: string;
    collapsible?: "offcanvas" | "icon" | "none";
}

export function SidebarNav({ items, title = "Application", className, collapsible = "icon" }: SidebarNavProps) {
  const location = useLocation();

  return (
    <Sidebar className={className} collapsible={collapsible}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                    <NavLink to={item.href}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
