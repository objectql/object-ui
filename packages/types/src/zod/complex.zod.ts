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
import {
  DashboardSchema as SpecDashboardSchema,
  DashboardWidgetSchema as SpecDashboardWidgetSchema,
  GlobalFilterSchema as SpecGlobalFilterSchema,
} from '@objectstack/spec/ui';
import { BaseSchema, SchemaNodeSchema, specFieldsExcept } from './base.zod.js';
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
  onEventClick: z
    .function()
    .optional()
    .describe('Host-only event click handler (authored JSON cannot produce a function)'),
  onViewChange: z.function().optional().describe('Host-only view change handler'),
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
 * Filter Group Schema
 */
export const FilterGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    operator: z.enum(['and', 'or']).describe('Group operator'),
    conditions: z.array(z.union([FilterBuilderConditionSchema, FilterGroupSchema])).describe('Conditions or sub-groups'),
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
  defaultValue: z.union([FilterBuilderConditionSchema, FilterGroupSchema]).optional().describe('Default filter value'),
  value: z.union([FilterBuilderConditionSchema, FilterGroupSchema]).optional().describe('Controlled filter value'),
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
  processVisibility: z.enum(['hidden', 'summary', 'debug']).optional().describe('How much agent reasoning/tool detail to show'),
  height: z.union([z.string(), z.number()]).optional().describe('Chatbot height'),
  api: z.string().optional().describe('Backend API endpoint for streaming chat'),
  conversationId: z.string().optional().describe('Conversation ID for multi-turn context'),
  systemPrompt: z.string().optional().describe('System prompt for assistant behavior'),
  model: z.string().optional().describe('AI model identifier'),
  streamingEnabled: z.boolean().optional().describe('Enable streaming responses'),
  headers: z.record(z.string(), z.string()).optional().describe('Additional API headers'),
  body: z.record(z.string(), z.unknown()).optional().describe('Additional API body params'),
  maxToolRoundtrips: z.number().optional().describe('Max tool-calling round-trips'),
  onError: z.function().optional().describe('Error callback'),
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
 *  - `type` widened to `z.string()` — objectui's `DASHBOARD_WIDGET_TYPES` also
 *    carries `list` and `custom`, which the spec's 19-family visualization enum
 *    does not model. Narrowing here would reject widgets the designer emits.
 *  - `component` — the legacy `{ id, component: <SDUI node>, layout }` envelope,
 *    which the spec has no room for. Migration to the shorthand form is deferred.
 *
 * Drift guard: `__tests__/report-chart-query-spec-parity.test.ts`.
 */
export const DashboardWidgetSchema = specFieldsExcept(SpecDashboardWidgetSchema.shape, [
  'id',
  'type',
] as const).extend({
  id: z.string().optional().describe('Widget ID'),
  type: z.string().optional().describe('Widget visualization type (spec shorthand; widened for `list`/`custom`)'),
  component: SchemaNodeSchema.optional().describe('Widget Component (legacy format)'),
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
  widgets: z.array(DashboardWidgetSchema).describe('Dashboard widgets'),
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
  DashboardComponentSchema,
]);
