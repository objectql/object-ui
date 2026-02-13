/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - View Component Schemas
 * 
 * Type definitions for various view components (List, Detail, Grid, Kanban, Calendar).
 * These schemas enable building different data visualization interfaces.
 * 
 * @module views
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base';
import type { ActionSchema } from './crud';
import type { TableColumn } from './data-display';
import type { FormField } from './form';

/**
 * View Type
 */
export type ViewType = 'list' | 'detail' | 'grid' | 'kanban' | 'calendar' | 'timeline' | 'map';

/**
 * Detail View Field Configuration
 */
export interface DetailViewField {
  /**
   * Field name/path
   */
  name: string;
  /**
   * Display label
   */
  label?: string;
  /**
   * Field type for rendering
   */
  type?: 'text' | 'image' | 'link' | 'badge' | 'date' | 'datetime' | 'json' | 'html' | 'markdown' | 'custom';
  /**
   * Format string (e.g., date format)
   */
  format?: string;
  /**
   * Custom renderer
   */
  render?: SchemaNode;
  /**
   * Field value
   */
  value?: any;
  /**
   * Whether field is read-only
   */
  readonly?: boolean;
  /**
   * Field visibility condition
   */
  visible?: boolean | string;
  /**
   * Span across columns (for grid layout)
   */
  span?: number;
}

/**
 * Detail View Section/Group
 */
export interface DetailViewSection {
  /**
   * Section title
   */
  title?: string;
  /**
   * Section description
   */
  description?: string;
  /**
   * Section icon
   */
  icon?: string;
  /**
   * Fields in this section
   */
  fields: DetailViewField[];
  /**
   * Collapsible section
   */
  collapsible?: boolean;
  /**
   * Default collapsed state
   */
  defaultCollapsed?: boolean;
  /**
   * Grid columns for field layout
   */
  columns?: number;
  /**
   * Section visibility condition
   */
  visible?: boolean | string;
  /**
   * Show border around section
   * @default true
   */
  showBorder?: boolean;
  /**
   * Header background color (Tailwind class)
   * @example 'muted', 'primary/10'
   */
  headerColor?: string;
}

/**
 * Detail View Tab
 */
export interface DetailViewTab {
  /**
   * Tab key/identifier
   */
  key: string;
  /**
   * Tab label
   */
  label: string;
  /**
   * Tab icon
   */
  icon?: string;
  /**
   * Tab content
   */
  content: SchemaNode | SchemaNode[];
  /**
   * Tab visibility condition
   */
  visible?: boolean | string;
  /**
   * Badge count
   */
  badge?: string | number;
}

/**
 * Detail View Schema - Display detailed information about a single record
 * Enhanced in Phase 2 with better organization and features
 */
export interface DetailViewSchema extends BaseSchema {
  type: 'detail-view';
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
   * Object name (for ObjectQL integration)
   */
  objectName?: string;
  /**
   * Data to display (if not fetching from API)
   */
  data?: any;
  /**
   * Layout mode
   */
  layout?: 'vertical' | 'horizontal' | 'grid';
  /**
   * Grid columns (for grid layout)
   */
  columns?: number;
  /**
   * Field sections for organized display
   */
  sections?: DetailViewSection[];
  /**
   * Direct fields (without sections)
   */
  fields?: DetailViewField[];
  /**
   * Actions available in detail view
   */
  actions?: ActionSchema[];
  /**
   * Tabs for additional content
   */
  tabs?: DetailViewTab[];
  /**
   * Show back button
   * @default true
   */
  showBack?: boolean;
  /**
   * Back button URL
   */
  backUrl?: string;
  /**
   * Custom back action
   */
  onBack?: string;
  /**
   * Show edit button
   */
  showEdit?: boolean;
  /**
   * Edit button URL
   */
  editUrl?: string;
  /**
   * Show delete button
   */
  showDelete?: boolean;
  /**
   * Delete confirmation message
   */
  deleteConfirmation?: string;
  /**
   * Whether to show loading state
   * @default true
   */
  loading?: boolean;
  /**
   * Custom header content
   */
  header?: SchemaNode;
  /**
   * Custom footer content
   */
  footer?: SchemaNode;
  /**
   * Navigation handler for SPA-aware routing.
   * Called instead of window.location.href for back/edit navigation.
   * @param url - The URL to navigate to
   * @param options - Navigation options (replace, newTab, etc.)
   */
  onNavigate?: (url: string, options?: { replace?: boolean; newTab?: boolean }) => void;
  /**
   * Related records section
   */
  related?: Array<{
    /**
     * Relation title
     */
    title: string;
    /**
     * Relation type
     */
    type: 'list' | 'grid' | 'table';
    /**
     * API endpoint for related data
     */
    api?: string;
    /**
     * Static data
     */
    data?: any[];
    /**
     * Columns for table view
     */
    columns?: TableColumn[];
    /**
     * Fields for list view
     */
    fields?: string[];
  }>;
}

