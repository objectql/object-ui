/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Disclosure Component Schemas
 * 
 * Type definitions for collapsible and expandable components.
 * 
 * @module disclosure
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base';

/**
 * Accordion item
 */
export interface AccordionItem {
  /**
   * Unique item identifier
   */
  value: string;
  /**
   * Item title/trigger
   */
  title: string;
  /**
   * Item content
   */
  content: SchemaNode | SchemaNode[];
  /**
   * Whether item is disabled
   *
   * Forwarded to the underlying accordion item by the `accordion` renderer,
   * matching the item-level `disabled` that `tabs`, `select`, `dropdown-menu`,
   * `menubar`, `context-menu` and `toggle-group` already honor.
   */
  disabled?: boolean;
}

/**
 * Accordion component
 */
export interface AccordionSchema extends BaseSchema {
  type: 'accordion';
  /**
   * Accordion items
   */
  items: AccordionItem[];
  /**
   * Accordion type
   * @default 'single'
   */
  accordionType?: 'single' | 'multiple';
  /**
   * Whether items are collapsible
   * @default true
   */
  collapsible?: boolean;
  /**
   * Default expanded item values
   */
  defaultValue?: string | string[];
  /**
   * Controlled expanded item values
   */
  value?: string | string[];
  /**
   * Change handler
   */
  onValueChange?: (value: string | string[]) => void;
  /**
   * Accordion variant
   * @default 'default'
   */
  variant?: 'default' | 'bordered' | 'separated';
}

/**
 * Collapsible component
 */
export interface CollapsibleSchema extends BaseSchema {
  type: 'collapsible';
  /**
   * Trigger content/label
   */
  trigger: string | SchemaNode;
  /**
   * Collapsible content
   */
  content: SchemaNode | SchemaNode[];
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
   * Whether collapsible is disabled
   */
  disabled?: boolean;
  /**
   * Open state change handler
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Toggle group item
 */
export interface ToggleGroupItem {
  /**
   * Item value
   */
  value: string;
  /**
   * Item label
   */
  label: string;
  /**
   * Whether item is disabled
   *
   * Forwarded to the underlying toggle item by the `toggle-group` renderer,
   * matching the item-level `disabled` that `tabs`, `select`, `dropdown-menu`,
   * `menubar` and `context-menu` already honor.
   */
  disabled?: boolean;
}

/**
 * Toggle group component
 */
export interface ToggleGroupSchema extends BaseSchema {
  type: 'toggle-group';
  /**
   * Toggle group selection mode
   * @default 'single'
   */
  selectionType?: 'single' | 'multiple';
  /**
   * Toggle group variant
   * @default 'default'
   */
  variant?: 'default' | 'outline';
  /**
   * Toggle group size
   * @default 'default'
   */
  size?: 'default' | 'sm' | 'lg';
  /**
   * Toggle group items
   */
  items?: ToggleGroupItem[];
  /**
   * Default selected value(s)
   */
  defaultValue?: string | string[];
  /**
   * Controlled selected value(s)
   */
  value?: string | string[];
  /**
   * Whether toggle group is disabled
   */
  disabled?: boolean;
  /**
   * Change handler
   */
  onValueChange?: (value: string | string[]) => void;
}

/**
 * Union type of all disclosure schemas
 */
export type DisclosureSchema =
  | AccordionSchema
  | CollapsibleSchema
  | ToggleGroupSchema;
