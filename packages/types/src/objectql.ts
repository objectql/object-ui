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
 * Now aligned with @objectstack/spec view.zod schema for better interoperability.
 * 
 * @module objectql
 * @packageDocumentation
 */

import type { BaseSchema } from './base';
import type { TableColumn } from './data-display';
import type { FormField } from './form';

/**
 * HTTP Method for API requests
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * HTTP Request Configuration for API Provider
 * Aligned with @objectstack/spec HttpRequestSchema
 */
export interface HttpRequest {
  /** API endpoint URL */
  url: string;
  /** HTTP method (default: GET) */
  method?: HttpMethod;
  /** Custom HTTP headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, unknown>;
  /** Request body for POST/PUT/PATCH - supports JSON objects, strings, FormData, or Blob */
  body?: Record<string, unknown> | string | FormData | Blob;
}

/**
 * View Data Source Configuration
 * Aligned with @objectstack/spec ViewDataSchema
 * 
 * Supports three modes:
 * 1. 'object': Standard Protocol - Auto-connects to ObjectStack Metadata and Data APIs
 * 2. 'api': Custom API - Explicitly provided API URLs
 * 3. 'value': Static Data - Hardcoded data array
 */
export type ViewData =
  | {
      provider: 'object';
      /** Target object name */
      object: string;
    }
  | {
      provider: 'api';
      /** Configuration for fetching data */
      read?: HttpRequest;
      /** Configuration for submitting data (for forms/editable tables) */
      write?: HttpRequest;
    }
  | {
      provider: 'value';
      /** Static data array */
      items: unknown[];
    };

/**
 * List Column Configuration
 * Enhanced version aligned with @objectstack/spec ListColumnSchema
 */
export interface ListColumn {
  /** Field name (snake_case) */
  field: string;
  /** Display label override */
  label?: string;
  /** Column width in pixels */
  width?: number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Hide column by default */
  hidden?: boolean;
  /** Allow sorting by this column */
  sortable?: boolean;
  /** Allow resizing this column */
  resizable?: boolean;
  /** Allow text wrapping */
  wrap?: boolean;
  /** Renderer type override (e.g., "currency", "date") */
  type?: string;
}

/**
 * Selection Configuration
 * Aligned with @objectstack/spec SelectionConfigSchema
 */
export interface SelectionConfig {
  /** Selection mode */
  type?: 'none' | 'single' | 'multiple';
}

/**
 * Pagination Configuration
 * Aligned with @objectstack/spec PaginationConfigSchema
 */
export interface PaginationConfig {
  /** Number of records per page (default: 25) */
  pageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
}

/**
 * Kanban Configuration
 * Aligned with @objectstack/spec KanbanConfigSchema
 */
export interface KanbanConfig {
  /** Field to group columns by (usually status/select) */
  groupByField: string;
  /** Field to sum at top of column (e.g. amount) */
  summarizeField?: string;
  /** Fields to show on cards */
  columns: string[];
}

/**
 * Calendar Configuration
 * Aligned with @objectstack/spec CalendarConfigSchema
 */
export interface CalendarConfig {
  /** Start date field */
  startDateField: string;
  /** End date field */
  endDateField?: string;
  /** Title field */
  titleField: string;
  /** Color field */
  colorField?: string;
}

/**
 * Gantt Configuration
 * Aligned with @objectstack/spec GanttConfigSchema
 */
export interface GanttConfig {
  /** Start date field */
  startDateField: string;
  /** End date field */
  endDateField: string;
  /** Title field */
  titleField: string;
  /** Progress field (0-100) */
  progressField?: string;
  /** Dependencies field */
  dependenciesField?: string;
  /** Color field */
  colorField?: string;
}

/**
 * Sort Configuration
 */
export interface SortConfig {
  /** Field to sort by */
  field: string;
  /** Sort order */
  order: 'asc' | 'desc';
}

