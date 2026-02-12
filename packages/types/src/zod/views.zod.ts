/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - View Component Zod Validators
 * 
 * Zod validation schemas for view components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/views
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * View Type Schema
 */
export const ViewTypeSchema = z.enum(['list', 'detail', 'grid', 'kanban', 'calendar', 'timeline', 'map']).describe('View type');

/**
 * Detail View Field Schema
 */
export const DetailViewFieldSchema = z.object({
  name: z.string().describe('Field name/path'),
  label: z.string().optional().describe('Display label'),
  type: z.enum(['text', 'image', 'link', 'badge', 'date', 'datetime', 'json', 'html', 'markdown', 'custom']).optional().describe('Field type for rendering'),
  format: z.string().optional().describe('Format string (e.g., date format)'),
  render: SchemaNodeSchema.optional().describe('Custom renderer'),
  value: z.any().optional().describe('Field value'),
  readonly: z.boolean().optional().describe('Whether field is read-only'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Field visibility condition'),
  span: z.number().optional().describe('Span across columns (for grid layout)'),
});

/**
 * Detail View Section Schema
 */
export const DetailViewSectionSchema = z.object({
  title: z.string().optional().describe('Section title'),
  description: z.string().optional().describe('Section description'),
  icon: z.string().optional().describe('Section icon'),
  fields: z.array(DetailViewFieldSchema).describe('Fields in this section'),
  collapsible: z.boolean().optional().describe('Collapsible section'),
  defaultCollapsed: z.boolean().optional().describe('Default collapsed state'),
  columns: z.number().optional().describe('Grid columns for field layout'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Section visibility condition'),
});

/**
 * Detail View Tab Schema
 */
export const DetailViewTabSchema = z.object({
  key: z.string().describe('Tab key/identifier'),
  label: z.string().describe('Tab label'),
  icon: z.string().optional().describe('Tab icon'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Tab content'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Tab visibility condition'),
  badge: z.union([z.string(), z.number()]).optional().describe('Badge count'),
});

/**
 * Detail View Schema
 */
export const DetailViewSchema = BaseSchema.extend({
  type: z.literal('detail-view'),
  title: z.string().optional().describe('Detail title'),
  api: z.string().optional().describe('API endpoint to fetch detail data'),
  resourceId: z.union([z.string(), z.number()]).optional().describe('Resource ID to display'),
  objectName: z.string().optional().describe('Object name (for ObjectQL integration)'),
  data: z.any().optional().describe('Data to display (if not fetching from API)'),
  layout: z.enum(['vertical', 'horizontal', 'grid']).optional().describe('Layout mode'),
  columns: z.number().optional().describe('Grid columns (for grid layout)'),
  sections: z.array(DetailViewSectionSchema).optional().describe('Field sections for organized display'),
  fields: z.array(DetailViewFieldSchema).optional().describe('Direct fields (without sections)'),
  actions: z.array(z.any()).optional().describe('Actions available in detail view'),
  tabs: z.array(DetailViewTabSchema).optional().describe('Tabs for additional content'),
  showBack: z.boolean().optional().default(true).describe('Show back button'),
  backUrl: z.string().optional().describe('Back button URL'),
  onBack: z.string().optional().describe('Custom back action'),
  showEdit: z.boolean().optional().describe('Show edit button'),
  editUrl: z.string().optional().describe('Edit button URL'),
  showDelete: z.boolean().optional().describe('Show delete button'),
  deleteConfirmation: z.string().optional().describe('Delete confirmation message'),
  loading: z.boolean().optional().default(true).describe('Whether to show loading state'),
  header: SchemaNodeSchema.optional().describe('Custom header content'),
  footer: SchemaNodeSchema.optional().describe('Custom footer content'),
  related: z.array(z.object({
    title: z.string().describe('Relation title'),
    type: z.enum(['list', 'grid', 'table']).describe('Relation type'),
    api: z.string().optional().describe('API endpoint for related data'),
    data: z.array(z.any()).optional().describe('Static data'),
    columns: z.array(z.any()).optional().describe('Columns for table view'),
    fields: z.array(z.string()).optional().describe('Fields for list view'),
  })).optional().describe('Related records section'),
});

/**
 * View Switcher Schema
 */
export const ViewSwitcherSchema = BaseSchema.extend({
  type: z.literal('view-switcher'),
  views: z.array(z.object({
    type: ViewTypeSchema.describe('View type'),
    label: z.string().optional().describe('View label'),
    icon: z.string().optional().describe('View icon'),
    schema: SchemaNodeSchema.optional().describe('View schema'),
  })).describe('Available view types'),
  defaultView: ViewTypeSchema.optional().describe('Default/active view'),
  activeView: ViewTypeSchema.optional().describe('Current active view'),
  variant: z.enum(['tabs', 'buttons', 'dropdown']).optional().describe('Switcher variant'),
  position: z.enum(['top', 'bottom', 'left', 'right']).optional().describe('Switcher position'),
  onViewChange: z.string().optional().describe('View change callback'),
  persistPreference: z.boolean().optional().describe('Persist view preference'),
  storageKey: z.string().optional().describe('Storage key for persisting view'),
});

/**
 * Filter UI Schema
 */
export const FilterUISchema = BaseSchema.extend({
  type: z.literal('filter-ui'),
  filters: z.array(z.object({
    field: z.string().describe('Filter field'),
    label: z.string().optional().describe('Filter label'),
    type: z.enum(['text', 'number', 'select', 'date', 'date-range', 'boolean']).describe('Filter type'),
    operator: z.enum(['equals', 'contains', 'startsWith', 'gt', 'lt', 'between', 'in']).optional().describe('Filter operator'),
    options: z.array(z.object({ label: z.string(), value: z.any() })).optional().describe('Options for select filter'),
    placeholder: z.string().optional().describe('Placeholder'),
  })).describe('Available filters'),
  values: z.record(z.string(), z.any()).optional().describe('Current filter values'),
  onChange: z.string().optional().describe('Filter change callback'),
  showClear: z.boolean().optional().describe('Show clear button'),
  showApply: z.boolean().optional().describe('Show apply button'),
  layout: z.enum(['inline', 'popover', 'drawer']).optional().describe('Filter layout'),
});

/**
 * Sort UI Schema
 */
export const SortUISchema = BaseSchema.extend({
  type: z.literal('sort-ui'),
  fields: z.array(z.object({
    field: z.string().describe('Field name'),
    label: z.string().optional().describe('Field label'),
  })).describe('Sortable fields'),
  sort: z.array(z.object({
    field: z.string().describe('Field to sort by'),
    direction: z.enum(['asc', 'desc']).describe('Sort direction'),
  })).optional().describe('Current sort configuration'),
  onChange: z.string().optional().describe('Sort change callback'),
  multiple: z.boolean().optional().describe('Allow multiple sort fields'),
  variant: z.enum(['dropdown', 'buttons']).optional().describe('UI variant'),
});

/**
 * Union of all view schemas
 */
export const ViewComponentSchema = z.discriminatedUnion('type', [
  DetailViewSchema,
  ViewSwitcherSchema,
  FilterUISchema,
  SortUISchema,
]);

/**
 * Export type inference helpers
 */
export type ViewTypeSchemaType = z.infer<typeof ViewTypeSchema>;
export type DetailViewFieldSchemaType = z.infer<typeof DetailViewFieldSchema>;
export type DetailViewSectionSchemaType = z.infer<typeof DetailViewSectionSchema>;
export type DetailViewTabSchemaType = z.infer<typeof DetailViewTabSchema>;
export type DetailViewSchemaType = z.infer<typeof DetailViewSchema>;
export type ViewSwitcherSchemaType = z.infer<typeof ViewSwitcherSchema>;
export type FilterUISchemaType = z.infer<typeof FilterUISchema>;
export type SortUISchemaType = z.infer<typeof SortUISchema>;
