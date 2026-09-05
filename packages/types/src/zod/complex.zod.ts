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
import { handlerKeyRefusal, retirementTombstone } from './tombstone.zod.js';
import {
  ChartTypeSchema as SpecChartTypeSchema,
  DashboardSchema as SpecDashboardSchema,
  DashboardWidgetSchema as SpecDashboardWidgetSchema,
  GlobalFilterSchema as SpecGlobalFilterSchema,
  GroupingConfigSchema as SpecGroupingConfigSchema,
} from '@objectstack/spec/ui';
import { BaseSchema, SchemaNodeSchema, specFieldsExcept } from './base.zod.js';
import { KanbanConditionalFormattingRuleSchema } from './objectql.zod.js';
import { DASHBOARD_COLOR_VARIANTS, DASHBOARD_WIDGET_TYPES } from '../designer.js';
import {
  DASHBOARD_COMPONENT_WIDGET_TYPES,
  DASHBOARD_WIDGET_TYPE_EXTENSIONS,
} from '../complex.js';

/**
 * The retired declarative face, named once so every refusal below says the
 * same thing (objectui#7664, maintainer ruling (a), 2026-09-05: for an authored
 * `type: 'kanban'` document the PLUGIN dialect is authoritative; the
 * `DeclarativeKanbanSchema` / `DeclarativeKanbanColumn` / `DeclarativeKanbanCard`
 * trio and its three mirrors retired under ADR-0049 in the same change).
 *
 * A board written in that dialect used to PASS `safeValidateSchema` and render
 * EMPTY, because the validator and the registered renderer honoured two
 * unrelated shapes. The keys that dialect had and this one does not are refused
 * BY NAME, so the author reads which shape they wrote and what to write instead
 * — the named-refusal outcome objectui#5474 records as intended, not a silent
 * strip.
 */
const retiredDeclarativeKanbanKey = (key: string, where: string, remedy: string) =>
  retirementTombstone(
    `\`${key}\` is RETIRED (objectui#7664, ADR-0049) — it belonged to the retired ` +
      `\`DeclarativeKanbanSchema\` dialect (a ${where} key of the old \`@object-ui/types\` ` +
      'kanban face), which no registered kanban renderer ever read. The `kanban` type key ' +
      'now validates the shape `@object-ui/plugin-kanban` renders: `objectName` + `groupBy` for ' +
      `an object-bound board, or \`columns[].cards[]\` for a static one. ${remedy}`,
  );

/**
 * Kanban Card Schema — mirrors {@link KanbanCard} in `../complex.ts` key for key.
 *
 * `.passthrough()` because the declaration carries `[key: string]: any`: a card
 * is a record, and `bucketCardsIntoColumns` pushes raw records into lanes with
 * their fields intact (conditional formatting reads them back). The three
 * runtime-computed members `ObjectKanban` writes onto a card — `cardFieldCells`
 * (rendered `React.ReactNode` cells) and a badge's `colorStyle` (the
 * `getBadgeHexAppearance` style object) — are PASSED THROUGH as `z.any()`, the
 * way `data-display.zod.ts` passes `TableColumn.headerIcon` through
 * (objectui#6424): a non-strict object would otherwise silently strip what the
 * renderer honours, which is the second de-facto contract that card closed.
 */
export const KanbanCardSchema = z.object({
  id: z.string().describe('Card ID'),
  title: z.string().describe('Card title'),
  description: z.string().optional().describe('Card description'),
  badges: z.array(z.object({
    label: z.string().describe('Badge label'),
    variant: z.enum(['default', 'secondary', 'destructive', 'outline']).optional().describe('Badge variant'),
    colorClass: z.string().optional().describe('Tailwind class string applied to the badge; overrides `variant`'),
    colorStyle: z.any().optional().describe('Inline style accompanying `colorClass` — the `getBadgeHexAppearance` style object, passed through verbatim'),
  })).optional().describe('Card badges'),
  cardSubtitle: z.string().optional().describe('Synthesized card subtitle, rendered in preference to `description`'),
  cardFieldCells: z.array(z.object({
    field: z.string().describe('Field name the cell renders'),
    label: z.string().optional().describe('Cell label'),
    node: z.any().describe('Rendered cell node — written by `ObjectKanban` from `cardFields`, passed through verbatim'),
  })).optional().describe('Structured per-field cells rendered through the `@object-ui/fields` cell pipeline'),
  coverImage: z.string().optional().describe('Resolved cover-image URL, derived from the board\'s `coverImageField`'),
}).passthrough();

/**
 * Kanban Column Schema — mirrors {@link KanbanColumn} in `../complex.ts`.
 */
export const KanbanColumnSchema = z.object({
  id: z.string().describe('Column ID'),
  title: z.string().describe('Column title'),
  cards: z.array(KanbanCardSchema).describe('Column cards'),
  limit: z.number().optional().describe('WIP limit — the card count at which the lane warns'),
  className: z.string().optional().describe('Column class name'),
  collapsed: z.boolean().optional().describe('Whether the lane renders collapsed (honoured by the enhanced board)'),
  color: retiredDeclarativeKanbanKey('color', 'column', 'Style a lane through its `className`.'),
});

/**
 * Card Template Schema — mirrors {@link CardTemplate} in `../complex.ts`.
 */
export const CardTemplateSchema = z.object({
  id: z.string().describe('Unique template identifier'),
  name: z.string().describe('Human-readable template name'),
  icon: z.string().optional().describe('Optional Lucide icon name'),
  values: z.record(z.string(), z.any()).describe('Pre-filled field values'),
});

/**
 * Column Width Config Schema — mirrors {@link ColumnWidthConfig} in `../complex.ts`.
 */
export const ColumnWidthConfigSchema = z.object({
  defaultWidth: z.number().optional().describe('Default column width in pixels'),
  minWidth: z.number().optional().describe('Minimum column width in pixels'),
  maxWidth: z.number().optional().describe('Maximum column width in pixels'),
  overrides: z.record(z.string(), z.number()).optional().describe('Per-column width overrides keyed by column ID'),
});

