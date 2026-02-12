/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Overlay Component Zod Validators
 * 
 * Zod validation schemas for overlay, modal, and popup components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/overlay
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * Dialog Schema - Dialog/modal component
 */
export const DialogSchema = BaseSchema.extend({
  type: z.literal('dialog'),
  title: z.string().optional().describe('Dialog title'),
  description: z.string().optional().describe('Dialog description'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog content'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog trigger'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog footer'),
  modal: z.boolean().optional().describe('Whether dialog is modal'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Alert Dialog Schema - Alert dialog component
 */
export const AlertDialogSchema = BaseSchema.extend({
  type: z.literal('alert-dialog'),
  title: z.string().optional().describe('Alert dialog title'),
  description: z.string().optional().describe('Alert dialog description'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog trigger'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  cancelLabel: z.string().optional().describe('Cancel button label'),
  confirmLabel: z.string().optional().describe('Confirm button label'),
  confirmVariant: z.enum(['default', 'destructive']).optional().describe('Confirm button variant'),
  onConfirm: z.function().optional().describe('Confirm handler'),
  onCancel: z.function().optional().describe('Cancel handler'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Sheet Schema - Sheet/side panel component
 */
export const SheetSchema = BaseSchema.extend({
  type: z.literal('sheet'),
  title: z.string().optional().describe('Sheet title'),
  description: z.string().optional().describe('Sheet description'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Sheet content'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Sheet trigger'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Sheet position'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Sheet footer'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Drawer Schema - Drawer component
 */
export const DrawerSchema = BaseSchema.extend({
  type: z.literal('drawer'),
  title: z.string().optional().describe('Drawer title'),
  description: z.string().optional().describe('Drawer description'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Drawer content'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Drawer trigger'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  direction: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Drawer direction'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Popover Schema - Popover component
 */
export const PopoverSchema = BaseSchema.extend({
  type: z.literal('popover'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Popover content'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Popover trigger'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Popover side'),
  align: z.enum(['start', 'center', 'end']).optional().describe('Popover alignment'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Tooltip Schema - Tooltip component
 */
export const TooltipSchema = BaseSchema.extend({
  type: z.literal('tooltip'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Tooltip content'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Tooltip children'),
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Tooltip side'),
  align: z.enum(['start', 'center', 'end']).optional().describe('Tooltip alignment'),
  delayDuration: z.number().optional().describe('Delay before showing (ms)'),
});

/**
 * Hover Card Schema - Hover card component
 */
export const HoverCardSchema = BaseSchema.extend({
  type: z.literal('hover-card'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Hover card content'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Hover card trigger'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Hover card side'),
  openDelay: z.number().optional().describe('Delay before opening (ms)'),
  closeDelay: z.number().optional().describe('Delay before closing (ms)'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Menu Item Schema
 */
export const MenuItemSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    label: z.string().describe('Menu item label'),
    icon: z.string().optional().describe('Menu item icon'),
    disabled: z.boolean().optional().describe('Whether item is disabled'),
    onClick: z.function().optional().describe('Click handler'),
    shortcut: z.string().optional().describe('Keyboard shortcut'),
    children: z.array(MenuItemSchema).optional().describe('Submenu items'),
    separator: z.boolean().optional().describe('Whether this is a separator'),
  })
);

/**
 * Dropdown Menu Schema - Dropdown menu component
 */
export const DropdownMenuSchema = BaseSchema.extend({
  type: z.literal('dropdown-menu'),
  items: z.array(MenuItemSchema).describe('Menu items'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Menu trigger'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Menu side'),
  align: z.enum(['start', 'center', 'end']).optional().describe('Menu alignment'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Context Menu Schema - Context menu component
 */
export const ContextMenuSchema = BaseSchema.extend({
  type: z.literal('context-menu'),
  items: z.array(MenuItemSchema).describe('Menu items'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Context menu children'),
});

/**
 * Menubar Menu Schema
 */
export const MenubarMenuSchema = z.object({
  label: z.string().describe('Menu label'),
  items: z.array(MenuItemSchema).describe('Menu items'),
});

/**
 * Menubar Schema - Menubar component
 */
export const MenubarSchema = BaseSchema.extend({
  type: z.literal('menubar'),
  menus: z.array(MenubarMenuSchema).optional().describe('Menubar menus'),
});

/**
 * Overlay Schema Union - All overlay component schemas
 */
export const OverlaySchema = z.discriminatedUnion('type', [
  DialogSchema,
  AlertDialogSchema,
  SheetSchema,
  DrawerSchema,
  PopoverSchema,
  TooltipSchema,
  HoverCardSchema,
  DropdownMenuSchema,
  ContextMenuSchema,
  MenubarSchema,
]);
