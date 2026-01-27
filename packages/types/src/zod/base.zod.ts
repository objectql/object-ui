/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Base Schema Zod Validators
 * 
 * Zod validation schemas for base component types.
 * These schemas follow the @objectstack/spec UI specification format.
 * 
 * @module zod/base
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Schema Node - Can be a schema object or primitive value
 */
export const SchemaNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    BaseSchemaCore,
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.undefined(),
  ])
);

/**
 * Base Schema - Core validation schema that all components extend
 * 
 * This is the foundation for all UI component schemas in ObjectUI.
 * Following @objectstack/spec UI specification format.
 */
const BaseSchemaCore = z.object({
  /**
   * Component type identifier
   */
  type: z.string().describe('Component type identifier'),

  /**
   * Unique identifier for the component
   */
  id: z.string().optional().describe('Unique component identifier'),

  /**
   * Human-readable name
   */
  name: z.string().optional().describe('Component name'),

  /**
   * Display label
   */
  label: z.string().optional().describe('Display label'),

  /**
   * Description text
   */
  description: z.string().optional().describe('Description text'),

  /**
   * Placeholder text
   */
  placeholder: z.string().optional().describe('Placeholder text'),

  /**
   * Tailwind CSS classes
   */
  className: z.string().optional().describe('Tailwind CSS classes'),

  /**
   * Inline styles
   */
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe('Inline CSS styles'),

  /**
   * Arbitrary data
   */
  data: z.any().optional().describe('Custom data payload'),

  /**
   * Child components or content
   */
  body: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Child components'),

  /**
   * Alternative children property
   */
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Child components (React-style)'),

  /**
   * Visibility control
   */
  visible: z.boolean().optional().describe('Visibility control'),

  /**
   * Conditional visibility expression
   */
  visibleOn: z.string().optional().describe('Expression for conditional visibility'),

  /**
   * Hidden control
   */
  hidden: z.boolean().optional().describe('Hidden control'),

  /**
   * Conditional hidden expression
   */
  hiddenOn: z.string().optional().describe('Expression for conditional hiding'),

  /**
   * Disabled state
   */
  disabled: z.boolean().optional().describe('Disabled state'),

  /**
   * Conditional disabled expression
   */
  disabledOn: z.string().optional().describe('Expression for conditional disabling'),

  /**
   * Test ID for automated testing
   */
  testId: z.string().optional().describe('Test identifier'),

  /**
   * Accessibility label
   */
  ariaLabel: z.string().optional().describe('Accessibility label'),
}).passthrough(); // Allow additional properties for type-specific extensions

/**
 * Base Schema - Export for use in other schemas
 */
export const BaseSchema = BaseSchemaCore;

/**
 * Component Input Configuration
 */
export const ComponentInputSchema = z.object({
  name: z.string().describe('Property name'),
  type: z.enum([
    'string',
    'number',
    'boolean',
    'enum',
    'array',
    'object',
    'color',
    'date',
    'code',
    'file',
    'slot',
  ]).describe('Input control type'),
  label: z.string().optional().describe('Display label'),
  defaultValue: z.any().optional().describe('Default value'),
  required: z.boolean().optional().describe('Required flag'),
  enum: z.union([
    z.array(z.string()),
    z.array(z.object({
      label: z.string(),
      value: z.any(),
    })),
  ]).optional().describe('Enum options'),
  description: z.string().optional().describe('Help text'),
  advanced: z.boolean().optional().describe('Advanced option flag'),
  inputType: z.string().optional().describe('Specific input type'),
  min: z.number().optional().describe('Minimum value'),
  max: z.number().optional().describe('Maximum value'),
  step: z.number().optional().describe('Step value'),
  placeholder: z.string().optional().describe('Placeholder text'),
});

/**
 * Component Metadata
 */
export const ComponentMetaSchema = z.object({
  label: z.string().optional().describe('Display name'),
  icon: z.string().optional().describe('Icon name or SVG'),
  category: z.string().optional().describe('Component category'),
  inputs: z.array(ComponentInputSchema).optional().describe('Configurable properties'),
  defaultProps: z.record(z.string(), z.any()).optional().describe('Default property values'),
  defaultChildren: z.array(SchemaNodeSchema).optional().describe('Default children'),
  examples: z.record(z.string(), z.any()).optional().describe('Example configurations'),
  isContainer: z.boolean().optional().describe('Can have children'),
  resizable: z.boolean().optional().describe('Can be resized'),
  resizeConstraints: z.object({
    width: z.boolean().optional(),
    height: z.boolean().optional(),
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
  }).optional().describe('Resize constraints'),
  tags: z.array(z.string()).optional().describe('Search tags'),
  description: z.string().optional().describe('Component description'),
});

/**
 * Component Configuration
 */
export const ComponentConfigSchema = ComponentMetaSchema.extend({
  type: z.string().describe('Component type identifier'),
  component: z.any().describe('Component renderer'),
});

/**
 * HTML Attributes (generic)
 */
export const HTMLAttributesSchema = z.record(z.string(), z.any()).describe('HTML attributes');

/**
 * Event Handlers
 */
export const EventHandlersSchema = z.record(z.string(), z.function()).describe('Event handlers');

/**
 * Style Props
 */
export const StylePropsSchema = z.object({
  className: z.string().optional(),
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).describe('Style properties');
