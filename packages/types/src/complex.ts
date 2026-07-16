/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Complex Component Schemas
 * 
 * Type definitions for advanced/composite components.
 * 
 * @module complex
 * @packageDocumentation
 */

import type { BaseSchema, SchemaNode } from './base';

/**
 * Kanban column
 */
export interface KanbanColumn {
  /**
   * Unique column identifier
   */
  id: string;
  /**
   * Column title
   */
  title: string;
  /**
   * Column cards/items
   */
  items: KanbanCard[];
  /**
   * Column color/variant
   */
  color?: string;
  /**
   * Maximum number of cards allowed
   */
  limit?: number;
  /**
   * Whether column is collapsed
   */
  collapsed?: boolean;
}

/**
 * Kanban card
 */
export interface KanbanCard {
  /**
   * Unique card identifier
   */
  id: string;
  /**
   * Card title
   */
  title: string;
  /**
   * Card description
   */
  description?: string;
  /**
   * Card labels/tags
   */
  labels?: string[];
  /**
   * Card assignees
   */
  assignees?: string[];
  /**
   * Card due date
   */
  dueDate?: string | Date;
  /**
   * Card priority
   */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /**
   * Custom card content
   */
  content?: SchemaNode | SchemaNode[];
  /**
   * Additional card data
   */
  data?: any;
}

/**
 * Kanban board component
 */
export interface KanbanSchema extends BaseSchema {
  type: 'kanban';
  /**
   * Kanban columns
   */
  columns: KanbanColumn[];
  /**
   * Enable drag and drop
   * @default true
   */
  draggable?: boolean;
  /**
   * Card move handler
   */
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string, position: number) => void;
  /**
   * Card click handler
   */
  onCardClick?: (card: KanbanCard) => void;
  /**
   * Column add handler
   */
  onColumnAdd?: (column: KanbanColumn) => void;
  /**
   * Card add handler
   */
  onCardAdd?: (columnId: string, card: KanbanCard) => void;
}

/**
 * Calendar view mode
 */
export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

/**
 * Calendar event
 */
export interface CalendarEvent {
  /**
   * Unique event identifier
   */
  id: string;
  /**
   * Event title
   */
  title: string;
  /**
   * Event description
   */
  description?: string;
  /**
   * Event start date/time
   */
  start: string | Date;
  /**
   * Event end date/time
   */
  end: string | Date;
  /**
   * Whether event is all day
   */
  allDay?: boolean;
  /**
   * Event color
   */
  color?: string;
  /**
   * Additional event data
   */
  data?: any;
}

/**
 * Calendar view component
 */
export interface CalendarViewSchema extends BaseSchema {
  type: 'calendar-view';
  /**
   * Calendar events
   */
  events: CalendarEvent[];
  /**
   * Default view mode
   * @default 'month'
   */
  defaultView?: CalendarViewMode;
  /**
   * Controlled view mode
   */
  view?: CalendarViewMode;
  /**
   * Default date
   */
  defaultDate?: string | Date;
  /**
   * Controlled date
   */
  date?: string | Date;
  /**
   * Available views
   * @default ['month', 'week', 'day']
   */
  views?: CalendarViewMode[];
  /**
   * Enable event creation
   * @default false
   */
  editable?: boolean;
  /**
   * Event click handler
   */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * Event create handler
   */
  onEventCreate?: (start: Date, end: Date) => void;
  /**
   * Event update handler
   */
  onEventUpdate?: (event: CalendarEvent) => void;
  /**
   * Date change handler
   */
  onDateChange?: (date: Date) => void;
  /**
   * View change handler
   */
  onViewChange?: (view: CalendarViewMode) => void;
}

/**
 * Filter operator
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in';

/**
 * Filter condition
 */
export interface FilterCondition {
  /**
   * Field to filter
   */
  field: string;
  /**
   * Filter operator
   */
  operator: FilterOperator;
  /**
   * Filter value
   */
  value?: any;
}

/**
 * Filter group
 */
export interface FilterGroup {
  /**
   * Logical operator (AND/OR)
   * @default 'and'
   */
  operator: 'and' | 'or';
  /**
   * Filter conditions or nested groups
   */
  conditions: (FilterCondition | FilterGroup)[];
}

/**
 * Filter builder component
 */
