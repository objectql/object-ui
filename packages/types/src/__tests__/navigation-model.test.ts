/**
 * Tests for Unified Navigation Model
 * 
 * Validates NavigationItem, NavigationArea types, Zod schemas,
 * and the MenuItem → NavigationItem transform.
 */
import { describe, it, expect } from 'vitest';
import {
  AppSchema,
  NavigationItemSchema,
  NavigationAreaSchema,
} from '../zod/index.zod';
import { menuItemToNavigationItem } from '../app';
import type { MenuItem, NavigationItem, NavigationArea } from '../app';

// ============================================================================
// NavigationItem Zod Schema
// ============================================================================

describe('NavigationItem Zod Schema', () => {
  it('should validate an object navigation item', () => {
    const item = {
      id: 'nav_contacts',
      type: 'object',
      label: 'Contacts',
      icon: 'Users',
      objectName: 'contact',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate a dashboard navigation item', () => {
    const item = {
      id: 'nav_dash',
      type: 'dashboard',
      label: 'Overview',
      icon: 'BarChart3',
      dashboardName: 'sales_overview',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate a page navigation item', () => {
    const item = {
      id: 'nav_settings',
      type: 'page',
      label: 'Settings',
      pageName: 'app_settings',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate a report navigation item', () => {
    const item = {
      id: 'nav_report',
      type: 'report',
      label: 'Sales Report',
      reportName: 'monthly_sales',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate a url navigation item', () => {
    const item = {
      id: 'nav_docs',
      type: 'url',
      label: 'Documentation',
      url: 'https://docs.example.com',
      target: '_blank',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate a group navigation item with children', () => {
    const item = {
      id: 'nav_sales_group',
      type: 'group',
      label: 'Sales',
      icon: 'DollarSign',
      defaultOpen: true,
      children: [
        { id: 'nav_leads', type: 'object', label: 'Leads', objectName: 'lead' },
        { id: 'nav_opps', type: 'object', label: 'Opportunities', objectName: 'opportunity' },
      ],
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate a separator navigation item', () => {
    const item = {
      id: 'sep_1',
      type: 'separator',
      label: '',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate UX enhancement fields', () => {
    const item = {
      id: 'nav_tasks',
      type: 'object',
      label: 'Tasks',
      objectName: 'task',
      badge: 5,
      badgeVariant: 'destructive',
      pinned: true,
      order: 10,
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate visibility and permission fields', () => {
    const item = {
      id: 'nav_admin',
      type: 'page',
      label: 'Admin Panel',
      pageName: 'admin',
      visible: "${user.role === 'admin'}",
      requiredPermissions: ['admin:read'],
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should reject invalid type', () => {
    const item = {
      id: 'nav_bad',
      type: 'invalid_type',
      label: 'Bad',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('should reject missing required id', () => {
    const item = {
      type: 'object',
      label: 'No ID',
      objectName: 'contact',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('should reject missing required label', () => {
    const item = {
      id: 'nav_no_label',
      type: 'object',
      objectName: 'contact',
    };
    const result = NavigationItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// NavigationArea Zod Schema
// ============================================================================

describe('NavigationArea Zod Schema', () => {
  it('should validate a complete area', () => {
    const area = {
      id: 'sales',
      label: 'Sales',
      icon: 'DollarSign',
      navigation: [
        { id: 'nav_leads', type: 'object', label: 'Leads', objectName: 'lead' },
        { id: 'nav_opps', type: 'object', label: 'Opportunities', objectName: 'opportunity' },
      ],
    };
    const result = NavigationAreaSchema.safeParse(area);
    expect(result.success).toBe(true);
  });

  it('should validate area with visibility and permissions', () => {
    const area = {
      id: 'admin_area',
      label: 'Administration',
      navigation: [
        { id: 'nav_users', type: 'object', label: 'Users', objectName: 'user' },
      ],
      visible: "${user.isAdmin}",
      requiredPermissions: ['admin:access'],
    };
    const result = NavigationAreaSchema.safeParse(area);
    expect(result.success).toBe(true);
  });

  it('should reject area without navigation', () => {
    const area = {
      id: 'empty_area',
      label: 'Empty',
    };
    const result = NavigationAreaSchema.safeParse(area);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// AppSchema with navigation and areas
// ============================================================================

describe('AppSchema with unified navigation', () => {
  it('should validate AppSchema with navigation field', () => {
    const app = {
      type: 'app',
      name: 'crm',
      title: 'CRM App',
      layout: 'sidebar',
      navigation: [
        { id: 'nav_dash', type: 'dashboard', label: 'Dashboard', dashboardName: 'overview' },
        { id: 'nav_contacts', type: 'object', label: 'Contacts', objectName: 'contact' },
      ],
    };
    const result = AppSchema.safeParse(app);
    expect(result.success).toBe(true);
  });

  it('should validate AppSchema with areas', () => {
    const app = {
      type: 'app',
      name: 'enterprise_crm',
      title: 'Enterprise CRM',
      layout: 'sidebar',
      areas: [
        {
          id: 'sales',
          label: 'Sales',
          icon: 'DollarSign',
          navigation: [
            { id: 'nav_leads', type: 'object', label: 'Leads', objectName: 'lead' },
          ],
        },
        {
          id: 'service',
          label: 'Service',
          icon: 'Headphones',
          navigation: [
            { id: 'nav_cases', type: 'object', label: 'Cases', objectName: 'case' },
          ],
        },
      ],
    };
    const result = AppSchema.safeParse(app);
    expect(result.success).toBe(true);
  });

  it('should validate AppSchema with both legacy menu and new navigation', () => {
    const app = {
      type: 'app',
      name: 'migration_app',
      menu: [
        { type: 'item', label: 'Home', path: '/home' },
      ],
      navigation: [
        { id: 'nav_home', type: 'page', label: 'Home', pageName: 'home' },
      ],
    };
    const result = AppSchema.safeParse(app);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// MenuItem → NavigationItem Transform
// ============================================================================

describe('menuItemToNavigationItem', () => {
  it('should convert a simple path-based item', () => {
    const menuItem: MenuItem = {
      type: 'item',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      path: '/dashboard',
    };

    const result = menuItemToNavigationItem(menuItem, 0);
    expect(result.type).toBe('page');
    expect(result.label).toBe('Dashboard');
    expect(result.icon).toBe('LayoutDashboard');
    expect(result.pageName).toBe('/dashboard');
    expect(result.id).toBe('migrated_0');
  });

  it('should convert an external link item', () => {
    const menuItem: MenuItem = {
      type: 'item',
      label: 'Docs',
      href: 'https://docs.example.com',
    };

    const result = menuItemToNavigationItem(menuItem, 1);
    expect(result.type).toBe('url');
    expect(result.url).toBe('https://docs.example.com');
    expect(result.target).toBe('_blank');
  });

  it('should convert a group with children', () => {
    const menuItem: MenuItem = {
      type: 'group',
      label: 'Sales',
      children: [
        { type: 'item', label: 'Leads', path: '/leads' },
        { type: 'item', label: 'Opportunities', path: '/opportunities' },
      ],
    };

    const result = menuItemToNavigationItem(menuItem, 2);
    expect(result.type).toBe('group');
    expect(result.label).toBe('Sales');
    expect(result.children).toHaveLength(2);
    expect(result.children![0].type).toBe('page');
    expect(result.children![0].pageName).toBe('/leads');
    expect(result.defaultOpen).toBe(true);
  });

  it('should convert a separator', () => {
    const menuItem: MenuItem = { type: 'separator' };

    const result = menuItemToNavigationItem(menuItem, 3);
    expect(result.type).toBe('separator');
    expect(result.label).toBe('');
  });

  it('should invert hidden to visible', () => {
    const menuItem: MenuItem = {
      type: 'item',
      label: 'Admin',
      path: '/admin',
      hidden: true,
    };

    const result = menuItemToNavigationItem(menuItem, 4);
    expect(result.visible).toBe(false);
  });

  it('should preserve badge', () => {
    const menuItem: MenuItem = {
      type: 'item',
      label: 'Notifications',
      path: '/notifications',
      badge: 42,
    };

    const result = menuItemToNavigationItem(menuItem, 5);
    expect(result.badge).toBe(42);
  });

  it('should handle item without explicit type', () => {
    const menuItem: MenuItem = {
      label: 'About',
      path: '/about',
    };

    const result = menuItemToNavigationItem(menuItem, 6);
    expect(result.type).toBe('page');
    expect(result.label).toBe('About');
  });
});

// ============================================================================
// Type-level sanity checks (compile-time assertions at runtime)
// ============================================================================

describe('Type exports', () => {
  it('should export NavigationItem type fields', () => {
    const item: NavigationItem = {
      id: 'test',
      type: 'object',
      label: 'Test',
      objectName: 'test_object',
      icon: 'Database',
      visible: true,
      requiredPermissions: ['test:read'],
      badge: 3,
      badgeVariant: 'default',
      pinned: false,
      order: 1,
    };
    expect(item.id).toBe('test');
    expect(item.type).toBe('object');
  });

  it('should export NavigationArea type fields', () => {
    const area: NavigationArea = {
      id: 'sales',
      label: 'Sales',
      icon: 'DollarSign',
      navigation: [
        { id: 'nav_leads', type: 'object', label: 'Leads', objectName: 'lead' },
      ],
      visible: true,
      requiredPermissions: ['sales:access'],
    };
    expect(area.id).toBe('sales');
    expect(area.navigation).toHaveLength(1);
  });
});
