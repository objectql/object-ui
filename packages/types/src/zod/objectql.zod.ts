/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - ObjectQL Component Zod Validators
 * 
 * Zod validation schemas for ObjectQL-specific components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/objectql
 * @packageDocumentation
 */

import { z } from 'zod';
import {
  ListViewSchema as SpecListViewSchema,
  KanbanConfigSchema as SpecKanbanConfigSchema,
  CalendarConfigSchema as SpecCalendarConfigSchema,
  GalleryConfigSchema as SpecGalleryConfigSchema,
  TimelineConfigSchema as SpecTimelineConfigSchema,
  HttpMethodSubsetSchema as SpecHttpMethodSubsetSchema,
  HttpRequestSchema as SpecHttpRequestSchema,
  ViewDataSchema as SpecViewDataSchema,
  ListColumnSchema as SpecListColumnSchema,
  SelectionConfigSchema as SpecSelectionConfigSchema,
  PaginationConfigSchema as SpecPaginationConfigSchema,
  UserActionsConfigSchema as SpecUserActionsConfigSchema,
  AriaPropsSchema as SpecAriaPropsSchema,
  NavigationConfigSchema as SpecNavigationConfigSchema,
} from '@objectstack/spec/ui';
import { BaseSchema, specFieldsExcept } from './base.zod.js';

/**
 * HTTP Method Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 *
 * The spec renamed the 5-value subset to `HttpMethodSubsetSchema` in
 * 17.0.0-rc.5 (objectstack#5832) to stop it colliding with the 7-value
 * `HttpMethod` in the published JSON Schema. The runtime domain is unchanged,
 * so this repo keeps exporting it under the `HttpMethodSchema` name — following
 * the rename WITHOUT changing cross-package semantics (objectui#3499).
 */
export const HttpMethodSchema = SpecHttpMethodSubsetSchema;

/**
 * HTTP Request Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror). Differences vs the old mirror:
 * `body` is the spec's `z.unknown()` (a superset of the old record/string/FormData/
 * Blob union) and `method` now defaults to `'GET'` on parse.
 */
export const HttpRequestSchema = SpecHttpRequestSchema;

/**
 * View Data Source Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror that had drifted behind the spec's
 * fourth `provider: 'schema'` variant for schema-bound forms).
 */
export const ViewDataSchema = SpecViewDataSchema;

/**
 * List Column Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231).
 *
 * This used to `.extend()` the spec with two objectui-only fields, each carrying
 * a note to promote it upstream rather than grow the extension. spec v17 did
 * exactly that (objectui#2231): `summary` is now the spec's
 * `union([ColumnSummarySchema, ColumnSummaryConfigSchema])` — the same enum ∪
 * `{ type, field }` form `useColumnSummary` in `@object-ui/plugin-grid` reads —
 * and `prefix` is the spec's `ColumnPrefixSchema`. With both upstream the
 * extension collapses to the plain re-export it always said it would become.
 *
 * One behavior change rides along: the spec's `prefix.type` defaults to `'text'`
 * on parse instead of staying `undefined`, so the renderer always gets a value.
 */
export const ListColumnSchema = SpecListColumnSchema;

/**
 * Selection Config Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror). `type` now defaults to `'none'`
 * on parse instead of staying undefined.
 */
export const SelectionConfigSchema = SpecSelectionConfigSchema;

/**
 * Pagination Config Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror). `pageSize` is now the spec's
 * positive-int with a default of 25 on parse.
 */
export const PaginationConfigSchema = SpecPaginationConfigSchema;

/**
 * Sort Config Schema
 */
export const SortConfigSchema = z.object({
  field: z.string().describe('Field to sort by'),
  order: z.enum(['asc', 'desc']).describe('Sort order'),
});

/**
 * ObjectGrid Schema
 */
