/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Data Display Component Zod Validators
 * 
 * Zod validation schemas for data display and information presentation components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/data-display
 * @packageDocumentation
 */

import { z } from 'zod';
import { ChartTypeSchema as SpecChartTypeSchema, I18nLabelSchema } from '@objectstack/spec/ui';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';
import { aliasKeyRefusal, handlerKeyRefusal, retirementTombstone } from './tombstone.zod.js';
import { TABLE_COLUMN_TYPES } from '../data-display.js';

/**
 * Alert Schema - Alert/notification component
 */
export const AlertSchema = BaseSchema.extend({
  type: z.literal('alert'),
  title: z.string().optional().describe('Alert title'),
  description: z.string().optional().describe('Alert description'),
  variant: z.enum(['default', 'destructive']).optional().describe('Alert variant'),
  icon: z.string().optional().describe('Alert icon'),
  dismissible: z.boolean().optional().describe('Whether alert can be dismissed'),
  onDismiss: handlerKeyRefusal('onDismiss', 'retired', 'Dismiss handler'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Statistic Schema - Statistic display component
 */
export const StatisticSchema = BaseSchema.extend({
  type: z.literal('statistic'),
  label: z.string().optional().describe('Statistic label'),
  value: z.union([z.string(), z.number()]).describe('Statistic value'),
  trend: z.enum(['up', 'down', 'neutral']).optional().describe('Trend indicator'),
  description: z.string().optional().describe('Description text'),
  icon: z.string().optional().describe('Statistic icon'),
});

/**
 * Badge Schema - Badge/tag component
 */
export const BadgeSchema = BaseSchema.extend({
  type: z.literal('badge'),
  label: z.string().optional().describe('Badge label'),
  variant: z.enum(['default', 'secondary', 'destructive', 'outline']).optional().describe('Badge variant'),
  icon: z.string().optional().describe('Badge icon'),
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional(),
});

/**
 * Avatar Schema - Avatar/profile picture component
 */
export const AvatarSchema = BaseSchema.extend({
  type: z.literal('avatar'),
  src: z.string().optional().describe('Image source URL'),
  alt: z.string().optional().describe('Alt text'),
  fallback: z.string().optional().describe('Fallback text/initials'),
  size: z.enum(['sm', 'default', 'lg', 'xl']).optional().describe('Avatar size'),
  shape: z.enum(['circle', 'square']).optional().describe('Avatar shape'),
});

/**
 * List Item Schema
 */
export const ListItemSchema = z.object({
  id: z.string().optional().describe('Item ID'),
  label: z.string().optional().describe('Item label'),
  description: z.string().optional().describe('Item description'),
  icon: z.string().optional().describe('Item icon'),
  avatar: z.string().optional().describe('Item avatar URL'),
  disabled: z.boolean().optional().describe('Whether item is disabled'),
  onClick: handlerKeyRefusal('onClick', 'retired', 'Click handler'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Custom content'),
});

/**
 * List Schema - List component
 */
export const ListSchema = BaseSchema.extend({
  type: z.literal('list'),
  items: z.array(ListItemSchema).describe('List items'),
  ordered: z.boolean().optional().describe('Whether list is ordered'),
  dividers: z.boolean().optional().describe('Show dividers between items'),
  dense: z.boolean().optional().describe('Dense spacing'),
});

/**
 * Table Column Schema
 */
export const TableColumnSchema = z.object({
  header: z.string().describe('Column header text'),
  accessorKey: z.string().describe('Data accessor key'),
  className: z.string().optional().describe('Column class name'),
  cellClassName: z.string().optional().describe('Cell class name'),
  width: z.union([z.string(), z.number()]).optional().describe('Column width'),
  minWidth: z.union([z.string(), z.number()]).optional().describe('Minimum width'),
  align: z.enum(['left', 'center', 'right']).optional().describe('Column alignment'),
  fixed: z.enum(['left', 'right']).optional().describe('Fixed column position'),
  // The canonical value set, built from the ONE declaration in
  // `../data-display.ts` rather than restated here (objectui#5853, maintainer
  // ruling 2026-08-25, Option B). This key was `z.string()`: every typo passed
  // — `type: 'money'` validated green, matched no renderer branch, and the
  // column silently fell through to plain text rendering. That is the lenient
  // -validation face that lets AI-authored metadata errors through, and it is
  // now a loud parse failure naming the key.
  type: z.enum(TABLE_COLUMN_TYPES).optional().describe('Column type'),
  sortable: z.boolean().optional().describe('Whether column is sortable'),
  filterable: z.boolean().optional().describe('Whether column is filterable'),
  resizable: z.boolean().optional().describe('Whether column is resizable'),
  editable: z.boolean().optional().describe('Whether column is editable (for inline editing)'),
  cell: z.function().optional().describe('Custom cell renderer'),
  // A rendered React node — a runtime slot like `cell` above, so the mirror's
  // one job is to PASS IT THROUGH: a non-strict z.object() silently STRIPS an
  // undeclared key, and a stripped `headerIcon` was exactly the second de-facto
  // contract objectui#6424 closed (the renderer honoured what the published
  // declaration refused). Declared on the interface, mirrored here, and paired
  // in `__tests__/zod-mirror-parity.test.ts`.
  headerIcon: z.any().optional().describe('Icon node rendered into the header cell, before the header text'),
  // The card's second key (objectui#6424, maintainer ruling 2026-08-28,
  // Option A). Unlike `headerIcon`/`cell` above this one is serializable
  // metadata, so the mirror TYPES it — `z.boolean()`, not `z.any()`. It was
  // silently STRIPPED by this non-strict object before the declaration: the
  // same second de-facto contract the `headerIcon` half closed, the renderer
  // honouring what the published declaration refused. Pinned by output
  // SURVIVAL, not parse acceptance — acceptance was green while the flag
  // vanished and the row-actions column fell back to the clipped 80px floor.
  fitContent: z.boolean().optional().describe('Size the column to its own content (width:1% + nowrap) instead of a measured width'),
  // The three field-meta override keys objectui#6425 declared (maintainer
  // ruling 2026-08-27, per-key): honoured by `object-data-table`'s cell
  // pipeline — documented behaviour for `format` / `options`, long-shipped
  // for `currency` — and previously silently STRIPPED by this non-strict
  // mirror, the same second de-facto contract #6424 closed for `headerIcon`.
  // The pin is output SURVIVAL, not parse acceptance
  // (static-table-narrow-surface.test.ts): acceptance was green before the
  // declaration and cannot distinguish the fix from the defect.
  format: z.string().optional().describe('Field-meta override: display format pattern (e.g. "$0,0", "0%", "YYYY-MM-DD")'),
  options: z
    .array(
      z.object({
        value: z.any().describe('Stored value the cell value is matched against'),
        label: z.string().describe('Label rendered for the matched value'),
        color: z.string().optional().describe('Badge/dot color for the matched value'),
      }),
    )
    .optional()
    .describe('Field-meta override: option list for select-flavoured columns'),
  currency: z.string().optional().describe('Field-meta override: ISO 4217 currency code for currency-formatted cells'),
  // objectui#6650 (maintainer ruling 2026-09-02, Option B). Serializable
  // metadata, so the mirror TYPES it — `z.boolean()`, like `fitContent`.
  // Without this line the non-strict object would silently STRIP an
  // authored `wrap`, which is the same second de-facto contract #6424
  // closed for `headerIcon`: the renderer honouring what the published
  // declaration refuses. The `.describe()` text is the spec's own wording
  // for `ListColumn.wrap`, so the two authoring surfaces read alike.
  wrap: z.boolean().optional().describe('Allow text wrapping'),
});

/**
 * Static Table Column Schema — the narrow declared subset the static `table`
 * renderer actually reads (objectui#5474, maintainer ruling 2026-08-22,
 * Option C: split the types). `TableColumnSchema` above remains the rich
 * shared shape `data-table` honours and is deliberately NOT narrowed.
 *
 * The `never`-typed members are ADR-0049 retirement tombstones (the convention
 * `crud.zod.ts` `confirm` set): an authored value is REFUSED at parse time with
 * the key named in the error path, instead of being silently stripped the way
 * an undeclared key would be. Loud refusal is the ruled outcome — these keys
 * were accepted-and-inert for as long as the static table shared the rich
 * column type.
 *
 * The nine keys the #5474 split retired carry that refusal through
 * `retirementTombstone()` (`./tombstone.zod.ts`), which writes the guidance
 * string ONCE into both author-facing channels — `.describe()` for generated
 * JSON-Schema and docs, and the parse-time issue message for the author who
 * trips it. Until objectui#6105 the string reached only the first: the runtime
 * message was zod's generic `"Invalid input: expected never, received string"`,
 * which names the key but not the remedy, so the loud refusal arrived without
 * the half that teaches. The accept set is untouched by that conversion — same
 * `success`, same issue `path`, same issue `code` (`invalid_type`); only the
 * message differs.
 *
 * The six later arrivals below (`headerIcon` / `fitContent`, objectui#6424;
 * `format` / `options` / `currency`, objectui#6425; `wrap`, objectui#6650)
 * were outside #6105's reviewed scope and carried the bare spelling until
 * objectui#6931 converted them here (`wrap` was born converted). That
 * mattered because a half-converted shape teaches worse than a uniform one:
 * an author reading guidance on nine keys and zod's generic on five learns the
 * message means something, then has it withheld.
 */
export const StaticTableColumnSchema = z.object({
  header: z.string().describe('Column header text'),
  accessorKey: z.string().describe('Data accessor key'),
  className: z.string().optional().describe('Column class name'),
  cellClassName: z.string().optional().describe('Cell class name'),
  width: z.union([z.string(), z.number()]).optional().describe('Column width'),
  minWidth: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  align: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table, or a cellClassName like text-right'),
  fixed: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  type: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  sortable: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  filterable: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  resizable: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  editable: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  cell: retirementTombstone('RETIRED (objectui#5474) — never read by the static table; use data-table'),
  headerIcon: retirementTombstone('NOT on the static table surface (objectui#6424) — declared on the rich TableColumn only; use data-table'),
  fitContent: retirementTombstone('NOT on the static table surface (objectui#6424) — declared on the rich TableColumn only; use data-table'),
  format: retirementTombstone('NOT on the static table surface (objectui#6425) — declared on the rich TableColumn only; use data-table'),
  options: retirementTombstone('NOT on the static table surface (objectui#6425) — declared on the rich TableColumn only; use data-table'),
  currency: retirementTombstone('NOT on the static table surface (objectui#6425) — declared on the rich TableColumn only; use data-table'),
  wrap: retirementTombstone('NOT on the static table surface (objectui#6650) — declared on the rich TableColumn only; use data-table'),
});

/**
 * Table Schema - Simple STATIC table component. For hover/stripe styling,
 * sorting, filtering, selection or inline editing use `data-table`.
 *
 * `hoverable` / `striped` are ADR-0049 tombstones (objectui#5474): the static
 * renderer never implemented either — both carried `@default` annotations and
 * reference-page teaching describing behaviour that did not exist. An
 * authored value now fails parse loudly rather than doing nothing silently,
 * and the refusal carries its own remediation text through
 * `retirementTombstone()` (objectui#6931) rather than zod's generic
 * `expected never`.
 */
export const TableSchema = BaseSchema.extend({
  type: z.literal('table'),
  caption: z.string().optional().describe('Table caption'),
  columns: z.array(StaticTableColumnSchema).describe('Table columns (static subset — objectui#5474)'),
  data: z.array(z.any()).describe('Table data'),
  footer: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Table footer'),
  hoverable: retirementTombstone('RETIRED (objectui#5474) — the static table never implemented row hover; use data-table'),
  striped: retirementTombstone('RETIRED (objectui#5474) — the static table never implemented striping; style rows via className, or use data-table'),
});

/**
 * Data Table Schema - Advanced data table with features
 */
export const DataTableSchema = BaseSchema.extend({
  type: z.literal('data-table'),
  caption: z.string().optional().describe('Table caption'),
  borderless: z.boolean().optional().describe('Render the table without its outer rounded border (for embedding inside grouped rows or other containers).'),
  toolbar: retirementTombstone('RETIRED (objectui#6881) — never mounted by the data-table renderer; use the built-in toolbar chrome (searchable / exportable), or compose nodes beside the table'),
  columns: z.array(TableColumnSchema).describe('Table columns'),
  data: z.array(z.any()).describe('Table data'),
  pagination: z.boolean().optional().describe('Enable pagination'),
  pageSize: z.number().optional().describe('Default page size'),
  pageSizeOptions: z.array(z.number()).optional().describe('Options for the rows-per-page selector (defaults to 5/10/20/50/100).'),
  searchable: z.boolean().optional().describe('Enable search'),
  selectable: z.union([z.boolean(), z.enum(['single', 'multiple'])]).optional().describe('Enable row selection — `true`/`multiple` = multi-select, `single` = replace-on-select with no select-all'),
  sortable: z.boolean().optional().describe('Enable sorting'),
  exportable: z.boolean().optional().describe('Enable data export'),
  rowActions: z.boolean().optional().describe('Show the row actions column (edit/delete) — mirrors the boolean the renderer truthiness-tests (objectui#6940)'),
  resizableColumns: z.boolean().optional().describe('Allow column resizing'),
  reorderableColumns: z.boolean().optional().describe('Allow column reordering'),
  onRowEdit: handlerKeyRefusal('onRowEdit', 'runtime-slot', 'Row edit handler'),
  onRowDelete: handlerKeyRefusal('onRowDelete', 'runtime-slot', 'Row delete handler'),
  rowEditPredicates: z.object({
    visibleWhen: z.unknown().optional(),
    disabledWhen: z.unknown().optional(),
  }).optional().describe('Per-record CEL predicates for the built-in row Edit item (objectui#2614)'),
  rowDeletePredicates: z.object({
    visibleWhen: z.unknown().optional(),
    disabledWhen: z.unknown().optional(),
  }).optional().describe('Per-record CEL predicates for the built-in row Delete item (objectui#2614)'),
  onSelectionChange: handlerKeyRefusal('onSelectionChange', 'runtime-slot', 'Selection change handler'),
  onColumnsReorder: handlerKeyRefusal('onColumnsReorder', 'runtime-slot', 'Column reorder handler'),
  cellClassName: z.string().optional().describe('Extra classes folded into the utility body cells only — the selection, row-number and row-actions cells; data cells fold the per-column `cellClassName` instead, so row density has to be set on both (objectui#6882)'),
  renderCellEditor: z.function().optional().describe('Host-supplied inline cell editor; returning null falls through to the built-in text/number/date inputs (objectui#6882). Its context carries `row` (the persisted record) and `pendingRow` (that record with the row\'s staged, unsaved edits merged over it — objectui#7188); `z.function()` encodes no parameter shape, so the member on `DataTableSchema` is the authority for it'),
  frozenColumns: z.number().optional().describe('Number of frozen columns'),
  showRowNumbers: z.boolean().optional().describe('Show row numbers'),
  emptyAction: SchemaNodeSchema.optional().describe('Optional schema node rendered inside the empty-state, e.g. an "Add record" button. Lets the empty state become an actionable invitation rather than a dead end.'),
});

/**
 * Markdown Schema - Markdown content renderer
 *
 * `sanitize` / `components` are ADR-0049 tombstones (objectui#6972).
 * `sanitize` implied a switch that does not exist: sanitization is
 * UNCONDITIONAL — the `rehypeSanitize` link is a fixed last member of a
 * module-level `const` chain in `plugin-markdown/src/MarkdownImpl.tsx`, with
 * no conditional path — so the enforce arm (an XSS-off switch) was refused
 * and the key retired. `components` was a `Record<string, any>` of React
 * overrides nothing read — not a JSON-authorable value, and no host path
 * consumes such a map either, so there is no runtime slot to keep. Both
 * refuse BY NAME through `retirementTombstone()` (objectui#6931), with the
 * remedy in the message, rather than parsing green and doing nothing. The TS
 * twins are `?: never` in `../data-display.ts`; both published faces carry the
 * refusal (`@object-ui/types`, and `@object-ui/plugin-markdown`'s re-export of
 * the same authority — objectui#6172).
 */
export const MarkdownSchema = BaseSchema.extend({
  type: z.literal('markdown'),
  content: z.string().describe('Markdown content'),
  sanitize: retirementTombstone(
    'RETIRED (objectui#6972) — sanitization is unconditional: rehype-sanitize is a fixed last link of the '
    + 'markdown renderer\'s rehype chain, and no value of this key ever switched it. There is no authored '
    + 'spelling that disables XSS sanitization; delete the key.',
  ),
  components: retirementTombstone(
    'RETIRED (objectui#6972) — never read: the markdown renderer forwards only `content` and `className`, '
    + 'and a map of React component overrides is not a JSON-authorable value. Delete the key; the fenced '
    + 'mermaid / metadata block overrides are the renderer\'s own fixed map, not an authoring surface.',
  ),
});

/**
 * Tree Node Schema
 */
export const TreeNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().describe('Node ID'),
    label: z.string().describe('Node label'),
    icon: z.string().optional().describe('Node icon'),
    defaultExpanded: z.boolean().optional().describe('Default expanded state'),
    selectable: z.boolean().optional().describe('Whether node is selectable'),
    children: z.array(TreeNodeSchema).optional().describe('Child nodes'),
    data: z.any().optional().describe('Custom node data'),
  })
);

/**
 * Tree View Schema - Tree/hierarchical view component
 */
export const TreeViewSchema = BaseSchema.extend({
  type: z.literal('tree-view'),
  data: z.array(TreeNodeSchema).optional()
    .describe('Tree data, read THIRD as the fallback limb of `boundData || schema.nodes || schema.data || []` at renderers/data-display/tree-view.tsx:105. OPTIONAL since objectui#6939 — requiring a third-choice limb refused four catalog entries the renderer draws correctly. Kept DECLARED rather than deleted: `BaseSchema.data` is `z.any().optional()`, so removing this member would not reject the key, it would admit it unvalidated while the read stays'),
  nodes: z.array(TreeNodeSchema).optional()
    .describe('Tree data, read FIRST at renderers/data-display/tree-view.tsx:105 — the middle limb of `boundData || schema.nodes || schema.data || []`, so it wins over `data`. Declared by objectui#6150; a `nodes`-only document became LEGAL at objectui#6939, which relaxed `data` (the registration\'s own `inputs` and `defaultProps` spell it `nodes`, and the four catalog entries ARE those `defaultProps`)'),
  title: z.string().optional()
    .describe('Heading above the tree, read at renderers/data-display/tree-view.tsx:115 (presence gate) and :117 (the h3 body) (objectui#6150)'),
  defaultExpandedIds: z.array(z.string()).optional().describe('Default expanded node IDs'),
  defaultSelectedIds: z.array(z.string()).optional().describe('Default selected node IDs'),
  expandedIds: z.array(z.string()).optional().describe('Controlled expanded node IDs'),
  selectedIds: z.array(z.string()).optional().describe('Controlled selected node IDs'),
  multiSelect: z.boolean().optional().describe('Allow multiple selection'),
  showLines: z.boolean().optional().describe('Show connecting lines'),
  onSelectChange: handlerKeyRefusal('onSelectChange', 'retired', 'Selection change handler'),
  onExpandChange: handlerKeyRefusal('onExpandChange', 'retired', 'Expand change handler'),
});

/**
 * Chart Type Enum — `@objectstack/spec/ui` schema re-exported **by reference**
 * (issue #2231; formerly a hand-written mirror).
 *
 * The mirror had drifted to 7 of the spec's 19 values, and because it was
 * re-exported under the spec's own symbol name, an importer of
 * `@object-ui/types` could not tell which `ChartTypeSchema` they had. That is
 * how #2901 came to be filed against the wrong side of the contract: it read
 * this copy as the protocol and concluded the renderer had outgrown it.
 */
export const ChartTypeSchema = SpecChartTypeSchema;

/**
 * Zod twin of {@link ChartDataSeries} — the objectui chart node's inline-data
 * series. Renamed off `ChartSeriesSchema` (objectstack#4115) for the same reason
 * the TS type was: `@objectstack/spec/ui`'s `ChartSeriesSchema` describes a
 * dataset-bound series (no `data`, plus `type`/`stack`/`yAxis`/`variant`), so a
 * consumer importing `ChartSeriesSchema` from `@object-ui/types` could not tell
 * which contract they had.
 *
 * ⚠️ Since objectui#6896 this twin carries no inline numbers either: `data` is a
 * retirement tombstone. The distinction the rename drew is now one of ROLE, not
 * of payload — this is the STATIC SDUI node's series, the spec's is the
 * dataset-bound one, and neither carries values.
 */
export const ChartDataSeriesSchema = z.object({
  // BOTH BINDING DIALECTS (objectui#6939, maintainer ruling 2026-09-02 — the
  // `chart` row, verbatim 「同意」). `normalizeSeries` reads
  // `str(raw.dataKey) ?? str(raw.name)` (`plugin-charts/src/normalizeChartSchema.ts:239`),
  // so the two spellings are interchangeable at the renderer. This mirror
  // REQUIRED `name`, which refused `series: [{ dataKey: 'revenue' }]` — the
  // spelling BOTH catalog chart fixtures are written in and the renderer draws.
  // `name` is optional here and the refinement below carries the floor its
  // required flag used to: the accept set only widens.
  name: z.string().optional().describe(
    'Series name — also selects this series\' column within each chart-level `data` row when `dataKey` is absent',
  ),
  dataKey: z.string().optional().describe(
    'Column this series plots within each chart-level `data` row — the internal spelling of `name`, and the one the renderer takes when both are written',
  ),
  // ADR-0049 RETIREMENT TOMBSTONE (objectui#6896). Deleting the member was the
  // option NOT taken: `ChartDataSeriesSchema` is a non-strict `z.object`, which
  // STRIPS an undeclared key in silence — the same silent no-op the retirement
  // exists to end. Kept declared and unwritable, so an authored value is a
  // NAMED refusal carrying its own remedy.
  data: retirementTombstone(
    'RETIRED (objectui#6896) — `ChartDataSeries.data` was never read: '
    + '`normalizeChartSchema` takes rows from the chart node\'s chart-level `data` and picks a '
    + 'column with the series\' `name`/`dataKey`, so an authored array was dropped in silence. '
    + 'Delete the key; put the rows on the chart-level `data` and the category axis on `xAxisKey`.',
  ),
  // Mirrors `ChartDataSeries.type` (objectui#6121). The three families are the
  // ones `normalizeChartSchema` actually honours as a per-series override; see
  // the TS declaration for the read this narrowness is taken from.
  type: z.enum(['bar', 'line', 'area']).optional().describe('Per-series chart family override (combo charts)'),
  // ALIAS REFUSAL (objectui#7694 — option A of the `domain:ui` PM ruling on
  // objectui#7546 / the contract review of PR #7684). `chartType` is the
  // renderer's INTERNAL spelling of `type` above — the first limb of
  // `normalizeSeries`' `str(raw.chartType) ?? str(raw.type)`
  // (`normalizeChartSchema.ts:244`) — written by the internal-shape producers
  // that hand `dataKey`-shaped arrays straight to `ChartRenderer`, and by
  // nothing on this authoring face: re-measured at implementation time with
  // lit controls (docs 0, fixtures 0, designer inputs 0, src literals 0,
  // tests 9 — all internal-shape; the limb's ablation left 304 files / 5817
  // tests green while its `type` sibling went 2 red). The TS twin's docblock
  // carries the numbers. This object is NON-STRICT, so until now an authored
  // `chartType` was STRIPPED in silence and the series drew in the chart's own
  // family — precisely what the author was overriding. Now it is DECLARED and
  // unwritable, refusing by name in the spec's own posture (`ChartSeriesSchema`
  // lists it as an alias of `type`: "Did you mean `chartType` → `type`?").
  // Not a fold: when both are written the document is refused rather than one
  // key silently winning — the renderer takes `chartType` FIRST, so a fold
  // would invert the objectui#7113 precedence rule. Not a second writable
  // name: that is the N-dialects hazard of AGENTS.md #0.1.
  chartType: aliasKeyRefusal(
    'chartType',
    'type',
    'this chart series',
    '`chartType` is the renderer\'s INTERNAL spelling of the declared `type` (objectui#7694): '
    + '`@objectstack/spec`\'s `ChartSeriesSchema` lists it as an alias of `type` and refuses it the '
    + 'same way, and nothing on this authoring face writes it. Write `type` (`bar` | `line` | `area`) '
    + 'for a per-series family override. Until this refusal an authored `chartType` was STRIPPED in '
    + 'silence by this non-strict object, so the series drew in the chart\'s own family — precisely '
    + 'what the author was overriding.',
  ),
  color: z.string().optional().describe('Series color'),
  // THE SIX KEYS THE RENDERER READS (objectui#7546). Each was undeclared, and
  // because this object is NON-STRICT the mirror STRIPPED it in silence while
  // `safeParse` reported success — the card's own measurement:
  // `{ name, label, stack, yAxis, opacity, dashArray, variant }` parsed to
  // `{ name }`. Every one is read by `normalizeSeries`
  // (`normalizeChartSchema.ts:242-255`) and does real work in
  // `AdvancedChartImpl.tsx`; each value domain below is the read's own, so the
  // accept set widens only toward what already renders, and a value the
  // renderer would drop in silence is refused by name instead. They are the
  // spec's `ChartSeriesSchema` members under the same names; the TS twin's
  // docblocks carry the read sites and the liveness measurement.
  //
  // `chartType` is NOT among the six: it is an ALIAS REFUSAL ARM, declared
  // beside `type` above (objectui#7694).
  label: I18nLabelSchema.optional().describe(
    'Legend / tooltip name for this series — a plain string or an inline locale map; defaults to the column key',
  ),
  variant: z.enum(['primary', 'comparison']).optional().describe(
    'Visual role — `comparison` draws the muted period-over-period overlay; `primary` (the default) is the normal treatment. The spec pair: the renderer-internal `current` spelling is not a member (objectui#7682)',
  ),
  opacity: z.number().optional().describe('Stroke and fill opacity override — any finite number, the read\'s own domain; the spec bounds it to 0–1'),
  dashArray: z.string().optional().describe('SVG stroke-dasharray override, e.g. "4 4" for a dashed line'),
  stack: z.string().optional().describe('Stack group id — series sharing one id stack together'),
  yAxis: z.enum(['left', 'right']).optional().describe('Which y-axis this series binds to on a dual-axis chart'),
}).superRefine((series, ctx) => {
  // `normalizeSeries` returns `undefined` when NEITHER spelling resolves
  // (`normalizeChartSchema.ts:240`, `if (!dataKey) return undefined`) and the
  // series is dropped from the chart in silence. Refusing by name here is that
  // silent drop made loud. ⚠️ This is not a new narrowing: `name`'s required
  // flag already refused exactly this document, and the path is kept on `name`
  // so the diagnostic lands where it always did.
  if (series.name === undefined && series.dataKey === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['name'],
      message:
        'A chart series must name the column it plots, with `name` or `dataKey` — '
        + '`normalizeChartSchema` drops a series that resolves to neither.',
    });
  }
});

