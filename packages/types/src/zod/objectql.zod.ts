/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - ObjectQL Component Zod Validators
 * 
 * Zod validation schemas for ObjectQL-specific components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/objectql
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema } from './base.zod';

/**
 * HTTP Method Schema
 */
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * HTTP Request Schema
 */
export const HttpRequestSchema = z.object({
  url: z.string().describe('API endpoint URL'),
  method: HttpMethodSchema.optional().describe('HTTP method'),
  headers: z.record(z.string(), z.string()).optional().describe('Custom HTTP headers'),
  params: z.record(z.string(), z.unknown()).optional().describe('Query parameters'),
  body: z.union([z.record(z.string(), z.unknown()), z.string(), z.instanceof(FormData), z.instanceof(Blob)]).optional().describe('Request body'),
});

/**
 * View Data Source Schema
 */
export const ViewDataSchema = z.union([
  z.object({
    provider: z.literal('object'),
    object: z.string().describe('Target object name'),
  }),
  z.object({
    provider: z.literal('api'),
    read: HttpRequestSchema.optional().describe('Read configuration'),
    write: HttpRequestSchema.optional().describe('Write configuration'),
  }),
  z.object({
    provider: z.literal('value'),
    items: z.array(z.unknown()).describe('Static data array'),
  }),
]);

/**
 * List Column Schema
 */
export const ListColumnSchema = z.object({
  field: z.string().describe('Field name'),
  label: z.string().optional().describe('Display label'),
  width: z.number().optional().describe('Column width'),
  align: z.enum(['left', 'center', 'right']).optional().describe('Text alignment'),
  hidden: z.boolean().optional().describe('Hide column by default'),
  sortable: z.boolean().optional().describe('Allow sorting'),
  resizable: z.boolean().optional().describe('Allow resizing'),
  wrap: z.boolean().optional().describe('Allow text wrapping'),
  type: z.string().optional().describe('Renderer type override'),
});

/**
 * Selection Config Schema
 */
export const SelectionConfigSchema = z.object({
  type: z.enum(['none', 'single', 'multiple']).optional().describe('Selection mode'),
});

/**
 * Pagination Config Schema
 */
export const PaginationConfigSchema = z.object({
  pageSize: z.number().optional().describe('Page size'),
  pageSizeOptions: z.array(z.number()).optional().describe('Page size options'),
});

/**
 * Sort Config Schema
 */
export const SortConfigSchema = z.object({
  field: z.string().describe('Field to sort by'),
  order: z.enum(['asc', 'desc']).describe('Sort order'),
});

/**
 * ObjectGrid Schema
 */
export const ObjectGridSchema = BaseSchema.extend({
  type: z.literal('object-grid'),
  objectName: z.string().describe('ObjectQL object name'),
  data: ViewDataSchema.optional().describe('Data source configuration'),
  columns: z.union([z.array(z.string()), z.array(ListColumnSchema)]).optional().describe('Columns configuration'),
  filter: z.array(z.any()).optional().describe('Filter criteria'),
  sort: z.union([z.string(), z.array(SortConfigSchema)]).optional().describe('Sort configuration'),
  searchableFields: z.array(z.string()).optional().describe('Searchable fields'),
  resizable: z.boolean().optional().describe('Enable column resizing'),
  striped: z.boolean().optional().describe('Striped rows'),
  bordered: z.boolean().optional().describe('Show borders'),
  selection: SelectionConfigSchema.optional().describe('Selection configuration'),
  pagination: PaginationConfigSchema.optional().describe('Pagination configuration'),
  
  // Legacy fields
  fields: z.array(z.string()).optional(),
  staticData: z.array(z.any()).optional(),
  selectable: z.union([z.boolean(), z.enum(['single', 'multiple'])]).optional(),
  pageSize: z.number().optional(),
  showSearch: z.boolean().optional(),
  showFilters: z.boolean().optional(),
  showPagination: z.boolean().optional(),
  defaultSort: z.object({ field: z.string(), order: z.enum(['asc', 'desc']) }).optional(),
  defaultFilters: z.record(z.string(), z.any()).optional(),
  operators: z.record(z.string(), z.any()).optional(), // Missing in previous TS scan but common
  rowActions: z.array(z.string()).optional(),
  batchActions: z.array(z.string()).optional(),
  editable: z.boolean().optional(),
  keyboardNavigation: z.boolean().optional(),
  frozenColumns: z.number().optional(),
});

/**
 * ObjectForm Schema
 */
