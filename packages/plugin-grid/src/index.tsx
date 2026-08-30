/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry, elementDataSourceBlock, type ComponentInput } from '@object-ui/core';
import {
  ElementDataSourceGate,
  noDataSourceMessage,
  useResolvedDataSource,
  useSchemaContext,
  type ElementDataSourceMapping,
} from '@object-ui/react';
import type { DataSource } from '@object-ui/types';
import { ObjectGrid } from './ObjectGrid';
import { VirtualGrid } from './VirtualGrid';
import { ImportWizard } from './ImportWizard';

export { ObjectGrid, VirtualGrid, ImportWizard };
// Spreadsheet parsers (pure functions; ExcelJS lazy-loads inside) — exported
// for the chat-native attachment flow (cloud#797 WS3): the AI build panel
// parses an attached Excel/CSV client-side and briefs the agent with the
// headers + sample rows instead of dropping the file.
export { parseSpreadsheetFile, parseClipboardTable, inferColumnType } from './importParsers';
export { InlineEditing } from './InlineEditing';
export { useRowColor } from './useRowColor';
export { useGroupedData } from './useGroupedData';
export { GroupRow } from './GroupRow';
export { RowActionMenu, formatActionLabel } from './components/RowActionMenu';
export { BulkActionBar } from './components/BulkActionBar';
export { useCellClipboard } from './useCellClipboard';
export { useGradientColor } from './useGradientColor';
export { useGroupReorder } from './useGroupReorder';
export { useColumnSummary } from './useColumnSummary';
export { FormulaBar } from './FormulaBar';
export { SplitPaneGrid } from './SplitPaneGrid';
export type { ObjectGridComponentProps, ObjectGridExternalPaginationProps, ObjectGridColumnState } from './ObjectGrid';

/**
 * @deprecated Use `ObjectGridComponentProps`. Renamed in objectui#4650 because
 * `@objectstack/spec/ui` owns `ObjectGridProps` from 17.0.0, where it means the
 * AUTHORED props document of the `object-grid` element — not this component's
 * props. The alias denotes the SAME type and is kept only so existing importers
 * keep compiling.
 */
export type { ObjectGridComponentProps as ObjectGridProps } from './ObjectGrid';
export type { VirtualGridProps, VirtualGridColumn } from './VirtualGrid';
export type { InlineEditingProps } from './InlineEditing';
export type { ImportWizardProps, ImportResult } from './ImportWizard';
export type { GroupEntry, UseGroupedDataResult, AggregationType, AggregationConfig, AggregationResult } from './useGroupedData';
export type { GroupRowProps } from './GroupRow';
export type { RowActionMenuProps } from './components/RowActionMenu';
export type { BulkActionBarProps } from './components/BulkActionBar';
export type { CellRange, UseCellClipboardOptions, UseCellClipboardResult } from './useCellClipboard';
export type { GradientStop, UseGradientColorOptions } from './useGradientColor';
export type { UseGroupReorderOptions, UseGroupReorderResult } from './useGroupReorder';
export type { ColumnSummarySetting, ColumnSummaryType, ColumnSummaryResult } from './useColumnSummary';
export type { FormulaBarProps } from './FormulaBar';
export type { SplitPaneGridProps } from './SplitPaneGrid';

/**
 * The keys `ObjectGrid` reads for its own query — every one of them, which makes
 * this the only block where the spec's binding maps across without a gap.
 * `columns` is a FIELD list here (so a saved view's columns belong on it), the
 * filter and sort reach `$filter` / `$orderby` (the filter via `toFilterNode`,
 * the repo's single lowering hop before the wire — it passes the AST this gate
 * composes through untouched), and the row cap is read as `pagination.pageSize`
 * (`ObjectGrid.tsx`, `serverPageSize`).
 */
const OBJECT_GRID_DATA_SOURCE: ElementDataSourceMapping = {
  columns: true,
  filter: true,
  sort: true,
  limit: 'pagination.pageSize',
};

