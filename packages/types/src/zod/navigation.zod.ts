/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Navigation Component Zod Validators
 * 
 * Zod validation schemas for navigation components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/navigation
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * Nav Link Schema
 */
export const NavLinkSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string().describe('Link label'),
    href: z.string().describe('Link URL'),
    icon: z.string().optional().describe('Link icon'),
    active: z.boolean().optional().describe('Whether link is active'),
    disabled: z.boolean().optional().describe('Whether link is disabled'),
    children: z.array(NavLinkSchema).optional().describe('Sub-navigation items'),
    badge: z.union([z.string(), z.number()]).optional().describe('Badge content'),
  })
);

/**
 * Header Bar Schema - Header/navigation bar component
 */
export const HeaderBarSchema = BaseSchema.extend({
  type: z.literal('header-bar'),
  title: z.string().optional().describe('Header title'),
  logo: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Logo content'),
  nav: z.array(NavLinkSchema).optional().describe('Navigation links'),
  left: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Left content'),
  center: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Center content'),
  right: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Right content'),
  sticky: z.boolean().optional().describe('Whether header is sticky'),
  height: z.union([z.string(), z.number()]).optional().describe('Header height'),
  variant: z.enum(['default', 'bordered', 'transparent']).optional().describe('Header variant'),
});

/**
 * Sidebar Schema - Sidebar component
 */
export const SidebarSchema = BaseSchema.extend({
  type: z.literal('sidebar'),
  title: z.string().optional().describe('Sidebar title'),
  nav: z.array(NavLinkSchema).optional().describe('Navigation links'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Sidebar content'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Sidebar footer'),
  position: z.enum(['left', 'right']).optional().describe('Sidebar position'),
  collapsible: z.boolean().optional().describe('Whether sidebar is collapsible'),
  defaultCollapsed: z.boolean().optional().describe('Default collapsed state'),
  collapsed: z.boolean().optional().describe('Controlled collapsed state'),
  width: z.union([z.string(), z.number()]).optional().describe('Sidebar width'),
  collapsedWidth: z.union([z.string(), z.number()]).optional().describe('Collapsed width'),
  onCollapsedChange: z.function().optional().describe('Collapsed change handler'),
  variant: z.enum(['default', 'bordered', 'floating']).optional().describe('Sidebar variant'),
});

/**
 * Breadcrumb Item Schema
 */
export const BreadcrumbItemSchema = z.object({
  label: z.string().describe('Breadcrumb label'),
  href: z.string().optional().describe('Link URL'),
  icon: z.string().optional().describe('Breadcrumb icon'),
  onClick: z.function().optional().describe('Click handler'),
});

/**
 * Breadcrumb Schema - Breadcrumb navigation
 */
export const BreadcrumbSchema = BaseSchema.extend({
  type: z.literal('breadcrumb'),
  items: z.array(BreadcrumbItemSchema).describe('Breadcrumb items'),
  separator: z.string().optional().describe('Custom separator'),
  maxItems: z.number().optional().describe('Maximum items to display'),
});

/**
 * Pagination Schema - Pagination component
 */
export const PaginationSchema = BaseSchema.extend({
  type: z.literal('pagination'),
  page: z.number().optional().describe('Current page number'),
  totalPages: z.number().describe('Total number of pages'),
  siblings: z.number().optional().describe('Number of sibling pages to show'),
  showFirstLast: z.boolean().optional().describe('Show first/last page buttons'),
  showPrevNext: z.boolean().optional().describe('Show previous/next buttons'),
  onPageChange: z.function().optional().describe('Page change handler'),
});

/**
 * Navigation Menu Item Schema
 */
export const NavigationMenuItemSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string().describe('Menu item label'),
    href: z.string().optional().describe('Link URL'),
    description: z.string().optional().describe('Item description'),
    icon: z.string().optional().describe('Item icon'),
    children: z.array(NavigationMenuItemSchema).optional().describe('Submenu items'),
  })
);

/**
 * Navigation Menu Schema - Navigation menu component
 */
export const NavigationMenuSchema = BaseSchema.extend({
  type: z.literal('navigation-menu'),
  items: z.array(NavigationMenuItemSchema).optional().describe('Menu items'),
  orientation: z.enum(['horizontal', 'vertical']).optional().describe('Menu orientation'),
});

/**
 * Button Group Button Schema
 */
export const ButtonGroupButtonSchema = z.object({
  label: z.string().describe('Button label'),
  variant: z.enum(['default', 'secondary', 'destructive', 'outline', 'ghost', 'link']).optional(),
  size: z.enum(['default', 'sm', 'lg', 'icon']).optional(),
  disabled: z.boolean().optional().describe('Whether button is disabled'),
  onClick: z.function().optional().describe('Click handler'),
  className: z.string().optional().describe('Button class name'),
});

/**
 * Button Group Schema - Button group component
 */
export const ButtonGroupSchema = BaseSchema.extend({
  type: z.literal('button-group'),
  buttons: z.array(ButtonGroupButtonSchema).optional().describe('Group buttons'),
  variant: z.enum(['default', 'outline']).optional().describe('Button group variant'),
  size: z.enum(['default', 'sm', 'lg']).optional().describe('Button group size'),
});

/**
 * Navigation Schema Union - All navigation component schemas
 */
export const NavigationSchema = z.discriminatedUnion('type', [
  HeaderBarSchema,
  SidebarSchema,
  BreadcrumbSchema,
  PaginationSchema,
  NavigationMenuSchema,
  ButtonGroupSchema,
]);
