/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Complex Component Zod Validators
 * 
 * Zod validation schemas for advanced/composite components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/complex
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';
import { DASHBOARD_COLOR_VARIANTS, DASHBOARD_WIDGET_TYPES } from '../designer.js';

/**
 * Kanban Card Schema
 */
export const KanbanCardSchema = z.object({
  id: z.string().describe('Card ID'),
  title: z.string().describe('Card title'),
  description: z.string().optional().describe('Card description'),
  labels: z.array(z.string()).optional().describe('Card labels'),
  assignees: z.array(z.string()).optional().describe('Card assignees'),
  dueDate: z.union([z.string(), z.date()]).optional().describe('Due date'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Card priority'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Custom content'),
  data: z.any().optional().describe('Custom card data'),
});

/**
 * Kanban Column Schema
 */
export const KanbanColumnSchema = z.object({
  id: z.string().describe('Column ID'),
  title: z.string().describe('Column title'),
  items: z.array(KanbanCardSchema).describe('Column cards'),
  color: z.string().optional().describe('Column color'),
  limit: z.number().optional().describe('Card limit'),
  collapsed: z.boolean().optional().describe('Whether column is collapsed'),
});

/**
 * Kanban Schema - Kanban board component
 */
export const KanbanSchema = BaseSchema.extend({
  type: z.literal('kanban'),
  columns: z.array(KanbanColumnSchema).describe('Kanban columns'),
  draggable: z.boolean().optional().describe('Whether cards are draggable'),
  onCardMove: z.function().optional().describe('Card move handler'),
  onCardClick: z.function().optional().describe('Card click handler'),
  onColumnAdd: z.function().optional().describe('Column add handler'),
  onCardAdd: z.function().optional().describe('Card add handler'),
});

/**
 * Calendar View Mode
 */
export const CalendarViewModeSchema = z.enum(['month', 'week', 'day', 'agenda']);

/**
 * Calendar Event Schema
 */
export const CalendarEventSchema = z.object({
  id: z.string().describe('Event ID'),
  title: z.string().describe('Event title'),
  description: z.string().optional().describe('Event description'),
  start: z.union([z.string(), z.date()]).describe('Event start time'),
  end: z.union([z.string(), z.date()]).describe('Event end time'),
  allDay: z.boolean().optional().describe('Whether event is all-day'),
  color: z.string().optional().describe('Event color'),
  data: z.any().optional().describe('Custom event data'),
});

/**
 * Calendar View Schema - Calendar component
 */
export const CalendarViewSchema = BaseSchema.extend({
  type: z.literal('calendar-view'),
  events: z.array(CalendarEventSchema).describe('Calendar events'),
  defaultView: CalendarViewModeSchema.optional().describe('Default view mode'),
  view: CalendarViewModeSchema.optional().describe('Controlled view mode'),
  defaultDate: z.union([z.string(), z.date()]).optional().describe('Default date'),
  date: z.union([z.string(), z.date()]).optional().describe('Controlled date'),
  views: z.array(CalendarViewModeSchema).optional().describe('Available views'),
  editable: z.boolean().optional().describe('Whether events are editable'),
  onEventClick: z.function().optional().describe('Event click handler'),
  onEventCreate: z.function().optional().describe('Event create handler'),
  onEventUpdate: z.function().optional().describe('Event update handler'),
  onDateChange: z.function().optional().describe('Date change handler'),
  onViewChange: z.function().optional().describe('View change handler'),
});

/**
 * Filter Operator Enum
 */
export const FilterOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
]);

/**
 * Filter Condition Schema
 */
export const FilterConditionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    field: z.string().describe('Field name'),
    operator: FilterOperatorSchema.describe('Filter operator'),
    value: z.any().optional().describe('Filter value'),
  })
);

/**
 * Filter Group Schema
 */
export const FilterGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    operator: z.enum(['and', 'or']).describe('Group operator'),
    conditions: z.array(z.union([FilterConditionSchema, FilterGroupSchema])).describe('Conditions or sub-groups'),
  })
);

