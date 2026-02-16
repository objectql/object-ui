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

// ============================================================================
// Spec-Canonical Types — imported from @objectstack/spec/ui
// Rule: "Never Redefine Types. ALWAYS import them."
// ============================================================================

/**
 * HTTP Method for API requests
 * Canonical definition from @objectstack/spec/ui.
 */
export type { HttpMethod } from '@objectstack/spec/ui';

/**
 * HTTP Request Configuration for API Provider
 * Canonical definition from @objectstack/spec/ui.
 */
export type { HttpRequest } from '@objectstack/spec/ui';

/**
 * View Data Source Configuration
 * Canonical definition from @objectstack/spec/ui.
 *
 * Supports three modes:
 * 1. 'object': Standard Protocol - Auto-connects to ObjectStack Metadata and Data APIs
 * 2. 'api': Custom API - Explicitly provided API URLs
 * 3. 'value': Static Data - Hardcoded data array
 */
export type { ViewData } from '@objectstack/spec/ui';

/**
 * List Column Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { ListColumn } from '@objectstack/spec/ui';

/**
 * Selection Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { SelectionConfig } from '@objectstack/spec/ui';

/**
 * Pagination Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { PaginationConfig } from '@objectstack/spec/ui';

// Import spec types for local use in interfaces below
import type {
  HttpMethod,
  HttpRequest,
  ViewData,
  ListColumn,
  SelectionConfig,
  PaginationConfig,
  GroupingConfig,
  RowColorConfig,
} from '@objectstack/spec/ui';

/**
 * Kanban Configuration
 * Canonical definition from @objectstack/spec/ui (KanbanConfigSchema).
 */
export type KanbanConfig = {
  /** Field to group columns by (usually status/select) */
  groupByField: string;
  /** Field to sum at top of column (e.g. amount) */
  summarizeField?: string;
  /** Fields to show on cards */
  columns: string[];
};

/**
 * Calendar Configuration
 * Canonical definition from @objectstack/spec/ui (CalendarConfigSchema).
 */
export type CalendarConfig = {
  /** Start date field */
  startDateField: string;
  /** End date field */
  endDateField?: string;
  /** Title field */
  titleField: string;
  /** Color field */
  colorField?: string;
};

/**
 * Gantt Configuration
 * Canonical definition from @objectstack/spec/ui (GanttConfigSchema).
 */
export type GanttConfig = {
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
};

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
   * Enable column reordering
   * Allows users to drag columns to reorder
   */
  reorderableColumns?: boolean;
  
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
   * Grouping Configuration (Airtable-style)
   * Groups rows by specified fields with collapsible sections.
   * Aligned with @objectstack/spec GroupingConfigSchema.
   */
  grouping?: GroupingConfig;

  /**
   * Row Color Configuration (Airtable-style)
   * Colors rows based on field values.
   * Aligned with @objectstack/spec RowColorConfigSchema.
   */
  rowColor?: RowColorConfig;

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

  /**
   * Row height preset for the grid
   * Controls the density of grid rows
   * @default 'medium'
   */
  rowHeight?: 'compact' | 'medium' | 'tall';

  /**
   * Export options configuration for exporting grid data.
   * Supports csv, xlsx, json, and pdf formats.
   * Aligned with @objectstack/spec ListViewSchema.exportOptions.
   */
  exportOptions?: {
    /** Formats available for export */
    formats?: Array<'csv' | 'xlsx' | 'json' | 'pdf'>;
    /** Maximum number of records to export (0 = unlimited) */
    maxRecords?: number;
    /** Include column headers in export */
    includeHeaders?: boolean;
    /** Custom file name prefix */
    fileNamePrefix?: string;
  };

  /**
   * Navigation configuration for row click behavior.
   * Controls how record detail is displayed when a row is clicked.
   * Aligned with @objectstack/spec ListView.navigation.
   */
  navigation?: ViewNavigationConfig;

  /**
   * Callback for page-level navigation (used by 'page' mode).
   * Called with recordId and action ('view' | 'edit').
   */
  onNavigate?: (recordId: string | number, action?: string) => void;
}

