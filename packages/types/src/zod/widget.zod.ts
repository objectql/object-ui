/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Widget Zod Schemas
 *
 * Runtime validation schemas for the Widget Manifest system.
 *
 * @module zod/widget
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Widget property type
 */
export const WidgetPropertyTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'enum',
  'color',
  'date',
  'code',
  'file',
  'slot',
  'expression',
]);

/**
 * Widget property definition
 */
export const WidgetPropertySchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  type: WidgetPropertyTypeSchema,
  defaultValue: z.unknown().optional(),
  required: z.boolean().optional(),
  description: z.string().optional(),
  enum: z.union([
    z.array(z.string()),
    z.array(z.object({ label: z.string(), value: z.any() })),
  ]).optional(),
  advanced: z.boolean().optional(),
  validation: z.string().optional(),
  category: z.string().optional(),
});

/**
 * Widget event definition
 */
export const WidgetEventSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

/**
 * Widget lifecycle hooks
 */
export const WidgetLifecycleSchema = z.object({
  onMount: z.string().optional(),
  onUpdate: z.string().optional(),
  onUnmount: z.string().optional(),
  onVisible: z.string().optional(),
  onDataChange: z.string().optional(),
  onError: z.string().optional(),
});

/**
 * Widget implementation source — npm
 */
export const NpmWidgetSourceSchema = z.object({
  type: z.literal('npm'),
  package: z.string(),
  export: z.string().optional(),
  version: z.string().optional(),
});

/**
 * Widget implementation source — remote
 */
export const RemoteWidgetSourceSchema = z.object({
  type: z.literal('remote'),
  url: z.string().url(),
  module: z.string().optional(),
  scope: z.string().optional(),
  integrity: z.string().optional(),
});

/**
 * Widget implementation source — inline
 */
export const InlineWidgetSourceSchema = z.object({
  type: z.literal('inline'),
  code: z.string(),
  language: z.enum(['jsx', 'tsx']).optional(),
});

/**
 * Widget source (discriminated union)
 */
export const WidgetSourceSchema = z.discriminatedUnion('type', [
  NpmWidgetSourceSchema,
  RemoteWidgetSourceSchema,
  InlineWidgetSourceSchema,
]);

/**
 * Widget manifest
 */
export const WidgetManifestSchema = z.object({
  name: z.string(),
  label: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  implementation: WidgetSourceSchema,
  properties: z.array(WidgetPropertySchema).optional(),
  events: z.array(WidgetEventSchema).optional(),
  lifecycle: WidgetLifecycleSchema.optional(),
  isContainer: z.boolean().optional(),
  defaultProps: z.record(z.any()).optional(),
  preview: z.string().optional(),
  tags: z.array(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  styles: z.array(z.string()).optional(),
});

/**
 * Widget catalog
 */
export const WidgetCatalogSchema = z.object({
  name: z.string(),
  version: z.string(),
  widgets: z.array(WidgetManifestSchema),
});

// Export schemas for use in validation
export {
  WidgetPropertyTypeSchema as WidgetPropertyTypeZod,
  WidgetPropertySchema as WidgetPropertyZod,
  WidgetEventSchema as WidgetEventZod,
  WidgetLifecycleSchema as WidgetLifecycleZod,
  WidgetManifestSchema as WidgetManifestZod,
  WidgetCatalogSchema as WidgetCatalogZod,
};