export interface FilterBuilderSchema extends BaseSchema {
  type: 'filter-builder';
  /**
   * Available fields for filtering
   */
  fields: FilterField[];
  /**
   * Default filter configuration
   */
  defaultValue?: FilterGroup;
  /**
   * Controlled filter value
   */
  value?: FilterGroup;
  /**
   * Change handler
   */
  onChange?: (filter: FilterGroup) => void;
  /**
   * Allow nested groups
   * @default true
   */
  allowGroups?: boolean;
  /**
   * Maximum nesting depth
   * @default 3
   */
  maxDepth?: number;
}

/**
 * Filter field definition
 */
export interface FilterField {
  /**
   * Field name/key
   */
  name: string;
  /**
   * Field label
   */
  label: string;
  /**
   * Field type
   */
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  /**
   * Available operators for this field
   */
  operators?: FilterOperator[];
  /**
   * Options (for select type)
   */
  options?: { label: string; value: any }[];
}

/**
 * Carousel item
 */
export interface CarouselItem {
  /**
   * Unique item identifier
   */
  id?: string;
  /**
   * Item content
   */
  content: SchemaNode | SchemaNode[];
}

/**
 * Carousel component
 */
export interface CarouselSchema extends BaseSchema {
  type: 'carousel';
  /**
   * Carousel items
   */
  items: CarouselItem[];
  /**
   * Auto-play interval (ms)
   */
  autoPlay?: number;
  /**
   * Show navigation arrows
   * @default true
   */
  showArrows?: boolean;
  /**
   * Show pagination dots
   * @default true
   */
  showDots?: boolean;
  /**
   * Enable infinite loop
   * @default true
   */
  loop?: boolean;
  /**
   * Items visible at once
   * @default 1
   */
  itemsPerView?: number;
  /**
   * Gap between items
   */
  gap?: number;
  /**
   * Slide change handler
   */
  onSlideChange?: (index: number) => void;
}

/**
 * Chatbot message
 */
export interface ChatMessage {
  /**
   * Unique message identifier
   */
  id: string;
  /**
   * Message role
   */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /**
   * Message content
   */
  content: string;
  /**
   * Message timestamp
   */
  timestamp?: string | Date;
  /**
   * Message metadata
   */
  metadata?: any;
  /**
   * Whether this message is currently being streamed
   */
  streaming?: boolean;
  /**
   * Tool invocations associated with this message (for tool-calling flows)
   */
  toolInvocations?: ChatToolInvocation[];
  /**
   * Chain-of-thought / reasoning text emitted alongside the answer.
   * Surfaced by the chatbot UI as a collapsible "Thoughts" panel.
   */
  reasoning?: string;
  /**
   * Optional citation / RAG sources for this assistant message.
   * Surfaced by the chatbot UI as an inline citation panel.
   */
  sources?: ChatMessageSource[];
  /**
   * Optional backend trace id (e.g. the `ai_traces.id` produced by
   * `@objectstack/service-ai`'s auto-tracing) for "view trace" affordances.
   */
  traceId?: string;
}

/**
 * Citation / RAG source attached to a chat message.
 */
export interface ChatMessageSource {
  id?: string;
  title?: string;
  url: string;
}

/**
 * Represents a tool invocation from an AI assistant message
 */
export interface ChatToolInvocation {
  /**
   * Unique tool call identifier
   */
  toolCallId: string;
  /**
   * Name of the tool being invoked
   */
  toolName: string;
  /**
   * Arguments passed to the tool
   */
  args?: Record<string, unknown> | unknown;
  /**
   * Result of the tool invocation (set when complete)
   */
  result?: unknown;
  /**
   * Error text when the tool call ends in an error state.
   */
  errorText?: string;
  /**
   * Tool invocation state. The legacy `partial-call`/`call`/`result` values
   * are kept for back-compat; the AI SDK v6 lifecycle states map cleanly to
   * `input-streaming`/`input-available`/`output-available`/`output-error`
   * and friends and are now accepted directly.
   */
  state?:
    | 'partial-call'
    | 'call'
    | 'result'
    | 'input-streaming'
    | 'input-available'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-available'
    | 'output-error'
    | 'output-denied';
}

/**
 * Chatbot component
 */
export interface ChatbotSchema extends BaseSchema {
  type: 'chatbot';
  /**
   * Chat messages
   */
  messages: ChatMessage[];
  /**
   * Input placeholder
   * @default 'Type a message...'
   */
  placeholder?: string;
  /**
   * Whether chat is loading (thinking)
   */
  loading?: boolean;
  /**
   * Message send handler
   */
  onSendMessage?: (message: string) => void | Promise<void>;
  /**
   * Show avatars
   * @default true
   */
  showAvatars?: boolean;
  /**
   * User avatar
   */
  userAvatar?: string;
  /**
   * Assistant avatar
   */
  assistantAvatar?: string;
  /**
   * Enable markdown rendering
   * @default true
   */
  markdown?: boolean;
  /**
   * How much agent reasoning/tool detail to show.
   * @default 'summary'
   */
  processVisibility?: 'hidden' | 'summary' | 'debug';
  /**
   * Chat height
   */
  height?: string | number;