/**
 * Whether THIS grid placement can only draw rows by querying — i.e. whether a
 * missing adapter is a defect rather than a legitimate configuration
 * (objectui#5378 item 2, the `requiresDataSource` contract).
 *
 * Every escape hatch `ObjectGrid` itself honours is enumerated here, and the
 * list is the reason this predicate lives at the call site rather than in the
 * gate. `getDataConfig` folds an array `data`, a `ViewData` with
 * `provider: 'value'` and the legacy `staticData` into inline rows and never
 * reaches the fetch effect; `bind` resolves rows from the surrounding data
 * scope; and a HOST that owns the fetch — `plugin-list`'s `ListView` is the one
 * in this repo — hands the window down as a `data` REACT PROP, which is why the
 * prop is read here too. It is tested with `Array.isArray` because that is the
 * exact test `ObjectGrid` applies to it (`passedData && Array.isArray(…)`) —
 * and because `SchemaRenderer` spreads EVERY unstripped schema key as a React
 * prop, so a mere `'data' in props` would also be true of the schema's own
 * `data` object and would wave through a grid that really has nowhere to look.
 *
 * `objectName` is required last: a grid with no object named it is a different
 * defect with a different answer, and "no data source" would be the wrong
 * address for it.
 */
const gridNeedsDataSource = (schema: any, hostRows: unknown): boolean => {
  if (Array.isArray(hostRows)) return false;
  if (schema?.bind != null) return false;
  if (Array.isArray(schema?.data)) return false;
  if (schema?.data?.provider === 'value') return false;
  if (schema?.staticData != null) return false;
  return typeof schema?.objectName === 'string' && schema.objectName.length > 0;
};

// Register object-grid component
export const ObjectGridRenderer: React.FC<{ schema: any; [key: string]: any }> = elementDataSourceBlock(({ schema, ...props }) => {
  // ONE resolution rule for the whole family (objectui#5378): an explicit
  // adapter first, the `SchemaRendererProvider` context second.
  //
  // This used to be `useSchemaContext() || {}`, and that hook THROWS without a
  // provider — the `|| {}` could never catch it. So the exact case this card is
  // about, an author who never wired a provider, surfaced as `SchemaRenderer`'s
  // error boundary saying «Component "object-grid" failed to render» over a
  // React hook message that names neither the data source nor the fix. The
  // adapter was ALSO already reaching `ObjectGrid` as a prop whenever a provider
  // happened to exist, because `{...props}` is spread last; pulling it out here
  // makes that precedence explicit and identical to `detail-view`'s, instead of
  // an accident of spread order that a reordering could silently reverse.
  const { dataSource: dataSourceProp, ...rest } = props;
  const dataSource = useResolvedDataSource<DataSource>(dataSourceProp);
  // The spec's `PageComponentSchema.dataSource` binding (objectstack#6953).
  // Nothing here used to map `dataSource.object` onto the `objectName` this
  // block requires, so a page that declared the binding the spec documents —
  // and no separate `objectName` — rendered an empty grid: no object, no query,
  // no error. The gate maps it and reports an unresolvable `view` instead of
  // quietly widening the query to the object's full scope.
  return (
    <ElementDataSourceGate
      schema={schema}
      mapping={OBJECT_GRID_DATA_SOURCE}
      dataSource={dataSource}
      testId="object-grid"
      errorTitle="This grid’s data source could not be resolved"
      requiresDataSource={gridNeedsDataSource(schema, (rest as { data?: unknown }).data)}
      noDataSourceMessage={noDataSourceMessage('object-grid', schema?.objectName)}
    >
      {(bound) => <ObjectGrid schema={bound} {...rest} dataSource={dataSource} />}
    </ElementDataSourceGate>
  );
});

