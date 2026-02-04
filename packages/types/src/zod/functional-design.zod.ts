/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Functional Design Component Zod Validators
 * 
 * Zod validation schemas for all components specified in FUNCTIONAL_DESIGN.md
 * These schemas provide runtime validation and type inference for the designed components.
 * 
 * @module zod/functional-design
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

// ============================================================================
// Foundation Components (Section 1 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Text Component Schema
 * Display formatted text content with various styles and sizes
 */
export const TextSchema = BaseSchema.extend({
  type: z.literal('text'),
  value: z.string().describe('Text content to display'),
  size: z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'])
    .optional()
    .default('base')
    .describe('Text size'),
  weight: z.enum(['normal', 'medium', 'semibold', 'bold'])
    .optional()
    .default('normal')
    .describe('Font weight'),
  color: z.string().optional().describe('Tailwind color class'),
  align: z.enum(['left', 'center', 'right', 'justify'])
    .optional()
    .default('left')
    .describe('Text alignment'),
  truncate: z.boolean().optional().describe('Single line truncation with ellipsis'),
  lineClamp: z.number().optional().describe('Multi-line truncation (number of lines)'),
  transform: z.enum(['uppercase', 'lowercase', 'capitalize']).optional().describe('Text transformation'),
  decoration: z.enum(['underline', 'line-through']).optional().describe('Text decoration'),
  italic: z.boolean().optional().describe('Italic text'),
  font: z.enum(['sans', 'mono', 'display']).optional().default('sans').describe('Font family'),
});

/**
 * Button Component Schema
 * Trigger actions with multiple visual styles and states
 */
