/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Data Display Component Schemas
 * 
 * Type definitions for components that display data and information.
 * 
 * @module data-display
 * @packageDocumentation
 */

import type { ChartType as SpecChartType } from '@objectstack/spec/ui';
import type { BaseSchema, SchemaNode } from './base.js';

/**
 * Alert component
 */
export interface AlertSchema extends BaseSchema {
  type: 'alert';
  /**
   * Alert title
   */
  title?: string;
  /**
   * Alert description/message
   */
  description?: string;
  /**
   * Alert variant
   * @default 'default'
   */
  variant?: 'default' | 'destructive';
  /**
   * Alert icon
   */
  icon?: string;
  /**
   * Whether alert is dismissible
   */
  dismissible?: boolean;
  /**
   * Dismiss handler
   */
  onDismiss?: () => void;
  /**
   * Child content
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Statistic component for dashboards
 */
export interface StatisticSchema extends BaseSchema {
  type: 'statistic';
  /**
   * The label/title of the statistic (e.g. "Total Revenue")
   */
  label?: string;
  /**
   * The main value (e.g. "$45,231.89")
   */
  value: string | number;
  /**
   * Optional trend indicator
   */
  trend?: 'up' | 'down' | 'neutral';
  /**
   * Additional description (e.g. "+20.1% from last month")
   */
  description?: string;
  /**
    * Optional icon name
    */
  icon?: string;
}

/**
 * Badge component
 */
export interface BadgeSchema extends BaseSchema {
  type: 'badge';
  /**
   * Badge text
   */
  label?: string;
  /**
   * Badge variant
   * @default 'default'
   */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  /**
   * Badge icon
   */
  icon?: string;
  /**
   * Child content
   */
  children?: SchemaNode | SchemaNode[];
}

/**
 * Avatar component
 */
export interface AvatarSchema extends BaseSchema {
  type: 'avatar';
  /**
   * Image source URL
   */
  src?: string;
  /**
   * Alt text
   */
  alt?: string;
  /**
   * Fallback text (initials)
   */
  fallback?: string;
  /**
   * Avatar size
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg' | 'xl';
  /**
   * Avatar shape
   * @default 'circle'
   */
  shape?: 'circle' | 'square';
}

/**
 * List component
 */
export interface ListSchema extends BaseSchema {
  type: 'list';
  /**
   * List items
   */
  items: ListItem[];
  /**
   * Whether list is ordered
   * @default false
   */
  ordered?: boolean;
  /**
   * List item dividers
   * @default false
   */
  dividers?: boolean;
  /**
   * Dense/compact layout
   * @default false
   */
  dense?: boolean;
}

/**
 * List item
 */
export interface ListItem {
  /**
   * Unique item identifier
   */
  id?: string;
  /**
   * Item label/title
   */
  label?: string;
  /**
   * Item description
   */
  description?: string;
  /**
   * Item icon
   */
  icon?: string;
  /**
   * Item avatar image
   */
  avatar?: string;
  /**
   * Whether item is disabled
   */
  disabled?: boolean;
  /**
   * Click handler
   */
  onClick?: () => void;
  /**
   * Item content (schema nodes)
   */
  content?: SchemaNode | SchemaNode[];
}

/**
 * One key of a table's sort order.
 *
 * Structurally the id-less half of `SortItem` in `@object-ui/components` (whose
 * `id` exists only as a React key for the sort-builder rows), so a `SortItem[]`
 * is assignable here without conversion. This package takes no dependencies, so
 * the shared shape is declared rather than imported.
 */
export interface TableSortItem {
  /** Field to sort by — an `accessorKey` of the table's columns. */
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Every `type` spelling a `TableColumn` may carry — the canonical value set for
 * this key (objectui#5853, maintainer ruling 2026-08-25, Option B: the 8-literal
 * interface union is canonical).
 *
 * This tuple is the SINGLE declaration of that vocabulary. `TableColumnSchema`
 * in `zod/data-display.zod.ts` builds its `z.enum` from this array rather than
 * restating the members, so the interface and the validator cannot drift apart
 * the way they had (the interface declared these 8; the mirror was a bare
 * `z.string()` that blessed `type: 'money'` and any other typo).
 */
export const TABLE_COLUMN_TYPES = [
  'text', 'number', 'date', 'datetime', 'currency', 'percent', 'boolean', 'action',
] as const;

/** Data type a table column is formatted/edited as. */
export type TableColumnType = (typeof TABLE_COLUMN_TYPES)[number];

/**
 * Undeclared `type` spellings the data-table renderer used to read, folded onto
 * the canonical spelling they mean (objectui#5853).
 *
 * These are NOT part of the published vocabulary and deliberately do not appear
 * in {@link TABLE_COLUMN_TYPES}: the ruling rejected alias proliferation, so the
 * renderer's extra dialect DISAPPEARS at the producer seam instead of getting
 * declared. `int` / `integer` / `float` / `double` were members of the
 * data-table's `NUMERIC_EDIT_TYPES`; `datetime-local` had its own editor branch.
 * Same treatment, and the same wording, as the param-type dialect documented at
 * {@link ObjectUiLocalParamFieldType} in `ui-action.ts` (`datetime-local` →
 * `datetime` there too).
 *
 * Authoring one of these is refused by `TableColumnSchema` — the fold exists for
 * VALUES IN FLIGHT from a column-inference producer, not for authored metadata.
 */
const TABLE_COLUMN_TYPE_ALIASES: Readonly<Record<string, TableColumnType>> = {
  int: 'number',
  integer: 'number',
  float: 'number',
  double: 'number',
  'datetime-local': 'datetime',
};

/**
 * Fold an inferred column type onto the canonical {@link TableColumnType}
 * vocabulary, for use at a producer's emit seam (objectui#5853).
 *
 * Column inference reads an OBJECT SCHEMA's field type, whose vocabulary is
 * `@objectstack/spec`'s `FieldType` — 49 values, only 7 of which are members of
 * this union. Forwarding that verbatim into `TableColumn.type` is what made the
 * declaration a lie and forced an `as any` cast in the renderer. Producers call
 * this at the point they hand columns to `data-table`, so the slot only ever
 * holds a value it declares.
 *
 * Three outcomes, and the third is the load-bearing one:
 *
 * - a canonical spelling passes through unchanged;
 * - a known alias folds onto its canonical spelling (`int` → `number`);
 * - ⭐ ANYTHING ELSE yields `undefined` — the `type` ANNOTATION is dropped, and
 *   the COLUMN IS NEVER DROPPED. This is the general case, and it is where the
 *   42 out-of-union spec field types (`select`, `lookup`, `user`, `file`,
 *   `formula`, …) land. Dropping the annotation is behaviour-preserving at the
 *   only consumer that reads this key: `data-table`'s inline editor branches on
 *   `date` / `datetime` / the numeric set and otherwise falls through to a text
 *   input — which is exactly the `undefined` path. The dedicated widget those
 *   fields DO get is chosen by the host's `renderCellEditor`, which resolves the
 *   field through `column.accessorKey` and never reads `type`. Mapping them to
 *   `'text'` instead would assert something false about a `lookup` column;
 *   absence says only what is true — this column's type is not one of the 8.
 */
export function normalizeTableColumnType(value: unknown): TableColumnType | undefined {
  if (typeof value !== 'string') return undefined;
  if ((TABLE_COLUMN_TYPES as readonly string[]).includes(value)) return value as TableColumnType;
  return TABLE_COLUMN_TYPE_ALIASES[value];
}

/**
 * Table column definition
 */
export interface TableColumn {
  /**
   * Column header text
   */
  header: string;
  /**
   * Key to access data in row object
   */
  accessorKey: string;
  /**
   * Header CSS class
   */
  className?: string;
  /**
   * Cell CSS class
   */
  cellClassName?: string;
  /**
   * Column width
   */
  width?: string | number;
  /**
   * Column minimum width
   */
  minWidth?: string | number;
  /**
   * Text alignment
   * @default 'left'
   */
  align?: 'left' | 'center' | 'right';
  /**
   * Pin column to side
   */
  fixed?: 'left' | 'right';
  /**
   * Data type for formatting
   */
  type?: TableColumnType;
  /**
   * Whether column is sortable
   * @default true
   */
  sortable?: boolean;
  /**
   * Whether column is filterable
   * @default true
   */
  filterable?: boolean;
  /**
   * Whether column is resizable
   * @default true
   */
  resizable?: boolean;
  /**
   * Whether column is editable (for inline editing)
   * @default true
   */
  editable?: boolean;
  /**
   * Custom cell renderer function
   */
  cell?: (value: any, row: any) => any;
  /**
   * Icon node rendered into the header cell, before the header text (e.g. the
   * column-type icons `ObjectGrid` writes under `showColumnTypeIcons`). A
   * rendered React node — a runtime slot like {@link TableColumn.cell}, not
   * serializable metadata.
   *
   * Declared by objectui#6424 (maintainer ruling 2026-08-27): `data-table`
   * rendered this key while the declaration refused it, so a typed author got
   * a compile error — and a silent strip from the zod mirror — for a key the
   * renderer honours. The declaration, the parse road, and the renderer's
   * behaviour now agree; the renderer's internal column reads remain
   * any-mediated (the `col: any` normalization in `data-table.tsx`) — a
   * standing instrument gap, not closed here.
   */
  headerIcon?: React.ReactNode;
  /**
   * Field-meta override: display format pattern for the cell value (e.g.
   * `"$0,0"`, `"0%"`, `"YYYY-MM-DD"`), honoured by `object-data-table`'s cell
   * pipeline — `renderFieldValue`'s currency / percent / date branches — and
   * by the numeric right-alignment inference. Documented as an author
   * override by `@object-ui/plugin-dashboard`'s README and exercised by its
   * cells suite. The plain `data-table` renderer does not read it; its
   * type-driven rendering is {@link TableColumn.type} / `cell`.
   *
   * Declared by objectui#6425 (maintainer ruling 2026-08-27, per-key): the
   * widget honoured this key while the declaration refused it, so a typed
   * author got a compile error — and a silent strip from the zod mirror —
   * for documented, tested behaviour. Declaring is truth-maintenance.
   */
  format?: string;
  /**
   * Field-meta override: option list for select-flavoured columns — `value`
   * matched against the cell value, `label` rendered, `color` driving the
   * badge/dot appearance. Honoured by `object-data-table`'s cell pipeline
   * (`SelectCellRenderer`, after the per-option translation pass) ahead of
   * the object schema's own options; documented as an author override by
   * `@object-ui/plugin-dashboard`'s README. The plain `data-table` renderer
   * does not read it.
   *
   * Declared by objectui#6425 (maintainer ruling 2026-08-27, per-key), same
   * stroke as {@link TableColumn.format}.
   */
  options?: Array<{ value: any; label: string; color?: string }>;
  /**
   * Field-meta override: ISO 4217 currency code (e.g. `"EUR"`) for
   * currency-formatted cells, honoured by `object-data-table`'s cell
   * pipeline (`renderFieldValue` and `CurrencyCellRenderer`) ahead of both
   * the symbol inferred from {@link TableColumn.format} and the tenant
   * default currency (ADR-0053). The plain `data-table` renderer does not
   * read it.
   *
   * Declared by objectui#6425 (maintainer ruling 2026-08-27, per-key): kept
   * in production but never promised before — declaring makes the existing
   * behaviour honest.
   */
  currency?: string;
}

/**
 * Column definition for the STATIC `table` renderer (`type: 'table'`) — the
 * narrow declared subset that renderer actually reads, so declared = enforced
 * holds per renderer (objectui#5474, maintainer ruling 2026-08-22, Option C:
 * split the types).
 *
 * {@link TableColumn} above remains the rich shared shape that `data-table`
 * honours (`DataTableSchema`, detail-view relations) — it is
 * deliberately NOT narrowed. The static renderer
 * (`packages/components/src/renderers/complex/table.tsx`) reads exactly five
 * column keys: `header`, `accessorKey`, `className`, `cellClassName`, `width`
 * (measured on objectui#5474; every other key was accepted, type-checked, and
 * did nothing, with no diagnostic).
 *
 * The `?: never` members are ADR-0049 retirement tombstones — this package's
 * convention (see `crud.ts` `confirm` and `complex.ts` `DashboardWidgetSchema`):
 * authoring one is a tsc error here and a loud parse rejection in the Zod twin
 * (`zod/data-display.zod.ts` `StaticTableColumnSchema`). Implementing the keys
 * on this renderer instead (Option A) was considered and NOT chosen — it would
 * duplicate `data-table`'s capabilities and leave two interactive tables to
 * maintain. Authors who need the interactive set migrate the node to
 * `type: 'data-table'`, whose columns keep the rich {@link TableColumn}.
 */
export interface StaticTableColumn {
  /**
   * Column header text
   */
  header: string;
  /**
   * Key to access data in row object
   */
  accessorKey: string;
  /**
   * Header CSS class
   */
  className?: string;
  /**
   * Cell CSS class
   */
  cellClassName?: string;
  /**
   * Column width
   */
  width?: string | number;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Use `data-table` for the interactive set.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  minWidth?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it; a right-aligned column authored here was
   * silently inert. Use `data-table`, or a Tailwind `cellClassName` such as
   * `text-right`, which this renderer does honour.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  align?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Use `data-table` for the interactive set.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  fixed?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Use `data-table` for the interactive set.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  type?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Sorting is `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  sortable?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Filtering is `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  filterable?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Resizing is `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  resizable?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Inline editing is `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  editable?: never;
  /**
   * RETIRED from the static `table` surface (objectui#5474, ADR-0049) — the
   * static renderer never read it. Custom cells are `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  cell?: never;
  /**
   * NOT on the static `table` surface (objectui#6424, under #5474's lockstep
   * rule: every rich key needs a deliberate static-side decision). Declared on
   * the rich {@link TableColumn} only — the static renderer never read it.
   * Header icons are `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  headerIcon?: never;
  /**
   * NOT on the static `table` surface (objectui#6425, under #5474's lockstep
   * rule: every rich key needs a deliberate static-side decision). Declared
   * on the rich {@link TableColumn} only — the static renderer reads no
   * field-meta overrides (its measured read set is the five live keys above).
   * Formatted cells are `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  format?: never;
  /**
   * NOT on the static `table` surface (objectui#6425, under #5474's lockstep
   * rule). Declared on the rich {@link TableColumn} only — the static
   * renderer reads no field-meta overrides. Select badges are `data-table`'s
   * capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  options?: never;
  /**
   * NOT on the static `table` surface (objectui#6425, under #5474's lockstep
   * rule). Declared on the rich {@link TableColumn} only — the static
   * renderer reads no field-meta overrides. Currency cells are
   * `data-table`'s capability.
   * @deprecated Not part of the static `table` renderer's contract.
   */
  currency?: never;
}

/**
 * Simple STATIC table component — renders inline `data` against `columns`,
 * nothing more. For hover/stripe styling, sorting, filtering, selection or
 * inline editing use `data-table` ({@link DataTableSchema}).
 */
export interface TableSchema extends BaseSchema {
  type: 'table';
  /**
   * Table caption
   */
  caption?: string;
  /**
   * Table columns — the narrow static subset ({@link StaticTableColumn}),
   * split from the rich shared {@link TableColumn} by objectui#5474 so
   * declared = enforced holds per renderer.
   */
  columns: StaticTableColumn[];
  /**
   * Table data rows
   */
  data: any[];
  /**
   * Table footer content
   */
  footer?: SchemaNode | SchemaNode[] | string;
  /**
   * RETIRED (objectui#5474, maintainer ruling 2026-08-22, ADR-0049
   * enforce-or-remove): the static renderer never implemented row hover
   * highlighting — the key carried a `@default true` annotation describing
   * behaviour that did not exist, and the reference page taught it as working.
   * `?: never` is this package's tombstone convention (see `crud.ts`
   * `confirm`): authoring the key is a tsc error here and a loud parse
   * rejection in the Zod twin. Row hover styling is `data-table` behaviour —
   * migrate the node to `type: 'data-table'`.
   * @deprecated Retired — use `data-table` for interactive row affordances.
   */
  hoverable?: never;
  /**
   * RETIRED (objectui#5474, maintainer ruling 2026-08-22, ADR-0049
   * enforce-or-remove): the static renderer never implemented striped rows —
   * same tombstone as `hoverable` above. Alternate-row styling can be
   * expressed today with Tailwind on `className`
   * (e.g. `[&_tbody_tr:nth-child(even)]:bg-muted/50`), which this renderer
   * does honour.
   * @deprecated Retired — style rows via `className`, or use `data-table`.
   */
  striped?: never;
}

/**
 * A single extra per-row action rendered in the data-table's row overflow
 * menu (after Edit/Delete). Used to surface an object's own row actions in
 * embedded tables — e.g. a detail page's related list showing the child
 * object's `list_item` actions. The host pre-localizes `label`/`confirmText`
 * and executes the action via {@link DataTableSchema.onRowActionDef}.
 */
export interface DataTableRowAction {
  /** Stable action name. */
  name: string;
  /** Display label (already localized). */
  label?: string;
  /** Lucide icon name (kebab-case). */
  icon?: string;
  /** `'danger'` renders the item in the destructive color. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  /** Confirmation prompt shown before the action runs. */
  confirmText?: string;
  /** Remaining action metadata is preserved for the host executor. */
  [k: string]: unknown;
}

/**
 * Enterprise data table with advanced features
 */
export interface DataTableSchema extends BaseSchema {
  type: 'data-table';
  /**
   * Render the table without its outer rounded border. Useful when the
   * table is embedded inside a parent container that already provides
   * visual framing (e.g. grouped rows, sub-tables).
   * @default false
   */
  borderless?: boolean;
  /**
   * Drop the table's own horizontal/vertical scroll container so the table
   * overflows into a shared parent scroll container instead. Used by the
   * grouped grid so every per-group sub-table participates in ONE shared
   * horizontal scrollbar (and keeps columns aligned) rather than each group
   * scrolling independently.
   * @default false
   */
  disableInnerScroll?: boolean;
  /**
   * Table caption
   */
  caption?: string;
  /**
   * Table toolbar actions/content
   */
  toolbar?: SchemaNode[];
  /**
   * Table columns
   */
  columns: TableColumn[];
  /**
   * Table data rows
   */
  data: any[];
  /**
   * Enable pagination
   * @default true
   */
  pagination?: boolean;
  /**
   * Rows per page
   * @default 10
   */
  pageSize?: number;
  /**
   * Options offered in the "rows per page" selector. When omitted the table
   * falls back to its built-in list (5/10/20/50/100). The current `pageSize`
   * is always merged in so the selector can show the active value even if it
   * is not one of the configured options.
   */
  pageSizeOptions?: number[];
  /**
   * Server-side ("manual") pagination. When true, `data` is treated as the
   * already-fetched current page (not sliced locally), `rowCount` provides the
   * total match count used to compute total pages, the current page is
   * controlled via `page`, and page/size changes are reported through
   * `onPageChange` / `onPageSizeChange` so the caller can re-fetch. Without it
   * the table paginates the in-memory `data` client-side (legacy behavior).
   * @default false
   */
  manualPagination?: boolean;
  /**
   * Total number of rows matching the query on the server. Only used when
   * `manualPagination` is true — drives the total-page count.
   */
  rowCount?: number;
  /**
   * Controlled current page (1-based) for `manualPagination`.
   */
  page?: number;
  /**
   * Called when the user navigates to another page under `manualPagination`.
   */
  onPageChange?: (page: number) => void;
  /**
   * Called when the user changes the page size under `manualPagination`.
   */
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * Server-side ("manual") sorting. When true the table does NOT sort `data`
   * locally — it is already in the order the server returned — and a column
   * header click reports the requested sort through `onSortChange` instead.
   *
   * Set this whenever `data` is one window of a larger collection. Sorting a
   * window locally orders **that page**, which reads on screen as "the list is
   * sorted by this column" and is not (objectui#3106).
   *
   * Deliberately independent of `manualPagination`: a windowed related list
   * paginates itself (`pagination: false`) while its rows still come from the
   * server one page at a time.
   *
   * The table keeps NO sort state of its own in this mode — `sort` is the only
   * source of truth, and the header renders and cycles that. A private copy
   * alongside a controlled prop is how the original defect arose.
   * @default false
   */
  manualSorting?: boolean;
  /**
   * The active sort, when `manualSorting` is on. Drives the header indicators
   * and is the value each header click transforms. Ignored otherwise (the table
   * owns its sort in client mode).
   */
  sort?: TableSortItem[];
  /**
   * Called with the sort a header click asks for, when `manualSorting` is on.
   *
   * Always exactly one key: a header click REPLACES the order rather than
   * appending to it, so the column under the cursor is the one the list is
   * sorted by. Multi-key sorts come from a host's own sort builder, and the
   * header renders them (numbered) without being able to produce one.
   *
   * Never empty. In client mode the third click clears the sort, which is
   * meaningful there — the rows return to the order they arrived in. Against a
   * server-paged collection there is no such order to return to: an unsorted
   * paged read is arbitrary per page (objectstack#4363), so offering it from a
   * header would hand the user a worse lie than the one being fixed. Removing
   * a sort entirely stays with the host's sort builder.
   *
   * Without this callback the headers render inert (no cursor, no icons) rather
   * than accepting clicks that go nowhere.
   */
  onSortChange?: (sort: TableSortItem[]) => void;
  /**
   * Enable search
   * @default true
   */
  searchable?: boolean;
  /**
   * Server-side ("manual") search. When true the table does NOT filter `data`
   * locally — it is already the result the server produced for the whole
   * collection — and typing in the search box reports the term through
   * `onSearchChange` instead.
   *
   * Set this whenever `data` is one window of a larger collection. Filtering a
   * window locally searches **that page**, which reads on screen as "2 results
   * in this list" while every row outside the window never participated
   * (objectui#3118). It is the filter-axis twin of `manualSorting`, and tied to
   * the same question: is `data` a window, or the collection?
   *
   * The table keeps NO search state of its own in this mode — `search` is the
   * only source of truth, and the box renders that. A private copy alongside a
   * controlled prop is how the original defect arose.
   * @default false
   */
  manualSearch?: boolean;
  /**
   * The active search term, when `manualSearch` is on. Drives the search box's
   * value and is what the host turned into a server `$search` (ADR-0061: the
   * client sends the term, the server resolves which fields it matches from the
   * object's metadata). Ignored otherwise (the table owns its term in client
   * mode).
   */
  search?: string;
  /**
   * Called with the term the user typed, when `manualSearch` is on. The host is
   * expected to re-read the collection with it and return to page 1 — a new
   * term makes the old page index a different set of rows.
   *
   * Without this callback the search box is not rendered at all under
   * `manualSearch`. A box that filters nothing is the same class of lie as one
   * that filters only the page you can see, and there is no honest local
   * fallback: the rows to search are not in the browser.
   */
  onSearchChange?: (search: string) => void;
  /**
   * Enable row selection
   * - boolean: Enable/disable selection (true = multiple selection)
   * - 'single': Single row selection
   * - 'multiple': Multiple row selection
   * @default false
   */
  selectable?: boolean | 'single' | 'multiple';
  /**
   * Selection checkbox display style
   * - 'always': Checkboxes are always visible
   * - 'hover': Checkboxes only appear on row hover
   * @default 'always'
   */
  selectionStyle?: 'always' | 'hover';
  /**
   * Whether to render the built-in "N selected" count in the table toolbar.
   * Set false when an outer container (e.g. ObjectGrid's BulkActionBar) already
   * surfaces the selection, to avoid a duplicate — and otherwise orphaned —
   * toolbar row.
   * @default true
   */
  showSelectionCount?: boolean;
  /**
   * Enable column sorting
   * @default true
   */
  sortable?: boolean;
  /**
   * Enable CSV export
   * @default false
   */
  exportable?: boolean;
  /**
   * Show row actions (edit/delete)
   * @default false
   */
  rowActions?: boolean;
  /**
   * Enable column resizing
   * @default true
   */
  resizableColumns?: boolean;
  /**
   * Enable column reordering
   * @default true
   */
  reorderableColumns?: boolean;
  /**
   * Row edit handler
   */
  onRowEdit?: (row: any) => void;
  /**
   * Row delete handler
   */
  onRowDelete?: (row: any) => void;
  /**
   * Per-record CEL predicates gating the built-in row Edit item
   * (objectui#2614), from the object's `userActions.edit` object form.
   * `visibleWhen` false → the item is not rendered for that row (fail-closed);
   * `disabledWhen` true → rendered disabled (fail-soft). Bare CEL string or
   * `{ dialect: 'cel', source }` envelope, evaluated per row with the record
   * bound as `record.*` and bare fields.
   */
  rowEditPredicates?: { visibleWhen?: unknown; disabledWhen?: unknown };
  /**
   * Per-record CEL predicates gating the built-in row Delete item
   * (objectui#2614), from the object's `userActions.delete` object form.
   */
  rowDeletePredicates?: { visibleWhen?: unknown; disabledWhen?: unknown };
  /**
   * Extra per-row action definitions rendered in the row overflow menu, after
   * Edit/Delete. Each is dispatched via {@link onRowActionDef} with the clicked
   * row. Surfaces an object's own row actions in embedded tables (e.g. a detail
   * page's related list). Requires {@link rowActions} to be enabled.
   */
  rowActionDefs?: DataTableRowAction[];
  /**
   * Handler invoked when one of {@link rowActionDefs} is chosen from the row
   * overflow menu.
   */
  onRowActionDef?: (action: DataTableRowAction, row: any) => void | Promise<void>;
  /**
   * Selection change handler
   */
  onSelectionChange?: (selectedRows: any[]) => void;
  /**
   * Bump this value to imperatively clear the table's internal row selection.
   * The table clears its checkbox selection whenever the key changes to a new
   * value. Lets a host (e.g. a grid clearing selection after a bulk action)
   * reset the checkboxes, which are otherwise internal table state.
   */
  selectionResetKey?: string | number;
  /**
   * Columns reorder handler
   */
  onColumnsReorder?: (columns: TableColumn[]) => void;
  /**
   * Enable inline cell editing
   * When true, cells become editable on double-click or Enter key
   * @default false
   */
  editable?: boolean;
  /**
   * Enable single-click editing mode
   * When true with editable, clicking a cell enters edit mode (instead of double-click)
   * @default false
   */
  singleClickEdit?: boolean;
  /**
   * Cell value change handler
   * Called when a cell value is edited
   */
  onCellChange?: (rowIndex: number, columnKey: string, newValue: any, row: any) => void;
  /**
   * Row save handler
   * Called when saving changes for a single row
   */
  onRowSave?: (rowIndex: number, changes: Record<string, any>, row: any) => void | Promise<void>;
  /**
   * Batch save handler
   * Called when saving changes for multiple rows
   */
  onBatchSave?: (changes: Array<{ rowIndex: number; changes: Record<string, any>; row: any }>) => void | Promise<void>;
  /**
   * Row click handler
   * Called when a row is clicked
   */
  onRowClick?: (row: any) => void;
  /**
   * Dynamic row class name
   * Function that returns a CSS class string for each row
   */
  rowClassName?: (row: any, index: number) => string | undefined;
  /**
   * Dynamic row inline style
   * Function that returns CSSProperties for each row (e.g., from conditionalFormatting).
   */
  rowStyle?: (row: any, index: number) => React.CSSProperties | undefined;
  /**
   * Number of columns to freeze (left-pin)
   * When set, the first N columns remain fixed while the rest scroll horizontally.
   * @default 0
   */
  frozenColumns?: number;
  /**
   * Show row numbers in the first column (Airtable-style)
   * @default false
   */
  showRowNumbers?: boolean;
  /**
   * Show "+ Add record" row at the bottom of the table (Airtable-style)
   * @default false
   */
  showAddRow?: boolean;
  /**
   * Optional schema node rendered inside the empty-state, e.g. an
   * "Add record" button. Lets the empty state become an actionable
   * invitation rather than a dead end.
   */
  emptyAction?: SchemaNode;
  /**
   * Callback when the "+ Add record" row is clicked
   */
  onAddRecord?: () => void;
  /**
   * Column resize handler
   * Called when a column is resized
   */
  onColumnResize?: (columnKey: string, width: number) => void;
  /**
   * Column reorder handler (new order of accessorKeys)
   * Called when columns are reordered via drag-and-drop
   */
  onColumnReorder?: (newOrder: string[]) => void;
}

/**
 * Markdown renderer component
 */
export interface MarkdownSchema extends BaseSchema {
  type: 'markdown';
  /**
   * Markdown content
   */
  content: string;
  /**
   * Whether to sanitize HTML
   * @default true
   */
  sanitize?: boolean;
  /**
   * Custom components for markdown elements
   */
  components?: Record<string, any>;
}

/**
 * Tree view node
 */
export interface TreeNode {
  /**
   * Unique node identifier
   */
  id: string;
  /**
   * Node label
   */
  label: string;
  /**
   * Node icon
   */
  icon?: string;
  /**
   * Whether node is expanded by default
   * @default false
   */
  defaultExpanded?: boolean;
  /**
   * Whether node is selectable
   * @default true
   */
  selectable?: boolean;
  /**
   * Child nodes
   */
  children?: TreeNode[];
  /**
   * Additional data
   */
  data?: any;
}

/**
 * Tree view component
 */
export interface TreeViewSchema extends BaseSchema {
  type: 'tree-view';
  /**
   * Tree data
   */
  data: TreeNode[];
  /**
   * Default expanded node IDs
   */
  defaultExpandedIds?: string[];
  /**
   * Default selected node IDs
   */
  defaultSelectedIds?: string[];
  /**
   * Controlled expanded node IDs
   */
  expandedIds?: string[];
  /**
   * Controlled selected node IDs
   */
  selectedIds?: string[];
  /**
   * Enable multi-selection
   * @default false
   */
  multiSelect?: boolean;
  /**
   * Show lines connecting nodes
   * @default true
   */
  showLines?: boolean;
  /**
   * Node select handler
   */
  onSelectChange?: (selectedIds: string[]) => void;
  /**
   * Node expand handler
   */
  onExpandChange?: (expandedIds: string[]) => void;
}

/**
 * Chart type
 */
/**
 * Chart Type — `@objectstack/spec`'s own `ChartType` re-exported (issue
 * #2231/#2901; formerly a hand-written union that had drifted to 7 of 19 values).
 *
 * Re-exported rather than restated, so a chart family the spec adds cannot go
 * missing here.
 */
export type ChartType = SpecChartType;

/**
 * One inline-data series of the objectui `ChartSchema` node — a display name
 * plus the literal numbers to plot, positionally aligned with the chart's
 * `categories`.
 *
 * Renamed off `ChartSeries` (objectstack#4115): `@objectstack/spec/ui` owns that
 * name for a **dataset-bound series descriptor** — `{ name, label?, type?,
 * stack?, yAxis, variant?, dashArray?, opacity? }`, where `name` identifies a
 * MEASURE and the values come from the query, so it carries no `data` at all.
 * The two are not mutually assignable in either direction. `@object-ui/plugin-charts`
 * talks to the spec's shape (`ChartSeries.type` per-series family overrides,
 * `ChartSeries.stack`); this one belongs to the static SDUI chart node.
 */
export interface ChartDataSeries {
  /**
   * Series name
   */
  name: string;
  /**
   * Series data points
   */
  data: number[];
  /**
   * Series color
   */
  color?: string;
}

/**
 * Chart component
 */
export interface ChartSchema extends BaseSchema {
  type: 'chart';
  /**
   * Chart type
   */
  chartType: ChartType;
  /**
   * Chart title
   */
  title?: string;
  /**
   * Chart description
   */
  description?: string;
  /**
   * X-axis labels/categories
   */
  categories?: string[];
  /**
   * Data series
   */
  series: ChartDataSeries[];
  /**
   * Chart height
   */
  height?: string | number;
  /**
   * Chart width
   */
  width?: string | number;
  /**
   * Show legend
   * @default true
   */
  showLegend?: boolean;
  /**
   * Show grid
   * @default true
   */
  showGrid?: boolean;
  /**
   * Enable animations
   * @default true
   */
  animate?: boolean;
  /**
   * Chart configuration (library-specific)
   */
  config?: Record<string, any>;
  /**
   * Optional drill-down configuration. When enabled, clicking a chart
   * segment opens a filtered list view (drawer/dialog).
   */
  drillDown?: DrillDownConfig;
}

/**
 * Aggregation function for pivot table values
 */
export type PivotAggregation = 'sum' | 'count' | 'avg' | 'min' | 'max';

/**
 * Declarative drill-down configuration shared by pivot tables and charts.
 *
 * When a user clicks a pivot cell / chart segment, the engine opens a side
 * drawer (default) listing the underlying records filtered by the click
 * context. All values support `${event.*}` interpolation; sensible defaults
 * are derived from the widget's row/column/groupBy fields when omitted.
 *
 * Pivot event payload:  rowKey, colKey, rowLabel, colLabel, value, scope
 * Chart event payload:  category, series, value
 *
 * ## Declared = delivered (objectui#3354)
 *
 * Every key below is read by at least one of the five widgets that share this
 * interface, and `target` is honoured by all of them. Two keys used to break
 * that rule and were removed rather than left as authoring bait:
 *
 *  - `view?: string` — self-described as "reserved"; no renderer ever looked it
 *    up, so the drawer rendered its inline `object-data-table` regardless.
 *  - `sort?: Array<{ field; dir? }>` — documented as "default sort applied to
 *    the drill list"; no widget passed it into the drilled table schema.
 *
 * Do not re-add a key here before a renderer reads it. This type is what the
 * protocol's own `drillDown` declaration is derived from (objectstack#5022), so
 * a dead key here becomes a dead key with protocol authority.
 */
export interface DrillDownConfig {
  /** Master switch. Set to true (or supply any other field) to enable. */
  enabled?: boolean;
  /**
   * Which drill interaction the widget performs:
   *
   * - `'filter'` (default) — **drill-through**: the click point is an
   *   aggregated bucket (pivot cell, chart segment, KPI). The drawer lists
   *   the underlying records filtered by the click context. Used by charts,
   *   pivot tables and metric cards.
   * - `'record'` — **drill-to-record**: the click point already *is* a single
   *   record (a row in a table / list widget). The drawer shows that record's
   *   detail instead of a filtered list. This is the default for table / list
   *   widgets, mirroring Salesforce list-view row → record and Power BI's
   *   "see records" row interaction.
   *
   * When omitted the consuming widget picks the natural default for its type.
   */
  mode?: 'filter' | 'record';
  /**
   * Where the drill-down lands. Defaults to `'drawer'`.
   *
   * - `'drawer'` — in-place side sheet listing the records (peek without
   *   leaving the dashboard). The mainstream default.
   * - `'dialog'` — same content in a centered modal (used when stacking over
   *   another drawer).
   * - `'navigate'` — skip the in-place view and go straight to the object's
   *   full list page (sort / bulk-select / export / shareable URL). Requires a
   *   host that provides drill navigation (see `DrillNavigationContext`); falls
   *   back to `'drawer'` when none is available.
   *
   * Independent of `target`, the in-place drawer also offers an "Open in list →"
   * affordance when a host navigation handler is present, so users can escalate
   * from a peek to the full list at any time.
   */
  target?: 'drawer' | 'dialog' | 'navigate';
  /**
   * Filter applied to the drilled list view. Each value supports
   * `${event.x}` interpolation (e.g. `"${event.rowKey}"`).
   * When omitted, the engine derives a default filter from the widget's
   * row/column/groupBy fields and the click payload.
   */
  filter?: Record<string, unknown>;
  /** Drawer/dialog title. Supports `${event.*}` interpolation. */
  title?: string;
  /**
   * Drill into an analytical Report instead of the raw record list. When
   * provided, the drill-down drawer renders the supplied `SpecReport` (with
   * `widget.filter ∧ report.filter` merged so the metric's scope is honoured).
   *
   * This is the M3 "Dashboard → Report → List → Record" path: the KPI on the
   * dashboard expands into a multi-dimensional breakdown report; the report
   * itself can drill into a list of records (via its own row-click drill),
   * which can drill into a single record.
   *
   * Either an inline `SpecReport` JSON or a named report reference is
   * supported. Implementations may render the named form by resolving it
   * against an app-level report registry.
   *
   * The shape is structural to avoid a circular import with `spec-report.ts`.
   */
  report?:
    | {
        name: string;
        objectName: string;
        type?: 'tabular' | 'summary' | 'matrix' | 'joined';
        columns: Array<unknown>;
        [k: string]: unknown;
      }
    | { name: string };
  /**
   * Optional column whitelist for the inline drill list. When omitted the
   * data table renders all default columns.
   */
  columns?: string[];
  /** Hard cap on rows fetched. */
  maxRows?: number;
}

/**
 * Pivot table (cross-tabulation) component
 *
 * Renders a matrix where rows correspond to one field,
 * columns to another, and cells show an aggregated value.
 */
export interface PivotTableSchema extends BaseSchema {
  type: 'pivot';
  /**
   * Pivot table title
   */
  title?: string;
  /**
   * Field used for row headers
   */
  rowField: string;
  /**
   * Field used for column headers
   */
  columnField: string;
  /**
   * Field whose values are aggregated in cells
   */
  valueField: string;
  /**
   * Aggregation function applied to valueField
   * @default 'sum'
   */
  aggregation?: PivotAggregation;
  /**
   * Source data rows
   */
  data: Record<string, unknown>[];
  /**
   * Show a totals column on the right
   * @default false
   */
  showRowTotals?: boolean;
  /**
   * Show a totals row at the bottom
   * @default false
   */
  showColumnTotals?: boolean;
  /**
   * Numeric format string (e.g. "$,.2f") — applied via simple prefix/suffix/decimals
   */
  format?: string;
  /**
   * Mapping of column header values to Tailwind text-color classes
   */
  columnColors?: Record<string, string>;
  /**
   * Optional drill-down configuration. When enabled, clicking a cell /
   * row header / column header / total opens a filtered list view.
   */
  drillDown?: DrillDownConfig;
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  /**
   * Event unique identifier
   */
  id?: string;
  /**
   * Event title
   */
  title: string;
  /**
   * Event description
   */
  description?: string;
  /**
   * Event date/time
   */
  date: string | Date;
  /**
   * Event icon
   */
  icon?: string;
  /**
   * Event color
   */
  color?: string;
  /**
   * Event content
   */
  content?: SchemaNode | SchemaNode[];
}

/**
 * The axis-bucket vocabulary for the `gantt` variant.
 *
 * One spelling, one source: these are exactly the six values of
 * `@objectstack/spec` `ui/TimelineConfig.json#scale`, and exactly the six
 * `TIMELINE_SCALES` that `packages/plugin-timeline/src/renderer.tsx`
 * (`resolveTimelineScale`) accepts. Declared here so the two agree by
 * construction rather than by coincidence.
 */
export type TimelineScale = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Timeline component (`type: 'timeline'`).
 *
 * ## The members below are the set `TimelineRenderer` actually reads
 *
 * objectui#6170, maintainer ruling 2026-08-25 (「同意」), the same family rule
 * adopted on objectui#6172: **the exported type aligns to the measured
 * authored + read set.** Before that ruling this interface declared `events` /
 * `orientation` / `position` and nothing else, and the divergence was
 * invisible to `tsc` because {@link BaseSchema} carries `[key: string]: any` —
 * every key the renderer reads resolved as `any`, so `schema: TimelineSchema`
 * constrained nothing. (The index signature itself is objectui#5155 /
 * objectui#6269, deliberately not touched here.)
 *
 * Measured on `origin/main` @ `79ebf30d1`: `TimelineRenderer`
 * (`plugin-timeline/src/renderer.tsx:250`) reads NINE keys off this node —
 * `variant`, `items`, `dateFormat`, `onItemClick`, `minDate`, `maxDate`,
 * `rowLabel`, `scale`, `timeScale` — and NONE of `events` / `orientation` /
 * `position`. EIGHT of those nine are declared below; `onItemClick` is not, on
 * purpose — it is a runtime slot `ObjectTimeline` installs when it composes
 * this schema, not authorable metadata, and this package's convention keeps
 * callback-shaped keys off the authored surface (see `RuntimeOnlyDeclared` in
 * `__tests__/zod-mirror-parity.test.ts`). The registration's own `inputs` metadata and
 * `content/docs/plugins/plugin-timeline.mdx`'s property table agreed with the
 * renderer all along; only this type disagreed — including with the docs
 * page's own TypeScript example, which did not compile, because `events` was
 * required and nothing writes it.
 *
 * ## Two timelines, and this is the presentational one
 *
 * `TimelineSchema` describes HOW TO DRAW a rail from items already in hand.
 * The OBJECT-BOUND config — WHICH RECORD FIELDS to project — is
 * `@objectstack/spec`'s `TimelineConfig`, surfaced here as
 * {@link ListViewTimelineConfig} (`startDateField` / `titleField` / …) and
 * consumed by `ObjectTimeline`, which resolves those field names against
 * fetched records and composes the presentational shape below before handing
 * it to `TimelineRenderer`. The two vocabularies are disjoint by design; only
 * `scale` is common to both, deliberately spelled the same in each.
 */
export interface TimelineSchema extends BaseSchema {
  type: 'timeline';
  /**
   * Layout variant. The renderer implements exactly these three and returns
   * `null` for anything else.
   * @default 'vertical'
   */
  variant?: 'vertical' | 'horizontal' | 'gantt';
  /**
   * The rows to draw.
   *
   * TWO element shapes, discriminated by `variant`, both read dynamically by
   * the renderer (`items.map((item: any) => …)`), so the element type is left
   * open rather than narrowed to either one:
   *
   * - `vertical` / `horizontal` — a feed item:
   *   `{ time, title, description?, variant?, icon?, color?, content?, className?, meta?, group? }`
   * - `gantt` — a row:
   *   `{ label, items: [{ title, startDate, endDate, variant? }] }`
   *
   * `content/docs/plugins/plugin-timeline.mdx` carries both in full.
   */
  items?: any[];
  /**
   * How item dates are rendered.
   * @default 'short'
   */
  dateFormat?: 'short' | 'long' | 'iso';
  /**
   * Gantt axis bucket size. **Canonical spelling** — it is `@objectstack/spec`
   * `ui/TimelineConfig.json`'s axis key AND the renderer's preferred read
   * (`resolveTimelineScale` resolves `scale ?? timeScale`).
   * @default 'month'
   */
  scale?: TimelineScale;
  /**
   * Gantt axis bucket size — this renderer's pre-spec dialect, still read as a
   * fallback so stored JSON keeps working.
   *
   * @deprecated Use {@link TimelineSchema.scale}, which `@objectstack/spec`
   * owns and this renderer prefers. Retiring the alias is routed separately
   * (objectui#6170 maintainer ruling 2026-08-25: "`timeScale` goes the
   * alias-retirement route, not a silent second spelling").
   */
  timeScale?: TimelineScale;
  /**
   * Header label above the Gantt row-label gutter.
   * @default 'Items'
   */
  rowLabel?: string;
  /**
   * Override the auto-calculated Gantt axis start (`YYYY-MM-DD`).
   */
  minDate?: string;
  /**
   * Override the auto-calculated Gantt axis end (`YYYY-MM-DD`).
   */
  maxDate?: string;
  /**
   * Timeline events.
   *
   * ⚠️ ZERO read points — `packages/plugin-timeline` never reads this key, so a
   * timeline authored with `events` renders an EMPTY rail. It was `required`
   * until objectui#6170, which is why the docs page's own TypeScript example
   * did not compile; it is OPTIONAL now so that documented authoring form
   * type-checks, and that widening is the whole of the change made here.
   *
   * Its RETIREMENT is routed, not done: objectui#6170's maintainer ruling
   * (2026-08-25) sends this key, {@link TimelineSchema.orientation} and
   * {@link TimelineSchema.position} down the ADR-0049 enforce-or-remove route.
   * That is a breaking removal from a published type and therefore its own
   * change; the house form for it is the `?: never` tombstone convention on
   * {@link StaticTableColumn} above (objectui#5474).
   *
   * @deprecated Never read by any renderer. Use `items` — see
   * `content/docs/plugins/plugin-timeline.mdx`.
   */
  events?: TimelineEvent[];
  /**
   * Timeline orientation.
   *
   * ⚠️ ZERO read points — the renderer discriminates on
   * {@link TimelineSchema.variant}, not on this key. Retirement routed via
   * ADR-0049; see {@link TimelineSchema.events}.
   *
   * @deprecated Never read by any renderer. Use `variant`.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Timeline position (for vertical).
   *
   * ⚠️ ZERO read points. Retirement routed via ADR-0049; see
   * {@link TimelineSchema.events}.
   *
   * @deprecated Never read by any renderer.
   * @default 'left'
   */
  position?: 'left' | 'right' | 'alternate';
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /**
   * Item label
   */
  label: string;
  /**
   * Item href/link
   */
  href?: string;
}

/**
 * Breadcrumb component
 */
export interface BreadcrumbSchema extends BaseSchema {
  type: 'breadcrumb';
  /**
   * Breadcrumb items
   */
  items: BreadcrumbItem[];
  /**
   * Separator character
   * @default '/'
   */
  separator?: string;
}

/**
 * Keyboard key component
 */
export interface KbdSchema extends BaseSchema {
  type: 'kbd';
  /**
   * Key label (single key)
   */
  label?: string;
  /**
   * Key labels (multiple keys)
   */
  keys?: string | string[];
}

/**
 * Union type of all data display schemas
 */
export type DataDisplaySchema =
  | AlertSchema
  | BadgeSchema
  | AvatarSchema
  | ListSchema
  | TableSchema
  | DataTableSchema
  | MarkdownSchema
  | TreeViewSchema
  | ChartSchema
  | PivotTableSchema
  | TimelineSchema
  | HtmlSchema
  | StatisticSchema
  | BreadcrumbSchema
  | KbdSchema;

/**
 * Raw HTML component
 */
export interface HtmlSchema extends BaseSchema {
  type: 'html';
  /**
   * The HTML content string
   */
  html: string;
}
