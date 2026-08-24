/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - CRUD Component Schemas
 * 
 * Type definitions for Create, Read, Update, Delete operations.
 * These schemas enable building complete data management interfaces.
 * 
 * @module crud
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base.js';
import type { FormField } from './form.js';
import type { TableColumn } from './data-display.js';

/**
 * Action execution mode for chaining
 */
export type ActionExecutionMode = 'sequential' | 'parallel';

/**
 * Action callback configuration
 */
export interface ActionCallback {
  /**
   * Callback type
   */
  type: 'toast' | 'message' | 'redirect' | 'reload' | 'custom' | 'ajax' | 'dialog';
  /**
   * Message to display
   */
  message?: string;
  /**
   * Redirect URL
   */
  url?: string;
  /**
   * API endpoint for ajax callback
   */
  api?: string;
  /**
   * HTTP method for ajax callback
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /**
   * Dialog schema to open
   */
  dialog?: SchemaNode;
  /**
   * Custom callback handler expression
   */
  handler?: string;
}

/**
 * Action button configuration for CRUD operations
 * Enhanced with Phase 2 features: ajax, confirm, dialog, chaining, conditional execution
 *
 * @deprecated Use `UIActionSchema` from `@object-ui/types` (re-exported from `ui-action.ts`) for new code.
 * This legacy interface will be removed in a future major version.
 */
export interface ActionSchema extends BaseSchema {
  type: 'action';
  /**
   * Action label
   */
  label: string;
  /**
   * Action type/level
   * @default 'default'
   */
  level?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'default';
  /**
   * Icon to display (lucide-react icon name)
   */
  icon?: string;
  /**
   * Action variant
   */
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  /**
   * Whether action is disabled
   */
  disabled?: boolean;
  /**
   * Action type
   * Enhanced in Phase 2 with 'ajax', 'confirm', 'dialog'
   */
  actionType?: 'button' | 'link' | 'dropdown' | 'ajax' | 'confirm' | 'dialog';
  /**
   * API endpoint to call (for ajax actions)
   */
  api?: string;
  /**
   * HTTP method
   * @default 'POST'
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /**
   * Request body/data
   */
  data?: any;
  /**
   * Request headers
   */
  headers?: Record<string, string>;
  /**
   * RETIRED (objectui#4314, maintainer ruling 2026-08-17, ADR-0049
   * enforce-or-remove): the structured confirm object
   * (`{ title, message, confirmText, cancelText, confirmVariant }`) had zero
   * producers, and in `ActionRunner` its `message` OUTRANKED `confirmText` —
   * the only spelling the translation bundle knows
   * (`{ns}.objects.{obj}._actions.{name}.confirmText`) — so a dialog authored
   * this way silently lost localization. `?: never` is this package's
   * tombstone convention (see `complex.ts` `DashboardWidgetSchema`): authoring
   * the key is a tsc error here and a parse rejection in the Zod twin
   * (`zod/crud.zod.ts`); reading it still type-checks (`never | undefined`)
   * during migration. Reopen condition, recorded on objectui#4314: real demand
   * for structured confirm dialogs — the arm returns WITH its bundle keys
   * (`_actions.{name}.confirm.*`) designed in, never before.
   * @deprecated Retired — author `confirmText` instead.
   */
  confirm?: never;
  /**
   * Confirmation message — shows a confirm dialog before executing.
   * The ONE confirm spelling: `@objectstack/spec`'s action surface and the
   * TranslationBundle both stand on `confirmText`.
   */
  confirmText?: string;
  /**
   * Dialog configuration (for dialog actions)
   */
  dialog?: {
    /**
     * Dialog title
     */
    title?: string;
    /**
     * Dialog content
     */
    content?: SchemaNode | SchemaNode[];
    /**
     * Dialog size
     */
    size?: 'sm' | 'default' | 'lg' | 'xl' | 'full';
    /**
     * Dialog actions
     */
    actions?: ActionSchema[];
  };
  /**
   * Success message after execution
   */
  successMessage?: string;
  /**
   * Error message on failure
   */
  errorMessage?: string;
  /**
   * Success callback (Phase 2)
   */
  onSuccess?: ActionCallback;
  /**
   * Failure callback (Phase 2)
   */
  onFailure?: ActionCallback;
  /**
   * Action chaining - actions to execute after this one (Phase 2)
   */
  chain?: ActionSchema[];
  /**
   * Chain execution mode
   * @default 'sequential'
   */
  chainMode?: ActionExecutionMode;
  /**
   * Execution gate — the action runs only while this predicate holds.
   *
   * A boolean, a bare CEL string, a `${…}` template, or the normalized
   * `{ dialect, source }` envelope `objectstack build` emits. Declared and
   * FALSE skips the action; not declared at all executes it. Same three arms
   * `ActionRunner`'s own `ActionDef.condition` carries (`@object-ui/core`),
   * because this is the authoring twin of that gate.
   *
   * RETIRED (objectui#3917): this key used to be typed `ActionCondition`, an
   * `{ expression, then, else }` branch DSL. NOTHING in the repo ever read
   * `expression` / `then` / `else` — `ActionRunner` reads this key as the
   * predicate above, and an object with no `source` normalizes to "no gate
   * declared", so an author who followed the docs ("amounts over 1000 go to
   * manager approval") got UNCONDITIONAL execution with zero diagnostics.
   * Retired under enforce-or-remove rather than honoured, so one key has one
   * reading. Conditional BRANCHING is expressed as separate actions, each
   * carrying its own `condition`.
   */
  condition?: boolean | string | { dialect?: string; source: string };
  /**
   * Whether to reload data after action
   * @default true
   */
  reload?: boolean;
  /**
   * Whether to close dialog/modal after action
   * @default true
   */
  close?: boolean;
  /**
   * Custom click handler
   */
  onClick?: () => void | Promise<void>;
  /**
   * Redirect URL after success
   */
  redirect?: string;
  /**
   * Action logging/tracking (Phase 2)
   */
  tracking?: {
    /**
     * Enable tracking
     */
    enabled?: boolean;
    /**
     * Event name
     */
    event?: string;
    /**
     * Additional metadata
     */
    metadata?: Record<string, any>;
  };
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Maximum retry attempts
     */
    maxAttempts?: number;
    /**
     * Delay between retries (in ms)
     */
    delay?: number;
  };
}

