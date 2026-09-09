/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - View Component Zod Validators
 * 
 * Zod validation schemas for view components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/views
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';
import { handlerKeyRefusal } from './tombstone.zod.js';
import { ListViewSchema as ImportedSpecListViewSchema } from '@objectstack/spec/ui';
import { stripImportedDefaults } from './imported-defaults.js';

/**
 * ⭐ THE IMPORT BOUNDARY (objectui#8317, decision batch #90, 2026-09-08).
 *
 * **This mirror authors no default, imported subschemas included.** Batch #69
 * ruled that a validator validates and does not write values into an author's
 * document; batch #90 ruled that this holds for EVERY key `safeValidateSchema`
 * answers, not only the sites this repository wrote. So every schema arriving
 * here from `@objectstack/spec` is re-bound through `stripImportedDefaults`,
 * which removes each reachable `ZodDefault` with `.removeDefault()` and keeps
 * the key omissible. Keys, types, checks and the accept set are untouched, and
 * a subtree carrying no default comes back reference-equal — so this is a no-op
 * the day the spec adopts the same principle. ⛔ Never put an `Imported…`
 * binding into a mirror's shape or on any parse path; that alias exists so the
 * boundary cannot be bypassed by accident, and the ONE legitimate read of one
 * is a value VOCABULARY (`SpecListViewTypeEnum` / `ViewKindEnum`, which unwrap
 * the spec's own `.default()` to reach its enum and parse nothing). Rationale
 * and pins: `./imported-defaults.ts`,
 * `../__tests__/imported-defaults-8317.test.ts`.
 */
const SpecListViewSchema = stripImportedDefaults(ImportedSpecListViewSchema);


/**
 * The spec's own list-view type vocabulary, unwrapped from its `.default('grid')`.
 *
 * Deliberately NOT exported: `__tests__/zod-mirror-parity.test.ts` runs a
 * population census over every `export const` in this directory, and this is a
 * derivation helper rather than a mirror anyone should reach for. The same
 * unwrap is spelled once more, privately, in `./objectql.zod.ts` (`ViewKindEnum`,
 * which types the renamed `viewType` key) — two derivations of one spec object
 * cannot drift from each other, whereas two copies of its member list can, and
 * did.
 */
// ⛔ The one legitimate read of an `Imported…` binding (objectui#8317): a VALUE
// VOCABULARY, not a parse path. `.removeDefault()` unwraps the spec's own
// `.default('grid')` to reach its enum, and no document is parsed through this
// binding, so the import boundary above is not bypassed. Reading it off the
// boundary-bound `SpecListViewSchema` instead would not work: the strip changes
// that member's RUNTIME wrapper (`ZodDefault` → `ZodOptional`) while its STATIC
// type is unchanged by design, so `.removeDefault()` would typecheck and throw.
const SpecListViewTypeEnum = ImportedSpecListViewSchema.shape.type.removeDefault();

/**
 * View Type Schema — the zod face of {@link ViewType} (`../views.ts`).
 *
 * DERIVED from `@objectstack/spec/ui` `ListViewSchema.type` (objectui#8127), so
 * the two faces cannot drift from the spec or from each other. Both were
 * hand-written eleven-arm copies of the spec's 17.2.0 list; `@objectstack/spec@17.3.0`
 * added `page` and neither followed, while `ViewKindEnum` in `./objectql.zod.ts`
 * — already derived — accepted `viewType: 'page'` the day the pin landed. That
 * is `declared !== enforced` on a published surface: the validator said yes and
 * the renderer silently drew a grid.
 *
 * `'list'` and `'detail'` are appended because they are objectui view
 * CATEGORIES with no spec counterpart; see `../views.ts` for why they are not
 * pushed upstream.
 */
export const ViewTypeSchema = z.enum([...SpecListViewTypeEnum.options, 'list', 'detail']).describe('View type');

/**
 * Detail View Field Schema
 */
export const DetailViewFieldSchema = z.object({
  name: z.string().describe('Field name/path'),
  label: z.string().optional().describe('Display label'),
  type: z.enum([
    'text', 'number', 'currency', 'percent', 'boolean', 'select', 'lookup', 'master_detail',
    'email', 'url', 'phone', 'user',
    'image', 'link', 'badge', 'date', 'datetime', 'json', 'html', 'markdown', 'custom',
  ]).optional().describe('Field type for rendering'),
  format: z.string().optional().describe('Format string (e.g., date format)'),
  render: SchemaNodeSchema.optional().describe('Custom renderer'),
  value: z.any().optional().describe('Field value'),
  readonly: z.boolean().optional().describe('Whether field is read-only'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Field visibility condition'),
  span: z.number().optional().describe('Span across columns (for grid layout)'),
  options: z.array(z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    color: z.string().optional(),
  })).optional().describe('Options for select/lookup fields'),
  reference_to: z.string().optional().describe('Referenced object name for lookup/master_detail fields'),
  reference_field: z.string().optional().describe('Display field on the referenced object'),
  currency: z.string().optional().describe('Currency code for currency fields (e.g. USD, EUR)'),
  dueLike: z.boolean().optional().describe(
    'Marks a date/datetime field as due/deadline-semantic, gating the relative "Overdue Nd" wording (vs. neutral "Nd ago" for start/end/created dates)',
  ),
});