/**
 * Fold the bare-string `xAxis` spelling onto the canonical `xAxisKey` and drop
 * it from the output (objectui#7113, 项目总监席 总监批 #28, 2026-09-01,
 * maintainer verbatim 「同意」 — option B), in the shape objectstack#13897
 * landed for `FormViewSchema`'s legacy `groups`.
 *
 * ## Only the BARE-STRING dialect is an alias — measured, not assumed
 *
 * `xAxis` carries TWO authored dialects, and only one of them is a sibling
 * spelling of `xAxisKey`:
 *
 *   - `xAxis: 'month'` — a bare string. `normalizeChartSchema` resolves it
 *     through `str(xAxisRaw)`, the third limb of
 *     `str(schema.xAxisKey) ?? xAxisSpec?.field ?? str(xAxisRaw)`
 *     (`normalizeChartSchema.ts:292`). It means the category COLUMN and nothing
 *     else, so it folds here.
 *   - `xAxis: { field, format, title, showGridLines, … }` — the spec's axis
 *     CONFIG object. Its `field` reaches `xAxisKey` through the same line, but
 *     its presentation keys survive separately into `out.xAxis`
 *     (`normalizeChartSchema.ts:289-291`). It is a DIFFERENT key that happens to
 *     also answer the column question, not a spelling of `xAxisKey` — folding it
 *     would discard `format` / `title` / `showGridLines`. It is left untouched.
 *
 * ## No second writable name, and no invented precedence
 *
 * The alias is legal at INPUT and absent from OUTPUT, so exactly one name for
 * the category column survives a parse. When both are written the canonical key
 * is kept and the alias dropped — which is not a precedence semantic minted
 * here, it is the one already running at `normalizeChartSchema.ts:292`, where
 * `xAxisKey` is the first limb of the `??` chain. Nothing that renders today
 * changes what it renders.
 *
 * ## Why `.overwrite()` and not `.transform()`
 *
 * Measured, and the same reason objectstack#13897 gives: `.transform()` returns
 * a `ZodPipe`, which has no `.shape` and no `.extend()`. Both are load-bearing
 * here — `zod-mirror-parity.test.ts` reads every mirror's OWN `.shape` (a pipe
 * answers with nothing, i.e. a silent hole in the ratchet rather than an error),
 * and `reports.zod.ts` consumes `ChartSchema` as an object. `.overwrite()` is
 * zod 4's transform that does not change the type, which is exactly what this
 * fold is.
 */