/**
 * CRUD operation configuration
 */
export interface CRUDOperation {
  /**
   * Operation type
   */
  type: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import' | 'custom';
  /**
   * Operation label
   */
  label?: string;
  /**
   * Operation icon
   */
  icon?: string;
  /**
   * Whether operation is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * API endpoint for this operation
   */
  api?: string;
  /**
   * HTTP method
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /**
   * Confirmation message
   */
  confirmText?: string;
  /**
   * Success message
   */
  successMessage?: string;
  /**
   * Visibility condition
   */
  visibleOn?: string;
  /**
   * Disabled condition
   */
  disabledOn?: string;
}

/**
 * Filter configuration for CRUD components
 */
export interface CRUDFilter {
  /**
   * Filter name (field name)
   */
  name: string;
  /**
   * Filter label
   */
  label?: string;
  /**
   * Filter type
   */
  type?: 'input' | 'select' | 'date-picker' | 'date-range' | 'number-range';
  /**
   * Filter operator
   * @default 'equals'
   */
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in';
  /**
   * Options for select filter
   */
  options?: Array<{ label: string; value: string | number }>;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Default value
   */
  defaultValue?: any;
}

/**
 * Toolbar configuration for CRUD components
 */
export interface CRUDToolbar {
  /**
   * Show create button
   * @default true
   */
  showCreate?: boolean;
  /**
   * Show refresh button
   * @default true
   */
  showRefresh?: boolean;
  /**
   * Show export button
   * @default false
   */
  showExport?: boolean;
  /**
   * Show import button
   * @default false
   */
  showImport?: boolean;
  /**
   * Show filter toggle
   * @default true
   */
  showFilter?: boolean;
  /**
   * Show search box
   * @default true
   */
  showSearch?: boolean;
  /**
   * Custom actions
   */
  actions?: ActionSchema[];
}

/**
 * CRUD pagination configuration
 */
export interface CRUDPagination {
  /**
   * Whether pagination is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * Default page size
   * @default 10
   */
  pageSize?: number;
  /**
   * Page size options
   * @default [10, 20, 50, 100]
   */
  pageSizeOptions?: number[];
  /**
   * Show total count
   * @default true
   */
  showTotal?: boolean;
  /**
   * Show page size selector
   * @default true
   */
  showSizeChanger?: boolean;
}

/**
 * Complete CRUD component
 * Provides full Create, Read, Update, Delete functionality
 */