/**
 * Kanban Schema — the `'kanban'` arm of {@link ComplexSchema}, mirroring
 * {@link KanbanSchema} in `../complex.ts` key for key: the shape
 * `@object-ui/plugin-kanban`'s registered renderers read (objectui#7664).
 *
 * `onCardMove` / `onCardClick` / `onQuickAdd` are RUNTIME SLOTS (objectui#6124):
 * `KanbanRenderer` forwards all three off `schema.*` in one block, so the
 * TypeScript twin keeps them callable and this mirror refuses them by name.
 * ⛔ None of the three may be dropped instead of refused — `BaseSchema` is
 * `.passthrough()`, so a dropped key is KEPT rather than refused (the first cut
 * of objectui#7664 dropped `onCardClick` and turned a refused document into an
 * accepted one). `onColumnAdd` / `onCardAdd` are the two
 * retired handler keys carried over from the declarative face so the successor
 * arm keeps refusing the spelling; `draggable` is that face's own retired key.
 * `conditionalFormatting` and `grouping` are the same schemas the `object-kanban`
 * and `object-gallery` arms use (`objectql.zod.ts`, `@objectstack/spec`).
 */
export const KanbanSchema = BaseSchema.extend({
  type: z.literal('kanban'),
  objectName: z.string().optional().describe('Object name to fetch data from'),
  groupBy: z.string().optional().describe('Field to group records by (maps to column IDs)'),
  swimlaneField: z.string().optional().describe('Field for swimlane rows (2D grouping)'),
  cardTitle: z.string().optional().describe('Field to use as the card title'),
  cardFields: z.array(z.string()).optional().describe('Fields to display on the card'),
  data: z.array(z.any()).optional().describe('Static data or bound data (raw rows)'),
  limit: z.number().optional().describe('Row cap for the fetch (defaults to 100)'),
  columns: z.array(KanbanColumnSchema).optional().describe('Columns to display, each carrying its cards'),
  onCardMove: handlerKeyRefusal('onCardMove', 'runtime-slot', 'Card move handler'),
  onCardClick: handlerKeyRefusal('onCardClick', 'runtime-slot', 'Card click handler'),
  className: z.string().optional().describe('CSS class name'),
  quickAdd: z.boolean().optional().describe('Enable the Quick Add button at the bottom of each column'),
  onQuickAdd: handlerKeyRefusal('onQuickAdd', 'runtime-slot', 'Quick Add handler'),
  coverImageField: z.string().optional().describe('Field name to use as cover image on cards'),
  allowCollapse: z.boolean().optional().describe('Allow columns to be collapsed/expanded'),
  conditionalFormatting: z.array(KanbanConditionalFormattingRuleSchema).optional().describe('Card conditional formatting rules'),
  cardTemplates: z.array(CardTemplateSchema).optional().describe('Predefined card templates for quick-add'),
  columnWidths: ColumnWidthConfigSchema.optional().describe('Custom column width configuration'),
  grouping: SpecGroupingConfigSchema.optional().describe('Grouping configuration from ListView; its first field is the swimlaneField fallback'),
  draggable: retiredDeclarativeKanbanKey('draggable', 'board', 'Drag-and-drop is always on; delete the key.'),
  onColumnAdd: handlerKeyRefusal('onColumnAdd', 'retired', 'Column add handler'),
  onCardAdd: handlerKeyRefusal('onCardAdd', 'retired', 'Card add handler'),
});

/**
 * Calendar View Mode — the registered renderer's rendered set.
 *
 * `'agenda'` was retired (objectui#5740): no view ever rendered it, and no
 * measured app authors it. `view` is a DECLARED key, so this retirement is a
 * new rejection — see the accept-set note on {@link CalendarViewSchema}.
 */
export const CalendarViewModeSchema = z.enum(['month', 'week', 'day']);

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
 *
 * Mirrors `CalendarViewSchema` in `../complex.ts`, converged on the registered
 * `calendar-view` renderer's measured read set (objectui#5667): events are
 * computed from `data` plus the field-name keys; the formerly required
 * `events` and the eight other inert keys (`defaultView`, `defaultDate`,
 * `date`, `views`, `editable`, `onEventCreate`, `onEventUpdate`,
 * `onDateChange`) are retired (ADR-0049 enforce-or-remove).
 *
 * `BaseSchema` is `.passthrough()`, so the retired keys are not REJECTED here
 * — they are simply no longer declared or type-checked. The material accept
 * change is that `events` is no longer required.
 *
 * Value-level residue (objectui#5740): `'agenda'` left
 * `CalendarViewModeSchema`. Unlike the key retirements above, this IS a new
 * rejection — `view` is a declared key, and declared keys are validated even
 * under `.passthrough()` — so `view: 'agenda'`, which parsed green before,
 * now fails with an `invalid_value` issue on the `view` path.
 */
export const CalendarViewSchema = BaseSchema.extend({
  type: z.literal('calendar-view'),
  data: z
    .any()
    .optional()
    .describe(
      'Records to display as events (computed with the field-name keys; binding expressions resolve before the renderer reads it)',
    ),
  titleField: z.string().optional().describe("Record field for the event title (default 'title')"),
  startDateField: z
    .string()
    .optional()
    .describe("Record field for the event start date/time (default 'start')"),
  endDateField: z
    .string()
    .optional()
    .describe("Record field for the event end date/time (default 'end')"),
  allDayField: z.string().optional().describe("Record field for the all-day flag (default 'allDay')"),
  colorField: z.string().optional().describe("Record field for the event color (default 'color')"),
  view: CalendarViewModeSchema.optional().describe(
    "View mode — 'month' | 'week' | 'day', the renderer's rendered set ('agenda' was retired: objectui#5740)",
  ),
  currentDate: z
    .union([z.string(), z.date()])
    .optional()
    .describe('Initial calendar date (ISO string authored; Date instance from a React host)'),
  allowCreate: z.boolean().optional().describe('Show the "New event" affordance (default false)'),
  className: z.string().optional().describe('Tailwind classes for the calendar container'),
  // objectui#7344: the multi-line `z.function()` spelling PR #7339's anchored
  // census could not see; `pickHostCallbacks` forwards it exactly like
  // `onViewChange` below.
  onEventClick: handlerKeyRefusal('onEventClick', 'runtime-slot', 'Host-only event click handler'),
  onViewChange: handlerKeyRefusal('onViewChange', 'runtime-slot', 'Host-only view change handler'),
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
export const FilterBuilderConditionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    field: z.string().describe('Field name'),
    operator: FilterOperatorSchema.describe('Filter operator'),
    value: z.any().optional().describe('Filter value'),
  })
);