export const ObjectFormSchema = BaseSchema.extend({
  type: z.literal('object-form'),
  objectName: z.string().describe('ObjectQL object name'),
  mode: z.enum(['create', 'edit', 'view']).describe('Form mode'),
  recordId: z.union([z.string(), z.number()]).optional().describe('Record ID'),
  title: z.string().optional().describe('Form title'),
  description: z.string().optional().describe('Form description'),
  fields: z.array(z.string()).optional().describe('Included fields'),
  customFields: z.array(z.any()).optional().describe('Custom field configs'),
  initialData: z.record(z.string(), z.any()).optional().describe('Initial data'),
  groups: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(z.string()),
    collapsible: z.boolean().optional(),
    defaultCollapsed: z.boolean().optional(),
  })).optional().describe('Field groups'),
  layout: z.enum(['vertical', 'horizontal', 'inline', 'grid']).optional().describe('Form layout'),
  columns: z.number().optional().describe('Grid columns'),
  showSubmit: z.boolean().optional().describe('Show submit button'),
  submitText: z.string().optional().describe('Submit button text'),
  showCancel: z.boolean().optional().describe('Show cancel button'),
  cancelText: z.string().optional().describe('Cancel button text'),
  showReset: z.boolean().optional().describe('Show reset button'),
  initialValues: z.record(z.string(), z.any()).optional().describe('Initial values'),
  readOnly: z.boolean().optional().describe('Read-only mode'),
});

/**
 * ObjectView Schema
 */
export const ObjectViewSchema = BaseSchema.extend({
  type: z.literal('object-view'),
  objectName: z.string().describe('ObjectQL object name'),
  title: z.string().optional().describe('View title'),
  description: z.string().optional().describe('View description'),
  layout: z.enum(['drawer', 'modal', 'page']).optional().describe('Layout mode'),
  table: z.lazy(() => ObjectGridSchema.omit({ type: true, objectName: true }).partial()).optional().describe('Table config'),
  form: z.lazy(() => ObjectFormSchema.omit({ type: true, objectName: true, mode: true }).partial()).optional().describe('Form config'),
  showSearch: z.boolean().optional().describe('Show search'),
  showFilters: z.boolean().optional().describe('Show filters'),
  showCreate: z.boolean().optional().describe('Show create button'),
  showRefresh: z.boolean().optional().describe('Show refresh button'),
  operations: z.object({
    create: z.boolean().optional(),
    read: z.boolean().optional(),
    update: z.boolean().optional(),
    delete: z.boolean().optional(),
  }).optional().describe('Enabled operations'),
});

/**
 * ListView Schema
 */
export const ListViewSchema = BaseSchema.extend({
  type: z.literal('list-view'),
  objectName: z.string().describe('Object Name'),
  viewType: z.enum(['grid', 'kanban', 'calendar', 'gantt', 'map', 'chart']).optional().describe('View Type'),
  fields: z.array(z.string()).optional().describe('Fields to fetch'),
  filters: z.array(z.union([z.array(z.any()), z.string()])).optional().describe('Filter conditions'),
  sort: z.array(SortConfigSchema).optional().describe('Sort order'),
  options: z.record(z.string(), z.any()).optional().describe('Component overrides'),
});

/**
 * ObjectMap Schema
 */
export const ObjectMapSchema = BaseSchema.extend({
  type: z.literal('object-map'),
  objectName: z.string().describe('ObjectQL object name'),
  locationField: z.string().optional().describe('Location field'),
  titleField: z.string().optional().describe('Title field'),
});

/**
 * ObjectGantt Schema
 */
export const ObjectGanttSchema = BaseSchema.extend({
  type: z.literal('object-gantt'),
  objectName: z.string().describe('ObjectQL object name'),
  startDateField: z.string().optional().describe('Start date field'),
  endDateField: z.string().optional().describe('End date field'),
  titleField: z.string().optional().describe('Title field'),
  dependencyField: z.string().optional().describe('Dependency field'),
  progressField: z.string().optional().describe('Progress field'),
});

/**
 * ObjectCalendar Schema
 */
export const ObjectCalendarSchema = BaseSchema.extend({
  type: z.literal('object-calendar'),
  objectName: z.string().describe('ObjectQL object name'),
  startDateField: z.string().optional().describe('Start date field'),
  endDateField: z.string().optional().describe('End date field'),
  titleField: z.string().optional().describe('Title field'),
  defaultView: z.enum(['month', 'week', 'day', 'agenda']).optional().describe('Default view'),
});

/**
 * ObjectKanban Schema
 */
export const ObjectKanbanSchema = BaseSchema.extend({
  type: z.literal('object-kanban'),
  objectName: z.string().describe('ObjectQL object name'),
  groupField: z.string().describe('Group field'),
  titleField: z.string().optional().describe('Title field'),
  cardFields: z.array(z.string()).optional().describe('Card fields'),
});

/**
 * ObjectChart Schema
 */
export const ObjectChartSchema = BaseSchema.extend({
  type: z.literal('object-chart'),
  objectName: z.string().describe('ObjectQL object name'),
  chartType: z.enum(['bar', 'line', 'pie', 'area', 'scatter']).describe('Chart type'),
  xAxisField: z.string().describe('X axis field'),
  yAxisFields: z.array(z.string()).optional().describe('Y axis fields'),
  aggregation: z.enum(['cardinality', 'sum', 'avg', 'min', 'max']).optional().describe('Aggregation'),
});

/**
 * ObjectQL Component Schema Union
 */
export const ObjectQLComponentSchema = z.union([
  ObjectGridSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ObjectMapSchema,
  ObjectGanttSchema,
  ObjectCalendarSchema,
  ObjectKanbanSchema,
  ObjectChartSchema,
  ListViewSchema,
]);