export const EnhancedButtonSchema = BaseSchema.extend({
  type: z.literal('button'),
  text: z.string().optional().describe('Button text label'),
  icon: z.string().optional().describe('Lucide icon name'),
  iconPosition: z.enum(['left', 'right']).optional().default('left').describe('Icon position relative to text'),
  
  // Visual variants
  variant: z.enum(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'])
    .optional()
    .default('default')
    .describe('Button visual style variant'),
  size: z.enum(['sm', 'default', 'lg', 'icon'])
    .optional()
    .default('default')
    .describe('Button size'),
  
  // States
  loading: z.boolean().optional().describe('Loading state with spinner'),
  disabled: z.boolean().optional().describe('Disabled state'),
  
  // Behavior
  onClick: z.any().optional().describe('Click action schema'),
  type: z.enum(['button', 'submit', 'reset']).optional().default('button').describe('HTML button type'),
  
  // Styling
  fullWidth: z.boolean().optional().describe('100% width button'),
  className: z.string().optional().describe('Additional Tailwind classes'),
});

/**
 * Icon Component Schema
 * Display Lucide Icons with customizable size and color
 */
export const IconSchema = BaseSchema.extend({
  type: z.literal('icon'),
  name: z.string().describe('Lucide icon name'),
  size: z.union([
    z.number(),
    z.enum(['sm', 'base', 'lg', 'xl'])
  ]).optional().default('base').describe('Icon size in px or preset'),
  color: z.string().optional().describe('Tailwind color class'),
  strokeWidth: z.number().min(1).max(3).optional().default(2).describe('Icon stroke width'),
  className: z.string().optional(),
});

/**
 * Image Component Schema
 * Display images with lazy loading and error handling
 */
export const ImageSchema = BaseSchema.extend({
  type: z.literal('image'),
  src: z.string().url().describe('Image URL'),
  alt: z.string().describe('Alternative text (required for accessibility)'),
  width: z.union([z.number(), z.string()]).optional().describe('Image width'),
  height: z.union([z.number(), z.string()]).optional().describe('Image height'),
  aspectRatio: z.string().optional().describe('Aspect ratio (e.g., "16/9", "4/3", "1/1")'),
  objectFit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down'])
    .optional()
    .default('cover')
    .describe('How image fits container'),
  loading: z.enum(['lazy', 'eager']).optional().default('lazy').describe('Loading strategy'),
  placeholder: z.string().optional().describe('Placeholder image URL'),
  fallback: z.string().optional().describe('Fallback image on error'),
  rounded: z.union([z.boolean(), z.string()]).optional().describe('Border radius'),
  className: z.string().optional(),
});

/**
 * Separator Component Schema
 * Visual separator for content areas
 */
export const SeparatorSchema = BaseSchema.extend({
  type: z.literal('separator'),
  orientation: z.enum(['horizontal', 'vertical'])
    .optional()
    .default('horizontal')
    .describe('Separator orientation'),
  decorative: z.boolean().optional().default(true).describe('Whether separator is decorative (affects a11y)'),
  className: z.string().optional(),
});

// ============================================================================
// Layout Components (Section 2 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Container Component Schema
 * Top-level content container with responsive max-width
 */
export const ContainerSchema = BaseSchema.extend({
  type: z.literal('container'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Child components'),
  maxWidth: z.enum(['sm', 'md', 'lg', 'xl', '2xl', 'full'])
    .optional()
    .default('xl')
    .describe('Maximum width preset'),
  padding: z.union([z.number(), z.string()]).optional().describe('Container padding'),
  centered: z.boolean().optional().default(true).describe('Horizontally center content'),
  className: z.string().optional(),
});

/**
 * Flex Component Schema
 * Flexbox layout container
 */
export const FlexSchema = BaseSchema.extend({
  type: z.literal('flex'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Child components'),
  direction: z.enum(['row', 'row-reverse', 'column', 'column-reverse'])
    .optional()
    .default('row')
    .describe('Flex direction'),
  justify: z.enum(['start', 'end', 'center', 'between', 'around', 'evenly'])
    .optional()
    .default('start')
    .describe('Justify content'),
  align: z.enum(['start', 'end', 'center', 'baseline', 'stretch'])
    .optional()
    .default('stretch')
    .describe('Align items'),
  wrap: z.enum(['nowrap', 'wrap', 'wrap-reverse'])
    .optional()
    .default('nowrap')
    .describe('Flex wrap'),
  gap: z.union([z.number(), z.string()]).optional().describe('Gap between items (Tailwind spacing)'),
  className: z.string().optional(),
});

/**
 * Grid Component Schema
 * CSS Grid layout container with responsive columns
 */
export const GridSchema = BaseSchema.extend({
  type: z.literal('grid'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Child components'),
  columns: z.union([
    z.number(),
    z.object({
      sm: z.number().optional(),
      md: z.number().optional(),
      lg: z.number().optional(),
      xl: z.number().optional(),
    })
  ]).optional().default(1).describe('Number of columns (responsive)'),
  gap: z.union([z.number(), z.string()]).optional().describe('Gap between items'),
  className: z.string().optional(),
});

/**
 * Card Component Schema
 * Content grouping container with header, body, and footer
 */
export const CardSchema = BaseSchema.extend({
  type: z.literal('card'),
  title: z.union([z.string(), SchemaNodeSchema]).optional().describe('Card title'),
  description: z.union([z.string(), SchemaNodeSchema]).optional().describe('Card description'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Card body content'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Card footer'),
  
  // Visual styles
  variant: z.enum(['default', 'outlined', 'elevated'])
    .optional()
    .default('default')
    .describe('Card visual variant'),
  hover: z.boolean().optional().describe('Enable hover effect'),
  clickable: z.boolean().optional().describe('Make card clickable'),
  onClick: z.any().optional().describe('Click action'),
  
  className: z.string().optional(),
});

/**
 * Tab Item Schema
 * Individual tab configuration
 */
export const TabItemSchema = z.object({
  value: z.string().describe('Unique tab identifier'),
  label: z.union([z.string(), SchemaNodeSchema]).describe('Tab label'),
  icon: z.string().optional().describe('Tab icon'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Tab content'),
  disabled: z.boolean().optional().describe('Disabled state'),
});

/**
 * Tabs Component Schema
 * Tabbed content switcher
 */
export const TabsSchema = BaseSchema.extend({
  type: z.literal('tabs'),
  items: z.array(TabItemSchema).describe('Tab items'),
  defaultValue: z.string().optional().describe('Default active tab value'),
  orientation: z.enum(['horizontal', 'vertical'])
    .optional()
    .default('horizontal')
    .describe('Tabs orientation'),
  variant: z.enum(['default', 'pills', 'underline'])
    .optional()
    .default('default')
    .describe('Tabs visual style'),
  onChange: z.any().optional().describe('Tab change action'),
});

// ============================================================================
// Form Components (Section 3 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Validation Rule Schema
 * Form field validation configuration
 */
export const ValidationRuleSchema = z.union([
  z.object({ type: z.literal('required'), message: z.string().optional() }),
  z.object({ type: z.literal('minLength'), value: z.number(), message: z.string().optional() }),
  z.object({ type: z.literal('maxLength'), value: z.number(), message: z.string().optional() }),
  z.object({ type: z.literal('pattern'), value: z.union([z.instanceof(RegExp), z.string()]), message: z.string().optional() }),
  z.object({ type: z.literal('email'), message: z.string().optional() }),
  z.object({ type: z.literal('url'), message: z.string().optional() }),
  z.object({ type: z.literal('custom'), validator: z.function(), message: z.string().optional() }),
]);

/**
 * Enhanced Input Component Schema
 * Single-line text input with validation and slots
 */
export const EnhancedInputSchema = BaseSchema.extend({
  type: z.literal('input'),
  name: z.string().describe('Field name'),
  value: z.string().optional().describe('Input value'),
  placeholder: z.string().optional().describe('Placeholder text'),
  
  // Input types
  inputType: z.enum(['text', 'email', 'password', 'number', 'tel', 'url', 'search'])
    .optional()
    .default('text')
    .describe('Input type'),
  
  // States
  disabled: z.boolean().optional().describe('Disabled state'),
  readonly: z.boolean().optional().describe('Read-only state'),
  required: z.boolean().optional().describe('Required field'),
  
  // Validation
  validation: z.array(ValidationRuleSchema).optional().describe('Validation rules'),
  error: z.string().optional().describe('Error message'),
  
  // Slots
  prefix: SchemaNodeSchema.optional().describe('Prefix content (icon, text)'),
  suffix: SchemaNodeSchema.optional().describe('Suffix content (icon, button)'),
  
  // Behavior
  onChange: z.any().optional().describe('Change action'),
  onBlur: z.any().optional().describe('Blur action'),
  onFocus: z.any().optional().describe('Focus action'),
  
  // Styling
  size: z.enum(['sm', 'default', 'lg']).optional().default('default').describe('Input size'),
  fullWidth: z.boolean().optional().describe('100% width'),
  className: z.string().optional(),
});

/**
 * Textarea Component Schema
 * Multi-line text input with auto-resize
 */
export const TextareaSchema = BaseSchema.extend({
  type: z.literal('textarea'),
  name: z.string().describe('Field name'),
  value: z.string().optional().describe('Textarea value'),
  placeholder: z.string().optional().describe('Placeholder text'),
  rows: z.number().optional().default(3).describe('Initial number of rows'),
  maxRows: z.number().optional().describe('Maximum rows for auto-resize'),
  autoResize: z.boolean().optional().default(true).describe('Auto height adjustment'),
  maxLength: z.number().optional().describe('Maximum character count'),
  showCount: z.boolean().optional().describe('Show character counter'),
  disabled: z.boolean().optional(),
  readonly: z.boolean().optional(),
  required: z.boolean().optional(),
  validation: z.array(ValidationRuleSchema).optional(),
  error: z.string().optional(),
  onChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Select Option Schema
 * Individual select option configuration
 */
export const SelectOptionSchema = z.object({
  label: z.string().describe('Option display label'),
  value: z.string().describe('Option value'),
  disabled: z.boolean().optional().describe('Disabled state'),
  icon: z.string().optional().describe('Option icon'),
  description: z.string().optional().describe('Option description'),
  group: z.string().optional().describe('Option group name'),
});

/**
 * Enhanced Select Component Schema
 * Dropdown selection with search and multi-select support
 */
export const EnhancedSelectSchema = BaseSchema.extend({
  type: z.literal('select'),
  name: z.string().describe('Field name'),
  value: z.union([z.string(), z.array(z.string())]).optional().describe('Selected value(s)'),
  placeholder: z.string().optional().describe('Placeholder text'),
  options: z.array(SelectOptionSchema).describe('Select options'),
  
  // Features
  searchable: z.boolean().optional().describe('Enable search'),
  multiple: z.boolean().optional().describe('Multiple selection'),
  clearable: z.boolean().optional().describe('Show clear button'),
  
  // Data loading
  loadOptions: z.object({
    api: z.string().describe('API endpoint for options'),
    searchParam: z.string().optional().describe('Search query parameter'),
  }).optional().describe('Async options loading'),
  
  // States
  disabled: z.boolean().optional(),
  required: z.boolean().optional(),
  error: z.string().optional(),
  
  // Behavior
  onChange: z.any().optional(),
  
  // Styling
  size: z.enum(['sm', 'default', 'lg']).optional().default('default'),
  fullWidth: z.boolean().optional(),
  className: z.string().optional(),
});

/**
 * Checkbox Component Schema
 * Boolean selection control
 */
export const CheckboxSchema = BaseSchema.extend({
  type: z.literal('checkbox'),
  name: z.string().describe('Field name'),
  label: z.union([z.string(), SchemaNodeSchema]).optional().describe('Checkbox label'),
  checked: z.boolean().optional().describe('Checked state'),
  indeterminate: z.boolean().optional().describe('Indeterminate state (partial selection)'),
  disabled: z.boolean().optional(),
  required: z.boolean().optional(),
  error: z.string().optional(),
  onChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Radio Option Schema
 * Individual radio button option
 */
export const RadioOptionSchema = z.object({
  label: z.union([z.string(), SchemaNodeSchema]).describe('Option label'),
  value: z.string().describe('Option value'),
  disabled: z.boolean().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Radio Group Component Schema
 * Single selection from multiple options
 */
export const RadioGroupSchema = BaseSchema.extend({
  type: z.literal('radio-group'),
  name: z.string().describe('Field name'),
  value: z.string().optional().describe('Selected value'),
  options: z.array(RadioOptionSchema).describe('Radio options'),
  orientation: z.enum(['horizontal', 'vertical']).optional().default('vertical'),
  variant: z.enum(['default', 'card']).optional().default('default'),
  disabled: z.boolean().optional(),
  required: z.boolean().optional(),
  error: z.string().optional(),
  onChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Switch Component Schema
 * Binary toggle control
 */
export const SwitchSchema = BaseSchema.extend({
  type: z.literal('switch'),
  name: z.string().describe('Field name'),
  label: z.union([z.string(), SchemaNodeSchema]).optional(),
  checked: z.boolean().optional().describe('Checked state'),
  disabled: z.boolean().optional(),
  loading: z.boolean().optional().describe('Loading state'),
  size: z.enum(['sm', 'default', 'lg']).optional().default('default'),
  onChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Slider Component Schema
 * Numeric range selection
 */
export const SliderSchema = BaseSchema.extend({
  type: z.literal('slider'),
  name: z.string().describe('Field name'),
  value: z.union([z.number(), z.tuple([z.number(), z.number()])]).optional().describe('Value or range'),
  min: z.number().describe('Minimum value'),
  max: z.number().describe('Maximum value'),
  step: z.number().optional().default(1).describe('Step increment'),
  marks: z.record(z.number(), z.union([z.string(), SchemaNodeSchema])).optional().describe('Scale marks'),
  tooltip: z.union([z.boolean(), z.literal('always')]).optional().default(true).describe('Show value tooltip'),
  disabled: z.boolean().optional(),
  onChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * DatePicker Component Schema
 * Date and time selection
 */
export const DatePickerSchema = BaseSchema.extend({
  type: z.literal('date-picker'),
  name: z.string().describe('Field name'),
  value: z.union([z.string(), z.tuple([z.string(), z.string()])]).optional().describe('Date value or range (ISO 8601)'),
  mode: z.enum(['single', 'range', 'multiple']).optional().default('single'),
  format: z.string().optional().default('YYYY-MM-DD').describe('Display format'),
  showTime: z.boolean().optional().describe('Include time selection'),
  minDate: z.string().optional().describe('Minimum selectable date'),
  maxDate: z.string().optional().describe('Maximum selectable date'),
  disabledDates: z.union([
    z.array(z.string()),
    z.function().returns(z.boolean())
  ]).optional().describe('Disabled dates'),
  locale: z.string().optional().default('en-US').describe('Locale for formatting'),
  placeholder: z.string().optional(),
  disabled: z.boolean().optional(),
  required: z.boolean().optional(),
  error: z.string().optional(),
  onChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * File Metadata Schema
 * Information about uploaded file
 */
export const FileMetadataSchema = z.object({
  id: z.string().describe('Unique file ID'),
  name: z.string().describe('File name'),
  size: z.number().describe('File size in bytes'),
  type: z.string().describe('MIME type'),
  url: z.string().optional().describe('File URL after upload'),
  thumbnailUrl: z.string().optional().describe('Thumbnail URL'),
  uploadProgress: z.number().min(0).max(100).optional().describe('Upload progress percentage'),
  status: z.enum(['pending', 'uploading', 'success', 'error']).optional(),
  error: z.string().optional().describe('Error message if upload failed'),
});

/**
 * FileUpload Component Schema
 * File upload with drag-and-drop and preview
 */
export const FileUploadSchema = BaseSchema.extend({
  type: z.literal('file-upload'),
  name: z.string().describe('Field name'),
  value: z.array(FileMetadataSchema).optional().describe('Uploaded files'),
  
  // Restrictions
  accept: z.string().optional().describe('Accepted MIME types'),
  multiple: z.boolean().optional().describe('Allow multiple files'),
  maxSize: z.number().optional().describe('Max file size in bytes'),
  maxFiles: z.number().optional().describe('Maximum number of files'),
  
  // Upload configuration
  uploadUrl: z.string().describe('Upload endpoint URL'),
  uploadMethod: z.enum(['POST', 'PUT']).optional().default('POST'),
  uploadHeaders: z.record(z.string(), z.string()).optional(),
  
  // Features
  draggable: z.boolean().optional().default(true).describe('Enable drag-and-drop'),
  preview: z.boolean().optional().default(true).describe('Show file preview'),
  removable: z.boolean().optional().default(true).describe('Allow file removal'),
  
  // States
  disabled: z.boolean().optional(),
  error: z.string().optional(),
  
  // Events
  onUploadStart: z.any().optional(),
  onUploadProgress: z.any().optional(),
  onUploadComplete: z.any().optional(),
  onUploadError: z.any().optional(),
  onChange: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * Form Field Schema
 * Individual field configuration in a form
 */
export const FormFieldSchema = z.object({
  name: z.string().describe('Field name'),
  label: z.string().optional().describe('Field label'),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
  readonly: z.boolean().optional(),
  hidden: z.boolean().optional(),
  validation: z.array(ValidationRuleSchema).optional(),
  help: z.string().optional().describe('Help text'),
  component: SchemaNodeSchema.describe('Form component schema'),
  span: z.number().optional().describe('Column span in grid layout'),
  dependencies: z.array(z.string()).optional().describe('Dependent field names'),
  visibleWhen: z.string().optional().describe('Visibility condition expression'),
});

/**
 * Form Component Schema
 * Complete form with validation and submission
 */
export const FormSchema = BaseSchema.extend({
  type: z.literal('form'),
  fields: z.array(FormFieldSchema).describe('Form fields'),
  layout: z.enum(['vertical', 'horizontal', 'inline']).optional().default('vertical'),
  columns: z.union([
    z.number(),
    z.object({
      sm: z.number().optional(),
      md: z.number().optional(),
      lg: z.number().optional(),
    })
  ]).optional().default(1).describe('Grid columns (responsive)'),
  
  // Data
  initialValues: z.record(z.string(), z.any()).optional(),
  
  // Submission
  onSubmit: z.any().optional().describe('Submit action'),
  submitText: z.string().optional().default('Submit'),
  submitButton: SchemaNodeSchema.optional(),
  
  // Validation
  validateOnChange: z.boolean().optional().default(true),
  validateOnBlur: z.boolean().optional().default(true),
  
  // Styling
  spacing: z.number().optional().default(4).describe('Field spacing (Tailwind scale)'),
  className: z.string().optional(),
});

// ============================================================================
// Data Display Components (Section 4 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Table Column Schema
 * Column configuration for tables
 */
export const TableColumnSchema = z.object({
  key: z.string().describe('Column key'),
  title: z.union([z.string(), SchemaNodeSchema]).describe('Column header'),
  dataIndex: z.string().optional().describe('Data field path'),
  width: z.union([z.number(), z.string()]).optional(),
  align: z.enum(['left', 'center', 'right']).optional().default('left'),
  fixed: z.enum(['left', 'right']).optional().describe('Fixed column position'),
  sortable: z.boolean().optional().describe('Enable sorting'),
  filterable: z.boolean().optional().describe('Enable filtering'),
  filterType: z.enum(['text', 'select', 'date', 'number']).optional(),
  filterOptions: z.array(SelectOptionSchema).optional(),
  render: SchemaNodeSchema.optional().describe('Custom cell renderer'),
  ellipsis: z.boolean().optional().describe('Truncate long content'),
});

/**
 * Table Pagination Schema
 * Pagination configuration
 */
export const TablePaginationSchema = z.object({
  pageSize: z.number().optional().default(10),
  pageSizeOptions: z.array(z.number()).optional().default([10, 20, 50, 100]),
  showTotal: z.boolean().optional().default(true),
  showSizeChanger: z.boolean().optional().default(true),
});

/**
 * Table Component Schema
 * Data table with sorting, filtering, and pagination
 */
export const TableSchema = BaseSchema.extend({
  type: z.literal('table'),
  columns: z.array(TableColumnSchema).describe('Table columns'),
  data: z.array(z.any()).optional().describe('Table data'),
  dataSource: z.string().optional().describe('API endpoint for data'),
  
  // Features
  sortable: z.boolean().optional().default(true),
  filterable: z.boolean().optional().default(true),
  selectable: z.union([z.boolean(), z.enum(['single', 'multiple'])]).optional(),
  expandable: z.boolean().optional().describe('Expandable rows'),
  
  // Pagination
  pagination: TablePaginationSchema.optional(),
  
  // Styling
  size: z.enum(['sm', 'default', 'lg']).optional().default('default'),
  bordered: z.boolean().optional(),
  striped: z.boolean().optional(),
  hoverable: z.boolean().optional().default(true),
  
  // Events
  onRowClick: z.any().optional(),
  onSelectionChange: z.any().optional(),
  onSortChange: z.any().optional(),
  onFilterChange: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * List Component Schema
 * Vertical list with virtual scrolling
 */
export const ListSchema = BaseSchema.extend({
  type: z.literal('list'),
  items: z.union([
    z.array(z.any()),
    z.object({ dataSource: z.string() })
  ]).describe('List items or data source'),
  renderItem: SchemaNodeSchema.describe('Item template'),
  
  // Features
  virtual: z.boolean().optional().describe('Enable virtual scrolling'),
  infinite: z.boolean().optional().describe('Infinite scroll'),
  
  // Styling
  divided: z.boolean().optional().describe('Show dividers between items'),
  
  // Load more
  loadMore: z.object({
    text: z.string().optional(),
    loading: z.boolean().optional(),
    hasMore: z.boolean().optional(),
    onLoadMore: z.any().optional(),
  }).optional(),
  
  // Empty state
  empty: SchemaNodeSchema.optional(),
  
  className: z.string().optional(),
});

/**
 * Badge Component Schema
 * Status indicator and notification count
 */
export const BadgeSchema = BaseSchema.extend({
  type: z.literal('badge'),
  content: z.union([z.string(), z.number()]).optional().describe('Badge content'),
  variant: z.enum(['default', 'primary', 'success', 'warning', 'error', 'info'])
    .optional()
    .default('default'),
  size: z.enum(['sm', 'default', 'lg']).optional().default('default'),
  dot: z.boolean().optional().describe('Show as dot instead of content'),
  max: z.number().optional().describe('Maximum number to display (e.g., 99+)'),
  showZero: z.boolean().optional().describe('Show badge when content is 0'),
  children: SchemaNodeSchema.optional().describe('Element to badge'),
  className: z.string().optional(),
});

/**
 * Avatar Component Schema
 * User avatar with image, text, or icon fallback
 */
export const AvatarSchema = BaseSchema.extend({
  type: z.literal('avatar'),
  src: z.string().optional().describe('Image URL'),
  alt: z.string().optional().describe('Alt text'),
  fallback: z.string().optional().describe('Fallback text (initials) or icon'),
  size: z.union([
    z.number(),
    z.enum(['sm', 'default', 'lg', 'xl'])
  ]).optional().default('default'),
  shape: z.enum(['circle', 'square']).optional().default('circle'),
  badge: SchemaNodeSchema.optional().describe('Badge overlay'),
  className: z.string().optional(),
});

/**
 * Statistic Component Schema
 * Highlighted numeric data with trends
 */
export const StatisticSchema = BaseSchema.extend({
  type: z.literal('statistic'),
  title: z.union([z.string(), SchemaNodeSchema]).describe('Statistic title'),
  value: z.union([z.number(), z.string()]).describe('Statistic value'),
  prefix: z.union([z.string(), SchemaNodeSchema]).optional(),
  suffix: z.union([z.string(), SchemaNodeSchema]).optional(),
  precision: z.number().optional().describe('Decimal places'),
  formatter: z.function().optional().describe('Custom formatter function'),
  
  // Trend indicators
  trend: z.enum(['up', 'down']).optional(),
  trendValue: z.string().optional(),
  trendColor: z.enum(['success', 'error']).optional(),
  
  // Animation
  countUp: z.boolean().optional().describe('Animated counting'),
  duration: z.number().optional().describe('Animation duration in ms'),
  
  className: z.string().optional(),
});

/**
 * Alert Component Schema
 * Page-level message notifications
 */
export const AlertSchema = BaseSchema.extend({
  type: z.literal('alert'),
  title: z.union([z.string(), SchemaNodeSchema]).optional(),
  description: z.union([z.string(), SchemaNodeSchema]).optional(),
  variant: z.enum(['default', 'success', 'warning', 'error', 'info'])
    .optional()
    .default('default'),
  icon: z.union([z.string(), z.boolean()]).optional().describe('Custom icon or auto icon'),
  closable: z.boolean().optional().describe('Show close button'),
  actions: z.array(SchemaNodeSchema).optional(),
  onClose: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Timeline Event Schema
 * Individual timeline event
 */
export const TimelineEventSchema = z.object({
  id: z.string().describe('Event ID'),
  timestamp: z.string().describe('Event timestamp (ISO 8601)'),
  title: z.union([z.string(), SchemaNodeSchema]).describe('Event title'),
  description: z.union([z.string(), SchemaNodeSchema]).optional(),
  icon: z.union([z.string(), SchemaNodeSchema]).optional(),
  color: z.string().optional(),
  status: z.enum(['pending', 'active', 'completed', 'error']).optional(),
});

/**
 * Timeline Component Schema
 * Chronological event display
 */
export const TimelineSchema = BaseSchema.extend({
  type: z.literal('timeline'),
  items: z.array(TimelineEventSchema).describe('Timeline events'),
  mode: z.enum(['left', 'right', 'alternate']).optional().default('left'),
  pending: z.union([z.string(), SchemaNodeSchema]).optional().describe('Pending item'),
  className: z.string().optional(),
});

// ============================================================================
// Export all schemas
// ============================================================================

/**
 * Union of all functional design component schemas
 */
export const FunctionalDesignComponentSchema = z.union([
  // Foundation
  TextSchema,
  EnhancedButtonSchema,
  IconSchema,
  ImageSchema,
  SeparatorSchema,
  
  // Layout
  ContainerSchema,
  FlexSchema,
  GridSchema,
  CardSchema,
  TabsSchema,
  
  // Form
  EnhancedInputSchema,
  TextareaSchema,
  EnhancedSelectSchema,
  CheckboxSchema,
  RadioGroupSchema,
  SwitchSchema,
  SliderSchema,
  DatePickerSchema,
  FileUploadSchema,
  FormSchema,
  
  // Data Display
  TableSchema,
  ListSchema,
  BadgeSchema,
  AvatarSchema,
  StatisticSchema,
  AlertSchema,
  TimelineSchema,
]);

/**
 * Type inference for functional design components
 */
export type FunctionalDesignComponent = z.infer<typeof FunctionalDesignComponentSchema>;

// ============================================================================
// Feedback Components (Section 5 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Toast Component Schema
 * Lightweight global notification
 */
export const ToastSchema = BaseSchema.extend({
  type: z.literal('toast'),
  title: z.string().optional(),
  description: z.string().optional(),
  variant: z.enum(['default', 'success', 'warning', 'error', 'info'])
    .optional()
    .default('default'),
  duration: z.number().optional().default(3000).describe('Auto-close duration in ms'),
  closable: z.boolean().optional().default(true),
  action: SchemaNodeSchema.optional().describe('Action button'),
  position: z.enum(['top', 'top-right', 'top-left', 'bottom', 'bottom-right', 'bottom-left'])
    .optional()
    .default('top-right'),
});

/**
 * Progress Component Schema
 * Progress indicator (linear or circular)
 */
export const ProgressSchema = BaseSchema.extend({
  type: z.literal('progress'),
  value: z.number().min(0).max(100).describe('Progress value (0-100)'),
  type: z.enum(['linear', 'circular']).optional().default('linear'),
  size: z.enum(['sm', 'default', 'lg']).optional().default('default'),
  color: z.string().optional(),
  showLabel: z.boolean().optional().describe('Show percentage label'),
  label: z.union([z.string(), z.function()]).optional().describe('Custom label or formatter'),
  indeterminate: z.boolean().optional().describe('Indeterminate progress'),
  className: z.string().optional(),
});

/**
 * Spinner Component Schema
 * Loading spinner
 */
export const SpinnerSchema = BaseSchema.extend({
  type: z.literal('spinner'),
  size: z.union([z.number(), z.enum(['sm', 'default', 'lg'])]).optional().default('default'),
  color: z.string().optional(),
  variant: z.enum(['default', 'dots', 'pulse']).optional().default('default'),
  label: z.string().optional().describe('Loading text'),
  className: z.string().optional(),
});

/**
 * Skeleton Component Schema
 * Content loading placeholder
 */
export const SkeletonSchema = BaseSchema.extend({
  type: z.literal('skeleton'),
  variant: z.enum(['text', 'circular', 'rectangular']).optional().default('text'),
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  lines: z.number().optional().describe('Number of text lines'),
  animated: z.boolean().optional().default(true),
  className: z.string().optional(),
});

/**
 * Empty Component Schema
 * Empty state placeholder
 */
export const EmptySchema = BaseSchema.extend({
  type: z.literal('empty'),
  image: z.union([z.string(), SchemaNodeSchema]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  actions: z.array(SchemaNodeSchema).optional(),
  className: z.string().optional(),
});

// ============================================================================
// Disclosure Components (Section 6 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Accordion Item Schema
 */
export const AccordionItemSchema = z.object({
  value: z.string().describe('Unique item identifier'),
  trigger: z.union([z.string(), SchemaNodeSchema]).describe('Trigger content'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Panel content'),
  disabled: z.boolean().optional(),
  icon: z.string().optional(),
});

/**
 * Accordion Component Schema
 * Collapsible panels
 */
export const AccordionSchema = BaseSchema.extend({
  type: z.literal('accordion'),
  items: z.array(AccordionItemSchema).describe('Accordion items'),
  type: z.enum(['single', 'multiple']).optional().default('single').describe('Expansion mode'),
  defaultValue: z.union([z.string(), z.array(z.string())]).optional(),
  collapsible: z.boolean().optional().describe('Allow collapsing all (single mode)'),
  className: z.string().optional(),
});

/**
 * Collapsible Component Schema
 * Single collapsible panel
 */
export const CollapsibleSchema = BaseSchema.extend({
  type: z.literal('collapsible'),
  trigger: SchemaNodeSchema.describe('Trigger element'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Collapsible content'),
  defaultOpen: z.boolean().optional(),
  open: z.boolean().optional().describe('Controlled open state'),
  onOpenChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Toggle Item Schema
 */
export const ToggleItemSchema = z.object({
  value: z.string().describe('Item value'),
  label: z.union([z.string(), SchemaNodeSchema]).describe('Item label'),
  icon: z.string().optional(),
  disabled: z.boolean().optional(),
});

/**
 * ToggleGroup Component Schema
 * Toggle button group
 */
export const ToggleGroupSchema = BaseSchema.extend({
  type: z.literal('toggle-group'),
  type: z.enum(['single', 'multiple']).describe('Selection mode'),
  value: z.union([z.string(), z.array(z.string())]).optional(),
  items: z.array(ToggleItemSchema).describe('Toggle items'),
  size: z.enum(['sm', 'default', 'lg']).optional().default('default'),
  variant: z.enum(['default', 'outline']).optional().default('default'),
  onChange: z.any().optional(),
  className: z.string().optional(),
});

// ============================================================================
// Overlay Components (Section 7 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Dialog Component Schema
 * Modal dialog
 */
export const DialogSchema = BaseSchema.extend({
  type: z.literal('dialog'),
  open: z.boolean().optional(),
  title: z.union([z.string(), SchemaNodeSchema]).optional(),
  description: z.union([z.string(), SchemaNodeSchema]).optional(),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Dialog content'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
  
  // Size
  size: z.enum(['sm', 'default', 'lg', 'xl', 'full']).optional().default('default'),
  
  // Behavior
  closable: z.boolean().optional().default(true),
  closeOnEscape: z.boolean().optional().default(true),
  closeOnOverlayClick: z.boolean().optional().default(true),
  draggable: z.boolean().optional(),
  
  // Events
  onClose: z.any().optional(),
  onConfirm: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * Sheet Component Schema
 * Side drawer
 */
export const SheetSchema = BaseSchema.extend({
  type: z.literal('sheet'),
  open: z.boolean().optional(),
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().default('right'),
  title: z.union([z.string(), SchemaNodeSchema]).optional(),
  description: z.union([z.string(), SchemaNodeSchema]).optional(),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Sheet content'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
  
  // Size
  size: z.union([z.number(), z.string()]).optional().describe('Width/height in px or %'),
  
  // Behavior
  closable: z.boolean().optional().default(true),
  closeOnEscape: z.boolean().optional().default(true),
  closeOnOverlayClick: z.boolean().optional().default(true),
  
  // Events
  onClose: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * Popover Component Schema
 * Lightweight popup card
 */
export const PopoverSchema = BaseSchema.extend({
  type: z.literal('popover'),
  trigger: SchemaNodeSchema.describe('Trigger element'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Popover content'),
  
  // Positioning
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().default('bottom'),
  align: z.enum(['start', 'center', 'end']).optional().default('center'),
  offset: z.number().optional().describe('Offset in pixels'),
  
  // Trigger behavior
  triggerOn: z.enum(['click', 'hover', 'focus']).optional().default('click'),
  
  // Display
  arrow: z.boolean().optional().default(true),
  closeOnClickOutside: z.boolean().optional().default(true),
  
  className: z.string().optional(),
});

/**
 * Tooltip Component Schema
 * Brief help text on hover
 */
export const TooltipSchema = BaseSchema.extend({
  type: z.literal('tooltip'),
  children: SchemaNodeSchema.describe('Trigger element'),
  content: z.union([z.string(), SchemaNodeSchema]).describe('Tooltip content'),
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().default('top'),
  delay: z.number().optional().default(500).describe('Show delay in ms'),
  maxWidth: z.union([z.number(), z.string()]).optional(),
  className: z.string().optional(),
});

/**
 * Menu Item Schema
 */
export const MenuItemSchema: z.ZodType<any> = z.lazy(() => z.object({
  type: z.enum(['item', 'checkbox', 'radio', 'separator', 'label', 'sub']).optional().default('item'),
  label: z.union([z.string(), SchemaNodeSchema]).optional(),
  icon: z.string().optional(),
  shortcut: z.string().optional().describe('Keyboard shortcut hint'),
  disabled: z.boolean().optional(),
  checked: z.boolean().optional().describe('For checkbox/radio items'),
  items: z.array(MenuItemSchema).optional().describe('Submenu items'),
  onClick: z.any().optional(),
}));

/**
 * DropdownMenu Component Schema
 * Dropdown action menu
 */
export const DropdownMenuSchema = BaseSchema.extend({
  type: z.literal('dropdown-menu'),
  trigger: SchemaNodeSchema.describe('Trigger button'),
  items: z.array(MenuItemSchema).describe('Menu items'),
  
  // Positioning
  side: z.enum(['top', 'right', 'bottom', 'left']).optional().default('bottom'),
  align: z.enum(['start', 'center', 'end']).optional().default('start'),
  
  className: z.string().optional(),
});

// ============================================================================
// Navigation Components (Section 8 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Breadcrumb Item Schema
 */
export const BreadcrumbItemSchema = z.object({
  label: z.union([z.string(), SchemaNodeSchema]).describe('Breadcrumb label'),
  href: z.string().optional().describe('Link URL'),
  icon: z.string().optional(),
  onClick: z.any().optional(),
});

/**
 * Breadcrumb Component Schema
 * Hierarchical navigation path
 */
export const BreadcrumbSchema = BaseSchema.extend({
  type: z.literal('breadcrumb'),
  items: z.array(BreadcrumbItemSchema).describe('Breadcrumb items'),
  separator: z.union([z.string(), SchemaNodeSchema]).optional().describe('Custom separator'),
  className: z.string().optional(),
});

/**
 * Pagination Component Schema
 * Page navigation
 */
export const PaginationSchema = BaseSchema.extend({
  type: z.literal('pagination'),
  total: z.number().describe('Total items'),
  page: z.number().optional().default(1).describe('Current page'),
  pageSize: z.number().optional().default(10).describe('Items per page'),
  pageSizeOptions: z.array(z.number()).optional().default([10, 20, 50, 100]),
  
  // Features
  showSizeChanger: z.boolean().optional().default(true),
  showQuickJumper: z.boolean().optional(),
  showTotal: z.union([
    z.boolean(),
    z.function()
  ]).optional().describe('Show total count or custom formatter'),
  
  // Simple mode
  simple: z.boolean().optional().describe('Simplified pagination for mobile'),
  
  // Events
  onChange: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * Nav Link Schema
 */
export const NavLinkSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string().describe('Link ID'),
  label: z.string().describe('Link label'),
  icon: z.string().optional(),
  href: z.string().optional(),
  active: z.boolean().optional(),
  badge: z.union([z.number(), z.string()]).optional(),
  children: z.array(NavLinkSchema).optional().describe('Nested links'),
  onClick: z.any().optional(),
}));

/**
 * Sidebar Component Schema
 * Application sidebar navigation
 */
export const SidebarSchema = BaseSchema.extend({
  type: z.literal('sidebar'),
  items: z.array(NavLinkSchema).describe('Navigation items'),
  collapsed: z.boolean().optional().describe('Collapsed state'),
  width: z.union([z.number(), z.string()]).optional().describe('Expanded width'),
  collapsedWidth: z.union([z.number(), z.string()]).optional().describe('Collapsed width'),
  theme: z.enum(['light', 'dark']).optional(),
  logo: SchemaNodeSchema.optional(),
  footer: SchemaNodeSchema.optional(),
  onCollapse: z.any().optional(),
  className: z.string().optional(),
});

/**
 * HeaderBar Component Schema
 * Application header
 */
export const HeaderBarSchema = BaseSchema.extend({
  type: z.literal('header-bar'),
  logo: SchemaNodeSchema.optional(),
  title: z.union([z.string(), SchemaNodeSchema]).optional(),
  nav: z.array(SchemaNodeSchema).optional().describe('Navigation items'),
  actions: z.array(SchemaNodeSchema).optional().describe('Right-side actions'),
  sticky: z.boolean().optional().describe('Fixed to top'),
  height: z.union([z.number(), z.string()]).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  className: z.string().optional(),
});

// ============================================================================
// Complex Components (Section 9 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * Dashboard Widget Layout Schema
 */
export const DashboardWidgetLayoutSchema = z.object({
  i: z.string().describe('Widget ID'),
  x: z.number().describe('Grid X position'),
  y: z.number().describe('Grid Y position'),
  w: z.number().describe('Grid width'),
  h: z.number().describe('Grid height'),
  minW: z.number().optional(),
  minH: z.number().optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
});

/**
 * Dashboard Widget Schema
 */
export const DashboardWidgetSchema = z.object({
  id: z.string().describe('Widget ID'),
  title: z.string().optional(),
  type: z.string().describe('Widget component type'),
  config: z.any().describe('Widget configuration'),
  refreshInterval: z.number().optional().describe('Auto-refresh interval in ms'),
});

/**
 * Dashboard Component Schema
 * Drag-and-drop dashboard
 */
export const DashboardSchema = BaseSchema.extend({
  type: z.literal('dashboard'),
  widgets: z.array(DashboardWidgetSchema).describe('Dashboard widgets'),
  layout: z.array(DashboardWidgetLayoutSchema).optional().describe('Widget layouts'),
  cols: z.object({
    lg: z.number().optional(),
    md: z.number().optional(),
    sm: z.number().optional(),
  }).optional().describe('Grid columns per breakpoint'),
  rowHeight: z.number().optional().describe('Row height in pixels'),
  editable: z.boolean().optional().describe('Enable layout editing'),
  onLayoutChange: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Kanban Card Schema
 */
export const KanbanCardSchema = z.object({
  id: z.string().describe('Card ID'),
  title: z.string().describe('Card title'),
  description: z.string().optional(),
  assignee: z.object({
    name: z.string(),
    avatar: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Kanban Column Schema
 */
export const KanbanColumnSchema = z.object({
  id: z.string().describe('Column ID'),
  title: z.string().describe('Column title'),
  color: z.string().optional(),
  cards: z.array(KanbanCardSchema).describe('Cards in column'),
  limit: z.number().optional().describe('Maximum cards allowed'),
  collapsible: z.boolean().optional(),
});

/**
 * Kanban Component Schema
 * Kanban board with drag-and-drop
 */
export const KanbanSchema = BaseSchema.extend({
  type: z.literal('kanban'),
  columns: z.array(KanbanColumnSchema).describe('Kanban columns'),
  onCardMove: z.any().optional(),
  onCardClick: z.any().optional(),
  className: z.string().optional(),
});

/**
 * Calendar Event Schema
 */
export const CalendarEventSchema = z.object({
  id: z.string().describe('Event ID'),
  title: z.string().describe('Event title'),
  start: z.string().describe('Start time (ISO 8601)'),
  end: z.string().describe('End time (ISO 8601)'),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Calendar Component Schema
 * Calendar view with events
 */
export const CalendarViewSchema = BaseSchema.extend({
  type: z.literal('calendar-view'),
  mode: z.enum(['month', 'week', 'day', 'agenda']).optional().default('month'),
  events: z.array(CalendarEventSchema).describe('Calendar events'),
  date: z.string().optional().describe('Current date (ISO 8601)'),
  timezone: z.string().optional(),
  
  // Features
  editable: z.boolean().optional(),
  selectable: z.boolean().optional().describe('Allow time slot selection'),
  
  // Events
  onEventClick: z.any().optional(),
  onEventDrop: z.any().optional(),
  onEventResize: z.any().optional(),
  onSelectSlot: z.any().optional(),
  onViewChange: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * Chat Message Schema
 */
export const ChatMessageSchema = z.object({
  id: z.string().describe('Message ID'),
  role: z.enum(['user', 'assistant', 'system']).describe('Message role'),
  content: z.string().describe('Message content'),
  timestamp: z.string().optional(),
  metadata: z.object({
    model: z.string().optional(),
    tokens: z.number().optional(),
    files: z.array(FileMetadataSchema).optional(),
  }).optional(),
});

/**
 * Chatbot Component Schema
 * AI chat interface
 */
export const ChatbotSchema = BaseSchema.extend({
  type: z.literal('chatbot'),
  messages: z.array(ChatMessageSchema).describe('Chat messages'),
  
  // API
  apiEndpoint: z.string().describe('Chat API endpoint'),
  apiHeaders: z.record(z.string(), z.string()).optional(),
  
  // Features
  streaming: z.boolean().optional().describe('Stream responses'),
  fileUpload: z.boolean().optional(),
  codeHighlight: z.boolean().optional(),
  markdown: z.boolean().optional(),
  
  // Styling
  avatar: z.object({
    user: z.string().optional(),
    bot: z.string().optional(),
  }).optional(),
  placeholder: z.string().optional(),
  height: z.union([z.number(), z.string()]).optional(),
  
  // Events
  onSend: z.any().optional(),
  onClear: z.any().optional(),
  
  className: z.string().optional(),
});

// ============================================================================
// Business Components (Section 10 of FUNCTIONAL_DESIGN.md)
// ============================================================================

/**
 * List Column Schema (for ObjectGrid)
 */
export const ListColumnSchema = z.object({
  field: z.string().describe('Field name'),
  label: z.string().optional().describe('Column label'),
  type: z.string().optional().describe('Field type'),
  width: z.union([z.number(), z.string()]).optional(),
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  render: SchemaNodeSchema.optional(),
});

/**
 * Advanced Filter Condition Schema
 */
export const AdvancedFilterConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.any(),
});

/**
 * Query Sort Config Schema
 */
export const QuerySortConfigSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']),
});

/**
 * ObjectGrid Component Schema
 * ObjectQL data grid with CRUD
 */
export const ObjectGridSchema = BaseSchema.extend({
  type: z.literal('object-grid'),
  objectName: z.string().describe('ObjectQL object name'),
  columns: z.array(ListColumnSchema).describe('Grid columns'),
  
  // Data source
  datasource: z.string().optional(),
  filters: z.array(AdvancedFilterConditionSchema).optional(),
  sort: z.array(QuerySortConfigSchema).optional(),
  
  // Features
  selectable: z.boolean().optional(),
  searchable: z.boolean().optional(),
  exportable: z.boolean().optional(),
  importable: z.boolean().optional(),
  
  // Toolbar
  toolbar: z.object({
    showCreate: z.boolean().optional(),
    showDelete: z.boolean().optional(),
    showExport: z.boolean().optional(),
    showImport: z.boolean().optional(),
    customActions: z.array(z.any()).optional(),
  }).optional(),
  
  // Events
  onRowClick: z.any().optional(),
  onSelectionChange: z.any().optional(),
  onCreate: z.any().optional(),
  onUpdate: z.any().optional(),
  onDelete: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * ObjectForm Component Schema
 * ObjectQL object form
 */
export const ObjectFormSchema = BaseSchema.extend({
  type: z.literal('object-form'),
  objectName: z.string().describe('ObjectQL object name'),
  recordId: z.string().optional().describe('Record ID for editing'),
  fields: z.array(z.string()).optional().describe('Fields to display'),
  layout: z.enum(['vertical', 'horizontal']).optional(),
  columns: z.number().optional(),
  
  // Features
  readonly: z.boolean().optional(),
  showLabel: z.boolean().optional(),
  
  // Events
  onSubmit: z.any().optional(),
  onCancel: z.any().optional(),
  onChange: z.any().optional(),
  
  className: z.string().optional(),
});

/**
 * ListView Component Schema
 * ObjectQL list view with view switching
 */
export const ListViewSchema = BaseSchema.extend({
  type: z.literal('list-view'),
  objectName: z.string().describe('ObjectQL object name'),
  viewId: z.string().optional().describe('View ID'),
  viewType: z.enum(['grid', 'list', 'kanban', 'calendar', 'gantt']).optional(),
  
  // Configuration
  columns: z.array(ListColumnSchema).optional(),
  filters: z.array(AdvancedFilterConditionSchema).optional(),
  sort: z.array(QuerySortConfigSchema).optional(),
  groupBy: z.array(z.string()).optional(),
  
  // View switcher
  viewSwitcher: z.boolean().optional(),
  availableViews: z.array(z.string()).optional(),
  
  className: z.string().optional(),
});

// ============================================================================
// Update the main union export
// ============================================================================

/**
 * Complete union of all functional design component schemas
 */
export const CompleteFunctionalDesignSchema = z.union([
  // Foundation
  TextSchema,
  EnhancedButtonSchema,
  IconSchema,
  ImageSchema,
  SeparatorSchema,
  
  // Layout
  ContainerSchema,
  FlexSchema,
  GridSchema,
  CardSchema,
  TabsSchema,
  
  // Form
  EnhancedInputSchema,
  TextareaSchema,
  EnhancedSelectSchema,
  CheckboxSchema,
  RadioGroupSchema,
  SwitchSchema,
  SliderSchema,
  DatePickerSchema,
  FileUploadSchema,
  FormSchema,
  
  // Data Display
  TableSchema,
  ListSchema,
  BadgeSchema,
  AvatarSchema,
  StatisticSchema,
  AlertSchema,
  TimelineSchema,
  
  // Feedback
  ToastSchema,
  ProgressSchema,
  SpinnerSchema,
  SkeletonSchema,
  EmptySchema,
  
  // Disclosure
  AccordionSchema,
  CollapsibleSchema,
  ToggleGroupSchema,
  
  // Overlay
  DialogSchema,
  SheetSchema,
  PopoverSchema,
  TooltipSchema,
  DropdownMenuSchema,
  
  // Navigation
  BreadcrumbSchema,
  PaginationSchema,
  SidebarSchema,
  HeaderBarSchema,
  
  // Complex
  DashboardSchema,
  KanbanSchema,
  CalendarViewSchema,
  ChatbotSchema,
  
  // Business
  ObjectGridSchema,
  ObjectFormSchema,
  ListViewSchema,
]);

/**
 * Type inference for complete functional design components
 */
export type CompleteFunctionalDesignComponent = z.infer<typeof CompleteFunctionalDesignSchema>;