/**
 * Filter Group Schema — the shape `FilterBuilder` actually reads
 * (objectui#6939, the `filter-builder` group; maintainer ruling 2026-09-02,
 * director seat summon #8, verbatim 「同意」).
 *
 * The gate is `isValidGroup`, `packages/components/src/custom/filter-builder.tsx:1060`:
 *
 *     Array.isArray(v.conditions) && (v.logic === "and" || v.logic === "or")
 *
 * so `logic` is the read key and the mirror's former `operator` was a spelling
 * with ZERO read sites. Measured through the real `SchemaRenderer`: rewriting a
 * catalog entry's group from `{ id, logic, conditions }` to
 * `{ operator, conditions }` fails that gate, the component falls back to
 * `EMPTY_GROUP`, and the board EMPTIES — 76 elements and three condition rows
 * become 11 elements and none.
 *
 * `id` is DECLARED here but deliberately OPTIONAL, and that is a departure from
 * a literal reading of the ruling's `{ id, logic, conditions }`. `isValidGroup`
 * never consults it and nothing else reads `filterGroup.id`; measured, deleting
 * `id` from an authored group renders BYTE-IDENTICALLY (76 elements, same text,
 * same SHA-256). Requiring it would refuse a document the renderer draws
 * perfectly — a fresh instance of the exact class objectui#6939 exists to
 * close. Declared rather than dropped because the component's own exported
 * `FilterGroup` carries it, `EMPTY_GROUP` emits it, every catalog entry authors
 * it, and it round-trips out through `onChange`; declaring it buys the type
 * check (`id: 42` now refuses) that an undeclared key would not get, since a
 * plain `z.object` strips unknown keys in silence.
 */
export const FilterGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().optional().describe('Group id — round-tripped through `onChange`; no read site'),
    logic: z.enum(['and', 'or']).describe('How the conditions combine — read by `isValidGroup`'),
    conditions: z.array(z.union([FilterBuilderConditionSchema, FilterGroupSchema])).describe('Conditions or sub-groups'),
  })
);

/**
 * Filter Field Schema — one entry of `FilterBuilderSchema.fields`
 * (objectui#6939, same ruling).
 *
 * ## `value`, not `name`
 *
 * Every read site looks the entry up by `value`:
 * `fields.find((f) => f.value === fieldValue)` in `getOperatorsForField`,
 * `changeField`, `getInputType` and `renderValueInput`, plus `fields[0]?.value`
 * in `addCondition` and `<SelectItem value={field.value}>` in the field
 * dropdown — `custom/filter-builder.tsx:1099,1161,1201,1234,1239` and the row
 * render. `name` has zero read sites, and `FilterBuilderProps.fields` (line 66
 * of that file) declares `Array<{ value, label, type? }>`. Measured: rewriting
 * a catalog entry's `value` to `name` loses the field on every row —
 * `…Clear allCategoryRemove condition…` becomes
 * `…Clear allRemove condition…`, and the three value inputs degrade from
 * `text`/`number`/`number` to three `text` boxes.
 *
 * ## The type vocabulary
 *
 * `text` / `number` / `boolean` / `date` / `datetime` / `time` are the ruled
 * six, and all six are live and MUTUALLY DISTINGUISHABLE at the value control
 * (measured, one condition row each): `<input type>` `text`, `number`, `date`,
 * `datetime-local`, `time`, and for `boolean` no input at all but an extra
 * option Select. They are `FilterValueFamily`
 * (`custom/filter-builder.tsx:406`), which `valueFamilyForFieldType` folds a
 * column's `type` into and `FILTER_INPUT_TYPE_BY_FAMILY` draws from.
 *
 * `string` LEAVES the vocabulary: it renders identically to a nonsense
 * spelling, because both reach the text control by the unrecognised-word
 * fallthrough rather than by being read. It is a phantom, and `text` is the
 * spelling the registration's own `defaultProps` and all five catalog entries
 * use.
 *
 * ⚠ `select` is RETAINED, which departs from a literal reading of the ruling's
 * six. The ruling inherits the finding card's description of `select` as
 * "extra"; measured, it is not. `selectLikeTypes = ["select", "status"]`
 * (`custom/filter-builder.tsx:935`) is consumed by `operatorsForFieldType`
 * (line 989, the `equals`/`in`/`notIn` bucket) and by
 * `isOptionDrivenValueControl` (line 739), and a `select` column draws the
 * option-driven Select rather than a text box — 39 elements and no `<input>`,
 * against 36 and one. Dropping it would REFUSE a spelling this mirror accepts
 * today and the renderer draws distinctly, which is a fresh instance of the
 * class this card closes. Flagged for contract review rather than decided here.
 *
 * ⚠ NOT declared, and NOT a regression this change introduces: `status`,
 * `currency`, `percent`, `rating`, `lookup`, `master_detail` and `user` are
 * live spellings with their own buckets and controls (`number` inputs for the
 * first four by way of `numberLikeTypes`, the option Select for the last three
 * by way of `lookupLikeTypes`) and every one of them is refused by this mirror
 * BEFORE this change as well as after. Reported on objectui#6939 as a
 * pre-existing gap; widening to them is an accept-set change the ruling does
 * not cover.
 */