/**
 * Form Section Configuration
 * Aligns with @objectstack/spec FormSection
 */
export interface ObjectFormSection {
  /**
   * Section identifier
   */
  name?: string;
  
  /**
   * Section label
   */
  label?: string;
  
  /**
   * Section description
   */
  description?: string;
  
  /**
   * Whether the section can be collapsed
   * @default false
   */
  collapsible?: boolean;
  
  /**
   * Whether the section is initially collapsed
   * @default false
   */
  collapsed?: boolean;
  
  /**
   * Number of columns for field layout
   * @default 1
   */
  columns?: 1 | 2 | 3 | 4;
  
  /**
   * Field names or inline field configurations for this section
   */
  fields: (string | FormField)[];
}

/**
 * ObjectForm Schema
 * A smart form component that generates forms from ObjectQL object schemas.
 * It automatically creates form fields based on object metadata.
 * 
 * Supports multiple form variants aligned with @objectstack/spec FormView:
 * - `simple`  – Flat field list (default)
 * - `tabbed`  – Fields organized in tabs
 * - `wizard`  – Multi-step form with navigation
 * - `split`   – Side-by-side panels (reserved)
 * - `drawer`  – Slide-out form panel (reserved)
 * - `modal`   – Dialog-based form (reserved)
 */
export interface ObjectFormSchema extends BaseSchema {
  type: 'object-form';
  
  /**
   * Form variant type.
   * Aligns with @objectstack/spec FormView.type
   * 
   * - `simple`  – Standard flat form (default)
   * - `tabbed`  – Sections as tabs
   * - `wizard`  – Multi-step wizard with progress indicator
   * - `split`   – Side-by-side panel layout (reserved)
   * - `drawer`  – Slide-out form (reserved)
   * - `modal`   – Dialog form (reserved)
   *
   * @default 'simple'
   */
  formType?: 'simple' | 'tabbed' | 'wizard' | 'split' | 'drawer' | 'modal';
  
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
   * Form sections for organized layout.
   * Used by tabbed/wizard/simple forms to group fields.
   * Aligns with @objectstack/spec FormView.sections
   */
  sections?: ObjectFormSection[];
  
  /**
   * Field groups for organized layout (legacy, prefer sections)
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
   * @default 'vertical'
   */
  layout?: 'vertical' | 'horizontal' | 'inline' | 'grid';
  
  /**
   * Grid columns (for grid layout).
   * @default 2
   */
  columns?: number;
  
  /**
   * Default active tab (section name). Only used when formType is 'tabbed'.
   */
  defaultTab?: string;
  
  /**
   * Tab position. Only used when formType is 'tabbed'.
   * @default 'top'
   */
  tabPosition?: 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * Allow skipping steps. Only used when formType is 'wizard'.
   * @default false
   */
  allowSkip?: boolean;
  
  /**
   * Show step indicator. Only used when formType is 'wizard'.
   * @default true
   */
  showStepIndicator?: boolean;
  
  /**
   * Text for Next button. Only used when formType is 'wizard'.
   * @default 'Next'
   */
  nextText?: string;
  
  /**
   * Text for Previous button. Only used when formType is 'wizard'.
   * @default 'Back'
   */
  prevText?: string;
  
  /**
   * Called when wizard step changes. Only used when formType is 'wizard'.
   */
  onStepChange?: (step: number) => void;
  
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

  // ─── Split Form Props ──────────────────────────────────
  
  /**
   * Split panel direction. Only used when formType is 'split'.
   * @default 'horizontal'
   */
  splitDirection?: 'horizontal' | 'vertical';
  
  /**
   * Size of the left/top panel in the split layout (percentage 1-99).
   * Only used when formType is 'split'.
   * @default 50
   */
  splitSize?: number;
  
