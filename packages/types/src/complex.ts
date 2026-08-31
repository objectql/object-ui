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

import type {
  DashboardWidget as SpecDashboardWidget,
  DateRangeDefaultRange as SpecDateRangeDefaultRange,
  GlobalFilter as SpecGlobalFilter,
} from '@objectstack/spec/ui';
import type { BaseSchema, SchemaNode } from './base.js';

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
 * Calendar view mode — the registered `calendar-view` renderer's rendered set.
 *
 * `'agenda'` was retired from this union (objectui#5740): no view ever
 * rendered it — the renderer resolved it to the `'month'` default — and no
 * measured app authors it (ADR-0049 enforce-or-remove, the value-level
 * residue of objectui#5667's key-level convergence).
 */
export type CalendarViewMode = 'month' | 'week' | 'day';

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
 * Calendar view component.
 *
 * The authored surface of the registered `calendar-view` renderer, converged
 * on the renderer's measured read set (objectui#5667): the calendar's events
 * are COMPUTED from the node's `data` array plus the five field-name keys
 * below — there is no authorable `events` key. An authored `events` is dropped
 * by design (objectui#4433); this repo's action metadata rides
 * `properties.action`, not a calendar prop.
 *
 * Nine formerly declared keys — `events` (the interface's only required key
 * besides `type`, and the one the renderer refuses), `defaultView`,
 * `defaultDate`, `date`, `views`, `editable`, `onEventCreate`,
 * `onEventUpdate`, `onDateChange` — are RETIRED rather than implemented:
 * none had a read site on the authored-node path, and no measured app authors
 * any of them (ADR-0049 enforce-or-remove, objectui#5667).
 */
export interface CalendarViewSchema extends BaseSchema {
  type: 'calendar-view';
  /**
   * Records to display as events — the renderer computes its events from this
   * array plus the field-name keys below.
   *
   * Redeclared from `BaseSchema` (same `any` type) because a binding
   * expression string is also legal here and resolves to the array before the
   * renderer reads it. A non-array value renders an empty calendar.
   */
  data?: any;
  /**
   * Record field to use for the event title.
   * @default 'title'
   */
  titleField?: string;
  /**
   * Record field containing the event start date/time.
   * @default 'start'
   */
  startDateField?: string;
  /**
   * Record field containing the event end date/time.
   * @default 'end'
   */
  endDateField?: string;
  /**
   * Record field indicating an all-day event.
   * @default 'allDay'
   */
  allDayField?: string;
  /**
   * Record field to use for the event color.
   * @default 'color'
   */
  colorField?: string;
  /**
   * Calendar view mode.
   *
   * {@link CalendarViewMode} equals the renderer's rendered set since
   * objectui#5740 retired `'agenda'`; at runtime the renderer still resolves
   * any off-union value in raw metadata to the `'month'` default.
   * @default 'month'
   */
  view?: CalendarViewMode;
  /**
   * Initial calendar date — an ISO date string when authored as JSON; a
   * `Date` instance is accepted from a React host.
   */
  currentDate?: string | Date;
  /**
   * Show the "New event" affordance; clicking it dispatches a
   * `{ type: 'create' }` action on the node's action channel (objectui#4454).
   * @default false
   */
  allowCreate?: boolean;
  /**
   * Tailwind classes for the calendar container. Redeclared from `BaseSchema`
   * as part of the converged authored surface.
   */
  className?: string;
  /**
   * Event click handler — HOST-ONLY. The renderer forwards it only when the
   * value is a function, which authored JSON can never produce; supply it from
   * a React host (`<SchemaRenderer ... onEventClick={fn} />`).
   */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * View change handler — HOST-ONLY, same rule as {@link CalendarViewSchema.onEventClick}.
   */
  onViewChange?: (view: CalendarViewMode) => void;
}

/**
 * Filter operator
 */
export type FilterBuilderOperator =
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
export interface FilterBuilderCondition {
  /**
   * Field to filter
   */
  field: string;
  /**
   * Filter operator
   */
  operator: FilterBuilderOperator;
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
  conditions: (FilterBuilderCondition | FilterGroup)[];
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
  /**
   * Tailwind classes on the outermost wrapper `div`.
   *
   * READ SITE: `packages/components/src/renderers/complex/filter-builder.tsx:37`
   * — `className={schema.wrapperClass || ''}`.
   *
   * Distinct from {@link BaseSchema.className}, which this renderer applies
   * further in. Declared by objectui#6150.
   */
  wrapperClass?: string;
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
  operators?: FilterBuilderOperator[];
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
   * Option bag forwarded VERBATIM to the underlying embla carousel.
   *
   * READ SITE: `packages/components/src/renderers/complex/carousel.tsx:23` —
   * `opts={schema.opts}`, passed straight through to the `Carousel`
   * primitive, whose own `opts` is embla's `EmblaOptionsType`.
   *
   * ⚠️ Deliberately declared OPEN rather than as the two-key shape the docs
   * page shows (`{ loop?, align? }`). The renderer forwards the whole bag, so
   * every other embla option authored today reaches the library and works;
   * declaring the documented pair would REFUSE those authored documents —
   * a narrowing of a published surface, which is a ruling and not a
   * declaration. objectui#6150 records the capability as it is; picking a
   * narrower shape is escalated with that card.
   */
  opts?: Record<string, unknown>;
  /**
   * Scroll axis.
   *
   * READ SITE: `renderers/complex/carousel.tsx:24` —
   * `orientation={schema.orientation || 'horizontal'}`.
   *
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Tailwind classes applied to EACH slide (not the container — that is
   * {@link BaseSchema.className}).
   *
   * READ SITE: `renderers/complex/carousel.tsx:30` —
   * `className={schema.itemClassName}` on every `CarouselItem`.
   */
  itemClassName?: string;
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
   *
   * @deprecated objectui#5605 — INERT, and not fixable from here. The renderer
   * really does thread this value into `useObjectChat`, which then drops it:
   * the installed chat runtime (`@ai-sdk/react`'s `useChat`) exposes no
   * client-side round-trip cap — the numeric knob was removed from `useChat`,
   * and its successor step cap (`stopWhen` / `stepCountIs`) exists only on the
   * server-side call functions. ObjectUI is backend-agnostic, so it does not
   * own a server loop to cap either. Setting this has never limited anything.
   *
   * Cap tool-calling loops on the agent instead — `planning.maxIterations`,
   * which the platform spec declares and enforces.
   *
   * Still declared and still accepted so documents that already author it keep
   * parsing; authoring it now logs a one-time notice from the chatbot plugin.
   * Slated for removal in a future major (ADR-0049 enforce-or-remove, staged).
   */
  maxToolRoundtrips?: number;
  /**
   * Callback when an error occurs during streaming or API calls.
   */
  onError?: (error: Error) => void;

  // --- Local display + legacy auto-response fields (objectui#6169) ---
  //
  // Lifted from an anonymous inline intersection that used to live ONLY at
  // `packages/plugin-chatbot/src/renderer.tsx`'s `chatbot` registration site
  // (`ComponentRegistry.register('chatbot', ...)`), where nothing outside
  // that one file could reference, validate, or document them. Each key
  // below was read-site-censused before being declared here — every one has
  // a live reader in `renderer.tsx` and/or `useObjectChat.ts`; none were
  // dead. `disabled` is deliberately NOT redeclared in this group: it is
  // already `BaseSchema.disabled` (`boolean | string`), read generically by
  // `SchemaRenderer` for every node type, not specific to `chatbot`.

  /**
   * Display a timestamp on each message.
   * @default false
   */
  showTimestamp?: boolean;
  /**
   * URL of the user's avatar image.
   */
  userAvatarUrl?: string;
  /**
   * Fallback text shown when `userAvatarUrl` is not set or fails to load.
   * @default 'You'
   */
  userAvatarFallback?: string;
  /**
   * URL of the assistant's avatar image.
   */
  assistantAvatarUrl?: string;
  /**
   * Fallback text shown when `assistantAvatarUrl` is not set or fails to load.
   * @default 'AI'
   */
  assistantAvatarFallback?: string;
  /**
   * Maximum height of the chat message container (CSS value).
   * @default '500px'
   */
  maxHeight?: string;
  /**
   * Enable local auto-response (demo/playground) mode. Ignored once `api`
   * is set — API mode replaces the local echo entirely.
   * @default false
   */
  autoResponse?: boolean;
  /**
   * The text of the local auto-response, used when `autoResponse` is true.
   */
  autoResponseText?: string;
  /**
   * Delay in milliseconds before the local auto-response is sent.
   * @default 1000
   */
  autoResponseDelay?: number;
  /**
   * Called after a message is sent, in both API and local auto-response
   * mode, with the trimmed content and the full message list at that
   * point. `messages` here is the same authoring-side {@link ChatMessage}
   * shape as the `messages` field above; the plugin's own runtime message
   * type is a structural superset (objectui#4424) and still satisfies a
   * handler typed against this narrower, published shape.
   */
  onSend?: (content: string, messages: ChatMessage[]) => void;

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
 * objectui COMPONENT types admitted into a dashboard **widget slot** — the
 * CLOSED enum the maintainer ruling of 2026-08-14 (objectstack#8593) directs
 * `metric-card` into, verbatim: *an SDUI dashboard COMPONENT node validates
 * against objectui's own component schema; the spec's `DashboardSchema` governs
 * stored dashboard metadata documents only and grows no component projection;
 * `metric-card` joins objectui's own CLOSED component enum as an explicitly
 * allowed objectui extension, NOT the spec widget enum.*
 *
 * A member here is not a visualization family at all. `classifyWidgetType`
 * (`@object-ui/plugin-dashboard`'s `widgetDispatch.ts`) returns `passthrough`
 * for it, and `DashboardRenderer` then hands `{ ...widget }` straight to
 * `SchemaRenderer`, which resolves it through `ComponentRegistry` — so the
 * widget slot is holding an ordinary objectui SDUI **component node** whose
 * other keys are that component's own props (`value` / `icon` / `trend` /
 * `trendValue` for `metric-card`, declared as registry `inputs` at
 * `plugin-dashboard/src/index.tsx`). Those props are NOT widget keys and must
 * not be added to {@link DashboardWidgetSchema}; a member of this list is
 * validated as a component node against objectui's own passthrough
 * `BaseSchema`, which is what keeps them.
 *
 * ⛔ CLOSED on purpose. The ruling's triage block named an open
 * "extension allowed" hatch as the thing to avoid: an open hatch re-creates
 * exactly the hole the catalog gate exists to close, because a typo'd or
 * retired `type` would keep validating. Adding a member is a deliberate act
 * with a registration behind it — `examples/schema-catalog/test/
 * plugin-dashboard-component-schema.test.ts` is the standing gate, and
 * `__tests__/report-chart-query-spec-parity.test.ts` pins the closure.
 */
export const DASHBOARD_COMPONENT_WIDGET_TYPES = ['metric-card'] as const;

/** An objectui component type legal in a dashboard widget slot. */
export type DashboardComponentWidgetType = (typeof DASHBOARD_COMPONENT_WIDGET_TYPES)[number];

/**
 * objectui-only widget FAMILIES — visualization families objectui renders that
 * `@objectstack/spec`'s `ChartTypeSchema` does not model. Distinct from
 * {@link DASHBOARD_COMPONENT_WIDGET_TYPES} above: these two really are widget
 * types (`classifyWidgetType` routes `list` to the table family and `custom` to
 * the author-supplied-`component` branch), they just have no spec counterpart.
 *
 * The pre-existing divergence, previously carried only as prose on the `type`
 * key ("widened off the spec's enum") and enforced nowhere. If the spec adopts
 * either family, drop it from here and let it flow in from the spec enum.
 */
export const DASHBOARD_WIDGET_TYPE_EXTENSIONS = ['list', 'custom'] as const;

/** An objectui-only dashboard widget family. */
export type DashboardWidgetTypeExtension = (typeof DASHBOARD_WIDGET_TYPE_EXTENSIONS)[number];

/**
 * The CLOSED vocabulary a dashboard widget's `type` may name.
 *
 * The spec half flows in BY REFERENCE (`SpecDashboardWidget['type']`, i.e. the
 * spec's `ChartTypeSchema`) rather than being restated, so a family the spec
 * adds or retires lands here with no edit — the same discipline
 * {@link DashboardWidgetSchema} already uses for its key set. objectui's own
 * two extension sets are spelled out above, each with its own reason.
 *
 * This used to be bare `string`. That was the open hatch: `type: 'metrci-card'`
 * type-checked, validated, and rendered the registry's red OBJUI-001 panel —
 * and `examples/schema-catalog` is an AI few-shot retrieval source, so what it
 * shows is what gets copied.
 *
 * Zod twin: `zod/complex.zod.ts` `DashboardWidgetTypeSchema`.
 */
export type DashboardWidgetTypeName =
  | NonNullable<SpecDashboardWidget['type']>
  | DashboardWidgetTypeExtension
  | DashboardComponentWidgetType;

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
 * Dashboard Widget — DERIVED from `@objectstack/spec/ui`'s `DashboardWidget`
 * (objectstack#4115): every spec key it does not override flows in through the
 * `extends` above, so the key set tracks the protocol instead of being restated.
 *
 * Supports two formats:
 * 1. **Component format** (legacy): `{ id, component: { type, ... }, layout }`
 * 2. **Shorthand format** (@objectstack/spec): `{ type: 'metric'|'bar'|…, options: {…}, layout }`
 *
 * `Partial<>` because the spec requires `id` while stored objectui dashboards
 * (and every widget in the legacy component format) omit it. The `Omit` list is
 * the set of keys objectui deliberately re-types, each explained at its
 * declaration below; anything not listed there is the spec's.
 *
 * Zod twin: `zod/complex.zod.ts` `DashboardWidgetSchema`.
 * Drift guard: `__tests__/report-chart-query-spec-parity.test.ts`.
 */
export interface DashboardWidgetSchema
  extends Omit<Partial<SpecDashboardWidget>, 'type' | 'options' | 'chartConfig' | 'filter'> {
  // `id`, `title`, `description`, `colorVariant`, `dataset`, `dimensions`,
  // `values`, `filterBindings`, `requiresObject`, `requiresService`,
  // `compareTo`, … all flow in from the spec through the `extends` above — do
  // not restate them here.
  //
  // `actionUrl`, `actionType`, `actionIcon` and `aria` flow in too, but as
  // RETIRED keys: @objectstack/spec 17.0.0-rc.3 (objectstack#5010, ADR-0049 D2)
  // turned them into `retiredKey` tombstones, so the spec types them `never`
  // and the Zod twin refuses any value. They inherit as `?: never` — authoring
  // one is a tsc error here and a parse error at validation. Reading one still
  // type-checks (`never | undefined`), which is how objectui's widget config
  // panel kept producing `actionUrl` until objectstack#7129. A dashboard
  // widget's click-through affordance lives in `header.actions[]`, whose own
  // `actionUrl` is unrelated and still live.
  //
  // `responsive` inherits the same way, from a SEPARATE retirement:
  // @objectstack/spec 17.0.0-rc.6 (objectstack#4876, ADR-0049 D2) — so its
  // tombstone message differs from the four above. It was re-typed `any` here
  // on the stated grounds that "the renderer reads a per-breakpoint record";
  // objectui#3173's measurement found zero `widget.responsive` read points in
  // the whole repo and zero authored occurrences in either corpus, so that
  // premise was false and the override only made TS accept a key the Zod twin
  // already refused. The shared `ResponsiveConfig` shape is NOT gone — it
  // stays live on `page.components[].responsive`, which `useResponsiveConfig`
  // really does read.
  // Pinned by `__tests__/report-chart-query-spec-parity.test.ts`.
  /** Component schema (legacy format) — objectui-only, no spec counterpart. */
  component?: SchemaNode;
  layout?: DashboardWidgetLayout;
  /**
   * Widget visualization type (spec shorthand format), or an objectui component
   * type the widget slot holds directly.
   *
   * CLOSED — see {@link DashboardWidgetTypeName}. The spec's families flow in by
   * reference; objectui's additions are the two named, closed extension sets.
   * It was `string` until objectui#4600, which is why a retired family, a typo,
   * or a component type nothing registers all type-checked here and only
   * surfaced as the renderer's red OBJUI-001 panel at runtime.
   */
  type?: DashboardWidgetTypeName;
  /** Widget-specific configuration (spec shorthand format). Kept `unknown` — objectui
   *  renderers pass widget-family-specific bags the spec's `options` object does not model. */
  options?: unknown;
  /** Chart configuration for chart-type widgets */
  chartConfig?: any;
  /**
   * Data binding: filter conditions. Kept `any` — objectui passes an ObjectQL
   * FilterNode array here, not the spec's `FilterCondition` envelope.
   */
  filter?: any;
  /**
   * Enable search input for table-type widgets. objectui-only — no spec counterpart.
   * @default false
   */
  searchable?: boolean;
  /**
   * Enable pagination for table-type widgets. objectui-only — no spec counterpart.
   * @default false
   */
  pagination?: boolean;
}

/**
 * Dashboard Schema
 */
export interface DashboardComponentSchema extends BaseSchema {
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
   *
   * BOUND to `@objectstack/spec`'s `GlobalFilter` rather than restated
   * (objectui#4032, merged scope from the #4163 part-1 audit). It used to be a
   * hand-written inline object literal that happened to carry the same nine
   * keys, and the copy drifted in the one direction that costs the most:
   * `label` was declared `string` here long after the spec widened it (and its
   * `options[].label`) to `I18nLabel`. Because the restatement was NARROWER
   * than the contract, an authored per-locale map was a legal document that
   * objectui's own types said could not exist — so every read site that
   * stringified one was invisible to `tsc`, which is precisely how the filter
   * bar shipped `[object Object]: All` and how `normalizeFilterOptions` shipped
   * a coercion that discarded map labels in every locale.
   *
   * `DashboardWidgetSchema` above already takes this route (`extends
   * Omit<Partial< SpecDashboardWidget >, …>`), which is why the widget half of
   * the same widening WAS compile-visible and got repaired in #4208. Binding is
   * preferred over restating for exactly that asymmetry: the key set and the
   * value vocabularies now track the protocol instead of a snapshot of it.
   */
  globalFilters?: SpecGlobalFilter[];
  /**
   * Date range filter configuration.
   * Aligned with @objectstack/spec DashboardSchema.dateRange.
   *
   * `defaultRange` is BOUND to the spec's `DateRangeDefaultRange` rather than
   * restated (objectui#4984). It used to be a hand-written 14-member union —
   * byte-faithful to the spec, but faithful only until the next spec release:
   * a preset the spec ADDS would be a legal document that objectui's own types
   * say cannot exist, the same "narrower than the contract it implements" shape
   * as objectui#4163's `label`, whose consequence was that the bad reads were
   * invisible to `tsc`. No gate could report the drift either — `check:spec-symbols`
   * rule 1 matches by NAME and an inline union on an interface member has no
   * symbol to collide with, while rule 2's claim heuristic was waved through by
   * the `SpecGlobalFilter` reference a few lines up. Binding makes the "Aligned
   * with" line above structural instead of prose.
   *
   * `DATE_RANGE_DEFAULT_RANGES` is `[...DATE_RANGE_PRESETS, 'custom']`, so this
   * tracks the same vocabulary `@object-ui/core` re-exports by reference
   * (objectui#4167) — one list, reached two ways.
   */
  dateRange?: {
    field?: string;
    defaultRange?: SpecDateRangeDefaultRange;
    allowCustomRange?: boolean;
  };
  // `aria` was DECLARED here until objectui#5830, under a comment claiming
  // alignment with @objectstack/spec AriaPropsSchema — by then the opposite of
  // the contract: the spec removed `dashboard.aria` at the #3896 audit
  // close-out (no dashboard renderer ever applied it), so
  // `DashboardSchema.shape.aria` is a tombstone that refuses any value, the
  // Zod twin (`zod/complex.zod.ts`) inherits that refusal through
  // `SpecDashboardFields`, and `plugin-dashboard` has no `schema.aria` read
  // site. Note `BaseSchema`'s index signature still types an authored `aria`
  // as `any` — this deletion removes the type-level suggestion and the false
  // parity claim, not a key that ever rendered. Pinned by
  // `__tests__/dashboard-aria-retired-contract-twins.test.ts`.
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
  | DashboardComponentSchema;