export const FilterFieldSchema = z.object({
  value: z.string().describe('Field key — the identity every read site matches on'),
  label: z.string().describe('Field label'),
  type: z.enum(['text', 'number', 'boolean', 'date', 'datetime', 'time', 'select']).describe('Field type'),
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
  defaultValue: z.union([FilterBuilderConditionSchema, FilterGroupSchema]).optional().describe('Default filter value'),
  value: z.union([FilterBuilderConditionSchema, FilterGroupSchema]).optional().describe('Controlled filter value'),
  onChange: handlerKeyRefusal('onChange', 'runtime-slot', 'Change handler'),
  allowGroups: z.boolean().optional().describe('Allow grouped conditions'),
  maxDepth: z.number().optional().describe('Maximum nesting depth'),
  wrapperClass: z.string().optional()
    .describe("Outer wrapper classes, read at renderers/complex/filter-builder.tsx:37 — `className={schema.wrapperClass || ''}` (objectui#6150)"),
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
  opts: z.record(z.string(), z.unknown()).optional()
    .describe("Embla option bag forwarded verbatim at renderers/complex/carousel.tsx:23 — `opts={schema.opts}`. Left OPEN on purpose: the renderer passes the whole bag through, so narrowing it to the docs' `{loop, align}` pair would refuse authored documents that work today (objectui#6150)"),
  orientation: z.enum(['horizontal', 'vertical']).optional()
    .describe("Scroll axis, read at renderers/complex/carousel.tsx:24 — `orientation={schema.orientation || 'horizontal'}` (objectui#6150)"),
  itemClassName: z.string().optional()
    .describe('Per-slide Tailwind classes, read at renderers/complex/carousel.tsx:30 — `className={schema.itemClassName}` on every CarouselItem (objectui#6150)'),
  autoPlay: z.number().optional().describe('Auto-play interval (ms)'),
  showArrows: z.boolean().optional().describe('Show navigation arrows'),
  showDots: z.boolean().optional().describe('Show navigation dots'),
  loop: z.boolean().optional().describe('Enable infinite loop'),
  itemsPerView: z.number().optional().describe('Items per view'),
  gap: z.number().optional().describe('Gap between items'),
  onSlideChange: handlerKeyRefusal('onSlideChange', 'retired', 'Slide change handler'),
});

/**
 * Chat Message Schema
 */
export const ChatToolInvocationSchema = z.object({
  toolCallId: z.string().describe('Unique tool call identifier'),
  toolName: z.string().describe('Name of the tool'),
  args: z.unknown().optional().describe('Tool arguments'),
  result: z.unknown().optional().describe('Tool result'),
  errorText: z.string().optional().describe('Tool error text'),
  state: z
    .enum([
      'partial-call',
      'call',
      'result',
      'input-streaming',
      'input-available',
      'approval-requested',
      'approval-responded',
      'output-available',
      'output-error',
      'output-denied',
    ])
    .optional()
    .describe('Tool invocation state'),
});

export const ChatMessageSourceSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  url: z.string().describe('Source URL'),
});

export const ChatMessageSchema = z.object({
  id: z.string().describe('Message ID'),
  role: z.enum(['user', 'assistant', 'system', 'tool']).describe('Message role'),
  content: z.string().describe('Message content'),
  timestamp: z.union([z.string(), z.date()]).optional().describe('Message timestamp'),
  metadata: z.record(z.string(), z.any()).optional().describe('Custom metadata'),
  streaming: z.boolean().optional().describe('Whether message is being streamed'),
  toolInvocations: z.array(ChatToolInvocationSchema).optional().describe('Tool invocations'),
  reasoning: z.string().optional().describe('Chain-of-thought reasoning text'),
  sources: z.array(ChatMessageSourceSchema).optional().describe('Citation sources'),
  traceId: z.string().optional().describe('Backend trace id (ai_traces.id)'),
  avatar: z.string().optional()
    .describe('Per-message avatar image URL overriding the chatbot-level userAvatarUrl / assistantAvatarUrl, read at plugin-chatbot/src/index.tsx:173–174 — `message.avatar || userAvatarUrl` (objectui#7295)'),
  avatarFallback: z.string().optional()
    .describe('Per-message avatar fallback text overriding the chatbot-level userAvatarFallback / assistantAvatarFallback, read at plugin-chatbot/src/index.tsx:177–178 — `message.avatarFallback || userAvatarFallback` (objectui#7295)'),
});

/**
 * Chatbot Schema - Chatbot component
 */