function foldChartXAxisAlias<T extends Record<string, unknown>>(input: T): T {
  const alias = input.xAxis;
  // The object dialect is not an alias — see the docblock. Leave it alone.
  if (typeof alias !== 'string') return input;
  const { xAxis: _alias, ...rest } = input;
  return (rest.xAxisKey === undefined ? { ...rest, xAxisKey: alias } : rest) as T;
}

/**
 * Drill-down configuration — the zod mirror of `DrillDownConfig`
 * (`../data-display.ts`), key for key (objectui#7352).
 *
 * Shared by the declarations that carry `drillDown`: `ChartSchema` below and
 * `ObjectDataTableSchema` (`objectql.zod.ts`) reference it. `PivotTableSchema`
 * declares the key too but has no mirror of its own, so it sits in no ledger;
 * this is the home that key uses whenever the pivot pair is mirrored. Until
 * this mirror existed neither declaring mirror had heard of the key, so under
 * `BaseSchema`'s `.passthrough()` a `drillDown: { enabled: 'yes' }` parsed green
 * and reached a widget that reads `enabled` as truthy — `declared !== enforced`,
 * ledgered in `zod-mirror-parity.test.ts` (`UnmirroredDeclared`) by
 * objectui#6058 for `ChartSchema` and by objectui#6576 for `ObjectDataTableSchema`.
 *
 * ⚠️ NOT `@objectstack/spec/ui`'s `ChartDrillDownSchema`, deliberately. That
 * object is the CHART-ONLY subset (`enabled` / `filter` / `title` / `target` /
 * `columns` / `maxRows`), strict, and refuses `mode` and `report` BY NAME with
 * guidance — both are live keys on this wider type: `mode` picks drill-through
 * vs drill-to-record on tables / pivots / metrics (`DashboardRenderer` writes
 * `{ enabled: true, mode: 'record' }` for every object-backed table widget), and
 * `report` drills a metric into an analytical report. Referencing the spec's
 * object would make the published validator refuse what the published
 * TypeScript declares. No spec export is named `DrillDownConfig` or
 * `DrillDownConfigSchema`, so `check:spec-symbols` has nothing to match; the
 * pair is registered against the LOCAL declaration, the `ObjectMapConfigSchema`
 * precedent. Whether `ChartSchema.drillDown` should one day narrow to the
 * spec's chart subset is a separate ruling — the declaration says
 * `DrillDownConfig`, and this mirror says the same.
 *
 * `report` keeps the declaration's structural union: an inline report shape
 * (`name` + `objectName` + `columns`, `type` optional, every other report key
 * riding through on the index signature — `.catchall(z.unknown())` is what
 * `[k: string]: unknown` spells) OR a named reference `{ name }`. Arm order
 * matters to `z.union`: the inline arm is tried first, so a value satisfying it
 * keeps its extra keys; only a value that fails it falls through to the
 * reference arm.
 */
