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
 */

import type { BaseSchema } from './base';

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
   */
  menu?: MenuItem[];

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

/**
 * Navigation Menu Item
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
