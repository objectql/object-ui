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
import { ListViewSchema as SpecListViewSchema } from '@objectstack/spec/ui';
import { BaseSchema } from './base.zod.js';

/**
 * HTTP Method Schema
 * Mirrors @objectstack/spec/ui HttpMethodSchema.
 */
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * HTTP Request Schema
 * Mirrors @objectstack/spec/ui HttpRequestSchema.
 */
export const HttpRequestSchema = z.object({
  url: z.string().describe('API endpoint URL'),
  method: HttpMethodSchema.optional().describe('HTTP method'),
  headers: z.record(z.string(), z.string()).optional().describe('Custom HTTP headers'),
  params: z.record(z.string(), z.unknown()).optional().describe('Query parameters'),
  body: z.union([z.record(z.string(), z.unknown()), z.string(), z.instanceof(FormData), z.instanceof(Blob)]).optional().describe('Request body'),
});

/**
 * View Data Source Schema
 * Mirrors @objectstack/spec/ui ViewDataSchema.
 */
export const ViewDataSchema = z.union([
  z.object({
    provider: z.literal('object'),
    object: z.string().describe('Target object name'),
  }),
  z.object({
    provider: z.literal('api'),
    read: HttpRequestSchema.optional().describe('Read configuration'),
    write: HttpRequestSchema.optional().describe('Write configuration'),
  }),
  z.object({
    provider: z.literal('value'),
    items: z.array(z.unknown()).describe('Static data array'),
  }),
]);

/**
 * List Column Schema
 * Mirrors @objectstack/spec/ui ListColumnSchema.
 */
export const ListColumnSchema = z.object({
  field: z.string().describe('Field name'),
  label: z.string().optional().describe('Display label'),
  width: z.number().optional().describe('Column width'),
  align: z.enum(['left', 'center', 'right']).optional().describe('Text alignment'),
  hidden: z.boolean().optional().describe('Hide column by default'),
  sortable: z.boolean().optional().describe('Allow sorting'),
  resizable: z.boolean().optional().describe('Allow resizing'),
  wrap: z.boolean().optional().describe('Allow text wrapping'),
  type: z.string().optional().describe('Renderer type override'),
  link: z.boolean().optional().describe('Functions as the primary navigation link (triggers View navigation)'),
  action: z.string().optional().describe('Registered Action ID to execute when clicked'),
  pinned: z.enum(['left', 'right']).optional().describe('Pin column to left or right edge'),
  summary: z.union([
    z.string(),
    z.object({
      type: z.enum(['count', 'sum', 'avg', 'min', 'max']).describe('Aggregation type'),
      field: z.string().optional().describe('Field to aggregate (defaults to column field)'),
    }),
  ]).optional().describe('Column footer summary/aggregation'),
  prefix: z.object({
    field: z.string().describe('Field name to render as prefix'),
    type: z.enum(['badge', 'text']).optional().describe('Renderer type for the prefix'),
  }).optional().describe('Prefix configuration for compound cell rendering (Airtable-style)'),
});

/**
 * Selection Config Schema
 * Mirrors @objectstack/spec/ui SelectionConfigSchema.
 */
export const SelectionConfigSchema = z.object({
  type: z.enum(['none', 'single', 'multiple']).optional().describe('Selection mode'),
});

/**
 * Pagination Config Schema
 * Mirrors @objectstack/spec/ui PaginationConfigSchema.
 */
export const PaginationConfigSchema = z.object({
  pageSize: z.number().optional().describe('Page size'),
  pageSizeOptions: z.array(z.number()).optional().describe('Page size options'),
});

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
  striped: z.boolean().optional().describe('Striped rows'),
  bordered: z.boolean().optional().describe('Show borders'),
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
  element: z.enum(['dropdown', 'tabs']).describe('UI element type'),
  fields: z.array(UserFilterFieldSchema).optional().describe('Field-level filters'),
  tabs: z.array(UserFilterTabSchema).optional().describe('Named filter presets'),
  allowAddTab: z.boolean().optional().describe('Allow adding new tabs'),
  showAllRecords: z.boolean().optional().describe('Show All records tab'),
});

/**
 * ListView Schema — derived from `@objectstack/spec/ui` `ListViewSchema` (issue #2231).
 *
 * Spec-owned fields flow in **by reference** (see `SpecListViewFields`) so they auto-track
 * the protocol instead of being re-typed here; the drift-guard test
 * (`__tests__/list-view-spec-parity.test.ts`) fails if the spec grows a field objectui
 * has not triaged. objectui-only / legacy fields are declared locally on top via
 * `.extend()` (the final extend wins, so these override anything imported):
 *   - component envelope: `type: 'list-view'` discriminator + `objectName` binding;
 *   - legacy vocabulary kept for back-compat: `viewType` (renamed spec `type`),
 *     `fields`/`columns`, `filters`, the `show*` toolbar flags, `densityMode`, `color`, …;
 *   - configs whose objectui shape is intentionally broader than spec's (migration
 *     deferred): `userFilters`, `sharing`, `aria`, `conditionalFormatting`,
 *     `exportOptions`, and the per-view-type `kanban`/`calendar`/`gantt`/`gallery`/`timeline`.
 *
 * Migrating the legacy vocabulary to the spec-canonical keys (`type`/`columns`/`filter`/
 * `userActions`) and adopting spec's narrower sub-shapes is deferred — see #2231.
 */
