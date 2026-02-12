/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Data Display Component Zod Validators
 * 
 * Zod validation schemas for data display and information presentation components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/data-display
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * Alert Schema - Alert/notification component
 */
export const AlertSchema = BaseSchema.extend({
  type: z.literal('alert'),
  title: z.string().optional().describe('Alert title'),
  description: z.string().optional().describe('Alert description'),
  variant: z.enum(['default', 'destructive']).optional().describe('Alert variant'),
  icon: z.string().optional().describe('Alert icon'),
  dismissible: z.boolean().optional().describe('Whether alert can be dismissed'),
  onDismiss: z.function().optional().describe('Dismiss handler'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Statistic Schema - Statistic display component
 */
export const StatisticSchema = BaseSchema.extend({
  type: z.literal('statistic'),
  label: z.string().optional().describe('Statistic label'),
  value: z.union([z.string(), z.number()]).describe('Statistic value'),
  trend: z.enum(['up', 'down', 'neutral']).optional().describe('Trend indicator'),
  description: z.string().optional().describe('Description text'),
  icon: z.string().optional().describe('Statistic icon'),
});

/**
 * Badge Schema - Badge/tag component
 */
export const BadgeSchema = BaseSchema.extend({
  type: z.literal('badge'),
  label: z.string().optional().describe('Badge label'),
  variant: z.enum(['default', 'secondary', 'destructive', 'outline']).optional().describe('Badge variant'),
  icon: z.string().optional().describe('Badge icon'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Avatar Schema - Avatar/profile picture component
 */
export const AvatarSchema = BaseSchema.extend({
  type: z.literal('avatar'),
  src: z.string().optional().describe('Image source URL'),
  alt: z.string().optional().describe('Alt text'),
  fallback: z.string().optional().describe('Fallback text/initials'),
  size: z.enum(['sm', 'default', 'lg', 'xl']).optional().describe('Avatar size'),
  shape: z.enum(['circle', 'square']).optional().describe('Avatar shape'),
});

/**
 * List Item Schema
 */
export const ListItemSchema = z.object({
  id: z.string().optional().describe('Item ID'),
  label: z.string().optional().describe('Item label'),
  description: z.string().optional().describe('Item description'),
  icon: z.string().optional().describe('Item icon'),
  avatar: z.string().optional().describe('Item avatar URL'),
  disabled: z.boolean().optional().describe('Whether item is disabled'),
  onClick: z.function().optional().describe('Click handler'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Custom content'),
});

/**
 * List Schema - List component
 */
export const ListSchema = BaseSchema.extend({
  type: z.literal('list'),
  items: z.array(ListItemSchema).describe('List items'),
  ordered: z.boolean().optional().describe('Whether list is ordered'),
  dividers: z.boolean().optional().describe('Show dividers between items'),
  dense: z.boolean().optional().describe('Dense spacing'),
});

/**
 * Table Column Schema
 */
export const TableColumnSchema = z.object({
  header: z.string().describe('Column header text'),
  accessorKey: z.string().describe('Data accessor key'),
  className: z.string().optional().describe('Column class name'),
  cellClassName: z.string().optional().describe('Cell class name'),
  width: z.union([z.string(), z.number()]).optional().describe('Column width'),
  minWidth: z.union([z.string(), z.number()]).optional().describe('Minimum width'),
  align: z.enum(['left', 'center', 'right']).optional().describe('Column alignment'),
  fixed: z.enum(['left', 'right']).optional().describe('Fixed column position'),
  type: z.string().optional().describe('Column type'),
  sortable: z.boolean().optional().describe('Whether column is sortable'),
  filterable: z.boolean().optional().describe('Whether column is filterable'),
  resizable: z.boolean().optional().describe('Whether column is resizable'),
  cell: z.function().optional().describe('Custom cell renderer'),
});

/**
 * Table Schema - Simple table component
 */
export const TableSchema = BaseSchema.extend({
  type: z.literal('table'),
  caption: z.string().optional().describe('Table caption'),
  columns: z.array(TableColumnSchema).describe('Table columns'),
  data: z.array(z.any()).describe('Table data'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Table footer'),
  hoverable: z.boolean().optional().describe('Highlight rows on hover'),
  striped: z.boolean().optional().describe('Striped rows'),
});

/**
 * Data Table Schema - Advanced data table with features
 */
export const DataTableSchema = BaseSchema.extend({
  type: z.literal('data-table'),
  caption: z.string().optional().describe('Table caption'),
  toolbar: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Toolbar content'),
  columns: z.array(TableColumnSchema).describe('Table columns'),
  data: z.array(z.any()).describe('Table data'),
  pagination: z.boolean().optional().describe('Enable pagination'),
  pageSize: z.number().optional().describe('Default page size'),
  searchable: z.boolean().optional().describe('Enable search'),
  selectable: z.boolean().optional().describe('Enable row selection'),
  sortable: z.boolean().optional().describe('Enable sorting'),
  exportable: z.boolean().optional().describe('Enable data export'),
  rowActions: z.array(z.any()).optional().describe('Row action buttons'),
  resizableColumns: z.boolean().optional().describe('Allow column resizing'),
  reorderableColumns: z.boolean().optional().describe('Allow column reordering'),
  onRowEdit: z.function().optional().describe('Row edit handler'),
  onRowDelete: z.function().optional().describe('Row delete handler'),
  onSelectionChange: z.function().optional().describe('Selection change handler'),
  onColumnsReorder: z.function().optional().describe('Column reorder handler'),
});

/**
 * Markdown Schema - Markdown content renderer
 */
export const MarkdownSchema = BaseSchema.extend({
  type: z.literal('markdown'),
  content: z.string().describe('Markdown content'),
  sanitize: z.boolean().optional().describe('Sanitize HTML'),
  components: z.record(z.string(), z.any()).optional().describe('Custom component overrides'),
});

/**
 * Tree Node Schema
 */
export const TreeNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().describe('Node ID'),
    label: z.string().describe('Node label'),
    icon: z.string().optional().describe('Node icon'),
    defaultExpanded: z.boolean().optional().describe('Default expanded state'),
    selectable: z.boolean().optional().describe('Whether node is selectable'),
    children: z.array(TreeNodeSchema).optional().describe('Child nodes'),
    data: z.any().optional().describe('Custom node data'),
  })
);

/**
 * Tree View Schema - Tree/hierarchical view component
 */
export const TreeViewSchema = BaseSchema.extend({
  type: z.literal('tree-view'),
  data: z.array(TreeNodeSchema).describe('Tree data'),
  defaultExpandedIds: z.array(z.string()).optional().describe('Default expanded node IDs'),
  defaultSelectedIds: z.array(z.string()).optional().describe('Default selected node IDs'),
  expandedIds: z.array(z.string()).optional().describe('Controlled expanded node IDs'),
  selectedIds: z.array(z.string()).optional().describe('Controlled selected node IDs'),
  multiSelect: z.boolean().optional().describe('Allow multiple selection'),
  showLines: z.boolean().optional().describe('Show connecting lines'),
  onSelectChange: z.function().optional().describe('Selection change handler'),
  onExpandChange: z.function().optional().describe('Expand change handler'),
});

/**
 * Chart Type Enum
 */
export const ChartTypeSchema = z.enum([
  'line',
  'bar',
  'area',
  'pie',
  'donut',
  'radar',
  'scatter',
]);

/**
 * Chart Series Schema
 */
export const ChartSeriesSchema = z.object({
  name: z.string().describe('Series name'),
  data: z.array(z.number()).describe('Series data points'),
  color: z.string().optional().describe('Series color'),
});

/**
 * Chart Schema - Chart/graph component
 */
export const ChartSchema = BaseSchema.extend({
  type: z.literal('chart'),
  chartType: ChartTypeSchema.describe('Chart type'),
  title: z.string().optional().describe('Chart title'),
  description: z.string().optional().describe('Chart description'),
  categories: z.array(z.string()).optional().describe('X-axis categories'),
  series: z.array(ChartSeriesSchema).describe('Chart data series'),
  height: z.union([z.string(), z.number()]).optional().describe('Chart height'),
  width: z.union([z.string(), z.number()]).optional().describe('Chart width'),
  showLegend: z.boolean().optional().describe('Show legend'),
  showGrid: z.boolean().optional().describe('Show grid lines'),
  animate: z.boolean().optional().describe('Enable animations'),
  config: z.record(z.string(), z.any()).optional().describe('Additional chart configuration'),
});

/**
 * Timeline Event Schema
 */
export const TimelineEventSchema = z.object({
  id: z.string().optional().describe('Event ID'),
  title: z.string().describe('Event title'),
  description: z.string().optional().describe('Event description'),
  date: z.union([z.string(), z.date()]).describe('Event date'),
  icon: z.string().optional().describe('Event icon'),
  color: z.string().optional().describe('Event color'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Custom content'),
});

/**
 * Timeline Schema - Timeline component
 */
export const TimelineSchema = BaseSchema.extend({
  type: z.literal('timeline'),
  events: z.array(TimelineEventSchema).describe('Timeline events'),
  orientation: z.enum(['vertical', 'horizontal']).optional().describe('Timeline orientation'),
  position: z.enum(['left', 'right', 'alternate']).optional().describe('Event position'),
});

/**
 * Keyboard Key Schema - Keyboard key display
 */
export const KbdSchema = BaseSchema.extend({
  type: z.literal('kbd'),
  label: z.string().optional().describe('Key label'),
  keys: z.union([z.string(), z.array(z.string())]).optional().describe('Key(s) to display'),
});

/**
 * HTML Schema - Raw HTML renderer
 */
export const HtmlSchema = BaseSchema.extend({
  type: z.literal('html'),
  html: z.string().describe('HTML content'),
});

/**
 * Data Display Schema Union - All data display component schemas
 */
export const DataDisplaySchema = z.discriminatedUnion('type', [
  AlertSchema,
  StatisticSchema,
  BadgeSchema,
  AvatarSchema,
  ListSchema,
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeViewSchema,
  ChartSchema,
  TimelineSchema,
  KbdSchema,
  HtmlSchema,
]);