/**
 * The authoring surface for this block's query filter, in ONE spelling.
 *
 * It used to be published as plural `filters` while `ObjectGrid` read singular
 * `schema.filter` and nothing anywhere read `schema.filters` (objectui#4041).
 * Both halves were silent: `sdui-parser`'s save gate walks a node's props
 * against these `inputs`, so `filters` was accepted and then dropped by the
 * renderer — an author (very often an AI author) writing the published word got
 * an unfiltered full-table answer with no error — while the spelling that
 * actually works was reported as `unknown-prop`. The published vocabulary and
 * the runtime read pointed at opposite keys.
 *
 * Resolved toward the implementation (maintainer ruling 2026-08-10, option A):
 * the declaration is singular `filter`, aligned three ways — with the renderer's
 * read point (`ObjectGrid.tsx`, `schema.filter`), with the sibling `list-view`
 * block (`plugin-list/src/index.tsx`, `{ name: 'filter', … }`), and with the
 * spec's own `filter` vocabulary. The plural is DELETED rather than taught to
 * the renderer: it has zero read points on any ref, so no working in-the-wild
 * usage depends on it, and reading it too would harden a misspelling into a
 * second de-facto contract (AGENTS.md #0.1).
 *
 * Shared by both registrations below so the alias cannot drift from the block.
 *
 * ## The rest of the surface (objectui#4648)
 *
 * Everything after `filter` was declared by the maintainer ruling of 2026-08-16
 * on objectui#4648 (option B + carve-out). These are NOT new capabilities — every
 * one of them is read by `ObjectGrid` today, and until this landed an author who
 * wrote one got `unknown-prop` from `sdui-parser` on a key that works, while the
 * designer panel and the generated `sdui-intrinsics.d.ts` denied it existed.
 * Publishing them is what makes the manifest, the `.d.ts`, the designer and the
 * renderer finally agree.
 *
 * TEN keys `@objectstack/spec` 17.0.0 GA also declares are deliberately NOT here
 * — this block's own `@deprecated` legacy spellings (`fields`, `staticData`,
 * `selectable`, `pageSize`, `showSearch`, `showPagination`, `defaultSort`,
 * `defaultFilters`, `resizableColumns`, `title` — all tagged `@deprecated` in
 * `ObjectGridSchema`, `packages/types/src/objectql.ts`). The renderer still reads
 * them as back-compat fallbacks, but publishing a deprecated alias as NEW
 * authoring surface would harden it into a second dialect (AGENTS.md #0.1), so
 * each gets a cited exemption in the console parity gate instead. Their canonical
 * spellings — `columns`, `data`, `selection`, `pagination`, `searchableFields`,
 * `sort`, `filter`, `resizable`, `label` — are all declared here, and each
 * description below says so, so the exemption teaches rather than merely omits.
 *
 * ## `data` declares the CONTRACT's shape, not the shortcut's (objectui#5090)
 *
 * The key landed above with `type: 'array'`, labelled "Static Data" and described
 * as inline rows — which is the shape of `staticData`, the very alias the
 * carve-out above refuses to publish, not the shape of `data`. The contract is
 * `ObjectGridSchema.data?: ViewData` (`packages/types/src/objectql.ts`), and
 * `ViewData` is the spec's discriminated union on `provider` — four strict object
 * arms (`object` / `api` / `value` / `schema`), none of them an array. So the
 * declaration published a shape `tsc` rejects (`TS2322`) and `ViewDataSchema`
 * refuses, while the one form that satisfies both — `{ provider: 'value', items:
 * [...] }` — drew `type-mismatch` from this repo's own save gate, because
 * `checkType`'s `'array'` arm accepts only arrays. The platform contradicted
 * itself on the only legal write: objectui#4041's shape again, one field over.
 *
 * `ObjectGrid`'s renderer does still accept a bare array (`getDataConfig` folds
 * it to `{ provider: 'value', items }`), and that tolerance is deliberately left
 * alone here — it is objectui#5068's family, and declaring an arm for it would
 * publish a shape the contract rejects, which is precisely the carve-out's own
 * reasoning. An array `data` therefore has the same standing as `staticData`:
 * read as back-compat, not advertised as authoring surface.
 */