export const DrillDownConfigSchema = z.object({
  enabled: z.boolean().optional().describe('Master switch — true, or any other key present, turns the drill on'),
  mode: z.enum(['filter', 'record']).optional().describe(
    "'filter' (the aggregate default) drills through to a filtered list; 'record' (the table / list default) opens the clicked record itself",
  ),
  target: z.enum(['drawer', 'dialog', 'navigate']).optional().describe(
    "Where the drill lands: 'drawer' (default), 'dialog', or 'navigate' to the object's full list page (falls back to 'drawer' without host drill navigation)",
  ),
  filter: z.record(z.string(), z.unknown()).optional().describe('Filter applied to the drilled list; values support ${event.*} interpolation'),
  title: z.string().optional().describe('Drawer / dialog title; supports ${event.*} interpolation'),
  report: z
    .union([
      z
        .object({
          name: z.string(),
          objectName: z.string(),
          type: z.enum(['tabular', 'summary', 'matrix', 'joined']).optional(),
          columns: z.array(z.unknown()),
        })
        .catchall(z.unknown()),
      z.object({ name: z.string() }),
    ])
    .optional()
    .describe('Drill into an analytical report instead of the record list: an inline SpecReport shape, or a named report reference'),
  columns: z.array(z.string()).optional().describe('Column whitelist for the inline drill list'),
  maxRows: z.number().optional().describe('Hard cap on rows fetched'),
});

