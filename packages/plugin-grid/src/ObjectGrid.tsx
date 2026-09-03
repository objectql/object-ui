/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectGrid Component
 * 
 * A specialized grid component built on top of data-table.
 * Auto-generates columns from ObjectQL schema with type-aware rendering.
 * Implements the grid view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Traditional table/grid with CRUD operations
 * - Search, filters, pagination
 * - Column resizing, sorting
 * - Row selection
 * - Inline editing support
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ObjectGridSchema, DataSource, ListColumn, TableColumn, ViewData, TableSortItem, DataTableSchema, ListViewExportFormat } from '@object-ui/types';
import { isSystemManagedField, normalizeTableColumnType } from '@object-ui/types';
import type { I18nLabel } from '@objectstack/spec/ui';
import { SchemaRenderer, useDataScope, useNavigationOverlay, useAction, useSafeFieldLabel, usePredicateScope, useRelatedRecordActions } from '@object-ui/react';
import { createSafeTranslation } from '@object-ui/i18n';
import { getCellRenderer, resolveCellRendererType, formatCurrency, formatCompactCurrency, formatDate, formatPercent, humanizeLabel, getBadgeColorClasses, getBadgeHexAppearance, FieldEditWidget, hasFieldEditWidget, DISCRETE_EDIT_TYPES, coerceToSafeValue } from '@object-ui/fields';
import { useLocalization, useDisplayLocale, resolveFieldCurrency } from '@object-ui/i18n';
import { stateMachineNextValues, isFieldInlineEditable } from './inline-edit-options';
import {
  Badge, Button, NavigationOverlay, EmptyValue,
  Popover, PopoverContent, PopoverTrigger,
  RefreshIndicator,
} from '@object-ui/components';
import { usePullToRefresh } from '@object-ui/mobile';
import { resolveConditionalFormatting, leadWithNameField, buildExpandFields, buildExportFileName, columnIdentity, collectPredicateFieldRefs, collectGroupingFieldRefs, listViewPredicates, isObjectInlineEditable, isProjectableField, isExpandableFieldType, isUnmaterializedFieldType, readObjectSortability, isPlatformSortableField, filterPlatformSortableSort, toFilterNode, ROW_HEIGHT_TO_DENSITY_MODE } from '@object-ui/core';
import { usePermissions } from '@object-ui/permissions';
import { ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, Download, Rows2, Rows3, Rows4, AlignJustify, Type, Hash, Calendar, CheckSquare, User, Tag, Clock, Loader2 } from 'lucide-react';
import { useRowColor } from './useRowColor';
import { useGroupedData, usableGroupingFields } from './useGroupedData';
import { GroupRow } from './GroupRow';
import { useColumnSummary } from './useColumnSummary';
import { resolveRowCrudAffordances, resolveRowRecordCrudAffordance } from './rowCrudAffordances';
import { useRecordCrudVerdicts } from './hooks/useRecordCrudVerdicts';
import { resolveLegacyRowActions } from './resolveLegacyRowActions';
import { applyRelationalMeta } from './relationalMetaKeys';
import { resolveBulkActions } from './resolveBulkActions';
import { partitionBulkRows } from './bulkEligibility';
import { resolvesToDataColumn, describeUnresolvedColumns } from './columnSpellingDiagnostics';
import { RowActionMenu, formatActionLabel } from './components/RowActionMenu';
import { BulkActionBar } from './components/BulkActionBar';
import { BulkActionDialog } from './components/BulkActionDialog';
import type { BulkResult } from './hooks/useBulkExecutor';
import type { BulkActionDef } from '@object-ui/types';

/**
 * A view's declared `sort` → the shape the table's header indicators read.
 *
 * `@objectstack/spec` allows `"name desc"`, `["name desc", …]` and
 * `[{ field, order }, …]`, and this grid's own fetch path already reads all
 * three. The headers have to agree with it: a view that arrives sorted by
 * `created_at desc` should show that arrow before anyone clicks anything —
 * otherwise the first click on that column produces `asc` while the list was
 * already `desc`, and the arrow tells the truth only from the second click on.
 *
 * Exported for the test that pins it against the fetch path's own reading.
 */
export function parseSchemaSort(sort: unknown): TableSortItem[] {
  const entries = typeof sort === 'string' ? [sort] : Array.isArray(sort) ? sort : [];
  const items: TableSortItem[] = [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      const [field, order] = entry.trim().split(/\s+/);
      if (field) items.push({ field, order: order?.toLowerCase() === 'desc' ? 'desc' : 'asc' });
    } else if (entry && typeof entry === 'object' && typeof (entry as any).field === 'string') {
      const { field, order } = entry as { field: string; order?: string };
      items.push({ field, order: String(order).toLowerCase() === 'desc' ? 'desc' : 'asc' });
    }
  }
  return items;
}

/**
 * The class list both faces of {@link LinkCell} wear — the anchor is a visual
 * no-op against the span it upgrades, so a list does not change appearance
 * depending on whether its host publishes record URLs.
 */
const LINK_CELL_CLASS =
  'text-primary font-medium underline-offset-4 hover:underline cursor-pointer truncate block max-w-full';

/**
 * A row's primary key — the value the host's record-URL builder addresses.
 * Mirrors what `useNavigationOverlay.handleClick` reads off the same row, so
 * the anchor's href and the click path can never point at different records.
 */
function rowRecordId(row: unknown): string | number | undefined {
  const rec = row as Record<string, unknown> | null | undefined;
  const id = rec?.id ?? rec?._id;
  return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}

// Clickable text cell that can safely contain other interactive content
// (e.g., EmailCellRenderer's copy button). Using <button> here would
// produce an invalid <button> > <button> nesting (hydration error +
// breaks the inner copy click). role="link" + tabIndex + keyboard
// handlers preserves accessibility while allowing arbitrary children.
//
// objectui#4490 — that span was the whole cell, so the list's link column had
// none of a link's native affordances: no middle-click / ⌘-click open-in-new-
// tab, no "copy link address", no hover status-bar URL, and `role="link"` with
// no `href` is a weaker contract for assistive tech than a real anchor. PR
// #4489 had just given detail-page and related-list lookup VALUES real anchors,
// which left the list — the surface users open records from — as the weakest of
// the three.
//
// So when the host publishes a record URL this renders a real `<a href>`, with
// the split #4489 established:
//   - plain left click → `preventDefault()` + the existing `onActivate`, so SPA
//     navigation (drawer / modal / page, whatever the view configured) is
//     completely unchanged;
//   - modifier / non-primary click → NOT prevented, so the browser does what it
//     does with any link.
//
// **The URL is not built here.** This package has no router and no business
// knowing what a record route looks like; the host publishes its own builder
// through `RelatedRecordActionsContext.recordHref` — the same seam #4489 used,
// and for the console list surface the same builder its "open in new window"
// action already navigates with. No host, or a host that cannot route to this
// object, renders EXACTLY the span below: same markup, same behavior, nothing
// to un-learn (the Studio designer, embedded renderers, standalone grids).
const LinkCell: React.FC<{
  testId: string;
  onActivate: () => void;
  /** Object whose record this row is — passed to the host's URL builder. */
  objectName?: string;
  /** This row's primary key. Absent (a row with no id) ⇒ no anchor. */
  recordId?: string | number | null;
  children: React.ReactNode;
}> = ({ testId, onActivate, objectName, recordId, children }) => {
  const host = useRelatedRecordActions();
  const href =
    objectName && recordId != null && recordId !== '' && host?.recordHref
      ? host.recordHref(objectName, recordId)
      : null;

  if (href) {
    return (
      <a
        href={href}
        data-testid={testId}
        className={LINK_CELL_CLASS}
        onClick={(e) => {
          // The row underneath carries its own click handler (open the record,
          // and on a modifier click open it in a new tab). Following this link
          // must never ALSO fire that — on a modifier click that would open two
          // tabs, one from the anchor and one from the row.
          e.stopPropagation();
          // Modifier and non-primary clicks belong to the browser (new tab, new
          // window) — that is the entire point of rendering a real href.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onActivate();
        }}
        onKeyDown={(e) => {
          // Enter is the anchor's OWN activation: the browser fires a click for
          // it, which the handler above turns into the SPA path. Handling it
          // here too would activate twice. Space is the one the span had that a
          // link does not do natively, so it is carried over explicitly.
          if (e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onActivate();
          }
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <span
      role="link"
      tabIndex={0}
      data-testid={testId}
      className={LINK_CELL_CLASS}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onActivate();
        }
      }}
    >
      {children}
    </span>
  );
};


// Default English fallback translations for the grid
const GRID_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'grid.actions': 'Actions',
  'grid.edit': 'Edit',
  'grid.delete': 'Delete',
  'grid.export': 'Export',
  'grid.exportAs': 'Export as {{format}}',
  'grid.loading': 'Loading grid…',
  'grid.errorLoading': 'Error loading grid',
  'grid.pullToRefresh': 'Pull to refresh',
  'grid.refreshing': 'Refreshing…',
  'grid.openRecord': 'Open record',
  'grid.empty': 'Empty',
  'grid.yes': 'Yes',
  'grid.no': 'No',
  'grid.systemFields': 'System',
  // Grouped-view partial-grouping disclosure (objectui#7189). Both sentences
  // must exist HERE as well as in the locale packs: a provider-less host (a
  // standalone grid, this package's own tests) never reaches them, and this
  // is a statement about whether the numbers on screen are true.
  'grid.grouping.partialBadge': 'Partial',
  'grid.grouping.partialNotice':
    'Grouped over the first {{loaded}} of {{total}} records. Group counts are page-scoped, and a group whose records all fall beyond the loaded rows is missing here.',
  'grid.grouping.partialNoticeUnknownTotal':
    'Grouped over the {{loaded}} records loaded. More may match this view, so group counts may be partial and a group may be missing here.',
  // Reused by the grouped-view pager (falls back here when no I18nProvider).
  'table.rowsPerPage': 'Rows per page',
  'table.pageInfo': 'Page {{current}} of {{total}}',
  // Heading of the record-detail overlay this grid opens on row click
  // (objectui#3426). Borrowed from the `detail.*` namespace rather than minted
  // as `grid.recordDetail`: `NavigationOverlay` already resolves
  // `detail.recordDetail` for hosts that pass no title, and one heading on one
  // control should not get two translations that can drift apart. Both entries
  // must exist HERE too — a provider-less host (a standalone grid, this
  // package's own tests) never reaches the locale packs.
  'detail.recordDetail': 'Record Detail',
  'detail.recordDetailWithLabel': '{{label}} Detail',
};

/**
 * Safe wrapper for useObjectTranslation that falls back to English defaults
 * when I18nProvider is not available (e.g., standalone usage).
 *
 * Delegates to `@object-ui/i18n`'s `createSafeTranslation`; the local copy this
 * replaced wrapped the hook in try/catch (rules-of-hooks, objectui#2879).
 */
const useGridTranslation = createSafeTranslation(GRID_DEFAULT_TRANSLATIONS, 'grid.actions');

/** Resolve an I18nLabel (string) to a plain string. */
function resolveColumnLabel(label: string | I18nLabel | undefined): string | undefined {
  if (label == null) return undefined;
  return typeof label === 'string' ? label : undefined;
}

/**
 * The column layout ObjectGrid persists and reports back — the merged result of
 * a resize and a reorder, not either event on its own. Named so the state hook
 * below and the `onColumnStateChange` prop cannot drift apart.
 */
export interface ObjectGridColumnState {
  order?: string[];
  widths?: Record<string, number>;
}

/**
 * The HOST-DRIVEN ("external") mode of ObjectGrid — framework#2212.
 *
 * The ordinary authoring surface hands ObjectGrid a `schema` and a `dataSource`
 * and lets it fetch, page, sort and search for itself. In this mode a host
 * (ListView, a designer preview, an app screen with its own toolbar) has
 * already fetched one window of a larger collection and drives the controls
 * itself: it passes the window as `data` plus the real match total and the
 * page/sort/search state, and ObjectGrid forwards them straight to its
 * DataTable instead of client-slicing the window it was handed.
 *
 * Kept as its own named interface rather than flattened into `ObjectGridComponentProps`
 * (#4277 裁决 B, 2026-08-11): the two are different classes of contract, and a
 * dozen more members merged into the authoring surface would erase that
 * boundary. Until this existed, every member below was read out of `...rest`
 * through an `as any` cast and was declared nowhere at all.
 *
 * DERIVATION (#4277 裁决 §3, the anti-drift pin): this vocabulary is already
 * declared once, on `DataTableSchema` — which is exactly where ObjectGrid
 * forwards it — so the members that have a counterpart there are TYPE-DERIVED
 * from that declaration rather than hand-copied into a second enumeration. Two
 * hand-written copies of one vocabulary is how the next drift happens. The
 * `Partial<...>` wrapper is deliberate and is the only shape change: the whole
 * mode is opt-in, and `DataTableSchema['data']` is required because a table
 * always has rows, while a grid that was given no `data` fetches its own.
 */
export interface ObjectGridExternalPaginationProps
  extends Partial<
    Pick<
      DataTableSchema,
      // The host's already-fetched window. Highest-priority data source: it
      // wins over `schema.data` / `schema.bind` when present.
      | 'data'
      // Turns off client slicing. With `rowCount` + `onPageChange` it is what
      // makes the mode active at all (see `externalManualPagination` below).
      | 'manualPagination'
      | 'rowCount'
      | 'page'
      | 'pageSize'
      | 'onPageChange'
      | 'onPageSizeChange'
      | 'sort'
      | 'onSortChange'
      | 'search'
      | 'onSearchChange'
    >
  > {
  /**
   * Grid-only: `DataTableSchema` has no counterpart to derive from.
   *
   * The table vocabulary reports column changes as separate per-event
   * callbacks — `onColumnResize(columnKey, width)` and
   * `onColumnReorder(newOrder)` — whereas this reports the MERGED, persisted
   * `{ order, widths }` layout after ObjectGrid has folded either event into
   * the state it also writes to `localStorage`, so a host can save one blob
   * through `dataSource.updateViewConfig`. Deriving it from either table
   * callback would misstate both the payload and when it fires.
   */
  onColumnStateChange?: (state: ObjectGridColumnState) => void;

  /**
   * Grid-only: `DataTableSchema` has no counterpart to derive from — a table is
   * handed rows, it never issues a query.
   *
   * The params the host passed to `dataSource.find()` for the window it is
   * handing down in `data` — the SAME shape this grid's own loader stores in
   * `lastFindParamsRef` (`$filter` / `$orderby` / `$select` / `$search` /
   * `$searchFields` / `$expand` / `$top` / `$skip`), so both paths feed one
   * reader. `$top`/`$skip` may be present and are ignored: the fan-out windows
   * the replay itself.
   *
   * Why a prop rather than a fallback inside the grid (objectui#4501): the
   * cross-page "select all N matching" escalation re-issues the view's query to
   * collect the whole match set, and the query has to come from whichever side
   * owns the fetch. Under external pagination that is the host, and the grid's
   * own ref is either empty or stale — replaying it asked the server for the
   * WHOLE OBJECT (no `$filter`) and handed up to 5000 unmatched records to a
   * destructive executor. A grid-side `?? {}` default is what produced that,
   * which is why the missing case is not defaulted but REFUSED: with no params
   * for the current data path the escalation is not offered at all (see
   * `bulkFanoutParams` in the component body).
   *
   * A changed value is also the host's query-change signal: it resets the
   * escalation, mirroring the `setSelectAllMatching(false)` the internal loader
   * runs next to its own `lastFindParamsRef` write. Compared by CONTENT, so a
   * host re-render that rebuilds an equal object does not drop the user's
   * escalation.
   */
  findParams?: Record<string, unknown> | null;
}

/**
 * Props of the `ObjectGrid` React component.
 *
 * Renamed off the bare `ObjectGridProps` (objectui#4650): from 17.0.0
 * `@objectstack/spec/ui` owns that name, where it is the AUTHORED props
 * document of the `object-grid` element — `z.input<typeof
 * ObjectGridPropsSchema>`, i.e. serialisable authoring keys only (`label`,
 * `fields`, `defaultFilters`, `pagination`, …). This is the RENDERER's props: a
 * live `dataSource`, the host pagination handles below, and eleven callbacks,
 * none of which can exist in authored metadata. Two layers under one word,
 * resolved the way this repo already resolved it for `PageHeaderProps` ->
 * `PageHeaderComponentProps` (app-shell) and the `Record*ComponentProps` family
 * in `@object-ui/types`.
 *
 * The barrel keeps `ObjectGridProps` as a deprecated alias of this type, so no
 * importer breaks. Tripwire: `__tests__/spec-symbol-4650.test.ts`.
 */
export interface ObjectGridComponentProps extends ObjectGridExternalPaginationProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onRowClick?: (record: any) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  onBulkDelete?: (records: any[]) => void;
  onCellChange?: (rowIndex: number, columnKey: string, newValue: any, row: any) => void;
  onRowSave?: (rowIndex: number, changes: Record<string, any>, row: any) => void | Promise<void>;
  onBatchSave?: (changes: Array<{ rowIndex: number; changes: Record<string, any>; row: any }>) => void | Promise<void>;
  onRowSelect?: (selectedRows: any[]) => void;
  onAddRecord?: () => void;
}

/**
 * Helper to get data configuration from schema
 * Handles both new ViewData format and legacy inline data
 */
function getDataConfig(schema: ObjectGridSchema): ViewData | null {
  // New format: explicit data configuration
  if (schema.data) {
    // Check if data is an array (shorthand format) or already a ViewData object
    if (Array.isArray(schema.data)) {
      // Convert array shorthand to proper ViewData format
      return {
        provider: 'value',
        items: schema.data,
      };
    }
    // Already in ViewData format
    return schema.data;
  }
  
  // Legacy format: staticData field
  if (schema.staticData) {
    return {
      provider: 'value',
      items: schema.staticData,
    };
  }
  
  // Default: use object provider with objectName
  if (schema.objectName) {
    return {
      provider: 'object',
      object: schema.objectName,
    };
  }
  
  return null;
}

/**
 * The relational copy set and `applyRelationalMeta` moved to
 * `./relationalMetaKeys` for objectui#6875. The list there is DERIVED from a
 * table classifying every key swept off the three `@object-ui/fields` consumers,
 * and a gate re-derives that read set from their sources — so the copy set can
 * no longer drift into being a strict subset of what those consumers read,
 * which is what it had silently become. Read that file's docblock before
 * adding, removing or re-spelling a key.
 *
 * ⚠️ What this bag actually feeds is ONE of those three: the read-only cell.
 * `fieldMeta` is handed to `<CellRenderer field={…}>` and nowhere else in this
 * file. The inline picker is the OTHER seam — `renderCellEditor` below looks
 * the field up in `objectSchema` and spreads the whole def into the widget, so
 * a picker key reaches `LookupField` whether or not it is on the copy set.
 * Measured in `__tests__/lookupPickerKeys-7154.test.tsx` (objectui#7154).
 */

/**
 * Content signature of a host's find-params, used as the query-change signal for
 * the cross-page escalation (objectui#4501 clause 2).
 *
 * CONTENT and not identity: a host re-render that rebuilds an equal params
 * object must not drop an escalation the user just made, and identity is the
 * one thing a host cannot be relied on to keep stable. Top-level keys are
 * sorted so key ORDER — which differs between the host's literal and this
 * grid's own loader — never reads as a query change.
 */
function findParamsSignature(params: Record<string, unknown> | null | undefined): string | null {
  if (!params) return null;
  return JSON.stringify(
    Object.keys(params).sort().map((k) => [k, params[k] ?? null]),
  );
}

/**
 * Helper to normalize columns configuration
 * Handles both string[] and ListColumn[] formats
 */
function normalizeColumns(
  columns: string[] | ListColumn[] | undefined
): ListColumn[] | string[] | undefined {
  if (!columns || columns.length === 0) return undefined;
  
  // Already in ListColumn format - check for object type with optional chaining
  if (typeof columns[0] === 'object' && columns[0] !== null) {
    return columns as ListColumn[];
  }
  
  // String array format
  return columns as string[];
}

/**
 * ⭐ WHAT THIS GRID'S COLUMN PRODUCER IS ALLOWED TO EMIT (objectui#6004).
 *
 * `generateColumns()` below builds the column array this component hands to
 * `data-table`, whose slot is `DataTableSchema.columns: TableColumn[]`. It had
 * no return annotation, so its four emit paths were inferred structurally and
 * nothing ever compared them to the slot's declaration — and all four call
 * sites re-widened to `any` on the way out, so even an annotation would have
 * been discarded one hop later.
 *
 * ## ⭐ Why this is not just `: TableColumn[]`
 *
 * objectui#6373 measured, at the sibling producer in `plugin-dashboard`, that a
 * bare `TableColumn` annotation raises no error on a `{ ...spread }` emit,
 * because TypeScript's excess-property check is a FRESHNESS check on the
 * properties an object literal WRITES OUT and spread properties are exempt.
 *
 * Measured again HERE before choosing this shape, because this seam is worse
 * than that one and the difference matters:
 *
 *   1. `generateColumns = useCallback((): TableColumn[] => {`, everything else
 *      unchanged  →  `tsc --noEmit` exit 0, ZERO diagnostics.
 *   2. Same, PLUS an undeclared key `wrapControl: true` WRITTEN OUT in the path-A
 *      column literal (not arriving through a spread)  →  exit 0, ZERO diagnostics.
 *
 * Run 2 is the one that fixes the mechanism. At objectui#6373's seam the object
 * literal sits in `enrich()`'s return position, so freshness still caught keys
 * written out longhand and only the spread escaped. Here every literal is the
 * return value of a `.map()` callback, so it is inferred into the callback's
 * return type FIRST and reaches the annotation as a non-fresh `X[]`. Freshness
 * is gone entirely: written-out keys escape too. A bare annotation at this seam
 * is not a weak instrument, it is an inert one — a green gate and no guard.
 *
 * The `?: never` members are what make the annotation able to fail. They are
 * ADR-0049 retirement tombstones — this repo's convention for a key that is
 * REFUSED rather than merely absent (`StaticTableColumn` in `@object-ui/types`)
 * — and they bite by ASSIGNABILITY, which survives `.map()` because it never
 * depended on freshness. Re-adding `...(col.summary && { summary: col.summary })`
 * to a column literal is a compile error naming `summary`.
 *
 * ## The rule (objectui#6373's, applied to this producer's key set)
 *
 * A producer may write into a `TableColumn[]` slot only keys the CONSUMER of
 * that slot reads, and the read set is MEASURED from the consumer's source,
 * never assumed. A key the consumer reads and `TableColumn` declares is
 * written; a key the consumer reads that `TableColumn` does not declare is HELD
 * where a ruling already holds it; a key nothing reads is RETIRED — never
 * declared, because declaring a key nothing reads is the same
 * `declared != enforced` defect facing the other way. Before retiring, prove
 * the value has a second road to its consumer.
 *
 * Consumers measured for THIS producer — two of them, because the array is read
 * twice before it reaches the slot:
 *
 *   - `data-table.tsx`, comments stripped, every `col.<key>` read — THIRTEEN:
 *     `accessorKey`, `width`, `align`, `header`, `className`, `cellClassName`,
 *     `sortable`, `resizable`, `editable`, `type`, `cell`, `headerIcon`,
 *     `fitContent`. ⚠️ This said fourteen until objectui#7196 re-derived it:
 *     `name` was the fourteenth and was correct when written, but objectui#6963
 *     (2026-08-31) retired the `col.name` alias — the last undeclared spelling
 *     the adapter accepted — so the key left the consumer's read set that day.
 *   - THIS FILE's own downstream passes, which read the array before handing it
 *     on — TEN: `pinned` (the left/right reorder + the frozen-column verdict),
 *     `accessorKey`, `header`, `width`, `type`, `fitContent`, plus the four the
 *     chrome passes read in order to RE-EXPRESS them: `className` and
 *     `cellClassName` (`applyDensity`, and again in the right-pinned literal),
 *     `sortable` (`withSortability`), `cell` (the mobile card renderer).
 *     ⚠️ Those four were missing from this list from the day it was written —
 *     all three passes already existed at that commit — so this is an
 *     incompleteness, not drift. They change no verdict: each is declared on
 *     `TableColumn` and read by `data-table.tsx` as well. Recorded because a
 *     list presented as MEASURED has to be one.
 *
 * Verdicts, each with the read-count behind it:
 *
 *   - `headerIcon` — DECLARED by `TableColumn`, so NOT held. Live:
 *     `data-table.tsx` renders it into the header cell (1 render site, 2
 *     syntactic reads), forwarded verbatim and never re-expressed. It WAS held
 *     here, on the "undeclared by `TableColumn`" premise; objectui#6615
 *     declared it and that premise expired with nothing going red at the moment
 *     of loss. objectui#6424 then removed the hold, MEASURED rather than
 *     derived: with the member deleted both emit types below are byte-identical
 *     (27 members, every member's resolved type unchanged), against a positive
 *     control that deleting `pinned` instead moves them to 26. Pinned in
 *     `columnHoldsExpiry-6424.test.ts` — which now also carries the claim the
 *     hold used to carry implicitly, that `TableColumn` DECLARES the key.
 *   - `pinned` — HELD. Live, and consumed BEFORE the slot: the reorder pass
 *     below reads it (5 reads in this file) and re-expresses it as the sticky
 *     `className` that `data-table` actually reads. `data-table` never reads
 *     `pinned` itself, and does not need to.
 *   - `wrap` — RETIRED (objectui#5453, 2026-08-28). Held here only because that
 *     card was `pm:blocked` at the time; triage unblocked it and it took the
 *     measurement this hold was waiting for. `data-table.tsx` offers NO clamp /
 *     expand / wrap affordance for long cell text: its cell wrapper is a
 *     two-way switch, `isFit ? 'w-full whitespace-nowrap' : 'truncate w-full'`,
 *     with a `title` tooltip as the only concession to overflow, and it does
 *     not read `density` or `rowHeight` at all. So there is nothing for a
 *     per-column `wrap` to turn on, and the enforce-or-remove default applies:
 *     the forward is deleted rather than declared-and-maintained. ⚠️ Unlike
 *     `pinned`, `wrap` had NO second road to a consumer — that is the check
 *     this card's rule demands before retiring, and it came back empty.
 *   - `options` — RETIRED (see the enrichment pass below).
 *   - `type` — not adjudicated here; objectui#5853 owns its VALUE set and its
 *     fold still stands. It is the one member whose vocabulary differs between
 *     the two types below.
 *   - `name` — not emitted by this producer at all, so objectui#5120's alias
 *     never needed a hold here. Tombstoned only in the sense that nothing writes
 *     it — and since objectui#6963 (2026-08-31) nothing READS it either: the
 *     consumer-side alias is retired, so the key is absent from BOTH ends of
 *     this seam and the verdict now rests on two measurements, not one.
 *
 * `essential` is absent from both types on purpose: objectui#6004's suggested
 * key list named it, but it was READ off the authored column and turned into a
 * `className` — never emitted, and not a `ListColumn` member either. That read
 * is now RETIRED too (objectui#6458), so mobile visibility is decided purely
 * positionally (`colIndex === 0`) and nothing on either side of this producer
 * carries the key.
 */

/**
 * The tombstoned keys — DERIVED from the authored input type, never hand-listed,
 * so a future `ListColumn` member is refused by default and has to be
 * adjudicated to escape.
 *
 * `ListColumn` is the right derivation source because it is where this
 * producer's drift comes from: every key the emit could wrongly grow is a key
 * the author wrote on the input and someone forwarded. `pinned` is the one that
 * escaped and stayed — adjudicated HELD above. `wrap` escaped too and has since
 * been RETIRED (objectui#5453), so it is no longer carved out of the Exclude
 * and the derived band now tombstones it: re-adding the forward is a compile
 * error naming `wrap`, which is the whole point of retiring it here rather than
 * just deleting a line the next edit could put back for free.
 */
export type RetiredListColumnKey = Exclude<keyof ListColumn, keyof TableColumn | 'pinned'>;

/**
 * The undeclared-but-live keys this producer holds. See the docblock above.
 *
 * ⚠️ "Undeclared by `TableColumn`" is this interface's ENTRY CONDITION, and it
 * is a claim about ANOTHER package that can stop being true with nothing going
 * red here. So it is re-checked per key when the card owning that key closes,
 * never inherited: `headerIcon` sat here on exactly that premise until
 * objectui#6615 declared it on `TableColumn`, at which point the hold was
 * redundant rather than load-bearing, and objectui#6424 removed it.
 *
 * ⛔ A key whose ONLY declaration on the emit types is this interface is not in
 * that position — deleting it deletes the key from the emit. `pinned` is that
 * key today, which is why the two verdicts differ.
 */