  // --- AI / service-ai integration fields ---

  /**
   * Backend API endpoint for chat (e.g., '/api/v1/ai/chat').
   * When set, the chatbot uses streaming SSE via the vercel/ai SDK.
   * When not set, the chatbot falls back to local auto-response mode (legacy/demo).
   */
  api?: string;
  /**
   * Conversation ID for multi-turn context.
   * Sent to the backend as an `x-conversation-id` HTTP header.
   */
  conversationId?: string;
  /**
   * System prompt to configure assistant behavior.
   */
  systemPrompt?: string;
  /**
   * AI model identifier (e.g., 'gpt-4o', 'claude-3-opus').
   */
  model?: string;
  /**
   * Whether streaming is enabled for AI responses.
   * @default true
   */
  streamingEnabled?: boolean;
  /**
   * Additional headers to send with API requests (e.g., auth tokens).
   */
  headers?: Record<string, string>;
  /**
   * Additional body parameters to include with each API request.
   */
  requestBody?: Record<string, unknown>;
  /**
   * Maximum number of tool-calling round-trips per user message.
   * @default 5
   */
  maxToolRoundtrips?: number;
  /**
   * Callback when an error occurs during streaming or API calls.
   */
  onError?: (error: Error) => void;

  // --- Floating / FAB display mode ---

  /**
   * Display mode for the chatbot.
   * - `'inline'` (default): Embedded in the page flow.
   * - `'floating'`: Rendered as a floating action button (FAB) that opens a panel overlay.
   */
  displayMode?: 'inline' | 'floating';

  /**
   * Configuration for floating display mode.
   * Only used when `displayMode` is `'floating'`.
   */
  floatingConfig?: FloatingChatbotConfig;
}

/**
 * Configuration for the floating chatbot FAB widget.
 */
export interface FloatingChatbotConfig {
  /**
   * Position of the FAB trigger button.
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left';
  /**
   * Whether the panel is open by default on mount.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Width of the floating panel.
   * @default 400
   */
  panelWidth?: number;
  /**
   * Height of the floating panel.
   * @default 520
   */
  panelHeight?: number;
  /**
   * Title displayed in the panel header.
   * @default 'Chat'
   */
  title?: string;
  /**
   * Custom icon name for the FAB trigger (Lucide icon name).
   * @default 'MessageCircle'
   */
  triggerIcon?: string;
  /**
   * Custom size for the FAB trigger button in pixels.
   * @default 56
   */
  triggerSize?: number;
}

/**
 * Dashboard Widget Layout
 */
export interface DashboardWidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Dashboard Widget
 *
 * Supports two formats:
 * 1. **Component format** (legacy): `{ id, component: { type, ... }, layout }`
 * 2. **Shorthand format** (@objectstack/spec): `{ type: 'metric'|'bar'|…, options: {…}, layout }`
 */