const GRID_QUERY_INPUTS: ComponentInput[] = [
  { name: 'objectName', type: 'string', label: 'Object Name', required: true },
  { name: 'columns', type: 'array', label: 'Columns', description: 'Columns to show, either field names (`["name", "email"]`) or column objects (`[{ field: "name", label: "Full Name", width: 200 }]`). The canonical spelling — the deprecated `fields` is only read when this is absent.' },
  { name: 'filter', type: 'array', label: 'Filter', description: 'Filter criteria in JSON-rules form. The canonical spelling — the deprecated `defaultFilters` is only read when this is absent.' },
  // ── identity ──────────────────────────────────────────────────────────────
  { name: 'label', type: 'string', label: 'Label', description: 'Grid label, used as the table caption and as the export file title. The canonical spelling — the deprecated `title` is only read when this is absent.' },
  // ── query shaping ─────────────────────────────────────────────────────────
  { name: 'sort', type: 'array', label: 'Sort', description: 'Initial sort order, `[{ field, order }]`. The canonical spelling — the deprecated single-sort `defaultSort` is only read when this is absent.' },
  { name: 'pagination', type: 'object', label: 'Pagination', description: 'Pagination config, `{ pageSize, pageSizeOptions, … }`. Its presence is what enables paging; prefer it over the deprecated flat `pageSize` / `showPagination` pair.' },
  { name: 'searchableFields', type: 'array', label: 'Searchable Fields', description: 'Fields the toolbar search box queries. A non-empty list is what enables search — prefer it over the deprecated boolean `showSearch`, which cannot say WHICH fields to search.' },
  { name: 'data', type: 'object', label: 'Data Source', description: 'Data source configuration — a `ViewData` object discriminated by `provider`: `{ provider: "object", object }` (what an omitted `data` falls back to, using `objectName`), `{ provider: "api", read, write }`, `{ provider: "value", items: [...] }` for inline rows that bypass the object query, or `{ provider: "schema", schemaId }`. The canonical spelling — the deprecated `staticData` is the array-only shortcut for the `value` provider, so inline rows go under `items` here rather than in a bare array.' },
  // ── presentation ──────────────────────────────────────────────────────────
  { name: 'rowHeight', type: 'enum', label: 'Row Height', enum: ['compact', 'short', 'medium', 'tall', 'extra_tall'], description: 'Row density. An unrecognised value falls back to `compact` rather than erroring.' },
  { name: 'frozenColumns', type: 'number', label: 'Frozen Columns', description: 'How many leading columns stay pinned while the grid scrolls horizontally.' },
  { name: 'resizable', type: 'boolean', label: 'Resizable Columns', description: 'Let users drag column borders to resize. The canonical spelling — the deprecated `resizableColumns` is only read when this is absent.' },
  { name: 'reorderableColumns', type: 'boolean', label: 'Reorderable Columns', description: 'Let users drag columns into a different order.' },
  { name: 'showColumnTypeIcons', type: 'boolean', label: 'Show Column Type Icons', description: 'Show a field-type icon in each column header. Off by default — the type is usually obvious from the cell content, and the icons compete with the column labels.' },
  { name: 'rowColor', type: 'object', label: 'Row Color', description: 'Rules that colour whole rows from a field value.' },
  { name: 'conditionalFormatting', type: 'array', label: 'Conditional Formatting', description: 'Row/cell styling rules. Accepts both the ObjectUI `{ field, operator, value }` form and the spec expression form `{ condition, style }`.' },
  // ── grouping and roll-ups ─────────────────────────────────────────────────
  { name: 'grouping', type: 'object', label: 'Grouping', description: 'Group rows by one or more fields into collapsible sections.' },
  { name: 'aggregations', type: 'array', label: 'Aggregations', description: 'Per-group roll-ups shown in group headers, `[{ field, type: "sum" | "count" | "avg" | "min" | "max" | "count_distinct" }]`. Needs `grouping` to have anything to roll up.' },
  // ── selection and actions ─────────────────────────────────────────────────
  { name: 'selection', type: 'object', label: 'Selection', description: 'Selection config, `{ type: "none" | "single" | "multiple" }`. The canonical spelling — the deprecated boolean/string `selectable` is only read when this is absent.' },
  { name: 'rowActions', type: 'array', label: 'Row Actions', description: 'Names of actions offered on each row’s menu.' },
  { name: 'bulkActions', type: 'array', label: 'Bulk Actions', description: 'Names of actions offered once rows are selected. Needs a multi-row `selection` to be reachable.' },
  { name: 'batchActions', type: 'array', label: 'Batch Actions (legacy alias)', description: 'Legacy alias of `bulkActions`, and the one the renderer reads FIRST when both are set. Prefer `bulkActions` in new schemas.' },
  { name: 'bulkActionDefs', type: 'array', label: 'Bulk Action Definitions', description: 'Full inline bulk-action definitions, for actions that are not named entries in the object’s action set. Use `bulkActions` when the action already exists.' },
  // ── behaviour ─────────────────────────────────────────────────────────────
  { name: 'editable', type: 'boolean', label: 'Editable', description: 'Enable inline cell editing (double-click or Enter opens a cell).' },
  { name: 'singleClickEdit', type: 'boolean', label: 'Single-click Edit', description: 'With `editable`, a single click opens the cell instead of a double-click. Has no effect on a non-editable grid.' },
  { name: 'navigation', type: 'object', label: 'Navigation', description: 'What a row click does, `{ mode: "page" | "drawer" | "modal" | "split" | "none", … }`.' },
  { name: 'operations', type: 'object', label: 'Operations', description: 'Toggles for the built-in create/read/update/delete/export/import affordances, e.g. `{ delete: false }`.' },
  { name: 'exportOptions', type: 'object', label: 'Export Options', description: 'Export config, `{ formats, maxRecords, includeHeaders, fileNamePrefix }`. Needs `operations.export` to be reachable from the toolbar.' },
];