export interface ObjectGridColumnHolds {
  /**
   * HELD, load-bearing on BOTH counts — the pair that has to hold for a hold to
   * be real, and the contrast that made `headerIcon`'s removal safe:
   *
   *   1. `TableColumn` does NOT declare it, and `RetiredListColumnKey` carves it
   *      out of the derived tombstone band, so this member is its ONLY
   *      declaration on both emit types. Deleting it drops the key from them
   *      (measured: 27 members → 26).
   *   2. It has a live consumer BEFORE the slot — this file's own reorder pass
   *      reads it and re-expresses it as the sticky `className` that
   *      `data-table` actually reads. That is the "second road" the emit rule
   *      demands before a key may be retired, and `wrap` failed it.
   */
  pinned?: 'left' | 'right';
}

/**
 * What `generateColumns()` returns: everything final EXCEPT `type`, which is
 * still the producer's raw inference vocabulary (`@objectstack/spec`'s
 * `FieldType`, 49 values) rather than the EIGHT-literal union `TableColumn`
 * declares (`TABLE_COLUMN_TYPES`: `text`, `number`, `date`, `datetime`,
 * `currency`, `percent`, `boolean`, `action`). objectui#5853 folds it
 * downstream, in a pass that is deliberately separate from the enrichment map —
 * so the pre-fold shape needs a name, and this is it.
 *
 * ⚠️ This said "7-literal" until objectui#7196 re-derived it. `action` joined
 * the union at objectui#6370 on 2026-08-25 — a day BEFORE this docblock was
 * written, and that commit's own subject line reads "make the 8-literal union
 * the one canonical TableColumn.type" — so the count was never right here; it
 * was mis-copied, not drifted. Both numbers are now measured rather than
 * recited: `TABLE_COLUMN_TYPES` in `@object-ui/types` has 8 members and
 * `@objectstack/spec`'s `FieldType` enum has 49.
 */
/**
 * ⭐ `options` — RETIRED at this emit (objectui#6004), and this explicit
 * tombstone is now the ONLY enforcement of that verdict. ⛔ Do not "tidy" it
 * away as redundant.
 *
 * Until objectui#6425 the key needed no tombstone: it was a member of NO part
 * of the emit types below, so TypeScript's excess-property check refused a
 * fresh literal writing it — refusal by non-membership. #6425's maintainer
 * ruling (2026-08-27) then declared `options` on `TableColumn` itself (the
 * `object-data-table` cell pipeline reads it off the AUTHORED column), which
 * made the key a member here through `Omit<TableColumn, …>` / `TableColumn`
 * and silently ended that enforcement. Nothing went red at the moment of
 * loss — the emit-boundary suite's directive merely turned TS2578-unused,
 * which is luck, not design. The general rule, recorded so the next seam can
 * check itself: **a pin enforced by a key's non-membership silently stops
 * enforcing the moment the key becomes a member.**
 *
 * objectui#6004's verdict itself is unchanged — nothing on either side of
 * THIS seam reads a column-level `options` (`data-table.tsx` has no such
 * read; `renderCellEditor` rebuilds the field from the object schema) — only
 * the refusal's mechanism moves, from freshness to assignability. It is
 * intersected into BOTH the pre-fold draft and the post-fold column, because
 * the retirement belongs to the seam, not to one of its two types; the key
 * cannot land in the DERIVED band (`RetiredListColumnKey`) because `options`
 * is not a `ListColumn` member, which is why this one is hand-written.
 */
type ObjectGridRetiredOptionsTombstone = { options?: never };

export type ObjectGridColumnDraft =
  Omit<TableColumn, 'type'>
  & { type?: string }
  & ObjectGridColumnHolds
  & ObjectGridRetiredOptionsTombstone
  & { [K in RetiredListColumnKey]?: never };

/** Post-fold: what actually reaches `DataTableSchema.columns: TableColumn[]`. */
export type ObjectGridColumn =
  TableColumn
  & ObjectGridColumnHolds
  & ObjectGridRetiredOptionsTombstone
  & { [K in RetiredListColumnKey]?: never };

/**
 * ⭐ THE SCHEMA SLOT THIS GRID FILLS (objectui#6459) — the receiver half of the
 * seam whose producer half #6004 typed. `dataTableSchema` below was
 * `const dataTableSchema: any`, so the ~46 keys assembled there were checked
 * against nothing, while the `DataTableSchema` this file imports went unused as
 * that object's annotation.
 *
 * ## Why the fix is not `: DataTableSchema` — measured before choosing this shape
 *
 * objectui#6459's sizing note predicted a bare annotation would be inert
 * because `buildGroupTableSchema` re-emits the value through a spread and
 * excess-property checking is a freshness check. Measured here (on
 * `38a123cac`), the truth is stronger and the spread is not even needed:
 *
 *   1. `const dataTableSchema: DataTableSchema = {`, everything else unchanged,
 *      PLUS an undeclared `bogusKeyForProbe6459: true` WRITTEN OUT LONGHAND in
 *      the (fresh) literal  →  `tsc --noEmit` exit 0, ZERO diagnostics.
 *
 * The reason is `BaseSchema`'s `[key: string]: any` index signature, which
 * `DataTableSchema` inherits: under an index signature EVERY key is a member,
 * so excess-property checking never has a non-member to refuse — at a fresh
 * literal, through a spread, anywhere. It is the terminal case of the rule the
 * `options` tombstone above records ("a pin enforced by a key's non-membership
 * silently stops enforcing the moment the key becomes a member"): with an
 * index signature there is no non-membership to enforce with, ever.
 *
 * `RemoveIndexSignature` strips it — DERIVED from `DataTableSchema`, never a
 * hand-copied member list, so a member added there tomorrow flows in on its
 * own and two enumerations of one vocabulary never exist. With the signature
 * gone, the same probe goes red (TS2353 naming the key), measured at both
 * annotated literals — the flat one and `buildGroupTableSchema`'s return.
 *
 * ## What the instrument is, and is not (pinned in dataTableSchemaSlot-6459.test.ts)
 *
 * Both writers of this type are object literals sitting DIRECTLY in annotated
 * positions (a `const` initializer; an annotated arrow's parenthesized return),
 * so unlike `generateColumns()` — where `.map()` laundered freshness away and
 * only `?: never` tombstones could bite — excess-property checking is live
 * here for longhand keys, and the group literal's spread source is itself the
 * checked `const`, so every key entering that spread was already refused or
 * admitted at ITS literal. What this shape does NOT do is refuse an undeclared
 * key riding a NON-FRESH value assigned into the slot (assignability admits
 * extra keys; that is structural typing, not a bug here) — per-key `?: never`
 * tombstones remain the instrument for a key RETIRED by ruling, but an open
 * census cannot be tombstoned, because a tombstone needs the key's name.
 *
 * ## The census this annotation surfaced — CLOSED, re-derived by objectui#7196
 *
 * Diffing the 46 keys the flat literal writes (plus the 8 the group literal
 * re-writes) against `DataTableSchema` + `BaseSchema` declared members left
 * exactly TWO undeclared keys when this was written. Re-derived on 2026-09-01
 * against the same two literals (still 46 and 8), it now leaves **ZERO**. Both
 * halves closed:
 *
 *   - the card's speculative list (`pagination`, `manualPagination`, `rowCount`,
 *     `frozenColumns`, `singleClickEdit`, `selectionResetKey`,
 *     `disableInnerScroll`, `borderless`) was already declared then, and is
 *     still declared now;
 *   - the two keys that survived that diff, `renderCellEditor` and
 *     `cellClassName`, were DECLARED by objectui#6882 (maintainer ruling
 *     2026-08-30) on three surfaces:
 *       · `packages/types/src/data-display.ts` — the members themselves
 *       · `packages/types/src/zod/data-display.zod.ts` — the Zod mirror
 *       · `packages/types/src/__tests__/data-table-declared-keys-6882.test.ts`
 *         — an `Equal` (not `extends`) exact-shape pin
 *
 * ⇒ The ruling this census was filed for HAPPENED, and it went the declare way.
 * `ObjectGridDataTableSchemaHolds` below is therefore redundant rather than
 * load-bearing — the position `headerIcon` reached at objectui#6615 — and
 * removing it is the same separate, MEASURED step objectui#6424 took there. Its
 * docblock carries what #7196 measured toward that.
 *
 * ### What the two entries used to say, and what is true instead
 *
 *   - `renderCellEditor` — said HELD, read "via its own `(schema as any)`
 *     cast", and called the `packages/types` ruling still open. All three are
 *     over: the key is declared, the cast went with the declaration
 *     (`data-table.tsx` reads `schema.renderCellEditor` directly; the line where
 *     the cast stood still spells it, as a quotation inside its own
 *     correction), and the ruling landed. BEHAVIOUR is unchanged and always
 *     was — a returned widget takes the cell, `null` falls through to the
 *     built-in text / number / date inputs.
 *   - `cellClassName` — said HELD, and described the key as folded "into every
 *     body cell's `className`". The hold is over (declared by the same #6882);
 *     the DESCRIPTION was wrong from the day it was written, which is the more
 *     useful half of this correction. Measured: `data-table.tsx` folds the
 *     SCHEMA-level key at exactly three sites and every one is a UTILITY cell —
 *     the selection checkbox, the row-number cell, the row-actions cell. It
 *     never reaches a data cell; a data cell folds `col.cellClassName`, the
 *     per-column twin declared on `TableColumn`. The two class slots style
 *     DISJOINT cells and never combine on one. So what breaks when the schema
 *     key is absent is NOT "density stops reaching cells": data cells keep
 *     their density, because `applyDensity` below puts the same class on every
 *     column. What breaks is the checkbox / row-number / row-actions cells
 *     falling out of height alignment with the data beside them, which is why
 *     this grid sets BOTH slots. #6882's declaration is where the authoritative
 *     version of this now lives; this is the local copy agreeing with it.
 *
 * ⛔ The old closing note ("do not fix either hold by declaring the key on
 * `DataTableSchema` as a rider — that package is published surface with its own
 * review floor") governs nothing now. It was asking for the ruling to be taken
 * deliberately at that package's floor, and that is exactly how #6882 took it.
 */
type RemoveIndexSignature<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

/** `DataTableSchema`'s DECLARED members only — the index signature stripped. */
export type DeclaredDataTableSchema = RemoveIndexSignature<DataTableSchema>;

/**
 * The SCHEMA-level keys this grid holds at the seam — the schema-slot sibling
 * of `ObjectGridColumnHolds`. Shapes mirror the CONSUMER's reads in
 * `data-table.tsx`, not what this file happens to pass.
 *
 * ⚠️ "Undeclared by `DataTableSchema`" was this type's ENTRY CONDITION, and —
 * exactly as `ObjectGridColumnHolds` warns about its own — it is a claim about
 * ANOTHER package that can stop being true with nothing going red here. It
 * stopped being true on 2026-08-30: objectui#6882 declared BOTH members. As of
 * objectui#7196 this type holds nothing; every member is redundant with
 * `DeclaredDataTableSchema`.
 *
 * ⛔ Kept rather than deleted, because deleting a member of an EXPORTED type is
 * a change of a different kind and gets its own card — the order objectui#6615
 * → #6424 took for `headerIcon`. What #7196 measured, so that card can start
 * from a reading instead of a guess:
 *
 *   - each member's shape is `Equal` (not merely assignable) to the upstream
 *     declared member, so removing it cannot narrow or widen the seam;
 *   - the seam's `cellClassName` is already reduced (`string & string` is
 *     `string`), while its `renderCellEditor` resolves to the SAME signature
 *     intersected with itself. That is inert — mutually assignable with the
 *     declared member, measured in both directions — but it is the one visible
 *     trace the redundant hold leaves, and it is what the exact-shape pin in
 *     `packages/types` would report if pointed at the seam type;
 *   - unlike `ObjectGridColumnHolds.pinned`, neither member is its own ONLY
 *     declaration on the emitted type, so deleting them deletes nothing from
 *     it. That is precisely the ⛔ contrast `ObjectGridColumnHolds` spells out,
 *     and this type is now on the other side of it.
 *
 * ⛔ Nothing above is mechanically checked, which is how it went stale unseen.
 * `dataTableSchemaSlot-6459.test.ts` pins that the seam ACCEPTS both keys — an
 * assertion that stays green whether they are held HERE or declared THERE, so
 * it could not have caught this. The column-level twin IS guarded
 * (`columnHoldsExpiry-6424.test.ts` asserts `TableColumn` does NOT declare
 * `pinned`), and that is the shape a guard for this type would take. #7196
 * files it as a separate finding; ⛔ do not add it as a rider here.
 */
export type ObjectGridDataTableSchemaHolds = {
  /**
   * REDUNDANT since objectui#6882 (2026-08-30) — `DataTableSchema` declares this
   * key itself now, with a shape measured `Equal` to this one. `data-table`
   * calls it to render a host cell editor; returning `null` falls through to the
   * built-in text / number / date inputs. objectui#7188 added `pendingRow` (the
   * persisted `row` merged with the row's staged, unsaved edits) upstream, and
   * this copy carries it too so the seam's intersection stays INERT — `Equal`
   * in both directions, as #7196 measured — rather than becoming a second,
   * narrower signature that a `pendingRow`-reading host would trip on.
   */
  renderCellEditor?: (ctx: {
    column: any;
    row: any;
    pendingRow: any;
    value: any;
    stage: (v: any) => void;
    commit: (v?: any) => void;
    cancel: () => void;
  }) => React.ReactNode;
  /**
   * REDUNDANT since objectui#6882 (2026-08-30) — `DataTableSchema` declares this
   * key itself now, with a shape measured `Equal` to this one. `data-table`
   * folds it into the three UTILITY body cells (selection, row-number,
   * row-actions) and never into a data cell, which folds
   * `TableColumn.cellClassName` instead.
   */
  cellClassName?: string;
};

/** What this grid is allowed to write into the `data-table` schema slot. */
export type ObjectGridDataTableSchema =
  DeclaredDataTableSchema & ObjectGridDataTableSchemaHolds;

/** The row heights this grid styles — the five `RowHeight` values the spec admits. */
type RowHeightMode = 'compact' | 'short' | 'medium' | 'tall' | 'extra_tall';

/**
 * The ONE answer this component gives for a `rowHeight` it does not recognize
 * (objectui#4443).
 *
 * The seed used to be `schema.rowHeight ?? 'compact'`, which made the component
 * answer the same question two ways: an ABSENT `rowHeight` landed on `compact`,
 * an OFF-SPEC one fell through the density ternaries below to their terminal
 * `else` — the `medium` styling. That is the absent-vs-off-spec split #4440
 * removed from `ListView`, and a third answer to a question `@object-ui/core`
 * (`rowHeightToDensityMode`, which abstains) and the `@object-ui/react` spec
 * bridge (#4352, which abstains) had already settled. One metadata-driven
 * system, one answer: off-spec renders exactly like absent.
 *
 * The ternary chains are deliberately NOT touched — `medium` is a real value
 * with its own arm, and a leaf renderer's terminal `else` is legitimate styling.
 * Narrowing happens here, at the boundary, so nothing off-spec ever reaches it.
 *
 * Membership is tested against `ROW_HEIGHT_TO_DENSITY_MODE` rather than a local
 * list so the admitted values have one definition in the repo; that table is
 * typed `Record<RowHeight, DensityMode>`, so the build fails if the spec grows a
 * sixth row height and this resolver is not taught about it.
 *
 * `hasOwnProperty`, not `in`: `in` walks the prototype chain, so `'toString'`
 * would come back admitted. That is not hypothetical here — the toolbar's icon
 * map is looked up by the same key, and a prototype member reached
 * `Object.prototype.toString` and rendered it as a React component, while a
 * plain off-spec value produced `undefined` and threw outright.
 */
function resolveRowHeightMode(rowHeight: unknown): RowHeightMode {
  if (typeof rowHeight !== 'string') return 'compact';
  if (!Object.prototype.hasOwnProperty.call(ROW_HEIGHT_TO_DENSITY_MODE, rowHeight)) return 'compact';
  return rowHeight as RowHeightMode;
}

