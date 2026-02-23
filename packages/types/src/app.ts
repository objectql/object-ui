/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Application Schema
 * 
 * Defines the metadata structure for a complete application, including
 * global layout, navigation menus, and routing configuration.
 * 
 * ## Navigation Model
 * 
 * ObjectUI uses a unified `NavigationItem` model aligned with @objectstack/spec.
 * The legacy `MenuItem` type is retained for backward compatibility but new
 * configurations should use `NavigationItem` and the `navigation` / `areas` fields.
 */

import type { BaseSchema } from './base';

// ============================================================================
// Unified Navigation Model (aligned with @objectstack/spec)
// ============================================================================

/**
 * Navigation item type — determines the target and required fields.
 */
export type NavigationItemType =
  | 'object'
  | 'dashboard'
  | 'page'
  | 'report'
  | 'url'
  | 'group'
  | 'separator'
  | 'action';

/**
 * Unified Navigation Item
 * 
 * The single navigation primitive used across ObjectUI and @objectstack/spec.
 * Replaces the legacy `MenuItem` for application navigation trees.
 * 
 * Supports typed navigation targets (object, dashboard, page, report, url),
 * nested groups, visibility expressions, RBAC permissions, and UX enhancements
 * like badges, pinning, and sort ordering.
 */
export interface NavigationItem {
  /** Unique identifier */
  id: string;

  /** Navigation item type */
  type: NavigationItemType;

  /** Display label */
  label: string;

  /** Icon name (Lucide) */
  icon?: string;

  // -- Type-specific target fields --

  /** Target object name (for type: 'object') */
  objectName?: string;

  /** Target dashboard name (for type: 'dashboard') */
  dashboardName?: string;

  /** Target page name (for type: 'page') */
  pageName?: string;

  /** Target report name (for type: 'report') */
  reportName?: string;

  /** Target URL (for type: 'url') */
  url?: string;

  /** Link target (for type: 'url') */
  target?: '_blank' | '_self';

  // -- Grouping --

  /** Child navigation items (for type: 'group') */
  children?: NavigationItem[];

  // -- Visibility & Permissions --

  /** Visibility expression — boolean or expression string e.g. "${user.role === 'admin'}" */
  visible?: boolean | string;

  /** Required permissions to see/access this item */
  requiredPermissions?: string[];

  // -- UX Enhancements --

  /** Badge text or count */
  badge?: string | number;

  /** Badge visual variant */
  badgeVariant?: 'default' | 'destructive' | 'outline';

  /** Whether group is expanded by default (for type: 'group') */
  defaultOpen?: boolean;

  /** Whether this item is pinned */
  pinned?: boolean;

  /** Sort order weight (lower = higher) */
  order?: number;
}

/**
 * Navigation Area — a business-domain partition of navigation items.
 * 
 * Inspired by Salesforce Lightning App → Area → Tab model and
 * Microsoft Power Apps Area → Group → Subarea pattern.
 * 
 * Each area contains an independent navigation tree, allowing large
 * enterprise applications to organise navigation by domain (e.g.
 * Sales, Service, Marketing).
 */
export interface NavigationArea {
  /** Unique identifier */
  id: string;

  /** Display label */
  label: string;

  /** Icon name (Lucide) */
  icon?: string;

  /** Navigation items within this area */
  navigation: NavigationItem[];

  /** Visibility expression */
  visible?: boolean | string;

  /** Required permissions to see this area */
  requiredPermissions?: string[];
}

// ============================================================================
// Application Schema
// ============================================================================

/**
 * Top-level Application Configuration (app.json)
 */
export interface AppSchema extends BaseSchema {
  type: 'app';
  
  /**
   * Application Name (System ID)
   */
  name?: string;

  /**
   * Display Title
   */
  title?: string;

  /**
   * Application Description
   */
  description?: string;

  /**
   * Logo URL or Icon name
   */
  logo?: string;

  /**
   * Favicon URL
   */
  favicon?: string;

  /**
   * Global Layout Strategy
   * - sidebar: Standard admin layout with left sidebar
   * - header: Top navigation bar only
   * - empty: No layout, pages are responsible for their own structure
   * @default "sidebar"
   */
  layout?: 'sidebar' | 'header' | 'empty';

  /**
   * Global Navigation Menu
   * @deprecated Use `navigation` instead. Retained for backward compatibility.
   */
  menu?: MenuItem[];

  /**
   * Unified navigation tree (aligned with @objectstack/spec NavigationItem model).
   * Takes precedence over `menu` when both are present.
   */
  navigation?: NavigationItem[];

  /**
   * Navigation areas / business-domain partitions.
   * When provided, the sidebar displays an area switcher and renders
   * the selected area's navigation tree.
   */
  areas?: NavigationArea[];

  /**
   * Global Actions (User Profile, Settings, etc)
   */
  actions?: AppAction[];

  /**
   * Home page ID (ObjectStack Spec v2.0.1)
   * Default page to navigate to after login
   */
  homePageId?: string;

  /**
   * Required permissions (ObjectStack Spec v2.0.1)
   * Permissions required to access this application
   */
  requiredPermissions?: string[];
}

// ============================================================================
// Legacy MenuItem (backward compat — prefer NavigationItem)
// ============================================================================

/**
 * Navigation Menu Item
 * @deprecated Use `NavigationItem` instead.
 */