export interface DashboardWidgetSchema {
  id?: string;
  title?: string;
  /** Widget description */
  description?: string;
  /** Component schema (legacy format) */
  component?: SchemaNode;
  layout?: DashboardWidgetLayout;
  /** Widget visualization type (spec shorthand format) */
  type?: string;
  /** Widget-specific configuration (spec shorthand format) */
  options?: unknown;
  /** Chart configuration for chart-type widgets */
  chartConfig?: any;
  /**
   * Widget color variant.
   * Aligned with @objectstack/spec WidgetColorVariantSchema.
   */
  colorVariant?: 'default' | 'blue' | 'teal' | 'orange' | 'purple' | 'success' | 'warning' | 'danger';
  /** Action URL for clickable widgets */
  actionUrl?: string;
  /** Action type for widget interactions */
  actionType?: string;
  /** Action icon name */
  actionIcon?: string;
  /**
   * Data binding: Object name for data source.
   * Aligned with @objectstack/spec DashboardWidgetSchema.object.
   */
  object?: string;
  /**
   * Data binding: Filter conditions.
   * Aligned with @objectstack/spec DashboardWidgetSchema.filter.
   */
  filter?: any;
  /**
   * Data binding: Category field for grouping.
   * Aligned with @objectstack/spec DashboardWidgetSchema.categoryField.
   */
  categoryField?: string;
  /**
   * Date bucket granularity for `categoryField` when it points at a
   * date/datetime field. Aligned with @objectstack/spec
   * DashboardWidgetSchema.categoryGranularity. Without this, time-series
   * charts group by raw timestamp and typically render flat (1 record per
   * bucket).
   */
  categoryGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /**
   * Data binding: Value field for aggregation.
   * Aligned with @objectstack/spec DashboardWidgetSchema.valueField.
   */
  valueField?: string;
  /**
   * Aggregation function.
   * Aligned with @objectstack/spec DashboardWidgetSchema.aggregate.
   */
  aggregate?: string;
  /**
   * Multiple measures for pivot/matrix display.
   * Aligned with @objectstack/spec WidgetMeasureSchema.
   */
  measures?: Array<{
    valueField: string;
    aggregate: string;
    label?: string;
    format?: string;
  }>;
  /**
   * Responsive configuration per breakpoint.
   * Aligned with @objectstack/spec DashboardWidgetSchema.responsive.
   */
  responsive?: any;
  /**
   * Enable search input for table-type widgets.
   * @default false
   */
  searchable?: boolean;
  /**
   * Enable pagination for table-type widgets.
   * @default false
   */
  pagination?: boolean;
  /**
   * Per-widget bindings from a dashboard-level filter (referenced by its
   * `name`, or the reserved name `"dateRange"` for the built-in date range)
   * to one of THIS widget's fields:
   * - string → apply the filter to that field (e.g. `{ dateRange: 'signed_at' }`)
   * - false  → opt this widget out of that filter
   * - absent → default binding: the filter's own `field`
   *   (dateRange: `dateRange.field ?? 'created_at'`)
   * Pending alignment with @objectstack/spec DashboardWidgetSchema
   * (framework#2501).
   */
  filterBindings?: Record<string, string | false>;
  /**
   * ARIA accessibility attributes.
   * Aligned with @objectstack/spec AriaPropsSchema.
   */
  aria?: {
    ariaLabel?: string;
    ariaDescribedBy?: string;
    role?: string;
  };
}

/**
 * Dashboard Schema
 */
export interface DashboardSchema extends BaseSchema {
  type: 'dashboard';
  /** Dashboard title displayed in the header */
  title?: string;
  columns?: number;
  gap?: number;
  widgets: DashboardWidgetSchema[];
  /** Auto-refresh interval in seconds. When set, the dashboard will periodically trigger onRefresh. */
  refreshInterval?: number;
  /**
   * Dashboard header configuration.
   * Aligned with @objectstack/spec DashboardHeaderSchema.
   */
  header?: {
    showTitle?: boolean;
    showDescription?: boolean;
    actions?: Array<{
      label: string;
      actionUrl?: string;
      actionType?: string;
      icon?: string;
    }>;
  };
  /**
   * Global filter configurations.
   * Applied across all dashboard widgets.
   * Aligned with @objectstack/spec GlobalFilterSchema.
   */
  globalFilters?: Array<{
    /**
     * Stable filter name used as the dashboard-variable key and as the key
     * widgets reference in `filterBindings`. Defaults to `field`.
     * Pending alignment with @objectstack/spec GlobalFilterSchema
     * (framework#2501).
     */
    name?: string;
    field: string;
    label?: string;
    type?: 'text' | 'select' | 'date' | 'number' | 'lookup';
    options?: string[];
    optionsFrom?: {
      object: string;
      valueField: string;
      labelField?: string;
      filter?: any;
    };
    defaultValue?: any;
    scope?: string;
    targetWidgets?: string[];
  }>;
  /**
   * Date range filter configuration.
   * Aligned with @objectstack/spec DashboardSchema.dateRange.
   */
  dateRange?: {
    field?: string;
    defaultRange?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month'
      | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year'
      | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom';
    allowCustomRange?: boolean;
  };
  /**
   * ARIA accessibility attributes.
   * Aligned with @objectstack/spec AriaPropsSchema.
   */
  aria?: {
    ariaLabel?: string;
    ariaDescribedBy?: string;
    role?: string;
  };
}

/**
 * Union type of all complex schemas
 */
export type ComplexSchema =
  | KanbanSchema
  | CalendarViewSchema
  | FilterBuilderSchema
  | CarouselSchema
  | ChatbotSchema
  | DashboardSchema;
