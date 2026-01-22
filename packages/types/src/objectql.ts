/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - ObjectQL Component Schemas
 * 
 * Type definitions for ObjectQL-specific components.
 * These schemas enable building ObjectQL-aware interfaces directly from object metadata.
 * 
 * @module objectql
 * @packageDocumentation
 */

import type { BaseSchema } from './base';
import type { TableColumn } from './data-display';
import type { FormField } from './form';

/**
 * ObjectTable Schema
 * A specialized table component that automatically fetches and displays data from ObjectQL objects.
 * It reads the object schema from ObjectQL and generates columns automatically.
 */
export interface ObjectTableSchema extends BaseSchema {
  type: 'object-table';
  
  /**
   * ObjectQL object name (e.g., 'users', 'accounts', 'contacts')
   */
  objectName: string;
  
  /**
   * Optional title for the table
   */
  title?: string;
  
  /**
   * Optional description
   */
  description?: string;
  
  /**
   * Field names to display as columns
   * If not specified, uses all visible fields from object schema
   */
  fields?: string[];
  
  /**
   * Custom column configurations
   * Overrides auto-generated columns for specific fields
   */
  columns?: TableColumn[];
  
  /**
   * Inline data for static/demo tables
   * When provided, the table will use this data instead of fetching from a data source.
   * Useful for documentation examples and prototyping.
   */
  data?: any[];
  
  /**
   * Enable/disable built-in operations
   */
  operations?: {
    /**
     * Enable create operation
     * @default true
     */
    create?: boolean;
    
    /**
     * Enable read/view operation
     * @default true
     */
    read?: boolean;
    
    /**
     * Enable update operation
     * @default true
     */
    update?: boolean;
    
    /**
     * Enable delete operation
     * @default true
     */
    delete?: boolean;
    
    /**
     * Enable export operation
     * @default false
     */
    export?: boolean;
    
    /**
     * Enable import operation
     * @default false
     */
    import?: boolean;
  };
  
  /**
   * Default filters to apply
   */
  defaultFilters?: Record<string, any>;
  
  /**
   * Default sort configuration
   */
  defaultSort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  
  /**
   * Page size
   * @default 10
   */
  pageSize?: number;
  
  /**
   * Enable row selection
   * @default false
   */
  selectable?: boolean | 'single' | 'multiple';
  
  /**
   * Show search box
   * @default true
   */
  showSearch?: boolean;
  
  /**
   * Show filters
   * @default true
   */
  showFilters?: boolean;
  
  /**
   * Show pagination
   * @default true
   */
  showPagination?: boolean;
  
  /**
   * Custom row actions
   */
  rowActions?: string[];
  
  /**
   * Custom batch actions
   */
  batchActions?: string[];
  
  /**
   * Custom CSS class
   */
  className?: string;
}

/**
 * ObjectForm Schema
 * A smart form component that generates forms from ObjectQL object schemas.
 * It automatically creates form fields based on object metadata.
 */
export interface ObjectFormSchema extends BaseSchema {
  type: 'object-form';
  
  /**
   * ObjectQL object name (e.g., 'users', 'accounts', 'contacts')
   */
  objectName: string;
  
  /**
   * Form mode
   */
  mode: 'create' | 'edit' | 'view';
  
  /**
   * Record ID (required for edit/view modes)
   */
  recordId?: string | number;
  
  /**
   * Optional title for the form
   */
  title?: string;
  
  /**
   * Optional description
   */
  description?: string;
  
  /**
   * Field names to include in the form
   * If not specified, uses all editable fields from object schema
   */
  fields?: string[];
  
  /**
   * Custom field configurations
   * Overrides auto-generated fields for specific fields.
   * When used with inline field definitions (without dataSource), this becomes the primary field source.
   */
  customFields?: FormField[];
  
  /**
   * Inline initial data for demo/static forms
   * When provided along with customFields (or inline field definitions), the form can work without a data source.
   * Useful for documentation examples and prototyping.
   */
  initialData?: Record<string, any>;
  