  /**
   * Whether the split panels can be resized. Only used when formType is 'split'.
   * @default true
   */
  splitResizable?: boolean;

  // ─── Drawer Form Props ─────────────────────────────────
  
  /**
   * Whether the drawer is open. Only used when formType is 'drawer'.
   * @default true
   */
  open?: boolean;
  
  /**
   * Callback when open state changes. Only used when formType is 'drawer'.
   */
  onOpenChange?: (open: boolean) => void;
  
  /**
   * Drawer slide-in side. Only used when formType is 'drawer'.
   * @default 'right'
   */
  drawerSide?: 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * Drawer width (CSS value). Only used when formType is 'drawer'.
   * @default '50%'
   */
  drawerWidth?: string;

  // ─── Modal Form Props ──────────────────────────────────
  
  /**
   * Modal dialog size. Only used when formType is 'modal'.
   * @default 'default'
   */
  modalSize?: 'sm' | 'default' | 'lg' | 'xl' | 'full';
  
  /**
   * Whether to show a close button in the modal header. Only used when formType is 'modal'.
   * @default true
   */
  modalCloseButton?: boolean;
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
   * Default list view type
   * @default 'grid'
   */
  defaultViewType?: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';
  
  /**
   * Named list views (e.g., "All Records", "My Records", "Active").
   * Aligned with @objectstack/spec View.listViews.
   */
  listViews?: Record<string, NamedListView>;
  
  /**
   * Default named list view to display
   */
  defaultListView?: string;
  
  /**
   * Navigation config for row/item click behavior.
   * Aligned with @objectstack/spec ListView.navigation.
   */
  navigation?: ViewNavigationConfig;
  
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
   * Fields that support text search
   */
  searchableFields?: string[];
  
  /**
   * Fields available for the filter UI
   */
  filterableFields?: string[];
  
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
   * Show view switcher (for multi-view)
   * When false (default), view type is fixed at creation in ViewDesigner
   * @default false
   */
  showViewSwitcher?: boolean;
  
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
 * Named List View Definition
 * Used in ObjectViewSchema.listViews for named views (e.g., "All", "My Records").
 */
export interface NamedListView {
  /** View display label */
  label: string;
  
  /** View type (grid, kanban, etc.) */
  type?: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';
  
  /** Columns/fields to display */
  columns?: string[];
  
  /** Filter conditions */
  filter?: any[];
  
  /** Sort configuration */
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  
  /** Type-specific options (kanban groupField, calendar startDateField, etc.) */
  options?: Record<string, any>;
}

/**
 * Navigation configuration for row/item click behavior.
 * Aligned with @objectstack/spec ListView.navigation.
 */
export interface ViewNavigationConfig {
  /**
   * How to open the target view on interaction
   * - page: Full page navigation
   * - drawer: Slide-out panel
   * - modal: Dialog overlay
   * - split: Side-by-side panel
   * - popover: Hover/click preview card
   * - new_window: Open in new browser tab
   * - none: No navigation on click
   * @default 'page'
   */
  mode: 'page' | 'drawer' | 'modal' | 'split' | 'popover' | 'new_window' | 'none';
  
  /** Target view/form config name */
  view?: string;
  
  /** Prevent default navigation behavior */
  preventNavigation?: boolean;
  
  /** Open in new tab (for page/new_window modes) */
  openNewTab?: boolean;
  
  /** Width for drawer/modal/split modes (e.g., '600px', '50%') */
  width?: string | number;
}

/**
 * Generic View Definition
 * Aligned with @objectstack/spec View/ListView.
 * Defines the data requirement, not just the visual component.
 */
export interface ListViewSchema extends BaseSchema {
  type: 'list-view';
  
  /** View name identifier */
  name?: string;
  
  /** View display label */
  label?: string;
  
  /** Object Name */
  objectName: string;
  
  /** View Type (grid, kanban, etc.) @default 'grid' */
  viewType?: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';
  