/**
 * ObjectGrid Schema
 * A specialized grid component that automatically fetches and displays data from ObjectQL objects.
 * Implements the grid view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Traditional table/grid with CRUD operations
 * - Search, filters, pagination
 * - Column resizing, sorting
 * - Row selection
 * - Inline editing support
 */
export interface ObjectGridSchema extends BaseSchema {
  type: 'object-grid';
  
  /**
   * Internal name for the view
   */
  name?: string;
  
  /**
   * Display label override
   */
  label?: string;
  
  /**
   * ObjectQL object name (e.g., 'users', 'accounts', 'contacts')
   * Used when data provider is 'object' or not specified
   */
  objectName: string;
  
  /**
   * Data Source Configuration
   * Aligned with @objectstack/spec ViewDataSchema
   * If not provided, defaults to { provider: 'object', object: objectName }
   */
  data?: ViewData;
  
  /**
   * Columns Configuration
   * Can be either:
   * - Array of field names (simple): ['name', 'email', 'status']
   * - Array of ListColumn objects (enhanced): [{ field: 'name', label: 'Full Name', width: 200 }]
   */
  columns?: string[] | ListColumn[];
  
  /**
   * Filter criteria (JSON Rules format)
   * Array-based filter configuration
   */
  filter?: any[];
  
  /**
   * Sort Configuration
   * Can be either:
   * - Legacy string format: "name desc"
   * - Array of sort configs: [{ field: 'name', order: 'desc' }]
   */
  sort?: string | SortConfig[];
  
  /**
   * Fields enabled for search
   * Defines which fields are searchable when using the search box
   */
  searchableFields?: string[];
  
  /**
   * Enable column resizing
   * Allows users to drag column borders to resize
   */
  resizable?: boolean;
  
  /**
   * Striped row styling
   * Alternating row background colors
   */
  striped?: boolean;
  
  /**
   * Show borders
   * Display borders around cells
   */
  bordered?: boolean;
  
  /**
   * Row Selection Configuration
   * Aligned with @objectstack/spec SelectionConfigSchema
   */
  selection?: SelectionConfig;
  
  /**
   * Pagination Configuration
   * Aligned with @objectstack/spec PaginationConfigSchema
   */
  pagination?: PaginationConfig;
  
  /**
   * Custom CSS class
   */
  className?: string;
  
  // ===== LEGACY FIELDS (for backward compatibility) =====
  // These fields are deprecated but maintained for backward compatibility
  // They will be mapped to the new structure internally
  
  /**
   * @deprecated Use columns instead
   * Legacy field names to display
   */
  fields?: string[];
  
  /**
   * @deprecated Use data with provider: 'value' instead
   * Legacy inline data support
   */
  staticData?: any[];
  
  /**
   * @deprecated Use selection.type instead
   * Legacy selection mode
   */
  selectable?: boolean | 'single' | 'multiple';
  
  /**
   * @deprecated Use pagination.pageSize instead
   * Legacy page size
   */
  pageSize?: number;
  
  /**
   * @deprecated Use searchableFields instead
   * Legacy search toggle
   */
  showSearch?: boolean;
  
  /**
   * @deprecated Use filter property instead
   * Legacy filters toggle
   */
  showFilters?: boolean;
  
  /**
   * @deprecated Use pagination config instead
   * Legacy pagination toggle
   */
  showPagination?: boolean;
  
  /**
   * @deprecated Use sort instead
   * Legacy sort configuration
   */
  defaultSort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  
  /**
   * @deprecated Use filter instead
   * Legacy default filters
   */
  defaultFilters?: Record<string, any>;
  
  /**
   * @deprecated Moved to top-level resizable
   * Legacy resizable columns flag
   */
  resizableColumns?: boolean;
  
  /**
   * @deprecated Use label instead
   * Legacy title field
   */
  title?: string;

  /**
   * @deprecated No direct replacement (consider using label with additional context)
   * Legacy description field
   */
  description?: string;
  