export interface CRUDSchema extends BaseSchema {
  type: 'crud';
  /**
   * CRUD title
   */
  title?: string;
  /**
   * Resource name (singular)
   * @example 'user', 'product', 'order'
   */
  resource?: string;
  /**
   * API endpoint for list/search
   */
  api?: string;
  /**
   * Table columns configuration
   */
  columns: TableColumn[];
  /**
   * Form fields for create/edit
   */
  fields?: FormField[];
  /**
   * Enabled operations
   */
  operations?: {
    create?: boolean | CRUDOperation;
    read?: boolean | CRUDOperation;
    update?: boolean | CRUDOperation;
    delete?: boolean | CRUDOperation;
    export?: boolean | CRUDOperation;
    import?: boolean | CRUDOperation;
    [key: string]: boolean | CRUDOperation | undefined;
  };
  /**
   * Toolbar configuration
   */
  toolbar?: CRUDToolbar;
  /**
   * Filter configuration
   */
  filters?: CRUDFilter[];
  /**
   * Pagination configuration
   */
  pagination?: CRUDPagination;
  /**
   * Default sort field
   */
  defaultSort?: string;
  /**
   * Default sort order
   * @default 'asc'
   */
  defaultSortOrder?: 'asc' | 'desc';
  /**
   * Row selection mode
   */
  selectable?: boolean | 'single' | 'multiple';
  /**
   * Batch actions for selected rows
   */
  batchActions?: ActionSchema[];
  /**
   * Row actions (displayed in each row)
   */
  rowActions?: ActionSchema[];
  /**
   * Custom empty state
   */
  emptyState?: SchemaNode;
  /**
   * Whether to show loading state
   * @default true
   */
  loading?: boolean;
  /**
   * Custom loading component
   */
  loadingComponent?: SchemaNode;
  /**
   * Table layout mode
   * @default 'table'
   */
  mode?: 'table' | 'grid' | 'list' | 'kanban';
  /**
   * Grid columns (for grid mode)
   * @default 3
   */
  gridColumns?: number;
  /**
   * Card template (for grid/list mode)
   */
  cardTemplate?: SchemaNode;
  /**
   * Kanban columns (for kanban mode)
   */
  kanbanColumns?: Array<{
    id: string;
    title: string;
    color?: string;
  }>;
  /**
   * Kanban group field
   */
  kanbanGroupField?: string;
}

/**
 * Detail view component
 * Displays detailed information about a single record
 */
export interface DetailSchema extends BaseSchema {
  type: 'detail';
  /**
   * Detail title
   */
  title?: string;
  /**
   * API endpoint to fetch detail data
   */
  api?: string;
  /**
   * Resource ID to display
   */
  resourceId?: string | number;
  /**
   * Field groups for organized display
   */
  groups?: Array<{
    title?: string;
    description?: string;
    fields: Array<{
      name: string;
      label?: string;
      type?: 'text' | 'image' | 'link' | 'badge' | 'date' | 'datetime' | 'json' | 'html' | 'custom';
      format?: string;
      render?: SchemaNode;
    }>;
  }>;
  /**
   * Actions available in detail view
   */
  actions?: ActionSchema[];
  /**
   * Tabs for additional content
   */
  tabs?: Array<{
    key: string;
    label: string;
    content: SchemaNode | SchemaNode[];
  }>;
  /**
   * Show back button
   * @default true
   */
  showBack?: boolean;
  /**
   * Custom back action
   */
  onBack?: () => void;
  /**
   * Whether to show loading state
   * @default true
   */
  loading?: boolean;
}

/**
 * CRUD Dialog/Modal component for CRUD operations
 * Note: For general dialog usage, use DialogSchema from overlay module
 */
export interface CRUDDialogSchema extends BaseSchema {
  type: 'crud-dialog';
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
   * Dialog size
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg' | 'xl' | 'full';
  /**
   * Dialog actions/buttons
   */
  actions?: ActionSchema[];
  /**
   * Whether dialog is open
   */
  open?: boolean;
  /**
   * Close handler
   */
  onClose?: () => void;
  /**
   * Whether clicking outside closes dialog
   * @default true
   */
  closeOnOutsideClick?: boolean;
  /**
   * Whether pressing Escape closes dialog
   * @default true
   */
  closeOnEscape?: boolean;
  /**
   * Show close button
   * @default true
   */
  showClose?: boolean;
}

/**
 * Union type of all CRUD schemas
 */
export type CRUDComponentSchema =
  | ActionSchema
  | CRUDSchema
  | DetailSchema
  | CRUDDialogSchema;