export const ChatbotSchema = BaseSchema.extend({
  type: z.literal('chatbot'),
  messages: z.array(ChatMessageSchema).describe('Chat messages'),
  placeholder: z.string().optional().describe('Input placeholder'),
  loading: z.boolean().optional().describe('Whether chat is loading'),
  onSendMessage: handlerKeyRefusal('onSendMessage', 'retired', 'Send message handler'),
  showAvatars: z.boolean().optional().describe('Show user avatars'),
  userAvatar: z.string().optional().describe('User avatar URL'),
  assistantAvatar: z.string().optional().describe('Assistant avatar URL'),
  markdown: z.boolean().optional().describe('Enable markdown rendering'),
  processVisibility: z.enum(['hidden', 'summary', 'debug']).optional().describe('How much agent reasoning/tool detail to show'),
  height: z.union([z.string(), z.number()]).optional().describe('Chatbot height'),
  api: z.string().optional().describe('Backend API endpoint for streaming chat'),
  conversationId: z.string().optional().describe('Conversation ID for multi-turn context'),
  systemPrompt: z.string().optional().describe('System prompt for assistant behavior'),
  model: z.string().optional().describe('AI model identifier'),
  streamingEnabled: z.boolean().optional().describe('Enable streaming responses'),
  headers: z.record(z.string(), z.string()).optional().describe('Additional API headers'),
  body: z.record(z.string(), z.unknown()).optional().describe('Additional API body params'),
  /** @deprecated objectui#5605 — inert; nothing reads it. Cap loops on the agent (`planning.maxIterations`). Slated for removal. */
  maxToolRoundtrips: z.number().optional()
    .describe('DEPRECATED (inert, slated for removal) — Max tool-calling round-trips. Nothing reads this; cap tool loops on the agent via planning.maxIterations'),
  onError: handlerKeyRefusal('onError', 'runtime-slot', 'Error callback'),
  // --- Local display + legacy auto-response fields (objectui#6169) ---
  // Mirrors the TS declaration added at ../complex.ts in lockstep, so these
  // ten keys move from the pre-existing "declared but unmirrored, rides
  // through .passthrough() unvalidated" state straight to mirrored — never
  // through an interim unmirrored window.
  showTimestamp: z.boolean().optional().describe('Display a timestamp on each message'),
  userAvatarUrl: z.string().optional().describe("URL of the user's avatar image"),
  userAvatarFallback: z.string().optional().describe('Fallback text for the user avatar'),
  assistantAvatarUrl: z.string().optional().describe("URL of the assistant's avatar image"),
  assistantAvatarFallback: z.string().optional().describe('Fallback text for the assistant avatar'),
  maxHeight: z.string().optional().describe('Maximum height of the chat message container (CSS value)'),
  autoResponse: z.boolean().optional().describe('Enable local auto-response (demo/playground) mode'),
  autoResponseText: z.string().optional().describe('Text of the local auto-response'),
  autoResponseDelay: z.number().optional().describe('Delay in milliseconds before the local auto-response is sent'),
  onSend: handlerKeyRefusal('onSend', 'runtime-slot', 'Called after a message is sent, in both API and local auto-response mode'),
});

/**
 * The chat-surface arms ALL THREE `plugin-chatbot` registrations read
 * (objectui#7655) — the Zod side of `../complex.ts`'s `ChatbotSharedKey`,
 * taken off `ChatbotSchema`'s own shape so every shared arm has ONE spelling.
 * Not exported: it is a census, not a mirror, and the parity census in
 * `__tests__/zod-mirror-parity.test.ts` registers `export const`s only.
 *
 * `requestBody` is deliberately NOT in this pick. `ChatbotSchema` above mirrors
 * the API body params under the key `body`, which collides with `BaseSchema`'s
 * `body` children slot — the naming collision the parity ledger records under
 * `KnownDrift`. The two twins below mirror the key the renderer actually reads,
 * `requestBody`, and inherit `body` as the children slot, so they are born
 * without the collision. Ruling on `ChatbotSchema`'s own `body` arm is a
 * separate question and is not decided here.
 */
const ChatbotSharedMirrorShape = ChatbotSchema.pick({
  messages: true,
  placeholder: true,
  api: true,
  conversationId: true,
  systemPrompt: true,
  model: true,
  streamingEnabled: true,
  headers: true,
  maxToolRoundtrips: true,
  onError: true,
  showTimestamp: true,
  userAvatarUrl: true,
  userAvatarFallback: true,
  assistantAvatarUrl: true,
  assistantAvatarFallback: true,
  autoResponse: true,
  autoResponseText: true,
  autoResponseDelay: true,
  onSend: true,
}).shape;

/** The arms `chatbot-enhanced` and `chatbot-floating` share beyond the pick above. */
const chatbotRequestBodyArm = () =>
  z.record(z.string(), z.unknown()).optional()
    .describe('Additional body parameters sent with each API request (forwarded to the chat runtime as its `body` option)');
const chatbotEnableMarkdownArm = () =>
  z.boolean().optional().describe('Render assistant messages as markdown (default true)');
const chatbotEnableFileUploadArm = () =>
  z.boolean().optional().describe('Show the file-attachment control in the composer (default false)');
const chatbotOnClearArm = () =>
  handlerKeyRefusal('onClear', 'runtime-slot', 'Called after the conversation is cleared');

/**
 * Chatbot Enhanced Schema - `chatbot-enhanced` component (objectui#7655).
 *
 * Zod twin of `../complex.ts`'s `ChatbotEnhancedSchema`, in lockstep: every
 * key that declaration lists is an arm here, and the three runtime slots
 * (`onError`, `onSend`, `onClear`) are named refusals (objectui#6124).
 */
export const ChatbotEnhancedSchema = BaseSchema.extend({
  type: z.literal('chatbot-enhanced'),
  ...ChatbotSharedMirrorShape,
  requestBody: chatbotRequestBodyArm(),
  maxHeight: ChatbotSchema.shape.maxHeight,
  processVisibility: ChatbotSchema.shape.processVisibility,
  enableMarkdown: chatbotEnableMarkdownArm(),
  enableFileUpload: chatbotEnableFileUploadArm(),
  surface: z.enum(['card', 'plain']).optional()
    .describe("Visual chrome for the chat surface: 'card' bordered panel (default) or 'plain' frameless full-page workspace (objectui#6687)"),
  onClear: chatbotOnClearArm(),
});

