/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Overlay Component Schemas
 * 
 * Type definitions for modal, dialog, and overlay components.
 * 
 * @module overlay
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base.js';

/**
 * Position type for overlays
 */
export type OverlayPosition = 'top' | 'right' | 'bottom' | 'left';

/**
 * Alignment type for overlays
 */
export type OverlayAlignment = 'start' | 'center' | 'end';

/**
 * Dialog component
 */
export interface DialogSchema extends BaseSchema {
  type: 'dialog';
  /**
   * Dialog title
   */
  title?: string;
  /**
   * Dialog description
   */
  description?: string;
  /**
   * Dialog content
   */
  content?: SchemaNode | SchemaNode[];
  /**
   * Dialog trigger (button or element that opens the dialog)
   */
  trigger?: SchemaNode;
  /**
   * Default open state
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Dialog footer content
   */
  footer?: SchemaNode | SchemaNode[];
  /**
   * Whether dialog is modal (prevents interaction with background)
   * @default true
   */
  modal?: boolean;
  /**
   * Open state change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * spread onto the Radix `Dialog` root by the renderer's `{...props}`.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Alert dialog (confirmation dialog)
 */
export interface AlertDialogSchema extends BaseSchema {
  type: 'alert-dialog';
  /**
   * Dialog title
   */
  title?: string;
  /**
   * Dialog description
   */
  description?: string;
  /**
   * Dialog trigger
   */
  trigger?: SchemaNode;
  /**
   * Default open state
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Cancel button label
   * @default 'Cancel'
   */
  cancelLabel?: string;
  /**
   * Confirm button label
   * @default 'Confirm'
   */
  confirmLabel?: string;
  /**
   * Confirm button variant
   * @default 'default'
   */
  confirmVariant?: 'default' | 'destructive';
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `alert-dialog` renderer wires its action button to `schema.onAction` and
   * never reads it. The zod twin refuses it by name; author behaviour as a node
   * type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onConfirm?: never;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `alert-dialog` renderer spreads it onto the Radix root, which has no such
   * prop; the cancel button is `AlertDialogCancel`. The zod twin refuses it by
   * name; author behaviour as a node type (`{ "type": "toast" }`, an
   * `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onCancel?: never;
  /**
   * Open state change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * spread onto the Radix `AlertDialog` root by the renderer's `{...props}`.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Sheet/Drawer side panel
 */
export interface SheetSchema extends BaseSchema {
  type: 'sheet';
  /**
   * Sheet title
   */
  title?: string;
  /**
   * Sheet description
   */
  description?: string;
  /**
   * Sheet content
   */
  content?: SchemaNode | SchemaNode[];
  /**
   * Sheet trigger
   */
  trigger?: SchemaNode;
  /**
   * Default open state
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Sheet side
   * @default 'right'
   */
  side?: OverlayPosition;
  /**
   * Sheet footer content
   */
  footer?: SchemaNode | SchemaNode[];
  /**
   * Open state change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * spread onto the Radix `Sheet` (Dialog) root by the renderer's `{...props}`.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Drawer component (alternative name for Sheet)
 */
export interface DrawerSchema extends BaseSchema {
  type: 'drawer';
  /**
   * Drawer title
   */
  title?: string;
  /**
   * Drawer description
   */
  description?: string;
  /**
   * Drawer content
   */
  content?: SchemaNode | SchemaNode[];
  /**
   * Drawer trigger
   */
  trigger?: SchemaNode;
  /**
   * Default open state
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Drawer direction
   * @default 'right'
   */
  direction?: OverlayPosition;
  /**
   * Open state change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * spread onto the vaul `Drawer` root by the renderer's `{...props}`.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Popover component
 */
export interface PopoverSchema extends BaseSchema {
  type: 'popover';
  /**
   * Popover content
   */
  content: SchemaNode | SchemaNode[];
  /**
   * Popover trigger
   */
  trigger: SchemaNode;
  /**
   * Default open state
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Popover side
   * @default 'bottom'
   */
  side?: OverlayPosition;
  /**
   * Popover alignment
   * @default 'center'
   */
  align?: OverlayAlignment;
  /**
   * Open state change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * spread onto the Radix `Popover` root by the renderer's `{...props}`.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Tooltip component
 */
export interface TooltipSchema extends BaseSchema {
  type: 'tooltip';
  /**
   * Tooltip content/text
   */
  content: string | SchemaNode;
  /**
   * Element to attach tooltip to
   */
  children: SchemaNode;
  /**
   * Tooltip side
   * @default 'top'
   */
  side?: OverlayPosition;
  /**
   * Tooltip alignment
   * @default 'center'
   */
  align?: OverlayAlignment;
  /**
   * Delay before showing (ms)
   * @default 200
   */
  delayDuration?: number;
}

/**
 * Hover card component
 */
export interface HoverCardSchema extends BaseSchema {
  type: 'hover-card';
  /**
   * Hover card content
   */
  content: SchemaNode | SchemaNode[];
  /**
   * Hover trigger element
   */
  trigger: SchemaNode;
  /**
   * Default open state
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Hover card side
   * @default 'bottom'
   */
  side?: OverlayPosition;
  /**
   * Open delay (ms)
   * @default 200
   */
  openDelay?: number;
  /**
   * Close delay (ms)
   * @default 300
   */
  closeDelay?: number;
  /**
   * Alignment of the card against its trigger.
   *
   * READ SITE: `packages/components/src/renderers/overlay/hover-card.tsx:24` —
   * `align={schema.align}` on `HoverCardContent`, beside the already-declared
   * `side={schema.side}`.
   *
   * Same vocabulary as {@link DropdownMenuSchema.align} and
   * {@link PopoverSchema.align}; declared by objectui#6150.
   */
  align?: OverlayAlignment;
  /**
   * Open state change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * spread onto the Radix `HoverCard` root by the renderer's `{...props}`.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Menu item — a clickable command, or a divider between groups of commands.
 *
 * A discriminated union (objectui#6523): a divider has no label and a command
 * item always has one, so a single object with an optional `label` cannot
 * express "this is a divider" without leaving the divider arm unrepresentable
 * — the shipped renderers' own `defaultProps` for a divider
 * (`{ separator: true }`, no `label`) failed a strict parse against the old
 * shape. `label` stays REQUIRED on the command arm rather than becoming
 * optional, which would have weakened every command item's label protection
 * to solve a problem only the divider arm has.
 *
 * `type` is TOMBSTONED (`?: never`) on both arms. It is not merely
 * undeclared: `dropdown-menu`/`context-menu` used to branch on an undeclared
 * `item.type === 'separator'` (and `=== 'label'`) instead of the declared
 * `separator` key, and a bare (non-strict) zod object silently stripped that
 * key on parse, so no gate ever caught the two renderers reading a spelling
 * the type never declared. Declaring `type?: never` makes authoring it a
 * refusal at parse/type-check time instead of a silent no-op (ADR-0049).
 */
export type MenuItem = MenuCommandItem | MenuDividerItem;

/**
 * The command arm of {@link MenuItem} — a clickable, labelled entry.
 */
export interface MenuCommandItem {
  /**
   * Menu item label
   */
  label: string;
  /**
   * Menu item icon
   */
  icon?: string;
  /**
   * Whether item is disabled
   */
  disabled?: boolean;
  /**
   * Click handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `dropdown-menu` / `context-menu` / `menubar` renderers
   * (`item.onClick?.()`).
   */
  onClick?: () => void;
  /**
   * Keyboard shortcut
   */
  shortcut?: string;
  /**
   * Submenu items
   */
  children?: MenuItem[];
  /**
   * Not a divider — present (typed `false`) only so the union can discriminate
   * on this key without every command item needing to omit it.
   */
  separator?: false;
  /**
   * RETIRED (objectui#6523) — dividers are spelled `{ separator: true }`.
   * `dropdown-menu`/`context-menu` used to read an undeclared `type` key
   * instead (`'separator'` for a divider, `'label'` for a section heading);
   * neither spelling is part of the contract, so authoring `type` is refused
   * rather than silently stripped.
   */
  type?: never;
}

/**
 * The divider arm of {@link MenuItem} — renders as a separator between
 * groups of commands. Deliberately carries no label and no other command
 * fields: a divider is not a command with blank details, it is a different
 * kind of row.
 */
export interface MenuDividerItem {
  /**
   * Renders as a divider (see {@link MenuItem}'s doc comment for why this is
   * a separate arm rather than an optional flag on a single shape).
   */
  separator: true;
  /**
   * RETIRED (objectui#6523) — see {@link MenuCommandItem.type}.
   */
  type?: never;
}

/**
 * Dropdown menu component
 */
export interface DropdownMenuSchema extends BaseSchema {
  type: 'dropdown-menu';
  /**
   * Menu items
   */
  items: MenuItem[];
  /**
   * Menu trigger
   */
  trigger: SchemaNode;
  /**
   * Default open state
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Controlled open state
   */
  open?: boolean;
  /**
   * Menu side
   * @default 'bottom'
   */
  side?: OverlayPosition;
  /**
   * Menu alignment
   * @default 'start'
   */
  align?: OverlayAlignment;
  /**
   * Open state change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * spread onto the Radix `DropdownMenu` root by the renderer's `{...props}`.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Context menu component
 */
export interface ContextMenuSchema extends BaseSchema {
  type: 'context-menu';
  /**
   * Menu items
   */
  items: MenuItem[];
  /**
   * Element to attach context menu to
   */
  children: SchemaNode | SchemaNode[];
  /**
   * The right-clickable area's content.
   *
   * READ SITE: `packages/components/src/renderers/overlay/context-menu.tsx:95`
   * — `renderChildren(schema.trigger || { type: 'text', value: 'Right click here' })`
   * inside `ContextMenuTrigger`. ⚠️ Note the renderer renders `trigger`, NOT
   * the declared {@link ContextMenuSchema.children}, which no read site
   * consumes.
   *
   * Declared OPTIONAL although the docs page shows it required: the renderer
   * substitutes a placeholder when it is absent, so every document without a
   * `trigger` is legal today and declaring it required would refuse them.
   * Declared by objectui#6150.
   */
  trigger?: SchemaNode | SchemaNode[];
}

/**
 * Menubar menu
 */
export interface MenubarMenu {
  /**
   * Menu label
   */
  label: string;
  /**
   * Menu items
   */
  items: MenuItem[];
}

/**
 * Menubar component
 */
export interface MenubarSchema extends BaseSchema {
  type: 'menubar';
  /**
   * Menubar menus
   */
  menus?: MenubarMenu[];
}

/**
 * Union type of all overlay schemas
 */
export type OverlaySchema =
  | DialogSchema
  | AlertDialogSchema
  | SheetSchema
  | DrawerSchema
  | PopoverSchema
  | TooltipSchema
  | HoverCardSchema
  | DropdownMenuSchema
  | ContextMenuSchema
  | MenubarSchema;