/**
 * View Switcher Schema - Toggle between different view modes
 * New in Phase 2
 */
export interface ViewSwitcherSchema extends BaseSchema {
  type: 'view-switcher';
  /**
   * Available view types
   */
  views: Array<{
    /**
     * View type
     */
    type: ViewType;
    /**
     * View label
     */
    label?: string;
    /**
     * View icon
     */
    icon?: string;
    /**
     * View schema
     */
    schema?: SchemaNode;
  }>;
  /**
   * Default/active view
   */
  defaultView?: ViewType;
  /**
   * Current active view
   */
  activeView?: ViewType;
  /**
   * Switcher variant
   */
  variant?: 'tabs' | 'buttons' | 'dropdown';
  /**
   * Switcher position
   */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * View change callback
   */
  onViewChange?: string;
  /**
   * Persist view preference
   */
  persistPreference?: boolean;
  /**
   * Storage key for persisting view
   */
  storageKey?: string;
}

/**
 * Filter UI Schema - Enhanced filter interface
 * New in Phase 2
 */
export interface FilterUISchema extends BaseSchema {
  type: 'filter-ui';
  /**
   * Available filters
   */
  filters: Array<{
    /**
     * Filter field
     */
    field: string;
    /**
     * Filter label
     */
    label?: string;
    /**
     * Filter type
     */
    type: 'text' | 'number' | 'select' | 'date' | 'date-range' | 'boolean';
    /**
     * Filter operator
     */
    operator?: 'equals' | 'contains' | 'startsWith' | 'gt' | 'lt' | 'between' | 'in';
    /**
     * Options for select filter
     */
    options?: Array<{ label: string; value: any }>;
    /**
     * Placeholder
     */
    placeholder?: string;
  }>;
  /**
   * Current filter values
   */
  values?: Record<string, any>;
  /**
   * Filter change callback
   */
  onChange?: string;
  /**
   * Show clear button
   */
  showClear?: boolean;
  /**
   * Show apply button
   */
  showApply?: boolean;
  /**
   * Filter layout
   */
  layout?: 'inline' | 'popover' | 'drawer';
}

/**
 * Sort UI Schema - Enhanced sort interface
 * New in Phase 2
 */
export interface SortUISchema extends BaseSchema {
  type: 'sort-ui';
  /**
   * Sortable fields
   */
  fields: Array<{
    /**
     * Field name
     */
    field: string;
    /**
     * Field label
     */
    label?: string;
  }>;
  /**
   * Current sort configuration
   */
  sort?: Array<{
    /**
     * Field to sort by
     */
    field: string;
    /**
     * Sort direction
     */
    direction: 'asc' | 'desc';
  }>;
  /**
   * Sort change callback
   */
  onChange?: string;
  /**
   * Allow multiple sort fields
   */
  multiple?: boolean;
  /**
   * UI variant
   */
  variant?: 'dropdown' | 'buttons';
}

/**
 * Union type of all view schemas
 */
export type ViewComponentSchema =
  | DetailViewSchema
  | ViewSwitcherSchema
  | FilterUISchema
  | SortUISchema;
