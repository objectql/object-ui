/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Block Schema Zod Validators
 * 
 * Zod validation schemas for reusable component blocks.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/blocks
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * Block Variable Schema
 */
export const BlockVariableSchema = z.object({
  name: z.string().describe('Variable name'),
  label: z.string().optional().describe('Display label'),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'component']).optional().describe('Variable type'),
  defaultValue: z.any().optional().describe('Default value'),
  description: z.string().optional().describe('Description/help text'),
  required: z.boolean().optional().describe('Whether this variable is required'),
  validation: z.any().optional().describe('Validation rules'),
  enum: z.array(z.any()).optional().describe('Enum options (for string/number types)'),
});

/**
 * Block Slot Schema
 */
export const BlockSlotSchema = z.object({
  name: z.string().describe('Slot name'),
  label: z.string().optional().describe('Display label'),
  description: z.string().optional().describe('Description'),
  defaultContent: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Default content'),
  allowedTypes: z.array(z.string()).optional().describe('Allowed component types'),
  maxChildren: z.number().optional().describe('Maximum number of children'),
  required: z.boolean().optional().describe('Whether this slot is required'),
});

/**
 * Block Metadata Schema
 */
export const BlockMetadataSchema = z.object({
  name: z.string().describe('Block name/identifier'),
  label: z.string().optional().describe('Display label'),
  description: z.string().optional().describe('Block description'),
  category: z.string().optional().describe('Block category'),
  icon: z.string().optional().describe('Block icon'),
  tags: z.array(z.string()).optional().describe('Block tags for search'),
  author: z.string().optional().describe('Author/creator'),
  version: z.string().optional().describe('Version'),
  license: z.string().optional().describe('License'),
  repository: z.string().optional().describe('Repository URL'),
  preview: z.string().optional().describe('Preview image URL'),
  premium: z.boolean().optional().describe('Is this a premium/paid block'),
});

/**
 * Block Schema
 */
export const BlockSchema = BaseSchema.extend({
  type: z.literal('block'),
  meta: BlockMetadataSchema.optional().describe('Block metadata'),
  variables: z.array(BlockVariableSchema).optional().describe('Block variables/props'),
  slots: z.array(BlockSlotSchema).optional().describe('Block slots for content injection'),
  template: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Block template (component tree)'),
  values: z.record(z.string(), z.any()).optional().describe('Variable values (when using a block)'),
  slotContent: z.record(z.string(), z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])).optional().describe('Slot content (when using a block)'),
  blockRef: z.string().optional().describe('Block reference (for reusing saved blocks)'),
  editable: z.boolean().optional().describe('Enable edit mode'),
});

/**
 * Block Library Item Schema
 */
export const BlockLibraryItemSchema = z.object({
  id: z.string().describe('Unique identifier'),
  meta: BlockMetadataSchema.describe('Block metadata'),
  schema: BlockSchema.describe('Block schema'),
  installs: z.number().optional().describe('Installation count'),
  rating: z.number().optional().describe('Rating (1-5)'),
  ratingCount: z.number().optional().describe('Number of ratings'),
  updatedAt: z.string().optional().describe('Last updated timestamp'),
  createdAt: z.string().optional().describe('Created timestamp'),
});

/**
 * Block Library Schema
 */
export const BlockLibrarySchema = BaseSchema.extend({
  type: z.literal('block-library'),
  apiEndpoint: z.string().optional().describe('Library API endpoint'),
  category: z.string().optional().describe('Filter by category'),
  searchQuery: z.string().optional().describe('Search query'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  showPremium: z.boolean().optional().describe('Show premium blocks'),
  blocks: z.array(BlockLibraryItemSchema).optional().describe('Blocks to display'),
  loading: z.boolean().optional().describe('Loading state'),
  onInstall: z.string().optional().describe('Install callback'),
  onPreview: z.string().optional().describe('Preview callback'),
});

/**
 * Block Editor Schema
 */
export const BlockEditorSchema = BaseSchema.extend({
  type: z.literal('block-editor'),
  block: BlockSchema.optional().describe('Block being edited'),
  showVariables: z.boolean().optional().describe('Show variable editor'),
  showSlots: z.boolean().optional().describe('Show slot editor'),
  showTemplate: z.boolean().optional().describe('Show template editor'),
  showPreview: z.boolean().optional().describe('Show preview'),
  onSave: z.string().optional().describe('Save callback'),
  onCancel: z.string().optional().describe('Cancel callback'),
});

/**
 * Block Instance Schema
 */
export const BlockInstanceSchema = BaseSchema.extend({
  type: z.literal('block-instance'),
  blockId: z.string().describe('Block reference ID'),
  blockName: z.string().optional().describe('Block name (for local blocks)'),
  values: z.record(z.string(), z.any()).optional().describe('Variable values'),
  slotContent: z.record(z.string(), z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])).optional().describe('Slot content'),
  overrideStyles: z.boolean().optional().describe('Override styles'),
});

/**
 * Component Schema
 */
export const ComponentSchema = BaseSchema.extend({
  type: z.literal('component'),
  componentName: z.string().optional().describe('Component name/identifier'),
  props: z.record(z.string(), z.any()).optional().describe('Component props'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Component children'),
});

/**
 * Union of all block schemas
 */
export const BlockComponentSchema = z.discriminatedUnion('type', [
  BlockSchema,
  BlockLibrarySchema,
  BlockEditorSchema,
  BlockInstanceSchema,
  ComponentSchema,
]);

/**
 * Export type inference helpers
 */
export type BlockVariableSchemaType = z.infer<typeof BlockVariableSchema>;
export type BlockSlotSchemaType = z.infer<typeof BlockSlotSchema>;
export type BlockMetadataSchemaType = z.infer<typeof BlockMetadataSchema>;
export type BlockSchemaType = z.infer<typeof BlockSchema>;
export type BlockLibraryItemSchemaType = z.infer<typeof BlockLibraryItemSchema>;
export type BlockLibrarySchemaType = z.infer<typeof BlockLibrarySchema>;
export type BlockEditorSchemaType = z.infer<typeof BlockEditorSchema>;
export type BlockInstanceSchemaType = z.infer<typeof BlockInstanceSchema>;
export type ComponentSchemaType = z.infer<typeof ComponentSchema>;