  /**
   * Field groups for organized layout
   */
  groups?: Array<{
    title?: string;
    description?: string;
    fields: string[];
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  }>;
  
  /**
   * Form layout.
   *
   * Supported layouts:
   * - `vertical`   – label above field (default)
   * - `horizontal` – label and field in a row
   * - `inline`     – compact inline layout, typically used in toolbars
   * - `grid`       – **experimental** grid layout
   *
   * Note: As of the current implementation, the underlying form renderer does not yet
   * support a native `grid` layout and will internally treat `layout: "grid"` as
   * `layout: "vertical"`. This value is exposed in the schema for forward compatibility,
   * and behavior may change once grid support is implemented.
   *
   * @default 'vertical'
   */
  layout?: 'vertical' | 'horizontal' | 'inline' | 'grid';
  
  /**
   * Grid columns (for grid layout).
   *
   * Intended number of columns when using a `grid` layout. Current renderers that do
   * not implement true grid support may ignore this value and fall back to a vertical
   * layout. When grid layout is supported, this value should control how many form
   * fields are placed per row.
   *
   * @default 2
   */
  columns?: number;
  
  /**
   * Show submit button
   * @default true
   */
  showSubmit?: boolean;
  
  /**
   * Submit button text
   */
  submitText?: string;
  
  /**
   * Show cancel button
   * @default true
   */
  showCancel?: boolean;
  
  /**
   * Cancel button text
   */
  cancelText?: string;
  
  /**
   * Show reset button
   * @default false
   */
  showReset?: boolean;
  
  /**
   * Initial values (for create mode)
   */
  initialValues?: Record<string, any>;
  
  /**
   * Callback on successful submission
   */
  onSuccess?: (data: any) => void | Promise<void>;
  
  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
  
  /**
   * Callback on cancel
   */
  onCancel?: () => void;
  
  /**
   * Read-only mode
   * @default false
   */
  readOnly?: boolean;
  
  /**
   * Custom CSS class
   */
  className?: string;
}

/**
 * ObjectView Schema
 * A complete object management interface combining ObjectTable and ObjectForm.
 * Provides list view with search, filters, and integrated create/edit dialogs.
 */
export interface ObjectViewSchema extends BaseSchema {
  type: 'object-view';
  
  /**
   * ObjectQL object name (e.g., 'users', 'accounts', 'contacts')
   */
  objectName: string;
  
  /**
   * Optional title for the view
   */
  title?: string;
  
  /**
   * Optional description
   */
  description?: string;
  
  /**
   * Layout mode for create/edit operations
   * - drawer: Side drawer (default, recommended for forms)
   * - modal: Center modal dialog
   * - page: Navigate to separate page (requires onNavigate handler)
   * @default 'drawer'
   */
  layout?: 'drawer' | 'modal' | 'page';
  
  /**
   * Table configuration
   * Inherits from ObjectTableSchema
   */
  table?: Partial<Omit<ObjectTableSchema, 'type' | 'objectName'>>;
  
  /**
   * Form configuration
   * Inherits from ObjectFormSchema
   */
  form?: Partial<Omit<ObjectFormSchema, 'type' | 'objectName' | 'mode'>>;
  
  /**
   * Show search box
   * @default true
   */
  showSearch?: boolean;
  
  /**
   * Show filters
   * @default true
   */
  showFilters?: boolean;
  
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
   * Enable/disable built-in operations
   */
  operations?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  
  /**
   * Callback when navigating to detail page (page layout mode)
   */
  onNavigate?: (recordId: string | number, mode: 'view' | 'edit') => void;
  
  /**
   * Custom CSS class
   */
  className?: string;
}

/**
 * Union type of all ObjectQL component schemas
 */
export type ObjectQLComponentSchema =
  | ObjectTableSchema
  | ObjectFormSchema
  | ObjectViewSchema;
