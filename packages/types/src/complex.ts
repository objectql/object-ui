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
 * Kanban column — the DECLARATIVE (authoring / validation) face.
 *
 * ## Why the name carries a `Declarative` prefix (objectui#6172)
 *
 * This trio and `@object-ui/plugin-kanban`'s `KanbanCard` / `KanbanColumn` /
 * `KanbanSchema` were two declarations of one set of names, in two dialects.
 * The 2026-08-31 maintainer ruling (决裁批 #14, option A) settled the authority:
 * **the plugin KEEPS the bare names**, because those are what all four
 * registered kanban renderers (`kanban`, `kanban-ui`, `kanban-enhanced`,
 * `object-kanban`) consume, and objectui#6086 measured the failure mode of
 * getting that backwards — an IDE or agent auto-importing the bare name picks
 * whichever copy sorts first, and the wrong one produces a **confident empty
 * board** instead of an abstention. So the surviving bare name has to be the
 * one a renderer honours.
 *
 * What survives here is the face this package really serves: the authoring
 * shape and its Zod mirror (`zod/complex.zod.ts`), which is the `'kanban'` arm
 * of `ComplexSchema` → `AnyComponentSchema` → `safeValidateSchema` and so
 * validates every authored `{ "type": "kanban" }` document the CLI's
 * `validate` / `check` commands see. Renaming rather than retiring was the
 * ruled outcome; ⛔ do not re-point these at the plugin — `@object-ui/types` is
 * the zero-workspace-dependency bottom layer and cannot depend on a plugin.
 */
export interface DeclarativeKanbanColumn {
  /**
   * Unique column identifier
   */
  id: string;
  /**
   * Column title
   */
  title: string;
  /**
   * Cards in this column.
   *
   * Named `cards` because that is what every board reads and every authored
   * document writes: `KanbanImpl` (12 lines), `KanbanEnhanced` (8) and
   * `bucketCardsIntoColumns` all read `column.cards`, and the two catalog
   * entries, the plugin docs and `content/docs/api/schema-reference.md` all
   * author it. This member was spelled `items` until objectui#6939 — a
   * spelling with zero read sites, which made every authored board fail
   * `safeValidateSchema` while rendering correctly (objectui#6318's bucket).
   */
  cards: DeclarativeKanbanCard[];
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
export interface DeclarativeKanbanCard {
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
export interface DeclarativeKanbanSchema extends BaseSchema {
  type: 'kanban';
  /**
   * Kanban columns
   */
  columns: DeclarativeKanbanColumn[];
  /**
   * Enable drag and drop
   * @default true
   */
  draggable?: boolean;
  /**
   * Card move handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * forwarded by `plugin-kanban` (`onCardMove={schema.onCardMove}`).
   */
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string, position: number) => void;
  /**
   * Card click handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * forwarded by `plugin-kanban` (`onCardClick={schema.onCardClick}`).
   */
  onCardClick?: (card: DeclarativeKanbanCard) => void;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `kanban` renderer takes `({ schema })` and never reads it. The zod twin
   * refuses it by name; author behaviour as a node type (`{ "type": "toast" }`,
   * an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onColumnAdd?: never;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `kanban` renderer takes `({ schema })` and never reads it. The zod twin
   * refuses it by name; author behaviour as a node type (`{ "type": "toast" }`,
   * an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onCardAdd?: never;
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
   *
   * RUNTIME SLOT (objectui#7344, the objectui#6124 shape) — the zod twin, which
   * declared `z.function()` in a multi-line spelling PR #7339's census missed,
   * now refuses this key by name, like `onViewChange` below.
   */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * View change handler — HOST-ONLY, same rule as {@link
   * CalendarViewSchema.onEventClick}.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * read by `calendar-view`'s `pickHostCallbacks` off the spread props
   * (function values only).
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
 * Filter group — the shape `FilterBuilder` reads (objectui#6939, the
 * `filter-builder` group; maintainer ruling 2026-09-02, director seat summon
 * #8, verbatim 「同意」).
 *
 * The gate is `isValidGroup`,
 * `packages/components/src/custom/filter-builder.tsx:1060`:
 * `Array.isArray(v.conditions) && (v.logic === "and" || v.logic === "or")`.
 * `logic` is the read key; the former `operator` on this face had zero read
 * sites, and a group spelled that way fails the gate, falls back to
 * `EMPTY_GROUP` and renders an EMPTY board.
 */
export interface FilterGroup {
  /**
   * Group id.
   *
   * OPTIONAL on purpose. `isValidGroup` never consults it and nothing reads
   * `filterGroup.id`; measured, deleting it from an authored group renders
   * byte-identically. It is declared because the component's own `FilterGroup`
   * carries it, `EMPTY_GROUP` emits it and it round-trips out through
   * `onChange` — so a document that carries it should be TYPE-CHECKED on it
   * rather than admitted unvalidated.
   */
  id?: string;
  /**
   * How the conditions combine — the key `isValidGroup` reads.
   * @default 'and'
   */
  logic: 'and' | 'or';
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
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `filter-builder` renderer as `props.onChange` after
   * `SchemaRenderer` spreads it.
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
 * Filter field definition — one entry of `FilterBuilderSchema.fields`
 * (objectui#6939, same ruling).
 *
 * Renamed from `name` to `value`: every read site matches on `value`
 * (`fields.find((f) => f.value === …)` in `getOperatorsForField`,
 * `changeField`, `getInputType` and `renderValueInput`; `fields[0]?.value` in
 * `addCondition`; `<SelectItem value={field.value}>` in the field dropdown),
 * `name` had zero, and `FilterBuilderProps.fields` in
 * `packages/components/src/custom/filter-builder.tsx` already declares
 * `Array<{ value, label, type? }>`.
 */
export interface FilterField {
  /**
   * Field key — the identity the builder matches a condition's `field`
   * against, and the value its field dropdown puts on each option.
   */
  value: string;
  /**
   * Field label
   */
  label: string;
  /**
   * Field type — the value FAMILY the column is edited in.
   *
   * The six ruled members are `FilterValueFamily`
   * (`custom/filter-builder.tsx:406`) and each draws a distinct control:
   * `<input type>` `text` / `number` / `date` / `datetime-local` / `time`, and
   * for `boolean` a two-item Select and no input at all. `string` left this
   * union as a phantom — it reached the text control by the unrecognised-word
   * fallthrough, indistinguishable from a nonsense spelling, while `text` is
   * what the registration's `defaultProps` and every catalog entry author.
   *
   * `select` is RETAINED against a literal reading of the ruling's six:
   * `selectLikeTypes` gives it its own operator bucket and the option-driven
   * Select, so dropping it would refuse a live spelling. `status`, `currency`,
   * `percent`, `rating`, `lookup`, `master_detail` and `user` are live too and
   * are still absent — a pre-existing gap reported on objectui#6939, not a
   * regression introduced here.
   */
  type: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'select';
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
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `carousel` renderer spreads it onto a `<div>` that has no such event (React
   * attaches nothing). The zod twin refuses it by name; author behaviour as a
   * node type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onSlideChange?: never;
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
  /**
   * Per-message avatar image URL, overriding the chatbot-level
   * `userAvatarUrl` / `assistantAvatarUrl` for this one message.
   *
   * READ SITE: `packages/plugin-chatbot/src/index.tsx:173–174` —
   * `message.avatar || userAvatarUrl` on a user message and
   * `message.avatar || assistantAvatarUrl` on an assistant one; the
   * authoring-to-runtime seam (`chatMessageAdapter.ts`, `...passthrough`)
   * carries it untouched. Undeclared until objectui#7295: this interface has
   * no index signature (objectui#5155 — and must not gain one), so an author
   * annotating `ChatbotSchema.messages` was told a value that renders is an
   * error (TS2353), and the zod mirror — a plain strip-mode `z.object` —
   * dropped it at parse. objectui#4424's `RuntimeOnlyMessageKeys` named only
   * the three keys API mode lifts out of the stream, never the two a human
   * author writes by hand.
   */
  avatar?: string;
  /**
   * Per-message avatar fallback text (initials), shown when `avatar` is unset
   * or fails to load; overrides the chatbot-level `userAvatarFallback` /
   * `assistantAvatarFallback` for this one message.
   *
   * READ SITE: `packages/plugin-chatbot/src/index.tsx:177–178` —
   * `message.avatarFallback || userAvatarFallback` on a user message and
   * `message.avatarFallback || assistantAvatarFallback` on an assistant one.
   * Same history as `avatar` above (objectui#7295).
   */
  avatarFallback?: string;
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
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `chatbot` renderer wires its own `handleSendMessage` and `toDomProps` drops
   * the key. The zod twin refuses it by name; author behaviour as a node type
   * (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onSendMessage?: never;
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
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * forwarded by `plugin-chatbot` into `useObjectChat({ onError })`.
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
   * Called after a message is sent, in both API and local auto-response mode,
   * with the trimmed content and the full message list at that point.
   * `messages` here is the same authoring-side {@link ChatMessage} shape as the
   * `messages` field above; the plugin's own runtime message type is a
   * structural superset (objectui#4424) and still satisfies a handler typed
   * against this narrower, published shape.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * forwarded by `plugin-chatbot` into `useObjectChat({ onSend })`.
   */
  onSend?: (content: string, messages: ChatMessage[]) => void;

  // --- Floating / FAB configuration ---

  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `displayMode` (objectui#7654, maintainer
   * ruling B, 2026-09-05). Write the node `type` instead: `'chatbot-floating'`
   * for the trigger-and-panel presentation, `'chatbot'` / `'chatbot-enhanced'`
   * for an inline one. The node's `type` is the one selector of presentation;
   * this key was a second spelling of that choice that no renderer has ever
   * read.
   *
   * What was measured, on the retiring PR's base: `displayMode` was declared
   * here and on {@link ChatbotFloatingSchema}, offered as a "Display Mode"
   * control in the `chatbot-floating` registration's `inputs`, and seeded as
   * `'floating'` by that registration's `defaultProps` — and read by nothing.
   * `chatbot-floating` renders `<FloatingChatbot>` unconditionally and
   * `chatbot` never looked at the key, so `'floating'` on a `chatbot` node
   * produced no trigger and `'inline'` on a `chatbot-floating` node changed
   * nothing. A whole-repo `git grep` census over tracked files, build output
   * excluded, returned those sites, the doc comments and ledger entries beside
   * them, one historical CHANGELOG line and two unrelated `displayMode` props
   * (`GridField`, `MasterDetailForm`); the same pass over `floatingConfig`, a
   * key that IS read, returned 79 lines, so the instrument was not blind. The
   * control and the seed are removed in the same change; the restatement of
   * that control is this tombstone plus the release note (objectui#7070: a
   * control is restated, never deleted into a vacuum).
   *
   * ## Why a tombstone — discriminator prong 2 — and why it is loud-vs-silent here
   *
   * A `?: never` tombstone is available only on a surviving carrier
   * (`ChatbotSchema` survives) and is used when either prong of this package's
   * discriminator holds: it steers authors to a named live replacement KEY,
   * or it keeps loud a key the docs taught as working. Prong 2 holds: the key
   * was advertised in the 3.3.0 release record (`CHANGELOG.md:578`, "Extended
   * `ChatbotSchema` with `displayMode` (`'inline' | 'floating'`) …") and its
   * published comment told authors it selected the presentation. Prong 1 is
   * not met by the letter — the replacement is the discriminant `type`, not a
   * new key — which is why the guidance above names `type`.
   *
   * On a carrier extending {@link BaseSchema} — every component schema in this
   * package — deleting an optional member is SILENT in every value shape,
   * because the `[key: string]: any` index signature defeats both
   * excess-property checking and the weak-type check. Measured on THIS member
   * with `tsc -p tsconfig.test.json`, a no-index-signature control carrier
   * (`FloatingChatbotConfig`) lit in the same run (TS2353 on a fresh undeclared
   * key, TS2559 on a lone-key widened value):
   *
   *   | route      | fresh `'floating'` | fresh `'bogus'` | widened `'floating'` |
   *   |------------|--------------------|-----------------|----------------------|
   *   | declared   | clean              | TS2322          | clean                |
   *   | DELETED    | clean              | clean           | clean                |
   *   | TOMBSTONED | TS2322             | TS2322          | TS2322               |
   *
   * Deleted, the member reads as `any` through the index signature and even a
   * wrong-typed value goes quiet. Tombstoned, PRESENCE with any value is a
   * compile error — a channel deletion cannot produce on this carrier at all:
   * on a `BaseSchema` carrier the two routes are loud-vs-silent, not
   * louder-vs-quieter. Pinned, the deleted row included as a live control, in
   * `__tests__/chatbot-display-mode-retired.test.ts`.
   *
   * ## Runtime: unchanged, deliberately — zero validation before and after
   *
   * There is NO `retirementTombstone()` half. `displayMode` has never had a
   * Zod arm: it sits in the `UnmirroredDeclared` ledger for both
   * `complex.zod.ts#ChatbotSchema` and `#ChatbotFloatingSchema`
   * (`__tests__/zod-mirror-parity.test.ts`), and `BaseSchema` is
   * `.passthrough()`, so a stored document carrying `displayMode: 'floating'`
   * — every node the designer ever created — parsed green before this change
   * and parses green after it, and the value is dropped at render time as it
   * always was. Minting an arm to refuse it would be the declared-but-
   * unmirrored axis (objectui#6152); the retirement test pins both twins'
   * shapes as a tripwire so that whoever mints the mirror adds the
   * `retirementTombstone()` half at that time.
   *
   * @deprecated Not part of this contract — the value was inert. The node
   * `type` selects the presentation.
   */
  displayMode?: never;

  /**
   * Configuration for the floating action button and the panel it opens —
   * read by `chatbot-floating` alone and forwarded to `<FloatingChatbot>`.
   */
  floatingConfig?: FloatingChatbotConfig;
}

/**
 * The chat-surface keys that ALL THREE `plugin-chatbot` registrations read
 * (objectui#7655) — the members {@link ChatbotEnhancedSchema} and
 * {@link ChatbotFloatingSchema} pick off {@link ChatbotSchema} by name, so the
 * three faces share ONE declaration and ONE doc comment per key.
 *
 * Every member was read-site-censused per registration on the PR's base: one
 * NAMED `schema.KEY` read in each of the three `ComponentRegistry.register(...)`
 * bodies of `packages/plugin-chatbot/src/renderer.tsx`, forwarded into
 * `useObjectChat` or onto the rendered component. (Named reads are the
 * instrument; the `chatbot-floating` registration also has an unfiltered
 * props spread — see {@link ChatbotFloatingSchema}.) The instrument was lit by
 * keys that are NOT shared — `processVisibility` read 0 / 1 / 0 across
 * `chatbot` / `chatbot-enhanced` / `chatbot-floating` and `floatingConfig`
 * 0 / 0 / 1 — so a zero in that census is a reading, not a blind grep.
 *
 * Exported only because an exported interface may not extend a `Pick` over a
 * private name (TS4022). It is a census, not an authoring face, and it is not
 * re-exported from the package entry: the node types are.
 */
export type ChatbotSharedKey =
  | 'messages'
  | 'placeholder'
  | 'api'
  | 'conversationId'
  | 'systemPrompt'
  | 'model'
  | 'streamingEnabled'
  | 'headers'
  | 'requestBody'
  | 'maxToolRoundtrips'
  | 'onError'
  | 'showTimestamp'
  | 'userAvatarUrl'
  | 'userAvatarFallback'
  | 'assistantAvatarUrl'
  | 'assistantAvatarFallback'
  | 'autoResponse'
  | 'autoResponseText'
  | 'autoResponseDelay'
  | 'onSend';

/**
 * `chatbot-enhanced` component — the authoring face of the
 * `ComponentRegistry.register('chatbot-enhanced', ...)` registration in
 * `packages/plugin-chatbot/src/renderer.tsx` (objectui#7655, under the
 * objectui#6169 / #6172 family ruling: every component node has exactly one
 * named, importable authoring-face type).
 *
 * Until objectui#7655 this node had no importable type: {@link ChatbotSchema}
 * pins `type` to `'chatbot'`, so an author either dropped to untyped JSON or
 * annotated with `ChatbotSchema` and lied about `type`. The registration's
 * parameter type was an anonymous `ChatbotSchema & { ... }` intersection
 * local to the renderer, referenceable by nothing outside that file.
 *
 * What is declared here is what THIS registration reads — censused per key on
 * the PR's base, not copied off `ChatbotSchema`:
 *
 *   - the twenty {@link ChatbotSharedKey} members every registration reads;
 *   - `maxHeight` and `processVisibility`, which `chatbot-enhanced` forwards to
 *     `<ChatbotEnhanced>` by name and `chatbot-floating` has no named read for
 *     (its panel is sized by `floatingConfig.panelHeight`; for the second,
 *     unnamed channel on that registration see {@link ChatbotFloatingSchema});
 *   - `enableMarkdown`, `enableFileUpload`, `surface` and the `onClear`
 *     runtime slot, which `ChatbotSchema` never declared.
 *
 * NOT declared, on purpose: `loading`, `showAvatars`, `userAvatar`,
 * `assistantAvatar`, `markdown` and `height` — `ChatbotSchema` members this
 * registration has no read for. `disabled` and `className` are inherited from
 * {@link BaseSchema}: `SchemaRenderer` evaluates `disabled` / `disabledOn`
 * for every node type and hands the verdict to the registration as a prop, so
 * redeclaring `disabled` here as `boolean` would only narrow away the
 * expression-string half of an inherited field (objectui#6169, #7087).
 */
export interface ChatbotEnhancedSchema
  extends BaseSchema,
    Pick<ChatbotSchema, ChatbotSharedKey | 'maxHeight' | 'processVisibility'> {
  type: 'chatbot-enhanced';
  /**
   * Render assistant messages as markdown. Forwarded to `<ChatbotEnhanced>`'s
   * `enableMarkdown` prop; an unauthored value falls back to `true` at the
   * registration (`schema.enableMarkdown ?? true`).
   * @default true
   */
  enableMarkdown?: boolean;
  /**
   * Show the file-attachment control in the composer. Forwarded to
   * `<ChatbotEnhanced>`'s `enableFileUpload` prop; an unauthored value falls
   * back to `false` at the registration.
   * @default false
   */
  enableFileUpload?: boolean;
  /**
   * Visual chrome for the chat surface (objectui#6687, maintainer ruling
   * 2026-08-29). `'card'` keeps the embeddable bordered panel; `'plain'`
   * removes the panel chrome for a full-page chat workspace. Declared on this
   * node only: `chatbot-enhanced` is the one registration that renders
   * `<ChatbotEnhanced>` and has a `surface` prop to forward it to. Passed
   * through `undefined` when unauthored, so the component's own `'card'`
   * default keeps applying.
   *
   * The plugin's `ChatbotSurface` alias (`@object-ui/plugin-chatbot`) is the
   * component-side spelling of this same union; the plugin's tests pin the
   * two equal so they cannot drift into two dialects (AGENTS.md #0.1).
   * @default 'card'
   */
  surface?: 'card' | 'plain';
  /**
   * Called after the conversation is cleared through the composer's clear
   * control, once the chat runtime has dropped its messages.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because
   * `plugin-chatbot`'s `handleClear` invokes `schema.onClear?.()`.
   */
  onClear?: () => void;
}

/**
 * `chatbot-floating` component — the authoring face of the
 * `ComponentRegistry.register('chatbot-floating', ...)` registration
 * (objectui#7655; same ruling and same census discipline as
 * {@link ChatbotEnhancedSchema}). The floating-action-button presentation: a
 * trigger in a page corner that opens a chat panel overlay.
 *
 * Declared here is what THIS registration reads by name (`schema.KEY`),
 * censused per key on the PR's base:
 *
 *   - the twenty {@link ChatbotSharedKey} members;
 *   - `enableMarkdown`, `enableFileUpload` and the `onClear` runtime slot,
 *     forwarded into the panel's `<ChatbotEnhanced>`;
 *   - `floatingConfig`, the trigger and panel geometry
 *     ({@link FloatingChatbotConfig}) — ALSO declared on {@link ChatbotSchema},
 *     unchanged there — and `displayMode`, a `?: never` tombstone on both
 *     faces since objectui#7654; see each member's comment.
 *
 * NOT declared, on purpose: `maxHeight` (the panel pins its inner chat to
 * `100%` of `floatingConfig.panelHeight` AFTER any forwarded value, so an
 * authored `maxHeight` is dead here), `processVisibility` and `surface` (no
 * named read in this registration), and the six `ChatbotSchema` legacy
 * members no registration reads by name. `disabled` / `className` are
 * inherited from {@link BaseSchema}, as on the two sibling faces.
 *
 * ⚠️ The named-read census is not the only channel. This registration ends
 * its `<FloatingChatbot>` element with a raw `{...props}` spread — every
 * authored key `SchemaRenderer` forwards, unfiltered — and the panel is a
 * `<ChatbotEnhanced>`, so an authored `processVisibility`, `surface` or
 * `showAvatars` DOES reach it today (measured through the real host: each
 * lights its marker on a `chatbot-floating` node and stays dark without the
 * key, while `chatbot-enhanced`, whose spread is `toDomProps`-filtered, keeps
 * `showAvatars` dark). That channel is accidental, not contract: declaring
 * the three here would fossilise it (AGENTS.md #0.1), and fencing it is a
 * behaviour change with its own review. Recorded on its own card,
 * objectui#7708; this face neither declares nor promises it.
 */
export interface ChatbotFloatingSchema
  extends BaseSchema,
    Pick<ChatbotSchema, ChatbotSharedKey> {
  type: 'chatbot-floating';
  /**
   * Render assistant messages as markdown inside the panel. Forwarded to the
   * panel's `enableMarkdown` prop; an unauthored value falls back to `true` at
   * the registration.
   * @default true
   */
  enableMarkdown?: boolean;
  /**
   * Show the file-attachment control in the panel's composer. Forwarded to
   * the panel's `enableFileUpload` prop; an unauthored value falls back to
   * `false` at the registration.
   * @default false
   */
  enableFileUpload?: boolean;
  /**
   * Called after the conversation is cleared through the panel's clear
   * control, once the chat runtime has dropped its messages.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata; the zod twin refuses it by name. Kept callable here because
   * `plugin-chatbot`'s `handleClear` invokes `schema.onClear?.()`.
   */
  onClear?: () => void;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — the same `displayMode` retirement as
   * {@link ChatbotSchema.displayMode} (objectui#7654, maintainer ruling B,
   * 2026-09-05); the rationale, the measurements and the runtime note live
   * there, once. Declared here as well because objectui#7655 put the member on
   * this face with `ChatbotSchema`'s own three lines so the retirement would
   * find it on both faces — and because this is the face of the one
   * registration that offered the control: a `chatbot-floating` node IS the
   * floating presentation, so there is nothing left for this key to select.
   * `type: 'chatbot-floating'` is the whole spelling.
   * @deprecated Not part of this contract — the value was inert. The node
   * `type` selects the presentation.
   */
  displayMode?: never;
  /**
   * Configuration for the floating action button and the panel it opens —
   * read by `chatbot-floating` alone and forwarded to `<FloatingChatbot>`.
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
   * ADR-0049 RETIREMENT TOMBSTONE — `triggerIcon` (objectui#7654).
   *
   * `?: never` is this package's tombstone convention (see {@link
   * ComponentInput} in `base.ts`, `crud.ts` `confirm`, and {@link
   * StaticTableColumn} in `data-display.ts`): the key stays DECLARED and
   * becomes UNWRITABLE, so authoring one is a `tsc` error here.
   *
   * What was measured, on the merge-base of the retiring PR: nothing reads it.
   * `FloatingChatbot` (`plugin-chatbot/src/FloatingChatbot.tsx`) destructures
   * six of this interface's seven keys — `position`, `defaultOpen`,
   * `panelWidth`, `panelHeight`, `title`, `triggerSize` — and never this one;
   * `FloatingChatbotTrigger` takes no icon prop at all, so the promised
   * `'MessageCircle'` default never rendered either. A whole-repo `git grep`
   * census over tracked files, build output excluded, returned exactly this
   * declaration and one historical CHANGELOG line; the same pass over
   * `triggerSize`, a key that IS read, returned ten sites across four files, so
   * the instrument was demonstrably not blind.
   *
   * It is also absent from the `chatbot-floating` registration's `inputs` AND
   * its `defaultProps` (`plugin-chatbot/src/renderer.tsx`), so no designer
   * control ever offered it and no designer-created node carries it. The key
   * was reachable from TypeScript alone — which is exactly the surface this
   * tombstone closes.
   *
   * ## Why there is NO `retirementTombstone()` half, and why that is not an omission
   *
   * The other tombstones in this package pair `?: never` with a
   * `retirementTombstone()` refusal on the Zod twin. There is no twin to carry
   * one here: `FloatingChatbotConfig` has NO Zod mirror at all, and
   * `floatingConfig` sits in the `UnmirroredDeclared` ledger
   * (`__tests__/zod-mirror-parity.test.ts`, `complex.zod.ts#ChatbotSchema`).
   * `BaseSchema` is `.passthrough()`, so the whole `floatingConfig` object
   * rides through unvalidated — before this change and after it, byte for
   * byte. Minting a mirror to host a refusal would be the declared-but-
   * UNMIRRORED axis (objectui#6152), a different defect from this one: a key
   * can be mirrored and inert, or unmirrored and live, and fixing one says
   * nothing about the other. This retirement deliberately does not widen into
   * it, so `triggerIcon`'s refusal is TYPE-LEVEL ONLY. Runtime parse behaviour
   * is unchanged.
   *
   * ## Why a tombstone and not a deletion, with only the `tsc` channel available
   *
   * The usual argument for `?: never` over deletion is about the mirror (an
   * undeclared key is silently STRIPPED by a non-strict `z.object`), and with
   * no mirror here that argument does not apply. The tombstone earns its place
   * on the TypeScript channel alone instead, measured both ways:
   *
   *   - DELETED, a fresh object literal is refused — `TS2353: Object literal
   *     may only specify known properties` — but a WIDENED value is not.
   *     `const raw = { triggerIcon: 'Sparkles' }; const c: FloatingChatbotConfig
   *     = raw;` compiled CLEAN, because excess-property checking does not reach
   *     a non-fresh type. That is the silent no-op traded for another one.
   *   - TOMBSTONED, both paths are refused: the declared `never` makes the
   *     assignment itself ill-typed, so freshness stops mattering.
   *
   * Pinned in `__tests__/floating-chatbot-trigger-icon-retired.test.ts`,
   * including the deletion contrast, so nobody can "simplify" this back into a
   * deletion without that file going red.
   *
   * RETIRED (objectui#7654, ADR-0049) — never read: the FAB trigger renders a
   * fixed icon and takes no icon prop. There is no authored spelling that
   * changes it; the trigger's markup is the only place to change it.
   * @deprecated Not part of `FloatingChatbotConfig`'s contract — the value was inert.
   */
  triggerIcon?: never;
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
  // already refused. ⚠️ This note used to add that the shared `ResponsiveConfig`
  // shape was "NOT gone — it stays live on `page.components[].responsive`,
  // which `useResponsiveConfig` really does read". Both halves of that have
  // since expired and it is corrected rather than left standing, because a
  // stale liveness claim is what the next agent reads as the measurement:
  // objectstack#11027 retired `ResponsiveConfigSchema` outright (the census
  // behind it measured `page.components[].responsive` inert), and objectui#7580
  // deleted `useResponsiveConfig` with it at zero callers. What survives the
  // retirement is the BREAKPOINT vocabulary, re-homed into `@object-ui/types`
  // and `@object-ui/layout` because `responsive-grid` renders it — not this key.
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
  // `title` was DECLARED here until objectui#7623, under the comment "Dashboard
  // title displayed in the header" — by then a description of behaviour that had
  // stopped existing: objectui#7509 retired all five dashboard-root `title` read
  // arms under ADR-0049 (PR #7622), so the key was declared, documented as
  // rendering, and inert. The header text is the spec-canonical `label`
  // (`BaseSchema`), resolved through `pickLocalized`; `plugin-dashboard` has no
  // dashboard-root `title` read site left (pinned by that package's
  // `__tests__/dashboardAuthoredInputs.test.tsx`).
  //
  // Unlike `aria` below there is NO spec tombstone to inherit: `@objectstack/spec`'s
  // strict `DashboardSchema` refuses a root `title` as an UNRECOGNIZED key, not with
  // a named removal message, so the Zod twin (`zod/complex.zod.ts`, `.passthrough()`
  // via `BaseSchema`) gains no refusal from this deletion and ⛔ must not be given a
  // hand-written one — that would assert a spec behaviour that does not exist.
  // Note `BaseSchema`'s index signature still types an authored `title` as `any`:
  // this deletion removes the type-level suggestion and the false rendering claim,
  // not a key that ever rendered. Pinned by
  // `__tests__/dashboard-title-retired-declaration.test.ts`.
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
  | DeclarativeKanbanSchema
  | CalendarViewSchema
  | FilterBuilderSchema
  | CarouselSchema
  | ChatbotSchema
  | ChatbotEnhancedSchema
  | ChatbotFloatingSchema
  | DashboardComponentSchema;