/**
 * Chart Schema - Chart/graph component
 *
 * ⚠️ `data` and `xAxisKey` are the DATA MODEL this node has always rendered and
 * never declared (objectui#7113). Until this declaration both keys survived only
 * on `BaseSchema`'s `.passthrough()` / index signature: authored, read by the
 * renderer, and unchecked — `data: 'oops'` and `xAxisKey: 123` both parsed
 * clean and drew an empty chart. The `.describe()` prose on `categories` below
 * and on the `ChartDataSeries.data` tombstone was already teaching authors to
 * write them.
 */
export const ChartSchema = BaseSchema.extend({
  type: z.literal('chart'),
  chartType: ChartTypeSchema.describe('Chart type'),
  title: z.string().optional().describe('Chart title'),
  description: z.string().optional().describe('Chart description'),
  // NOT axis labels — `normalizeChartSchema` reads `categories` as an
  // ALTERNATIVE SERIES LIST, used only when `series` is absent (objectui#6896).
  categories: z
    .array(z.string())
    .optional()
    .describe(
      'Alternative series list — column names to plot, used only when `series` is absent. '
      + 'NOT axis labels: the category axis comes from `xAxisKey`/`xAxis`.',
    ),
  series: z.array(ChartDataSeriesSchema).describe('Chart data series'),
  // THE ROWS. Shape derived from the read sites, not from what looks reasonable:
  // `ChartRenderer.tsx:164` passes `Array.isArray(schema.data) ? schema.data : []`
  // through to the implementation, `ChartRenderer.tsx:17,47` declare the prop as
  // `Array<Record<string, any>>`, and `AdvancedChartImpl.tsx:2229` reads the
  // COLUMN NAMES back with `Object.keys(props.data[0] ?? {})` while
  // `AdvancedChartImpl.tsx:1968` indexes a row as `d[xAxisKey]`. So: an array of
  // row objects keyed by column name. Identical to the sibling `BarChartSchema.data`
  // below, which objectui#6318 derived from the same renderer the same way.
  // ⛔ NOT `normalizeChartSchema`: that function has ZERO reads of `schema.data`.
  data: z
    .array(z.record(z.string(), z.any()))
    .optional()
    .describe(
      'Rows to plot — one object per row, keyed by column name. `series[].name`/`dataKey` picks the column to plot within each row; `xAxisKey` names the category column.',
    ),
  xAxisKey: z
    .string()
    .optional()
    .describe(
      'Row key holding the category (x) axis. The bare-string sibling spelling `xAxis: \'month\'` folds onto this key at parse and does not survive it.',
    ),
  height: z.union([z.string(), z.number()]).optional().describe('Chart height'),
  width: z.union([z.string(), z.number()]).optional().describe('Chart width'),
  showLegend: z.boolean().optional().describe('Show legend'),
  showGrid: z.boolean().optional().describe('Show grid lines'),
  animate: z.boolean().optional().describe('Enable animations'),
  config: z.record(z.string(), z.any()).optional().describe('Additional chart configuration'),
  drillDown: DrillDownConfigSchema.optional().describe('Drill-down: clicking a chart segment opens a filtered list view (drawer / dialog)'),
}).overwrite(foldChartXAxisAlias);