export const ObjectGridSchema = BaseSchema.extend({
  type: z.literal('object-grid'),
  objectName: z.string().describe('ObjectQL object name'),
  data: ViewDataSchema.optional().describe('Data source configuration'),
  columns: z.union([z.array(z.string()), z.array(ListColumnSchema)]).optional().describe('Columns configuration'),
  filter: z.array(z.any()).optional().describe('Filter criteria'),
  sort: z.union([z.string(), z.array(SortConfigSchema)]).optional().describe('Sort configuration'),
  searchableFields: z.array(z.string()).optional().describe('Searchable fields'),
  resizable: z.boolean().optional().describe('Enable column resizing'),
  showColumnTypeIcons: z.boolean().optional().describe('Show column type icons (T/Tag/Calendar) in headers. Off by default — type is usually obvious from cell content; the icons add visual noise.'),
  selection: SelectionConfigSchema.optional().describe('Selection configuration'),
  pagination: PaginationConfigSchema.optional().describe('Pagination configuration'),
  bulkActions: z.array(z.string()).optional().describe('Bulk action identifiers (spec-canonical key; batchActions is the legacy alias)'),

  // Legacy fields
  fields: z.array(z.string()).optional(),
  staticData: z.array(z.any()).optional(),
  selectable: z.union([z.boolean(), z.enum(['single', 'multiple'])]).optional(),
  pageSize: z.number().optional(),
  showSearch: z.boolean().optional(),
  showFilters: z.boolean().optional(),
  showPagination: z.boolean().optional(),
  defaultSort: z.object({ field: z.string(), order: z.enum(['asc', 'desc']) }).optional(),
  defaultFilters: z.record(z.string(), z.any()).optional(),
  operators: z.record(z.string(), z.any()).optional(), // Missing in previous TS scan but common
  rowActions: z.array(z.string()).optional(),
  batchActions: z.array(z.string()).optional(),
  editable: z.boolean().optional(),
  keyboardNavigation: z.boolean().optional(),
  frozenColumns: z.number().optional(),
});

/**
 * ObjectForm Schema
 */
export const ObjectFormSchema = BaseSchema.extend({
  type: z.literal('object-form'),
  objectName: z.string().describe('ObjectQL object name'),
  mode: z.enum(['create', 'edit', 'view']).describe('Form mode'),
  recordId: z.union([z.string(), z.number()]).optional().describe('Record ID'),
  title: z.string().optional().describe('Form title'),
  description: z.string().optional().describe('Form description'),
  fields: z.array(z.string()).optional().describe('Included fields'),
  customFields: z.array(z.any()).optional().describe('Custom field configs'),
  initialData: z.record(z.string(), z.any()).optional().describe('Initial data'),
  groups: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(z.string()),
    collapsible: z.boolean().optional(),
    defaultCollapsed: z.boolean().optional(),
  })).optional().describe('Field groups'),
  layout: z.enum(['vertical', 'horizontal', 'inline', 'grid']).optional().describe('Form layout'),
  columns: z.number().optional().describe('Grid columns'),
  showSubmit: z.boolean().optional().describe('Show submit button'),
  submitText: z.string().optional().describe('Submit button text'),
  successMessage: z.string().optional().describe('Success toast text after create/update when no onSuccess handler is given'),
  navigateOnSuccess: z.string().optional().describe('Navigate here after success ({id}/{recordId} interpolated, same-origin-guarded); precedes the toast'),
  resetOnSuccess: z.boolean().optional().describe('Reset the form after a successful create for another entry'),
  submitBehavior: z.union([
    z.object({ kind: z.literal('thank-you'), title: z.string().optional(), message: z.string().optional() }),
    z.object({ kind: z.literal('redirect'), url: z.string(), delayMs: z.number().optional() }),
    z.object({ kind: z.literal('continue') }),
    z.object({ kind: z.literal('next-record') }),
  ]).optional().describe('Declarative post-submit behavior; takes precedence over successMessage/navigateOnSuccess/resetOnSuccess'),
  showCancel: z.boolean().optional().describe('Show cancel button'),
  cancelText: z.string().optional().describe('Cancel button text'),
  showReset: z.boolean().optional().describe('Show reset button'),
  initialValues: z.record(z.string(), z.any()).optional().describe('Initial values'),
  readOnly: z.boolean().optional().describe('Read-only mode'),
});

/**
 * ObjectView Schema
 */
export const ObjectViewSchema = BaseSchema.extend({
  type: z.literal('object-view'),
  objectName: z.string().describe('ObjectQL object name'),
  title: z.string().optional().describe('View title'),
  description: z.string().optional().describe('View description'),
  layout: z.enum(['drawer', 'modal', 'page']).optional().describe('Layout mode'),
  table: z.lazy(() => ObjectGridSchema.omit({ type: true, objectName: true }).partial()).optional().describe('Table config'),
  form: z.lazy(() => ObjectFormSchema.omit({ type: true, objectName: true, mode: true }).partial()).optional().describe('Form config'),
  showSearch: z.boolean().optional().describe('Show search'),
  showFilters: z.boolean().optional().describe('Show filters'),
  showSort: z.boolean().optional().describe('Show sort controls'),
  showCreate: z.boolean().optional().describe('Show create button'),
  showRefresh: z.boolean().optional().describe('Show refresh button'),
  operations: z.object({
    create: z.boolean().optional(),
    read: z.boolean().optional(),
    update: z.boolean().optional(),
    delete: z.boolean().optional(),
  }).optional().describe('Enabled operations'),
});