  /** Columns definition (string field names or full column config) */
  columns?: string[] | Array<{
    field: string;
    label?: string;
    width?: number | string;
    align?: 'left' | 'center' | 'right';
    hidden?: boolean;
    sortable?: boolean;
    resizable?: boolean;
    wrap?: boolean;
    type?: string;
    link?: boolean;
    action?: string;
  }>;
  
  /** Fields to fetch/display (alias for simple string[] columns) */
  fields?: string[];
  
  /** Filter conditions */
  filters?: Array<any[] | string>;
  
  /** Sort order */
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  
  /** Fields that support text search */
  searchableFields?: string[];
  
  /** Fields available for filter UI */
  filterableFields?: string[];
  
  /** Row selection mode */
  selection?: { type: 'none' | 'single' | 'multiple' };
  
  /** Pagination configuration */
  pagination?: { pageSize: number; pageSizeOptions?: number[] };
  
  /** Allow column resizing @default false */
  resizable?: boolean;
  
  /** Show alternating row colors @default false */
  striped?: boolean;
  
  /** Show cell borders @default false */
  bordered?: boolean;
  
  /** Navigation config for row click behavior */
  navigation?: ViewNavigationConfig;

  /**
   * Callback for page-level navigation (used by 'page' mode).
   * Called with recordId and action ('view' | 'edit').
   */
  onNavigate?: (recordId: string | number, action?: string) => void;
  
  /** Kanban-specific configuration */
  kanban?: {
    groupField: string;
    titleField?: string;
    cardFields?: string[];
    [key: string]: any;
  };
  
  /** Calendar-specific configuration */
  calendar?: {
    startDateField: string;
    endDateField?: string;
    titleField?: string;
    defaultView?: 'month' | 'week' | 'day' | 'agenda';
    [key: string]: any;
  };
  
  /** Gantt-specific configuration */
  gantt?: {
    startDateField: string;
    endDateField: string;
    titleField?: string;
    progressField?: string;
    dependenciesField?: string;
    [key: string]: any;
  };
  
  /** Visual Component overrides (legacy, prefer typed configs above) */
  options?: Record<string, any>;
  
  /** 
   * Empty state configuration shown when no data is available.
   * Aligned with @objectstack/spec ListViewSchema.emptyState.
   */
  emptyState?: {
    /** Title text for the empty state */
    title?: string;
    /** Message/description for the empty state */
    message?: string;
    /** Icon name (Lucide icon identifier) for the empty state */
    icon?: string;
  };

  /**
   * Quick filter buttons for predefined filter presets.
   * Each quick filter is rendered as a toggle button in the toolbar.
   */
  quickFilters?: Array<{
    /** Unique identifier for this quick filter */
    id: string;
    /** Display label for the filter button */
    label: string;
    /** Filter conditions to apply when activated */
    filters: Array<any[] | string>;
    /** Icon name (Lucide icon identifier) */
    icon?: string;
    /** Default active state */
    defaultActive?: boolean;
  }>;

  /**
   * Fields to hide from the current view.
   * Hides columns in grid view or fields in other view types.
   */
  hiddenFields?: string[];

  /**
   * Custom field display order. Fields listed first appear first.
   * Fields not listed are appended in their original order.
   */
  fieldOrder?: string[];

  /**
   * Export options configuration for exporting list data.
   * Supports csv, xlsx, json, and pdf formats.
   */
  exportOptions?: {
    /** Formats available for export */
    formats?: Array<'csv' | 'xlsx' | 'json' | 'pdf'>;
    /** Maximum number of records to export (0 = unlimited) */
    maxRecords?: number;
    /** Include column headers in export */
    includeHeaders?: boolean;
    /** Custom file name prefix */
    fileNamePrefix?: string;
  };

  /**
   * Density mode for controlling row/item spacing.
   * Aligned with @objectstack/spec DensityMode.
   */
  densityMode?: 'compact' | 'comfortable' | 'spacious';
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
