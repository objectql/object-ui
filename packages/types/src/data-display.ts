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
  type?: 'text' | 'number' | 'date' | 'datetime' | 'currency' | 'percent' | 'boolean' | 'action';
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
}

/**
 * Simple table component
 */
export interface TableSchema extends BaseSchema {
  type: 'table';
  /**
   * Table caption
   */
  caption?: string;
  /**
   * Table columns
   */
  columns: TableColumn[];
  /**
   * Table data rows
   */
  data: any[];
  /**
   * Table footer content
   */
  footer?: SchemaNode | SchemaNode[] | string;
  /**
   * Whether table has hover effect
   * @default true
   */
  hoverable?: boolean;
  /**
   * Whether table has striped rows
   * @default false
   */
  striped?: boolean;
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
 * Timeline component
 */
export interface TimelineSchema extends BaseSchema {
  type: 'timeline';
  /**
   * Timeline events
   */
  events: TimelineEvent[];
  /**
   * Timeline orientation
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Timeline position (for vertical)
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
