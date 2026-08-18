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
   * Confirm handler
   */
  onConfirm?: () => void | Promise<void>;
  /**
   * Cancel handler
   */
  onCancel?: () => void;
  /**
   * Open state change handler
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
   * Open state change handler
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Menu item
 */
export interface MenuItem {
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
   * Separator (renders as divider)
   */
  separator?: boolean;
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