/**
 * Filter Field Schema
 */
export const FilterFieldSchema = z.object({
  name: z.string().describe('Field name'),
  label: z.string().describe('Field label'),
  type: z.enum(['string', 'number', 'date', 'boolean', 'select']).describe('Field type'),
  operators: z.array(FilterOperatorSchema).optional().describe('Available operators'),
  options: z.array(z.object({
    label: z.string(),
    value: z.any(),
  })).optional().describe('Options for select type'),
});

/**
 * Filter Builder Schema - Filter builder component
 */
export const FilterBuilderSchema = BaseSchema.extend({
  type: z.literal('filter-builder'),
  fields: z.array(FilterFieldSchema).describe('Available filter fields'),
  defaultValue: z.union([FilterConditionSchema, FilterGroupSchema]).optional().describe('Default filter value'),
  value: z.union([FilterConditionSchema, FilterGroupSchema]).optional().describe('Controlled filter value'),
  onChange: z.function().optional().describe('Change handler'),
  allowGroups: z.boolean().optional().describe('Allow grouped conditions'),
  maxDepth: z.number().optional().describe('Maximum nesting depth'),
});

/**
 * Carousel Item Schema
 */
export const CarouselItemSchema = z.object({
  id: z.string().optional().describe('Item ID'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Item content'),
});

/**
 * Carousel Schema - Carousel component
 */
export const CarouselSchema = BaseSchema.extend({
  type: z.literal('carousel'),
  items: z.array(CarouselItemSchema).describe('Carousel items'),
  autoPlay: z.number().optional().describe('Auto-play interval (ms)'),
  showArrows: z.boolean().optional().describe('Show navigation arrows'),
  showDots: z.boolean().optional().describe('Show navigation dots'),
  loop: z.boolean().optional().describe('Enable infinite loop'),
  itemsPerView: z.number().optional().describe('Items per view'),
  gap: z.number().optional().describe('Gap between items'),
  onSlideChange: z.function().optional().describe('Slide change handler'),
});

/**
 * Chat Message Schema
 */
export const ChatMessageSchema = z.object({
  id: z.string().describe('Message ID'),
  role: z.enum(['user', 'assistant', 'system']).describe('Message role'),
  content: z.string().describe('Message content'),
  timestamp: z.union([z.string(), z.date()]).optional().describe('Message timestamp'),
  metadata: z.record(z.string(), z.any()).optional().describe('Custom metadata'),
});

/**
 * Chatbot Schema - Chatbot component
 */
export const ChatbotSchema = BaseSchema.extend({
  type: z.literal('chatbot'),
  messages: z.array(ChatMessageSchema).describe('Chat messages'),
  placeholder: z.string().optional().describe('Input placeholder'),
  loading: z.boolean().optional().describe('Whether chat is loading'),
  onSendMessage: z.function().optional().describe('Send message handler'),
  showAvatars: z.boolean().optional().describe('Show user avatars'),
  userAvatar: z.string().optional().describe('User avatar URL'),
  assistantAvatar: z.string().optional().describe('Assistant avatar URL'),
  markdown: z.boolean().optional().describe('Enable markdown rendering'),
  height: z.union([z.string(), z.number()]).optional().describe('Chatbot height'),
});

/**
 * Dashboard Widget Layout Schema
 */
export const DashboardWidgetLayoutSchema = z.object({
  x: z.number().describe('Grid x position'),
  y: z.number().describe('Grid y position'),
  w: z.number().describe('Grid width'),
  h: z.number().describe('Grid height'),
});

/**
 * Dashboard Widget Schema
 *
 * Supports two formats:
 * 1. Component format (legacy): `{ id, component: { type, ... }, layout }`
 * 2. Shorthand format (@objectstack/spec): `{ type: 'metric'|'bar'|…, options: {…}, layout }`
 */
export const DashboardWidgetSchema = z.object({
  id: z.string().optional().describe('Widget ID'),
  title: z.string().optional().describe('Widget Title'),
  component: SchemaNodeSchema.optional().describe('Widget Component (legacy format)'),
  layout: DashboardWidgetLayoutSchema.optional().describe('Widget Layout'),
  type: z.string().optional().describe('Widget visualization type (spec shorthand)'),
  options: z.unknown().optional().describe('Widget specific configuration (spec shorthand)'),
});

/**
 * Dashboard Schema - Dashboard component
 */
export const DashboardSchema = BaseSchema.extend({
  type: z.literal('dashboard'),
  columns: z.number().optional().describe('Number of columns'),
  gap: z.number().optional().describe('Grid gap'),
  widgets: z.array(DashboardWidgetSchema).describe('Dashboard widgets'),
});

/**
 * Dashboard Widget Config Schema (for DashboardConfigPanel)
 */
export const DashboardWidgetConfigSchema = z.object({
  id: z.string().describe('Widget ID'),
  title: z.string().optional().describe('Widget title'),
  description: z.string().optional().describe('Widget description'),
  type: z.enum(DASHBOARD_WIDGET_TYPES).optional().describe('Widget visualization type'),
  object: z.string().optional().describe('Data source object name'),
  filter: z.array(z.any()).optional().describe('Widget filter conditions'),
  categoryField: z.string().optional().describe('Category/x-axis field'),
  valueField: z.string().optional().describe('Value/y-axis field'),
  aggregate: z.string().optional().describe('Aggregation function'),
  chartConfig: z.any().optional().describe('Chart configuration'),
  colorVariant: z.enum(DASHBOARD_COLOR_VARIANTS).optional().describe('Color variant'),
  layout: DashboardWidgetLayoutSchema.optional().describe('Widget grid layout'),
  actionUrl: z.string().optional().describe('Clickable action URL'),
});

/**
 * Dashboard Config Schema — Zod validator for DashboardConfigPanel data model.
 *
 * Validates the unified dashboard configuration used by create/edit workflows.
 */
export const DashboardConfigSchema = z.object({
  id: z.string().optional().describe('Dashboard identifier'),
  title: z.string().optional().describe('Dashboard title'),
  description: z.string().optional().describe('Dashboard description'),
  columns: z.number().min(1).max(24).optional().describe('Grid columns (1-24)'),
  gap: z.number().min(0).optional().describe('Grid gap in pixels'),
  refreshInterval: z.number().min(0).optional().describe('Auto-refresh interval in seconds'),
  widgets: z.array(DashboardWidgetConfigSchema).optional().describe('Dashboard widgets'),
  globalFilters: z.array(z.any()).optional().describe('Global filter conditions'),
  dateRange: z.object({
    enabled: z.boolean().optional(),
    field: z.string().optional(),
    presets: z.array(z.string()).optional(),
  }).optional().describe('Date range filter'),
  userFilters: z.array(z.object({
    field: z.string(),
    label: z.string().optional(),
    type: z.string().optional(),
  })).optional().describe('User-selectable filters'),
  showHeader: z.boolean().optional().describe('Show dashboard header'),
  showFilters: z.boolean().optional().describe('Show global filter bar'),
  showDateRange: z.boolean().optional().describe('Show date range picker'),
  headerActions: z.array(z.object({
    label: z.string(),
    action: z.string().optional(),
    icon: z.string().optional(),
    variant: z.string().optional(),
  })).optional().describe('Header action buttons'),
  aria: z.object({
    label: z.string().optional(),
    description: z.string().optional(),
  }).optional().describe('ARIA accessibility attributes'),
});

/**
 * Complex Schema Union - All complex component schemas
 */
export const ComplexSchema = z.discriminatedUnion('type', [
  KanbanSchema,
  CalendarViewSchema,
  FilterBuilderSchema,
  CarouselSchema,
  ChatbotSchema,
  DashboardSchema,
]);