/**
 * User Filters — field-level filter option
 */
const UserFilterOptionSchema = z.object({
  label: z.string().describe('Option display label'),
  value: z.union([z.string(), z.number(), z.boolean()]).describe('Option value'),
  color: z.string().optional().describe('Option badge color'),
});

/**
 * User Filters — field-level filter definition (dropdown & toggle modes)
 */
const UserFilterFieldSchema = z.object({
  field: z.string().describe('Field name to filter on'),
  label: z.string().optional().describe('Display label'),
  type: z.enum(['select', 'multi-select', 'boolean', 'date-range', 'text']).optional().describe('Filter input type'),
  options: z.array(UserFilterOptionSchema).optional().describe('Static options'),
  showCount: z.boolean().optional().describe('Show record count per option'),
  defaultValues: z.array(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Default selected values'),
});

/**
 * User Filters — tab preset rule: `{ field, operator, value }`, the same
 * predicate shape used by every other filter in the protocol.
 */
const UserFilterTabRuleSchema = z.object({
  field: z.string().describe('Field name to filter on'),
  operator: z.string().describe('Filter operator (equals, not_equals, contains, in, greater_than, less_than, …)'),
  value: z.any().optional().describe('Filter value'),
});

/**
 * User Filters — tab preset definition (tabs mode).
 *
 * Canonical shape: `{ name, label, icon?, filter, isDefault? }`. The legacy
 * `{ id, filters, default }` fields stay optional (normalized at runtime by
 * `normalizeTabPresets`) so older metadata keeps validating, but new authoring
 * — by AI or the Studio tabs editor — emits the canonical form.
 */
const UserFilterTabSchema = z
  .object({
    name: z.string().optional().describe('Unique tab identifier (snake_case)'),
    label: z.string().describe('Tab display label'),
    filter: z.array(UserFilterTabRuleSchema).optional().describe('Filter rules applied when this tab is active'),
    icon: z.string().optional().describe('Lucide icon name'),
    isDefault: z.boolean().optional().describe('Whether this tab is active by default'),

    /** @deprecated use `name` */
    id: z.string().optional().describe('@deprecated use name'),
    /** @deprecated use `filter` */
    filters: z.array(z.union([z.array(z.any()), z.string()])).optional().describe('@deprecated use filter'),
    /** @deprecated use `isDefault` */
    default: z.boolean().optional().describe('@deprecated use isDefault'),
  })
  .refine((t) => Boolean(t.name || t.id), { message: 'tab requires a name' });

/**
 * User Filters Configuration Schema (Airtable Interfaces-style)
 */
const UserFiltersSchema = z.object({
  // AUTHORING contract (ADR-0053): `toggle` is deliberately not authorable —
  // new configs can only write dropdown/tabs. The RENDERER still honors
  // stored `toggle` metadata (spec ADR-0047 §3.4a keeps it in ITS enum "so
  // existing configs keep rendering") — see plugin-list `UserFilters`.
  element: z.enum(['dropdown', 'tabs']).describe('UI element type'),
  fields: z.array(UserFilterFieldSchema).optional().describe('Field-level filters'),
  tabs: z.array(UserFilterTabSchema).optional().describe('Named filter presets'),
  allowAddTab: z.boolean().optional().describe('Allow adding new tabs'),
  showAllRecords: z.boolean().optional().describe('Show All records tab'),
});

/**
 * ListView Schema — derived from `@objectstack/spec/ui` `ListViewSchema` (issue #2231).
 *
 * Spec-owned fields flow in **by reference** (see the `.extend()` on the declaration) so they auto-track
 * the protocol instead of being re-typed here; the drift-guard test
 * (`__tests__/list-view-spec-parity.test.ts`) fails if the spec grows a field objectui
 * has not triaged. objectui-only / legacy fields are declared locally on top via
 * `.extend()` (the final extend wins, so these override anything imported):
 *   - component envelope: `type: 'list-view'` discriminator + `objectName` binding;
 *   - legacy vocabulary kept for back-compat: `viewType` (renamed spec `type`),
 *     `fields`/`columns`, `filters`, the `show*` toolbar flags, `densityMode`, `color`, …;
 *   - configs whose objectui shape is intentionally broader than spec's (migration
 *     deferred): `userFilters`, `sharing`, `aria`, `conditionalFormatting`, `exportOptions`.
 *
 * The per-view-type configs (`kanban`/`calendar`/`gantt`/`gallery`/`timeline`) are no
 * longer forks: they derive from the spec configs below, keeping only `calendar.defaultView`
 * (no spec counterpart) and four deprecated aliases for the pre-#2231 vocabulary.
 *
 * Migrating the remaining legacy vocabulary to the spec-canonical keys (`type`/`columns`/
 * `filter`/`userActions`) is deferred — see #2231.
 */
// Spec view-config keys objectui overrides locally: the component envelope
// (name/label/description → BaseSchema), the discriminator/renamed/relaxed keys
// (type/columns), and the configs redeclared below. EVERY other spec key flows
// in by reference at the declaration — see `SPEC_FIELDS` there.
const LIST_VIEW_LOCAL_OVERRIDES = [
  'type',
  'columns',
  'name',
  'label',
  'description',
  'userFilters',
  'userActions',
  'aria',
  'conditionalFormatting',
  'exportOptions',
  'kanban',
  'calendar',
  'gallery',
  'timeline',
] as const;

// ── Per-view-type configs, derived from spec (issue #2231) ────────────────────
// Each is the spec config `.partial()`-ed: spec requires `columns`/`titleField`/
// `startDateField` on some of these, but objectui authors partial configs (the
// product's own CreateViewDialog emits `kanban: { groupByField }` alone), so
// requiring them would reject views the app itself creates. `.partial()` keeps the
// spec's field set and types by reference while staying permissive — the same
// trade-off the spec-field import on `ListViewSchema` makes.
//
// `gantt` needs no local schema at all: the spec config already covers every field
// the renderer reads and is `.passthrough()` for renderer-ahead knobs, so it flows
// in with the rest of the imported spec fields.
//
// The deprecated aliases below are the pre-#2231 objectui vocabulary. They stay
// accepted so stored view metadata keeps validating, but the spec key is canonical
// and wins at every read-site.
//
// `.passthrough()` is kept from the pre-#2231 shapes for the same reason the spec
// puts it on `GanttConfigSchema`/`TreeConfigSchema`: the renderers grow config knobs
// ahead of the protocol (calendar's `allDayField`, for one), and stripping them here
// would silently disable a shipped capability.
const KanbanConfig = SpecKanbanConfigSchema.partial().extend({
  /** @deprecated legacy alias for the spec's `groupByField` */
  groupField: z.string().optional().describe('Deprecated alias for groupByField'),
  /** @deprecated legacy alias for the spec's `columns` (fields shown on each card) */
  cardFields: z.array(z.string()).optional().describe('Deprecated alias for columns'),
}).passthrough();

const CalendarConfig = SpecCalendarConfigSchema.partial().extend({
  // objectui-only: the calendar renderer's initial view mode. No spec counterpart —
  // promote it rather than growing this extension.
  defaultView: z.enum(['month', 'week', 'day', 'agenda']).optional().describe('Initial calendar view mode'),
}).passthrough();

const GalleryConfig = SpecGalleryConfigSchema.partial().extend({
  /** @deprecated legacy alias for the spec's `coverField` */
  imageField: z.string().optional().describe('Deprecated alias for coverField'),
}).passthrough();

const TimelineConfig = SpecTimelineConfigSchema.partial().extend({
  /** @deprecated legacy alias for the spec's `startDateField` */
  dateField: z.string().optional().describe('Deprecated alias for startDateField'),
}).passthrough();

// View-kind enum reused from spec (unwrap its `.default('grid')`) so it cannot drift.
const ViewKindEnum = SpecListViewSchema.shape.type.removeDefault();

/**
 * User Actions — the spec's `UserActionsConfigSchema` plus the three toolbar
 * affordances it does not model yet (#2890 scope A step 3).
 *
 * The spec documents this object as "which interactive actions are available to
 * users in the view toolbar — each boolean toggles the corresponding toolbar
 * element on/off", and already carries `rowHeight` (objectui's old
 * `showDensity`). Grouping, column visibility and row coloring are the same kind
 * of toggle — the spec models all three as CONFIGURATION (`grouping`,
 * `hiddenFields`, `rowColor`) but has no "may the user change it" switch for
 * any of them, so an author cannot express a complete toolbar policy. These
 * three are named after the config key they gate, following the precedent
 * `rowHeight` set.
 *
 * This `.extend()` is temporary: it collapses into a plain re-export once the
 * keys land upstream. Note `UserActionsConfigSchema` is NOT `.strict()`, so
 * before this extension an author writing `userActions: { group: false }` had
 * it silently stripped — valid on parse, no effect at render.
 */
export const UserActionsSchema = SpecUserActionsConfigSchema.extend({
  group: z.boolean().optional().describe('Allow users to group records'),
  hideFields: z.boolean().optional().describe('Allow users to show/hide columns'),
  rowColor: z.boolean().optional().describe('Allow users to color rows by a field value'),
});

export const ListViewSchema = BaseSchema
  // Spec-owned fields by reference. `specFieldsExcept` reads the spec object's
  // `.shape` rather than calling `.omit()`, which zod 4 refuses on a schema
  // carrying a refinement (objectui#3063); `.partial()` inside it guarantees no
  // *future* spec field can become required and silently invalidate stored
  // objectui payloads. The spec binding sits in this initializer on purpose —
  // that is what makes the derivation visible to
  // `scripts/check-spec-symbol-derivation.mjs` instead of hidden one hop away.
  //
  // Imported here: data, filter, sort, searchableFields,
  // filterableFields, resizable, striped, bordered, compactToolbar, selection, navigation,
  // pagination, chart, tree, rowHeight, grouping, rowColor, hiddenFields, fieldOrder,
  // rowActions, bulkActions, bulkActionDefs, virtualScroll, inlineEdit, userActions,
  // appearance, tabs, addRecord, showRecordCount, allowPrinting, emptyState, responsive,
  // performance.
  //
  // `striped`, `bordered` and `virtualScroll` are in that list because the spec
  // pin still carries them, NOT because objectui offers them: objectstack#7176
  // retired all three (maintainer-ruled 2026-08-10) after measuring every
  // objectui reader as pass-through — no renderer ever applied one. objectui's
  // own declarations and the forwarding chain came out with objectui#4649; what
  // is left here is the by-reference import, which is exactly what must stay.
  // It carries the spec's `retiredKey()` tombstones in on the GA bump, so an
  // author writing one gets a rejection from the protocol rather than silence.
  // Do NOT add them to LIST_VIEW_LOCAL_OVERRIDES to "clean this up" — that
  // excludes the tombstone and hands the key back to `BaseSchema`'s
  // passthrough, turning a loud rejection into a silently-accepted dead key.
  // Re-forwarding needs an implementation card filed first (the ruling's text).
  .extend(specFieldsExcept(SpecListViewSchema.shape, LIST_VIEW_LOCAL_OVERRIDES).shape)
  .extend({
    // Component discriminator — load-bearing for the ObjectQLComponentSchema union.
    type: z.literal('list-view'),
    // objectui-only object binding (spec binds via data.provider:'object'; migration deferred).
    objectName: z.string().describe('Object Name'),
    // Renamed spec `type` (view-kind); enum imported from spec so it can't drift.
    viewType: ViewKindEnum.optional().describe('View Type'),
    // Relaxed spec `columns` (spec requires it) + legacy `fields` alias for string[] columns.
    columns: z.union([z.array(z.string()), z.array(ListColumnSchema)]).optional().describe('Columns definition'),
    // Legacy alias for `columns`, still accepted because stored view metadata
    // carries it. NO renderer reads it: `normalizeListViewSchema`
    // (`@object-ui/core`) folds it into `columns` at the ListView boundary
    // (#2890). Producers must emit `columns`.
    fields: z.array(z.string()).optional().describe('Legacy alias for string[] columns'),
    // Legacy alias for the spec's `filter`, still accepted because stored view
    // metadata carries it. NO renderer reads it: `normalizeListViewSchema`
    // (`@object-ui/core`) folds it into `filter` at the ListView boundary
    // (#2890). Note both keys carry an ObjectQL FilterNode array at runtime,
    // even though `filter` is typed from the spec as `ViewFilterRule[]`.
    filters: z.array(z.union([z.array(z.any()), z.string()])).optional().describe('Filter conditions (legacy)'),
    // Legacy toolbar visibility flags (spec-canonical is `userActions`; runtime dual-reads).
    showSearch: z.boolean().optional().describe('Show search in toolbar'),
    showSort: z.boolean().optional().describe('Show sort controls in toolbar'),
    showFilters: z.boolean().optional().describe('Show filter controls in toolbar'),
    showHideFields: z.boolean().optional().describe('Show hide-fields button in toolbar'),
    showGroup: z.boolean().optional().describe('Show group button in toolbar'),
    showColor: z.boolean().optional().describe('Show color button in toolbar'),
    showDensity: z.boolean().optional().describe('Show density/row-height button in toolbar'),
    showDescription: z.boolean().optional().describe('Show field descriptions'),
    allowExport: z.boolean().optional().describe('Allow data export'),
    // Legacy alias for the spec's `rowHeight`, still accepted because stored
    // view metadata carries it. NO renderer reads it: `normalizeListViewSchema`
    // (`@object-ui/core`) folds it into `rowHeight` at the ListView boundary
    // (#2890). Note the vocabularies differ in size — three densities widen
    // onto the spec's five row heights.
    densityMode: z.enum(['compact', 'comfortable', 'spacious']).optional().describe('Density mode'),
    color: z.string().optional().describe('Color field for row/card coloring'),
    fieldTextColor: z.string().optional().describe('Field for custom text color'),
    prefixField: z.string().optional().describe('Prefix field before title'),
    wrapHeaders: z.boolean().optional().describe('Wrap column headers'),
    clickIntoRecordDetails: z.boolean().optional().describe('Navigate to detail on row click'),
    addRecordViaForm: z.boolean().optional().describe('Add records via form dialog'),
    addDeleteRecordsInline: z.boolean().optional().describe('Enable inline add/delete'),
    collapseAllByDefault: z.boolean().optional().describe('Collapse all groups by default'),
    options: z.record(z.string(), z.any()).optional().describe('Component overrides (legacy)'),
    operations: z.object({
      create: z.boolean().optional(),
      read: z.boolean().optional(),
      update: z.boolean().optional(),
      delete: z.boolean().optional(),
      export: z.boolean().optional(),
      import: z.boolean().optional(),
    }).optional().describe('Enabled operations'),
    // ── Local overrides: objectui shapes are intentionally broader than spec (deferred) ──
    userFilters: UserFiltersSchema.optional().describe('User filters configuration (accepts legacy tab shapes)'),
    // Spec `userActions` + the three toolbar toggles it does not model yet (#2890).
    userActions: UserActionsSchema.optional().describe('User action toggles for the view toolbar'),
    // `sharing` is the spec's `ViewSharingSchema`, imported by reference above.
    // The legacy `{ visibility, enabled }` pair folds into it at the ListView
    // boundary (#2890) — see `normalizeListViewSchema`.
    // ARIA — the spec's `AriaPropsSchema` (`ariaLabel` / `ariaDescribedBy` /
    // `role`) plus `live`, which has no spec counterpart. The legacy
    // `{ label, describedBy }` spellings fold into the canonical ones at the
    // ListView boundary (#2890).
    aria: SpecAriaPropsSchema.extend({
      live: z.enum(['polite', 'assertive', 'off']).optional()
        .describe('aria-live politeness for the list region (objectui-only — promote rather than grow this extension)'),
    }).optional().describe('ARIA attributes'),
    conditionalFormatting: z.array(z.union([
      z.object({
        field: z.string(),
        operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in']),
        value: z.any(),
        backgroundColor: z.string().optional(),
        textColor: z.string().optional(),
        borderColor: z.string().optional(),
        expression: z.string().optional(),
      }),
      z.object({
        condition: z.string(),
        style: z.record(z.string(), z.string()),
      }),
    ])).optional().describe('Conditional formatting rules'),
    exportOptions: z.union([
      z.array(z.enum(['csv', 'xlsx', 'json', 'pdf'])),
      z.object({
        formats: z.array(z.enum(['csv', 'xlsx', 'json', 'pdf'])).optional(),
        maxRecords: z.number().optional(),
        includeHeaders: z.boolean().optional(),
        fileNamePrefix: z.string().optional(),
      }),
    ]).optional().describe('Export options'),
    // Per-view-type configs — spec-derived (see the definitions above #2231).
    // `gantt` is NOT here: it flows in from the spec fields unmodified.
    kanban: KanbanConfig.optional().describe('Kanban-specific configuration'),
    calendar: CalendarConfig.optional().describe('Calendar-specific configuration'),
    gallery: GalleryConfig.optional().describe('Gallery-specific configuration'),
    timeline: TimelineConfig.optional().describe('Timeline-specific configuration'),
  });

/**
 * TS type for the ListView component node (spec-derived; issue #2231).
 * The hand-written `interface ListViewSchema` in `../objectql.ts` is now an alias of
 * this type intersected with the non-serializable runtime-only props.
 *
 * `z.input`, not `z.infer` (framework#4074): this type describes the SDUI JSON as
 * AUTHORED and as the renderer actually RECEIVES it. The spec sub-schemas that flow
 * in (`userActions`, `tabs`→`ViewTab`, `sharing`, …) carry `.default()`s, so their
 * `z.infer` output makes those fields required — but nothing on the render path
 * runs `.parse()` to apply them: `normalizeListViewSchema` (`@object-ui/core`)
 * deliberately applies no defaults ("an absent flag stays absent", its test suite).
 * Typing the surface as parsed output therefore rejected valid authored metadata
 * (`userActions: { sort: true }`, a tab without `pinned`/`visible`) while promising
 * renderers defaults that never arrive. The output type of a spec parse belongs to
 * whoever actually parses; this surface is input on both sides.
 */
export type ListViewInferred = z.input<typeof ListViewSchema>;

/**
 * Object Map Configuration Schema — the runtime half of `ObjectMapConfig`
 * (`objectql.ts`).
 *
 * NOT named `MapConfigSchema`: `@objectstack/spec/automation` exports that name
 * for an unrelated automation concept, and `check:spec-symbols` refuses a local
 * declaration under a spec export's name.
 *
 * Lifted out of `plugin-map/src/ObjectMap.tsx`, where it was package-private,
 * so the declared authoring face and the validation the renderer performs are
 * ONE schema rather than two that can drift (objectui#5018). `ObjectMap`
 * imports this exact object; it no longer declares its own.
 */
export const ObjectMapConfigSchema = z.object({
  latitudeField: z.string().optional().describe('Field containing latitude'),
  longitudeField: z.string().optional().describe('Field containing longitude'),
  locationField: z.string().optional().describe('Field with a combined location value'),
  titleField: z.string().optional().describe('Field used as the marker title'),
  descriptionField: z.string().optional().describe('Field used as the marker description'),
  zoom: z.number().optional().describe('Zoom level (1-20); declaring it opts out of the auto-fit'),
  center: z.tuple([z.number(), z.number()]).optional().describe('Center [lat, lng]; declaring it opts out of the auto-fit'),
  style: z.string().optional().describe('MapLibre style URL/spec (overrides the public demo default)'),
});

/**
 * ObjectMap Schema
 *
 * Mirrors the `ObjectMapSchema` interface in `objectql.ts` key for key. Every
 * key has a read site in `plugin-map/src/ObjectMap.tsx`; the FLAT spelling of
 * the `map` block's keys is the ObjectView/ListView flatten product and stays
 * out of this declaration (maintainer ruling on objectui#5018, 2026-08-17) —
 * except `locationField` / `titleField`, which were published before the
 * ruling and stay for compatibility.
 */
export const ObjectMapSchema = BaseSchema.extend({
  type: z.literal('object-map'),
  objectName: z.string().describe('ObjectQL object name'),
  data: ViewDataSchema.optional().describe('Data source configuration'),
  staticData: z.array(z.any()).optional().describe('Inline records'),
  filter: z.array(z.any()).optional().describe('Query filter, forwarded as $filter'),
  sort: z.union([z.string(), z.array(SortConfigSchema)]).optional().describe('Sort configuration, forwarded as $orderby'),
  map: ObjectMapConfigSchema.optional().describe('Map configuration (the author face)'),
  enableClustering: z.boolean().optional().describe('Group nearby markers into clusters'),
  navigation: SpecNavigationConfigSchema.optional().describe('Record navigation behaviour (drawer/dialog/page)'),
  locationField: z.string().optional().describe('Location field (internal flat form; prefer map.locationField)'),
  titleField: z.string().optional().describe('Title field (internal flat form; prefer map.titleField)'),
  mapStyle: z.string().optional().describe('MapLibre style URL/spec (overrides the public demo default)'),
});

/**
 * ObjectTree (tree-grid) Schema
 */
export const ObjectTreeSchema = BaseSchema.extend({
  type: z.literal('object-tree'),
  objectName: z.string().describe('ObjectQL object name'),
  parentField: z.string().optional().describe('Single-parent pointer field (auto-detected when omitted)'),
  labelField: z.string().optional().describe('Field rendered indented in the first column'),
  fields: z.array(z.string()).optional().describe('Additional flat columns'),
  defaultExpandedDepth: z.number().optional().describe('Default expansion depth (0 = roots only)'),
});

/**
 * ObjectGantt Schema
 */
export const ObjectGanttSchema = BaseSchema.extend({
  type: z.literal('object-gantt'),
  objectName: z.string().describe('ObjectQL object name'),
  startDateField: z.string().optional().describe('Start date field'),
  endDateField: z.string().optional().describe('End date field'),
  titleField: z.string().optional().describe('Title field'),
  dependencyField: z.string().optional().describe('Dependency field'),
  progressField: z.string().optional().describe('Progress field'),
});

/**
 * ObjectCalendar Schema
 */
export const ObjectCalendarSchema = BaseSchema.extend({
  type: z.literal('object-calendar'),
  objectName: z.string().describe('ObjectQL object name'),
  startDateField: z.string().optional().describe('Start date field'),
  endDateField: z.string().optional().describe('End date field'),
  titleField: z.string().optional().describe('Title field'),
  defaultView: z.enum(['month', 'week', 'day', 'agenda']).optional().describe('Default view'),
});

/**
 * ObjectKanban Schema
 */
// Since #1584, kanban card styling runs on the shared CEL evaluator, so a
// kanban rule accepts BOTH the native `{ field, operator, value }` shape and the
// spec `{ condition, style }` shape (a CEL predicate + style map) — matching
// list/grid `conditionalFormatting`. The type/schema now match the runtime.
const KanbanConditionalFormattingRuleSchema = z.union([
  z.object({
    field: z.string().describe('Field name to check'),
    operator: z.enum(['equals', 'not_equals', 'contains', 'in']).describe('Comparison operator'),
    value: z.union([z.string(), z.array(z.string())]).describe('Value to compare against'),
    backgroundColor: z.string().optional().describe('Background color'),
    borderColor: z.string().optional().describe('Border color'),
  }),
  z.object({
    condition: z.string().describe('CEL predicate evaluated against the card record'),
    style: z.record(z.string(), z.string()).describe('CSS styles applied when the condition is true'),
  }),
]);

export const ObjectKanbanSchema = BaseSchema.extend({
  type: z.literal('object-kanban'),
  objectName: z.string().describe('ObjectQL object name'),
  groupField: z.string().describe('Group field'),
  titleField: z.string().optional().describe('Title field'),
  cardFields: z.array(z.string()).optional().describe('Card fields'),
  quickAdd: z.boolean().optional().describe('Enable Quick Add button at column bottom'),
  coverImageField: z.string().optional().describe('Field name for cover image on cards'),
  allowCollapse: z.boolean().optional().describe('Allow columns to collapse/expand'),
  conditionalFormatting: z.array(KanbanConditionalFormattingRuleSchema).optional().describe('Card conditional formatting rules'),
});

/**
 * ObjectChart Schema
 */
export const ObjectChartSchema = BaseSchema.extend({
  type: z.literal('object-chart'),
  // Legacy inline path (objectName + aggregate). Optional now that a chart may
  // instead bind to a semantic-layer dataset (ADR-0021, #1890).
  objectName: z.string().optional().describe('ObjectQL object name (legacy inline path)'),
  chartType: z.enum(['bar', 'line', 'pie', 'area', 'scatter']).describe('Chart type'),
  xAxisField: z.string().optional().describe('X axis field (legacy inline path)'),
  yAxisFields: z.array(z.string()).optional().describe('Y axis fields (legacy)'),
  aggregation: z.enum(['cardinality', 'sum', 'avg', 'min', 'max']).optional().describe('Aggregation (legacy)'),
  // ADR-0021 semantic-layer binding: dimensions/measures selected BY NAME from a
  // dataset, queried via the governed queryDataset path.
  dataset: z.string().optional().describe('Semantic-layer dataset name (ADR-0021)'),
  dimensions: z.array(z.string()).optional().describe('Dataset dimension names'),
  values: z.array(z.string()).optional().describe('Dataset measure names'),
  // Colors are overloaded kanban-style: a string[] is the positional palette
  // (applied per category in order; fallback only), while a Record<value,color>
  // is an explicit value→color map. A select/lookup dimension's option colors —
  // and any explicit map — take precedence over the positional palette per
  // category, so health green/red/yellow paints semantically.
  colors: z.union([
    z.array(z.string()),
    z.record(z.string(), z.string()),
  ]).optional().describe('Positional palette (string[]) OR a value→color map ({ value: color }, kanban-style). Select/lookup option colors and explicit maps win over the palette per category.'),
});

/**
 * ObjectQL Component Schema Union
 */
export const ObjectQLComponentSchema = z.union([
  ObjectGridSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ObjectMapSchema,
  ObjectTreeSchema,
  ObjectGanttSchema,
  ObjectCalendarSchema,
  ObjectKanbanSchema,
  ObjectChartSchema,
  ListViewSchema,
]);
