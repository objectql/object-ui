/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - CRUD Component Zod Validators
 * 
 * Zod validation schemas for CRUD operations.
 * Following @objectstack/spec UI specification format.
 * 
 * Enhanced in Phase 2 with ajax, confirm, dialog actions, chaining, and conditional execution.
 * 
 * @module zod/crud
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod';

/**
 * Action Execution Mode Schema
 */
export const ActionExecutionModeSchema = z.enum(['sequential', 'parallel']).describe('Action execution mode for chaining');

/**
 * Action Callback Schema
 */
export const ActionCallbackSchema = z.object({
  type: z.enum(['toast', 'message', 'redirect', 'reload', 'custom', 'ajax', 'dialog']).describe('Callback type'),
  message: z.string().optional().describe('Message to display'),
  url: z.string().optional().describe('Redirect URL'),
  api: z.string().optional().describe('API endpoint for ajax callback'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('HTTP method for ajax callback'),
  dialog: SchemaNodeSchema.optional().describe('Dialog schema to open'),
  handler: z.string().optional().describe('Custom callback handler expression'),
});

/**
 * Action Condition Schema
 */
export const ActionConditionSchema: z.ZodType<any> = z.lazy(() => z.object({
  expression: z.string().describe('Condition expression'),
  then: z.union([ActionSchema, z.array(ActionSchema)]).optional().describe('Action to execute if condition is true'),
  else: z.union([ActionSchema, z.array(ActionSchema)]).optional().describe('Action to execute if condition is false'),
}));

/**
 * Action Schema - Enhanced with Phase 2 features
 */
export const ActionSchema: z.ZodType<any> = z.lazy(() => BaseSchema.extend({
  type: z.literal('action'),
  label: z.string().describe('Action label'),
  level: z.enum(['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'default']).optional().default('default').describe('Action type/level'),
  icon: z.string().optional().describe('Icon to display (lucide-react icon name)'),
  variant: z.enum(['default', 'outline', 'ghost', 'link']).optional().describe('Action variant'),
  disabled: z.boolean().optional().describe('Whether action is disabled'),
  actionType: z.enum(['button', 'link', 'dropdown', 'ajax', 'confirm', 'dialog']).optional().describe('Action type'),
  api: z.string().optional().describe('API endpoint to call (for ajax actions)'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().default('POST').describe('HTTP method'),
  data: z.any().optional().describe('Request body/data'),
  headers: z.record(z.string()).optional().describe('Request headers'),
  confirm: z.object({
    title: z.string().optional().describe('Confirmation title'),
    message: z.string().optional().describe('Confirmation message'),
    confirmText: z.string().optional().describe('Confirm button text'),
    cancelText: z.string().optional().describe('Cancel button text'),
    confirmVariant: z.enum(['default', 'destructive', 'outline', 'secondary', 'ghost']).optional().describe('Confirm button variant'),
  }).optional().describe('Confirmation dialog configuration (for confirm actions)'),
  confirmText: z.string().optional().describe('Legacy confirmation message (deprecated - use confirm object instead)'),
  dialog: z.object({
    title: z.string().optional().describe('Dialog title'),
    content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog content'),
    size: z.enum(['sm', 'default', 'lg', 'xl', 'full']).optional().describe('Dialog size'),
    actions: z.array(ActionSchema).optional().describe('Dialog actions'),
  }).optional().describe('Dialog configuration (for dialog actions)'),
  successMessage: z.string().optional().describe('Success message after execution'),
  errorMessage: z.string().optional().describe('Error message on failure'),
  onSuccess: ActionCallbackSchema.optional().describe('Success callback'),
  onFailure: ActionCallbackSchema.optional().describe('Failure callback'),
  chain: z.array(ActionSchema).optional().describe('Action chaining - actions to execute after this one'),
  chainMode: ActionExecutionModeSchema.optional().default('sequential').describe('Chain execution mode'),
  condition: ActionConditionSchema.optional().describe('Conditional execution'),
  reload: z.boolean().optional().default(true).describe('Whether to reload data after action'),
  close: z.boolean().optional().default(true).describe('Whether to close dialog/modal after action'),
  onClick: z.any().optional().describe('Custom click handler'),
  redirect: z.string().optional().describe('Redirect URL after success'),
  tracking: z.object({
    enabled: z.boolean().optional().describe('Enable tracking'),
    event: z.string().optional().describe('Event name'),
    metadata: z.record(z.any()).optional().describe('Additional metadata'),
  }).optional().describe('Action logging/tracking'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
  retry: z.object({
    maxAttempts: z.number().optional().describe('Maximum retry attempts'),
    delay: z.number().optional().describe('Delay between retries (in ms)'),
  }).optional().describe('Retry configuration'),
}));

/**
 * CRUD Operation Schema
 */
export const CRUDOperationSchema = z.object({
  type: z.enum(['create', 'read', 'update', 'delete', 'export', 'import', 'custom']).describe('Operation type'),
  label: z.string().optional().describe('Operation label'),
  icon: z.string().optional().describe('Operation icon'),
  enabled: z.boolean().optional().default(true).describe('Whether operation is enabled'),
  api: z.string().optional().describe('API endpoint for this operation'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('HTTP method'),
  confirmText: z.string().optional().describe('Confirmation message'),
  successMessage: z.string().optional().describe('Success message'),
  visibleOn: z.string().optional().describe('Visibility condition'),
  disabledOn: z.string().optional().describe('Disabled condition'),
});

/**
 * CRUD Filter Schema
 */
export const CRUDFilterSchema = z.object({
  name: z.string().describe('Filter name (field name)'),
  label: z.string().optional().describe('Filter label'),
  type: z.enum(['input', 'select', 'date-picker', 'date-range', 'number-range']).optional().describe('Filter type'),
  operator: z.enum(['equals', 'contains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'between', 'in']).optional().default('equals').describe('Filter operator'),
  options: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })).optional().describe('Options for select filter'),
  placeholder: z.string().optional().describe('Placeholder text'),
  defaultValue: z.any().optional().describe('Default value'),
});

/**
 * CRUD Toolbar Schema
 */
export const CRUDToolbarSchema = z.object({
  showCreate: z.boolean().optional().default(true).describe('Show create button'),
  showRefresh: z.boolean().optional().default(true).describe('Show refresh button'),
  showExport: z.boolean().optional().default(false).describe('Show export button'),
  showImport: z.boolean().optional().default(false).describe('Show import button'),
  showFilter: z.boolean().optional().default(true).describe('Show filter toggle'),
  showSearch: z.boolean().optional().default(true).describe('Show search box'),
  actions: z.array(ActionSchema).optional().describe('Custom actions'),
});

/**
 * CRUD Pagination Schema
 */
export const CRUDPaginationSchema = z.object({
  enabled: z.boolean().optional().default(true).describe('Whether pagination is enabled'),
  pageSize: z.number().optional().default(10).describe('Default page size'),
  pageSizeOptions: z.array(z.number()).optional().default([10, 20, 50, 100]).describe('Page size options'),
  showTotal: z.boolean().optional().default(true).describe('Show total count'),
  showSizeChanger: z.boolean().optional().default(true).describe('Show page size selector'),
});

/**
 * CRUD Schema
 */
export const CRUDSchema = BaseSchema.extend({
  type: z.literal('crud'),
  title: z.string().optional().describe('CRUD title'),
  resource: z.string().optional().describe('Resource name (singular)'),
  api: z.string().optional().describe('API endpoint for list/search'),
  columns: z.array(z.any()).describe('Table columns configuration'),
  fields: z.array(z.any()).optional().describe('Form fields for create/edit'),
  operations: z.record(z.union([z.boolean(), CRUDOperationSchema])).optional().describe('Enabled operations'),
  toolbar: CRUDToolbarSchema.optional().describe('Toolbar configuration'),
  filters: z.array(CRUDFilterSchema).optional().describe('Filter configuration'),
  pagination: CRUDPaginationSchema.optional().describe('Pagination configuration'),
  defaultSort: z.string().optional().describe('Default sort field'),
  defaultSortOrder: z.enum(['asc', 'desc']).optional().default('asc').describe('Default sort order'),
  selectable: z.union([z.boolean(), z.enum(['single', 'multiple'])]).optional().describe('Row selection mode'),
  batchActions: z.array(ActionSchema).optional().describe('Batch actions for selected rows'),
  rowActions: z.array(ActionSchema).optional().describe('Row actions (displayed in each row)'),
  emptyState: SchemaNodeSchema.optional().describe('Custom empty state'),
  loading: z.boolean().optional().default(true).describe('Whether to show loading state'),
  loadingComponent: SchemaNodeSchema.optional().describe('Custom loading component'),
  mode: z.enum(['table', 'grid', 'list', 'kanban']).optional().default('table').describe('Table layout mode'),
  gridColumns: z.number().optional().default(3).describe('Grid columns (for grid mode)'),
  cardTemplate: SchemaNodeSchema.optional().describe('Card template (for grid/list mode)'),
  kanbanColumns: z.array(z.object({
    id: z.string(),
    title: z.string(),
    color: z.string().optional(),
  })).optional().describe('Kanban columns (for kanban mode)'),
  kanbanGroupField: z.string().optional().describe('Kanban group field'),
});

/**
 * Detail Schema
 */
export const DetailSchema = BaseSchema.extend({
  type: z.literal('detail'),
  title: z.string().optional().describe('Detail title'),
  api: z.string().optional().describe('API endpoint to fetch detail data'),
  resourceId: z.union([z.string(), z.number()]).optional().describe('Resource ID to display'),
  groups: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(z.object({
      name: z.string(),
      label: z.string().optional(),
      type: z.enum(['text', 'image', 'link', 'badge', 'date', 'datetime', 'json', 'html', 'custom']).optional(),
      format: z.string().optional(),
      render: SchemaNodeSchema.optional(),
    })),
  })).optional().describe('Field groups for organized display'),
  actions: z.array(ActionSchema).optional().describe('Actions available in detail view'),
  tabs: z.array(z.object({
    key: z.string(),
    label: z.string(),
    content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]),
  })).optional().describe('Tabs for additional content'),
  showBack: z.boolean().optional().default(true).describe('Show back button'),
  onBack: z.any().optional().describe('Custom back action'),
  loading: z.boolean().optional().default(true).describe('Whether to show loading state'),
});