ComponentRegistry.register('object-grid', ObjectGridRenderer, {
  namespace: 'plugin-grid',
  label: 'Object Grid',
  category: 'plugin',
  inputs: GRID_QUERY_INPUTS.map((i) => ({ ...i })),
});

// Alias for view namespace - this allows using { type: 'view:grid' } in schemas
// which is semantically meaningful for data display components.
// `skipFallback` keeps this from also claiming the bare `grid` key, which
// belongs to the @object-ui/components layout grid (issue: object-grid was
// shadowing the layout container, so `{type:'grid'}` 404'd needing objectName).
ComponentRegistry.register('grid', ObjectGridRenderer, {
  namespace: 'view',
  skipFallback: true,
  label: 'Data Grid',
  category: 'view',
  // Same renderer, therefore the same declared surface — see GRID_QUERY_INPUTS.
  inputs: GRID_QUERY_INPUTS.map((i) => ({ ...i })),
});

// Register import-wizard component
const ImportWizardRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  return (
    <ImportWizard
      objectName={schema.objectName}
      objectLabel={schema.objectLabel}
      fields={schema.fields ?? []}
      dataSource={dataSource}
      {...props}
    />
  );
};

ComponentRegistry.register('import-wizard', ImportWizardRenderer, {
  namespace: 'plugin-grid',
  label: 'Import Wizard',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'fields', type: 'array', label: 'Fields', required: true },
  ]
});

// Note: 'grid' type is handled by @object-ui/components Grid layout component
// This plugin only handles 'object-grid' which integrates with ObjectQL/ObjectStack
