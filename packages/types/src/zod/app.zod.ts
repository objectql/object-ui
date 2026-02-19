/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Application Schema Zod Validators
 * 
 * Zod validation schemas for top-level application configuration.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/app
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema } from './base.zod.js';

// ============================================================================
// Unified NavigationItem Schema
// ============================================================================

/**
 * Navigation Item Type enum
 */
export const NavigationItemTypeSchema = z.enum([
  'object', 'dashboard', 'page', 'report', 'url', 'group', 'separator', 'action',
]);

/**
 * Navigation Item Schema — unified model aligned with @objectstack/spec.
 */
export const NavigationItemSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string().describe('Unique identifier'),
  type: NavigationItemTypeSchema.describe('Navigation item type'),
  label: z.string().describe('Display label'),
  icon: z.string().optional().describe('Icon name (Lucide)'),

  // Type-specific target fields
  objectName: z.string().optional().describe('Target object name (type: object)'),
  dashboardName: z.string().optional().describe('Target dashboard name (type: dashboard)'),
  pageName: z.string().optional().describe('Target page name (type: page)'),
  reportName: z.string().optional().describe('Target report name (type: report)'),
  url: z.string().optional().describe('Target URL (type: url)'),
  target: z.enum(['_blank', '_self']).optional().describe('Link target (type: url)'),

  // Grouping
  children: z.array(z.lazy(() => NavigationItemSchema)).optional().describe('Child items (type: group)'),

  // Visibility & Permissions
  visible: z.union([z.boolean(), z.string()]).optional().describe('Visibility expression'),
  requiredPermissions: z.array(z.string()).optional().describe('Required permissions'),

  // UX Enhancements
  badge: z.union([z.string(), z.number()]).optional().describe('Badge text or count'),
  badgeVariant: z.enum(['default', 'destructive', 'outline']).optional().describe('Badge variant'),
  defaultOpen: z.boolean().optional().describe('Group default expanded state'),
  pinned: z.boolean().optional().describe('Pinned item'),
  order: z.number().optional().describe('Sort order weight'),
}));

/**
 * Navigation Area Schema — business-domain partition of navigation.
 */
export const NavigationAreaSchema = z.object({
  id: z.string().describe('Unique identifier'),
  label: z.string().describe('Display label'),
  icon: z.string().optional().describe('Icon name (Lucide)'),
  navigation: z.array(NavigationItemSchema).describe('Navigation items within area'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Visibility expression'),
  requiredPermissions: z.array(z.string()).optional().describe('Required permissions'),
});

// ============================================================================
// Legacy MenuItem Schema (backward compat)
// ============================================================================

/**
 * Menu Item Schema - Navigation menu item
 * @deprecated Use NavigationItemSchema instead.
 */
export const MenuItemSchema: z.ZodType<any> = z.lazy(() => z.object({
  type: z.enum(['item', 'group', 'separator']).optional().describe('Item type'),
  label: z.string().optional().describe('Display label'),
  icon: z.string().optional().describe('Icon name (Lucide)'),
  path: z.string().optional().describe('Target path (route)'),
  href: z.string().optional().describe('External link'),
  children: z.array(MenuItemSchema).optional().describe('Child items (submenu)'),
  badge: z.union([z.string(), z.number()]).optional().describe('Badge or count'),
  hidden: z.union([z.boolean(), z.string()]).optional().describe('Visibility condition'),
}));

// ============================================================================
// App Action Schema
// ============================================================================

/**
 * App Action Schema - Application header/toolbar action
 */
export const AppActionSchema = z.object({
  type: z.enum(['button', 'dropdown', 'user']).describe('Action type'),
  label: z.string().optional().describe('Action label'),
  icon: z.string().optional().describe('Icon name'),
  onClick: z.string().optional().describe('Click handler expression'),
  avatar: z.string().optional().describe('User avatar URL (for type="user")'),
  description: z.string().optional().describe('Additional description (e.g., email for user)'),
  items: z.array(MenuItemSchema).optional().describe('Dropdown menu items (for type="dropdown" or "user")'),
  shortcut: z.string().optional().describe('Keyboard shortcut'),
  variant: z.enum(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']).optional().describe('Button variant'),
  size: z.enum(['default', 'sm', 'lg', 'icon']).optional().describe('Button size'),
});

// ============================================================================
// App Schema
// ============================================================================

/**
 * App Schema - Top-level application configuration
 */
export const AppSchema = BaseSchema.extend({
  type: z.literal('app'),
  name: z.string().optional().describe('Application name (system ID)'),
  title: z.string().optional().describe('Display title'),
  description: z.string().optional().describe('Application description'),
  logo: z.string().optional().describe('Logo URL or icon name'),
  favicon: z.string().optional().describe('Favicon URL'),
  layout: z.enum(['sidebar', 'header', 'empty']).optional().default('sidebar').describe('Global layout strategy'),
  menu: z.array(MenuItemSchema).optional().describe('Legacy navigation menu (deprecated, use navigation)'),
  navigation: z.array(NavigationItemSchema).optional().describe('Unified navigation tree'),
  areas: z.array(NavigationAreaSchema).optional().describe('Navigation areas (business-domain partitions)'),
  actions: z.array(AppActionSchema).optional().describe('Global actions (user profile, settings, etc.)'),
});

/**
 * Export type inference helpers
 */
export type NavigationItemSchemaType = z.infer<typeof NavigationItemSchema>;
export type NavigationAreaSchemaType = z.infer<typeof NavigationAreaSchema>;
export type MenuItemSchemaType = z.infer<typeof MenuItemSchema>;
export type AppActionSchemaType = z.infer<typeof AppActionSchema>;
export type AppSchemaType = z.infer<typeof AppSchema>;