  /**
   * Enable/disable built-in operations
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
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
   * Custom row actions
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   */
  rowActions?: string[];
  
  /**
   * Custom batch actions
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   */
  batchActions?: string[];
  
  /**
   * Enable inline cell editing (Grid mode)
   * When true, cells become editable on double-click or Enter key
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   * @default false
   */
  editable?: boolean;
  
  /**
   * Enable keyboard navigation (Grid mode)
   * Arrow keys, Tab, Enter for cell navigation
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   * @default true when editable is true
   */
  keyboardNavigation?: boolean;
  
  /**
   * Number of columns to freeze (left-pin)
   * Useful for keeping certain columns visible while scrolling
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   * @default 0
   */
  frozenColumns?: number;
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
   * Table/Grid configuration
   * Inherits from ObjectGridSchema
   */
  table?: Partial<Omit<ObjectGridSchema, 'type' | 'objectName'>>;
  
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
 * Generic View Definition
 * Aligned with @objectstack/spec View/ListView
 * Defines the data requirement, not just the visual component.
 */
export interface ListViewSchema extends BaseSchema {
  type: 'list-view';
  
  /** Object Name */
  objectName: string;
  
  /** View Type (grid, kanban, etc) */
  viewType?: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';
  
  /** Fields to fetch/display */
  fields?: string[];
  
  /** Filter conditions */
  filters?: Array<any[] | string>; // placeholder for FilterCondition
  
  /** Sort order */
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  
  /** Visual Component overrides */
  options?: Record<string, any>;
}

/**
 * Object Map Component Schema
 */
export interface ObjectMapSchema extends BaseSchema {
  type: 'object-map';
  /** ObjectQL object name */
  objectName: string;
  /** Field containing location data (or lat/long pair) */
  locationField?: string;
  /** Field for marker title */
  titleField?: string;
}

/**
 * Object Gantt Component Schema
 */
export interface ObjectGanttSchema extends BaseSchema {
  type: 'object-gantt';
  /** ObjectQL object name */
  objectName: string;
  /** Field for task start date */
  startDateField?: string;
  /** Field for task end date */
  endDateField?: string;
  /** Field for task title/name */
  titleField?: string;
  /** Field for task dependencies */
  dependencyField?: string;
  /** Field for progress (0-100) */
  progressField?: string;
}

/**
 * Object Calendar Component Schema
 */
export interface ObjectCalendarSchema extends BaseSchema {
  type: 'object-calendar';
  /** ObjectQL object name */
  objectName: string;
  /** Field for event start */
  startDateField?: string;
  /** Field for event end */
  endDateField?: string;
  /** Field for event title */
  titleField?: string;
  /** Default view mode */
  defaultView?: 'month' | 'week' | 'day' | 'agenda';
}

/**
 * Object Kanban Component Schema
 */
export interface ObjectKanbanSchema extends BaseSchema {
  type: 'object-kanban';
  /** ObjectQL object name */
  objectName: string;
  /** Field to group columns by (e.g. status) */
  groupField: string;
  /** Field for card title */
  titleField?: string;
  /** Fields to display on card */
  cardFields?: string[];
}

/**
 * Object Chart Component Schema
 */
export interface ObjectChartSchema extends BaseSchema {
  type: 'object-chart';
  /** ObjectQL object name */
  objectName: string;
  /** Chart type */
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  /** Field for X axis (categories) */
  xAxisField: string;
  /** Fields for Y axis (values) */
  yAxisFields?: string[];
  /** Aggregation function */
  aggregation?: 'cardinality' | 'sum' | 'avg' | 'min' | 'max';
}

/**
 * Union type of all ObjectQL component schemas
 */
export type ObjectQLComponentSchema =
  | ObjectGridSchema
  | ObjectFormSchema
  | ObjectViewSchema
  | ObjectMapSchema
  | ObjectGanttSchema
  | ObjectCalendarSchema
  | ObjectKanbanSchema
  | ObjectChartSchema
  | ListViewSchema;
