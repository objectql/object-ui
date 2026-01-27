import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Package, 
  FileText 
} from 'lucide-react';
import { SidebarNav as SidebarNavLayout, NavItem } from '@object-ui/layout';

export const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Contacts",
    href: "/contacts",
    icon: Users,
  },
  {
    title: "Opportunities",
    href: "/opportunities",
    icon: FileText,
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function SidebarNav({ items = mainNavItems }: { items?: NavItem[] }) {
  return (
    <SidebarNavLayout items={items} />
  );
}