// Spec view-config fields, minus: the component envelope (name/label/description →
// BaseSchema), the discriminator/renamed/relaxed keys (type/columns), and the configs
// kept as local overrides below. `.partial()` guarantees no *future* spec field can
// become required and silently invalidate existing objectui payloads.
const SpecListViewFields = SpecListViewSchema
  .omit({
    type: true,
    columns: true,
    name: true,
    label: true,
    description: true,
    userFilters: true,
    sharing: true,
    aria: true,
    conditionalFormatting: true,
    exportOptions: true,
    kanban: true,
    calendar: true,
    gantt: true,
    gallery: true,
    timeline: true,
  })
  .partial();

// View-kind enum reused from spec (unwrap its `.default('grid')`) so it cannot drift.
const ViewKindEnum = SpecListViewSchema.shape.type.removeDefault();

export const ListViewSchema = BaseSchema
  // Import spec-owned fields by reference: data, filter, sort, searchableFields,
  // filterableFields, resizable, striped, bordered, compactToolbar, selection, navigation,
  // pagination, chart, tree, rowHeight, grouping, rowColor, hiddenFields, fieldOrder,
  // rowActions, bulkActions, bulkActionDefs, virtualScroll, inlineEdit, userActions,
  // appearance, tabs, addRecord, showRecordCount, allowPrinting, emptyState, responsive,
  // performance.
  .extend(SpecListViewFields.shape)
  .extend({
    // Component discriminator — load-bearing for the ObjectQLComponentSchema union.
    type: z.literal('list-view'),
    // objectui-only object binding (spec binds via data.provider:'object'; migration deferred).
    objectName: z.string().describe('Object Name'),
    // Renamed spec `type` (view-kind); enum imported from spec so it can't drift.
    viewType: ViewKindEnum.optional().describe('View Type'),
    // Relaxed spec `columns` (spec requires it) + legacy `fields` alias for string[] columns.
    columns: z.union([z.array(z.string()), z.array(ListColumnSchema)]).optional().describe('Columns definition'),
    fields: z.array(z.string()).optional().describe('Legacy alias for string[] columns'),
    // Legacy tuple/CEL filter format (spec-canonical `filter` is imported above).
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
    sharing: z.object({
      visibility: z.enum(['private', 'team', 'organization', 'public']).optional(),
      enabled: z.boolean().optional(),
      type: z.enum(['personal', 'collaborative']).optional(),
      lockedBy: z.string().optional(),
    }).optional().describe('Sharing configuration'),
    aria: z.object({
      label: z.string().optional(),
      describedBy: z.string().optional(),
      live: z.enum(['polite', 'assertive', 'off']).optional(),
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
    kanban: z.object({
      groupField: z.string(),
      titleField: z.string().optional(),
      cardFields: z.array(z.string()).optional(),
    }).passthrough().optional().describe('Kanban-specific configuration'),
    calendar: z.object({
      startDateField: z.string(),
      endDateField: z.string().optional(),
      titleField: z.string().optional(),
      defaultView: z.enum(['month', 'week', 'day', 'agenda']).optional(),
    }).passthrough().optional().describe('Calendar-specific configuration'),
    gantt: z.object({
      startDateField: z.string(),
      endDateField: z.string(),
      titleField: z.string().optional(),
      progressField: z.string().optional(),
      dependenciesField: z.string().optional(),
    }).passthrough().optional().describe('Gantt-specific configuration'),
    gallery: z.object({
      coverField: z.string().optional(),
      titleField: z.string().optional(),
      imageField: z.string().optional(),
      subtitleField: z.string().optional(),
    }).passthrough().optional().describe('Gallery-specific configuration'),
    timeline: z.object({
      startDateField: z.string().optional(),
      endDateField: z.string().optional(),
      titleField: z.string().optional(),
      dateField: z.string().optional(),
    }).passthrough().optional().describe('Timeline-specific configuration'),
  });

/**
 * Inferred TS type for the ListView component node (spec-derived; issue #2231).
 * The hand-written `interface ListViewSchema` in `../objectql.ts` is now an alias of
 * this inferred type intersected with the non-serializable runtime-only props.
 */
export type ListViewInferred = z.infer<typeof ListViewSchema>;

/**
 * ObjectMap Schema
 */
export const ObjectMapSchema = BaseSchema.extend({
  type: z.literal('object-map'),
  objectName: z.string().describe('ObjectQL object name'),
  locationField: z.string().optional().describe('Location field'),
  titleField: z.string().optional().describe('Title field'),
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
