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
  GanttConfigSchema as SpecGanttConfigSchema,
  CalendarConfigSchema as SpecCalendarConfigSchema,
  GalleryConfigSchema as SpecGalleryConfigSchema,
  GroupingConfigSchema as SpecGroupingConfigSchema,
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
import { handlerKeyRefusal, retirementTombstone } from './tombstone.zod.js';
import { DrillDownConfigSchema } from './data-display.zod.js';
import { ViewSwitcherSchema } from './views.zod.js';
import { stripImportedDefaults } from './imported-defaults.js';

/**
 * ⭐ THE IMPORT BOUNDARY (objectui#8317, decision batch #90, 2026-09-08).
 *
 * **This mirror authors no default, imported subschemas included.** Batch #69
 * (objectui#7735) ruled that a validator validates and does not write values
 * into an author's document; batch #90 ruled that this holds for EVERY key
 * `safeValidateSchema` answers, not only the sites this repository wrote. So a
 * schema arriving from `@objectstack/spec` crosses into a mirror shape only
 * through `stripImportedDefaults`, which removes each reachable `ZodDefault`
 * with `.removeDefault()` and keeps the key omissible. Keys, types, checks and
 * the accept set are untouched, and a subtree carrying no default comes back
 * reference-equal — so this is a no-op the day the spec adopts the same
 * principle.
 *
 * ⛔ Spelled at every crossing rather than once per file, deliberately: a local
 * `const Spec… = stripImportedDefaults(…)` would put the spec's provenance one
 * hop away from every declaration that reads it, and `check:spec-symbols`
 * (rule 1) reads exactly one hop — a mirror export under a spec-owned name has
 * to show the spec binding in its OWN initializer. The verbosity is the
 * provenance.
 *
 * ⚠️ A read that is NOT a crossing stays unwrapped and is declared as such: a
 * value VOCABULARY (`./views.zod.ts`'s `SpecListViewTypeEnum` and
 * `./objectql.zod.ts`'s `ViewKindEnum`, which unwrap the spec's own
 * `.default('grid')` to reach its enum) and a TYPE position — neither puts a
 * default into a parsed document. `../__tests__/imported-defaults-8317.test.ts`
 * re-derives that exception list from the source rather than trusting this
 * paragraph, and fails if an entry stops matching a real read.
 */


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
export const HttpMethodSchema = stripImportedDefaults(SpecHttpMethodSubsetSchema);

/**
 * HTTP Request Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror). Differences vs the old mirror:
 * `body` is the spec's `z.unknown()` (a superset of the old record/string/FormData/
 * Blob union) and `method` now defaults to `'GET'` on parse.
 */
export const HttpRequestSchema = stripImportedDefaults(SpecHttpRequestSchema);

/**
 * View Data Source Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror that had drifted behind the spec's
 * fourth `provider: 'schema'` variant for schema-bound forms).
 */
export const ViewDataSchema = stripImportedDefaults(SpecViewDataSchema);

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
export const ListColumnSchema = stripImportedDefaults(SpecListColumnSchema);

/**
 * Selection Config Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror). `type` now defaults to `'none'`
 * on parse instead of staying undefined.
 */
export const SelectionConfigSchema = stripImportedDefaults(SpecSelectionConfigSchema);

/**
 * Pagination Config Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror). `pageSize` is now the spec's
 * positive-int with a default of 25 on parse.
 */
export const PaginationConfigSchema = stripImportedDefaults(SpecPaginationConfigSchema);

/**
 * Sort Config Schema
 */
export const SortConfigSchema = z.object({
  field: z.string().describe('Field to sort by'),
  order: z.enum(['asc', 'desc']).describe('Sort order'),
});

/**
 * The spec's OBJECT arm of `exportOptions`, as a SHAPE, reached without restating
 * its keys (objectui#7762).
 *
 * `ListViewExportOptionsSchema` is internal to the spec bundle and NOT a public
 * export (measured, not assumed, by `../__tests__/export-options-spec-parity.test.ts`).
 * The exported `ListViewSchema.shape.exportOptions` is the whole contract, but it is a
 * TWO-ARM union: the legacy bare format array — which LIFTS to `{ formats }` at parse —
 * and the strict five-key object. `ListViewSchema` below binds that union by reference
 * and is right to: `list-view` reads both spellings. `object-grid` does not, so this
 * peels the object arm out and leaves the lifting arm behind.
 *
 * Peeled rather than restated on purpose: a local copy of the five keys is a third
 * copy of one contract, and the copy is what drifts (the lesson `objectql.ts`'s
 * `ListViewExportOptions` docblock already records for the TypeScript face). Every
 * member here is the spec's own schema object, so `'pdf'` and a sixth key stay refused
 * with the spec's own messages and a spec-side change moves this member with it.
 *
 * The TYPE is derived by the same two steps at the TYPE level (`unwrap` then the arm with a
 * `shape`), so the authoring face keeps the spec's per-member types — a `z.ZodRawShape`
 * annotation here would erase them and collapse `z.input` of every member to `unknown`,
 * which the mirror-parity drift ledger reports as `exportOptions` NARROWER than declared.
 *
 * THROWS at module load if the spec stops exposing an object arm. That is the intended
 * failure: the alternative is a member that silently stops being the spec's, which is
 * the class of defect this whole file exists to make visible.
 */
type SpecExportOptionsUnion = ReturnType< typeof SpecListViewSchema.shape.exportOptions.unwrap >;
/** The object arm, statically: the one union member exposing a `shape` (the other is the lift's pipe). */
type SpecExportOptionsObjectArm = Extract< SpecExportOptionsUnion['options'][number], { shape: unknown } >;
type SpecExportOptionsShape = SpecExportOptionsObjectArm['shape'];

const SPEC_EXPORT_OPTIONS_OBJECT_SHAPE: SpecExportOptionsShape = ((): SpecExportOptionsShape => {
  type Peelable = {
    unwrap?: () => Peelable;
    options?: readonly Peelable[];
    shape?: SpecExportOptionsShape;
  };
  let cur = stripImportedDefaults(SpecListViewSchema).shape.exportOptions as unknown as Peelable;
  for (let i = 0; i < 5 && cur && !cur.options && typeof cur.unwrap === 'function'; i++) {
    cur = cur.unwrap();
  }
  const arm = cur.options?.find((o) => o.shape);
  if (!arm?.shape) {
    // Short on purpose: this string SHIPS (the console's `framework` chunk), while the
    // docblock above it — which carries the rationale and the remedy — is stripped by the
    // production minifier. It still names the moved spec symbol, the member that depends on
    // it, and the card, which is what a diagnostic has to do.
    throw new Error(
      '@object-ui/types: no object arm on `ListViewSchema.shape.exportOptions`; ' +
        '`ObjectGridSchema.exportOptions` binds it by reference (objectui#7762).',
    );
  }
  return arm.shape;
})();