/**
 * Detail View Section Schema
 */
export const DetailViewSectionSchema = z.object({
  name: z.string().optional().describe('Stable identifier for i18n key resolution'),
  title: z.string().optional().describe('Section title'),
  description: z.string().optional().describe('Section description'),
  icon: z.string().optional().describe('Section icon'),
  fields: z.array(DetailViewFieldSchema).describe('Fields in this section'),
  collapsible: z.boolean().optional().describe('Collapsible section'),
  defaultCollapsed: z.boolean().optional().describe('Default collapsed state'),
  columns: z.number().optional().describe('Grid columns for field layout'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Section visibility condition'),
  showBorder: z.boolean().optional().describe('Show border around section'),
  // Closed vocabulary — the six design-system tint tokens
  // `@object-ui/plugin-detail`'s `HEADER_COLOR_CLASSES` resolves, and the six
  // `@objectstack/spec` declares on its strict `record:details` section schema
  // (maintainer ruling A, 2026-08-26, objectstack#12126). Pinned one-to-one
  // against that renderer module by
  // `packages/plugin-detail/src/__tests__/headerColor.contractPin-6594.test.ts`,
  // which fails in BOTH directions — a token added to either side alone is red.
  // The renderer's verbatim `bg-*` pass-through stays an UNDECLARED affordance:
  // the ruling rejected declaring it, since it only renders where the host
  // app's Tailwind build happens to emit that class.
  headerColor: z
    .enum(['muted', 'muted/50', 'accent', 'primary/10', 'secondary/10', 'destructive/10'])
    .optional()
    .describe('Header background tint (one of six design-system tokens)'),
});

/**
 * Detail View Tab Schema
 */
export const DetailViewTabSchema = z.object({
  key: z.string().describe('Tab key/identifier'),
  label: z.string().describe('Tab label'),
  icon: z.string().optional().describe('Tab icon'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Tab content'),
  visible: z.union([z.boolean(), z.string()]).optional().describe('Tab visibility condition'),
  badge: z.union([z.string(), z.number()]).optional().describe('Badge count'),
});

/**
 * Detail View Schema
 */
export const DetailViewSchema = BaseSchema.extend({
  type: z.literal('detail-view'),
  title: z.string().optional().describe('Detail title'),
  api: z.string().optional().describe('API endpoint to fetch detail data'),
  resourceId: z.union([z.string(), z.number()]).optional().describe('Resource ID to display'),
  objectName: z.string().optional().describe('Object name (for ObjectQL integration)'),
  data: z.any().optional().describe('Data to display (if not fetching from API)'),
  layout: z.enum(['vertical', 'horizontal', 'grid']).optional().describe('Layout mode'),
  columns: z.number().optional().describe('Grid columns (for grid layout)'),
  sections: z.array(DetailViewSectionSchema).optional().describe('Field sections for organized display'),
  fields: z.array(DetailViewFieldSchema).optional().describe('Direct fields (without sections)'),
  actions: z.array(z.any()).optional().describe('Actions available in detail view'),
  tabs: z.array(DetailViewTabSchema).optional().describe('Tabs for additional content'),
  showBack: z.boolean().optional().describe('Show back button'),
  backUrl: z.string().optional().describe('Back button URL'),
  // RUNTIME SLOT (objectui#7344, the objectui#6182 ruling in the objectui#6124
  // shape): `detail-view` spreads the node's keys onto `DetailView`, whose
  // `handleBack` CALLS `onBack()` — a host-supplied function, never the string
  // this mirror used to accept (which threw `onBack is not a function` at click).
  onBack: handlerKeyRefusal('onBack', 'runtime-slot', 'Custom back action'),
  showEdit: z.boolean().optional().describe('Show edit button'),
  editUrl: z.string().optional().describe('Edit button URL'),
  showDelete: z.boolean().optional().describe('Show delete button'),
  deleteConfirmation: z.string().optional().describe('Delete confirmation message'),
  loading: z.boolean().optional().describe('Whether to show loading state'),
  header: SchemaNodeSchema.optional().describe('Custom header content'),
  footer: SchemaNodeSchema.optional().describe('Custom footer content'),
  related: z.array(z.object({
    title: z.string().describe('Relation title'),
    type: z.enum(['list', 'grid', 'table']).describe('Relation type'),
    api: z.string().optional().describe('API endpoint for related data'),
    data: z.array(z.any()).optional().describe('Static data'),
    columns: z.array(z.any()).optional().describe('Columns for table view'),
    fields: z.array(z.string()).optional().describe('Fields for list view'),
    referenceField: z.string().optional().describe('Foreign-key field on the child object pointing back to the parent record. The renderer hides this column from the related-list table by default since the parent is implicit context.'),
    icon: z.string().optional().describe('Optional Lucide-style icon name to render next to the section title'),
  })).optional().describe('Related records section'),
});

/**
 * View Switcher Schema
 */
export const ViewSwitcherSchema = BaseSchema.extend({
  type: z.literal('view-switcher'),
  views: z.array(z.object({
    type: ViewTypeSchema.describe('View type'),
    label: z.string().optional().describe('View label'),
    icon: z.string().optional().describe('View icon'),
    schema: SchemaNodeSchema.optional().describe('View schema'),
  })).describe('Available view types'),
  defaultView: ViewTypeSchema.optional().describe('Default/active view'),
  activeView: ViewTypeSchema.optional().describe('Current active view'),
  variant: z.enum(['tabs', 'buttons', 'dropdown']).optional().describe('Switcher variant'),
  position: z.enum(['top', 'bottom', 'left', 'right']).optional().describe('Switcher position'),
  onViewChange: z.string().optional()
    .describe('Event name dispatched on window when the view changes (detail: { view }) — an event NAME, not a callback or a handler expression'),
  persistPreference: z.boolean().optional().describe('Persist view preference'),
  storageKey: z.string().optional().describe('Storage key for persisting view'),
  allowCreateView: z.boolean().optional().describe('Show "+" button to add/create a new view'),
  viewActions: z.array(z.object({
    type: z.enum(['share', 'settings', 'duplicate', 'delete']).describe('Action type'),
    icon: z.string().optional().describe('Action icon'),
  })).optional().describe('Per-view action icons'),
});

/**
 * Filter UI Schema
 */
export const FilterUISchema = BaseSchema.extend({
  type: z.literal('filter-ui'),
  filters: z.array(z.object({
    field: z.string().describe('Filter field'),
    label: z.string().optional().describe('Filter label'),
    type: z.enum(['text', 'number', 'select', 'multi-select', 'date', 'date-range', 'boolean']).describe('Filter type'),
    operator: z.enum(['equals', 'contains', 'startsWith', 'gt', 'lt', 'between', 'in']).optional().describe('Filter operator'),
    options: z.array(z.object({ label: z.string(), value: z.any() })).optional().describe('Options for select filter'),
    placeholder: z.string().optional().describe('Placeholder'),
  })).describe('Available filters'),
  values: z.record(z.string(), z.any()).optional().describe('Current filter values'),
  onChange: z.string().optional()
    .describe('Event name dispatched on window when the filters change (detail: { values }) — an event NAME, not a callback or a handler expression'),
  showClear: z.boolean().optional().describe('Show clear button'),
  showApply: z.boolean().optional().describe('Show apply button'),
  layout: z.enum(['inline', 'popover', 'drawer']).optional().describe('Filter layout'),
});

/**
 * Sort UI Schema
 */
export const SortUISchema = BaseSchema.extend({
  type: z.literal('sort-ui'),
  fields: z.array(z.object({
    field: z.string().describe('Field name'),
    label: z.string().optional().describe('Field label'),
  })).describe('Sortable fields'),
  sort: z.array(z.object({
    field: z.string().describe('Field to sort by'),
    direction: z.enum(['asc', 'desc']).describe('Sort direction'),
  })).optional().describe('Current sort configuration'),
  onChange: z.string().optional()
    .describe('Event name dispatched on window when the sort changes (detail: { sort }) — an event NAME, not a callback or a handler expression'),
  multiple: z.boolean().optional().describe('Allow multiple sort fields'),
  variant: z.enum(['dropdown', 'buttons']).optional().describe('UI variant'),
});

/**
 * Union of all view schemas
 */
export const ViewComponentSchema = z.discriminatedUnion('type', [
  DetailViewSchema,
  ViewSwitcherSchema,
  FilterUISchema,
  SortUISchema,
]);

/**
 * Export type inference helpers
 */
export type ViewTypeSchemaType = z.infer<typeof ViewTypeSchema>;
export type DetailViewFieldSchemaType = z.infer<typeof DetailViewFieldSchema>;
export type DetailViewSectionSchemaType = z.infer<typeof DetailViewSectionSchema>;
export type DetailViewTabSchemaType = z.infer<typeof DetailViewTabSchema>;
export type DetailViewSchemaType = z.infer<typeof DetailViewSchema>;
export type ViewSwitcherSchemaType = z.infer<typeof ViewSwitcherSchema>;
export type FilterUISchemaType = z.infer<typeof FilterUISchema>;
export type SortUISchemaType = z.infer<typeof SortUISchema>;