/**
 * Chatbot Floating Schema - `chatbot-floating` component (objectui#7655).
 *
 * Zod twin of `../complex.ts`'s `ChatbotFloatingSchema`. Two of that
 * declaration's keys are deliberately NOT mirrored, and the parity ledger
 * records both under `UnmirroredDeclared` for this pair — exactly as it
 * records the same two keys for `ChatbotSchema`, which declares them too:
 *
 *   - `floatingConfig` — `FloatingChatbotConfig` has no Zod mirror at all;
 *     minting one is the declared-but-unmirrored axis (objectui#6152), a
 *     different defect from the one this pair closes, and the axis the
 *     `triggerIcon` tombstone's tripwire watches (objectui#7654).
 *   - `displayMode` — RETIRED by objectui#7654 (maintainer ruling B,
 *     2026-09-05): the node `type` is the one selector of presentation. The
 *     TypeScript half landed there — `?: never` tombstone on both faces,
 *     designer control and seed removed — and, per the ruling, the mirror
 *     half (`retirementTombstone()`) is owed at the moment objectui#6152 mints
 *     an arm for it, not before: a mirror arm here today would be a parse
 *     outcome the ruling did not ask for, so this twin has none and a stored
 *     document carrying the key parses exactly as it did
 *     (`chatbot-display-mode-retired.test.ts` pins the shape as the tripwire).
 *
 * Both ride through `BaseSchema`'s `.passthrough()` unvalidated, byte for byte
 * as they do on `ChatbotSchema`'s twin.
 */