/**
 * Timeline Event Schema
 */
export const TimelineEventSchema = z.object({
  id: z.string().optional().describe('Event ID'),
  title: z.string().describe('Event title'),
  description: z.string().optional().describe('Event description'),
  date: z.union([z.string(), z.date()]).describe('Event date'),
  icon: z.string().optional().describe('Event icon'),
  color: z.string().optional().describe('Event color'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Custom content'),
});

/**
 * Timeline scale — the six values of `@objectstack/spec`
 * `ui/TimelineConfig.json#scale`, which are also the six `TIMELINE_SCALES` the
 * gantt renderer accepts. Mirrors `TimelineScale` in `../data-display.ts`.
 *
 * Deliberately NOT exported: every exported const in this directory has to be
 * registered in `zod-mirror-parity.test.ts`'s `MIRRORS` or `EXCLUSIONS`, and a
 * shared inline enum is not a mirror of any declaration — it is spelling reuse
 * between the two keys below.
 */
const TimelineScaleSchema = z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']);

/**
 * One element of `TimelineSchema.items` — a feed item, or a gantt ROW when
 * `variant` is `gantt` (objectui#7164, maintainer ruling 2026-09-02 A+).
 *
 * ## What this refuses, and why it is declared at all
 *
 * The mirror used to declare `items: z.array(z.any())`, which accepted a `null`
 * element and any element value. `TimelineRenderer`'s gantt branch then read
 * `row.items` bare, so `items: [null]` and `items: [{ items: 5 }]` — ordinary
 * JSON, green through `validate` — crashed the render with a `TypeError`. The
 * ruling put a door at both ends: the renderer refuses those shapes through
 * `timeline.gantt.unusableRange.malformedRow`, and this schema refuses them
 * HERE, before a renderer is ever reached:
 *
 *   - an element that is not an object — `null`, a number, a string, an array —
 *     is refused (`z.object` refuses every one of those);
 *   - `items` on a row, when present, has to be an array. `.optional()` is
 *     deliberate: a row with no bars yet is the same ordinary empty state
 *     objectui#6750 ruled for `items: []`, and the renderer draws it.
 *
 * Nothing else is narrowed. The two element shapes (`{ time, title, … }` for a
 * feed, `{ label, items: [{ title, startDate, endDate }] }` for a gantt row) are
 * discriminated by `variant` and read dynamically by the renderer, so the
 * element stays `.passthrough()` and the bars stay `z.any()` — a feed item
 * carries no `items` key and parses green here unchanged. Measured before the
 * narrowing: every in-repo `type: 'timeline'` fixture (the three schema-catalog
 * documents, the docs page's examples, `examples/data-display-examples.json`)
 * parses green on both sides of it.
 *
 * Deliberately NOT exported, for the reason `TimelineScaleSchema` above gives:
 * every exported const here has to be registered in `zod-mirror-parity.test.ts`,
 * and the TS twin declares no separate row interface to pair it with — its
 * `items?: any[]` docblock carries both shapes in prose. Pinned by
 * `../__tests__/timeline-items-row-shape-7164.test.ts`.
 */
const TimelineRowSchema = z
  .object({
    items: z.array(z.any()).optional().describe('A gantt row\'s bars — an array when present'),
  })
  .passthrough();

/**
 * Timeline Schema - Timeline component
 *
 * Mirrors `TimelineSchema` in `../data-display.ts`, which objectui#6170 aligned
 * to the key set `TimelineRenderer` actually reads (maintainer ruling
 * 2026-08-25). `zod-mirror-parity.test.ts` pins the two together: a key
 * declared there and absent here is `UnmirroredDeclaredKeys` and reddens the
 * pair, so the nine presentational keys below are not optional to carry.
 *
 * `events` / `orientation` / `position` stay declared and stay mirrored: they
 * have zero read points, but removing them is a breaking narrowing routed
 * through ADR-0049 rather than done here. `events` follows the declaration from
 * required to OPTIONAL — strictly more input parses than before.
 *
 * `timeScale` is RETIRED (objectui#6355) and carries the
 * `retirementTombstone()` spelling below (objectui#6931) — still mirrored,
 * deliberately, because the parity ratchet compares key SETS and because a
 * tombstone must be present on both halves to be audible.
 */
export const TimelineSchema = BaseSchema.extend({
  type: z.literal('timeline'),
  variant: z.enum(['vertical', 'horizontal', 'gantt']).optional().describe('Layout variant'),
  items: z.array(TimelineRowSchema).optional().describe('Rows to draw — feed items, or gantt rows when variant is gantt; every element an object, and a gantt row\'s own `items` an array when present'),
  dateFormat: z.enum(['short', 'long', 'iso']).optional().describe('How item dates are rendered'),
  scale: TimelineScaleSchema.optional().describe('Gantt axis bucket size (canonical spelling — the spec key)'),
  // RETIRED (objectui#6355, ruling 2026-08-27): the pre-spec alias for `scale`.
  // The TS twin (`../data-display.ts`) types it `?: never`; here any authored
  // value is a loud parse rejection (absent stays valid), mirroring how
  // `@objectstack/spec` retires keys and how `crud.zod.ts` retires `confirm`.
  // NOT deletable: `BaseSchema` is `.passthrough()`, so dropping the key would
  // let the retired spelling parse green while the renderer no longer reads it
  // — a silent revert to the `month` default, which is the whole failure this
  // retirement exists to make audible. One axis spelling: `scale` above.
  timeScale: retirementTombstone('RETIRED (objectui#6355) — author scale instead'),
  rowLabel: z.string().optional().describe('Header label above the gantt row-label gutter'),
  minDate: z.string().optional().describe('Override the auto-calculated gantt axis start (YYYY-MM-DD)'),
  maxDate: z.string().optional().describe('Override the auto-calculated gantt axis end (YYYY-MM-DD)'),
  events: z.array(TimelineEventSchema).optional().describe('DEPRECATED — zero read points; renders an empty rail. Use items'),
  orientation: z.enum(['vertical', 'horizontal']).optional().describe('DEPRECATED — zero read points. Use variant'),
  position: z.enum(['left', 'right', 'alternate']).optional().describe('DEPRECATED — zero read points'),
});

/**
 * Keyboard Key Schema - Keyboard key display
 */
export const KbdSchema = BaseSchema.extend({
  type: z.literal('kbd'),
  label: z.string().optional().describe('Key label'),
  keys: z.union([z.string(), z.array(z.string())]).optional().describe('Key(s) to display'),
});

/**
 * HTML Schema - Raw HTML renderer
 */
export const HtmlSchema = BaseSchema.extend({
  type: z.literal('html'),
  html: z.string().describe('HTML content'),
});

/**
 * Data Display Schema Union - All data display component schemas
 */
/**
 * Bar Chart Schema — mirrors `BarChartSchema` in `../data-display.ts`.
 *
 * Closes half of objectui#6318's bucket B: `bar-chart` is a REGISTERED
 * component that no union member modelled, so `safeValidateSchema` refused
 * every document naming it and `objectui check` could only report it. Every key
 * here is one `ChartBarRenderer` demonstrably reads
 * (`plugin-charts/src/ChartRenderer.tsx:28-38`); nothing is admitted on the
 * strength of what a bar chart "should" accept.
 *
 * All five are OPTIONAL, deliberately. `data` is the one the registration marks
 * `required: true` in its authoring `inputs`, but the renderer reads it as
 * `schema.data` with no guard and the implementation defaults an absent array —
 * so requiring it here would refuse a document the renderer draws. An authoring
 * hint and a validation floor are different claims; only the second belongs in
 * a schema.
 */
export const BarChartSchema = BaseSchema.extend({
  type: z.literal('bar-chart'),
  data: z.array(z.record(z.string(), z.any())).optional().describe('Rows to plot; one bar per row'),
  dataKey: z.string().optional().describe('Row key holding the bar value (y axis)'),
  xAxisKey: z.string().optional().describe('Row key holding the bar category (x axis)'),
  height: z.number().optional().describe('Chart height in pixels'),
  color: z.string().optional().describe('Bar fill colour'),
});

export const DataDisplaySchema = z.discriminatedUnion('type', [
  AlertSchema,
  StatisticSchema,
  BadgeSchema,
  AvatarSchema,
  ListSchema,
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeViewSchema,
  ChartSchema,
  TimelineSchema,
  KbdSchema,
  HtmlSchema,
  BarChartSchema,
]);