export const ObjectGrid: React.FC<ObjectGridComponentProps> = ({
  schema,
  dataSource,
  onEdit,
  onDelete,
  onBulkDelete,
  onRowSelect,
  onRowClick,
  onCellChange,
  onRowSave,
  onBatchSave,
  onAddRecord,
  // The host-driven mode (`ObjectGridExternalPaginationProps`). Every one of
  // these was read out of `...rest` through an `as any` cast until #4277 gave
  // them a declaration; they are ordinary typed props now, and `rest` is gone
  // with them. Renamed on the way in only where the component already owns the
  // plain name (`data` is the fetched rows, `pageSize` the schema's).
  data: passedData,
  manualPagination: hostManualPagination,
  rowCount: hostRowCount,
  page: hostPage,
  pageSize: hostPageSize,
  onPageChange: hostOnPageChange,
  onPageSizeChange: hostOnPageSizeChange,
  sort: hostSort,
  onSortChange: hostOnSortChange,
  search: hostSearch,
  onSearchChange: hostOnSearchChange,
  findParams: hostFindParams,
  onColumnStateChange,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Tenant default currency (ADR-0053) backstops amount cells that lack a code.
  const { currency: tenantCurrency } = useLocalization();
  // The one date/number locale resolver: tenant regional default → active UI
  // language → 'en' (objectui#4272). Read unconditionally at component level.
  const displayLocale = useDisplayLocale();
  const { t } = useGridTranslation();
  const { fieldLabel: resolveFieldLabel, translateOptions, actionLabel: resolveActionLabel } = useSafeFieldLabel();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [useCardView, setUseCardView] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rowHeightMode, setRowHeightMode] = useState<RowHeightMode>(resolveRowHeightMode(schema.rowHeight));
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  // Bumped to tell the underlying table to drop its internal checkbox selection.
  // The table owns that state, so clearing our `selectedRows` alone would leave
  // the checkboxes ticked (toolbar gone, rows still visibly selected).
  const [selectionResetKey, setSelectionResetKey] = useState(0);
  const [totalMatching, setTotalMatching] = useState<number | undefined>(undefined);
  const [activeBulkDef, setActiveBulkDef] = useState<BulkActionDef | null>(null);
  const [activeBulkRows, setActiveBulkRows] = useState<any[]>([]);
  // Selected records the def's `visible` excluded (#3067) — shown in the
  // dialog so a run over fewer records than the user picked says so.
  const [activeBulkSkipped, setActiveBulkSkipped] = useState(0);
  const lastFindParamsRef = React.useRef<Record<string, unknown> | null>(null);
  // Grouped view paginates whole groups (groups stay intact, never split across
  // pages). Defaults to the schema page size, falling back to 10 groups/page.
  const [groupedPage, setGroupedPage] = useState(1);
  const [groupedPageSize, setGroupedPageSize] = useState<number>(
    (schema.pagination as any)?.pageSize ?? schema.pageSize ?? 10,
  );

  // Sync internal rowHeightMode when schema.rowHeight prop changes (e.g., parent ListView density toggle).
  // Routed through the same resolver as the seed above: this is the component's
  // second entry point for an author-supplied `rowHeight`, and one resolver at
  // every entry is what keeps the answer single (objectui#4443).
  React.useEffect(() => {
    if (!schema.rowHeight) return;
    const next = resolveRowHeightMode(schema.rowHeight);
    if (next !== rowHeightMode) {
      setRowHeightMode(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.rowHeight]);

  // Column state persistence (order and widths)
  const columnStorageKey = React.useMemo(() => {
    return schema.id
      ? `grid-columns-${schema.objectName}-${schema.id}`
      : `grid-columns-${schema.objectName}`;
  }, [schema.objectName, schema.id]);

  /**
   * NON-AUTHOR SURFACE — `columnState` is deliberately absent from
   * `GRID_QUERY_INPUTS` (`index.tsx`), by the maintainer ruling of 2026-08-18
   * on objectui#5091. The cast reads in this block are therefore DELIBERATELY
   * unlisted, not missed.
   *
   * It is the USER-STATE persistence payload, not authoring surface: the host
   * hands in whatever the user last saved (`app-shell/src/views/ObjectView.tsx`
   * :1848 reads it off the view def) and writes their drags back through
   * `dataSource.updateViewConfig` (`persistViewPatch`, same file :1867;
   * `saveColumnState` below is the outbound half). Publishing it would put
   * column widths and order in the designer panel and in the generated
   * `sdui-intrinsics.d.ts` — i.e. bless hand-authoring a payload the product
   * writes on the user's behalf.
   *
   * The contract says the same thing independently: `ComponentPropsMap
   * ['object-grid']` (`@objectstack/spec@17`) is a `strictObject` and rejects
   * `columnState` BY NAME (`unrecognized_keys`), so an author who took the
   * offer could not save the document. Both halves — unlisted here, rejected
   * there — are pinned by `__tests__/gridNonAuthorKeys.test.tsx`, together with
   * the reads themselves, so this exemption cannot decay into a silent drop.
   */
  const [columnState, setColumnState] = useState<ObjectGridColumnState>(() => {
    // Priority: 1) externally provided (e.g. persisted view override),
    // 2) localStorage (per-browser fallback), 3) empty.
    const fromProps = (schema as any).columnState;
    if (fromProps && typeof fromProps === 'object') return fromProps;
    try {
      const saved = localStorage.getItem(columnStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sync when external columnState changes (e.g. switching views, reload pulls
  // a saved override from the server). Wrapped in a stable string key to
  // avoid re-renders when the parent passes a fresh-but-equal object.
  // Non-author surface, same ruling as the seed above (objectui#5091): these
  // two reads are the host's inbound channel, never an authored key.
  const externalColumnStateKey = React.useMemo(
    () => JSON.stringify((schema as any).columnState ?? null),
    [(schema as any).columnState]
  );
  React.useEffect(() => {
    const fromProps = (schema as any).columnState;
    if (fromProps && typeof fromProps === 'object') {
      setColumnState(fromProps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalColumnStateKey]);

  const saveColumnState = useCallback((state: typeof columnState) => {
    setColumnState(state);
    try {
      localStorage.setItem(columnStorageKey, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to persist column state:', e);
    }
    // Notify parent so it can persist via dataSource.updateViewConfig.
    if (typeof onColumnStateChange === 'function') {
      try { onColumnStateChange(state); } catch (e) { console.warn('onColumnStateChange threw:', e); }
    }
  }, [columnStorageKey, onColumnStateChange]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handlePullRefresh,
    enabled: !!dataSource && !!schema.objectName,
  });

  // Activate the mobile card view below the 768px app mobile breakpoint so
  // phones and tablet-portrait never need to side-scroll a wide grid.
  useEffect(() => {
    const checkWidth = () => setUseCardView(window.innerWidth < 768);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // `passedData` — data handed down directly (from ListView) — is destructured
  // from props above.

  // Resolve bound data if 'bind' property exists
  const boundData = useDataScope(schema.bind);

  // Get data configuration (supports both new and legacy formats)
  const rawDataConfig = getDataConfig(schema);
  // Memoize dataConfig using deep comparison to prevent infinite loops
  const dataConfig = React.useMemo(() => {
    // If we have passed data (highest priority), treat it as value provider
    if (passedData && Array.isArray(passedData)) {
        return {
            provider: 'value',
            items: passedData
        };
    }

    // If we have bound data, it takes precedence as inline value
    if (boundData && Array.isArray(boundData)) {
        return {
            provider: 'value',
            items: boundData
        };
    }
    return rawDataConfig;
  }, [JSON.stringify(rawDataConfig), boundData, passedData]);
  
  const hasInlineData = dataConfig?.provider === 'value';

  // External (parent-driven) server pagination. When a host like ListView fetches
  // the data itself, it passes the current window down as `data` AND hands us the
  // real match total + page controls. We must forward those straight to DataTable
  // instead of client-slicing the window — otherwise the footer would report
  // "pages = window / pageSize" and records beyond the window stay unreachable
  // (framework #2212). `data` is a prop, and so are these — all declared on
  // `ObjectGridExternalPaginationProps` since #4277.
  const externalManualPagination =
    hostManualPagination === true &&
    typeof hostRowCount === 'number' &&
    typeof hostOnPageChange === 'function';

  // Extract stable primitive/reference-stable values from schema for dependency arrays.
  // This prevents infinite re-render loops when schema is a new object on each render
  // (e.g. when rendered through SchemaRenderer which creates a fresh evaluatedSchema).
  const objectName = dataConfig?.provider === 'object' && dataConfig && 'object' in dataConfig
    ? (dataConfig as any).object
    : schema.objectName;
  // [#3391] Server-resolved effective API operation set for this object
  // (/me/permissions `apiOperations`). The Export button and handler AND their
  // gate with this — a missing set (unrestricted object / old backend / no
  // provider) keeps the current behavior. The frontend consumes the effective
  // set the server resolved; it never reads the raw `apiMethods`.
  const perms = usePermissions();
  const { getObjectApiOperations } = perms;
  const effectiveApiOps = objectName ? getObjectApiOperations(objectName) : undefined;
  // [#4096] The CURRENT PRINCIPAL's write verdict on this object, the same
  // source the toolbar's `can(obj, 'create')` reads (`/me/permissions`
  // `allowEdit` / `allowDelete`). `effectiveApiOps` above cannot stand in for
  // it: that set is the object's API exposure surface and is identical for
  // every account, so the row kebab and the bulk bar used to fail open for a
  // read-only principal. Undefined when no object name is resolved (element
  // data source), which leaves the affordance verdict untouched.
  const permissionUpdate = objectName ? perms.can(objectName, 'update') : undefined;
  const permissionDelete = objectName ? perms.can(objectName, 'delete') : undefined;
  // [#5148] …and the same verdict for `create`, the third face of the shape.
  // Its two siblings above have carried the principal's own grant since #4096
  // while the inline add-record row below rode on the author-declared
  // `operations.create` ALONE — a flag that says whether the affordance was
  // WIRED, never a permission grant. One component therefore answered "may
  // this user create records here?" two opposite ways on the same screen: the
  // toolbar's New button hid itself for a principal with no grant, while the
  // add row underneath stayed live and walked that user through a write it
  // already knew the server would 403. Resolved here beside its siblings so
  // the three read as one block rather than drifting apart again.
  const permissionCreate = objectName ? perms.can(objectName, 'create') : undefined;

  // [#5143] Whether THIS principal may edit THIS object's rows in place — the
  // single verdict behind every inline-edit affordance this grid renders
  // (`editable`, the cell editor, and the save/cancel column that serves them).
  //
  // `permissionUpdate` above was resolved for the row kebab and consumed by
  // nothing else, while the inline-edit props read `schema.editable` raw. That
  // left one component answering "may this user write these records?" two
  // opposite ways on the same rows: the kebab hid Edit for a read-only
  // principal, and a declaratively-authored `object-grid` block carrying
  // `editable: true` dropped that same principal straight into editable cells,
  // to be stopped only by the server's 403. No data ever landed (the server
  // gate is solid) — the cost was a round-trip the UI guaranteed would fail.
  //
  // #4647 closed the ListView door with this exact conjunction (PR #5145,
  // `inlineEditOffered`); the SDUI-authored grid schema is a SECOND, independent
  // door into the same state that never passes through ListView. Spelling the
  // gate identically here is what keeps the two from drifting: the object's
  // resolved affordance — ADR-0103 bucket ∧ `userActions.edit` ∧ the server's
  // effective API operations (#3391/#3546), which is what `isObjectInlineEditable`
  // names — AND the current principal's own grant (#4096).
  //
  // Fail-open, like every sibling gate in this file. `can()` answers `true`
  // with no `PermissionProvider`, and `isObjectInlineEditable` resolves the
  // default-writable bucket for a null/absent object schema, so a standalone
  // embed, the Studio designer, and a pure inline-data grid with no object
  // semantics at all keep today's behavior. The narrowing only ever engages
  // where there IS an object to have a verdict about.
  const objectInlineEditable =
    isObjectInlineEditable(objectSchema, effectiveApiOps) &&
    (objectName ? perms.can(objectName, 'update') : true);

  // [#5143] The authored request ∧ the verdict — resolved ONCE and read by all
  // three inline-edit props below (`editable`, `renderCellEditor`, and the
  // save/cancel `rowActions` column). Three sites re-deriving `schema.editable`
  // is how they came to disagree in the first place; one name is what keeps a
  // future prop from being added on the raw key again.
  //
  // The authored key stays the gate's left half, so this narrows and never
  // widens: no verdict can turn inline editing ON for a grid that did not ask
  // for it.
  //
  // When ListView owns this grid it has already ANDed its own copy of this
  // conjunction into the `editable` it hands down (#4647 / PR #5145), so on
  // that path the second application is idempotent — A ∧ B, then ∧ B again.
  // The two are NOT the same predicate everywhere, though, and the difference
  // runs in the safe direction: ListView reads `schema.objectName`, while
  // `objectName` here is `dataConfig.object ?? schema.objectName`. A grid whose
  // object identity arrives only through its data config (`{ provider:
  // 'object', object: … }`, no top-level `objectName`) falls through ListView's
  // `schema.objectName ? … : true` branch OPEN and is judged solely here. This
  // gate is therefore the only one on that shape, not a redundant copy of
  // ListView's — verified rather than assumed, since "it's already gated
  // upstream" is exactly the reasoning that left this door open to begin with.
  const inlineEditable = (schema.editable ?? false) && objectInlineEditable;

  // When the consumer wired onEdit/onDelete callbacks but the view schema
  // omits an explicit `operations` block, default to allowing those actions.
  // This gives every main list a Row actions kebab out of the box without
  // forcing every view JSON to declare operations: { update: true, delete: true }.
  const explicitOperations = 'operations' in schema ? schema.operations : undefined;
  const operations = explicitOperations ?? {
    update: !!onEdit,
    delete: !!onDelete,
  };
  // Row actions can declare 'edit' / 'delete' as canonical strings — treat
  // them as equivalent to operations.update / operations.delete so the
  // dropdown surfaces native Edit/Delete entries (with proper icons) and
  // routes them to onEdit / onDelete instead of the generic action runner
  // (which has no 'edit' handler and a parameter-shape mismatch for 'delete').
  const rowActionsList: string[] = Array.isArray(schema.rowActions) ? schema.rowActions : [];
  /**
   * NON-AUTHOR SURFACE — `rowActionDefs` is deliberately absent from
   * `GRID_QUERY_INPUTS` (`index.tsx`), by the maintainer ruling of 2026-08-19
   * on objectui#5091. Both cast reads on the line below are therefore
   * DELIBERATE, not missed.
   *
   * That ruling KNOWINGLY REVERSES one line of the 2026-08-18 ruling on the
   * same card, which had sent this key INTO the manifest as the "symmetric
   * partner" of the declared `bulkActionDefs`. The symmetry premise did not
   * survive measurement, and the reversal was flagged and accepted on the
   * record:
   *
   *   - The PRODUCER derives it. `app-shell/src/views/ObjectView.tsx:1968`
   *     builds this key from `objectDef.actions` filtered by
   *     `locations.includes('list_item')`, then localizes each def — see its
   *     own docblock there. Twenty lines below it, `bulkActionDefs` is passed
   *     STRAIGHT THROUGH from the view author. The two keys are asymmetric by
   *     construction: one is computed for the grid, the other is authored.
   *   - The contract refuses it. `ComponentPropsMap['object-grid']`
   *     (`@objectstack/spec@17`) is a `strictObject` that accepts
   *     `bulkActionDefs` and answers `unrecognized_keys` for THIS key, so an
   *     author who took a published offer could not save the document.
   *   - `@object-ui/types`' `ObjectGridSchema` declares `bulkActionDefs` and no
   *     `rowActionDefs` — which is why this read is a cast in the first place.
   *
   * The AUTHORED way to put an action on a row is unchanged and stays declared:
   * `locations: ['list_item']` on the object's own action, plus the legacy
   * `rowActions` name list (`GRID_QUERY_INPUTS`, `index.tsx:190`) that the fold
   * below resolves against the object. Both halves — unlisted here, rejected
   * there — are pinned by `__tests__/gridNonAuthorKeys.test.tsx`, together with
   * the read itself, so this exemption cannot decay into a silent drop.
   */
  const rowActionDefsList: any[] = Array.isArray((schema as any).rowActionDefs) ? (schema as any).rowActionDefs : [];
  const wantEditAction = rowActionsList.includes('edit');
  const wantDeleteAction = rowActionsList.includes('delete');
  // Legacy `rowActions` carry a bare action NAME, which the runner cannot
  // execute on its own — resolve each against the object's declared actions so
  // it dispatches as a real def (and so a name that duplicates an existing
  // `list_item` def stops rendering a dead twin of it). See
  // `resolveLegacyRowActions` for the full rationale (objectui#2960).
  const { defs: resolvedRowActionDefs, unresolved: customRowActions } = resolveLegacyRowActions({
    rowActions: rowActionsList.filter(a => a !== 'edit' && a !== 'delete'),
    rowActionDefs: rowActionDefsList,
    objectActions: (objectSchema as any)?.actions,
  });
  // Honor the object's resolved CRUD affordance: the ADR-0103 lifecycle bucket
  // (`managedBy`), the `userActions.edit`/`delete` override — explicit `false`
  // opts out of the generic row Edit/Delete (e.g. sys_environment ships a
  // dedicated Rename + cascade-Delete instead, and the generic entries would
  // duplicate them) — and [#3720] the server's effective API operation set, so
  // the row kebab never offers an update/delete the server would reject.
  // `operations` above only says whether the CONSUMER wired the affordance; it
  // is not a permission grant, which is why the object verdict is ANDed here
  // rather than assumed to have been applied upstream.
  // [#4096] …and neither is `apiOperations`, which describes the OBJECT, not
  // the caller — so the principal's own `allowEdit` / `allowDelete` is ANDed on
  // top, matching the toolbar and the record header on the very same screen.
  //
  // Resolved HERE, above the error / loading early returns, rather than beside
  // the row-actions column it feeds: the record-level layer below is a hook and
  // may not sit behind a conditional return.
  const { canEdit, canDelete, objectCanDelete, editPredicates, deletePredicates, objectDeletePredicates } = resolveRowCrudAffordances({
    operationsUpdate: operations?.update,
    operationsDelete: operations?.delete,
    wantEditAction,
    wantDeleteAction,
    hasOnEdit: !!onEdit,
    hasOnDelete: !!onDelete,
    managedBy: (objectSchema as any)?.managedBy,
    // KEY COLLISION — the OBJECT's block, and the only one this can consume.
    // `userActions` names two different shapes: on a VIEW it is toolbar policy
    // (`UserActionsConfigSchema` — `sort`/`search`/`filter`/`refresh`/
    // `rowHeight`/`addRecordForm`/`editInline`/`buttons`, which rejects `edit`
    // BY NAME), on an OBJECT it is the CRUD-predicate block `edit`/`delete`/
    // `create` carrying `visibleWhen`/`disabledWhen`. Only the object block
    // means anything to `resolveRowCrudAffordances` — or to
    // `listViewPredicates` at the `$select` read below, which carries the full
    // measurement. So this read stays `objectSchema`-only and must never gain a
    // `(schema as any).userActions ??` left operand: that is the shadowing this
    // grid was fixed for (maintainer ruling of 2026-08-20 on objectui#5240,
    // Q3=B). Pinned by `__tests__/gridNonAuthorKeys.test.tsx`.
    userActions: (objectSchema as any)?.userActions,
    effectiveApiOperations: effectiveApiOps,
    permissionUpdate,
    permissionDelete,
  });
  // [#4296] …and neither of those describes the ROW. `allowEdit` is the
  // principal's verdict on the OBJECT; `writeScope`, the sharing model and RLS
  // narrow it per record, so everything above fails OPEN for every row the
  // principal does not own — the kebab offered Edit/Delete on rows the server
  // answers 403 for, while the record detail header (which has ANDed the
  // record-grained verdict since objectstack#3821) correctly hid both on the
  // very same record. One batched explain call per (object, operation) for the
  // rows on screen answers it for the whole page; rows with no answer keep the
  // object-level verdict (see `useRecordCrudVerdicts` — fail open, never
  // over-hide).
  const pageRecordIds = useMemo(
    () => Array.from(new Set(
      data.map(rowRecordId).filter((id) => id != null).map((id) => String(id)),
    )),
    [data],
  );
  const recordVerdict = useRecordCrudVerdicts({
    objectName,
    recordIds: pageRecordIds,
    update: canEdit,
    delete: canDelete,
  });

  const schemaFields = schema.fields;
  const schemaColumns = schema.columns;
  // [objectui#7179] The fetch effect's dep on the grouping block, as a CONTENT
  // key over the field NAMES alone.
  //
  // Not `schema.grouping` itself: hosts rebuild that object literal every
  // render (`plugin-list` spreads a fresh `{ grouping: groupingConfig }` into
  // the node it hands down), so naming it here would re-issue the query on
  // every render — the identity-churn refetch storm objectui#6697 recorded for
  // `expandFields`.
  //
  // Names ONLY, not the whole block: `order` and `collapsed` are render-time
  // concerns the projection cannot see, so a user collapsing a group must not
  // cost a round trip. What the query depends on is exactly this list.
  const groupingProjectionKey = useMemo(
    () => JSON.stringify(collectGroupingFieldRefs(schema.grouping)),
    [schema.grouping],
  );
  // The view's declared filter, lowered ONCE through the repo's single filter
  // sink for both consumers below (the fetch and the server-side export).
  //
  // The lowering is what makes the authoring surface honest rather than merely
  // reachable (objectui#4041). Until this block published `filter`, the only
  // thing that could arrive here was an ObjectQL AST synthesized by
  // `ElementDataSourceGate`, and passing that through verbatim was right. An
  // AUTHOR writes the spec's view vocabulary instead — `ViewFilterRule[]`,
  // `[{ field, operator, value }]` — and that shape byte-copied onto `$filter`
  // is refused on the wire: `isFilterAST` is false for an array of objects and
  // the data API answers `400 INVALID_FILTER` (measured against a real backend
  // in objectui#3431). Declaring the key without this hop would have traded a
  // silent wrong answer for a guaranteed failure, which is not a fix.
  //
  // `toFilterNode` is that hop by design — the last stop before the wire, where
  // a value legitimately leaves the spec's view vocabulary and becomes an AST
  // (see its doc for why the fold cannot live at the producer). It passes AST
  // nodes through untouched, so the `ElementDataSourceGate` path is unchanged;
  // it also collects the MongoDB-style object shape, and returns `undefined`
  // for an absent or empty source so we skip `$filter` rather than sending an
  // empty array. `plugin-list`'s `buildEffectiveFilter` and `plugin-view`'s
  // `ObjectView` already reach the wire through this same sink; this read point
  // was the last consumer on the chain that did not.
  const schemaFilterSource = schema.filter;
  const schemaFilter = useMemo(() => toFilterNode(schemaFilterSource), [schemaFilterSource]);
  const schemaSort = schema.sort;
  const schemaPagination = schema.pagination;
  const schemaPageSize = schema.pageSize;

  // Server-side ("manual") pagination for the flat list view. The fetch window
  // ($top/$skip) and the DataTable's display page size are the SAME number here
  // — the records we hold ARE one page, so paging means refetching the next
  // slice from the server instead of slicing an in-memory batch. This is what
  // makes records beyond the first batch reachable at all (framework #2212).
  const [serverPage, setServerPage] = useState(1);
  const [serverPageSize, setServerPageSize] = useState<number>(
    (schema.pagination as any)?.pageSize ?? schema.pageSize ?? 50,
  );

  // Column-header sort, when this grid fetches its own rows (objectui#3106).
  // `null` means "nobody has clicked a header" and the view's declared
  // `schema.sort` is in force; once set it REPLACES that sort for the whole
  // collection, not for the window on screen.
  const [headerSort, setHeaderSort] = useState<TableSortItem[] | null>(null);
  // A view whose declared sort changes underneath us (view switch, saved-view
  // edit) invalidates a header sort taken against the previous one.
  useEffect(() => { setHeaderSort(null); }, [JSON.stringify(schema.sort ?? null)]);

  // Toolbar search term, when this grid fetches its own rows (objectui#3118).
  // It goes out as `$search` on the refetch — the server decides which fields
  // it matches from the object's metadata (ADR-0061), the same channel the
  // ListView toolbar uses. Filtering the rows we hold instead would search the
  // page on screen and call the answer "the results in this list".
  const [searchTerm, setSearchTerm] = useState('');
  // A term is asked of one collection. Pointing the grid at another object
  // makes it a question about rows it was never typed for.
  useEffect(() => { setSearchTerm(''); }, [objectName]);

  // --- Inline data effect (synchronous, no fetch needed) ---
  useEffect(() => {
    if (hasInlineData && dataConfig?.provider === 'value') {
       // Only update if data is different to avoid infinite loop
       setData(prev => {
         const newItems = dataConfig.items as any[];
         if (JSON.stringify(prev) !== JSON.stringify(newItems)) {
            return newItems;
         }
         return prev;
       });
       setLoading(false);
    }
  }, [hasInlineData, dataConfig]);

  // --- Inline data: still fetch objectSchema for type-aware rendering ---
  // When data is inline (provider: 'value'), we skip the data fetch but still need
  // the object schema to resolve field types (lookup, select, currency, etc.) and
  // enable proper CellRenderer selection.
  useEffect(() => {
    if (!hasInlineData) return;
    if (!objectName || !dataSource) return;

    let cancelled = false;

    const fetchSchema = async () => {
      try {
        if (typeof dataSource.getObjectSchema !== 'function') return;
        const schemaData = await dataSource.getObjectSchema(objectName);
        if (!cancelled) {
          setObjectSchema(schemaData);
        }
      } catch (err) {
        // Schema fetch failure for inline data is non-fatal; columns will
        // still fall back to heuristic inference.
        console.warn(`[ObjectGrid] Failed to fetch objectSchema for inline data (objectName: ${objectName}):`, err);
      }
    };

    fetchSchema();

    return () => { cancelled = true; };
  }, [hasInlineData, objectName, dataSource]);

  // --- Unified async data loading effect ---
  // Combines schema fetch + data fetch into a single async flow with AbortController.
  // This avoids the fragile "chained effects" pattern where Effect 1 sets objectSchema,
  // triggering Effect 2 to call fetchData — a pattern prone to infinite loops when
  // fetchData's reference is unstable.
  useEffect(() => {
    if (hasInlineData) return;

    let cancelled = false;

    const loadSchemaAndData = async () => {
      setLoading(true);
      setError(null);
      try {
        // --- Step 1: Resolve object schema ---
        let resolvedSchema: any = null;
        const cols = normalizeColumns(schemaColumns) || schemaFields;

        if (objectName && dataSource) {
          // Always fetch full schema for field type metadata (enables rich type-aware rendering)
          if (typeof dataSource.getObjectSchema === 'function') {
            const schemaData = await dataSource.getObjectSchema(objectName);
            if (cancelled) return;
            resolvedSchema = schemaData;
          } else {
            resolvedSchema = { name: objectName, fields: {} };
          }
        } else if (cols && objectName) {
          // Fallback: minimal schema stub when no dataSource available
          resolvedSchema = { name: objectName, fields: {} };
        } else if (!objectName) {
          throw new Error('Object name required for data fetching');
        } else {
          throw new Error('DataSource required');
        }

        if (!cancelled) {
          setObjectSchema(resolvedSchema);
        }

        // --- Step 2: Fetch data ---
        if (dataSource && objectName) {
          // [objectui#7179] The fields the view GROUPS BY. `grouping` is a
          // sibling of `columns` in the spec, not a subset of it, so a grid may
          // legitimately group by a field it never shows — and until this
          // harvest existed, `$select` (built from `columns` alone) never asked
          // for it, so every row carried `undefined` and `useGroupedData`
          // labelled ONE group `(empty)` holding every record.
          //
          // Raw here, GATED at each of its two use sites below, because the two
          // sites need different gates: the projection has to intersect with
          // the declared fields (an unknown `$select` key ZEROES the list on
          // backends that reject rather than ignore it), while `$expand` is
          // gated structurally by `buildExpandFields` itself.
          const groupingFieldRefs = collectGroupingFieldRefs(schema.grouping);
          const getSelectFields = () => {
            // Always include 'id' so row click / navigation handlers can resolve
            // the record key — without it `record.id` is undefined and the
            // primary-field link silently no-ops.
            // Both halves used to resolve identity differently — the probe was
            // name-first while the projection below read `c.field` alone — so a
            // legacy `{name}` column was projected as `undefined` while the
            // probe happily saw its name (#3104). One reader now, both halves.
            const ensureId = (list: any[]): any[] => {
              const names = list.map((f: any) => columnIdentity(f));
              return names.includes('id') ? list : ['id', ...list];
            };
            // [objectui#6898] FIELD-LEVEL SECURITY ON THE PROJECTION — the FETCH
            // half of the gap objectui#6799 closed on the RENDER half.
            //
            // objectui#6799 made `generateColumns()` drop a column naming a
            // declared field the principal cannot read. That is what reaches the
            // SCREEN. This is what goes on the WIRE: without this gate the same
            // field name is still handed to the server in `$select`, so a
            // backend that does not enforce FLS on the projection would return
            // the value into `data` with no column on screen to reveal it.
            //
            // ⭐ MEASURED, not assumed (the escalation gate this card was graded
            // on). ObjectStack's own server DOES enforce it — but on the RECORD,
            // not on the projection. `plugin-security`'s read middleware runs
            // `FieldMasker.maskResults`, whose `maskRecord` DELETES an unreadable
            // key from every returned row, and `predicate-guard.ts` says in terms
            // that the projection is deliberately NOT guarded because "selecting
            // a hidden field is harmless because FieldMasker strips it from the
            // result". Pinned end-to-end over real HTTP by objectstack's
            // `showcase-fls-read-mask-strip.dogfood.test.ts`: an explicit
            // `?select=name,<denied>` answers 200 with the denied key ABSENT.
            // So against ObjectStack this gate is defence-in-depth (p2), exactly
            // as triage graded it — it is NOT load-bearing for that backend, and
            // this comment is what stops a future reader from concluding it is.
            // It becomes load-bearing for any other backend, which is the same
            // argument the objectui#6723 / objectui#6799 rulings accepted: the
            // invariant must not rest on every future backend having enforced it.
            //
            // ⭐ THE DECLARED-KEY LIMIT IS THE SAME ONE, AND THE CARD IS RIGHT
            // THAT THE REASONING DOES NOT TRANSFER AUTOMATICALLY — it has to be
            // re-derived here, and it lands in the same place. On the render path
            // an undeclared key is a legitimate derived / host-joined column. In
            // a `$select` an undeclared key is what the host asked the SERVER
            // for, so the question is genuinely different. It resolves the same
            // way for a reason that is about `checkField`, not about drawing:
            // `checkField` answers FALSE for a field the policy has never heard
            // of, so judging an undeclared key is not a stricter reading of this
            // rule — it is a different, wrong one, and it would strip a host's
            // derived or joined column out of its own query. Undeclared ⇒ not
            // this gate's business, on both halves.
            //
            // ⛔ NAVIGATION IS PRESERVED STRUCTURALLY, NOT BY A SPECIAL CASE:
            // every call below composes `ensureId(...)` AFTER this gate, so `id`
            // is re-added even in the pathological case where a policy marks it
            // unreadable. A gate that filtered `id` out last would break row
            // click / navigation for everyone — the naive-filter failure the
            // card names by name. Keeping the restoration in the composition
            // rather than in a branch here means it cannot drift out of one arm.
            //
            // Keyed on `objectName` (the object actually being FETCHED —
            // `dataConfig.object` when a data block names one) rather than the
            // render half's `schema.objectName`: the projection is judged against
            // whatever object the server is about to read.
            const passesProjectionGate = (entry: unknown): boolean => {
              // Not loaded ⇒ nothing to ask yet; never filter on an unanswered
              // policy. Same deferral as the render half — and the fetch effect
              // re-runs on `perms.isLoaded` so the projection is rebuilt the
              // moment the answer arrives (without that dep this gate would be
              // dead on the first, and usually only, fetch).
              if (!perms?.isLoaded || !objectName) return true;
              const fieldName = columnIdentity(entry);
              // No readable identity ⇒ nothing to ask the policy about.
              if (!fieldName) return true;
              // Undeclared ⇒ host-joined / derived / platform column ⇒ see above.
              // `hasOwnProperty` rather than a truthiness read so an inherited
              // name (`constructor`, `toString`) cannot be mistaken for a
              // declared field and dropped out of the query.
              if (!Object.prototype.hasOwnProperty.call(resolvedSchema?.fields ?? {}, fieldName)) return true;
              return perms.checkField(objectName, fieldName, 'read');
            };
            // Fields the view's PREDICATES read but no column shows
            // (objectui#3501). Without them the projection asks the
            // server for everything except the field a row action is gated on,
            // and CEL faults on the absent key (`No such key`) rather than
            // reading it as null — which fail-closed hides the button for
            // everyone, with nothing pointing at the projection. Kept to fields
            // the object actually declares: an unknown key in `$select` is not
            // ignored by every backend, and a typo'd predicate must not be able
            // to zero the list.
            const declared = resolvedSchema?.fields;
            const predicateFields = declared
              ? collectPredicateFieldRefs(listViewPredicates({
                  conditionalFormatting: schema.conditionalFormatting as unknown[] | undefined,
                  // NON-AUTHOR SURFACE, same ruling as the seed above
                  // (objectui#5091, maintainer 2026-08-19): this cast read is
                  // deliberate, not a missed manifest entry. It is the SECOND
                  // of the key's two read sites and the one with teeth — a def
                  // gated on `record.<field>` puts that field in `$select`, so
                  // deleting this read would leave the predicate's operand out
                  // of the payload and CEL would fault on the absent key
                  // (objectui#3501, the whole reason this harvest exists).
                  // Pinned by `__tests__/gridNonAuthorKeys.test.tsx`.
                  rowActionDefs: (schema as any).rowActionDefs,
                  bulkActionDefs: (schema as any).bulkActionDefs,
                  objectActions: (resolvedSchema as any)?.actions,
                  // KEY COLLISION — `userActions` names TWO different blocks,
                  // and only the OBJECT's is interpretable here. This read is
                  // therefore `resolvedSchema`-only; it must never regain a
                  // `(schema as any).userActions ??` left operand. Maintainer
                  // ruling of 2026-08-20 on objectui#5240 (Q1=A), on these
                  // measurements against `@objectstack/spec@17.0.0`:
                  //
                  //   - VIEW-level `userActions` is TOOLBAR POLICY —
                  //     `UserActionsConfigSchema` (`sort`, `search`, `filter`,
                  //     `refresh`, `rowHeight`, `addRecordForm`, `editInline`,
                  //     `buttons`), which REJECTS `edit` BY NAME
                  //     (`unrecognized_keys`). `ListViewSchema` accepts it, so
                  //     it is spec-legal and really authored: `react/src/
                  //     spec-bridge/bridges/list-view.ts` copies it onto the
                  //     `object-grid` node this component receives as `schema`,
                  //     and `app-shell/src/views/ObjectView.tsx` builds one
                  //     unconditionally. It is NOT an unwritten key.
                  //   - OBJECT-level `userActions` is the CRUD-PREDICATE block
                  //     (`edit` / `delete` / `create` carrying `visibleWhen` /
                  //     `disabledWhen`, objectui#2614) — what
                  //     `resolveRowCrudAffordances` consumes above, and the only
                  //     shape `listViewPredicates` can read: its loop skips
                  //     every non-object value, so a toolbar block yields ZERO
                  //     predicates.
                  //
                  // Read view-first, a legitimately authored toolbar block
                  // therefore SHADOWED the object's CRUD predicates and dropped
                  // their operands from `$select`; CEL then faults `No such
                  // key`, fails CLOSED, and the row Edit/Delete button vanishes
                  // for everyone with nothing pointing at the projection
                  // (objectui#3501 — the whole reason this harvest exists).
                  // Both halves of the collision, and this read itself, are
                  // pinned by `__tests__/gridNonAuthorKeys.test.tsx`.
                  userActions: (resolvedSchema as any)?.userActions,
                })).filter((f) => isProjectableField(f, declared as Record<string, unknown>))
                  // [objectui#6898] A predicate operand the principal cannot read
                  // is dropped from the projection too. This costs nothing that
                  // was working: against ObjectStack the server already DELETES
                  // that key from every row (measured above), so the operand was
                  // never arriving and the CEL predicate was already faulting
                  // `No such key` and failing CLOSED. Dropping it from `$select`
                  // changes what we ASK for, not what we got. Against a
                  // non-enforcing backend it converts "the button works, and the
                  // denied value sits in memory" into "the button hides" — which
                  // is the correct direction for a predicate gated on a field
                  // this principal may not read.
                  .filter((f) => passesProjectionGate(f))
              : [];
            // [objectui#7179] The GROUPING fields, through the SAME two gates
            // the predicate operands take, for the same two measured reasons.
            //
            // `isProjectableField` first: a `grouping.fields[]` entry is
            // SPECULATIVE in exactly the sense that gate exists for. Its
            // `field` is a bare `z.ZodString` and this card's whole premise is
            // that it is NOT among the columns, so nothing has validated it.
            // Some backends answer an unknown `$select` key with an EMPTY
            // RESULT SET rather than ignoring it (the cloud multi-tenant
            // runtime does exactly that), so an unguarded union would trade
            // this card's bug — one `(empty)` group holding all the rows — for
            // a strictly worse one: NO rows, equally silently. The current bug
            // at least shows the data.
            //
            // `passesProjectionGate` second (objectui#6898): a grouping field
            // names a field just as capable of being denied as a column is, and
            // this is the half that goes on the WIRE. Gating here rather than
            // after the union is what keeps that card closed.
            const groupingFields = declared
              ? groupingFieldRefs
                  .filter((f) => isProjectableField(f, declared as Record<string, unknown>))
                  .filter((f) => passesProjectionGate(f))
              : [];
            // A UNION, never an append: a grouping field that IS also a column
            // must not produce a duplicate `$select` entry.
            const extraFields = [...predicateFields, ...groupingFields];
            const withHarvestedFields = (list: any[]): any[] => {
              if (extraFields.length === 0) return list;
              const names = new Set(list.map((f: any) => columnIdentity(f)));
              const seen = new Set<string>();
              const extra = extraFields.filter(
                (f) => !names.has(f) && !seen.has(f) && (seen.add(f), true),
              );
              return extra.length > 0 ? [...list, ...extra] : list;
            };
            if (schemaFields) {
              return withHarvestedFields(ensureId((schemaFields as any[]).filter(passesProjectionGate)));
            }
            if (schemaColumns && Array.isArray(schemaColumns)) {
              const fields = schemaColumns
                .filter(passesProjectionGate)
                .map((c: any) => columnIdentity(c))
                .filter((v): v is string => !!v);
              return withHarvestedFields(ensureId(fields));
            }
            return undefined;
          };

          const params: any = {
            $select: getSelectFields(),
            $top: serverPageSize,
            $skip: (serverPage - 1) * serverPageSize,
          };

          // The block's declared `filter` input, already lowered to an AST at
          // the read point above. `undefined` means "no filter declared" —
          // including a declared-but-empty array, which `toFilterNode` folds
          // away so an empty `$filter` never goes out. The `Array.isArray` guard
          // this replaces predates the lowering and was itself a silent drop:
          // it read false for the MongoDB-style object shape, so such a filter
          // went missing and the grid answered with every record.
          if (schemaFilter !== undefined) {
            params.$filter = schemaFilter;
          } else {
            // The deprecated `defaultFilters`, through the SAME sink as the
            // canonical key above (objectui#4082). It used to be assigned
            // byte-for-byte, which made this the one leg on the chain that
            // reached the wire unlowered — `plugin-list`'s
            // `buildEffectiveFilter` and `plugin-view`'s non-grid fetch both
            // already go through `toFilterNode`/`mergeFilterNodes`.
            //
            // Byte-copying is refused on the wire for BOTH shapes this slot
            // carries. `defaultFilters` is declared `Record<string, any>`
            // (the MongoDB-style shape) and `isFilterAST` is false for a plain
            // object; `plugin-view` also forwards an active named view's
            // `ViewFilterRule[]` into this slot (`ObjectView.tsx`, the
            // `gridSchema` memo), and `isFilterAST` is false for an array of
            // rule objects too. Either one answers `400 INVALID_FILTER`
            // (measured against a real backend in objectui#3431).
            //
            // `toFilterNode` handles both without new logic: objects route
            // through `convertFiltersToAST`, rule arrays lower element-wise,
            // and an AST already in this slot passes through untouched so
            // nothing is lowered twice. It also folds an absent/empty source to
            // `undefined`, which is why the truthiness guard this replaces is
            // gone — `defaultFilters: {}` used to send `$filter: {}`, asking
            // the server a question with no content in a shape it refuses.
            const legacyFilter = toFilterNode(schema.defaultFilters);
            if (legacyFilter !== undefined) {
              params.$filter = legacyFilter;
            }
          }

          // Sort. A column-header click (objectui#3106) replaces the view's
          // declared sort for the whole collection — which is what makes the
          // arrow in the header true of the list rather than of this page.
          // The `SortNode[]` form goes out rather than the `"field order"`
          // string: it is the shape the server names in its own error messages,
          // and it survives a field name containing a space.
          if (headerSort && headerSort.length > 0) {
            params.$orderby = headerSort.map((s) => ({ field: s.field, order: s.order }));
          } else if (schemaSort) {
            if (typeof schemaSort === 'string') {
              params.$orderby = schemaSort;
            } else if (Array.isArray(schemaSort)) {
              params.$orderby = schemaSort
                .map((s: any) => `${s.field} ${s.order}`)
                .join(', ');
            }
          } else if (schema.defaultSort) {
            // Legacy support
            params.$orderby = `${(schema.defaultSort as any).field} ${(schema.defaultSort as any).order}`;
          }

          // Search (objectui#3118). The term the toolbar box holds is a question
          // about the collection, so it goes to the server rather than to a
          // `.filter()` over the window we happen to be holding. Per ADR-0061 the
          // client sends only the term; the server resolves which fields it
          // matches from the object's metadata. `$searchFields` goes along only
          // when the view declared `searchableFields` — it can narrow that
          // server-resolved set, never widen it — which is exactly what the
          // ListView toolbar sends.
          const trimmedSearch = searchTerm.trim();
          if (trimmedSearch) {
            params.$search = trimmedSearch;
            if (schema.searchableFields && schema.searchableFields.length > 0) {
              params.$searchFields = schema.searchableFields;
            }
          }

          // Auto-inject $expand for lookup/master_detail fields
          //
          // [objectui#7179] The grouping fields ride along. `$select` alone
          // fetches a lookup as its BARE FOREIGN KEY, so a grid grouped by a
          // lookup would bucket by raw id ("8UY9zHWBfjYjYor4") instead of by
          // name — better than one `(empty)` bucket, still not right, and the
          // identical failure `expandFields` in `plugin-list` already records
          // for kanban. No `isProjectableField` gate is needed on THIS half:
          // `buildExpandFields` returns a subset of the object's declared
          // reference-bearing fields, so an unknown or non-relational grouping
          // field is dropped structurally and cannot reach the query.
          //
          // Only augment when a column list actually narrows the expansion —
          // with no columns, `buildExpandFields` already expands every relation
          // and the grouping fields are covered by that superset. Passing an
          // array here unconditionally would NARROW that case to the grouping
          // fields alone.
          //
          // [objectui#7215] FIELD-LEVEL SECURITY ON `$expand` — the half
          // objectui#6898 left open. That card gated `$select`, which asks for
          // a denied lookup's BARE FOREIGN KEY; `$expand` asks the server to
          // RESOLVE the same field and hand back the related record, so the
          // larger of the two disclosures was the ungated one.
          //
          // Graded the same way #6898 was, and by measurement rather than
          // assumption: against ObjectStack this is defence-in-depth, because
          // `plugin-security`'s `FieldMasker.maskRecord` does `delete
          // result[field]` on every unreadable key and objectql's expand path
          // writes the resolved record back under THAT SAME KEY
          // (`record[fieldName] = recordMap.get(...)`), so one statement
          // deletes the expanded object and the bare id alike. It is
          // load-bearing for a backend that does not strip.
          //
          // ⭐ THE GATE GOES ON THE OUTPUT, NOT ON THE COLUMN LIST, and both
          // reasons are measured (`__tests__/expandFls-7215.test.tsx` pins
          // each):
          //
          //  - `buildExpandFields` reads an EMPTY column list as "no column
          //    restriction" and falls back to every declared relation, so
          //    filtering its INPUT would WIDEN a view whose only relational
          //    column is denied from that one field to all of them;
          //  - the no-columns case passes `undefined`, so it has no input to
          //    gate at all — and it is the case that expands the most.
          //
          // Gating the output also satisfies, structurally, the ordering the
          // `$select` gate above spells out by hand (intersect with the
          // DECLARED fields first, ask `checkField` only about survivors):
          // `buildExpandFields` returns a subset of the object's declared
          // reference-bearing fields, so every name judged here is declared by
          // construction and the "`checkField` answers false for an undeclared
          // key" trap is unreachable. That is why this gate is SHORTER than
          // `passesProjectionGate` rather than a copy of it — no undeclared-key
          // arm, and no identity read, because these are resolved root names
          // rather than column entries.
          //
          // Deferral is the same as every other gate on this path: an
          // unanswered policy filters nothing, and the effect re-runs on
          // `perms.isLoaded`, so the expansion is rebuilt the moment the answer
          // arrives.
          const expandReadable = (fieldName: string): boolean => {
            if (!perms?.isLoaded || !objectName) return true;
            return perms.checkField(objectName, fieldName, 'read');
          };
          const expandColumns = schemaColumns ?? schemaFields;
          const expand = buildExpandFields(
            resolvedSchema?.fields,
            expandColumns ? [...(expandColumns as any[]), ...groupingFieldRefs] : undefined,
          ).filter(expandReadable);
          if (expand.length > 0) {
            params.$expand = expand;
          }

          const result = await dataSource.find(objectName, params);
          if (cancelled) return;
          setData(result.data || []);
          // Capture total matching count + the params we used, so the bulk
          // selection banner can offer "Select all N matching" and the
          // dispatcher can re-issue the query to expand selection.
          const totalFromResult = (result as { total?: number }).total;
          setTotalMatching(typeof totalFromResult === 'number' ? totalFromResult : undefined);
          lastFindParamsRef.current = { ...params };
          // Reset cross-page flag whenever the underlying query changes.
          setSelectAllMatching(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSchemaAndData();

    return () => {
      cancelled = true;
    };
  // `perms.isLoaded` (objectui#6898): the projection is FLS-gated above, and
  // `/me/permissions` resolves asynchronously — on the first render it is still
  // `false`, so the gate defers and the first request goes out ungated. Without
  // this dep nothing would ever rebuild it and the gate would be dead on the
  // only fetch most grids make. The boolean, not `perms` itself: it flips
  // false -> true exactly once, so this costs at most one refetch, where the
  // context object's identity would re-fetch the grid on every render.
  // `PermissionProvider` reports `true` synchronously and the no-provider
  // default stays `false` forever, so neither of those pays anything.
  // `groupingProjectionKey` (objectui#7179): the grouping fields are part of
  // the projection now, and grouping is RUNTIME-MUTABLE (the toolbar popover
  // rewrites it), so without this dep switching the grouping field would leave
  // the query asking for the OLD one and the new grouping would read
  // `undefined` on every row — the very `(empty)` bucket this card fixes,
  // reachable a second way.
  }, [objectName, schemaFields, schemaColumns, schemaFilter, schemaSort, headerSort, searchTerm, schemaPagination, schemaPageSize, serverPage, serverPageSize, dataSource, hasInlineData, dataConfig, refreshKey, perms.isLoaded, groupingProjectionKey]);

  // The same reset, for the path the loader above never runs on (objectui#4501
  // clause 2). "All N matching are selected" is a claim about ONE query, so it
  // must not survive that query changing — the loader drops it in place (three
  // lines up, next to its `lastFindParamsRef` write), and under a host-driven
  // fetch the host's params changing is the identical signal. Without this a
  // user could escalate, change the filter in the host's toolbar, and keep an
  // escalation that now reads against a match set they never saw.
  //
  // Keyed on the CONTENT signature, not the prop's identity: a host re-render
  // that rebuilds an equal object is not a query change, and dropping the
  // escalation on one would make the affordance unusable.
  const hostFindParamsKey = React.useMemo(
    () => findParamsSignature(hostFindParams),
    [hostFindParams],
  );
  React.useEffect(() => {
    setSelectAllMatching(false);
  }, [hostFindParamsKey]);

  // Reset to page 1 whenever the query itself changes (object / filter / sort /
  // search), so we never request a page index that no longer exists for the new
  // result set (e.g. applying a filter while sitting on page 5 of the old
  // query). A new search term is the sharpest case of this: 3075 rows can
  // become 2, and "page 5" of that is nothing at all.
  React.useEffect(() => {
    setServerPage(1);
  }, [objectName, schemaFilter, schemaSort, headerSort, searchTerm]);

  // --- NavigationConfig support ---
  // Must be called before any early returns to satisfy React hooks rules
  const navigation = useNavigationOverlay({
    navigation: schema.navigation,
    objectName: schema.objectName,
    // NON-AUTHOR SURFACE — `onNavigate` is deliberately absent from
    // `GRID_QUERY_INPUTS` (`index.tsx`), by the maintainer ruling of
    // 2026-08-19 on objectui#5234, so this read is deliberate, not missed.
    //
    // Unlike the four keys objectui#5091 ruled, this one IS declared — in
    // `@object-ui/types`' `ObjectGridSchema` (`objectql.ts`), with its own doc
    // comment — which is why the read below is plain and not a cast. It is NOT
    // drift absorbed by `BaseSchema`'s index signature: the reading that said
    // so was measured wrong and withdrawn on the card before it was ruled.
    //
    // It stays unpublished because it is a FUNCTION VALUE and a schema is a
    // SERIALISABLE DOCUMENT. `(recordId, action) => void` cannot survive a
    // metadata round-trip whatever declares it, so no author writing JSON or
    // YAML — and no AI emitting a schema document — can ever express this key.
    // Publishing it into the designer panel and the generated
    // `sdui-intrinsics.d.ts` would advertise an offer nobody can take, which
    // is the option the ruling rejected as the most AI-error-prone of the
    // three. Programmatic callers already have the channel its nine siblings
    // use: `onRowClick`, `onRowSelect`, `onCellChange`, `onRowSave`,
    // `onBatchSave`, `onEdit`, `onDelete`, `onBulkDelete` and `onAddRecord`
    // are props on `ObjectGridComponentProps`, and that is where a caller
    // should prefer to pass this one too.
    //
    // The contract says the same thing independently: `ComponentPropsMap
    // ['object-grid']` (`@objectstack/spec@17`) is a `strictObject` and
    // rejects `onNavigate` BY NAME (`unrecognized_keys`), so an author who
    // took the offer could not save the document. Both halves — unlisted here,
    // rejected there — are pinned by `__tests__/gridNonAuthorKeys.test.tsx`,
    // together with the read itself, so this exemption cannot decay into a
    // silent drop.
    onNavigate: schema.onNavigate,
    onRowClick,
  });

  // --- Action support for action columns ---
  const { execute: executeAction, updateContext: updateActionContext } = useAction();

  // Publish the checkbox selection into the shared ActionRunner context so
  // actions rendered OUTSIDE the grid but inside the same <ActionProvider>
  // (e.g. `list_toolbar` flow buttons in the ObjectView header) can resolve a
  // recordId from the selected rows. Cleared on unmount / selection change so
  // a stale selection never leaks into later invocations.
  React.useEffect(() => {
    updateActionContext({ selectedRecords: selectedRows });
    return () => { updateActionContext({ selectedRecords: [] }); };
  }, [selectedRows, updateActionContext]);

  // --- Row color support ---
  const getRowClassName = useRowColor(schema.rowColor);

  // --- Conditional formatting support ---
  // Delegates to the shared CEL evaluator (issue #1584 / ADR-0058) so the grid
  // and ListView reach the identical verdict and the whole platform speaks one
  // expression dialect. The host predicate scope is bound so `features.*`
  // predicates resolve, mirroring row-action visibility.
  const predicateScope = usePredicateScope();
  const getRowStyle = useCallback((row: Record<string, unknown>): React.CSSProperties | undefined => {
    const rules = schema.conditionalFormatting;
    if (!rules || rules.length === 0) return undefined;
    // `objectSchema.fields` binds relation fields as the stored foreign key
    // rather than the record `$expand` substituted for them — the grid expands
    // every relational COLUMN, so without this a rule comparing one could only
    // ever be false (see `toPredicateRecord`).
    const style = resolveConditionalFormatting(row, rules as any, predicateScope, objectSchema?.fields);
    return Object.keys(style).length > 0 ? (style as React.CSSProperties) : undefined;
  }, [schema.conditionalFormatting, predicateScope, objectSchema]);

  // --- Grouping support ---
  // Build a per-field value formatter so group headers display the human
  // readable label for select/boolean fields rather than the raw value
  // (e.g. "In Progress" instead of "in_progress", "Yes" instead of "true").
  const groupValueFormatter = React.useMemo(() => {
    // [objectui#7217] ONE normalized entry list, shared with the
    // `useGroupedData` call below. Reading `grouping.fields` raw here threw
    // `TypeError: Cannot read properties of null (reading 'field')` on a null
    // hole — the whole grid gone, during render, before any projection was
    // built. `usableGroupingFields` admits exactly the entries
    // `collectGroupingFieldRefs` harvests into the projection, so the grid can
    // never group by an entry the query never asked for.
    const groupingFields = usableGroupingFields(schema.grouping?.fields);
    if (!groupingFields.length) return undefined;

    // Per-field { value -> label } lookup, plus a per-field type so we can
    // handle booleans / dates / users without dedicated option lists.
    const lookup = new Map<string, { type?: string; options?: Map<string, string> }>();

    for (const gf of groupingFields) {
      const fieldName = gf.field;
      const objectDefField = objectSchema?.fields?.[fieldName];
      // Try to find a column override matching this field for type/options
      const cols = normalizeColumns(schema.columns) as any[] | undefined;
      const colOverride = cols?.find?.((c) => typeof c === 'object' && c?.field === fieldName);

      const type = colOverride?.type || objectDefField?.type;
      const rawOptions = colOverride?.options || objectDefField?.options;

      const optionsMap = new Map<string, string>();
      if (Array.isArray(rawOptions) && rawOptions.length > 0) {
        const translated = schema.objectName
          ? translateOptions(schema.objectName, fieldName, rawOptions)
          : rawOptions;
        for (const opt of translated) {
          if (opt && opt.value !== undefined && opt.value !== null) {
            const label = (opt as any).label;
            optionsMap.set(String(opt.value), label != null ? String(label) : String(opt.value));
          }
        }
      }

      lookup.set(fieldName, {
        type: type || undefined,
        options: optionsMap.size > 0 ? optionsMap : undefined,
      });
    }

    return (field: string, value: any): string | undefined => {
      const meta = lookup.get(field);
      if (!meta) return undefined;
      // Select / multi-select: resolve from options map first.
      if (meta.options) {
        const label = meta.options.get(String(value));
        if (label !== undefined) return label;
      }
      // Boolean fields: render as Yes/No. We use the toolbar i18n bundle so
      // grids without an objectName still produce a readable label — the same
      // `grid.yes`/`grid.no` keys the boolean cell renderer and the bulk-action
      // dialog use, passed as `defaultValue` (a bare string second argument is
      // read as an options object, so the fallback never applied).
      if (meta.type === 'boolean' || typeof value === 'boolean') {
        if (value === true || value === 'true') return t('grid.yes', { defaultValue: 'Yes' });
        if (value === false || value === 'false') return t('grid.no', { defaultValue: 'No' });
      }
      return undefined;
    };
  }, [schema.grouping, schema.columns, schema.objectName, objectSchema, translateOptions, t]);

  const { groups, isGrouped, toggleGroup } = useGroupedData(
    schema.grouping,
    data,
    schema.aggregations,
    groupValueFormatter,
  );

  // Reset grouped pagination to page 1 whenever the grouping config, page size
  // or the underlying data changes (e.g. switching grouping field, reload).
  const groupingKey = React.useMemo(
    () => JSON.stringify(schema.grouping ?? null),
    [schema.grouping],
  );
  React.useEffect(() => {
    setGroupedPage(1);
  }, [groupingKey, groupedPageSize, refreshKey]);

  // --- Column summary support ---
  const summaryColumns = React.useMemo(() => {
    const cols = normalizeColumns(schema.columns);
    if (cols && cols.length > 0 && typeof cols[0] === 'object') {
      return cols as ListColumn[];
    }
    return undefined;
  }, [schema.columns]);
  const { summaries, hasSummary } = useColumnSummary(summaryColumns, data, objectSchema?.fields);

  // An authored column the renderer cannot read now says so, instead of just
  // not being there (objectui#5349 — the Q2 objectui#5068 deferred).
  //
  // #5068 made `ListColumnSchema`'s `field` / `label` the only spelling read
  // here, which is right; what it left behind was the receipt. A column
  // authored `{ accessorKey, header }` (or with no `field` at all) is dropped
  // by `resolvesToDataColumn` above, and until this effect landed the author
  // saw no error, no warning and no empty header — just a grid with its
  // row-number column and no data columns. Same defect shape #5068 exists to
  // fix, one level down: renderer and author disagree, author gets a success
  // receipt.
  //
  // Scope, deliberately narrow: this reads the `columns` INPUT and nothing
  // else. It never asks whether the grid found ROWS, because a grid legitimately
  // draws them from five different places (inline `data` array, `data.provider:
  // 'value'`, legacy `staticData`, `bind`, or a host that owns the fetch and
  // passes the window down as a `data` React prop). A predicate that consulted
  // those would eventually paint a configuration error over a working grid.
  // `hidden: true` is authored intent and is never reported.
  //
  // Channel: the same one `ObjectGrid` already uses for "you declared it, the
  // renderer dropped it" — a `useEffect` keyed on the schema slice and one
  // `console.warn` prefixed `[ObjectUI] ObjectGrid <topic>:` (see the export
  // format warning below) — rather than a second, differently-shaped one.
  const columnDiagnosticBlockType = (schema as { type?: unknown }).type;
  const columnDiagnosticLabel = schema.label ?? (schema as { title?: unknown }).title;
  useEffect(() => {
    const message = describeUnresolvedColumns(schema.columns, {
      blockType: columnDiagnosticBlockType,
      objectName: schema.objectName,
      label: columnDiagnosticLabel,
    });
    if (message) console.warn(message);
  }, [schema.columns, columnDiagnosticBlockType, schema.objectName, columnDiagnosticLabel]);

  const generateColumns = useCallback((): ObjectGridColumnDraft[] => {
    // Map field type to column header icon (Airtable-style)
    const getTypeIcon = (fieldType: string | null): React.ReactNode => {
      if (!fieldType) return <Type className="h-3.5 w-3.5" />;
      const iconMap: Record<string, React.ReactNode> = {
        text: <Type className="h-3.5 w-3.5" />,
        number: <Hash className="h-3.5 w-3.5" />,
        currency: <Hash className="h-3.5 w-3.5" />,
        percent: <Hash className="h-3.5 w-3.5" />,
        date: <Calendar className="h-3.5 w-3.5" />,
        datetime: <Clock className="h-3.5 w-3.5" />,
        boolean: <CheckSquare className="h-3.5 w-3.5" />,
        user: <User className="h-3.5 w-3.5" />,
        select: <Tag className="h-3.5 w-3.5" />,
      };
      return iconMap[fieldType] || <Type className="h-3.5 w-3.5" />;
    };

    // Auto-infer column type from field name and data values (Airtable-style)
    const inferColumnType = (col: ListColumn): string | null => {
      if (col.type) return col.type; // Explicit type takes priority

      const fieldLower = col.field.toLowerCase();

      // Infer boolean fields
      const booleanFields = ['completed', 'is_completed', 'done', 'active', 'enabled', 'archived'];
      if (booleanFields.some(f => fieldLower === f || fieldLower === `is_${f}`)) {
        return 'boolean';
      }

      // Infer datetime fields (fields with time component: created_time, modified_time, *_at patterns)
      const datetimePatterns = ['created_time', 'modified_time', 'updated_time', 'created_at', 'updated_at', 'modified_at', 'last_login', 'logged_at'];
      if (datetimePatterns.some(p => fieldLower === p || fieldLower.endsWith(`_${p}`))) {
        return 'datetime';
      }

      // Infer date fields from name patterns
      const datePatterns = ['date', 'due', 'created', 'updated', 'deadline', 'start', 'end', 'expires'];
      if (datePatterns.some(p => fieldLower.includes(p))) {
        // Verify with data: check if sample values look like dates
        if (data.length > 0) {
          const sample = data.find(row => row[col.field] != null)?.[col.field];
          if (typeof sample === 'string' && !isNaN(Date.parse(sample))) {
            return 'date';
          }
        }
        return 'date';
      }

      // Infer percent fields from name patterns
      const percentFields = ['probability', 'percent', 'percentage', 'completion', 'progress', 'rate'];
      if (percentFields.some(f => fieldLower.includes(f))) {
        if (data.length > 0) {
          const sample = data.find(row => row[col.field] != null)?.[col.field];
          if (typeof sample === 'number') {
            return 'percent';
          }
        }
      }

      // Infer select/badge fields (status, priority, category, etc.)
      const selectFields = ['status', 'priority', 'category', 'stage', 'type', 'severity', 'level'];
      if (selectFields.some(f => fieldLower.includes(f))) {
        if (data.length > 0) {
          const uniqueValues = new Set(data.map(row => row[col.field]).filter(Boolean));
          if (uniqueValues.size > 0 && uniqueValues.size <= 10) {
            return 'select';
          }
        }
      }

      // Infer user/assignee fields
      const userFields = ['assignee', 'owner', 'author', 'reporter', 'creator', 'user'];
      if (userFields.some(f => fieldLower.includes(f))) {
        return 'user';
      }

      // Infer currency/amount fields
      const currencyFields = ['amount', 'price', 'total', 'revenue', 'cost', 'budget', 'salary'];
      if (currencyFields.some(f => fieldLower.includes(f))) {
        if (data.length > 0) {
          const sample = data.find(row => row[col.field] != null)?.[col.field];
          if (typeof sample === 'number') {
            return 'currency';
          }
        }
      }

      // Fallback: detect ISO date strings in data values (catch-all for unmatched field names)
      if (data.length > 0) {
        const sample = data.find(row => row[col.field] != null)?.[col.field];
        if (typeof sample === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(sample)) {
          return 'datetime';
        }
      }

      return null;
    };

    // Use normalized columns (support both new and legacy)
    const cols = normalizeColumns(schemaColumns);
    
    if (cols) {
      // FLS on the AUTHORED `columns` path (objectui#6799 — maintainer ruling
      // 2026-08-30, inheriting objectui#6723's 2026-08-29 reasoning verbatim).
      //
      // This was the LAST of `generateColumns()`'s three default paths that did
      // not re-apply field-level security. The object-schema path always did;
      // the inline-data path does as of objectui#6723. Leaving this one out was
      // the worst of the three to leave, because it is the MOST REACHABLE:
      // objectui#6723's path needs a host to hand rows down, while this one runs
      // whether the grid fetches its own rows or not. Three paths of one
      // function, two checking and one not, is a bypass around the field gate
      // rather than an inconsistency.
      //
      // ⭐ THE LIMIT IS LOAD-BEARING, NOT AN OPTIMISATION — and it bites harder
      // here than on the inline-data path. Only keys the OBJECT DECLARES are
      // judged; everything else passes through untouched. A `ListColumn` carries
      // `label` / `link` / `action` / `prefix` / `width`, so a column whose
      // `field` the object does not declare is not a mistake — it is a
      // legitimate authored derived or host-joined column (`computed_score`, a
      // flattened `account.name`), and deleting it would destroy authoring work.
      // `checkField` answers `false` for a field the policy has never heard of,
      // so asking it about a derived key is not a stricter reading of the same
      // rule — it is a different, wrong one. `hasOwnProperty` rather than a
      // truthiness read so an inherited name (`constructor`, `toString`) cannot
      // be mistaken for a declared field.
      //
      // ⛔ THE JUDGED KEY IS READ THROUGH `columnIdentity`, NEVER OFF A BARE
      // STRING (the ruling says so by name). `columnIdentity` folds the three
      // authored identity spellings — `'salary'`, `{ field: 'salary' }` and the
      // legacy `{ name: 'salary' }` — which is why ONE predicate serves both
      // arms below. A gate reading `col.field` directly would find no identity
      // on the legacy spelling and wave a denied declared field straight
      // through. `resolvesToDataColumn` keeps owning its own decisions and runs
      // first: this gate narrows what survives, it never resurrects a hidden or
      // unresolvable column.
      //
      // Redundant through `ListView`, which filters its own `effectiveFields`
      // through this same gate before forwarding them as `columns` — and that
      // redundancy IS the point: the invariant must not rest on every future
      // host having read the docs. Measured in-repo hosts that do NOT filter
      // first: `ObjectView`, `ObjectManager`, `FieldDesigner`. Pinned in
      // `authoredColumnsFls-6799.test.tsx`.
      const passesFieldGate = (entry: unknown): boolean => {
        if (!perms?.isLoaded || !schema.objectName) return true;
        const fieldName = columnIdentity(entry);
        // No readable identity ⇒ nothing to ask the policy about.
        if (!fieldName) return true;
        // Undeclared ⇒ host-joined / derived ⇒ not this gate's business.
        if (!Object.prototype.hasOwnProperty.call(objectSchema?.fields ?? {}, fieldName)) return true;
        return perms.checkField(schema.objectName, fieldName, 'read');
      };
      // ObjectStack's DECLARED column spelling is the only one read
      // (objectui#5068). `ObjectGridSchema.columns` is `string[] | ListColumn[]`,
      // and `ListColumnSchema` in `@objectstack/spec/ui` is a STRICT object:
      // `field` is required, `accessorKey` / `header` are refused BY NAME with
      // `unrecognized_keys`. A branch here used to accept that refused spelling
      // anyway — it sniffed `columns[0]` for an `accessorKey` and synthesized a
      // `ListColumn` from it — so one key had two spellings, one the schema
      // admits and one only the runtime did. That second de-facto contract is
      // what AGENTS.md #0.1 forbids, and objectui#3951 already settled the
      // shape of the fix for this defect family: unify at the PRODUCER, no
      // consumer-side tolerance alias. The one in-repo producer that spoke it,
      // `bridgeListView` in `@object-ui/react`, was migrated in the same PR.
      //
      // The `columns[0]` sniff goes with it. Column identity is a per-column
      // property, and the filter below is the one place that judges it: a
      // mis-spelled column is now dropped alone, where the sniff let the FIRST
      // entry decide the fate of the whole array (a declared column standing
      // behind an undeclared one was lost with it; the reverse order threw).
      //
      // `accessorKey` keeps its job on the way OUT — it is the data-table
      // adapter's key, which `@object-ui/core` deliberately holds outside the
      // metadata identity fold (`TABLE_ADAPTER_COLUMN_KEY`) and which this
      // component still writes below. Metadata vocabulary in, adapter
      // vocabulary out, one translation.
      if (cols.length > 0 && typeof cols[0] === 'object' && cols[0] !== null) {
        // The drop decision lives in `resolvesToDataColumn`
        // (`columnSpellingDiagnostics.ts`) so the diagnostic that reports a
        // dropped column cannot drift from the filter that drops it — one
        // predicate, two readers (objectui#5349). Semantics unchanged:
        // `col?.field && typeof col.field === 'string' && !col.hidden`.
        return (cols as ListColumn[])
          .filter((col) => resolvesToDataColumn(col))
          .filter((col) => passesFieldGate(col))
          .map((col, colIndex) => {
            // Fall back to the SCHEMA FIELD's label before prettifying the machine
            // name — otherwise a column declared as bare { field } shows an English
            // name-derived header (e.g. "Request title") even when the field has a
            // localized label (e.g. "申请标题") on a non-English app.
            const rawHeader = resolveColumnLabel(col.label)
              || resolveColumnLabel(objectSchema?.fields?.[col.field]?.label)
              || col.field.charAt(0).toUpperCase() + col.field.slice(1).replace(/_/g, ' ');
            const header = schema.objectName ? resolveFieldLabel(schema.objectName, col.field, rawHeader) : rawHeader;

            // Build custom cell renderer based on column configuration
            let cellRenderer: ((value: any, row: any) => React.ReactNode) | undefined;

            // Type-based cell renderer: explicit col type > objectDef type > heuristic inference.
            // Format hints (e.g. `text` + `format: 'phone'`) promote to the
            // richer renderer (PhoneCellRenderer) via resolveCellRendererType.
            const objectDefField = objectSchema?.fields?.[col.field];
            // ⭐ ANNOTATED, and the annotation is load-bearing (objectui#6004).
            // `objectSchema` is `useState<any>`, so `objectDefField?.type` is
            // `any` — and an `any` SPREAD into an object literal collapses the
            // WHOLE literal to `any`, which silently un-checks every other key
            // in it. Measured: without this annotation the emit below infers
            // `any[]`, and `ObjectGridColumnDraft` cannot bite on any member. Naming
            // the producer vocabulary here stops `any` at this one boundary.
            const baseInferredType: string | null = col.type || objectDefField?.type || inferColumnType({ field: col.field }) || null;
            // objectui#6458 — the column-level `format` read is RETIRED. The
            // object-field fallback below is now the only road, which is what
            // every measured author already used.
            const formatHint = objectDefField?.format;
            const inferredType: string | null = baseInferredType
              ? resolveCellRendererType({ type: baseInferredType, format: formatHint })
              : null;
            const CellRenderer = inferredType ? getCellRenderer(inferredType) : null;

            // Build field metadata for cell renderers with objectDef enrichment
            const fieldMeta: Record<string, any> = { name: col.field, type: inferredType || 'text' };
            // Merge objectDef field properties (options with colors, currency, precision, etc.)
            if (objectDefField) {
              if (objectDefField.label) fieldMeta.label = objectDefField.label;
              if (objectDefField.currency) fieldMeta.currency = objectDefField.currency;
              if (objectDefField.precision !== undefined) fieldMeta.precision = objectDefField.precision;
              if ((objectDefField as any).scale !== undefined) (fieldMeta as any).scale = (objectDefField as any).scale;
              if (objectDefField.format) fieldMeta.format = objectDefField.format;
              if (objectDefField.options) fieldMeta.options = translateOptions(schema.objectName, col.field, objectDefField.options);
            }
            // Preserve relational metadata (reference_to, display_field, …) so
            // lookup CELLS resolve ids to names. ⛔ Not the inline picker — that
            // reads the schema def directly, see `renderCellEditor` (objectui#7154).
            applyRelationalMeta(fieldMeta, objectDefField as any);
            // Auto-generate options from data for inferred select without existing options
            if (inferredType === 'select' && !fieldMeta.options) {
              const uniqueValues = Array.from(new Set(data.map(row => row[col.field]).filter(Boolean)));
              fieldMeta.options = uniqueValues.map(v => ({ value: v, label: humanizeLabel(String(v)) }));
            }
            // Honor metadata-defined appearance only — the objectDef FIELD's
            // `appearance`, which since objectui#6458 is the only road (the
            // column-level read is retired). When unset, the cell renders its
            // default badge style — same as detail / form views.
            const explicitAppearance = objectDefField?.appearance;
            if (explicitAppearance != null) {
              fieldMeta.appearance = explicitAppearance;
            }

            // Auto-link primary field (first column) to record detail (Airtable-style)
            const isPrimaryField = colIndex === 0 && !col.link && !col.action;
            const isLinked = col.link || isPrimaryField;

            if ((col.link && col.action) || (isPrimaryField && col.action)) {
              // Both link and action: link takes priority for navigation, action executes on secondary interaction
              cellRenderer = (value: any, row: any) => {
                const displayContent = CellRenderer
                  ? <CellRenderer value={value} field={fieldMeta as any} />
                  : (value != null && value !== '' ? String(value) : <span className="text-muted-foreground/50 text-xs italic">—</span>);
                return (
                  <LinkCell
                    testId={isPrimaryField ? 'primary-field-link' : 'link-cell'}
                    onActivate={() => navigation.handleClick(row)}
                    objectName={schema.objectName}
                    recordId={rowRecordId(row)}
                  >
                    {displayContent}
                  </LinkCell>
                );
              };
            } else if (isLinked) {
              // Link column: clicking navigates to the record detail
              cellRenderer = (value: any, row: any) => {
                const displayContent = CellRenderer
                  ? <CellRenderer value={value} field={fieldMeta as any} />
                  : (value != null && value !== '' ? String(value) : <span className="text-muted-foreground/50 text-xs italic">—</span>);
                return (
                  <LinkCell
                    testId={isPrimaryField ? 'primary-field-link' : 'link-cell'}
                    onActivate={() => navigation.handleClick(row)}
                    objectName={schema.objectName}
                    recordId={rowRecordId(row)}
                  >
                    {displayContent}
                  </LinkCell>
                );
              };
            } else if (col.action) {
              // Action column: render as action button
              cellRenderer = (value: any, row: any) => {
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    data-testid="action-cell"
                    onClick={(e) => {
                      e.stopPropagation();
                      executeAction({
                        type: col.action!,
                        params: { record: row, field: col.field, value },
                      });
                    }}
                  >
                    {formatActionLabel(col.action!)}
                  </Button>
                );
              };
            } else if (CellRenderer) {
              // Type-only cell renderer (no link/action)
              cellRenderer = (value: any) => (
                <CellRenderer value={value} field={fieldMeta as any} />
              );
            } else {
              // Default renderer with empty value handling
              cellRenderer = (value: any) => (
                value != null && value !== ''
                  ? <span>{String(value)}</span>
                  : <EmptyValue />
              );
            }

            // Wrap with prefix compound cell renderer (Airtable-style: [Badge] Text in same cell)
            // `prefix` needs NO cast: `ListColumn` DECLARES it (objectui#6458).
            // The cast was pure noise, and it cost twice — it made a declared,
            // schema-admitted key look exactly like the four genuinely undeclared
            // reads around it, and it threw away `ColumnPrefix`'s own typing, so
            // `prefixConfig.field` was `any` at every use below.
            //
            // ⭐ The four undeclared reads that used to sit in this branch —
            // `format`, `options`, `appearance`, `essential` — are RETIRED
            // (objectui#6458, maintainer ruling 2026-08-28, "B on all four").
            // `ListColumnSchema` is a strict object that refuses all four at
            // publish, so honouring them here was the `declared != enforced`
            // split AGENTS.md #0.1 exists to stop. The retirement route (rather
            // than declaring them on `@objectstack/spec`) follows the standing
            // zero-authors rule: a key with no measured authors is retired at
            // once, with no deprecation window. Re-measured on this ref before
            // the deletion — zero authored occurrences of any of the four on a
            // column across `examples/` and `apps/`.
            //
            // ⚠️ Retired for want of authors, NOT forbidden forever. If a real
            // request for semantic mobile-column control arrives, the declare
            // route reopens — objectstack#12715 is the precedent (removed while
            // unenforced, re-introduced once demand and enforcement met). What
            // is forbidden is the third road: a renderer-side tolerance for a
            // key the schema refuses. `columnReadBoundary-6458.test.ts` now
            // bounds this branch's undeclared cast reads to the EMPTY SET, so a
            // new one goes red on arrival instead of accreting quietly.
            const prefixConfig = col.prefix;
            if (prefixConfig?.field) {
              const baseCellRenderer = cellRenderer;
              const PrefixRenderer = prefixConfig.type === 'badge' ? getCellRenderer('select') : null;
              cellRenderer = (value: any, row: any) => {
                const prefixValue = row[prefixConfig.field];
                const prefixEl = prefixValue != null && prefixValue !== ''
                  ? PrefixRenderer
                    ? <PrefixRenderer value={prefixValue} field={{ name: prefixConfig.field, type: 'select' } as any} />
                    : <span className="text-muted-foreground text-xs mr-1.5">{String(prefixValue)}</span>
                  : null;
                return (
                  <span className="flex items-center gap-1.5">
                    {prefixEl}
                    {baseCellRenderer(value, row)}
                  </span>
                );
              };
            }

            // Auto-infer alignment from field type if not explicitly set
            const numericTypes = ['number', 'currency', 'percent'];
            const effectiveType = inferredType || col.type;
            const inferredAlign = col.align || (effectiveType && numericTypes.includes(effectiveType) ? 'right' as const : undefined);

            // Determine if column should be hidden on mobile
            const isEssential = colIndex === 0;

            return {
              header,
              accessorKey: col.field,
              // Forward the resolved (base) field type so the inline editor can
              // pick a type-aware control. Use baseInferredType (date/number/...)
              // rather than the renderer type so e.g. `date` stays `date`.
              ...(baseInferredType && { type: baseInferredType }),
              ...(schema.showColumnTypeIcons && { headerIcon: getTypeIcon(inferredType) }),
              ...(!isEssential && { className: 'hidden sm:table-cell' }),
              ...(col.width && { width: col.width }),
              ...(inferredAlign && { align: inferredAlign }),
              sortable: col.sortable !== false,
              ...(col.resizable !== undefined && { resizable: col.resizable }),
              ...(cellRenderer && { cell: cellRenderer }),
              ...(col.pinned && { pinned: col.pinned }),
            };
          });
      }
      
      // String array format - enrich with objectDef field metadata for type-aware rendering
      return (cols as string[])
        .filter((fieldName) => typeof fieldName === 'string' && fieldName.trim().length > 0)
        .filter((fieldName) => passesFieldGate(fieldName))
        .map((fieldName, colIndex) => {
          const fieldDef = objectSchema?.fields?.[fieldName];
          const rawFieldLabel = fieldDef?.label;
          const rawHeader = rawFieldLabel || fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');
          const header = schema.objectName ? resolveFieldLabel(schema.objectName, fieldName, rawHeader) : rawHeader;

          // Resolve type: objectDef type > heuristic inference (consistent with ListColumn path)
          // Annotated for the same reason as path A's `baseInferredType`
          // above: `fieldDef` is `any`, and an `any` reaching the `...(resolvedType
          // && { type: resolvedType })` spread below collapses the emit literal
          // to `any` (objectui#6004).
          const resolvedType: string | null = fieldDef?.type || inferColumnType({ field: fieldName }) || null;
          const CellRenderer = resolvedType ? getCellRenderer(resolvedType) : null;

          // Build field metadata with objectDef enrichment
          const fieldMeta: Record<string, any> = { name: fieldName, type: resolvedType || 'text' };
          if (fieldDef) {
            if (fieldDef.label) fieldMeta.label = fieldDef.label;
            if (fieldDef.currency) fieldMeta.currency = fieldDef.currency;
            if (fieldDef.precision !== undefined) fieldMeta.precision = fieldDef.precision;
            if ((fieldDef as any).scale !== undefined) fieldMeta.scale = (fieldDef as any).scale;
            if (fieldDef.format) fieldMeta.format = fieldDef.format;
            if (fieldDef.options) fieldMeta.options = translateOptions(schema.objectName, fieldName, fieldDef.options);
          }
          // Preserve relational metadata (reference_to, display_field, …) so
          // lookup CELLS resolve ids to names. ⛔ Not the inline picker — that
          // reads the schema def directly, see `renderCellEditor` (objectui#7154).
          applyRelationalMeta(fieldMeta, fieldDef as any);
          // Auto-generate select options from data when no options defined
          if (resolvedType === 'select' && !fieldMeta.options) {
            const uniqueValues = Array.from(new Set(data.map(row => row[fieldName]).filter(Boolean)));
            fieldMeta.options = uniqueValues.map((v: any) => ({ value: v, label: humanizeLabel(String(v)) }));
          }
          if ((resolvedType === 'select' || resolvedType === 'status') && (fieldDef as any)?.appearance != null) {
            fieldMeta.appearance = (fieldDef as any).appearance;
          }

          const numericTypes = ['number', 'currency', 'percent'];
          const inferredAlign = resolvedType && numericTypes.includes(resolvedType) ? 'right' as const : undefined;

          // Auto-link primary field (first column) to record detail
          const isPrimaryField = colIndex === 0;
          let cellRenderer: ((value: any, row?: any) => React.ReactNode) | undefined;

          if (isPrimaryField && CellRenderer) {
            cellRenderer = (value: any, row: any) => {
              const displayContent = <CellRenderer value={value} field={fieldMeta as any} />;
              return (
                <LinkCell
                  testId="primary-field-link"
                  onActivate={() => navigation.handleClick(row)}
                  objectName={schema.objectName}
                  recordId={rowRecordId(row)}
                >
                  {displayContent}
                </LinkCell>
              );
            };
          } else if (isPrimaryField) {
            cellRenderer = (value: any, row: any) => (
              <LinkCell
                testId="primary-field-link"
                onActivate={() => navigation.handleClick(row)}
                objectName={schema.objectName}
                recordId={rowRecordId(row)}
              >
                {value != null && value !== '' ? String(value) : <span className="text-muted-foreground/50 text-xs italic">—</span>}
              </LinkCell>
            );
          } else if (CellRenderer) {
            cellRenderer = (value: any) => <CellRenderer value={value} field={fieldMeta as any} />;
          }

          return {
            header,
            accessorKey: fieldName,
            // Forward the resolved field type for the type-aware inline editor.
            ...(resolvedType && { type: resolvedType }),
            ...(schema.showColumnTypeIcons && resolvedType && { headerIcon: getTypeIcon(resolvedType) }),
            ...(inferredAlign && { align: inferredAlign }),
            ...(cellRenderer && { cell: cellRenderer }),
            sortable: fieldDef?.sortable !== false,
          };
        });
    }

    // Legacy support: use 'fields' if columns not provided.
    //
    // ⭐ THE ORDER OF THIS PATH AND THE OBJECT-SCHEMA PATH BELOW IS
    // LOAD-BEARING (objectui#6677).
    //
    // `hasInlineData` is `dataConfig.provider === 'value'`, and `dataConfig` is
    // built as `provider: 'value'` from the `data` PROP before anything else.
    // So this path is taken by EVERY grid whose rows were handed down instead
    // of fetched — which is every object-bound grid reached through a fetching
    // host (`ListView`, `ObjectView`, …). It used to return unconditionally
    // whenever rows were present, which made the object-schema path below
    // unreachable for all of them: the branch that knows the object was the one
    // that never ran. Measured, same page / source / object, one variable:
    // grid-fetches rendered the policy's 5 columns, host-fetches rendered 10 —
    // the payload's keys, including `id` (`hidden: true`) and the four audit
    // columns (`system`), exactly what the policy exists to exclude.
    //
    // The yield is as NARROW as the defect. Only the ROW-KEY FALLBACK
    // (`Object.keys(inlineData[0])`) is wrong for an object-bound grid, so only
    // that is given up, and only once there is a policy to give it up TO:
    //
    //   - `schemaFields` present ⇒ this path keeps it. An authored projection
    //     is the author's contract, and the schema path would silently drop a
    //     name the object does not declare (`if (!field) return;`) — a host may
    //     legitimately join or derive keys. `!schemaFields` is exactly the
    //     condition under which the `||` below reaches for the row keys, so the
    //     gate and the fallback cannot drift apart.
    //   - `objectSchema` still `null` ⇒ this path keeps it. ⚠️ Gating on
    //     `objectName` ALONE is the trap: the schema arrives from an async
    //     fetch, so `objectSchema` is null on first paint and the grid would
    //     fall straight through to `if (!objectSchema) return []` and render an
    //     empty header row before flipping — a worse defect than this one. It
    //     is also the graceful fallback when the schema fetch fails or the data
    //     source has no `getObjectSchema`: the row keys stay the answer instead
    //     of the grid going blank.
    //
    // Both are pinned in `hostFetchedDefaultColumns-6677.test.tsx`, together
    // with the case this file's own comment calls the right one for this path:
    // inline data with no object behind it at all.
    const rowKeysWouldOutrankSchemaPolicy = !schemaFields && !!objectName && !!objectSchema;
    if (hasInlineData && !rowKeysWouldOutrankSchemaPolicy) {
      const inlineData = dataConfig?.provider === 'value' ? dataConfig.items as any[] : [];
      if (inlineData.length > 0) {
        // FLS on the inline-data path (objectui#6723 — maintainer ruling
        // 2026-08-29: the NARROW defence-in-depth fix, not a convergence).
        //
        // The object-schema path below re-applies field-level security to the
        // columns it derives; this path did not. So whether an object-bound
        // grid re-checked FLS depended on WHO FETCHED THE ROWS: same object,
        // same authored projection, rows the grid fetched went through the
        // gate and rows a host handed down did not. That is the asymmetry, and
        // a security invariant may not be decided by the data's provenance.
        //
        // ⭐ THE LIMIT IS LOAD-BEARING, NOT AN OPTIMISATION. Only keys the
        // OBJECT DECLARES are judged; everything else passes through
        // untouched. A host may legitimately join or derive columns
        // (`computed_score`, a flattened `account.name`), and keeping those is
        // this path's whole reason to exist — the object-schema path drops
        // them outright (`if (!field) return;`). Judging an undeclared key
        // would silently drop derived columns, which is the failure
        // objectui#6723's own analysis warned about and which the ruling
        // refuses by name. `checkField` answers `false` for a field the
        // policy has never heard of, so asking it about a derived key is not
        // a stricter reading of the same rule — it is a different, wrong one.
        //
        // Redundant through `ListView`, which filters its own `effectiveFields`
        // through this same gate before forwarding (its source says so), and
        // that redundancy IS the point: the invariant must not rest on every
        // future host having read the docs. Pinned as a byte-for-byte no-op on
        // that path in `inlineDataFls-6723.test.tsx`.
        const fieldsToShow = (schemaFields || Object.keys(inlineData[0])).filter((fieldName) => {
          if (!perms?.isLoaded || !schema.objectName) return true;
          // Undeclared ⇒ host-joined / derived ⇒ not this gate's business.
          // `hasOwnProperty` rather than a truthiness read so an inherited
          // name (`constructor`, `toString`) cannot be mistaken for a declared
          // field and dropped.
          if (!Object.prototype.hasOwnProperty.call(objectSchema?.fields ?? {}, fieldName)) return true;
          return perms.checkField(schema.objectName, fieldName, 'read');
        });
        return fieldsToShow.map((fieldName) => {
          const fieldDef = objectSchema?.fields?.[fieldName];
          // Annotated for the same reason as paths A and B (objectui#6004).
          const resolvedType: string | null = fieldDef?.type || inferColumnType({ field: fieldName }) || null;
          const CellRenderer = resolvedType ? getCellRenderer(resolvedType) : null;
          const header = fieldDef?.label || fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');

          // Build field metadata with objectDef enrichment
          const fieldMeta: Record<string, any> = { name: fieldName, type: resolvedType || 'text' };
          if (fieldDef) {
            if (fieldDef.label) fieldMeta.label = fieldDef.label;
            if (fieldDef.currency) fieldMeta.currency = fieldDef.currency;
            if (fieldDef.precision !== undefined) fieldMeta.precision = fieldDef.precision;
            if ((fieldDef as any).scale !== undefined) fieldMeta.scale = (fieldDef as any).scale;
            if (fieldDef.format) fieldMeta.format = fieldDef.format;
            if (fieldDef.options) fieldMeta.options = translateOptions(schema.objectName, fieldName, fieldDef.options);
          }
          // Preserve relational metadata (reference_to, display_field, …) so
          // lookup CELLS resolve ids to names. ⛔ Not the inline picker — that
          // reads the schema def directly, see `renderCellEditor` (objectui#7154).
          applyRelationalMeta(fieldMeta, fieldDef as any);
          // Auto-generate select options from data when no options defined
          if (resolvedType === 'select' && !fieldMeta.options) {
            const uniqueValues = Array.from(new Set(data.map(row => row[fieldName]).filter(Boolean)));
            fieldMeta.options = uniqueValues.map((v: any) => ({ value: v, label: humanizeLabel(String(v)) }));
          }
          if ((resolvedType === 'select' || resolvedType === 'status') && (fieldDef as any)?.appearance != null) {
            fieldMeta.appearance = (fieldDef as any).appearance;
          }

          const numericTypes = ['number', 'currency', 'percent'];
          const inferredAlign = resolvedType && numericTypes.includes(resolvedType) ? 'right' as const : undefined;

          return {
            header,
            accessorKey: fieldName,
            // Forward the resolved field type for the type-aware inline editor.
            ...(resolvedType && { type: resolvedType }),
            ...(schema.showColumnTypeIcons && resolvedType && { headerIcon: getTypeIcon(resolvedType) }),
            ...(inferredAlign && { align: inferredAlign }),
            ...(CellRenderer && { cell: (value: any) => <CellRenderer value={value} field={fieldMeta as any} /> }),
            sortable: fieldDef?.sortable !== false,
          };
        });
      }
    }

    if (!objectSchema) return [];

    const generatedColumns: ObjectGridColumnDraft[] = [];
    // Default columns priority (when schema doesn't specify columns):
    //   1. The object's `highlightFields` semantic role (ADR-0085).
    //   2. Otherwise, all schema fields with system-managed fields pushed to the end.
    //
    // Also drop fields that are platform-managed identifiers/audit columns or
    // marked `hidden: true`/`readonly: true` so default list views show only
    // the business fields users actually care about. Callers can still opt-in
    // to system columns by passing an explicit `fields` / `columns` prop.
    //
    // "System-managed" is decided by `isSystemManagedField`, which branches on
    // the framework's `field.system` flag (single source of truth stamped by
    // `applySystemFields`) — this is what keeps the injected, non-readonly
    // `owner_id` from leading the auto-derived columns, and covers any future
    // injected field without editing a name list here.
    const highlightFields: string[] | undefined = (objectSchema as any)?.highlightFields;
    const allFieldNames = Object.keys(objectSchema.fields || {});
    let fieldsToShow: string[];
    if (schemaFields) {
      fieldsToShow = schemaFields;
    } else if (highlightFields?.length) {
      // Lead with the object's name field (objectui#7245). `highlightFields` is
      // ADR-0085's "most important fields" role, not a column list — the detail
      // highlight strip, its first consumer, deliberately drops the title field
      // because the page H1 above it already shows one. A grid has no H1, so a
      // declared list like `["status", "industry", "annual_revenue"]` left rows
      // with nothing to tell them apart. `leadWithNameField` is the shared
      // helper the two app-shell synthesis faces use, so all three agree.
      //
      // Only the SYNTHESIZED branch. `schemaFields` above is author-declared and
      // is never reordered — that would be the renderer second-guessing metadata
      // (AGENTS.md Commandment #0.1).
      fieldsToShow = leadWithNameField(
        objectSchema,
        highlightFields.filter((n) => objectSchema.fields?.[n]),
      );
    } else {
      // No name-field lead here, and that is measured, not an oversight: this
      // branch takes EVERY visible field with no cap, so — unlike the two
      // app-shell faces, which slice to 5 / 6 — the name field cannot fall off
      // the end. It is already present; only its position could differ, and a
      // row that carries its name column somewhere is still identifiable. The
      // objectui#7245 defect is "no name column at all", which is unreachable
      // from here.
      //
      // Drop hidden + readonly system-managed fields, then push the remaining
      // system/audit/ownership columns (e.g. the injected, editable `owner_id`)
      // to the end as a fallback so business fields lead.
      const visibleFields = allFieldNames.filter((n) => {
        const f = objectSchema.fields?.[n];
        if (!f) return false;
        if (f.hidden) return false;
        // Drop readonly bookkeeping columns (created_at/by, updated_at/by, …).
        if (f.readonly && isSystemManagedField(n, f)) return false;
        return true;
      });
      fieldsToShow = [
        ...visibleFields.filter((n) => !isSystemManagedField(n, objectSchema.fields?.[n])),
        ...visibleFields.filter((n) => isSystemManagedField(n, objectSchema.fields?.[n])),
      ];
    }

    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema.fields?.[fieldName];
      if (!field) return;

      // FLS: drop columns the current user cannot read (server-resolved
      // /me/permissions via checkField — the schema itself carries no
      // per-caller permission bits, objectstack#3661). Same gate ListView
      // applies to its auto-derived columns.
      if (perms?.isLoaded && schema.objectName
        && !perms.checkField(schema.objectName, fieldName, 'read')) return;

      // Annotated for the same reason as paths A-C (objectui#6004): `field` is
      // `any`, so this value has to be named before it reaches a spread below.
      const fieldType: string | undefined = field.type;
      const CellRenderer = getCellRenderer(field.type);
      const numericTypes = ['number', 'currency', 'percent'];
      const translatedField = field.options
        ? { ...field, options: translateOptions(schema.objectName, fieldName, field.options) }
        : field;
      const fieldForCell: any = translatedField;
      generatedColumns.push({
        header: schema.objectName ? resolveFieldLabel(schema.objectName, fieldName, field.label || fieldName) : field.label || fieldName,
        accessorKey: fieldName,
        // Forward the field type for the type-aware inline editor.
        ...(fieldType && { type: fieldType }),
        ...(numericTypes.includes(field.type) && { align: 'right' as const }),
        cell: (value: any) => <CellRenderer value={value} field={fieldForCell} />,
        sortable: field.sortable !== false,
      });
    });

    return generatedColumns;
  }, [objectSchema, schemaFields, schemaColumns, dataConfig, hasInlineData, objectName, navigation.handleClick, executeAction, data, resolveFieldLabel, translateOptions, schema.objectName, perms]);

  // Formats this grid can actually deliver (objectui#2942): the server stream
  // handles csv/xlsx/json, the client fallback only csv/json. Declared-but-dead
  // formats used to render as menu items whose click did nothing; now they're
  // dropped from the menu (with a one-time warning for the app author).
  //
  // The filter is format-AGNOSTIC — it keeps what `supported` lists — so it
  // still covers the live case (`xlsx` declared with no server stream) and, for
  // free, the legacy one: `'pdf'` was declined platform-side
  // (objectstack#1301) and left the spec's format enum in 17.0.0
  // (objectstack#8010), so it is no longer authorable, but metadata stored
  // before the retirement still carries it until `os migrate meta --from 16`
  // runs. Such a value reaches here and is dropped by the same rule, with no
  // `'pdf'`-specific branch to keep alive (objectui#4535).
  // (Hoisted above the error/loading early returns to satisfy hooks rules.)
  const exportableFormats = useMemo(() => {
    const declared = schema.exportOptions?.formats || ['csv', 'json'];
    const serverAvailable = typeof dataSource?.exportDownload === 'function'
      && !!objectName
      && !hasInlineData
      && schema.exportOptions?.streaming !== false;
    const supported = serverAvailable ? ['csv', 'xlsx', 'json'] : ['csv', 'json'];
    return declared.filter((f: string) => supported.includes(f));
  }, [schema.exportOptions, dataSource, objectName, hasInlineData]);
  useEffect(() => {
    const declared = schema.exportOptions?.formats;
    if (!declared) return;
    const dropped = declared.filter((f) => !exportableFormats.includes(f));
    if (dropped.length > 0) {
      console.warn(`[ObjectUI] ObjectGrid export: unsupported format(s) hidden from the menu: ${dropped.join(', ')}`);
    }
  }, [schema.exportOptions, exportableFormats]);

  const handleExport = useCallback((format: ListViewExportFormat) => {
    // Object-level export permission gate. Default-allow: an explicit
    // `operations.export === false` blocks it, and — when the server hands down
    // an effective API operation set for this object (#3391) — so does its
    // exclusion of `export`. Missing effective set keeps current behavior.
    if (schema.operations?.export === false) return;
    if (effectiveApiOps && !effectiveApiOps.includes('export')) return;
    const exportConfig = schema.exportOptions;
    const maxRecords = exportConfig?.maxRecords || 0;
    const includeHeaders = exportConfig?.includeHeaders !== false;
    // Download filename: `<配置前缀|对象中文标签|API名>-<视图名>-<日期时间>.<ext>`,
    // e.g. `合同-进行中-20260714-153045.xlsx`. The translated object label (when
    // the schema has loaded) beats the raw API name; a configured
    // exportOptions.fileNamePrefix beats both (and suppresses the view label).
    const fileNameFor = (ext: string) => buildExportFileName(ext, {
      prefix: exportConfig?.fileNamePrefix,
      label: objectSchema?.label,
      objectName: objectName || schema.objectName,
      viewLabel: schema.label || schema.title,
    });

    // Server-streamed path: csv / xlsx / json via dataSource.exportDownload.
    // XLSX is server-only; type-aware value formatting, field resolution and
    // permission enforcement all happen server-side. Mirrors the grid's
    // configured filter + sort so the exported file matches what's shown.
    const serverEligible = (format === 'csv' || format === 'xlsx' || format === 'json')
      && typeof dataSource?.exportDownload === 'function'
      && !!objectName
      && !hasInlineData
      // Honor an opt-out: schema.exportOptions.streaming === false forces client-side.
      && exportConfig?.streaming !== false;

    if (serverEligible) {
      const cols = generateColumns().filter((c) => c.accessorKey !== '_actions');
      const fields = cols.map((c) => c.accessorKey).filter(Boolean);

      // Same lowered value the fetch above sends, which is what keeps the
      // downloaded file agreeing with the screen: both read `schemaFilter`
      // AFTER `toFilterNode`, so an authored `ViewFilterRule[]` cannot reach
      // the wire as bare rule objects on one path and as AST on the other.
      const filter = Array.isArray(schemaFilter) ? schemaFilter : undefined;
      const sort = Array.isArray(schemaSort)
        ? schemaSort
            .filter((s: any) => s && s.field)
            .map((s: any) => ({ field: s.field, direction: (s.order as 'asc' | 'desc') ?? 'asc' }))
        : undefined;

      setExportError(null);
      setExportBusy(true);
      void (async () => {
        try {
          const blob = await dataSource!.exportDownload!(objectName!, {
            format: format as 'csv' | 'xlsx' | 'json',
            fields: fields.length ? fields : undefined,
            filter,
            sort,
            includeHeaders,
            limit: maxRecords > 0 ? maxRecords : undefined,
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileNameFor(format);
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setShowExport(false);
        } catch (err) {
          // Surface the failure instead of swallowing it (e.g. permission denied
          // or a server error) — the toolbar shows the message.
          console.error('ObjectGrid export failed:', err);
          setExportError(err instanceof Error ? err.message : String(err));
        } finally {
          setExportBusy(false);
        }
      })();
      return;
    }

    // Client-side fallback (legacy synchronous blob path).
    const exportData = maxRecords > 0 ? data.slice(0, maxRecords) : data;

    const downloadFile = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const escapeCsvValue = (val: any): string => {
      const str = val == null ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    if (format === 'csv') {
      const cols = generateColumns().filter((c) => c.accessorKey !== '_actions');
      const fields = cols.map((c) => c.accessorKey);
      const headers = cols.map((c) => c.header);
      const rows: string[] = [];
      if (includeHeaders) {
        rows.push(headers.join(','));
      }
      exportData.forEach(record => {
        rows.push(fields.map((f: string) => escapeCsvValue(record[f])).join(','));
      });
      downloadFile(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }), fileNameFor('csv'));
    } else if (format === 'json') {
      downloadFile(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }), fileNameFor('json'));
    }
    setShowExport(false);
  }, [data, schema.exportOptions, schema.operations?.export, effectiveApiOps, schema.objectName, objectName, objectSchema, generateColumns, dataSource, hasInlineData, schemaFilter, schemaSort]);

  if (error) {
    return (
      <div className="p-3 sm:p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">{t('grid.errorLoading')}</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (loading && data.length === 0) {
    if (useCardView) {
      return (
        <div className="space-y-2 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-3 bg-card animate-pulse">
              <div className="h-5 bg-muted rounded w-3/4 mb-3" />
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-5 bg-muted rounded-full w-20" />
              </div>
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="p-4 sm:p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        <p className="mt-2 text-sm text-muted-foreground">{t('grid.loading')}</p>
      </div>
    );
  }

  const columns: ObjectGridColumn[] = generateColumns().map((col): ObjectGridColumnDraft => {
    // Enrich each column with its field type so the data-table's type-aware
    // inline editor can pick the matching control (dropdown for select,
    // checkbox for boolean) the form uses, instead of a plain text box.
    // Additive: never overrides a type a path already set.
    //
    // ⭐ THE `options` KEY RETIRED HERE (objectui#6004). This pass also used to
    // write `next.options = translateOptions(…)`, and nothing read it. Measured
    // read sets, comments stripped: `data-table.tsx` reads no column-level
    // `options` at all — its select/boolean editors are not hand-rolled there,
    // they come from the host through `renderCellEditor`, and THIS component's
    // `renderCellEditor` (below) rebuilds the field from
    // `objectSchema.fields[ctx.column.accessorKey]` rather than from the column.
    // So the write had no reader on either side of the seam.
    //
    // Retiring it is behaviour-preserving because the value still has its own
    // road to every consumer that wants it — that check is part of the rule,
    // not an aside: cell renderers read translated options off the `fieldMeta`
    // built inside `generateColumns()`, and the inline editor reads them off
    // the object schema. Neither ever consulted `col.options`.
    // ⛔ THE `!col` GUARD IS KEPT ON PURPOSE — do not delete it as dead code.
    //
    // `ObjectGridColumnDraft` forbids null, so by the types this branch is
    // unreachable, and that is exactly the reasoning that would remove it. The
    // reason it stays is that this producer's type guarantee has been untrue in
    // practice, repeatedly: objectui#6004 measured FIVE separate `any` leaks
    // that defeated this boundary, one of them (`const generatedColumns:
    // any[]`) INSIDE `generateColumns()` itself, where it left a whole emit
    // path unchecked even after the return was annotated. Each was invisible
    // until someone measured it.
    //
    // So this is defence in depth BEHIND the typing, not a substitute for it —
    // the tombstones and the removed casts are the primary guard. Deleting this
    // line converts a tolerated null into a throw, which is how the protection
    // would be lost a second time for a perfectly good reason.
    if (!col || col.accessorKey === '_actions') return col;
    const fieldDef = (objectSchema as any)?.fields?.[col.accessorKey];
    if (!fieldDef) return col;
    const next: ObjectGridColumnDraft = { ...col };
    if (next.type == null && fieldDef.type) next.type = fieldDef.type;
    // Read-only / computed / binary fields are not value-editable in place —
    // mark the column so the data-table never opens an editor (otherwise it
    // falls back to a plain text box for e.g. a Formula or File cell). Only
    // force `false`; leave editable unset otherwise so the grid-level flag wins.
    if (next.editable !== false && !isFieldInlineEditable(fieldDef)) {
      next.editable = false;
    }
    return next;
  })
    // ⭐ THE EMIT SEAM (objectui#5853, maintainer ruling 2026-08-25, Option B).
    //
    // Every column this component hands to `data-table` passes through here, so
    // it is the one place that can guarantee `TableColumn.type` only ever holds
    // a value that type DECLARES. Five paths above write `type`: the four
    // column literals inside `generateColumns()` and the `fieldDef.type`
    // enrichment in the map above — all of them forward an OBJECT SCHEMA's
    // field type verbatim, whose vocabulary is `@objectstack/spec`'s `FieldType`
    // (49 values, only 7 of them members of the declared union). That verbatim
    // forwarding is why the renderer had to read this key through an `as any`.
    //
    // ⛔ Deliberately a SEPARATE pass, not folded into the map above: that map
    // early-returns for `_actions` and for any column whose `accessorKey` has no
    // `fieldDef`, and a heuristic `inferColumnType()` type (`select`, `user`)
    // rides out on exactly those columns. Normalizing there would miss them.
    //
    // An out-of-union type drops the `type` KEY — never the column. See
    // `normalizeTableColumnType` for why absence beats folding onto `'text'`.
    //
    // This pass is also where the draft becomes the real thing: `type` is the
    // one member whose vocabulary differs between `ObjectGridColumnDraft` (producer
    // spelling) and `ObjectGridColumn` (what the slot declares), so the fold and the
    // type transition are the same step (objectui#6004).
    .map((col): ObjectGridColumn => {
      // ⛔ Kept on purpose, same reason as the `!col` guard in the enrichment
      // map above (objectui#6004) — unreachable by type, retained because this
      // producer's types have not held in practice. Destructuring a null below
      // would throw where the pre-#6004 code passed it through.
      if (!col) return col;
      const { type: producerType, ...rest } = col;
      if (producerType == null) return rest;
      const normalized = normalizeTableColumnType(producerType);
      if (normalized === undefined) return rest;
      return { ...rest, type: normalized };
    });

  // Apply persisted column order and widths
  let persistedColumns = [...columns];
  
  // Apply saved widths.
  //
  // ⭐ THE KEY IS `width` (objectui#6457). This stamp used to write `size`,
  // and `size` is a key nothing downstream consumes: `TableColumn`
  // (`@object-ui/types` `data-display.ts`) declares `width`, and `data-table`
  // resolves a column's width at all four of its sites as
  // `columnWidths[accessorKey] || col.width || autoSizedWidths[accessorKey]`
  // — zero column-level `size` reads. So a user's resize was written to
  // localStorage, read back into `columnState.widths`, stamped onto the column
  // here, and then dropped at the last hop; the width was never restored on the
  // ungrouped path.
  //
  // The grouped path is the control that identified `width` as the right fix
  // rather than teaching `data-table` a second key: `groupedColumnWidths` below
  // reads the SAME `columnState.widths` and stamps `width`, and it works.
  //
  // ⛔ Do not re-widen this callback to `(col: any)`. That cast is what let
  // the wrong key through a boundary which has DECLARED the right one since
  // objectui#6004 — `ObjectGridColumn` is `TableColumn & …`, so with the
  // callback typed, a stray `size` here is a compile error instead of a silent,
  // user-visible drop. Typed, this defect class cannot come back by hand.
  if (columnState.widths) {
    persistedColumns = persistedColumns.map((col): ObjectGridColumn => {
      const savedWidth = columnState.widths?.[col.accessorKey];
      if (savedWidth) {
        return { ...col, width: savedWidth };
      }
      return col;
    });
  }
  
  // Apply saved order
  if (columnState.order && columnState.order.length > 0) {
    const orderMap = new Map(columnState.order.map((key: string, i: number) => [key, i]));
    persistedColumns.sort((a: any, b: any) => {
      const orderA = orderMap.get(a.accessorKey) ?? Infinity;
      const orderB = orderMap.get(b.accessorKey) ?? Infinity;
      return orderA - orderB;
    });
  }

  // `operations`, the row-action lists and the row CRUD affordance verdict are
  // resolved further up, next to the permission reads they AND with — this
  // render path sits BELOW the error / loading early returns, and [#4296] the
  // record-level verdict they feed is fetched by a hook, which may not sit
  // behind a conditional return.
  const hasActions = !!(operations && (operations.update || operations.delete));
  const hasRowActions = customRowActions.length > 0 || resolvedRowActionDefs.length > 0 || wantEditAction || wantDeleteAction;

  const columnsWithActions = (hasActions || hasRowActions) ? [
    ...persistedColumns,
    {
      header: t('grid.actions'),
      accessorKey: '_actions',
      // Size to the buttons it holds (never the 80px char-estimate floor) and
      // don't clip — otherwise multiple inline actions (e.g. Open + Upgrade)
      // overflow the fixed-width cell and the leftmost button gets cut off.
      fitContent: true,
      align: 'right',
      // Stick to the right edge so the actions stay reachable when a wide table
      // scrolls horizontally (otherwise the last column sits past the scroll
      // extent and is hidden). Excluded from the frozen-column decision below so
      // this auto-pin doesn't cancel the default left-freeze of the first column.
      pinned: 'right',
      cell: (_value: any, row: any) => (
        <RowActionMenu
          row={row}
          rowActions={customRowActions}
          rowActionDefs={resolvedRowActionDefs as any[]}
          objectFields={objectSchema?.fields}
          // NON-AUTHOR SURFACE — `maxInlineRowActions` is deliberately
          // absent from `GRID_QUERY_INPUTS` (maintainer ruling, 2026-08-18,
          // objectui#5091), so this cast read is deliberate, not missed. It is
          // a host/internal switch for the inline-button budget before the
          // rest fold into the "⋮" menu — an embedder's layout call, set from
          // code (`apps/console/src/dev/DevRowActions.tsx:51`), never from a
          // view document. `ComponentPropsMap['object-grid']` is a
          // `strictObject` and rejects the key by name, so publishing it would
          // advertise a key the save gate refuses. The `?? 1` default is the
          // published behaviour and stays the one an author sees. Pinned by
          // `__tests__/gridNonAuthorKeys.test.tsx`.
          maxInlineActions={(schema as any).maxInlineRowActions ?? 1}
          // [#4296] The object verdict ANDed with THIS row's record-level one.
          // It rides the same per-row channel the #2614 predicates ride —
          // `planRowActionMenu` conjoins `canEdit`/`canDelete` with
          // `visibleWhen` in one expression, so the item and the "⋮" guard read
          // one decision (#3562) and a hidden row grows no empty trigger. An
          // unanswered row keeps the object verdict, i.e. today's rendering.
          canEdit={resolveRowRecordCrudAffordance(canEdit, recordVerdict(rowRecordId(row), 'update'))}
          canDelete={resolveRowRecordCrudAffordance(canDelete, recordVerdict(rowRecordId(row), 'delete'))}
          editPredicates={editPredicates}
          deletePredicates={deletePredicates}
          onEdit={onEdit}
          onDelete={onDelete}
          onAction={(action, r) => {
            void executeAction({ type: action, params: { record: r } }).then(res => {
              // A successful row action typically mutated this record; refresh
              // so the grid reflects the server state (same rationale as bulk).
              if (res?.success) setRefreshKey(k => k + 1);
            });
          }}
          onActionDef={(def, r) => {
            // Dispatch schema-driven row action through the runner. We forward
            // the full action def so type/target/recordIdParam/bodyShape/etc.
            // route correctly, attach the row record under `_rowRecord` for the
            // apiHandler row-id injection, and surface raw `params` as
            // `actionParams` so the runner shows the param dialog when present.
            const { params: rawParams, ...rest } = def;
            const dispatch: any = { ...rest };
            if (Array.isArray(rawParams) && rawParams.length > 0) {
              dispatch.actionParams = rawParams;
            }
            dispatch.params = { _rowRecord: r };
            void executeAction(dispatch).then(res => {
              if (res?.success) setRefreshKey(k => k + 1);
            });
          }}
        />
      ),
      sortable: false,
    },
  ] : persistedColumns;

  // --- Pinned column reordering ---
  // Reorder: pinned:'left' first, unpinned middle, pinned:'right' last
  const pinnedLeftCols = columnsWithActions.filter((c: any) => c.pinned === 'left');
  const pinnedRightCols = columnsWithActions.filter((c: any) => c.pinned === 'right');
  const unpinnedCols = columnsWithActions.filter((c: any) => !c.pinned);
  const hasPinnedColumns = pinnedLeftCols.length > 0 || pinnedRightCols.length > 0;
  const rightPinnedClasses = 'sticky right-0 z-10 bg-background border-l border-border';
  // The `_actions` column is auto-pinned right (above), so it must be excluded
  // from the frozen-column decision — otherwise every list with row actions
  // would trip `hasPinnedColumns` and lose the implicit left-freeze of its
  // first column. Only USER-declared pins should drive freezing.
  const userLeftPinnedCount = pinnedLeftCols.filter((c: any) => c.accessorKey !== '_actions').length;
  const hasUserPinnedColumns =
    userLeftPinnedCount > 0 || pinnedRightCols.some((c: any) => c.accessorKey !== '_actions');

  // Density-driven cell padding/font (applied to every column so it actually reaches <td>).
  // `h-*` enforces a minimum row height so the action-button column doesn't dictate it.
  const rowHeightCellClass =
    rowHeightMode === 'compact'
      ? 'px-3 py-1 h-9 text-[13px] leading-tight'
      : rowHeightMode === 'short'
        ? 'px-3 py-1 h-9 text-[13px] leading-normal'
        : rowHeightMode === 'tall'
          ? 'px-3 py-2.5 h-14 text-sm'
          : rowHeightMode === 'extra_tall'
            ? 'px-3 py-3.5 h-16 text-sm leading-relaxed'
            : 'px-3 py-1.5 h-11 text-[13px] leading-normal';

  // Body cells get `px-3` from rowHeightCellClass; give the header the same
  // horizontal padding so header labels line up exactly with the cell content
  // below them (the primitive <th> default is px-4, which is 4px wider).
  const applyDensity = (col: any) => ({
    ...col,
    className: ['px-3', col.className].filter(Boolean).join(' '),
    cellClassName: [rowHeightCellClass, col.cellClassName].filter(Boolean).join(' '),
  });

  // Server-side pagination applies to the flat, server-fetched list only.
  // Inline/static data and the grouped view paginate in-memory (grouped mode
  // keeps whole groups together via its own groupedPage state), so they stay
  // on DataTable's default client-side slicing.
  //
  // Declared here rather than beside the rest of the manual-mode wiring below
  // because `orderedColumns` needs it: which columns may be sorted at all
  // depends on whether the sort is the server's.
  const useServerPagination = !hasInlineData && !isGrouped;

  // Either we own the server fetch (useServerPagination) or a parent does
  // (externalManualPagination). Grouped mode always keeps in-memory slicing so
  // whole groups stay together. Both server modes feed DataTable a manual pager
  // backed by the real match total.
  const manualPaginationOn = (useServerPagination || externalManualPagination) && !isGrouped;

  // Server-side sorting, in either of the two server modes (objectui#3106).
  //
  // Tied to who owns the ROWS, not to who owns the pager: whenever `data` is
  // one window of a larger collection, sorting it in the browser orders that
  // window and nothing else. Grouped mode holds every row it groups, so it
  // keeps DataTable's own client-side sort.
  const manualSortingOn = manualPaginationOn;

  // Server-side search, on exactly the same condition (objectui#3118). Same
  // question, filter axis: when `data` is one window, a `.filter()` over it
  // narrows the fifty rows on screen while the rest of the collection never
  // participates — and unlike a mis-scoped sort, the count it produces reads as
  // a statement about the whole list. Grouped/inline grids hold every row they
  // display, so their box keeps filtering client-side, where it is honest.
  const manualSearchOn = manualPaginationOn;

  /**
   * [#5729] The SERVED per-column sortability projection for this object —
   * objectstack#10235's ruling A, consumed rather than re-derived.
   *
   * `undefined` means the metadata response carried no `sortability` key at
   * all: a backend older than the upstream change, or an inline/mock data
   * source. That is NOT "nothing is sortable" — see the branch in
   * `withSortability` below, which is why this stays a nullable projection
   * instead of collapsing to an empty map at the read.
   */
  const platformSortability = readObjectSortability(objectSchema);

  /**
   * Withhold the sort affordance from a column the server cannot honestly order
   * by, when the sort is the server's (objectui#3096 + #3106, #3950).
   *
   * TWO reasons, one mechanism — a column is offered as a sort key only when
   * both hold:
   *
   *  - RELATIONAL (`lookup` / `master_detail` / `user` / `tree`): the column
   *    stores a foreign-key id and shows the related record's name. A server
   *    `$orderby` can only order by the stored id — objectstack#4256 settled
   *    that no relation join is coming — so the column of names would come back
   *    in an order with no relation to the names.
   *  - UNMATERIALIZED (`formula`): no driver materialises a column for it, so
   *    there is nothing to order by at all. That sort never worked; until
   *    objectstack#6994 the platform did not say so (a `200` whose rows carried
   *    the values they were asked to be ordered by, unordered), and now it
   *    answers `400 INVALID_SORT`. Both are the same defect on this side of the
   *    wire: a header offering a sort the platform cannot perform.
   *
   * The ListView toolbar's sort picker withholds both for exactly these
   * reasons; a clickable header would have been the same illusion through a
   * different control.
   *
   * Only under manual sorting. A client-side sort keys off the value the cell
   * renders (`getSortValue`, #3096) — the resolved label for a relational
   * column, the server-hydrated result for a formula one — which is honest, so
   * those headers stay.
   */
  const withSortability = (col: any) => {
    if (!manualSortingOn || col.sortable === false) return col;
    const fieldDef = (objectSchema as any)?.fields?.[col.accessorKey];
    // RELATIONAL — unchanged, and deliberately NOT delegated to the platform
    // signal. The projection answers `sortable: true` for a `lookup` (measured:
    // it has a stored column and both runtime doors accept an ORDER BY over
    // it), because the platform's question is whether it can order by the
    // STORED foreign key — which it can. Ours is whether that order means
    // anything next to a column of names, and it does not. Two different
    // questions; folding this one into the signal would hand every relational
    // header its sort click back.
    if (isExpandableFieldType(fieldDef)) return { ...col, sortable: false };
    // PLATFORM — the served projection is authoritative when it was served.
    // `isPlatformSortableField` is the contract: an entry must EXIST and say
    // `sortable: true`. Absence is a refusal (an unknown name, a dotted path,
    // an unprovisioned audit column), never a default of `true`.
    if (platformSortability) {
      return isPlatformSortableField(platformSortability, col.accessorKey)
        ? col
        : { ...col, sortable: false };
    }
    // NO SIGNAL SERVED — a deployment older than objectstack#10235, or an
    // inline/mock data source. Behaviour is exactly what it was before this
    // card, via the same `@objectstack/spec` set (`SEARCH_VIRTUAL_TYPES`) the
    // platform's own projection is computed from, so the two cannot disagree
    // about `formula`. This branch is a compatibility floor, not a second
    // judge: the moment a backend serves the signal it is unreachable, and it
    // is meant to be deleted when the supported floor passes that release.
    return isUnmaterializedFieldType(fieldDef) ? { ...col, sortable: false } : col;
  };

  const applyColumnChrome = (col: any) => withSortability(applyDensity(col));

  const orderedColumns = hasPinnedColumns
    ? [
        ...pinnedLeftCols.map(applyColumnChrome),
        ...unpinnedCols.map(applyColumnChrome),
        ...pinnedRightCols.map((col: any) => ({
          ...applyColumnChrome(col),
          className: ['px-3', col.className, rightPinnedClasses].filter(Boolean).join(' '),
          cellClassName: [rowHeightCellClass, col.cellClassName, rightPinnedClasses].filter(Boolean).join(' '),
        })),
      ]
    : columnsWithActions.map(applyColumnChrome);

  // Calculate frozenColumns: if the USER pinned columns, use their left-pinned
  // count; otherwise fall back to the schema default (freeze the first column).
  // The auto-pinned actions column is intentionally not counted here.
  const effectiveFrozenColumns = hasUserPinnedColumns
    ? userLeftPinnedCount
    : (schema.frozenColumns ?? 1);

  // Determine selection mode (support both new and legacy formats)
  // Auto-enable 'multiple' selection when bulk actions are defined OR when
  // a bulk-delete affordance is implicitly available (canDelete + onBulkDelete
  // wired by the consumer). This gives every list a multi-select + delete UX
  // out of the box without forcing each view JSON to declare bulkActions.
  // [#3720] Bulk delete is the most destructive affordance on the list, so it
  // rides the same object-level `delete` verdict as the row kebab (bucket lock
  // ∧ userActions ∧ the server's effective operation set). An author-declared
  // `bulkActions: ['delete']` / `bulkActionDefs[].operation === 'delete'` is a
  // WIRING declaration, not a permission grant — so the built-in delete is
  // filtered out of both when the verdict is off. Custom action ids and
  // non-delete operations are untouched: they route through the action runner
  // and carry their own gates.
  const declaredBulkActions = schema.batchActions ?? schema.bulkActions;
  const explicitBulkActions = objectCanDelete
    ? declaredBulkActions
    : declaredBulkActions?.filter((a: unknown) => String(a).toLowerCase() !== 'delete');
  // `bulkActions` carries a bare action NAME, which the runner cannot execute
  // on its own — resolve each against `objectDef.actions` so it dispatches as a
  // real def. See `resolveBulkActions` (objectui#3002). The
  // canonical `'delete'` is held back: it routes to `onBulkDelete` (which owns
  // confirm + refresh), not the runner, even if the object declares an action
  // that happens to be named `delete`.
  const legacyBulkNames = (explicitBulkActions ?? []).filter(
    (a: unknown) => String(a).toLowerCase() !== 'delete',
  );
  const { defs: resolvedBulkDefs, unresolved: unresolvedBulkActions } = resolveBulkActions({
    bulkActions: legacyBulkNames,
    bulkActionDefs: Array.isArray(schema.bulkActionDefs) ? schema.bulkActionDefs : [],
    objectActions: (objectSchema as any)?.actions,
    localizeLabel: (actionName, fallback) =>
      resolveActionLabel(schema.objectName, actionName, fallback),
  });
  const bulkActionDefs: BulkActionDef[] = resolvedBulkDefs.filter(
    (def: BulkActionDef) => objectCanDelete || def?.operation !== 'delete',
  );
  // Names still dispatched by string: the unresolved ones, plus `'delete'`
  // when the author asked for it — or the implicit bulk-delete affordance.
  const keptDeleteAction = (explicitBulkActions ?? []).filter(
    (a: unknown) => String(a).toLowerCase() === 'delete',
  );
  const effectiveBulkActions: string[] =
    explicitBulkActions && explicitBulkActions.length > 0
      ? [...unresolvedBulkActions, ...keptDeleteAction]
      : canDelete && onBulkDelete && bulkActionDefs.length === 0
        ? ['delete']
        : [];
  const hasBulkActions = effectiveBulkActions.length > 0 || bulkActionDefs.length > 0;
  let selectionMode: 'none' | 'single' | 'multiple' | boolean = false;
  if (schema.selection?.type) {
    selectionMode = schema.selection.type === 'none' ? false : schema.selection.type;
  } else if (schema.selectable !== undefined) {
    // Legacy support
    selectionMode = schema.selectable;
  } else if (hasBulkActions) {
    // Auto-enable multi-select when bulk actions exist
    selectionMode = 'multiple';
  }
  // `selection.type: 'single'` caps the selection at one row (the data-table
  // enforces replace-on-select, #2941), so the cross-page "select all N
  // matching" escalation must never be offered.
  const singleSelection = selectionMode === 'single';

  // The query the cross-page fan-out would replay — from whichever side owns the
  // fetch (objectui#4501). ONE value, read by the fan-out AND by the affordance
  // gate below, so the offer and the thing it promises can never disagree.
  //
  // `hasInlineData` is exactly the data loader's own guard (`if (hasInlineData)
  // return`), which makes it the precise test for "this grid did not issue the
  // query behind the rows on screen". In that case `lastFindParamsRef` is not
  // merely empty, it is WRONG — either never written, or left over from an
  // earlier own-fetch — so the host's `findParams` is the only admissible
  // source, and there is deliberately no fallback to the ref and no `?? {}`
  // default: replaying `{}` is what asked the server for the whole object and
  // fed up to 5000 unmatched records to bulk delete.
  const bulkFanoutParams: Record<string, unknown> | null = hasInlineData
    ? (hostFindParams ?? null)
    : (lastFindParamsRef.current ?? null);

  // The floor. With no query to replay there is no honest "all N matching", so
  // the escalation is not offered — the same answer as a match set that does not
  // exist. This is what makes an unfiltered fan-out structurally unreachable
  // rather than merely currently-wired-right: a host that forgets `findParams`
  // loses the affordance, it does not silently get the whole object.
  //
  // ONE condition, consumed by both `BulkActionBar` sites below. Do NOT re-spell
  // it at a consumption site — a second copy is how one of them gets missed
  // (objectui#4138, #4464).
  const canOfferSelectAllMatching = !singleSelection && bulkFanoutParams !== null;

  // Resolve the rows the bulk action should actually operate on. When
  // "select all N matching" is active, fan out a paged find against the
  // current query so we can hand a complete record list to the executor.
  // (Plain function — placed late in the component body where prior renders
  // sometimes short-circuit before reaching it; using useCallback here would
  // tripwire the rules-of-hooks balance.)
  const resolveBulkRows = async (rowsHint: any[]): Promise<any[]> => {
    if (!selectAllMatching) return rowsHint;
    const objectName = schema.objectName;
    if (!dataSource || !objectName) return rowsHint;
    // The floor again, at the point of consumption: the affordance gate above
    // means an escalation cannot be reached without params, and this means it
    // cannot be ACTED on without them either. Same single source, so the two
    // cannot drift.
    if (!bulkFanoutParams) return rowsHint;
    const base = { ...bulkFanoutParams } as Record<string, unknown>;
    delete (base as any).$top;
    delete (base as any).$skip;
    const HARD_CAP = 5000;
    const PAGE = 500;
    const collected: any[] = [];
    let skip = 0;
    while (collected.length < HARD_CAP) {
      const page = await dataSource.find(objectName, { ...base, $top: PAGE, $skip: skip });
      const items = page.data ?? [];
      if (items.length === 0) break;
      collected.push(...items);
      if (items.length < PAGE) break;
      skip += PAGE;
    }
    return collected.slice(0, HARD_CAP);
  };

  // Bulk action dispatcher — for the implicit 'delete' action, route through
  // the consumer-provided onBulkDelete (which already knows about confirm +
  // refresh). Other actions fall through to the generic action runner.
  //
  // [#3056] Every path that clears the selection must clear BOTH selection
  // sources. `selectedRows` is ours and drives the toolbar; the row checkboxes
  // live inside the data-table and only clear when `selectionResetKey` moves.
  // Bumping one without the other strands the user on a page of ticked rows
  // with no toolbar to act on them — the exact drift `handleBulkDialogClose`
  // below already guards.
  //
  // [#4140] So this is the ONE reset — dispatch, delete, dialog-close AND the
  // bulk bar's own `onClearSelection`. Both `BulkActionBar` sites previously
  // hand-wrote `setSelectedRows([]); setSelectAllMatching(false);`, which is
  // this function minus the key bump: Clear emptied the toolbar and left every
  // checkbox ticked. Never re-implement the reset inline — call this.
  const resetSelection = () => {
    setSelectedRows([]);
    setSelectAllMatching(false);
    setSelectionResetKey(k => k + 1);
  };

  /**
   * [objectui#4420] The built-in Delete, as a def — so the ONE selection whose
   * records the predicate split can be reported on the surface built to report
   * it. Constructed only when the dialog route is taken (see below), never
   * rendered in the bar: the bar's Delete stays the legacy string button it has
   * always been, because the ruling is explicit that the predicate must not
   * change whether the button is offered.
   */
  const builtInDeleteDef = (): BulkActionDef => ({
    name: 'delete',
    label: resolveActionLabel(schema.objectName, 'delete', formatActionLabel('delete')),
    operation: 'delete',
    variant: 'danger',
  });

  const dispatchBulkAction = (action: string, rows: any[]) => {
    void (async () => {
      const expanded = await resolveBulkRows(rows);
      if (action === 'delete' && onBulkDelete) {
        // [objectui#4420] `userActions.delete.visibleWhen` gates the built-in
        // Delete PER RECORD — the same key, the same fail-closed fold and the
        // same evaluator the row kebab and the rich-def bar already run
        // (`partitionBulkRows` → `partitionRowsByPredicate`). Applied to the
        // EXPANDED set for the reason #3067 states one line down in
        // `dispatchBulkActionDef`: "select all N matching" pulls in records no
        // on-screen check ever evaluated.
        //
        // The predicates come from `objectDeletePredicates`, not
        // `deletePredicates`: the latter rides `canDelete`, which folds in the
        // ROW wiring (`onDelete`), and bulk delete rides `onBulkDelete`. A
        // consumer wiring only the bulk handler would otherwise have the
        // author's predicate silently dropped.
        const { eligible, skipped } = partitionBulkRows(
          { name: 'delete', visible: objectDeletePredicates?.visibleWhen as never },
          expanded,
          { scope: predicateScope, fields: objectSchema?.fields },
        );
        if (skipped === 0) {
          // Nothing was excluded, so there is nothing to report and no reason
          // to change surfaces: the consumer's own delete flow — which owns the
          // confirmation, the toast and the refresh — runs exactly as before.
          // This is also what keeps every object that declares no predicate at
          // all byte-identical to its previous behaviour.
          onBulkDelete(eligible);
          resetSelection();
          return;
        }
        // Something WAS excluded. The run must own up to it, and
        // `BulkActionDialog`'s `bulk-skipped-notice` is the slot built for this
        // shape (objectui#3067) — so the delete is confirmed and executed
        // there, over `eligible` only. Routing it back through `onBulkDelete`
        // instead would put the host's own confirmation dialog behind this
        // one and confirm the same delete twice.
        //
        // `eligible` may be EMPTY, and that case deliberately still opens the
        // dialog: the maintainer ruled a selection where every row is excluded
        // must produce "a legible refusal, not a hidden button whose absence is
        // unexplained". The dialog reports zero affected records beside the
        // skipped notice, and declines to run (see `noEligibleRows` there).
        setActiveBulkDef(builtInDeleteDef());
        setActiveBulkRows(eligible);
        setActiveBulkSkipped(skipped);
        return;
      }
      // A string bulk action (e.g. a consumer-registered runner handler)
      // mutated the selected records, usually through a custom API that never
      // touches dataSource.update — so nothing else signals the grid to
      // refetch. On success, reset the selection and refresh so the list
      // reflects the server state (mirrors the delete branch and
      // handleBulkDialogClose).
      const res = await executeAction({ type: action, params: { records: expanded } });
      if (res?.success) {
        resetSelection();
        setRefreshKey(k => k + 1);
      }
    })();
  };

  // Rich BulkActionDef dispatcher — opens the BulkActionDialog (params →
  // confirm → progress → result). When the user closes the dialog after a
  // run, refresh data so the grid reflects mutations.
  const dispatchBulkActionDef = (def: BulkActionDef, rows: any[]) => {
    void (async () => {
      const expanded = await resolveBulkRows(rows);
      // [#3067] Re-apply `visible` to the EXPANDED set, not just the page
      // selection the bar could see: "select all N matching" pulls in records
      // the button's own eligibility check never evaluated, and running the
      // action on those would defeat the gate the author wrote.
      const { eligible, skipped } = partitionBulkRows(def, expanded, {
        scope: predicateScope,
        fields: objectSchema?.fields,
      });
      setActiveBulkDef(def);
      setActiveBulkRows(eligible);
      setActiveBulkSkipped(skipped);
    })();
  };

  // Per-record executor for a PROMOTED bulk action (objectui#3002) — one
  // declared object action applied to each selected record through the action
  // runner. The dialog already collected params and took the confirmation, so
  // this dispatch strips both from the def: leaving them on would make the
  // runner re-prompt once per record. Toasts are muted for the same reason —
  // the dialog's progress/result panel is the single report for the whole run.
  // (Plain function for the same reason as `resolveBulkRows` above: this point
  // in the body is past render paths that short-circuit, so a hook here would
  // tripwire the rules-of-hooks balance.)
  // Shared def-key strip for BOTH bulk dispatchers below. The dialog already
  // collected params and took the confirmation, so the dispatch must remove
  // them from the source action — leaving them on would make the runner
  // re-prompt (once per record on the per-record path). Kept in one place so
  // the two dispatchers cannot drift on what gets stripped.
  const stripCollectedActionKeys = (source: Record<string, any>) => {
    const {
      params: _declaredParams,
      actionParams: _actionParams,
      confirmText: _confirmText,
      confirm: _confirm,
      ...rest
    } = source;
    return rest;
  };

  const runBulkActionRecord = async (
    def: BulkActionDef,
    row: Record<string, unknown>,
    params: Record<string, unknown>,
  ): Promise<void> => {
    const source = def.actionDef as Record<string, any> | undefined;
    if (!source) return;
    const {
      // A one-shot reveal (2FA code, fresh OAuth secret) is a single-record
      // affordance by construction, and the runner AWAITS acknowledgement —
      // one modal per record would stall the run behind N dialogs.
      resultDialog: _resultDialog,
      ...rest
    } = stripCollectedActionKeys(source);
    const res = await executeAction({
      ...rest,
      // `_rowRecord` is the same row-context key the list_item path attaches,
      // so `recordIdParam` / `recordIdField` injection behaves identically.
      params: { ...params, _rowRecord: row },
      toast: { showOnSuccess: false, showOnError: false },
    } as any);
    // Reject so the executor records this row under its own id in the result
    // (and the error CSV) instead of counting a failed action as succeeded.
    if (!res?.success) {
      throw new Error(res?.error || `Action ${def.name} failed`);
    }
  };

  // Whole-selection dispatcher for a def that opted into
  // `execution: 'aggregate'` (objectui#3139): ONE runner dispatch carrying
  // every selected id as `params._selectedIds`, so the target endpoint can
  // produce a single aggregate artifact (zip of QR codes, merged PDF…).
  // Unlike the per-record path, `resultDialog` is NOT stripped — the
  // per-record rationale (one modal per record stalls the run) does not
  // apply to a single call, and a one-shot reveal of the aggregate result
  // (download URL, generated codes) is exactly this mode's use case.
  const runBulkActionAggregate = async (
    def: BulkActionDef,
    rows: Array<Record<string, unknown>>,
    params: Record<string, unknown>,
  ): Promise<void> => {
    const source = def.actionDef as Record<string, any> | undefined;
    if (!source) return;
    const rest = stripCollectedActionKeys(source);
    const ids = rows.map((r) => (r.id != null ? String(r.id) : '')).filter(Boolean);
    // Publish the EXPANDED, eligibility-filtered rows the run actually covers
    // — the standing selection effect only carries the current page's ticks,
    // while "select all N matching" and the `visible` partition can both
    // change the real set. Handlers and `${ctx.selection.*}` interpolation
    // read this. The next selection change re-publishes, so no cleanup here.
    updateActionContext({ selectedRecords: rows });
    const res = await executeAction({
      ...rest,
      params: { ...params, _selectedIds: ids },
      toast: { showOnSuccess: false, showOnError: false },
    } as any);
    if (!res?.success) {
      throw new Error(res?.error || `Action ${def.name} failed`);
    }
  };
  const handleBulkDialogClose = (result?: BulkResult | null) => {
    setActiveBulkDef(null);
    setActiveBulkRows([]);
    setActiveBulkSkipped(0);
    // Only reset selection when the run actually changed something. A total
    // failure (0 succeeded — e.g. a "推计划" precondition error) leaves the data
    // untouched, so we keep the selection *and* the toolbar so the user can fix
    // it and retry the same rows.
    if (result && result.succeeded > 0) {
      resetSelection();
      // Trigger refresh via the same path used by single-record mutations.
      setRefreshKey(k => k + 1);
    }
  };

  // Default inline-edit persistence.
  //
  // When a consumer wires `onRowSave`/`onBatchSave` (React host), we defer to it.
  // But a declaratively-configured `editable: true` view has no host wiring — so
  // "Save All" would otherwise just clear pending changes without writing to the
  // backend. Supply a default that persists through the grid's `dataSource`, then
  // refresh so the grid reflects persisted values. Throwing on failure is
  // important: DataTable's saveRow/saveBatch keep pending changes when the save
  // promise rejects, so a failed write doesn't silently lose the user's edits.
  const resolveRecordId = (row: any): string | number | undefined =>
    row?._id ?? row?.id;

  const defaultRowSave = async (
    _rowIndex: number,
    changes: Record<string, any>,
    row: any,
  ): Promise<void> => {
    if (!dataSource || !objectName) {
      throw new Error('Cannot persist inline edit: no dataSource/objectName configured on the grid.');
    }
    const id = resolveRecordId(row);
    if (id === undefined || id === null) {
      throw new Error('Cannot persist inline edit: row has no id/_id.');
    }
    await dataSource.update(objectName, id, changes);
    // Refresh so the grid shows the persisted values.
    setRefreshKey(k => k + 1);
  };

  const defaultBatchSave = async (
    changes: Array<{ rowIndex: number; changes: Record<string, any>; row: any }>,
  ): Promise<void> => {
    if (!dataSource || !objectName) {
      throw new Error('Cannot persist inline edits: no dataSource/objectName configured on the grid.');
    }
    // Update each modified row. The DataSource `bulk`/`bulkUpdate` primitives
    // apply a single uniform patch across many ids, which does NOT fit per-row
    // edits (each row has its own field changes), so issue one update per row.
    await Promise.all(
      changes.map(({ changes: rowChanges, row }) => {
        const id = resolveRecordId(row);
        if (id === undefined || id === null) {
          throw new Error('Cannot persist inline edit: row has no id/_id.');
        }
        return dataSource.update(objectName, id, rowChanges);
      }),
    );
    setRefreshKey(k => k + 1);
  };

  // Determine pagination settings (support both new and legacy formats)
  const paginationEnabled = schema.pagination !== undefined 
    ? true 
    : (schema.showPagination !== undefined ? schema.showPagination : true);
  
  const pageSize = schema.pagination?.pageSize 
    || schema.pageSize 
    || 10;

  // Determine search settings
  const searchEnabled = schema.searchableFields !== undefined
    ? schema.searchableFields.length > 0
    : (schema.showSearch !== undefined ? schema.showSearch : true);

  // The real match total, from whichever side owns the fetch — ONE derived
  // value with ONE answer (objectui#4464). The pager has always read it this
  // way; the cross-page "Select all N matching" affordance read the raw
  // `totalMatching` STATE instead, whose only writer is this component's own
  // data loader. Under a host that fetches the rows itself (ListView passing
  // `manualPagination` + `rowCount`, i.e. the console) that loader never runs,
  // so the state stayed `undefined` and `BulkActionBar`'s gate was permanently
  // false while the pager, two lines away, showed the correct page count off
  // the very number the bar needed.
  //
  // All three consumers now read this const — the pager's `rowCount` and both
  // `BulkActionBar` sites. Do NOT re-spell the conditional at a second
  // consumption site: two copies of the fallback is exactly how one of them
  // gets missed again (this defect, and #4138 before it).
  //
  // This answers HOW MANY match, and `canOfferSelectAllMatching` (objectui#4501)
  // independently answers WHETHER the escalation may be offered at all. The two
  // compose and neither substitutes for the other: the bar sites read this total
  // only *through* that floor, so a host with a real `rowCount` but no
  // `findParams` still gets no offer — a number to display is not a query to
  // replay. The floor also subsumes the `singleSelection` suppression that used
  // to be spelled at these sites (`!singleSelection` is its first conjunct).
  const resolvedTotalMatching = externalManualPagination ? hostRowCount : totalMatching;
  const manualPage = externalManualPagination ? hostPage : serverPage;
  const manualPageSize = externalManualPagination
    ? (hostPageSize ?? serverPageSize)
    : serverPageSize;
  const manualOnPageChange = externalManualPagination
    ? hostOnPageChange
    : setServerPage;
  const manualOnPageSizeChange = externalManualPagination
    ? hostOnPageSizeChange
    : (size: number) => { setServerPageSize(size); setServerPage(1); };

  // ── Is the grouping on screen page-scoped? (objectui#7189) ───────────────
  //
  // `useGroupedData` buckets the rows THIS COMPONENT HOLDS and computes every
  // per-group aggregate from that same array, so both the set of groups and
  // every number in a group header are properties of the fetched page rather
  // than of the query. That is a correct implementation of client-side
  // grouping and is deliberately untouched here; what was missing is any
  // statement that client-side grouping is what you are looking at. A group
  // whose records all fall beyond the page does not appear AT ALL — and a
  // wrong number invites a second look where an absent row invites none.
  //
  // Two knowable conditions, deliberately different in strength, because the
  // wording each one can honestly support differs with it:
  //
  //  1. A real match total to compare against — `resolvedTotalMatching`, the
  //     same ONE derived value the pager and both bulk-bar sites read (do not
  //     re-spell the `externalManualPagination` conditional here; two copies
  //     of it is how one of them got missed in #4464). Exceeding the rows in
  //     hand makes the grouping partial as a FACT, with both numbers.
  //  2. No total, but we asked the server for a window and it came back full.
  //     `plugin-list`'s own footer draws exactly this inference when no total
  //     is known (`items.length >= effectivePageSize`), and it can only ever
  //     say "may": a result set that exactly fills the window trips it too.
  //
  // Rows handed to us inline are NOT a page — nothing was asked for and
  // nothing was withheld — so `hasInlineData` gates condition 2 out. The
  // host-driven paging mode still reaches condition 1, through `hostRowCount`.
  // A result set that fits leaves the grid silent, and that silence is what
  // makes the marker mean something when it does appear.
  const groupingRowsLoaded = data.length;
  const groupingTotalKnown = typeof resolvedTotalMatching === 'number';
  const groupingPartialWithTotal =
    groupingTotalKnown && (resolvedTotalMatching as number) > groupingRowsLoaded;
  const groupingPartialWindowFull =
    !groupingTotalKnown && !hasInlineData && groupingRowsLoaded >= serverPageSize;
  const groupingIsPartial =
    isGrouped && (groupingPartialWithTotal || groupingPartialWindowFull);
  // ONE sentence, used in both places it belongs: the notice above the group
  // list, and the accessible name of the marker beside every group count.
  const groupingPartialNotice = groupingIsPartial
    ? (groupingPartialWithTotal
      ? t('grid.grouping.partialNotice', {
        loaded: groupingRowsLoaded,
        total: resolvedTotalMatching,
      })
      : t('grid.grouping.partialNoticeUnknownTotal', { loaded: groupingRowsLoaded }))
    : undefined;
  const groupingPartialLabel = groupingIsPartial ? t('grid.grouping.partialBadge') : undefined;

  // Before anyone clicks, the headers show the sort the view was authored with
  // — read with the same `schemaSort` → `defaultSort` precedence the fetch path
  // above uses, so the arrow on screen and the `$orderby` on the wire are the
  // same sort. Without that a view arriving `created_at desc` would show no
  // arrow, and the first click on that column would ask for `asc` on a list
  // that was already `desc`.
  //
  // A plain expression, not a `useMemo`: this sits below the component's early
  // returns, where a hook would be skipped on some renders and change the hook
  // order. Parsing at most a handful of sort keys costs nothing worth a hook.
  const declaredSort = parseSchemaSort(
    schemaSort ?? (schema.defaultSort ? [schema.defaultSort] : undefined),
  );
  /**
   * [#5729] The RESTORE leg of objectstack#10235's contract, and the guard
   * that keeps the personalization PUT off an unsortable column.
   *
   * Withholding the header click (see `withSortability`) stops a NEW sort on
   * such a column from ever being created — `DataTable` emits `onSortChange`
   * only out of `handleSort`, which is itself gated on `col.sortable !== false`
   * — but it says nothing about a sort that is ALREADY in stored view state,
   * persisted before the signal existed. Replayed, that entry would put a
   * refused `$orderby` on the wire, paint an active-sort arrow on a header
   * that offers no click, and ride along into the next
   * `persistViewPatch({ sort })` the toolbar issues for an unrelated reason —
   * the exact half-fix where the affordance is gone and the PUT still fires.
   *
   * So both directions run through the same filter: what the grid RENDERS the
   * sort state as, and what it EMITS back to whoever persists it. A stale
   * entry is inert on arrival and is dropped the first time anything writes
   * the sort back. Only under a served projection — with no signal there is no
   * verdict to filter by, and the pre-#10235 behaviour stands unchanged.
   */
  const rawManualSort: TableSortItem[] = externalManualPagination
    ? (hostSort ?? [])
    : (headerSort ?? declaredSort);
  const manualSort: TableSortItem[] = platformSortability
    ? filterPlatformSortableSort(rawManualSort, platformSortability)
    : rawManualSort;
  const rawManualOnSortChange = externalManualPagination
    ? hostOnSortChange
    : setHeaderSort;
  // Wrap only when there is BOTH a projection to judge by and a handler to
  // wrap. Manufacturing a function where the host offered none would flip
  // `DataTable`'s `sortingEnabled` (`!manualSorting || !!onSortChange`) from
  // false to true and hand sort clicks to a host that never asked for them.
  const manualOnSortChange = platformSortability && rawManualOnSortChange
    ? (next: TableSortItem[]) => rawManualOnSortChange(
        filterPlatformSortableSort(next, platformSortability),
      )
    : rawManualOnSortChange;

  // The search term, in whichever server mode applies. When a parent owns the
  // rows it owns the term too (ListView already does, from its own toolbar —
  // which is why it passes `showSearch: false` and no box is rendered here);
  // when we own the fetch, the box writes `searchTerm` and the effect above
  // turns it into `$search`. A parent that drives the rows but offers no
  // `onSearchChange` gets NO box rather than one scoped to its window.
  const manualSearch = externalManualPagination
    ? (hostSearch ?? '')
    : searchTerm;
  const manualOnSearchChange = externalManualPagination
    ? hostOnSearchChange
    : setSearchTerm;

  const dataTableSchema: ObjectGridDataTableSchema = {
    type: 'data-table',
    caption: schema.label || schema.title,
    columns: orderedColumns,
    data,
    pagination: paginationEnabled,
    pageSize: manualPaginationOn ? manualPageSize : pageSize,
    // Rows-per-page selector options sourced from view metadata
    // (schema.pagination.pageSizeOptions). When absent the DataTable falls back
    // to its built-in list. This is what makes the single, server-driven pager
    // expose the configured 50/100/200/500 choices instead of a second control.
    pageSizeOptions: schema.pagination?.pageSizeOptions,
    // In server mode `data` IS the current page; tell DataTable to render it
    // as-is and drive paging via the callbacks below using the real match total.
    manualPagination: manualPaginationOn,
    rowCount: manualPaginationOn ? resolvedTotalMatching : undefined,
    page: manualPaginationOn ? manualPage : undefined,
    onPageChange: manualPaginationOn ? manualOnPageChange : undefined,
    onPageSizeChange: manualPaginationOn ? manualOnPageSizeChange : undefined,
    manualSorting: manualSortingOn,
    sort: manualSortingOn ? manualSort : undefined,
    onSortChange: manualSortingOn ? manualOnSortChange : undefined,
    searchable: searchEnabled,
    manualSearch: manualSearchOn,
    search: manualSearchOn ? manualSearch : undefined,
    onSearchChange: manualSearchOn ? manualOnSearchChange : undefined,
    selectable: selectionMode,
    // ObjectGrid surfaces the selection via its own bottom BulkActionBar
    // (count + Clear + bulk actions). Suppress the data-table's built-in
    // "N selected" toolbar so it doesn't render a duplicate, orphaned row
    // above the table when search/export are handled by the outer toolbar.
    showSelectionCount: false,
    sortable: true,
    exportable: operations?.export,
    // Flat list view: drop the rounded outer frame so the table sits flush
    // beneath the toolbar's `border-b`. Matches the Airtable-style grouped
    // mode introduced for `buildGroupTableSchema`. Metadata can re-enable
    // the frame by setting `borderless: false` on the schema.
    borderless: true,
    // RowActionMenu column (from columnsWithActions) already handles edit/delete
    // actions via onEdit/onDelete props. Only enable DataTable's built-in action
    // column for inline-editing save/cancel (editable grids with onRowSave).
    //
    // [#5143] …which is exactly why it follows `inlineEditable` and not the raw
    // schema key. This column's ONLY populated state is the save/cancel pair,
    // shown when a row has pending changes: ObjectGrid never passes DataTable
    // the `onRowEdit`/`onRowDelete`/`rowActionDefs` its built-in menu needs
    // (they go to `columnsWithActions` instead), so `DataTableRowActionsMenu`
    // renders `null` here on every row. Gate the editing but not this column and
    // a read-only principal gets a permanently empty trailing column plus its
    // header — a grid shape that has never existed, since a schema WITHOUT
    // `editable` produces no such column today. Following the same verdict is
    // what makes the gated grid identical to the non-editable one.
    rowActions: !!(inlineEditable && hasActions),
    resizableColumns: schema.resizable ?? schema.resizableColumns ?? true,
    reorderableColumns: schema.reorderableColumns ?? false,
    // [#5143] The authored key ∧ this principal's write verdict on the object.
    editable: inlineEditable,
    // In-place cell editor: render the dedicated @object-ui/fields widget for
    // the field's type — the SAME control the form uses (select→dropdown,
    // boolean→checkbox, date→date picker, multi-select, …). Returning null lets
    // DataTable fall back to its built-in text/number/date inputs. Discrete
    // pickers commit-and-close on choose; everything else stages and closes when
    // the user moves on.
    // [#5143] Same verdict as `editable` above: withholding the mode but still
    // handing DataTable an editor factory would leave the built-in fallback
    // editors as the only reachable ones if any future path re-opened the mode.
    renderCellEditor: inlineEditable
      ? (ctx: { column: any; row: any; pendingRow: any; value: any; stage: (v: any) => void; commit: (v?: any) => void }) => {
          const fieldDef = (objectSchema as any)?.fields?.[ctx.column?.accessorKey];
          if (!fieldDef || !hasFieldEditWidget(fieldDef.type)) return null;
          const discrete = DISCRETE_EDIT_TYPES.has(fieldDef.type);
          let field: any = { name: ctx.column.accessorKey, ...fieldDef };
          // State-machine-aware: a field bound to a `state_machine` validation
          // only offers transitions valid from the current value, so the editor
          // can't stage an edit the server would reject (e.g. done → in_review).
          const reachable = stateMachineNextValues(objectSchema, ctx.column.accessorKey, ctx.value);
          if (reachable && Array.isArray(field.options)) {
            field = {
              ...field,
              options: field.options.filter((o: any) => reachable.has(String(o?.value ?? o))),
            };
          }
          return (
            <FieldEditWidget
              field={field}
              value={ctx.value}
              onChange={(v: any) => (discrete ? ctx.commit(v) : ctx.stage(v))}
              // The record a dependent widget scopes itself by (objectui#7165,
              // finished by objectui#7188). `LookupField` resolves
              // `dependentValues ?? ctx.formValues ?? ctx.data ?? {}`, and only
              // the FIRST link is suppliable by any host: `SchemaRendererContextType`
              // declares exactly `dataSource` / `debug` / `debugFlags` / `apiFetch`,
              // so the tail is unconditionally empty repo-wide (objectui#7206) —
              // which is why the repair is this prop and could not have been a
              // provider. A grid that supplied none of the three rendered every
              // `dependsOn` column as a permanently gated, disabled trigger
              // ("Select region first") even when the row carried the parent —
              // a field that could never be filled, with no diagnostic. PR
              // objectui#2216 gave the FORM renderer exactly this injection (its
              // LIVE watched record); the other half — every picker taking the
              // `dependsOn` chain as a hard `baseFilter` — is host-independent
              // and was already live here, so this line supplies a missing INPUT
              // and re-implements no cascade.
              //
              // `pendingRow` is the PERSISTED row shallow-merged with this row's
              // STAGED, unsaved edits (`data-table` builds it from its
              // `pendingChanges`), so a parent edited in the same row re-scopes
              // the child before anything is saved — the form's semantics.
              // `ctx.row` alone was #7165's interim and scoped by the SAVED
              // parent. `pendingRow` is a REQUIRED member of the declared
              // context (`@object-ui/types`, objectui#6882 + #7188), so the
              // `?? ctx.row` never selects for a conforming host; it is spelled
              // so a context handed to this factory WITHOUT it degrades to the
              // saved-row scoping rather than to `{}` — gated forever — and it
              // is the spelling objectui#7188's ruling chose.
              dependentValues={ctx.pendingRow ?? ctx.row}
            />
          );
        }
      : undefined,
    singleClickEdit: schema.singleClickEdit ?? true,
    className: schema.className,
    cellClassName: rowHeightMode === 'compact'
      ? 'px-3 py-1 text-[13px] leading-tight'
      : rowHeightMode === 'short'
        ? 'px-3 py-1 text-[13px] leading-normal'
        : rowHeightMode === 'tall'
          ? 'px-3 py-2.5 text-sm'
          : rowHeightMode === 'extra_tall'
            ? 'px-3 py-3.5 text-sm leading-relaxed'
            : 'px-3 py-1.5 text-[13px] leading-normal',
    showRowNumbers: true,
    // [#5148] The authored request ∧ the principal's verdict — the conjunction
    // #5143 spelled for `editable` and #4646 / PR #5145 spelled for the
    // related-list "+ New" (`objectCanCreate = affordances.create ∧
    // can(obj,'create')`), with the operation moved to `create`.
    //
    // The authored key stays the gate's LEFT half, so this narrows and never
    // widens: no verdict can turn the add row ON for a grid that did not ask
    // for it, and a grid declaring no `operations` at all keeps falling through
    // the `{ update: !!onEdit, delete: !!onDelete }` default that carries no
    // `create` key.
    //
    // Fail-open, like every sibling gate in this file. `can()` answers `true`
    // with no `PermissionProvider` mounted, and `permissionCreate` is
    // `undefined` when no object name resolved (element/inline data source) —
    // both leave today's behaviour exactly as it was. That fallback is
    // load-bearing rather than incidental: `plugin-designer`'s `FieldDesigner`
    // and `ObjectManager` both build grids with `operations: { create: true,
    // update: true, delete: true }` when not read-only, and those surfaces
    // typically render with no provider. Pinned by test `d` in
    // `addRowCreatePermissionGate.test.tsx`.
    //
    // The object-level layers stop here deliberately. `resolveCrudAffordances`
    // also emits `createPredicates`, but PR #5145 binds those ONCE PER TOOLBAR
    // against the host record in scope — an add-record row is not a toolbar and
    // has no record to bind, and that precedent surfaces predicates only AFTER
    // the object-level verdict passed. The conjunct that was missing here is
    // that verdict, which is what this adds.
    showAddRow: !!operations?.create && (permissionCreate ?? true),
    onAddRecord: onAddRecord,
    rowClassName: schema.rowColor ? (row: any, _idx: number) => getRowClassName(row) : undefined,
    rowStyle: schema.conditionalFormatting?.length ? (row: any, _idx: number) => getRowStyle(row) : undefined,
    frozenColumns: effectiveFrozenColumns,
    onSelectionChange: (rows: any[]) => {
      setSelectedRows(rows);
      onRowSelect?.(rows);
    },
    selectionResetKey,
    onRowClick: navigation.handleClick,
    onCellChange: onCellChange,
    // Install a dataSource-backed default only when the consumer did NOT wire
    // its own handler, so declarative `editable: true` views still persist.
    onRowSave: onRowSave ?? defaultRowSave,
    onBatchSave: onBatchSave ?? defaultBatchSave,
    onColumnResize: (columnKey: string, width: number) => {
      saveColumnState({
        ...columnState,
        widths: { ...columnState.widths, [columnKey]: width },
      });
    },
    // objectui#6175: the renderer invokes `onColumnsReorder` (with the `s`) —
    // `data-table.tsx:handleColumnDrop` — and has never invoked the singular
    // `onColumnReorder` this used to emit, so reorders were never persisted.
    // Producer-side fix (AGENTS #0.1: fix the producer, don't teach the renderer
    // a second spelling), which retires nothing: `onColumnReorder` stays declared
    // on `DataTableSchema` and stays unwired, exactly as the RuntimeOnlyDeclared
    // ledger records it. Which of the two declared spellings survives is still an
    // open ruling and is deliberately NOT settled here.
    onColumnsReorder: (newColumns: any[]) => {
      const order = newColumns
        .map((c) => c?.accessorKey)
        .filter((key): key is string => typeof key === 'string' && key.length > 0);
      saveColumnState({
        ...columnState,
        order,
      });
    },
  };

  // Shared column widths for the grouped view. Each per-group sub-table would
  // otherwise auto-size its columns from its own (often 1–2) rows, so columns
  // never line up between groups and each group gets its own horizontal
  // scrollbar. Pre-computing explicit widths from the FULL dataset (same
  // heuristic as DataTable's autosize) keeps every group's columns aligned and
  // lets them share ONE horizontal scrollbar provided by the wrapper below.
  const groupedColumnWidths: Record<string, number | string> = {};
  for (const col of orderedColumns as any[]) {
    const key = col.accessorKey;
    if (!key) continue;
    const saved = columnState.widths?.[key];
    if (saved) { groupedColumnWidths[key] = saved; continue; }
    if (col.width) { groupedColumnWidths[key] = col.width; continue; }
    // `fitContent` columns (row actions) hug their content — leave them out so
    // they aren't pinned to the 80px char-estimate floor and clipped in
    // grouped mode the same way they were in the flat list.
    //
    // Read WITHOUT a cast since objectui#6424 (maintainer ruling 2026-08-29,
    // option 甲): `TableColumn` declares `fitContent` now, so the key this
    // renderer honours is the key the published type admits. ⚠️ Read the
    // narrowness of that claim: the cast was already buying ZERO type safety
    // here, because `col` is `any` either way — `applyColumnChrome` is
    // `(col: any)`, so `orderedColumns` is `any[]` and the loop above widens it
    // a second time. This read is unchecked for that reason, not for want of a
    // declaration, and typing it is the separate question the `as any[]` on the
    // loop belongs to (objectui#6459). Removing the cast changed no type.
    if (col.fitContent) continue;
    let maxLen = String(col.header ?? '').length;
    for (const row of data.slice(0, 50)) {
      const v = row?.[key];
      const len = v != null ? String(v).length : 0;
      if (len > maxLen) maxLen = len;
    }
    groupedColumnWidths[key] = Math.min(400, Math.max(80, maxLen * 8 + 48));
  }

  /** Build a per-group data-table schema (inherits everything except data & pagination). */
  const buildGroupTableSchema = (groupRows: any[]): ObjectGridDataTableSchema => ({
    ...dataTableSchema,
    caption: undefined,
    data: groupRows,
    pagination: false,
    searchable: false,
    // Embedded inside a GroupRow which already provides visual framing.
    // Drop the table's outer rounded border so groups look like Airtable's
    // flat sub-tables rather than nested cards.
    borderless: true,
    // Let every group's table overflow into the single shared horizontal
    // scroll container (see grouped gridContent) instead of scrolling on its
    // own — this restores a working x-axis scrollbar and aligned columns.
    disableInnerScroll: true,
    // Frozen columns rely on per-table sticky offsets that don't compose with
    // the shared scroll container; disable them in grouped mode.
    frozenColumns: 0,
    // Pin explicit, shared widths so columns align across all groups. No cast:
    // `dataTableSchema` is typed now, so `.columns` is `TableColumn[]` (the
    // `as any[]` existed only because the surrounding value was `any`, #6459).
    columns: dataTableSchema.columns.map((c) => ({
      ...c,
      width: groupedColumnWidths[c.accessorKey] ?? c.width,
    })),
  });

  // Build record detail title.
  //
  // Keyed, not string-built (objectui#3426). This value is handed to
  // `NavigationOverlay`'s `title` prop, which means the overlay's own
  // `detail.recordDetail` default never applies here — whatever this computes
  // IS the visible heading of the drawer/modal/split/popover. Interpolating
  // the label through `detail.recordDetailWithLabel` instead of splicing it
  // into an English template lets each pack choose its own word order; the
  // no-label branch reuses the overlay's own key rather than a twin.
  //
  // English output is unchanged in all three branches (`Contacts Detail` /
  // `Contacts Detail` / `Record Detail`), including with no `I18nProvider`
  // mounted — `createSafeTranslation`'s fallback interpolates `{{label}}` from
  // `GRID_DEFAULT_TRANSLATIONS`.
  const detailTitle = schema.label
    ? t('detail.recordDetailWithLabel', { label: schema.label })
    : schema.objectName
      ? t('detail.recordDetailWithLabel', {
          label: schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1),
        })
      : t('detail.recordDetail');

  // Form-based record detail renderer (replaces simple key-value dump).
  // Hoisted above the mobile card-view's early return (below) so both the
  // card view's detail overlay and the desktop table's detail overlay share
  // this same type-aware renderer instead of the card view falling back to
  // a raw `String(value)` dump (which showed "[object Object]" for lookups).
  const renderRecordDetail = (record: any) => {
    const entries = Object.entries(record);
    // Honor `hidden: true` on the schema field def — internal/system fields
    // (e.g. database_url, environment_id, is_system) shouldn't leak into the
    // grid's record-detail drawer just because they're in the record payload.
    const isHidden = (key: string) => objectSchema?.fields?.[key]?.hidden === true;
    // Split business fields from framework-managed system/audit/ownership
    // columns via the shared classifier (branches on `field.system`), so the
    // injected `owner_id` and friends land in the muted meta section rather than
    // the business body — consistent with the grid's default-column derivation.
    const isSystem = (key: string) => isSystemManagedField(key, objectSchema?.fields?.[key]);
    const regularFields = entries.filter(([key]) => !isSystem(key) && !isHidden(key));
    const metaFields = entries.filter(([key]) => isSystem(key) && key !== '_id' && key !== 'id' && !isHidden(key));

    const formatFieldLabel = (key: string): string =>
      key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

    const renderFieldValue = (key: string, value: any): React.ReactNode => {
      if (value == null || value === '') {
        return <span className="text-muted-foreground/50 text-sm italic">{t('grid.empty')}</span>;
      }

      // Use objectSchema field type for type-aware rendering
      const fieldDef = objectSchema?.fields?.[key];
      if (fieldDef?.type) {
        const CellRenderer = getCellRenderer(fieldDef.type);
        if (CellRenderer) {
          return <CellRenderer value={value} field={fieldDef} />;
        }
      }

      // Fallback: infer from value and key name
      if (typeof value === 'boolean') {
        return <Badge variant={value ? 'default' : 'outline'}>{value ? t('grid.yes') : t('grid.no')}</Badge>;
      }
      // Detect date-like values. The tag comes from `useDisplayLocale()` like
      // every other date channel: passing no options at all handed `Intl` an
      // `undefined` tag, i.e. the MACHINE's locale, which is neither of the
      // repo's two locale channels — so this cell rendered `Mar 15, 2024` on a
      // zh console while its neighbours rendered `2024年3月15日` (objectui#4541).
      if (typeof value === 'string' && !isNaN(Date.parse(value)) && (key.includes('date') || key.includes('_at') || key.includes('time'))) {
        return <span className="text-sm tabular-nums">{formatDate(value, undefined, { locale: displayLocale })}</span>;
      }
      // Detect currency-like fields by name
      const currencyFields = ['amount', 'price', 'total', 'revenue', 'cost', 'value', 'budget', 'salary'];
      if (typeof value === 'number' && currencyFields.some(f => key.toLowerCase().includes(f))) {
        return <span className="text-sm tabular-nums font-medium">{formatCurrency(value, tenantCurrency)}</span>;
      }
      // No field-type match (e.g. a computed/untyped key): never dump a raw
      // object as a React child — extract a display name/id instead.
      return <span className="text-sm break-words">{String(coerceToSafeValue(value) ?? '')}</span>;
    };

    return (
      <div className="space-y-4" data-testid="record-detail-panel">
        {/* Regular fields in form-like layout */}
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {regularFields.map(([key, value]) => (
              <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground sm:w-1/3 sm:text-right sm:pt-0.5 uppercase tracking-wide shrink-0">
                  {formatFieldLabel(key)}
                </span>
                <div className="flex-1 min-w-0">
                  {renderFieldValue(key, value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System/meta fields */}
        {metaFields.length > 0 && (
          <div className="rounded-lg border bg-muted/30">
            <div className="px-4 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('grid.systemFields')}</span>
            </div>
            <div className="divide-y divide-border/50">
              {metaFields.map(([key, value]) => (
                <div key={key} className="flex items-center gap-4 px-4 py-2">
                  <span className="text-xs text-muted-foreground w-1/3 text-right shrink-0">
                    {formatFieldLabel(key)}
                  </span>
                  <span className="text-xs text-muted-foreground flex-1 min-w-0 break-words">{String(coerceToSafeValue(value) ?? '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Mobile card-view: below the 768px app breakpoint (matches useIsMobile /
  // Tailwind md: / the responsive page+grid layout), render stacked cards
  // instead of a side-scrolling wide table.
  if (useCardView && data.length > 0 && !isGrouped) {
    const displayColumns = generateColumns().filter((c) => c.accessorKey !== '_actions');

    // Build a lookup of column metadata for smart rendering
    const colMap = new Map<string, ObjectGridColumnDraft>();
    displayColumns.forEach((col) => colMap.set(col.accessorKey, col));

    // Identify special columns by inferred type for visual hierarchy
    const titleCol = displayColumns[0]; // First column is always the title
    const amountKeys = ['amount', 'price', 'total', 'revenue', 'cost', 'value', 'budget', 'salary'];
    const stageKeys = ['stage', 'status', 'priority', 'category', 'severity', 'level'];
    const dateKeys = ['date', 'due', 'created', 'updated', 'deadline', 'start', 'end', 'expires'];
    const percentKeys = ['probability', 'percent', 'rate', 'ratio', 'confidence', 'score'];

    // Stage badge color mapping for common pipeline stages — soft pill style.
    const stageBadgeColor = (value: string): string => {
      const v = (value || '').toLowerCase();
      if (v.includes('won') || v.includes('completed') || v.includes('done') || v.includes('active') || v === 'activated' || v === 'success' || v === 'approved' || v === 'paid')
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/60';
      if (v.includes('lost') || v.includes('cancelled') || v.includes('rejected') || v.includes('closed lost') || v === 'expired' || v === 'terminated' || v === 'failed' || v === 'overdue')
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60';
      if (v.includes('negotiation') || v.includes('review') || v.includes('in progress') || v.includes('approval') || v === 'in_approval' || v === 'pending_approval')
        return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900/60';
      if (v.includes('proposal') || v.includes('pending'))
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60';
      if (v.includes('qualification') || v.includes('qualified'))
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60';
      if (v.includes('prospecting') || v.includes('new') || v.includes('open'))
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60';
      if (v === 'draft' || v.includes('draft'))
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/40 dark:text-slate-300 dark:border-slate-900/60';
      return 'bg-muted text-muted-foreground border-border';
    };

    // Left border color for card accent based on stage
    const stageBorderLeft = (value: string): string => {
      const v = (value || '').toLowerCase();
      if (v.includes('won') || v.includes('completed') || v.includes('done') || v.includes('active') || v === 'activated')
        return 'border-l-green-500';
      if (v.includes('lost') || v.includes('cancelled') || v.includes('rejected') || v === 'expired' || v === 'terminated')
        return 'border-l-red-500';
      if (v.includes('negotiation') || v.includes('review') || v.includes('in progress') || v.includes('approval'))
        return 'border-l-yellow-500';
      if (v.includes('proposal') || v.includes('pending'))
        return 'border-l-blue-500';
      if (v.includes('qualification') || v.includes('qualified'))
        return 'border-l-indigo-500';
      if (v.includes('prospecting') || v.includes('new') || v.includes('open'))
        return 'border-l-purple-500';
      if (v === 'draft' || v.includes('draft'))
        return 'border-l-slate-400';
      return 'border-l-gray-300';
    };

    const classify = (key: string): 'amount' | 'stage' | 'date' | 'percent' | 'other' => {
      const k = key.toLowerCase();
      if (amountKeys.some(p => k.includes(p))) return 'amount';
      if (stageKeys.some(p => k.includes(p))) return 'stage';
      if (dateKeys.some(p => k.includes(p))) return 'date';
      if (percentKeys.some(p => k.includes(p))) return 'percent';
      return 'other';
    };

    // Resolve a select-like value to its translated option label and
    // explicit color so card badges match the desktop grid — the raw
    // stored value (e.g. "in_review") must never reach the user.
    const resolveOptionMeta = (fieldKey: string, value: any): { label: string; color?: string } => {
      const rawOptions = objectSchema?.fields?.[fieldKey]?.options;
      if (Array.isArray(rawOptions) && rawOptions.length > 0) {
        const translated = schema.objectName
          ? translateOptions(schema.objectName, fieldKey, rawOptions)
          : rawOptions;
        const opt = (translated as any[]).find(o => o && String(o.value) === String(value));
        if (opt) {
          return { label: opt.label != null ? String(opt.label) : String(value), color: (opt as any).color };
        }
      }
      // Option-less enum-looking values still get humanized; free text is
      // passed through untouched so we never rewrite user data.
      const str = String(value);
      return { label: /^[a-z0-9]+(_[a-z0-9]+)+$/.test(str) ? humanizeLabel(str) : str };
    };

    return (
      <>
        <div className="space-y-2 p-2">
          {data.map((row, idx) => {
            // Collect secondary fields (skip the title column)
            const secondaryCols = displayColumns.slice(1, 5);
            const amountCol = secondaryCols.find((c: any) => classify(c.accessorKey) === 'amount');
            const stageCol = secondaryCols.find((c: any) => classify(c.accessorKey) === 'stage');
            const dateCols = secondaryCols.filter((c: any) => classify(c.accessorKey) === 'date');
            const percentCols = secondaryCols.filter((c: any) => classify(c.accessorKey) === 'percent');
            const otherCols = secondaryCols.filter(
              (c: any) => c !== amountCol && c !== stageCol && !dateCols.includes(c) && !percentCols.includes(c)
            );

            // Determine left border accent color from stage value
            const stageValue = stageCol ? String(row[stageCol.accessorKey] ?? '') : '';
            const leftBorderClass = stageValue ? stageBorderLeft(stageValue) : '';
            const cardClassName = [
              'border rounded-lg p-2.5 bg-card hover:bg-accent/50 cursor-pointer transition-colors touch-manipulation',
              leftBorderClass ? `border-l-[3px] ${leftBorderClass}` : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={row.id || row._id || idx}
                className={cardClassName}
                onClick={() => navigation.handleClick(row)}
              >
                {/* Title row - Name as bold prominent title */}
                {titleCol && (
                  <div className="font-semibold text-sm truncate mb-1">
                    {coerceToSafeValue(row[titleCol.accessorKey]) ?? '—'}
                  </div>
                )}

                {/* Amount + Stage row - side by side for compact display */}
                {(amountCol || stageCol) && (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {amountCol && (
                      <span className="text-sm tabular-nums font-medium">
                        {typeof row[amountCol.accessorKey] === 'number'
                          ? formatCompactCurrency(row[amountCol.accessorKey], resolveFieldCurrency(amountCol as any, tenantCurrency))
                          : (coerceToSafeValue(row[amountCol.accessorKey]) ?? '—')}
                      </span>
                    )}
                    {stageCol && row[stageCol.accessorKey] && (() => {
                      const rawValue = row[stageCol.accessorKey];
                      const optMeta = resolveOptionMeta(stageCol.accessorKey, rawValue);
                      // Explicit option color wins, resolved EXACTLY as the
                      // desktop cell resolves it (`SelectCellRenderer` in
                      // `@object-ui/fields`): a declared hex renders as
                      // declared via `getBadgeHexAppearance` (objectui#5141,
                      // adopted here by objectui#5183), a family name keeps
                      // going through `getBadgeColorClasses`. The `style` is
                      // load-bearing — the hex ships as CSS custom properties
                      // that the returned className reads, so dropping it
                      // yields a badge referencing undefined variables.
                      // With no declared colour at all we keep the
                      // pipeline-stage heuristic keyed on the raw value,
                      // which stays stable across locales.
                      const hexBadge = getBadgeHexAppearance(optMeta.color);
                      const badgeClasses = hexBadge
                        ? hexBadge.className
                        : optMeta.color
                          ? getBadgeColorClasses(optMeta.color, rawValue)
                          : stageBadgeColor(String(rawValue));
                      return (
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 max-w-[140px] truncate ${badgeClasses}`}
                          style={hexBadge?.style}
                        >
                          {optMeta.label}
                        </Badge>
                      );
                    })()}
                  </div>
                )}

                {/* Date + Percent combined row for density */}
                {(dateCols.length > 0 || percentCols.length > 0) && (
                  <div className="flex items-center justify-between py-0.5 text-xs text-muted-foreground">
                    {dateCols[0] && (
                      <span className="tabular-nums">
                        {row[dateCols[0].accessorKey]
                          ? formatDate(row[dateCols[0].accessorKey], 'short', { locale: displayLocale })
                          : '—'}
                      </span>
                    )}
                    {percentCols[0] && row[percentCols[0].accessorKey] != null && (
                      <span className="tabular-nums">
                        {/* objectui#4553: the mobile card's percent cell takes
                            the same `displayLocale` its date sibling above
                            already does (objectui#4272). */}
                        {formatPercent(Number(row[percentCols[0].accessorKey]), undefined, displayLocale)}
                      </span>
                    )}
                  </div>
                )}

                {/* Additional date fields beyond the first */}
                {dateCols.slice(1).map((col: any) => (
                  <div key={col.accessorKey} className="flex justify-between items-center py-0.5">
                    <span className="text-xs text-muted-foreground">{col.header}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {row[col.accessorKey] ? formatDate(row[col.accessorKey], 'short', { locale: displayLocale }) : '—'}
                    </span>
                  </div>
                ))}

                {/* Other fields - hide empty values on mobile */}
                {otherCols.map((col: any) => {
                  const val = row[col.accessorKey];
                  if (val == null || val === '') return null;
                  return (
                    <div key={col.accessorKey} className="flex justify-between items-center py-0.5">
                      <span className="text-xs text-muted-foreground">{col.header}</span>
                      <span className="text-xs font-medium truncate ml-2 text-right">
                        {col.cell ? col.cell(val, row) : String(coerceToSafeValue(val) ?? '')}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {navigation.isOverlay && (
          <NavigationOverlay {...navigation} title={detailTitle}>
            {(record) => renderRecordDetail(record)}
          </NavigationOverlay>
        )}
      </>
    );
  }

  // Row height cycle handler (plain function, not hook — after early returns)
  const cycleRowHeight = () => {
    setRowHeightMode(prev => {
      if (prev === 'compact') return 'short';
      if (prev === 'short') return 'medium';
      if (prev === 'medium') return 'tall';
      if (prev === 'tall') return 'extra_tall';
      return 'compact';
    });
  };

  const rowHeightIcons = { compact: Rows4, short: Rows3, medium: Rows2, tall: AlignJustify, extra_tall: AlignJustify };
  const RowHeightIcon = rowHeightIcons[rowHeightMode];

  // Grid toolbar (row height toggle + export)
  // Hide row-height toggle when parent (e.g., ListView) controls density externally,
  // signaled by `hideRowHeightToggle` prop on schema.
  //
  // NON-AUTHOR SURFACE — `hideRowHeightToggle` is deliberately absent from
  // `GRID_QUERY_INPUTS` (maintainer ruling, 2026-08-18, objectui#5091), so this
  // cast read is deliberate, not missed. It is the host's own signal, written
  // by the embedding view when IT owns density (`plugin-list/src/ListView.tsx`
  // :1866 sets it unconditionally); the author-facing way to ask for a density
  // is `rowHeight`, which IS declared. `ComponentPropsMap['object-grid']` is a
  // `strictObject` and rejects this key by name, so publishing it would offer a
  // key the save gate refuses. Pinned by
  // `__tests__/gridNonAuthorKeys.test.tsx`.
  const showRowHeightToggle = schema.rowHeight !== undefined && !(schema as any).hideRowHeightToggle;
  // Export is offered only when configured AND not blocked by object-level perms
  // — including the server's effective API operation set (#3391): when present
  // and it excludes `export`, the button is hidden. Missing set → unchanged.
  const exportEnabled =
    !!schema.exportOptions &&
    exportableFormats.length > 0 &&
    schema.operations?.export !== false &&
    (effectiveApiOps ? effectiveApiOps.includes('export') : true);
  const hasToolbar = exportEnabled || showRowHeightToggle;
  const gridToolbar = hasToolbar ? (
    <div className="flex items-center justify-end gap-1 px-2 py-1">
      {/* Row height toggle */}
      {showRowHeightToggle && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
          onClick={cycleRowHeight}
          title={`Row height: ${rowHeightMode}`}
        >
          <RowHeightIcon className="h-3.5 w-3.5 mr-1.5" />
          <span className="hidden sm:inline capitalize">{rowHeightMode}</span>
        </Button>
      )}

      {/* Export */}
      {exportEnabled && (
        <Popover open={showExport} onOpenChange={setShowExport}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('grid.export')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            <div className="space-y-1">
              {exportableFormats.map(format => (
                <Button
                  key={format}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs"
                  disabled={exportBusy}
                  onClick={() => handleExport(format)}
                >
                  {exportBusy
                    ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    : <Download className="h-3.5 w-3.5 mr-2" />}
                  {t('grid.exportAs', { format: format.toUpperCase() })}
                </Button>
              ))}
              {exportError && (
                <div
                  className="px-2 py-1 text-xs"
                  style={{ color: 'var(--destructive, #ef4444)' }}
                  role="alert"
                >
                  {exportError}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  ) : null;

  // Summary footer row
  const summaryFooter = hasSummary ? (
    <div className="border-t bg-muted/30 px-2 py-1.5" data-testid="column-summary-footer">
      <div className="flex gap-4 text-xs text-muted-foreground font-medium">
        {orderedColumns
          .filter((col: any) => summaries.has(col.accessorKey))
          .map((col: any) => {
            const summary = summaries.get(col.accessorKey)!;
            return (
              <span key={col.accessorKey} data-testid={`summary-${col.accessorKey}`}>
                {col.header}: {summary.label}
              </span>
            );
          })}
      </div>
    </div>
  ) : null;

  // Render grid content: grouped (recursive nested headers + leaf table) or
  // flat (single table). Multi-level grouping renders one `GroupRow` per level
  // with progressive indentation; the deepest level hosts the data table.
  // Resolve the small grey caption (field label) and a soft colored pill
  // class for a group header. Only fields of type select/status get colored
  // pills — matching the cell renderer's color scheme so the same value
  // looks the same in the grouped header and the cell.
  const resolveGroupHeader = (field: string, label: string) => {
    const fieldDef = objectSchema?.fields?.[field] as any;
    const fieldLabel = schema.objectName
      ? resolveFieldLabel(schema.objectName, field, fieldDef?.label || field)
      : (fieldDef?.label || field);
    let labelColorClass: string | undefined;
    let labelColorStyle: React.CSSProperties | undefined;
    const ftype = fieldDef?.type;
    if (ftype === 'select' || ftype === 'status') {
      const opts = fieldDef?.options
        ? translateOptions(schema.objectName, field, fieldDef.options)
        : undefined;
      const matched = Array.isArray(opts)
        ? opts.find((o: any) => String(o.label) === label || String(o.value) === label)
        : undefined;
      // Same resolution as the cell below the header (`SelectCellRenderer`):
      // a declared hex renders as declared (objectui#5141/#5183), everything
      // else keeps resolving to a palette family. `labelColorStyle` carries
      // the CSS custom properties the hex className reads — the pill needs
      // BOTH halves or it references undefined variables.
      const hexBadge = getBadgeHexAppearance(matched?.color);
      labelColorClass = hexBadge
        ? hexBadge.className
        : getBadgeColorClasses(matched?.color, matched?.value ?? label);
      labelColorStyle = hexBadge?.style;
    }
    return { fieldLabel, labelColorClass, labelColorStyle };
  };

  const renderGroup = (group: typeof groups[number]): React.ReactNode => {
    const { fieldLabel, labelColorClass, labelColorStyle } = resolveGroupHeader(group.field, group.label);
    return (
      <div key={group.key}>
        <GroupRow
          groupKey={group.key}
          label={group.label}
          count={group.rows.length}
          collapsed={group.collapsed}
          aggregations={group.aggregations}
          fieldLabel={group.depth === 0 ? fieldLabel : undefined}
          labelColorClass={labelColorClass}
          labelColorStyle={labelColorStyle}
          partialLabel={groupingPartialLabel}
          partialTitle={groupingPartialNotice}
          onToggle={toggleGroup}
        >
          {group.subgroups.length > 0 ? (
            <div className="space-y-4 mt-2">
              {group.subgroups.map(renderGroup)}
            </div>
          ) : (
            <SchemaRenderer schema={buildGroupTableSchema(group.rows)} />
          )}
        </GroupRow>
      </div>
    );
  };

  // Grouped pagination — paginate whole top-level groups so a group is never
  // split across pages. Clamp the current page in case the group count shrank.
  const totalGroupPages = Math.max(1, Math.ceil(groups.length / groupedPageSize));
  const safeGroupedPage = Math.min(groupedPage, totalGroupPages);
  const pagedGroups = groups.slice(
    (safeGroupedPage - 1) * groupedPageSize,
    safeGroupedPage * groupedPageSize,
  );

  const groupedPager = groups.length > 0 && totalGroupPages > 1 ? (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-2 border-t">
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground">{t('table.rowsPerPage')}:</span>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={groupedPageSize}
          onChange={(e) => { setGroupedPageSize(Number(e.target.value)); setGroupedPage(1); }}
        >
          {[5, 10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t('table.pageInfo', { current: safeGroupedPage, total: totalGroupPages })}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setGroupedPage(1)} disabled={safeGroupedPage === 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setGroupedPage(Math.max(1, safeGroupedPage - 1))} disabled={safeGroupedPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setGroupedPage(Math.min(totalGroupPages, safeGroupedPage + 1))} disabled={safeGroupedPage === totalGroupPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setGroupedPage(totalGroupPages)} disabled={safeGroupedPage === totalGroupPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  // Both branches fill the remaining height (flex-1 + min-h-0) so the
  // BulkActionBar rendered *after* gridContent stays inside the flex column
  // and remains visible; otherwise an h-full table pushes the bar past the
  // bottom of an overflow-hidden ancestor and clips it.
  const gridContent = isGrouped ? (
    <div className="flex flex-col flex-1 min-h-0">
      {/* The partial-grouping disclosure sits INSIDE the grouped region,
          directly above the first group header — not in the paging footer.
          The footer is paging chrome and says nothing about what was
          grouped; the number a reader trusts is the one next to the group's
          name, so the statement has to be where that number is. */}
      {groupingIsPartial && (
        <div
          data-testid="grouping-partial-notice"
          className="border-b bg-muted/30 px-3 sm:px-4 py-1.5 text-xs text-muted-foreground grouping-partial-notice"
        >
          {groupingPartialNotice}
        </div>
      )}
      {/* Single shared horizontal scroll container: every group's sub-table
          overflows into this one scroller (disableInnerScroll), so columns
          stay aligned and there is exactly one x-axis scrollbar. */}
      <div className="flex-1 min-h-0 overflow-auto [-webkit-overflow-scrolling:touch]">
        <div className="min-w-max space-y-4 px-3 sm:px-4 pt-2 pb-4">
          {pagedGroups.map(renderGroup)}
        </div>
      </div>
      {groupedPager}
    </div>
  ) : (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0">
        <SchemaRenderer schema={dataTableSchema} />
      </div>
      {summaryFooter}
    </div>
  );

  // Rendered BulkActionDialog (shared across both render branches).
  const bulkDialog = (
    <BulkActionDialog
      def={activeBulkDef}
      rows={activeBulkRows}
      skippedCount={activeBulkSkipped}
      open={!!activeBulkDef}
      onClose={handleBulkDialogClose}
      dataSource={dataSource as any}
      resource={schema.objectName ?? ''}
      objectFields={objectSchema?.fields}
      runAction={runBulkActionRecord}
      runAggregate={runBulkActionAggregate}
    />
  );

  // For split mode, wrap the grid in the ResizablePanelGroup
  if (navigation.isOverlay && navigation.mode === 'split') {
    return (
      <>
        <NavigationOverlay
          {...navigation}
          title={detailTitle}
          mainContent={
            <div className="flex flex-col h-full">
              {gridToolbar}
              {gridContent}
              <BulkActionBar
                selectedRows={selectedRows}
                actions={effectiveBulkActions ?? []}
                actionDefs={bulkActionDefs}
                objectFields={objectSchema?.fields}
                onAction={dispatchBulkAction}
                onActionDef={dispatchBulkActionDef}
                onClearSelection={resetSelection}
                pageSize={data.length}
                totalMatching={canOfferSelectAllMatching ? resolvedTotalMatching : undefined}
                allMatchingSelected={selectAllMatching}
                onSelectAllMatching={canOfferSelectAllMatching ? () => setSelectAllMatching(true) : undefined}
              />
            </div>
          }
        >
          {(record) => renderRecordDetail(record)}
        </NavigationOverlay>
        {bulkDialog}
      </>
    );
  }

  return (
    <div ref={pullRef} className="relative h-full flex flex-col">
      {/* Re-fetch indicator while existing rows remain visible (filter/sort
          change). The initial-load skeleton above handles the empty case. */}
      <RefreshIndicator active={loading && data.length > 0} />
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? t('grid.refreshing') : t('grid.pullToRefresh')}
        </div>
      )}
      {gridToolbar}
      {gridContent}
      <BulkActionBar
        selectedRows={selectedRows}
        actions={effectiveBulkActions ?? []}
        actionDefs={bulkActionDefs}
        objectFields={objectSchema?.fields}
        onAction={dispatchBulkAction}
        onActionDef={dispatchBulkActionDef}
        onClearSelection={resetSelection}
        pageSize={data.length}
        totalMatching={canOfferSelectAllMatching ? resolvedTotalMatching : undefined}
        allMatchingSelected={selectAllMatching}
        onSelectAllMatching={canOfferSelectAllMatching ? () => setSelectAllMatching(true) : undefined}
      />
      {navigation.isOverlay && (
        <NavigationOverlay
          {...navigation}
          title={detailTitle}
        >
          {(record) => renderRecordDetail(record)}
        </NavigationOverlay>
      )}
      {bulkDialog}
    </div>
  );
};
