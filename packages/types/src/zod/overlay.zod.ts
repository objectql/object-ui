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
import { retirementTombstone } from './tombstone.zod.js';

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
  align: z.enum(['start', 'center', 'end']).optional()
    .describe('Alignment against the trigger, read at renderers/overlay/hover-card.tsx:24 — `align={schema.align}` on HoverCardContent, beside the already-declared `side` (objectui#6150)'),
  openDelay: z.number().optional().describe('Delay before opening (ms)'),
  closeDelay: z.number().optional().describe('Delay before closing (ms)'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Menu Item Schema — a discriminated union (objectui#6523): a command item
 * (label required) or a divider (`separator: true`, no label). Mirrors the
 * TS union `MenuItem = MenuCommandItem | MenuDividerItem` in `../overlay.ts`;
 * see that file's doc comment for why this is a union rather than an
 * optional `label`, and why `type` is tombstoned on both arms.
 *
 * Both tombstones carry their guidance through `retirementTombstone()`
 * (objectui#6931), so the arm-level issue reads the remediation instead of
 * zod's generic `expected never`. Note what a UNION does to that: the
 * top-level issue this schema reports is zod's own `invalid_union`
 * (`"Invalid input"`, path `[]`), and the per-arm issues — where the guidance
 * lives — hang off it. A consumer that only prints top-level issues therefore
 * still shows `Invalid input` here; the guidance is reached by walking the
 * union's arm errors, and by the `.describe()` metadata, which is unchanged.
 */
export const MenuItemSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      label: z.string().describe('Menu item label'),
      icon: z.string().optional().describe('Menu item icon'),
      disabled: z.boolean().optional().describe('Whether item is disabled'),
      onClick: z.function().optional().describe('Click handler'),
      shortcut: z.string().optional().describe('Keyboard shortcut'),
      children: z.array(MenuItemSchema).optional().describe('Submenu items'),
      separator: z.literal(false).optional().describe('Not a divider'),
      type: retirementTombstone(
        'RETIRED (objectui#6523) — dividers are `{ separator: true }`; ' +
        '`type` (\'separator\' or \'label\') was an undeclared spelling two ' +
        'renderers used to read and is now a declared refusal, not a strip.'
      ),
    }),
    z.object({
      separator: z.literal(true).describe('Renders as a divider between items — no label'),
      type: retirementTombstone('RETIRED (objectui#6523) — see the command-item arm above.'),
    }),
  ])
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
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional()
    .describe("Right-clickable area, read at renderers/overlay/context-menu.tsx:95 — `renderChildren(schema.trigger || {type:'text', value:'Right click here'})`. Optional although the docs page shows it required: the renderer substitutes a placeholder, so trigger-less documents are legal today (objectui#6150)"),
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