/**
 * CRUD Dialog Schema
 */
export const CRUDDialogSchema = BaseSchema.extend({
  type: z.literal('crud-dialog'),
  title: z.string().optional().describe('Dialog title'),
  description: z.string().optional().describe('Dialog description'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog content'),
  size: z.enum(['sm', 'default', 'lg', 'xl', 'full']).optional().default('default').describe('Dialog size'),
  actions: z.array(ActionSchema).optional().describe('Dialog actions/buttons'),
  open: z.boolean().optional().describe('Whether dialog is open'),
  onClose: z.any().optional().describe('Close handler'),
  closeOnOutsideClick: z.boolean().optional().default(true).describe('Whether clicking outside closes dialog'),
  closeOnEscape: z.boolean().optional().default(true).describe('Whether pressing Escape closes dialog'),
  showClose: z.boolean().optional().default(true).describe('Show close button'),
});

/**
 * Union of all CRUD schemas
 */
export const CRUDComponentSchema = z.union([
  ActionSchema,
  CRUDSchema,
  DetailSchema,
  CRUDDialogSchema,
]);

/**
 * Export type inference helpers
 */
export type ActionExecutionModeSchemaType = z.infer<typeof ActionExecutionModeSchema>;
export type ActionCallbackSchemaType = z.infer<typeof ActionCallbackSchema>;
export type ActionConditionSchemaType = z.infer<typeof ActionConditionSchema>;
export type ActionSchemaType = z.infer<typeof ActionSchema>;
export type CRUDOperationSchemaType = z.infer<typeof CRUDOperationSchema>;
export type CRUDFilterSchemaType = z.infer<typeof CRUDFilterSchema>;
export type CRUDToolbarSchemaType = z.infer<typeof CRUDToolbarSchema>;
export type CRUDPaginationSchemaType = z.infer<typeof CRUDPaginationSchema>;
export type CRUDSchemaType = z.infer<typeof CRUDSchema>;
export type DetailSchemaType = z.infer<typeof DetailSchema>;
export type CRUDDialogSchemaType = z.infer<typeof CRUDDialogSchema>;
