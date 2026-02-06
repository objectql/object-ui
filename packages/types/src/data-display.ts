/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Data Display Component Schemas
 * 
 * Type definitions for components that display data and information.
 * 
 * @module data-display
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base';

/**
 * Alert component
 */
export interface AlertSchema extends BaseSchema {
  type: 'alert';
  /**
   * Alert title
   */
  title?: string;
  /**
   * Alert description/message
   */
  description?: string;
  /**
   * Alert variant
   * @default 'default'
   */
  variant?: 'default' | 'destructive';
  /**
   * Alert icon
   */
  icon?: string;
  /**
   * Whether alert is dismissible
   */
  dismissible?: boolean;
  /**
   * Dismiss handler
   */
  onDismiss?: () => void;
  /**
   * Child content
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Statistic component for dashboards
 */
export interface StatisticSchema extends BaseSchema {
  type: 'statistic';
  /**
   * The label/title of the statistic (e.g. "Total Revenue")
   */
  label?: string;
  /**
   * The main value (e.g. "$45,231.89")
   */
  value: string | number;
  /**
   * Optional trend indicator
   */
  trend?: 'up' | 'down' | 'neutral';
  /**
   * Additional description (e.g. "+20.1% from last month")
   */
  description?: string;
  /**
    * Optional icon name
    */
  icon?: string;
}

/**
 * Badge component
 */
export interface BadgeSchema extends BaseSchema {
  type: 'badge';
  /**
   * Badge text
   */
  label?: string;
  /**
   * Badge variant
   * @default 'default'
   */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  /**
   * Badge icon
   */
  icon?: string;
  /**
   * Child content
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Avatar component
 */
export interface AvatarSchema extends BaseSchema {
  type: 'avatar';
  /**
   * Image source URL
   */
  src?: string;
  /**
   * Alt text
   */
  alt?: string;
  /**
   * Fallback text (initials)
   */
  fallback?: string;
  /**
   * Avatar size
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg' | 'xl';
  /**
   * Avatar shape
   * @default 'circle'
   */
  shape?: 'circle' | 'square';
}

/**
 * List component
 */
export interface ListSchema extends BaseSchema {
  type: 'list';
  /**
   * List items
   */
  items: ListItem[];
  /**
   * Whether list is ordered
   * @default false
   */
  ordered?: boolean;
  /**
   * List item dividers
   * @default false
   */
  dividers?: boolean;
  /**
   * Dense/compact layout
   * @default false
   */
  dense?: boolean;
}

/**
 * List item
 */
export interface ListItem {
  /**
   * Unique item identifier
   */
  id?: string;
  /**
   * Item label/title
   */
  label?: string;
  /**
   * Item description
   */
  description?: string;
  /**
   * Item icon
   */
  icon?: string;
  /**
   * Item avatar image
   */
  avatar?: string;
  /**
   * Whether item is disabled
   */
  disabled?: boolean;
  /**
   * Click handler
   */
  onClick?: () => void;
  /**
   * Item content (schema nodes)
   */
  content?: SchemaNode | SchemaNode[];
}

/**
 * Table column definition
 */
export interface TableColumn {
  /**
   * Column header text
   */
  header: string;
  /**
   * Key to access data in row object
   */
  accessorKey: string;
  /**
   * Header CSS class
   */
  className?: string;
  /**
   * Cell CSS class
   */
  cellClassName?: string;
  /**
   * Column width
   */
  width?: string | number;
  /**
   * Column minimum width
   */
  minWidth?: string | number;
  /**
   * Text alignment
   * @default 'left'
   */
  align?: 'left' | 'center' | 'right';
  /**
   * Pin column to side
   */
  fixed?: 'left' | 'right';
  /**
   * Data type for formatting
   */
  type?: 'text' | 'number' | 'date' | 'datetime' | 'currency' | 'percent' | 'boolean' | 'action';
  /**
   * Whether column is sortable
   * @default true
   */
  sortable?: boolean;
  /**
   * Whether column is filterable
   * @default true
   */
  filterable?: boolean;
  /**
   * Whether column is resizable
   * @default true
   */
  resizable?: boolean;
  /**
   * Whether column is editable (for inline editing)
   * @default true
   */
  editable?: boolean;
  /**
   * Custom cell renderer function
   */
  cell?: (value: any, row: any) => any;
}

/**
 * Simple table component
 */
export interface TableSchema extends BaseSchema {
  type: 'table';
  /**
   * Table caption
   */
  caption?: string;
  /**
   * Table columns
   */
  columns: TableColumn[];
  /**
   * Table data rows
   */
  data: any[];
  /**
   * Table footer content
   */
  footer?: SchemaNode | SchemaNode[] | string;
  /**
   * Whether table has hover effect
   * @default true
   */
  hoverable?: boolean;
  /**
   * Whether table has striped rows
   * @default false
   */
  striped?: boolean;
}

/**
 * Enterprise data table with advanced features
 */
export interface DataTableSchema extends BaseSchema {
  type: 'data-table';
  /**
   * Table caption
   */
  caption?: string;
  /**
   * Table toolbar actions/content
   */
  toolbar?: SchemaNode[];
  /**
   * Table columns
   */
  columns: TableColumn[];
  /**
   * Table data rows
   */
  data: any[];
  /**
   * Enable pagination
   * @default true
   */
  pagination?: boolean;
  /**
   * Rows per page
   * @default 10
   */
  pageSize?: number;
  /**
   * Enable search
   * @default true
   */
  searchable?: boolean;
  /**
   * Enable row selection
   * - boolean: Enable/disable selection (true = multiple selection)
   * - 'single': Single row selection
   * - 'multiple': Multiple row selection
   * @default false
   */
  selectable?: boolean | 'single' | 'multiple';
  /**
   * Enable column sorting
   * @default true
   */
  sortable?: boolean;
  /**
   * Enable CSV export
   * @default false
   */
  exportable?: boolean;
  /**
   * Show row actions (edit/delete)
   * @default false
   */
  rowActions?: boolean;
  /**
   * Enable column resizing
   * @default true
   */
  resizableColumns?: boolean;
  /**
   * Enable column reordering
   * @default true
   */
  reorderableColumns?: boolean;
  /**
   * Row edit handler
   */
  onRowEdit?: (row: any) => void;
  /**
   * Row delete handler
   */
  onRowDelete?: (row: any) => void;
  /**
   * Selection change handler
   */
  onSelectionChange?: (selectedRows: any[]) => void;
  /**
   * Columns reorder handler
   */
  onColumnsReorder?: (columns: TableColumn[]) => void;
  /**
   * Enable inline cell editing
   * When true, cells become editable on double-click or Enter key
   * @default false
   */
  editable?: boolean;
  /**
   * Cell value change handler
   * Called when a cell value is edited
   */
  onCellChange?: (rowIndex: number, columnKey: string, newValue: any, row: any) => void;
  /**
   * Row click handler
   * Called when a row is clicked
   */
  onRowClick?: (row: any) => void;
}

/**
 * Markdown renderer component
 */
export interface MarkdownSchema extends BaseSchema {
  type: 'markdown';
  /**
   * Markdown content
   */
  content: string;
  /**
   * Whether to sanitize HTML
   * @default true
   */
  sanitize?: boolean;
  /**
   * Custom components for markdown elements
   */
  components?: Record<string, any>;
}

/**
 * Tree view node
 */
export interface TreeNode {
  /**
   * Unique node identifier
   */
  id: string;
  /**
   * Node label
   */
  label: string;
  /**
   * Node icon
   */
  icon?: string;
  /**
   * Whether node is expanded by default
   * @default false
   */
  defaultExpanded?: boolean;
  /**
   * Whether node is selectable
   * @default true
   */
  selectable?: boolean;
  /**
   * Child nodes
   */
  children?: TreeNode[];
  /**
   * Additional data
   */
  data?: any;
}

/**
 * Tree view component
 */
export interface TreeViewSchema extends BaseSchema {
  type: 'tree-view';
  /**
   * Tree data
   */
  data: TreeNode[];
  /**
   * Default expanded node IDs
   */
  defaultExpandedIds?: string[];
  /**
   * Default selected node IDs
   */
  defaultSelectedIds?: string[];
  /**
   * Controlled expanded node IDs
   */
  expandedIds?: string[];
  /**
   * Controlled selected node IDs
   */
  selectedIds?: string[];
  /**
   * Enable multi-selection
   * @default false
   */
  multiSelect?: boolean;
  /**
   * Show lines connecting nodes
   * @default true
   */
  showLines?: boolean;
  /**
   * Node select handler
   */
  onSelectChange?: (selectedIds: string[]) => void;
  /**
   * Node expand handler
   */
  onExpandChange?: (expandedIds: string[]) => void;
}

/**
 * Chart type
 */
export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter';

/**
 * Chart data series
 */
export interface ChartSeries {
  /**
   * Series name
   */
  name: string;
  /**
   * Series data points
   */
  data: number[];
  /**
   * Series color
   */
  color?: string;
}

/**
 * Chart component
 */
export interface ChartSchema extends BaseSchema {
  type: 'chart';
  /**
   * Chart type
   */
  chartType: ChartType;
  /**
   * Chart title
   */
  title?: string;
  /**
   * Chart description
   */
  description?: string;
  /**
   * X-axis labels/categories
   */
  categories?: string[];
  /**
   * Data series
   */
  series: ChartSeries[];
  /**
   * Chart height
   */
  height?: string | number;
  /**
   * Chart width
   */
  width?: string | number;
  /**
   * Show legend
   * @default true
   */
  showLegend?: boolean;
  /**
   * Show grid
   * @default true
   */
  showGrid?: boolean;
  /**
   * Enable animations
   * @default true
   */
  animate?: boolean;
  /**
   * Chart configuration (library-specific)
   */
  config?: Record<string, any>;
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  /**
   * Event unique identifier
   */
  id?: string;
  /**
   * Event title
   */
  title: string;
  /**
   * Event description
   */
  description?: string;
  /**
   * Event date/time
   */
  date: string | Date;
  /**
   * Event icon
   */
  icon?: string;
  /**
   * Event color
   */
  color?: string;
  /**
   * Event content
   */
  content?: SchemaNode | SchemaNode[];
}

/**
 * Timeline component
 */
export interface TimelineSchema extends BaseSchema {
  type: 'timeline';
  /**
   * Timeline events
   */
  events: TimelineEvent[];
  /**
   * Timeline orientation
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Timeline position (for vertical)
   * @default 'left'
   */
  position?: 'left' | 'right' | 'alternate';
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /**
   * Item label
   */
  label: string;
  /**
   * Item href/link
   */
  href?: string;
}

/**
 * Breadcrumb component
 */
export interface BreadcrumbSchema extends BaseSchema {
  type: 'breadcrumb';
  /**
   * Breadcrumb items
   */
  items: BreadcrumbItem[];
  /**
   * Separator character
   * @default '/'
   */
  separator?: string;
}

/**
 * Keyboard key component
 */
export interface KbdSchema extends BaseSchema {
  type: 'kbd';
  /**
   * Key label (single key)
   */
  label?: string;
  /**
   * Key labels (multiple keys)
   */
  keys?: string | string[];
}

/**
 * Union type of all data display schemas
 */
export type DataDisplaySchema =
  | AlertSchema
  | BadgeSchema
  | AvatarSchema
  | ListSchema
  | TableSchema
  | DataTableSchema
  | MarkdownSchema
  | TreeViewSchema
  | ChartSchema
  | TimelineSchema
  | HtmlSchema
  | StatisticSchema
  | BreadcrumbSchema
  | KbdSchema;

/**
 * Raw HTML component
 */
export interface HtmlSchema extends BaseSchema {
  type: 'html';
  /**
   * The HTML content string
   */
  html: string;
}
