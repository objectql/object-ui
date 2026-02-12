/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Disclosure Component Zod Validators
 * 
 * Zod validation schemas for collapsible/disclosure components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/disclosure
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * Accordion Item Schema
 */
export const AccordionItemSchema = z.object({
  value: z.string().describe('Unique accordion item identifier'),
  title: z.string().describe('Accordion item title'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Accordion item content'),
  disabled: z.boolean().optional().describe('Whether item is disabled'),
  icon: z.string().optional().describe('Item icon'),
});

/**
 * Accordion Schema - Accordion component
 */
export const AccordionSchema = BaseSchema.extend({
  type: z.literal('accordion'),
  items: z.array(AccordionItemSchema).describe('Accordion items'),
  accordionType: z.enum(['single', 'multiple']).optional().describe('Accordion type'),
  collapsible: z.boolean().optional().describe('Whether items can be collapsed'),
  defaultValue: z.union([z.string(), z.array(z.string())]).optional().describe('Default open item(s)'),
  value: z.union([z.string(), z.array(z.string())]).optional().describe('Controlled open item(s)'),
  onValueChange: z.function().optional().describe('Value change handler'),
  variant: z.enum(['default', 'bordered', 'separated']).optional().describe('Accordion variant'),
});

/**
 * Collapsible Schema - Collapsible component
 */
export const CollapsibleSchema = BaseSchema.extend({
  type: z.literal('collapsible'),
  trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Trigger content'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Collapsible content'),
  defaultOpen: z.boolean().optional().describe('Default open state'),
  open: z.boolean().optional().describe('Controlled open state'),
  disabled: z.boolean().optional().describe('Whether collapsible is disabled'),
  onOpenChange: z.function().optional().describe('Open change handler'),
});

/**
 * Toggle Group Item Schema
 */
export const ToggleGroupItemSchema = z.object({
  value: z.string().describe('Item value'),
  label: z.string().describe('Item label'),
  icon: z.string().optional().describe('Item icon'),
  disabled: z.boolean().optional().describe('Whether item is disabled'),
});

/**
 * Toggle Group Schema - Toggle group component
 */
export const ToggleGroupSchema = BaseSchema.extend({
  type: z.literal('toggle-group'),
  selectionType: z.enum(['single', 'multiple']).optional().describe('Selection type'),
  variant: z.enum(['default', 'outline']).optional().describe('Toggle group variant'),
  size: z.enum(['default', 'sm', 'lg']).optional().describe('Toggle group size'),
  items: z.array(ToggleGroupItemSchema).optional().describe('Toggle group items'),
  defaultValue: z.union([z.string(), z.array(z.string())]).optional().describe('Default value(s)'),
  value: z.union([z.string(), z.array(z.string())]).optional().describe('Controlled value(s)'),
  disabled: z.boolean().optional().describe('Whether toggle group is disabled'),
  onValueChange: z.function().optional().describe('Value change handler'),
});

/**
 * Disclosure Schema Union - All disclosure component schemas
 */
export const DisclosureSchema = z.discriminatedUnion('type', [
  AccordionSchema,
  CollapsibleSchema,
  ToggleGroupSchema,
]);