/**
 * ONE string, BOTH author-facing channels — the `.describe()` metadata generated docs
 * publish, and the parse-time issue message an author who writes the wrong shape reads.
 * The house discipline of `./tombstone.zod.ts`: two channels that cannot drift apart
 * because there is only one string.
 *
 * The refusal it carries is objectui#7762's ruling. `ObjectGrid.tsx` reads
 * `schema.exportOptions?.formats` and nothing else, so a bare format array authored on
 * an `object-grid` node used to validate green through `BaseSchema`'s `.passthrough()`
 * and then lose SILENTLY to the `['csv', 'json']` default — no error, no warning, no
 * console line, with the export button still shown. Refusing it by name is that silent
 * no-op made loud; nothing that renders today stops rendering.
 */
const OBJECT_GRID_EXPORT_OPTIONS_GUIDANCE =
  'Export configuration for the grid toolbar menu — the OBJECT form only: ' +
  '`{ formats, maxRecords, includeHeaders, fileNamePrefix, streaming }`. A bare format ' +
  'array is the `list-view` spelling and is NOT read here: `object-grid` reads ' +
  '`exportOptions.formats`, so an array is silently dropped for the csv/json ' +
  'default. Write `{ "formats": ["csv", "xlsx"] }` instead.';

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
  // `exportOptions` — the spec's OBJECT arm, BY REFERENCE, with the bare array refused
  // by name (objectui#7762). ⛔ NOT `SpecListViewSchema.shape.exportOptions` itself:
  // that reference is the two-arm union whose first arm LIFTS a bare array to
  // `{ formats }`, so binding it would make this mirror ACCEPT AND LIFT — the opposite
  // of the named refusal ruled for this node. The strictness is the arm's own
  // (`catchall: never`, measured), so a sixth key keeps zod's own `unrecognized_keys`
  // message naming it, and a retired `'pdf'` keeps the spec's migration prescription:
  // only the `invalid_type` message is local, and only it names the object form.
  exportOptions: z
    .strictObject(SPEC_EXPORT_OPTIONS_OBJECT_SHAPE, {
      error: (issue) => (issue.code === 'invalid_type' ? OBJECT_GRID_EXPORT_OPTIONS_GUIDANCE : undefined),
    })
    .optional()
    .describe(OBJECT_GRID_EXPORT_OPTIONS_GUIDANCE),

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
  // The legacy caption/export-title fallback — `ObjectGrid.tsx` reads it at
  // exactly two sites, `viewLabel: schema.label || schema.title` and
  // `caption: schema.label || schema.title`, only when `label` is absent — and
  // the interface has declared it `@deprecated` all along. Mirrored under
  // objectui#6639's census-directed ruling (2026-08-29, declare branch:
  // authored `object-grid.title` nodes exist, so the key is declared rather
  // than the read retired). Typed `z.string()`, not `z.any()` — serializable
  // metadata, the #6424 family form: the gain is the typed refusal, since the
  // `.passthrough()` base was already admitting ANY `title` unexamined.
  title: z.string().optional().describe('DEPRECATED, write label instead: legacy caption/export-file-title fallback, read only when label is absent'),
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
  navigateOnSuccess: z.string().optional().describe('DEPRECATED, write submitBehavior instead: navigate here after success (relative path only; {id}/{recordId} interpolated and URL-escaped); precedes the toast'),
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
 *
 * Ten keys the `ObjectViewSchema` interface (`../objectql.ts`) declared and this
 * mirror never did — objectui#7279's `UnmirroredDeclared` reading — were closed
 * nine-for-ten by objectui#7779 under the maintainer's ruling B (2026-09-06:
 * liveness first, then mirror-or-retire per key). Every reading below was taken
 * on the `object-view` NODE renderer, `packages/plugin-view/src/ObjectView.tsx`
 * (registered by `plugin-view/src/index.tsx`), with `schema.objectName` /
 * `schema.layout` as the positive controls of the same `schema.KEY` query:
 *
 *   - `navigation`, `searchableFields`, `filterableFields` — the spec models
 *     all three on `ListViewSchema` (`@objectstack/spec/ui`), so they are the
 *     spec's own slots BY REFERENCE (`SpecListViewSchema.shape.*`), never a
 *     local restatement: the declaration already imports the spec's
 *     `NavigationConfig` for `ViewNavigationConfig`, and a literal restating it
 *     is the drift this repo keeps paying for (objectui#4588). The pin asserts
 *     identity against the spec schema, so a spec-side change moves them.
 *   - `allowCreateView`, `viewActions` — READ: the renderer forwards both
 *     verbatim into the `view-switcher` node it composes
 *     (`allowCreateView: schema.allowCreateView`, `viewActions: schema.viewActions`,
 *     then `ViewSwitcher.tsx` reads `schema.allowCreateView` / `schema.viewActions`),
 *     so they are that sibling mirror's slots by reference
 *     (`ViewSwitcherSchema.shape.*`, `./views.zod.ts`) — one shape, two nodes.
 *   - `defaultViewType` (READ: `schema.defaultViewType || 'grid'`),
 *     `defaultListView` (READ: `namedListViews?.[schema.defaultListView]`),
 *     `showViewSwitcher` (READ: `schema.showViewSwitcher === true`) — local
 *     literals matching the declaration. `defaultViewType` is the declaration's
 *     SEVEN-value union on purpose, not the spec's view-kind enum: `chart` and
 *     `tree` are host-composition-only on this node (objectui#5321) and the
 *     `NamedListView.type` twin spells the same seven.
 *   - `viewTabBar` — RETIRED (`retirementTombstone()` below; `?: never` on the
 *     TS face). ZERO reads of the key on the node: the tab-bar UX config
 *     (`ViewTabBarConfig`, still exported) is the `config` PROP of the
 *     `ViewTabBar` component, composed by the host (`@object-ui/app-shell`),
 *     and `plugin-view`'s own `ObjectView` never renders that bar (ADR-0053:
 *     the host owns the switcher). The 2026-07 audit
 *     (`docs/audits/2026-07-objectview-detailview-schema.md`) had already
 *     measured it dead since introduction.
 *   - `listViews` — STILL UNMIRRORED, on the ruling's own fallback clause and
 *     by measurement: the declaration's value is the local `NamedListView`,
 *     47 declared top-level members, of which the renderer reads six —
 *     `label`, `type`, `columns`, `filter`, `sort`, `options`. A seventh key,
 *     `data`, is read off a named view but is NOT declared on
 *     `NamedListView`: the renderer reaches it through an `as any` cast on the
 *     named-view config (`ObjectView.tsx`, `(currentNamedViewConfig as any)?.data`),
 *     so it is not one of the 47 and never was a member a mirror would carry.
 *     Meanwhile the spec slot (`ViewSchema.listViews`) is a record of the
 *     STRICT `ObjectListViewSchema`,
 *     which requires `columns` and refuses `options`, ObjectQL tuple filters and
 *     `default` — i.e. it refuses the named views this package's own README and
 *     `content/docs/api/schema-reference.md` teach. Neither value type can be
 *     mirrored without either losing documented behaviour (spec) or enforcing
 *     41 unread members (47 declared, minus the 6 that are both declared and
 *     read) into the contract (local), so the key stays in the
 *     parity ledger with that measurement until the maintainer decides its
 *     value type. ⛔ Not `z.any()`: that was ruled out by name.
 */
export const ObjectViewSchema = BaseSchema.extend({
  type: z.literal('object-view'),
  objectName: z.string().describe('ObjectQL object name'),
  title: z.string().optional().describe('View title'),
  description: z.string().optional().describe('View description'),
  layout: z.enum(['drawer', 'modal', 'page']).optional().describe('Layout mode'),
  defaultViewType: z.enum(['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'map']).optional().describe('Default list view type (grid unless a named view sets its own type)'),
  defaultListView: z.string().optional().describe('Key of the listViews entry shown first'),
  // Spec slot by reference (objectui#7779) — `NavigationConfigSchema.optional()`,
  // the same object `ListViewSchema` derives its `navigation` from.
  navigation: stripImportedDefaults(SpecListViewSchema).shape.navigation,
  table: z.lazy(() => ObjectGridSchema.omit({ type: true, objectName: true }).partial()).optional().describe('Table config'),
  form: z.lazy(() => ObjectFormSchema.omit({ type: true, objectName: true, mode: true }).partial()).optional().describe('Form config'),
  // Spec slots by reference (objectui#7779) — `array(string).optional()` on
  // both; the spec's own description marks `filterableFields` a legacy
  // shorthand for `userFilters.fields`.
  searchableFields: stripImportedDefaults(SpecListViewSchema).shape.searchableFields,
  filterableFields: stripImportedDefaults(SpecListViewSchema).shape.filterableFields,
  showSearch: z.boolean().optional().describe('Show search'),
  showFilters: z.boolean().optional().describe('Show filters'),
  showSort: z.boolean().optional().describe('Show sort controls'),
  showCreate: z.boolean().optional().describe('Show create button'),
  showRefresh: z.boolean().optional().describe('Show refresh button'),
  showViewSwitcher: z.boolean().optional().describe('Show the view-type switcher toggle (hidden unless true)'),
  operations: z.object({
    create: z.boolean().optional(),
    read: z.boolean().optional(),
    update: z.boolean().optional(),
    delete: z.boolean().optional(),
  }).optional().describe('Enabled operations'),
  viewTabBar: retirementTombstone(
    'RETIRED (objectui#7779) — `viewTabBar` was never read off the object-view node: the tab-bar UX config ' +
    '(`ViewTabBarConfig`) is the `config` PROP of the `ViewTabBar` component, composed by the host ' +
    '(`@object-ui/app-shell`), not authored metadata (ADR-0053: the host owns the switcher). Remove the key.',
  ),
  // Sibling slots by reference (objectui#7779): the renderer forwards both
  // verbatim into the `view-switcher` node it composes.
  allowCreateView: ViewSwitcherSchema.shape.allowCreateView,
  viewActions: ViewSwitcherSchema.shape.viewActions,
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
 *     deferred): `userFilters`, `sharing`, `aria`, `conditionalFormatting`
 *     (`exportOptions` left this list with objectui#6956 — it is the spec field by reference).
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
const KanbanConfig = stripImportedDefaults(SpecKanbanConfigSchema).partial().extend({
  /** @deprecated legacy alias for the spec's `groupByField` */
  groupField: z.string().optional().describe('Deprecated alias for groupByField'),
  /** @deprecated legacy alias for the spec's `columns` (fields shown on each card) */
  cardFields: z.array(z.string()).optional().describe('Deprecated alias for columns'),
}).passthrough();

const CalendarConfig = stripImportedDefaults(SpecCalendarConfigSchema).partial().extend({
  // objectui-only: the calendar renderer's initial view mode. No spec counterpart —
  // promote it rather than growing this extension. `'agenda'` was retired
  // (objectui#5784, following #5740): `CalendarView` renders no agenda view.
  defaultView: z.enum(['month', 'week', 'day']).optional().describe("Initial calendar view mode — 'month' | 'week' | 'day' ('agenda' was retired: objectui#5784)"),
}).passthrough();

const GalleryConfig = stripImportedDefaults(SpecGalleryConfigSchema).partial().extend({
  /** @deprecated legacy alias for the spec's `coverField` */
  imageField: z.string().optional().describe('Deprecated alias for coverField'),
}).passthrough();

const TimelineConfig = stripImportedDefaults(SpecTimelineConfigSchema).partial().extend({
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
export const UserActionsSchema = stripImportedDefaults(SpecUserActionsConfigSchema).extend({
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
  .extend(specFieldsExcept(stripImportedDefaults(SpecListViewSchema).shape, LIST_VIEW_LOCAL_OVERRIDES).shape)
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
    aria: stripImportedDefaults(SpecAriaPropsSchema).extend({
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
    // `exportOptions` — the spec's own field, BY REFERENCE (objectui#6956).
    //
    // `ListViewExportOptionsSchema` is internal to the spec bundle (not a public
    // export — measured by `__tests__/export-options-spec-parity.test.ts`), but
    // the enclosing `ListViewSchema.shape.exportOptions` IS a live export, and it
    // is the whole contract: a two-branch union of the bare format array (the
    // legacy spelling, lifted to `{ formats }` at parse) and the STRICT five-key
    // object (`formats` / `maxRecords` / `includeHeaders` / `fileNamePrefix` /
    // `streaming`), with `'pdf'` refused in both spellings under an
    // `os migrate meta --from 16` prescription (objectstack#8010).
    //
    // This member used to restate a pre-#8010 shape — `'pdf'` accepted in both
    // branches, no `streaming`, a non-strict object — so `ListViewInferred`
    // (`z.input` of this schema, and through it the `ListViewSchema` TYPE the
    // ListView renderer is written against) disagreed with its sibling
    // `ObjectGridSchema['exportOptions']`, and the renderer could only read
    // `streaming` through `as any`. Binding the spec field by reference makes
    // the two faces one contract again and keeps the description the spec
    // wrote. The bare array stays admissible on the INPUT type on purpose:
    // nothing on the render path parses, so a stored array reaches `ListView`
    // un-lifted and its `resolvedExportOptions` fold is load-bearing
    // (objectui#4535 item 4).
    exportOptions: stripImportedDefaults(SpecListViewSchema).shape.exportOptions,
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
 * objectui#6939 — the record-source refinement `ObjectMapSchema` and
 * `ObjectGanttSchema` below share.
 *
 * Both renderers resolve their records from ONE of three keys, in this order:
 * `data` (a spec `ViewData` config), `staticData` (inline rows, wrapped into a
 * `{ provider: 'value' }` config) or `objectName` (the bound object) —
 * `getDataConfig` in `plugin-map/src/ObjectMap.tsx` and
 * `plugin-gantt/src/ObjectGantt.tsx`, each `if (schema.data) … if
 * (schema.staticData) … if (schema.objectName) … return null`. Both mirrors
 * used to REQUIRE `objectName` alone, so a document authored on `staticData`
 * (6 of the 20 catalog entries objectui#6939 measured) drew correctly and was
 * refused by `safeValidateSchema` — `declared !== enforced`, with the corpus
 * on the right side. `objectName` is optional on both members now, and this
 * refinement carries the requirement the renderers actually have: with none of
 * the three present `getDataConfig` returns `null` and nothing is drawn.
 *
 * Presence is `!== undefined` — the ruling's wording ("at least one of `data`,
 * `staticData`, `objectName` is present"), NOT the renderers' truthiness: an
 * empty `objectName: ''` validated before this card and still does, so the
 * accept set only WIDENS. The one document shape refused here (none of the
 * three) was refused before too, when `objectName` was required. Maintainer
 * ruling recorded 2026-09-02 (director seat, summon #8, decision batch #8).
 *
 * The issue carries `params.code` so a consumer can key off the finding rather
 * than string-match the message — the shape `FormFieldSchema`'s refinement in
 * `form.zod.ts` uses; zod's own `code` is `custom` for every refinement. The
 * path is the ROOT (`[]`): no single key is at fault when all three are absent,
 * and blaming `objectName` would re-teach the requiredness this card removes.
 *
 * Deliberately a `function`, not an `export const`: the parity census in
 * `__tests__/zod-mirror-parity.test.ts` reads `^export const` out of this
 * directory and would demand a registered TS counterpart for it.
 */
const RECORD_SOURCE_KEYS = ['data', 'staticData', 'objectName'] as const;
function requireRecordSource(type: 'object-map' | 'object-gantt' | 'object-calendar') {
  return (
    schema: Partial<Record<(typeof RECORD_SOURCE_KEYS)[number], unknown>>,
    ctx: z.core.$RefinementCtx,
  ): void => {
    if (RECORD_SOURCE_KEYS.some((key) => schema[key] !== undefined)) return;
    ctx.addIssue({
      code: 'custom',
      path: [],
      params: { code: 'RECORD_SOURCE_REQUIRED' },
      message: `\`${type}\` has no record source: declare one of \`data\`, \`staticData\` or \`objectName\``,
    });
  };
}

/**
 * ObjectMap Schema
 *
 * Mirrors the `ObjectMapSchema` interface in `objectql.ts` key for key. Every
 * key has a read site in `plugin-map/src/ObjectMap.tsx`; the FLAT spelling of
 * the `map` block's keys is the ObjectView/ListView flatten product and stays
 * out of this declaration (maintainer ruling on objectui#5018, 2026-08-17) —
 * except `locationField` / `titleField`, which were published before the
 * ruling and stay for compatibility.
 *
 * `objectName` is OPTIONAL and the member ends in `requireRecordSource`
 * (objectui#6939): `getDataConfig` reads `data`, then `staticData`, then
 * `objectName`, so a map authored on inline rows never reads the object name —
 * three catalog entries drew correctly and were refused here. Requiredness
 * moved to the refinement above, which is where the renderer actually has it.
 */
export const ObjectMapSchema = BaseSchema.extend({
  type: z.literal('object-map'),
  objectName: z.string().optional().describe('ObjectQL object name — the THIRD record source getDataConfig resolves, after data and staticData; one of the three must be present (objectui#6939)'),
  data: ViewDataSchema.optional().describe('Data source configuration — read FIRST by getDataConfig'),
  staticData: z.array(z.any()).optional().describe('Inline records — read SECOND by getDataConfig, wrapped into a { provider: value } config'),
  filter: z.array(z.any()).optional().describe('Query filter, forwarded as $filter'),
  sort: z.union([z.string(), z.array(SortConfigSchema)]).optional().describe('Sort configuration, forwarded as $orderby'),
  map: ObjectMapConfigSchema.optional().describe('Map configuration (the author face)'),
  enableClustering: z.boolean().optional().describe('Group nearby markers into clusters'),
  navigation: stripImportedDefaults(SpecNavigationConfigSchema).optional().describe('Record navigation behaviour (drawer/dialog/page)'),
  locationField: z.string().optional().describe('Location field (internal flat form; prefer map.locationField)'),
  titleField: z.string().optional().describe('Title field (internal flat form; prefer map.titleField)'),
  mapStyle: z.string().optional().describe('MapLibre style URL/spec (overrides the public demo default)'),
}).superRefine(requireRecordSource('object-map'));

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
 * objectui's own `GanttConfig` extensions — everything `../objectql.ts` declares
 * on {@link GanttConfig} beyond the spec's `SpecGanttConfigSchema` (objectui#6051
 * lifted nine of them out of `plugin-gantt`'s package-private `GanttConfigEx`;
 * `timeSegments` was already there).
 *
 * Held as ONE field map rather than inlined, so the flattened top-level spelling
 * below is built from a single source — the same way the TS side derives its
 * flattened members from `GanttConfig`. It is also the shape the nested `gantt`
 * block is built from (objectui#6475): one line extending `SpecGanttConfigSchema`
 * with this map — so both authoring faces share one vocabulary and cannot fork
 * from each other.
 *
 * Not exported: the parity census in `__tests__/zod-mirror-parity.test.ts` reads
 * `^export const` out of this directory and would require a registered TS
 * counterpart for it. It has none of its own — it is a fragment of `GanttConfig`,
 * and `GanttConfig` is checked through the two faces that carry it.
 */
const GanttConfigExtensionFields = {
  borderColorField: z.string().optional().describe('Record field carrying a per-task alert stroke colour'),
  lockField: z.string().optional().describe('Record field marking a row view-only (truthy → locked)'),
  objectField: z.string().optional().describe("Record field carrying the row's own object API name"),
  summaryExtent: z.enum(['children', 'self']).optional().describe("How a summary bar's span is computed"),
  defaultCollapsedDepth: z.number().optional().describe('Auto-collapse tree nodes at/below this 0-indexed depth'),
  dependencyTypes: z.boolean().optional().describe('Whether the store persists dependency link TYPES (fs/ss/ff/sf)'),
  timeZone: z.string().optional().describe("Business time zone (IANA name) the chart's calendar renders in"),
  exportFileName: z.string().optional().describe('Base name for exported PNG/PDF files'),
  interactions: z
    .object({
      move: z.boolean().optional().describe('Bar / subtree dragging'),
      resize: z.boolean().optional().describe('Edge resize grips'),
      progress: z.boolean().optional().describe('The progress drag handle'),
      link: z.boolean().optional().describe('Dependency UI: drag-to-link dots and the create/delete menu'),
    })
    .optional()
    .describe('Per-interaction switches, each defaulting to true'),
  timeSegments: z
    .object({
      dayStart: z.string().optional().describe("Clock time the shift-day begins, 'HH:mm'"),
      bands: z
        .array(
          z.object({
            key: z.string().optional().describe('Stable band id'),
            label: z.string().describe('Display label'),
            start: z.string().describe("Band start, 'HH:mm'"),
            end: z.string().describe("Band end, 'HH:mm'"),
            color: z.string().optional().describe('Accent colour for the column tint'),
          })
        )
        .describe('Ordered bands covering the 24h shift-day'),
      showMidnight: z.boolean().optional().describe('Draw the dashed calendar-midnight cue'),
    })
    .optional()
    .describe('Shift segmentation for the day-mode timeline'),
};

/**
 * ObjectGantt Schema
 *
 * `objectName` is OPTIONAL and the member ends in `requireRecordSource`
 * (objectui#6939): `getDataConfig` (`plugin-gantt/src/ObjectGantt.tsx`) reads
 * `data`, then `staticData`, then `objectName`, so a gantt authored on inline
 * rows never reads the object name — three catalog entries drew correctly and
 * were refused here. `data` is declared for the first time in the same stroke:
 * it is the FIRST read of that resolver and was undeclared on both faces
 * (surviving on `BaseSchema`'s index signature), which would have left the
 * refinement naming a key this mirror had never heard of. It is spelled exactly
 * as `ObjectMapSchema.data` above, so the two members' record sources cannot
 * fork.
 */
export const ObjectGanttSchema = BaseSchema.extend({
  type: z.literal('object-gantt'),
  objectName: z.string().optional().describe('ObjectQL object name — the THIRD record source getDataConfig resolves, after data and staticData; one of the three must be present (objectui#6939)'),
  data: ViewDataSchema.optional().describe('Data source configuration — read FIRST by getDataConfig; undeclared on either face until objectui#6939'),
  startDateField: z.string().optional().describe('Start date field'),
  endDateField: z.string().optional().describe('End date field'),
  titleField: z.string().optional().describe('Title field'),
  // The legacy singular alias. Kept accepted — `getGanttConfig`'s flat branch
  // reads `dependenciesField || dependencyField` — but no longer declared as an
  // equal of the canonical key: same treatment `KanbanConfig` above gives
  // `groupField`/`cardFields`, so this adopts the ruled idiom rather than a
  // second spelling of "deprecated". The canonical `dependenciesField` is
  // declared below, BY REFERENCE to the spec (objectui#6470).
  /** @deprecated legacy alias for the spec's `dependenciesField` */
  dependencyField: z.string().optional().describe('Deprecated alias for dependenciesField'),
  progressField: z.string().optional().describe('Progress field'),
  // DERIVED from the spec's `GanttConfigSchema.shape.viewMode` (an optional
  // enum, deliberately WITHOUT a default) so the member list cannot drift
  // (objectui#5074). Absence semantics are load-bearing: an omitted `viewMode`
  // lets a persisted layout seed the timeline granularity before the
  // renderer's 'day' fallback — do NOT add `.default('day')` here.
  viewMode: stripImportedDefaults(SpecGanttConfigSchema).shape.viewMode.describe(
    'Initial timeline granularity, honoured by both renderer branches; when omitted, a persisted layout may seed it'
  ),
  // objectui#5903 — ten keys `ObjectGantt` reads and this mirror did not
  // declare. They were reachable only through `(schema as any).K`, so nothing
  // connected the read to a declaration. Mirrored here at the SAME requiredness
  // as `../objectql.ts` (all optional) so the zod-mirror-parity ratchet stays at
  // zero drift for this pair. `label` is NOT among them: `BaseSchema` already
  // declares it, so that read only needed its cast dropped.
  //
  // What declaring buys under `.passthrough()`: an undeclared key is still waved
  // through (objectui#5155's structural ceiling), but a DECLARED key is now
  // type-validated — `readOnly: 'yes'` is refused where it used to parse green.
  skipWeekends: z.boolean().optional().describe('Skip weekends in duration / auto-schedule math (working calendar)'),
  holidays: z.array(z.string()).optional().describe("Non-working dates for the working calendar, ISO 'yyyy-mm-dd' (UTC)"),
  persistLayout: z.boolean().optional().describe('Opt OUT of layout persistence — only an explicit false disables it'),
  viewName: z.string().optional().describe("Layout-persistence scope; storage key is `objectName:viewName` (default 'default')"),
  navigation: stripImportedDefaults(SpecNavigationConfigSchema).optional().describe('Record navigation behaviour on task click (drawer/dialog/page)'),
  markers: z
    .array(
      z.object({
        date: z.string().describe('Marker position, ISO date or datetime string'),
        label: z.string().optional().describe('Text drawn against the line'),
        color: z.string().optional().describe('Line colour — any CSS colour'),
      })
    )
    .optional()
    .describe('Extra vertical reference lines drawn like the Today marker'),
  criticalPath: z.boolean().optional().describe('Seed the critical-path highlight ON (toolbar toggle stays available)'),
  showBaselines: z.boolean().optional().describe('Render planned-vs-actual baseline bars — defaults ON, only an explicit false disables'),
  readOnly: z.boolean().optional().describe('Disable every write path and lock the record drawer'),
  mobileReadOnly: z.boolean().optional().describe('Auto read-only on narrow viewports — defaults ON, only an explicit false disables'),
  // objectui#6051 — the FLATTENED `GanttConfig` face. `getGanttConfig` builds its
  // config from these top-level keys when the node carries no `gantt` block and
  // `startDateField` / `endDateField` are both present — the block OUTRANKS this
  // face (objectui#6469); nothing declared them, on either side,
  // because `BaseSchema`'s index signature admits them untyped. Mirrored at the
  // SAME requiredness as `../objectql.ts` (all optional) so the zod-mirror-parity
  // ratchet stays at zero drift for this pair.
  //
  // The spec-modelled members are taken from `SpecGanttConfigSchema.shape` by
  // reference, exactly as `viewMode` above is, so the vocabulary cannot fork.
  colorField: stripImportedDefaults(SpecGanttConfigSchema).shape.colorField,
  dependenciesField: stripImportedDefaults(SpecGanttConfigSchema).shape.dependenciesField,
  parentField: stripImportedDefaults(SpecGanttConfigSchema).shape.parentField,
  typeField: stripImportedDefaults(SpecGanttConfigSchema).shape.typeField,
  tooltipFields: stripImportedDefaults(SpecGanttConfigSchema).shape.tooltipFields,
  baselineStartField: stripImportedDefaults(SpecGanttConfigSchema).shape.baselineStartField,
  baselineEndField: stripImportedDefaults(SpecGanttConfigSchema).shape.baselineEndField,
  groupByField: stripImportedDefaults(SpecGanttConfigSchema).shape.groupByField,
  resourceView: stripImportedDefaults(SpecGanttConfigSchema).shape.resourceView,
  assigneeField: stripImportedDefaults(SpecGanttConfigSchema).shape.assigneeField,
  effortField: stripImportedDefaults(SpecGanttConfigSchema).shape.effortField,
  capacity: stripImportedDefaults(SpecGanttConfigSchema).shape.capacity,
  quickFilters: stripImportedDefaults(SpecGanttConfigSchema).shape.quickFilters,
  autoZoomToFilter: stripImportedDefaults(SpecGanttConfigSchema).shape.autoZoomToFilter,
  // …and objectui's own ten, from the one field map above.
  ...GanttConfigExtensionFields,
  // `gantt` — the BLOCK face `getGanttConfig`'s FIRST branch reads and prefers
  // (objectui#6469 ruled block-over-flat) — objectui#6475. Built from the same
  // field map as the flat face above, `SpecGanttConfigSchema` extended with
  // `GanttConfigExtensionFields`, so the two authoring faces cannot fork.
  //
  // This is the one entry among the 28 that NARROWS rather than merely names: a
  // `gantt` block previously rode through `.passthrough()` entirely unvalidated;
  // now it is PARSED against the spec's `GanttConfigSchema`, which REQUIRES
  // `startDateField`/`endDateField`/`titleField`. This mirror reaches the CLI's
  // `validate`/`check` through `AnyComponentSchema` → `safeValidateSchema`, so a
  // block missing the trio moves from "accepted, then warned about at runtime"
  // to "refused at authoring time" — a `declared = enforced` restoration, not
  // new requiredness: the renderer already fed the block to
  // `GanttConfigSchema.safeParse` and logged `[ObjectGantt] Invalid gantt
  // configuration` on failure. Maintainer ruling, objectui#6475 (2026-08-27),
  // Option A: enforce as-is, no warning window (excluded by the startup-stage
  // no-gradualism rule, objectstack#12668 — no named external-user evidence).
  gantt: stripImportedDefaults(SpecGanttConfigSchema).extend(GanttConfigExtensionFields).optional().describe(
    'Nested gantt config block — the authoring face, and the winner over the flattened top-level keys whenever present'
  ),
  // The query/data keys the fetch path reads. They were declared on
  // `ObjectGridSchema` — what `ObjectGanttProps.schema` used to be typed as before
  // objectui#5903 retyped it to `ObjectGanttSchema` — so they need declaring here.
  staticData: z.array(z.any()).optional().describe('Inline records, wrapped into a { provider: value } data config — read SECOND by getDataConfig'),
  filter: z.array(z.any()).optional().describe('Query filter, forwarded verbatim as $filter'),
  sort: z.union([z.string(), z.array(SortConfigSchema)]).optional().describe('Sort configuration, forwarded as $orderby'),
}).superRefine(requireRecordSource('object-gantt'));

/**
 * ObjectCalendar Schema
 *
 * `objectName` is OPTIONAL and the member ends in `requireRecordSource`
 * (objectui#7313, the objectui#6939 shape): the renderer resolves its records
 * through the shared ladder (`resolveRecordSourceConfig` in
 * `@object-ui/core`, `plugin-calendar/src/ObjectCalendar.tsx`) — `data`, then
 * `staticData`, then `objectName` — so a calendar authored on inline rows never
 * reads the object name, and the two static-data examples the plugin page
 * documents drew correctly and were refused here. `data` and `staticData` are
 * declared for the first time in the same stroke: they are the FIRST and SECOND
 * reads of that resolver and were undeclared on both faces (surviving on
 * `BaseSchema`'s index signature and on `.passthrough()`), which would have
 * left the refinement naming keys this mirror had never heard of. Both are
 * spelled exactly as `ObjectGanttSchema` above spells them, so the members'
 * record sources cannot fork.
 */
export const ObjectCalendarSchema = BaseSchema.extend({
  type: z.literal('object-calendar'),
  objectName: z.string().optional().describe('ObjectQL object name — the THIRD record source getDataConfig resolves, after data and staticData; one of the three must be present (objectui#7313)'),
  data: ViewDataSchema.optional().describe('Data source configuration — read FIRST by getDataConfig; undeclared on either face until objectui#7313'),
  staticData: z.array(z.any()).optional().describe('Inline records, wrapped into a { provider: value } data config — read SECOND by getDataConfig'),
  startDateField: z.string().optional().describe('Start date field'),
  endDateField: z.string().optional().describe('End date field'),
  titleField: z.string().optional().describe('Title field'),
  defaultView: z.enum(['month', 'week', 'day']).optional().describe("Default view — 'month' | 'week' | 'day', the renderer's rendered set ('agenda' was retired: objectui#5784)"),
}).superRefine(requireRecordSource('object-calendar'));

/**
 * ObjectKanban Schema
 */
// Since #1584, kanban card styling runs on the shared CEL evaluator, so a
// kanban rule accepts BOTH the native `{ field, operator, value }` shape and the
// spec `{ condition, style }` shape (a CEL predicate + style map) — matching
// list/grid `conditionalFormatting`. The type/schema now match the runtime.
//
// Exported since objectui#7664 so `complex.zod.ts`'s `KanbanSchema` (the
// `'kanban'` arm) mirrors `conditionalFormatting` with the SAME rule union as
// this `'object-kanban'` arm — one declaration of the rule, two arms. It is a
// union of two rule dialects with no `.shape` of its own, so the parity census
// EXCLUDES it rather than pairing it; its TS twin is the type union
// `KanbanConditionalFormattingRule` (`../objectql.ts`).
export const KanbanConditionalFormattingRuleSchema = z.union([
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

/**
 * The `object-kanban` board has a record source — at least one of `bind`,
 * `data`, `objectName` is present (objectui#7780).
 *
 * ⚠️ NOT `requireRecordSource` above, and deliberately not built on it. That
 * one serves the `object-map` / `object-gantt` / `object-calendar` ladder,
 * whose rungs are `data` (a `ViewData` PROVIDER BLOCK) → `staticData` →
 * `objectName`, resolved by the shared `resolveRecordSourceConfig` in
 * `@object-ui/core`. This board walks a DIFFERENT ladder in
 * `plugin-kanban/src/ObjectKanban.tsx`: the pre-fetched `data` PROP →
 * `useDataScope(schema.bind)` → the inline ROW ARRAY on `schema.data` → a
 * fetch keyed by `schema.objectName`
 * (`rawData = external || boundData || schema.data || fetchedData`, the fetch
 * gated on `schema.objectName && !boundData && !schema.data`). It has NO
 * `staticData` rung and it HAS a `bind` rung, so the two key sets are neither
 * equal nor nested and one predicate cannot serve both. objectui#7651 (ruled
 * B, closed `not_planned`) refuses giving this board the shared ladder; this
 * refinement describes the ladder that is already there rather than adding
 * one.
 *
 * The pre-fetched `data` PROP is NOT a key here: it is a React prop
 * (`ObjectKanbanComponentProps.data`, passed by a parent such as `ListView`),
 * not something an author writes on the node, so it can neither be declared
 * nor required.
 *
 * `bind` and `data` are `BaseSchema` members on BOTH faces — declared once, on
 * the base, as optional members (`base.zod.ts` here, `../base.ts` there) and
 * INHERITED by this member rather than restated on it. So this refinement names
 * no key its own mirror has never heard of, the property objectui#7313 had to
 * buy by declaring `data` / `staticData` first, and it names no key this
 * member re-declares — `base-bind-declared.test.ts` (objectui#6357) keeps the
 * `bind` declaration single, and the identity assertion in
 * `__tests__/object-kanban-record-source-7780.test.ts` keeps both inherited.
 *
 * Presence is `!== undefined`, matching the sibling predicate's wording rather
 * than the renderer's truthiness: `objectName: ''` validated before this card
 * and still does, so the accept set only WIDENS. The one shape refused here
 * (none of the three present) was refused before too, when `objectName` was
 * required — see the before/after table in
 * `__tests__/object-kanban-record-source-7780.test.ts`.
 *
 * ⛔ `groupBy` is NOT a rung and is untouched: it stays REQUIRED (objectui#7322,
 * PR #7774). A record source and a lane key are different questions, and the
 * two readings PR #7774 excluded from counting as a lane-less mode — the
 * `dataSource` json fragment in `content/docs/utilities/data-objectstack.mdx`
 * and `ListView.tsx`'s runtime-generated node — are still refused here, on
 * `groupBy`, exactly as they were.
 *
 * Carries `params.code` so a consumer keys off the finding rather than
 * string-matching the message, and reports at the ROOT path (`[]`): no single
 * key is at fault when all three are absent, and blaming `objectName` would
 * re-teach the requiredness this card removes.
 *
 * Deliberately a `function`, not an `export const`, for the same reason
 * `requireRecordSource` is: the parity census in
 * `__tests__/zod-mirror-parity.test.ts` reads `^export const` out of this
 * directory and would demand a registered TS counterpart for it.
 */
const KANBAN_RECORD_SOURCE_KEYS = ['bind', 'data', 'objectName'] as const;
function requireKanbanRecordSource(
  schema: Partial<Record<(typeof KANBAN_RECORD_SOURCE_KEYS)[number], unknown>>,
  ctx: z.core.$RefinementCtx,
): void {
  if (KANBAN_RECORD_SOURCE_KEYS.some((key) => schema[key] !== undefined)) return;
  ctx.addIssue({
    code: 'custom',
    path: [],
    params: { code: 'RECORD_SOURCE_REQUIRED' },
    message: '`object-kanban` has no record source: declare one of `bind`, `data` or `objectName`',
  });
}

// objectui#7322 — `groupBy` and `limit` are the keys `ObjectKanban.tsx` reads
// (thirteen `schema.groupBy` sites; `$top: schema.limit ?? DEFAULT_KANBAN_LIMIT`
// at `:264`); until this card neither was declared and both rode `BaseSchema`'s
// `.passthrough()` unexamined, while the REQUIRED `groupField` had zero read
// sites. `groupField` is now a `retirementTombstone()` — still a member, so
// the parity ratchet's key sets stay equal and an authored value is refused
// BY NAME rather than stripped — and it is node-local: the VIEW-LEVEL alias
// `KanbanConfig.groupField` above is live and untouched.
export const ObjectKanbanSchema = BaseSchema.extend({
  type: z.literal('object-kanban'),
  objectName: z.string().optional().describe('ObjectQL object name — the LAST rung of the board ladder, after the pre-fetched data prop, bind and the inline row array on data; one of bind, data, objectName must be present (objectui#7780)'),
  groupBy: z.string().describe('Field whose value places a record in a lane — the lane key the object-kanban renderer reads (ObjectKanban.tsx, thirteen sites); required, as the retired groupField was'),
  groupField: retirementTombstone('RETIRED (objectui#7322) — `groupField` is not read by the object-kanban renderer; author `groupBy`. (The view-level `kanban.groupField` alias is unaffected.)'),
  limit: z.number().int().positive().optional().describe('Row cap — the most records the board fetches, sent as a real $top on the query (ObjectKanban.tsx:264); default 100 (DEFAULT_KANBAN_LIMIT)'),
  titleField: z.string().optional().describe('Title field'),
  cardFields: z.array(z.string()).optional().describe('Card fields'),
  quickAdd: z.boolean().optional().describe('Enable Quick Add button at column bottom'),
  coverImageField: z.string().optional().describe('Field name for cover image on cards'),
  allowCollapse: z.boolean().optional().describe('Allow columns to collapse/expand'),
  conditionalFormatting: z.array(KanbanConditionalFormattingRuleSchema).optional().describe('Card conditional formatting rules'),
}).superRefine(requireKanbanRecordSource);

/**
 * ObjectChart Schema
 */
export const ObjectChartSchema = BaseSchema.extend({
  type: z.literal('object-chart'),
  // Legacy inline path (objectName + aggregate). Optional now that a chart may
  // instead bind to a semantic-layer dataset (ADR-0021, #1890).
  objectName: z.string().optional().describe('ObjectQL object name (legacy inline path)'),
  chartType: z.enum(['bar', 'column', 'horizontal-bar', 'line', 'area', 'pie', 'donut', 'scatter']).describe('Chart type'),
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
 * ObjectGallery Schema (objectui#6576)
 *
 * Mirrors the `ObjectGallerySchema` interface in `objectql.ts` key for key;
 * every key has a read site in `plugin-list/src/ObjectGallery.tsx`. `gallery`,
 * `navigation` and `grouping` are the spec's own schemas by reference, which is
 * how the TS declaration types them.
 */
export const ObjectGallerySchema = BaseSchema.extend({
  type: z.literal('object-gallery'),
  objectName: z.string().optional().describe('ObjectQL object name'),
  filter: z.unknown().optional().describe('Query filter, forwarded verbatim as $filter'),
  data: z.array(z.record(z.string(), z.unknown())).optional().describe('Inline records'),
  gallery: stripImportedDefaults(SpecGalleryConfigSchema).optional().describe('Gallery configuration (@objectstack/spec GalleryConfig)'),
  navigation: stripImportedDefaults(SpecNavigationConfigSchema).optional().describe('Record navigation behaviour (drawer/dialog/page)'),
  grouping: stripImportedDefaults(SpecGroupingConfigSchema).optional().describe('Grouping configuration for sectioned display'),
  imageField: z.string().optional().describe('DEPRECATED — use gallery.coverField'),
  titleField: z.string().optional().describe('DEPRECATED — use gallery.titleField'),
});

/**
 * ObjectDataTable Schema (objectui#6576 / objectui#6914)
 *
 * Mirrors the `ObjectDataTableSchema` interface in `objectql.ts`. One key
 * follows the parity ledger's discipline rather than the literal shape, and
 * one used to:
 *
 *   - `onRowClick` is a RUNTIME SLOT — a host-supplied function the widget
 *     forwards into `data-table` — so the mirror refuses it BY NAME
 *     (`handlerKeyRefusal`, the objectui#6124 shape) while the TS twin stays
 *     callable; `KnownDrift` in `zod-mirror-parity.test.ts` records the
 *     divergence.
 *   - `drillDown` is mirrored through `DrillDownConfigSchema`
 *     (`data-display.zod.ts`, objectui#7352). objectui#6576 declared the key
 *     and left it unmirrored — minting the mirror was a new export outside
 *     that ruling — so `UnmirroredDeclared` carried it, as it had carried
 *     `ChartSchema.drillDown` since objectui#6058; both entries left the
 *     ledger with that mirror.
 */
export const ObjectDataTableSchema = BaseSchema.extend({
  type: z.literal('object-data-table'),
  objectName: z.string().optional().describe('ObjectQL object name'),
  dataProvider: z.object({ provider: z.string(), object: z.string().optional() }).optional()
    .describe('Data-provider binding carried from the dashboard widget definition'),
  filter: z.any().optional().describe('Query filter, resolved through the filter scope and forwarded as $filter'),
  data: z.array(z.any()).optional().describe('Inline rows'),
  columns: z.array(z.any()).optional().describe('Column definitions (names or column objects)'),
  searchable: z.boolean().optional().describe('Forwarded to the rendered data-table'),
  pagination: z.boolean().optional().describe('Forwarded to the rendered data-table'),
  drillDown: DrillDownConfigSchema.optional().describe(
    'Drill-to-record: clicking a row opens that record in a detail drawer (DashboardRenderer defaults object-backed table widgets to { enabled: true, mode: record })',
  ),
  onRowClick: handlerKeyRefusal('onRowClick', 'runtime-slot', 'Row click handler (overrides drill-to-record)'),
});

/**
 * ObjectQL Component Schema Union
 *
 * Same twelve members as the TS union in `../objectql.ts`, in the same order.
 * `ObjectGallerySchema` and `ObjectDataTableSchema` joined in objectui#7363:
 * PR #7355 (objectui#6576) minted both mirrors and deliberately did not extend
 * this union, so `AnyComponentSchema` — and `validateSchema` /
 * `safeValidateSchema` / `objectui validate` with it — had NO arm for an
 * `object-gallery` or `object-data-table` node. Such a document was refused as
 * matching no arm, exactly as before the mirrors existed, and a wrong-typed
 * declared key on it (`searchable: 'yes'`) could never be diagnosed by name.
 * Both nodes render (`plugin-list` registers `object-gallery`, `plugin-dashboard`
 * registers `object-data-table`); this is the validating face catching up with
 * the rendering one. The behaviour pin is `__tests__/objectql-union-arms-7363.test.ts`.
 *
 * `z.discriminatedUnion`, not `z.union` (objectui#8498) — see the same note on
 * `crud.zod.ts#CRUDComponentSchema` for both reasons. All twelve arms already
 * declared a distinct `type` literal, so ⛔ no document changes verdict; what
 * changes is that a refusal now carries ONE arm's diagnosis instead of twelve.
 */
export const ObjectQLComponentSchema = z.discriminatedUnion('type', [
  ObjectGridSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ObjectMapSchema,
  ObjectTreeSchema,
  ObjectGanttSchema,
  ObjectCalendarSchema,
  ObjectKanbanSchema,
  ObjectChartSchema,
  ObjectGallerySchema,
  ObjectDataTableSchema,
  ListViewSchema,
]);