export interface MenuItem {
  /**
   * Item Type
   */
  type?: 'item' | 'group' | 'separator';

  /**
   * Display Label
   */
  label?: string;

  /**
   * Icon Name (Lucide)
   */
  icon?: string;

  /**
   * Target Path (Route)
   */
  path?: string;

  /**
   * External Link
   */
  href?: string;

  /**
   * Child Items (Submenu)
   */
  children?: MenuItem[];

  /**
   * Badge / Count
   */
  badge?: string | number;

  /**
   * Visibility Condition
   */
  hidden?: boolean | string;
}

// ============================================================================
// MenuItem → NavigationItem Transform
// ============================================================================

/**
 * Convert a legacy `MenuItem` to a `NavigationItem`.
 * 
 * Mapping rules:
 * - `type: 'item'` → inferred from `href` (url) or `path` (page)
 * - `type: 'group'` → `type: 'group'`
 * - `type: 'separator'` → `type: 'separator'`
 * - `hidden` → `visible` (inverted)
 * - `path` → `pageName` (last segment) or kept as-is for url
 * - `href` → `url` with `target: '_blank'`
 */
export function menuItemToNavigationItem(
  item: MenuItem,
  index: number = 0,
): NavigationItem {
  const id = `migrated_${index}`;

  if (item.type === 'separator') {
    return {
      id,
      type: 'separator',
      label: item.label || '',
    };
  }

  if (item.type === 'group') {
    return {
      id,
      type: 'group',
      label: item.label || '',
      icon: item.icon,
      children: (item.children || []).map((child, i) =>
        menuItemToNavigationItem(child, index * 100 + i),
      ),
      visible: item.hidden !== undefined ? !item.hidden : undefined,
      badge: item.badge,
      defaultOpen: true,
    };
  }

  // Default: 'item' type — infer target from href / path
  if (item.href) {
    return {
      id,
      type: 'url',
      label: item.label || '',
      icon: item.icon,
      url: item.href,
      target: '_blank',
      visible: item.hidden !== undefined ? !item.hidden : undefined,
      badge: item.badge,
    };
  }

  // Path-based item → treat as page navigation
  return {
    id,
    type: 'page',
    label: item.label || '',
    icon: item.icon,
    pageName: item.path || '',
    visible: item.hidden !== undefined ? !item.hidden : undefined,
    badge: item.badge,
  };
}

// ============================================================================
// App Creation Wizard Types
// ============================================================================

/**
 * Wizard step identifier for app creation flow.
 */
export type AppWizardStepId = 'basic' | 'objects' | 'navigation' | 'branding';

/**
 * App wizard step definition.
 */
export interface AppWizardStep {
  /** Step identifier */
  id: AppWizardStepId;

  /** Display label */
  label: string;

  /** Step description */
  description?: string;

  /** Icon name (Lucide) */
  icon?: string;

  /** Whether the step is optional */
  optional?: boolean;
}

/**
 * Branding configuration for an application.
 */
export interface BrandingConfig {
  /** Logo URL or base64 data URI */
  logo?: string;

  /** Primary brand color (hex) */
  primaryColor?: string;

  /** Favicon URL */
  favicon?: string;

  /** Font family override */
  fontFamily?: string;
}

/**
 * Object selection entry for the wizard.
 */
export interface ObjectSelection {
  /** Object name (snake_case) */
  name: string;

  /** Display label */
  label: string;

  /** Icon name (Lucide) */
  icon?: string;

  /** Whether this object is selected */
  selected: boolean;
}

/**
 * App creation wizard draft state — represents the in-progress
 * application configuration before it is finalized into an AppSchema.
 */
export interface AppWizardDraft {
  /** App name (snake_case, validated) */
  name: string;

  /** Display title */
  title: string;

  /** Description */
  description?: string;

  /** App icon name (Lucide) */
  icon?: string;

  /** Template to start from */
  template?: string;

  /** Layout strategy */
  layout: 'sidebar' | 'header' | 'empty';

  /** Selected business objects */
  objects: ObjectSelection[];

  /** Navigation tree being built */
  navigation: NavigationItem[];

  /** Branding configuration */
  branding: BrandingConfig;
}

/**
 * Editor mode for the app designer.
 */
export type EditorMode = 'edit' | 'preview' | 'code';

/**
 * Validate an app name is snake_case.
 */
export function isValidAppName(name: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name);
}

/**
 * Convert an AppWizardDraft to an AppSchema.
 */
export function wizardDraftToAppSchema(draft: AppWizardDraft): AppSchema {
  return {
    type: 'app',
    name: draft.name,
    title: draft.title,
    description: draft.description,
    logo: draft.branding.logo,
    favicon: draft.branding.favicon,
    layout: draft.layout,
    navigation: draft.navigation,
  };
}

// ============================================================================
// Application Actions
// ============================================================================

/**
 * Application Header/Toolbar Action
 */
export interface AppAction {
  type: 'button' | 'dropdown' | 'user';
  label?: string;
  icon?: string;
  onClick?: string;
  /**
   * User Avatar URL (for type='user')
   */
  avatar?: string;
  /**
   * Additional description (e.g. email for user)
   */
  description?: string;
  /**
   * Dropdown Menu Items (for type='dropdown' or 'user')
   */
  items?: MenuItem[];
  /**
   * Keyboard shortcut
   */
  shortcut?: string;
  /**
   * Button variant
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /**
   * Button size
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}