export const ChatbotFloatingSchema = BaseSchema.extend({
  type: z.literal('chatbot-floating'),
  ...ChatbotSharedMirrorShape,
  requestBody: chatbotRequestBodyArm(),
  enableMarkdown: chatbotEnableMarkdownArm(),
  enableFileUpload: chatbotEnableFileUploadArm(),
  onClear: chatbotOnClearArm(),
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
 * The CLOSED vocabulary a dashboard widget's `type` may name — Zod twin of
 * `../complex.ts` {@link DashboardWidgetTypeName}, and the enforcement half of
 * the 2026-08-14 maintainer ruling on objectstack#8593.
 *
 * Composed of three sets, each reached the way its own provenance demands:
 *
 *  - the spec's 20 visualization families, BY REFERENCE off
 *    `ChartTypeSchema.options` — the same enum the spec's own
 *    `DashboardWidgetSchema.shape.type` wraps in a `.default()`. Restating them here would be the
 *    "narrower than the contract it implements" shape this file already
 *    records twice (`label`, `defaultRange`): a family the spec ADDS would be a
 *    legal document objectui refuses.
 *  - `DASHBOARD_WIDGET_TYPE_EXTENSIONS` — objectui-only widget FAMILIES
 *    (`list`, `custom`). The pre-existing divergence, until objectui#4600
 *    carried only as the prose "widened to `z.string()`" and enforced nowhere.
 *  - `DASHBOARD_COMPONENT_WIDGET_TYPES` — objectui COMPONENT types the widget
 *    slot holds directly (`metric-card`). The ruling puts it HERE and
 *    explicitly not in the spec widget enum, which is a different repo and a
 *    different contract.
 *
 * ⛔ Closed, not `z.string()`. The open form is what let the catalog ship
 * widgets naming types nothing registers: measured on this tree before the
 * change, `DashboardComponentSchema.safeParse` ACCEPTED a widget with
 * `type: 'zzz-not-a-widget-type'` and one with no `type` at all, so a gate
 * built on it would have passed by validating nothing.
 *
 * ⚠️ A member of `DASHBOARD_COMPONENT_WIDGET_TYPES` is a component node, and
 * this schema is NOT the schema for its body: `metric-card`'s own props
 * (`value`, `icon`, `trend`, `trendValue` — registry `inputs`, not widget
 * keys) belong to objectui's own passthrough component schema, `BaseSchema`,
 * which is the schema the ruling names for a component node. Since
 * objectui#6002 made {@link DashboardWidgetSchema} `.strict()`, that routing
 * lives in `DashboardComponentSchema`'s widget slot itself (see
 * {@link DashboardWidgetSlotComponentSchema}); the standing gate
 * (`examples/schema-catalog/test/plugin-dashboard-component-schema.test.ts`)
 * routes each widget to whichever of the two owns it and asserts a component
 * node loses no authored key while a widget refuses undeclared ones.
 */
export const DashboardWidgetTypeSchema = z.enum([
  ...SpecChartTypeSchema.options,
  ...DASHBOARD_WIDGET_TYPE_EXTENSIONS,
  ...DASHBOARD_COMPONENT_WIDGET_TYPES,
]);

/**
 * Dashboard Widget Schema — DERIVED from `@objectstack/spec/ui`
 * (objectstack#4115): every spec key flows in **by reference** via
 * {@link specFieldsExcept}, so a key the spec adds or retypes cannot silently
 * diverge here.
 *
 * The hand copy this replaces declared 10 of the spec's 22 keys, and because a
 * `z.object()` strips unknown keys, the other 12 were dropped without a word by
 * `objectui validate` — including `chartConfig`, `colorVariant`, `filter`,
 * `responsive`, `aria`, `actionUrl`/`actionType`/`actionIcon`, `compareTo` and
 * the `requiresObject`/`requiresService` capability gates. The TS interface in
 * `complex.ts` declared most of them all along, so a widget could type-check in
 * objectui and still lose half its configuration on validation.
 *
 * Two pinned divergences plus one objectui-only extension:
 *  - `id` relaxed to optional — the spec requires it, but stored objectui
 *    dashboards (and the legacy `component` format below) omit it.
 *  - `type` re-pointed at {@link DashboardWidgetTypeSchema} — the spec's own
 *    enum plus objectui's two CLOSED extension sets. It was `z.string()` until
 *    objectui#4600; the widening was real (objectui renders `list` / `custom`,
 *    and the 2026-08-14 ruling admits the `metric-card` component type) but it
 *    was spent as an unbounded hatch rather than a named set, so every typo and
 *    every retired family validated too.
 *  - `component` — the legacy `{ id, component: <SDUI node>, layout }` envelope,
 *    which the spec has no room for. Migration to the shorthand form is deferred.
 *
 * ## `.strict()` — undeclared keys are REFUSED, not stripped (objectui#6002)
 *
 * Until #6002 this was a plain `z.object()`, and the docstring above records
 * what that meant once already: keys outside the declared set were dropped
 * WITHOUT A WORD. Measured on the #4600 branch, a widget carrying the retired
 * pre-ADR-0021 inline analytics keys (`object` / `categoryField` / `aggregate`)
 * parsed five-keys-in, three-keys-out, verdict ACCEPT — so the contract could
 * never tell an author, a designer, or a publish-time check that the document
 * says something the platform stopped honouring. Maintainer ruling 2026-08-25
 * (objectui#6002, Route 1 two-step): after #6150 declared the genuinely
 * consumed keys, undeclared widget keys refuse loudly — zod's
 * `unrecognized_keys` issue names every offending key. The spec's own
 * tombstones (`actionUrl` / `actionType` / `actionIcon` / `aria` /
 * `responsive`) stay DECLARED `z.never()` members, so they keep their specific
 * removal messages rather than degrading to a generic unknown-key error.
 *
 * ⚠️ This schema owns spec-family widgets only. A component node in the widget
 * slot (`type: 'metric-card'`) is routed to passthrough `BaseSchema` by
 * {@link DashboardWidgetSlotComponentSchema} before this schema is consulted —
 * its props are component inputs, not widget keys, and MUST NOT be refused
 * here (2026-08-14 ruling, objectstack#8593).
 *
 * Drift guard: `__tests__/report-chart-query-spec-parity.test.ts`.
 */
export const DashboardWidgetSchema = specFieldsExcept(SpecDashboardWidgetSchema.shape, [
  'id',
  'type',
] as const).extend({
  id: z.string().optional().describe('Widget ID'),
  type: DashboardWidgetTypeSchema.optional()
    .describe('Widget visualization type — the spec families plus objectui\'s closed `list`/`custom` and `metric-card` extensions'),
  component: SchemaNodeSchema.optional().describe('Widget Component (legacy format)'),
}).strict();

/**
 * A COMPONENT node sitting directly in a dashboard's widget slot — the
 * `metric-card` extension the 2026-08-14 ruling (objectstack#8593) admits:
 *
 *   > An SDUI dashboard COMPONENT node validates against objectui's OWN
 *   > component schema; [...] `metric-card` joins objectui's own CLOSED
 *   > component enum as an explicitly allowed objectui extension.
 *
 * Its body is `BaseSchema` (passthrough): `value` / `icon` / `trend` /
 * `trendValue` are the component's registry `inputs`, not widget keys, and a
 * `.strict()` {@link DashboardWidgetSchema} must never see them. The `type`
 * override is what makes this arm reachable ONLY for component nodes: for
 * every other widget (any spec family, `list`/`custom`, the legacy
 * `component` envelope with no `type` at all) the required closed enum fails
 * fast and the union falls through to the strict widget schema — so this arm
 * cannot become a passthrough hatch around #6002's refusal. Deliberately NOT
 * exported: the routing is an internal property of the widget slot, not new
 * authoring surface.
 */
const DashboardWidgetSlotComponentSchema = BaseSchema.extend({
  type: z.enum(DASHBOARD_COMPONENT_WIDGET_TYPES)
    .describe('objectui component type legal in a widget slot (closed set)'),
});

/**
 * Global Filter Schema — a dashboard-level filter definition, DERIVED from
 * `@objectstack/spec/ui` (objectstack#4115): `name`, `field`, `label`, `type`,
 * `defaultValue`, `scope` and `targetWidgets` flow in **by reference**.
 *
 * Two pinned divergences, each backed by a runtime normalizer in
 * `@object-ui/core`'s `dashboard-filters.ts`:
 *  - `options` also accepts the bare-string shorthand (`options: ['EMEA', …]`)
 *    and an object without `label`; `normalizeFilterOptions` folds both into the
 *    spec's `{ value, label }` form before anything renders them.
 *  - `optionsFrom.labelField` stays optional (it falls back to `valueField`) and
 *    `filter` stays `z.any()` — objectui passes an ObjectQL FilterNode array
 *    here, not the spec's `FilterCondition` envelope.
 *
 * There used to be a third — `defaultValue` widened to `z.any()` so the
 * `{ preset }` object form would validate. It was RETIRED by the maintainer
 * ruling on objectui#4165 (2026-08-11): the spec stays strict, the bare preset
 * name is the single canonical spelling, and the object form is handled as a
 * documented legacy alias by `liftLegacyGlobalFilterDefault`
 * (`../dashboard-filter-alias.ts`, which carries the retirement window) rather
 * than by a permanently tolerant schema. Keeping it would have been the
 * tolerant-consumer failure AGENTS.md #0.1 names: objectui green on metadata
 * the platform refuses, so the designer saves and the server rejects.
 *
 * Drift guard: `__tests__/report-chart-query-spec-parity.test.ts`.
 *
 * ## Composition: spread + delegated refinement (objectui#4165)
 *
 * @objectstack/spec 17.0.0-rc.6 put a refinement on `GlobalFilterSchema`, and
 * a refined object schema in zod 4 closes every structural door this derivation
 * would normally use. All three were measured on rc.6 + zod 4.4.3:
 *
 *  - `.extend()` — what this used to be — **throws at module load**: *"Cannot
 *    overwrite keys on object schemas containing refinements. Use
 *    `.safeExtend()` instead."* It took six `@object-ui/types` suites down
 *    before any of them ran a test.
 *  - `.safeExtend()` — zod's own suggested replacement — runs, but is "safe"
 *    precisely in that it will not let you REPLACE an existing key's type: it
 *    types every incompatible override as `never`. Still true with only two
 *    overrides left (TS2322 on BOTH `options` and `optionsFrom`), so retiring
 *    the `defaultValue` divergence did not re-open this door.
 *  - `.omit()` — the obvious way to drop the two keys before re-adding them —
 *    **throws** as well: *".omit() cannot be used on object schemas containing
 *    refinements"*. So does `.pick()`, for the same reason.
 *
 * What is left is to spread the spec's `.shape` (fields still flow in BY
 * REFERENCE, so a spec field change lands here) and re-attach the spec's
 * OBJECT-LEVEL rules by DELEGATION: re-parse the spec-owned keys through the
 * spec schema itself and forward its issues. That restates none of the spec's
 * grammar — the rejection message an author sees is the spec's own, and a
 * refinement the spec adds LATER flows in with no change here. The two
 * divergent keys are excluded from the delegated parse by construction, which
 * is the whole and only exemption.
 *
 * Cost: one extra parse of the spec-owned subset per validation. Acceptable —
 * nothing in objectui validates dashboards on a render path; this schema is a
 * published contract for consumers and tooling.
 *
 * Drift guard: `__tests__/report-chart-query-spec-parity.test.ts`.
 */
export const GlobalFilterSchema = z.object({
  ...SpecGlobalFilterSchema.shape,
  options: z.array(z.union([
    z.string(),
    z.object({
      value: z.union([z.string(), z.number(), z.boolean()]),
      label: z.string().optional(),
    }),
  ])).optional().describe('Static options — spec `{value,label}` objects or bare-string shorthand'),
  optionsFrom: z.object({
    object: z.string(),
    valueField: z.string(),
    labelField: z.string().optional(),
    filter: z.any().optional(),
  }).optional().describe('Dynamic option source'),
}).superRefine((filter, ctx) => {
  // Delegate every spec-owned rule (today the rc.6 date-`defaultValue`
  // refinement; tomorrow whatever the spec adds) to the spec schema itself.
  // `options`/`optionsFrom` are the declared divergences and are withheld —
  // both are `.optional()` upstream, so omitting them is valid input.
  const specOwned: Record<string, unknown> = { ...filter };
  delete specOwned.options;
  delete specOwned.optionsFrom;
  const result = SpecGlobalFilterSchema.safeParse(specOwned);
  if (result.success) return;
  for (const issue of result.error.issues) ctx.addIssue({ ...issue });
});

/**
 * Dashboard Schema - Dashboard component
 */
/**
 * Spec-owned Dashboard fields, flowing in **by reference** (objectstack#4115).
 *
 * `BaseSchema` is `.passthrough()` while the spec's `DashboardSchema` is
 * strict, so before this derivation every spec-only key rode through objectui
 * unvalidated — `header`, `refreshInterval`, `performance`, `aria`,
 * `protection` and the `_lock*`/`_package*`/`_provenance` package-lock
 * envelope were neither checked nor declared.
 *
 * Omitted, each for a stated reason:
 *  - `name`/`label`/`description` — component-envelope keys owned by BaseSchema;
 *  - `widgets`/`globalFilters`/`dateRange` — objectui's element schemas are
 *    their own ledger entries (the local widget still carries the legacy
 *    `component` envelope the spec has no room for, and both local configs are
 *    deliberately looser than spec's); migration deferred.
 *
 * `.partial()` guarantees no *future* spec field can become required and
 * silently invalidate stored objectui dashboards.
 */
const SpecDashboardFields = specFieldsExcept(SpecDashboardSchema.shape, [
  'name',
  'label',
  'description',
  'widgets',
  'globalFilters',
  'dateRange',
] as const);

/**
 * Dashboard Schema — the objectui dashboard renderer node, derived from
 * `@objectstack/spec/ui` `DashboardSchema` (see {@link SpecDashboardFields}).
 * The drift guard is `__tests__/page-app-dashboard-spec-parity.test.ts`.
 */
export const DashboardComponentSchema = BaseSchema.extend(SpecDashboardFields.shape).extend({
  type: z.literal('dashboard'),
  columns: z.number().optional().describe('Number of columns'),
  gap: z.number().optional().describe('Grid gap'),
  // Routed slot (objectui#6002): a component node (`metric-card`) is owned by
  // passthrough BaseSchema per the 2026-08-14 ruling; every other widget is
  // the `.strict()` spec-derived schema. Component arm first — it matches
  // exclusively on the closed component-type enum, so a spec-family widget
  // can never be captured by it.
  widgets: z.array(z.union([DashboardWidgetSlotComponentSchema, DashboardWidgetSchema]))
    .describe('Dashboard widgets'),
  globalFilters: z.array(GlobalFilterSchema).optional().describe('Dashboard-level filters'),
  dateRange: z.object({
    field: z.string().optional(),
    defaultRange: z.string().optional(),
    allowCustomRange: z.boolean().optional(),
  }).optional().describe('Built-in date range filter'),
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
 *
 * The `aria` member is an ADR-0049 retirement tombstone (objectui#5852),
 * following this package's convention (`data-display.zod.ts`
 * `StaticTableColumnSchema`, the set `crud.zod.ts` `confirm` established):
 * `z.never().optional()` REFUSES an authored value at parse time with the key
 * named in the error path, rather than letting it be silently stripped the way
 * an undeclared key would be on this non-`.strict()` object. Loud refusal is
 * the ruled outcome — `aria` was accepted-and-preserved for as long as it was
 * declared, so a plain deletion would have converted a preserved key into a
 * silent drop. The TS twin (`../designer.ts` `DashboardConfig`) no longer
 * declares it at all; both halves are pinned by
 * `__tests__/dashboard-config.test.ts`.
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
  aria: z.never({ error: 'RETIRED (objectui#5852) — `aria` is no longer part of DashboardConfig; delete the key. The `{ label, description }` spellings matched no renderer vocabulary and nothing ever read them.' }).optional().describe('RETIRED (objectui#5852) — the `{ label, description }` spellings matched no renderer vocabulary and no read point ever consumed them; delete the key. For real ARIA use the spec vocabulary (`ariaLabel` / `ariaDescribedBy` / `role`) on a surface that reads it.'),
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
  ChatbotEnhancedSchema,
  ChatbotFloatingSchema,
  DashboardComponentSchema,
]);
