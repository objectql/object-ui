/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Enterprise-level DataTable Component (Airtable-like)
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { resolveIcon } from '../action/resolve-icon';
import { useGridFieldAuthoring } from '../../context/gridFieldAuthoring';
import { ComponentRegistry } from '@object-ui/core';
import type { DataTableSchema } from '@object-ui/types';
import { useObjectTranslation, useCondition, toPredicateInput } from '@object-ui/react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableCaption 
} from '../../ui/table';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown,
  Search,
  Download,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Save,
  X,
  Plus,
  Expand,
  MoreHorizontal,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

type SortDirection = 'asc' | 'desc' | null;

/**
 * Inline-edit helpers: convert a stored cell value to the string a native
 * `<input type="date">` / `<input type="datetime-local">` expects, and back.
 *
 * Native date inputs require `yyyy-MM-dd`; datetime-local requires
 * `yyyy-MM-ddTHH:mm`. We pad to the LOCAL wall-clock so the picker shows the
 * same day the user sees, then convert back on change. A `date` field stays a
 * plain `yyyy-MM-dd` string; a `datetime` field round-trips through an ISO
 * string (matching how display/format code already treats ISO datetimes).
 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateInputValue(value: unknown): string {
  if (value == null || value === '') return '';
  // A bare yyyy-MM-dd (or its leading slice of an ISO string) is already in the
  // exact shape the native control wants. Pass it through verbatim — parsing it
  // through `new Date()` would interpret it as UTC midnight and can shift the
  // displayed day by one in negative-offset timezones.
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDateTimeInputValue(value: unknown): string {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Field types that should edit as a numeric `<Input type="number">`.
const NUMERIC_EDIT_TYPES = new Set(['number', 'currency', 'percent', 'int', 'integer', 'float', 'double']);

/**
 * Human label for an object/array cell value (e.g. an expanded reference like
 * `{ id, name: 'Dev Admin' }`) shown in the read-only inline editor so we never
 * render "[object Object]". Mirrors @object-ui/fields' `coerceToSafeValue`
 * (which @object-ui/components can't import — it would be a circular dep).
 */
function safeObjectLabel(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        v != null && typeof v === 'object'
          ? safeObjectLabel(v)
          : String(v),
      )
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return String(o.name ?? o.label ?? o.externalId ?? o.id ?? o._id ?? '');
  }
  return String(value);
}

// Default English fallback translations for the data table
const TABLE_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'table.rowsPerPage': 'Rows per page',
  'table.pageInfo': 'Page {{current}} of {{total}}',
  'table.totalRecords': '{{count}} total',
  'table.noResults': 'No results found',
  'table.noResultsHint': 'Try adjusting your filters or search query.',
  'table.sortAsc': 'Sort ascending',
  'table.sortDesc': 'Sort descending',
  'table.hideColumn': 'Hide column',
  'table.cancelAll': 'Cancel All',
  'table.saveAll': 'Save All ({{count}})',
  'table.exportCSV': 'Export CSV',
  'table.addRecord': 'Add record',
  'table.open': 'Open',
  'table.search': 'Search...',
  'table.modified': '{{count}} row modified',
  'table.saveFailed': 'Save failed',
  'table.selected': '{{count}} selected',
  'table.edit': 'Edit',
  'table.delete': 'Delete',
  'common.actions': 'Actions',
};

/**
 * Safe wrapper for useObjectTranslation that falls back to English defaults
 * when I18nProvider is not available (e.g., standalone usage).
 */
function useTableTranslation() {
  try {
    const result = useObjectTranslation();
    const testValue = result.t('table.rowsPerPage');
    if (testValue === 'table.rowsPerPage') {
      return {
        t: (key: string, options?: Record<string, unknown>) => {
          let value = TABLE_DEFAULT_TRANSLATIONS[key] || key;
          if (options) {
            for (const [k, v] of Object.entries(options)) {
              value = value.replace(`{{${k}}}`, String(v));
            }
          }
          return value;
        },
        language: result.language || 'en',
      };
    }
    return { t: result.t, language: result.language || 'en' };
  } catch {
    return {
      t: (key: string, options?: Record<string, unknown>) => {
        let value = TABLE_DEFAULT_TRANSLATIONS[key] || key;
        if (options) {
          for (const [k, v] of Object.entries(options)) {
            value = value.replace(`{{${k}}}`, String(v));
          }
        }
        return value;
      },
      language: 'en',
    };
  }
}

/**
 * Pull the most useful human-readable message out of whatever the save path
 * threw. The ObjectStack adapter decorates thrown errors with the parsed
 * response body on `details` (e.g. a `{ message, error }` from a validation
 * failure), so prefer that; fall back to `error.message`, then a raw string.
 * Never returns empty — callers render it as the save-failure reason.
 */
function extractSaveErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; details?: { message?: unknown; error?: unknown } };
    const detail = e.details && (e.details.message ?? e.details.error);
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (typeof e.message === 'string' && e.message.trim()) return e.message.trim();
  }
  return typeof error === 'string' && error.trim() ? error.trim() : 'Unknown error';
}

/**
 * The element type of `DataTableSchema.rowActionDefs`. Derived via indexed
 * access rather than imported by name: `@object-ui/types` defines
 * `DataTableRowAction` but doesn't re-export it from its public entry, so it's
 * only reachable structurally through `DataTableSchema`.
 */
type RowActionDef = NonNullable<DataTableSchema['rowActionDefs']>[number];

/**
 * One schema-driven custom row action in the data-table's inline row overflow
 * menu. Extracted into its own component so the action's `visible` (and
 * `disabled`) CEL predicate can be evaluated with a hook (`useCondition`)
 * without violating the rules-of-hooks inside a `.map()`.
 *
 * Mirrors `RowActionMenuItem` on the ObjectGrid path so BOTH row-menu
 * renderers honor `visible`/`disabled` identically. Previously this path
 * (used by a detail page's related list) rendered every custom action
 * unconditionally, so e.g. a member row's "Transfer Ownership"
 * (`visible: "record.role != 'owner' && …"`) showed on the owner's own row.
 *
 * Bare field references (`role`) resolve against the row record and `record.`
 * references (`record.role`) against the same, while `features`/`user` come
 * from the ambient ExpressionProvider scope — so gating stays consistent with
 * the grid's own row menu.
 *
 * Exported for unit tests — NOT part of the package's public API: the
 * `@object-ui/components` barrel only side-effect-imports this module (to run
 * its `ComponentRegistry.register`), so this named export is reachable solely
 * via the deep module path the colocated test uses.
 */
export const DataTableRowActionItem: React.FC<{
  action: RowActionDef;
  row: any;
  onActionDef?: (action: RowActionDef, row: any) => void | Promise<void>;
}> = ({ action, row, onActionDef }) => {
  const predicateCtx = { ...(row && typeof row === 'object' ? row : {}), record: row };
  const visiblePred = action.visible;
  const isVisible = useCondition(toPredicateInput(visiblePred), predicateCtx);
  // `disabled` may be a boolean or a CEL predicate evaluated against the row
  // (e.g. grey out an action once a record reaches a terminal state).
  const disabledPred = toPredicateInput(action.disabled);
  const evalDisabled = useCondition(
    typeof disabledPred === 'string' ? disabledPred : undefined,
    predicateCtx,
  );
  const isDisabled = typeof disabledPred === 'string' ? evalDisabled : disabledPred === true;
  if (visiblePred && !isVisible) return null;
  const ActionIcon = resolveIcon(action.icon);
  return (
    <DropdownMenuItem
      disabled={isDisabled}
      onClick={() => { if (!isDisabled) void onActionDef?.(action, row); }}
      data-testid={`row-action-${action.name}`}
      className={cn(
        action.variant === 'danger' && 'text-destructive focus:text-destructive',
      )}
    >
      {/* Dynamic icon resolution from Lucide, not component creation during render */}
      {/* eslint-disable-next-line react-hooks/static-components */}
      {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
      {action.label || action.name}
    </DropdownMenuItem>
  );
};

/**
 * Enterprise-level data table component with Airtable-like features.
 * 
 * Provides comprehensive table functionality including:
 * - Multi-column sorting (ascending/descending/none)
 * - Real-time search across all columns
 * - Pagination with configurable page sizes
 * - Row selection with persistence across pages
 * - CSV export of filtered/sorted data
 * - Row action buttons (edit/delete)
 * 
 * @example
 * ```json
 * {
 *   "type": "data-table",
 *   "pagination": true,
 *   "searchable": true,
 *   "selectable": true,
 *   "sortable": true,
 *   "exportable": true,
 *   "rowActions": true,
 *   "columns": [
 *     { "header": "ID", "accessorKey": "id", "width": "80px" },
 *     { "header": "Name", "accessorKey": "name" }
 *   ],
 *   "data": [
 *     { "id": 1, "name": "John Doe" }
 *   ]
 * }
 * ```
 * 
 * @param {Object} props - Component props
 * @param {DataTableSchema} props.schema - Table schema configuration
 * @returns {JSX.Element} Rendered data table component
 */
const DataTableRenderer = ({ schema }: { schema: DataTableSchema }) => {
  const {
    caption,
    columns: rawColumns = [],
    data: rawData = [],
    pagination = true,
    pageSize: initialPageSize = 10,
    pageSizeOptions,
    manualPagination = false,
    rowCount,
    page: controlledPage,
    onPageChange,
    onPageSizeChange,
    searchable = true,
    selectable = false,
    showSelectionCount = true,
    selectionResetKey,
    sortable = true,
    exportable = false,
    rowActions = false,
    resizableColumns = true,
    reorderableColumns = true,
    editable = false,
    singleClickEdit = false,
    selectionStyle = 'always',
    rowClassName,
    rowStyle,
    className,
    cellClassName,
    frozenColumns = 0,
    showRowNumbers = false,
    showAddRow = false,
    borderless = false,
    disableInnerScroll = false,
  } = schema;

  // Ambient design-surface affordance: when a host (Studio) provides it, render
  // a trailing "+ add field" column header. `null` for every runtime table, so
  // existing tables render unchanged.
  const fieldAuthoring = useGridFieldAuthoring();
  const addColumnEnabled = !!fieldAuthoring?.onAddColumn;
  const editColumnEnabled = !!fieldAuthoring?.onEditColumn;
  // The table already implements column drag-reorder; a design host enables it by
  // providing onReorderFields (to persist the order to the object's field metadata).
  const reorderEnabled = reorderableColumns || !!fieldAuthoring?.onReorderFields;

  // i18n support for pagination labels
  const { t, language } = useTableTranslation();

  /**
   * Format a cell value for display. ISO date / datetime strings are
   * formatted using the current i18n locale so that calendar dates render
   * naturally per language (e.g. zh-CN → 2024/12/15, en-US → 12/15/2024).
   * Non-date values are returned untouched.
   */
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  const formatCellValue = React.useCallback((value: unknown): unknown => {
    if (typeof value !== 'string' || value.length < 8) return value;
    if (!ISO_DATE_RE.test(value)) return value;
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) return value;
    const hasTime = value.includes('T');
    try {
      const fmt = new Intl.DateTimeFormat(language, hasTime
        ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric' });
      return fmt.format(new Date(ts));
    } catch {
      return value;
    }
  }, [language]);

  // Ensure data is always an array – provider config objects or null/undefined
  // must not reach array operations like .filter() / .some()
  const data = Array.isArray(rawData) ? rawData : [];

  // Normalize columns to support legacy keys (label/name) from existing JSONs
  const initialColumns = useMemo(() => {
    return rawColumns.map((col: any) => ({
      ...col,
      header: col.header || col.label,
      accessorKey: col.accessorKey || col.name
    }));
  }, [rawColumns]);

  // Auto-size columns: estimate width from header and data content for columns without explicit widths
  const autoSizedWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    const cols = rawColumns.map((col: any) => ({
      header: col.header || col.label,
      accessorKey: col.accessorKey || col.name,
      width: col.width,
      fitContent: col.fitContent,
    }));
    for (const col of cols) {
      if (col.width) continue; // Skip columns with explicit widths
      // `fitContent` columns (e.g. the row-actions column) size to their own
      // content via a `width:1%` + nowrap cell, not a char-count estimate —
      // estimating them from an absent string value pins them to the 80px
      // floor and clips inline buttons. Leave them out of the width map.
      if (col.fitContent) continue;
      const headerLen = (col.header || '').length;
      let maxLen = headerLen;
      // Sample up to 50 rows for content width estimation
      const sampleRows = data.slice(0, 50);
      for (const row of sampleRows) {
        const val = row[col.accessorKey];
        const len = val != null ? String(val).length : 0;
        if (len > maxLen) maxLen = len;
      }
      // Estimate pixel width: ~8px per character + 48px padding, min 80, max 400
      widths[col.accessorKey] = Math.min(400, Math.max(80, maxLen * 8 + 48));
    }
    return widths;
  }, [rawColumns, data]);

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<any>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [columns, setColumns] = useState(initialColumns);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  // Mirror of `editingCell` that is mutated synchronously, so the `startEdit`
  // re-entry guard can't be defeated by a stale closure. A lookup/select option
  // renders in a Portal; picking it fires the option's onChange (which stages
  // the value) and — because React synthetic events still bubble through the
  // component tree — the cell's onClick, re-invoking `startEdit` for the SAME
  // cell within one event. Reading `editingCell` state there can observe a stale
  // (pre-edit) value under batching/contention, so the guard misses and the
  // just-picked value is reset from empty `pendingChanges`. The ref always
  // reflects the latest edit target within the same tick, so re-entry is caught.
  const editingCellRef = useRef<{ rowIndex: number; columnKey: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  // Track pending changes for multi-cell editing: rowIndex -> { columnKey -> newValue }
  const [pendingChanges, setPendingChanges] = useState<Map<number, Record<string, any>>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  // Last save failure message (server validation text, etc.) shown in the
  // toolbar; null when the last save attempt succeeded or nothing's been saved.
  const [saveError, setSaveError] = useState<string | null>(null);
  // Row indices whose last save attempt failed — tinted destructive so the
  // author sees exactly which rows didn't persist (no silent "phantom save").
  const [erroredRows, setErroredRows] = useState<Set<number>>(new Set());
  // Column header context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; columnKey: string } | null>(null);
  
  // Refs for column resizing
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);
  const editInputRef = useRef<HTMLInputElement>(null);
  // When an edit ends via Enter (already saved) or Escape (cancelled), the
  // input also blurs. This flag tells the blur handler not to save again so we
  // don't double-commit (Enter) or resurrect a cancelled value (Escape).
  const skipBlurSaveRef = useRef(false);
  // DOM node of a host-injected widget editor (rendered via `renderCellEditor`),
  // captured while it's mounted. The built-in `<input>` editors commit via their
  // own onBlur, but the injected widgets (text, number, date, lookup, …) have no
  // such handler — a document-level pointerdown listener (see below) uses this
  // node to detect click-outside and commit them. Null ⇒ no injected editor is
  // active (a built-in editor, or nothing, is showing).
  const injectedEditorElRef = useRef<HTMLDivElement | null>(null);
  // Snapshot of the active cell's pending value when editing began, so Escape /
  // cancel can revert this session's changes. Injected widgets stage on every
  // change (unlike built-ins, which only commit on blur/Enter), so without this
  // an Escape would leave the half-typed value staged. `had` distinguishes "no
  // pending change existed" from "the pending value was undefined".
  const editRevertRef = useRef<{ had: boolean; value: any } | null>(null);

  // Update columns when schema changes
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  // Clear the internal checkbox selection when the host bumps selectionResetKey.
  // Row selection is otherwise table-internal state a host can't reach; this lets
  // e.g. a grid reset the checkboxes after a bulk action. On mount the selection
  // is already empty, so the initial run is a no-op.
  useEffect(() => {
    if (selectionResetKey === undefined) return;
    setSelectedRowIds(new Set());
  }, [selectionResetKey]);

  // Filtering
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col.accessorKey];
        return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }, [data, searchQuery, columns]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Pagination. Under manual (server-side) pagination the parent controls the
  // page and supplies the grand total via `rowCount`; `data` already IS the
  // current page, so we never slice it locally. Otherwise we paginate the
  // in-memory rows client-side (legacy behavior).
  const effectivePage = manualPagination
    ? Math.max(1, controlledPage ?? 1)
    : currentPage;
  const totalPages = manualPagination
    ? Math.max(1, Math.ceil((rowCount ?? sortedData.length) / pageSize))
    : Math.ceil(sortedData.length / pageSize);
  const paginatedData = (pagination && !manualPagination)
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData;

  // Route page / page-size changes to the parent under manual pagination,
  // otherwise drive the internal state.
  const goToPage = (p: number) => {
    const clamped = Math.min(totalPages, Math.max(1, p));
    if (manualPagination) onPageChange?.(clamped);
    else setCurrentPage(clamped);
  };
  const changePageSize = (size: number) => {
    setPageSize(size);
    if (manualPagination) {
      onPageSizeChange?.(size);
      onPageChange?.(1);
    } else {
      setCurrentPage(1);
    }
  };

  // Rows-per-page choices: caller-supplied options (e.g. view metadata's
  // pagination.pageSizeOptions) or the built-in fallback. The active pageSize
  // is always merged in and the list de-duplicated + sorted so the selector can
  // display the current value even when it is not one of the configured steps.
  const pageSizeChoices = React.useMemo(() => {
    const base = pageSizeOptions && pageSizeOptions.length > 0
      ? pageSizeOptions
      : [5, 10, 20, 50, 100];
    return Array.from(new Set([...base, pageSize]))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  /**
   * Generates a unique identifier for each row to maintain stable selection state
   * across pagination and sorting operations.
   * 
   * @param {any} row - The data row object
   * @param {number} index - The row's index in the dataset
   * @returns {string | number} Unique row identifier (uses 'id' field if available, falls back to index)
   */
  const getRowId = (row: any, index: number) => {
    // Try to use 'id' field, fall back to index
    return row.id !== undefined ? row.id : `row-${index}`;
  };

  // Handlers
  const handleSort = (columnKey: string) => {
    if (!sortable) return;
    
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Column header context menu handler
  const handleColumnContextMenu = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, columnKey });
  };

  const hideColumn = (columnKey: string) => {
    setColumns(prev => prev.filter(c => c.accessorKey !== columnKey));
    setContextMenu(null);
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  const handleSelectAll = (checked: boolean) => {
    const newSelected = new Set<any>();
    if (checked) {
      paginatedData.forEach((row, idx) => {
        const globalIndex = (effectivePage - 1) * pageSize + idx;
        const rowId = getRowId(row, globalIndex);
        newSelected.add(rowId);
      });
    }
    setSelectedRowIds(newSelected);
    
    // Call callback if provided
    if (schema.onSelectionChange) {
      const selectedData = sortedData.filter((row, idx) => {
        const rowId = getRowId(row, idx);
        return newSelected.has(rowId);
      });
      schema.onSelectionChange(selectedData);
    }
  };

  const handleSelectRow = (rowId: any, checked: boolean) => {
    const newSelected = new Set(selectedRowIds);
    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRowIds(newSelected);
    
    // Call callback if provided
    if (schema.onSelectionChange) {
      const selectedData = sortedData.filter((row, idx) => {
        const id = getRowId(row, idx);
        return newSelected.has(id);
      });
      schema.onSelectionChange(selectedData);
    }
  };

  const handleExport = () => {
    const csvContent = [
      columns.map(col => col.header).join(','),
      ...sortedData.map(row =>
        columns.map(col => JSON.stringify(row[col.accessorKey] || '')).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="h-3 w-3 ml-0.5 opacity-0 group-hover:opacity-50 transition-opacity" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-3 w-3 ml-0.5 text-primary" />;
    }
    return <ChevronDown className="h-3 w-3 ml-0.5 text-primary" />;
  };

  // Column resizing handlers
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    if (!resizableColumns) return;
    e.preventDefault();
    e.stopPropagation();
    
    resizingColumn.current = columnKey;
    startX.current = e.clientX;
    
    const headerCell = (e.target as HTMLElement).closest('th');
    if (headerCell) {
      startWidth.current = headerCell.offsetWidth;
    }
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;
    
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff); // Min width 50px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth
    }));
  };

  const handleResizeEnd = () => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  // Column reordering handlers
  const handleColumnDragStart = (e: React.DragEvent, index: number) => {
    if (!reorderEnabled) return;
    setDraggedColumn(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    if (!reorderEnabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(index);
  };

  const handleColumnDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!reorderEnabled || draggedColumn === null) return;
    e.preventDefault();

    if (draggedColumn === dropIndex) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedColumn, 1);
    newColumns.splice(dropIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);

    // Call callback if provided
    if (schema.onColumnsReorder) {
      schema.onColumnsReorder(newColumns);
    }
    // Design host: persist the new order to the object's field metadata.
    fieldAuthoring?.onReorderFields?.(newColumns.map((c) => c.accessorKey));
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Cell editing handlers
  const startEdit = (rowIndex: number, columnKey: string) => {
    if (!editable) return;

    // Already editing THIS cell — do nothing. Re-entering would reset `editValue`
    // from `pendingChanges`, and when a widget-injected editor commits via an
    // overlay (a lookup/select popover renders in a Portal, but React events
    // still bubble through the component tree to this cell's onClick), that reset
    // reads a stale `pendingChanges` — before the just-staged value has flushed —
    // and clobbers the freshly picked value. Guard on the synchronous ref (not
    // the `editingCell` state, which can read stale under batching/contention —
    // the intermittent CI failure #2150) so the re-entrant call is always caught.
    const active = editingCellRef.current;
    if (active?.rowIndex === rowIndex && active?.columnKey === columnKey) return;

    const column = columns.find(col => col.accessorKey === columnKey);
    if (column?.editable === false) return;

    editingCellRef.current = { rowIndex, columnKey };
    setEditingCell({ rowIndex, columnKey });
    
    // Check if there's a pending change for this cell, otherwise use current data value
    const rowChanges = pendingChanges.get(rowIndex);
    const currentValue = paginatedData[rowIndex][columnKey];
    const valueToEdit = rowChanges?.[columnKey] ?? currentValue ?? '';
    setEditValue(valueToEdit);
    // Snapshot the cell's pending state so Escape/cancel can revert an injected
    // widget edit (which stages on every change) back to exactly what it was.
    editRevertRef.current = rowChanges && columnKey in rowChanges
      ? { had: true, value: rowChanges[columnKey] }
      : { had: false, value: undefined };
  };

  const saveEdit = (force: boolean = false, explicitValue?: any) => {
    if (!editingCell) return;

    // Don't save if we're in cancelled state (unless forced)
    if (!force && editingCell === null) return;

    const { rowIndex, columnKey } = editingCell;
    const globalIndex = (effectivePage - 1) * pageSize + rowIndex;
    // Under manual pagination `sortedData` IS the current page, so address it
    // page-locally; otherwise it's the full in-memory set indexed absolutely.
    const row = sortedData[manualPagination ? rowIndex : globalIndex];

    // Discrete editors (select / checkbox) commit the chosen value synchronously
    // via `explicitValue` — their `setEditValue` hasn't flushed to state yet.
    const valueToStage = explicitValue !== undefined ? explicitValue : editValue;

    // Update pending changes
    const newPendingChanges = new Map(pendingChanges);
    const rowChanges = newPendingChanges.get(rowIndex) || {};
    rowChanges[columnKey] = valueToStage;
    newPendingChanges.set(rowIndex, rowChanges);
    setPendingChanges(newPendingChanges);

    // Call the legacy onCellChange callback if provided
    if (schema.onCellChange) {
      schema.onCellChange(globalIndex, columnKey, valueToStage, row);
    }

    editRevertRef.current = null;
    editingCellRef.current = null;
    setEditingCell(null);
    setEditValue('');
  };

  // Latest-ref to `saveEdit` so the document-level click-outside listener (whose
  // closure is captured once per edit session) always commits with the CURRENT
  // editValue rather than a stale one. Updated in an effect (after every render)
  // so it's current well before any user pointer event fires.
  const saveEditRef = useRef(saveEdit);
  useEffect(() => {
    saveEditRef.current = saveEdit;
  });

  // Exit edit mode. When `revert` is true, roll the active cell's pending value
  // back to the snapshot taken when editing began (see `editRevertRef`) — this
  // is what makes Escape/cancel discard an injected widget's staged changes. For
  // built-in editors (which don't stage until commit) the snapshot equals the
  // live pending value, so the revert is a no-op.
  const exitEdit = (revert: boolean) => {
    const active = editingCellRef.current;
    const snap = editRevertRef.current;
    editRevertRef.current = null;
    if (revert && active && snap) {
      const { rowIndex, columnKey } = active;
      setPendingChanges((prev) => {
        const cur = prev.get(rowIndex);
        const staged = !!cur && columnKey in cur;
        if (!staged && !snap.had) return prev; // nothing changed for this cell
        const next = new Map(prev);
        const rc = { ...(cur || {}) };
        if (snap.had) rc[columnKey] = snap.value;
        else delete rc[columnKey];
        if (Object.keys(rc).length > 0) next.set(rowIndex, rc);
        else next.delete(rowIndex);
        return next;
      });
    }
    editingCellRef.current = null;
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    // A built-in <input>'s ensuing blur must not re-save the value we're
    // discarding; injected editors have no such blur, so they call `exitEdit`
    // directly (setting this flag there would leak to the next built-in blur).
    skipBlurSaveRef.current = true;
    exitEdit(true);
  };

  // Stage an in-flight edit into pendingChanges WITHOUT closing the editor —
  // used by injected widget editors (multi-value pickers, free text) that
  // commit when the user moves on rather than on each keystroke/toggle. Mirrors
  // what saveEdit stages, minus the close.
  const stageEdit = (value: any) => {
    if (!editingCell) return;
    const { rowIndex, columnKey } = editingCell;
    setEditValue(value);
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const rowChanges = { ...(next.get(rowIndex) || {}) };
      rowChanges[columnKey] = value;
      next.set(rowIndex, rowChanges);
      return next;
    });
  };

  // Commit the in-flight edit when the input loses focus (e.g. the user clicks
  // another cell). Without this, switching cells discards the typed value.
  const handleEditBlur = () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }
    saveEdit(true);
  };

  const saveRow = async (rowIndex: number) => {
    const globalIndex = (effectivePage - 1) * pageSize + rowIndex;
    const row = sortedData[manualPagination ? rowIndex : globalIndex];
    const rowChanges = pendingChanges.get(rowIndex);
    
    if (!rowChanges || Object.keys(rowChanges).length === 0) return;
    
    setIsSaving(true);
    try {
      if (schema.onRowSave) {
        await schema.onRowSave(globalIndex, rowChanges, row);
      }
      
      // Clear pending changes for this row
      const newPendingChanges = new Map(pendingChanges);
      newPendingChanges.delete(rowIndex);
      setPendingChanges(newPendingChanges);
      // A staged editor (e.g. a lookup picker, which keeps its widget open on
      // pick rather than committing) must exit edit mode once its value is
      // persisted — otherwise the saved cell stays stuck showing the editor.
      if (editingCell?.rowIndex === rowIndex) {
        editingCellRef.current = null;
        setEditingCell(null);
        setEditValue('');
      }
      // Saved — drop any prior error for this row, and clear the banner once
      // no errored rows remain.
      setErroredRows((prev) => {
        if (!prev.has(rowIndex)) return prev;
        const next = new Set(prev);
        next.delete(rowIndex);
        if (next.size === 0) setSaveError(null);
        return next;
      });
    } catch (error) {
      // Keep the pending change so the author can fix and retry; surface the
      // reason instead of failing silently, and flag the row.
      console.error('Failed to save row:', error);
      setSaveError(extractSaveErrorMessage(error));
      setErroredRows((prev) => new Set(prev).add(rowIndex));
    } finally {
      setIsSaving(false);
    }
  };

  const cancelRowChanges = (rowIndex: number) => {
    const newPendingChanges = new Map(pendingChanges);
    newPendingChanges.delete(rowIndex);
    setPendingChanges(newPendingChanges);
    setErroredRows((prev) => {
      if (!prev.has(rowIndex)) return prev;
      const next = new Set(prev);
      next.delete(rowIndex);
      if (next.size === 0) setSaveError(null);
      return next;
    });
  };

  const saveBatch = async () => {
    if (pendingChanges.size === 0) return;
    
    setIsSaving(true);
    try {
      const changesToSave = Array.from(pendingChanges.entries()).map(([rowIndex, changes]) => {
        const globalIndex = (effectivePage - 1) * pageSize + rowIndex;
        const row = sortedData[manualPagination ? rowIndex : globalIndex];
        return { rowIndex: globalIndex, changes, row };
      });
      
      if (schema.onBatchSave) {
        await schema.onBatchSave(changesToSave);
      }
      
      // Clear all pending changes
      setPendingChanges(new Map());
      // Any staged editor left open (e.g. a lookup picker that keeps its widget
      // open on pick) must exit edit mode now that every row is persisted —
      // otherwise the edited cell stays stuck showing the editor after 全部保存.
      editingCellRef.current = null;
      setEditingCell(null);
      setEditValue('');
      // Saved — clear any prior errors.
      setErroredRows(new Set());
      setSaveError(null);
    } catch (error) {
      // Batch is all-or-nothing here: keep every pending row, flag them all,
      // and surface the reason instead of failing silently.
      console.error('Failed to save batch:', error);
      setSaveError(extractSaveErrorMessage(error));
      setErroredRows(new Set(pendingChanges.keys()));
    } finally {
      setIsSaving(false);
    }
  };

  const cancelAllChanges = () => {
    setPendingChanges(new Map());
    setErroredRows(new Set());
    setSaveError(null);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, columnKey: string) => {
    // Copy cell value with Ctrl+C / Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !editingCell) {
      e.preventDefault();
      const globalIdx = (effectivePage - 1) * pageSize + rowIndex;
      const row = sortedData[manualPagination ? rowIndex : globalIdx];
      if (row) {
        const value = row[columnKey];
        const text = value != null ? String(value) : '';
        navigator.clipboard.writeText(text).catch(() => {
          // Fallback for environments without clipboard API
        });
      }
      return;
    }

    if (!editable) return;
    
    const column = columns.find(col => col.accessorKey === columnKey);
    if (column?.editable === false) return;
    
    if (e.key === 'Enter' && !editingCell) {
      e.preventDefault();
      startEdit(rowIndex, columnKey);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Already saving here; suppress the redundant save the ensuing blur triggers.
      skipBlurSaveRef.current = true;
      saveEdit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Auto-focus on edit input when entering edit mode
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Commit a host-injected widget editor on click-outside (objectui#2321).
  //
  // Built-in `<input>` editors commit via their own onBlur (handleEditBlur), but
  // the widgets injected through `renderCellEditor` (text, number, date, lookup,
  // …) have no such handler, so without this they stay stuck in edit mode when
  // the user clicks away. A capture-phase document listener (capture so a cell's
  // own `stopPropagation` can't hide it) commits the staged value and exits edit
  // mode when the pointer goes down truly outside the editor — but NOT inside a
  // Radix overlay the widget itself opened (a lookup popover / record-picker
  // dialog renders in a portal at <body> yet is logically part of the editor).
  // Only armed while an INJECTED editor is mounted (`injectedEditorElRef` set);
  // built-in editors keep their existing blur path untouched.
  useEffect(() => {
    if (!editingCell) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = injectedEditorElRef.current;
      if (!el) return; // built-in editor → its own onBlur handles the commit
      const target = e.target as Node | null;
      if (!target || el.contains(target)) return; // inside the editor itself
      if (target instanceof Element) {
        // A transient popper (Popover/Select/Menu) the widget opened. Guard on
        // `!contains(el)` so a popper that merely HOSTS the grid never suppresses
        // the commit — only one stacked ABOVE the editor does.
        const popper = target.closest('[data-radix-popper-content-wrapper]');
        if (popper && !popper.contains(el)) return;
        // A dialog/sheet the widget opened (e.g. the lookup record-picker) —
        // again only when it's a nested overlay above the editor, not the modal
        // that happens to contain the whole grid.
        const dialog = target.closest('[role="dialog"],[role="alertdialog"]');
        if (dialog && !dialog.contains(el)) return;
      }
      // Truly outside → commit the staged value and exit edit mode, matching the
      // built-in inputs' commit-on-blur.
      saveEditRef.current(true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [editingCell]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // Check if all rows on current page are selected
  const allPageRowsSelected = paginatedData.length > 0 && paginatedData.every((row, idx) => {
    const globalIndex = (effectivePage - 1) * pageSize + idx;
    const rowId = getRowId(row, globalIndex);
    return selectedRowIds.has(rowId);
  });
  
  const somePageRowsSelected = paginatedData.some((row, idx) => {
    const globalIndex = (effectivePage - 1) * pageSize + idx;
    const rowId = getRowId(row, globalIndex);
    return selectedRowIds.has(rowId);
  }) && !allPageRowsSelected;

  const hasPendingChanges = pendingChanges.size > 0;
  const showToolbar = searchable || exportable || (showSelectionCount && selectable && selectedRowIds.size > 0) || hasPendingChanges;

  return (
    <div className={`flex flex-col h-full gap-2 sm:gap-4 ${className || ''}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 flex-none">
          <div className="flex items-center gap-2 flex-1">
            {searchable && (
              <div className="relative w-full sm:max-w-sm flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('table.search')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {hasPendingChanges && (
              <>
                {saveError && (
                  <div
                    role="alert"
                    className="flex items-center gap-1.5 text-sm text-destructive max-w-[16rem] sm:max-w-sm"
                  >
                    <AlertCircle className="h-4 w-4 flex-none" />
                    <span className="truncate" title={`${t('table.saveFailed')}: ${saveError}`}>
                      {t('table.saveFailed')}: {saveError}
                    </span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {t('table.modified', { count: pendingChanges.size })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelAllChanges}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('table.cancelAll')}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveBatch}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {t('table.saveAll', { count: pendingChanges.size })}
                </Button>
              </>
            )}
            
            {exportable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={sortedData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('table.exportCSV')}
              </Button>
            )}
            
            {showSelectionCount && selectable && selectedRowIds.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {t('table.selected', { count: selectedRowIds.size })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table - horizontal scroll indicator via inset shadow on mobile.
          When `borderless`, drop the rounded frame AND the inset shadow so
          the table sits flush against its container without a floating
          right-edge gradient that looked odd without a surrounding border. */}
      <div className={cn(
        "relative bg-background",
        // When embedded in a shared scroll container (grouped grid), let the
        // table overflow outward instead of creating its own scrollbar so all
        // sub-tables share one horizontal scrollbar with aligned columns.
        disableInnerScroll
          ? "overflow-visible"
          : "flex-1 min-h-0 overflow-auto [-webkit-overflow-scrolling:touch]",
        !borderless && "rounded-md border shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.08)]",
      )}>
        {/* This div is already the (bounded) scroll container for BOTH axes —
            or, in grouped mode, the table overflows into a shared ancestor
            scroller. Either way the shadcn <Table>'s default `overflow-auto`
            wrapper must NOT create a second, height-unbounded scroll context;
            otherwise the horizontal scrollbar drops to the bottom of all rows
            and is only reachable after scrolling to the last row. */}
        <Table containerClassName="overflow-visible">
          {caption && <TableCaption>{caption}</TableCaption>}
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {selectable && (
                <TableHead className={cn("w-10 bg-background px-3", frozenColumns > 0 && "sticky left-0 z-20")}>
                  <Checkbox
                    checked={allPageRowsSelected ? true : somePageRowsSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {showRowNumbers && (
                <TableHead className={cn("w-10 bg-background text-center px-3", frozenColumns > 0 && "sticky z-20")} style={frozenColumns > 0 ? { left: selectable ? 40 : 0 } : undefined}>
                  <span className="text-xs text-muted-foreground">#</span>
                </TableHead>
              )}
              {columns.map((col, index) => {
                // `fitContent` columns hug their content (no fixed width /
                // char-estimate) so inline row-action buttons never get clipped.
                const isFit = (col as any).fitContent === true
                  && !columnWidths[col.accessorKey] && !col.width;
                const columnWidth = isFit
                  ? '1%'
                  : (columnWidths[col.accessorKey] || col.width || autoSizedWidths[col.accessorKey]);
                const isDragging = draggedColumn === index;
                const isDragOver = dragOverColumn === index;
                const isFrozen = frozenColumns > 0 && index < frozenColumns;
                const frozenOffset = isFrozen
                  ? columns.slice(0, index).reduce((sum, c, i) => {
                      if (i < frozenColumns) {
                        const w = columnWidths[c.accessorKey] || c.width || autoSizedWidths[c.accessorKey];
                        return sum + (typeof w === 'number' ? w : w ? parseInt(String(w), 10) || 150 : 150);
                      }
                      return sum;
                    }, (selectable ? 40 : 0) + (showRowNumbers ? 40 : 0))
                  : undefined;
                
                return (
                  <TableHead
                    key={col.accessorKey}
                    className={cn(
                      col.className,
                      sortable && col.sortable !== false && 'cursor-pointer select-none',
                      isDragging && 'opacity-50',
                      isDragOver && 'border-l-2 border-primary',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      isFit && 'whitespace-nowrap',
                      'relative group bg-background',
                      isFrozen && 'sticky z-20',
                      isFrozen && index === frozenColumns - 1 && 'border-r-2 border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]',
                    )}
                    style={{ 
                      width: columnWidth,
                      minWidth: columnWidth,
                      ...(isFrozen && { left: frozenOffset }),
                    }}
                    draggable={reorderEnabled}
                    onDragStart={(e) => handleColumnDragStart(e, index)}
                    onDragOver={(e) => handleColumnDragOver(e, index)}
                    onDrop={(e) => handleColumnDrop(e, index)}
                    onDragEnd={handleColumnDragEnd}
                    onClick={() => sortable && col.sortable !== false && handleSort(col.accessorKey)}
                    onContextMenu={(e) => handleColumnContextMenu(e, col.accessorKey)}
                  >
                    <div className={cn(
                      "flex items-center",
                      col.align === 'right' ? 'justify-end' : 'justify-between'
                    )}>
                      <div className="flex items-center gap-1">
                        {reorderEnabled && (
                          <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing shrink-0" />
                        )}
                        {col.headerIcon && (
                          <span className="text-muted-foreground shrink-0">{col.headerIcon}</span>
                        )}
                        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap truncate">{col.header}</span>
                        {sortable && col.sortable !== false && getSortIcon(col.accessorKey)}
                        {editColumnEnabled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fieldAuthoring!.onEditColumn!(col.accessorKey);
                            }}
                            title={fieldAuthoring!.editColumnLabel ?? 'Edit field'}
                            aria-label={fieldAuthoring!.editColumnLabel ?? 'Edit field'}
                            data-testid={`grid-edit-column-${col.accessorKey}`}
                            className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {resizableColumns && col.resizable !== false && (
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary opacity-0 hover:opacity-100 transition-opacity"
                          onMouseDown={(e) => handleResizeStart(e, col.accessorKey)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  </TableHead>
                );
              })}
              {rowActions && (
                <TableHead className="w-24 text-right bg-background">{t('common.actions')}</TableHead>
              )}
              {addColumnEnabled && (
                <TableHead className="w-10 bg-background px-1 text-center">
                  <button
                    type="button"
                    onClick={fieldAuthoring!.onAddColumn}
                    title={fieldAuthoring!.addColumnLabel ?? 'Add field'}
                    aria-label={fieldAuthoring!.addColumnLabel ?? 'Add field'}
                    data-testid="grid-add-column"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (showRowNumbers ? 1 : 0) + (rowActions ? 1 : 0) + (addColumnEnabled ? 1 : 0)}
                  className="h-48 text-center text-muted-foreground border-0"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                    <div className="space-y-1">
                      <p>{t('table.noResults')}</p>
                      <p className="text-xs text-muted-foreground/50">{t('table.noResultsHint')}</p>
                    </div>
                    {/* CTA slot — when the schema declares an `emptyAction`,
                        render it as an inviting follow-up instead of leaving
                        the user at a dead end. The node is resolved via the
                        component registry so it can be any schema node
                        (button, link, action) authored in JSON. */}
                    {schema.emptyAction && (() => {
                      const node: any = schema.emptyAction;
                      const Comp = node?.type ? ComponentRegistry.get(node.type) : null;
                      if (Comp) return <Comp schema={node} />;
                      return null;
                    })()}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {paginatedData.map((row, rowIndex) => {
                  const globalIndex = (effectivePage - 1) * pageSize + rowIndex;
                  const rowId = getRowId(row, globalIndex);
                  const isSelected = selectedRowIds.has(rowId);
                  const rowHasChanges = pendingChanges.has(rowIndex);
                  const rowChanges = pendingChanges.get(rowIndex) || {};
                  
                  return (
                    <TableRow 
                      key={rowId} 
                      data-state={isSelected ? 'selected' : undefined}
                      className={cn(
                        // Unified row state styling — softer hover (40 vs default 50),
                        // brand-tinted selected fill, and explicit focus-visible ring
                        // for keyboard navigation. Overrides the upstream Shadcn
                        // TableRow defaults (which we cannot edit directly per
                        // No-Touch-Zone policy).
                        "bg-background border-b border-border/60 group/row transition-colors",
                        "hover:bg-muted/40",
                        "data-[state=selected]:bg-primary/5 data-[state=selected]:hover:bg-primary/10",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
                        schema.onRowClick && "cursor-pointer",
                        rowHasChanges && !erroredRows.has(rowIndex) && "bg-amber-50 dark:bg-amber-950/20",
                        erroredRows.has(rowIndex) && "bg-destructive/10 dark:bg-destructive/15 ring-1 ring-inset ring-destructive/40",
                        rowClassName && rowClassName(row, rowIndex)
                      )}
                      style={rowStyle ? rowStyle(row, rowIndex) : undefined}
                      onClick={(e) => {
                        if (schema.onRowClick && !e.defaultPrevented) {
                           // Heuristic to avoid triggering on interactive elements if they didn't stop propagation.
                           // Note: Radix overlays (DropdownMenu, Popover, Dialog, etc.) render their content in a
                           // Portal but React events still bubble up through the virtual tree to this row. So we
                           // must also ignore menu/dialog/listbox/option/tab targets, otherwise a click on a
                           // dropdown "Edit" item would navigate to the record detail.
                           const target = e.target as HTMLElement;
                           if (
                             target.closest('button') ||
                             target.closest('a') ||
                             target.closest('input, select, textarea, label') ||
                             target.closest('[role="checkbox"]') ||
                             target.closest('[role="menu"]') ||
                             target.closest('[role="menuitem"]') ||
                             target.closest('[role="menuitemcheckbox"]') ||
                             target.closest('[role="menuitemradio"]') ||
                             target.closest('[role="dialog"]') ||
                             target.closest('[role="alertdialog"]') ||
                             target.closest('[role="listbox"]') ||
                             target.closest('[role="option"]') ||
                             target.closest('[role="tab"]') ||
                             target.closest('[data-radix-popper-content-wrapper]')
                           ) {
                             return;
                           }
                           schema.onRowClick(row);
                        }
                      }}
                    >
                      {selectable && (
                        <TableCell className={cn(cellClassName, "px-3", frozenColumns > 0 && "sticky left-0 z-10 bg-background", selectionStyle === 'hover' && "relative")}>
                          {selectionStyle === 'hover' ? (
                            <div className={cn("transition-opacity", isSelected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100")}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                              />
                            </div>
                          ) : (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectRow(rowId, checked as boolean)}
                            />
                          )}
                        </TableCell>
                      )}
                      {showRowNumbers && (
                        <TableCell className={cn("text-center w-10 relative", cellClassName, frozenColumns > 0 && "sticky z-10 bg-background")} style={frozenColumns > 0 ? { left: selectable ? 40 : 0 } : undefined}>
                          <span className={cn("text-xs text-muted-foreground tabular-nums select-none", !selectable && schema.onRowClick && "group-hover/row:invisible")}>
                            {globalIndex + 1}
                          </span>
                          {!selectable && schema.onRowClick && (
                            <button
                              type="button"
                              className="absolute inset-0 hidden group-hover/row:flex items-center justify-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80"
                              data-testid="row-expand-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                schema.onRowClick?.(row);
                              }}
                              title="Open record"
                            >
                              <span>{t('table.open')}</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </TableCell>
                      )}
                      {columns.map((col, colIndex) => {
                        const isFit = (col as any).fitContent === true
                          && !columnWidths[col.accessorKey] && !col.width;
                        const columnWidth = isFit
                          ? '1%'
                          : (columnWidths[col.accessorKey] || col.width || autoSizedWidths[col.accessorKey]);
                        const originalValue = row[col.accessorKey];
                        const hasPendingChange = rowChanges[col.accessorKey] !== undefined;
                        const cellValue = hasPendingChange ? rowChanges[col.accessorKey] : originalValue;
                        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnKey === col.accessorKey;
                        const isEditable = editable && col.editable !== false;
                        const isFrozen = frozenColumns > 0 && colIndex < frozenColumns;
                        const frozenOffset = isFrozen
                          ? columns.slice(0, colIndex).reduce((sum, c, i) => {
                              if (i < frozenColumns) {
                                const w = columnWidths[c.accessorKey] || c.width || autoSizedWidths[c.accessorKey];
                                return sum + (typeof w === 'number' ? w : w ? parseInt(String(w), 10) || 150 : 150);
                              }
                              return sum;
                            }, (selectable ? 40 : 0) + (showRowNumbers ? 40 : 0))
                          : undefined;
                        
                        return (
                          <TableCell 
                            key={colIndex} 
                            className={cn(
                              col.cellClassName,
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center',
                              // `fitContent` cells must not clip their inline
                              // content (row-action buttons); every other column
                              // keeps overflow-hidden for truncation.
                              isFit ? 'whitespace-nowrap' : 'overflow-hidden',
                              isEditable && !isEditing && "cursor-text hover:bg-muted/50",
                              hasPendingChange && "font-semibold text-amber-700 dark:text-amber-400",
                              isFrozen && 'sticky z-10 bg-background',
                              isFrozen && colIndex === frozenColumns - 1 && 'border-r-2 border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]',
                            )}
                            style={{
                              width: columnWidth,
                              // fit columns hug content: a `1%` width with no
                              // max clamp lets the cell grow to its buttons and
                              // other auto columns absorb the remaining space.
                              minWidth: isFit ? undefined : columnWidth,
                              maxWidth: isFit ? undefined : columnWidth,
                              ...(isFrozen && { left: frozenOffset }),
                            }}
                            onDoubleClick={(e) => {
                              // Entering edit mode must NOT also fire the row's
                              // onRowClick (record-detail drawer). The row heuristic
                              // can't see the editor yet (the <input> only renders
                              // next frame), so stop propagation here explicitly.
                              if (isEditable && !singleClickEdit) {
                                e.stopPropagation();
                                startEdit(rowIndex, col.accessorKey);
                              }
                            }}
                            onClick={(e) => {
                              if (isEditable && singleClickEdit) {
                                e.stopPropagation();
                                startEdit(rowIndex, col.accessorKey);
                              }
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, col.accessorKey)}
                            tabIndex={0}
                          >
                            {isEditing ? (
                              (() => {
                                // Type-aware inline editor. `col.type` is forwarded
                                // from ObjectGrid's column inference. Keep this a small,
                                // readable switch that's easy to extend.
                                const editType = (col as any).type as string | undefined;

                                // Host-injected editor: a higher layer (ObjectGrid) renders
                                // the dedicated @object-ui/fields widget for this field's
                                // type — the SAME control the form uses — so we don't
                                // re-implement select/boolean/etc. down here in the
                                // (fields-free) component layer. Returning null means "no
                                // widget for this type" → fall through to the built-ins.
                                const injectEditor = (schema as any).renderCellEditor as
                                  | ((ctx: {
                                      column: any;
                                      row: any;
                                      value: any;
                                      stage: (v: any) => void;
                                      commit: (v?: any) => void;
                                      cancel: () => void;
                                    }) => React.ReactNode)
                                  | undefined;
                                if (typeof injectEditor === 'function') {
                                  const node = injectEditor({
                                    column: col,
                                    row,
                                    value: editValue,
                                    stage: stageEdit,
                                    commit: (v?: any) => saveEdit(true, v),
                                    cancel: cancelEdit,
                                  });
                                  if (node != null) {
                                    // Wrap the injected widget so it gains the
                                    // exit-edit-mode affordances the built-in
                                    // editors have: Enter commits, Escape cancels,
                                    // and — via `injectedEditorElRef` + the
                                    // document pointerdown listener above — a
                                    // click-outside commits (objectui#2321).
                                    // Keydowns bubbling up through a React portal
                                    // from the widget's own popover (e.g. a lookup
                                    // search box) carry a target OUTSIDE this
                                    // wrapper, so the `contains` guard ignores them
                                    // — Enter/Escape there drive the popover, not
                                    // the cell. Enter commits only from a single-
                                    // line `<input>` (text/number/date/…); on a
                                    // picker's `<button>` trigger or a multi-line
                                    // textarea it's left alone so Enter opens the
                                    // dropdown / inserts a newline as usual.
                                    return (
                                      <div
                                        ref={(n) => { injectedEditorElRef.current = n; }}
                                        className="w-full"
                                        onKeyDown={(e) => {
                                          if (!e.currentTarget.contains(e.target as Node)) return;
                                          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
                                            e.preventDefault();
                                            saveEdit(true);
                                          } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            exitEdit(true);
                                          }
                                        }}
                                      >
                                        {node}
                                      </div>
                                    );
                                  }
                                }

                                if (editType === 'date') {
                                  return (
                                    <Input
                                      ref={editInputRef}
                                      type="date"
                                      value={toDateInputValue(editValue)}
                                      // Store a plain yyyy-MM-dd string — matches how
                                      // date fields are displayed/persisted elsewhere.
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleEditKeyDown}
                                      onBlur={handleEditBlur}
                                      className="h-8 px-2 py-1"
                                    />
                                  );
                                }

                                if (editType === 'datetime' || editType === 'datetime-local') {
                                  return (
                                    <Input
                                      ref={editInputRef}
                                      type="datetime-local"
                                      value={toDateTimeInputValue(editValue)}
                                      // The native control yields a local `yyyy-MM-ddTHH:mm`;
                                      // store back as an ISO string so display/format code
                                      // (formatCellValue) renders it consistently.
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        const d = v ? new Date(v) : null;
                                        setEditValue(d && !Number.isNaN(d.getTime()) ? d.toISOString() : v);
                                      }}
                                      onKeyDown={handleEditKeyDown}
                                      onBlur={handleEditBlur}
                                      className="h-8 px-2 py-1"
                                    />
                                  );
                                }

                                if (editType && NUMERIC_EDIT_TYPES.has(editType)) {
                                  return (
                                    <Input
                                      ref={editInputRef}
                                      type="number"
                                      value={editValue ?? ''}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleEditKeyDown}
                                      onBlur={handleEditBlur}
                                      className="h-8 px-2 py-1"
                                    />
                                  );
                                }

                                // Select / boolean / multi-select / etc. are NOT hand-rolled
                                // here — the host (ObjectGrid) provides them via
                                // `renderCellEditor` using the dedicated @object-ui/fields
                                // widgets, so they exactly match the form's controls.

                                // Object/array values (e.g. an expanded reference like
                                // `{ id, name }`) have no safe free-text editor: a plain
                                // <input> renders them as "[object Object]", and blur
                                // auto-saves (saveEdit) would clobber the object with that
                                // string. Show the coerced label read-only and cancel (not
                                // save) on blur so the value is never corrupted — such
                                // fields are edited from the record form / a dedicated picker.
                                if (editValue != null && typeof editValue === 'object') {
                                  return (
                                    <Input
                                      ref={editInputRef}
                                      value={safeObjectLabel(editValue)}
                                      readOnly
                                      onKeyDown={handleEditKeyDown}
                                      onBlur={cancelEdit}
                                      className="h-8 px-2 py-1 text-muted-foreground cursor-default"
                                      title={safeObjectLabel(editValue)}
                                    />
                                  );
                                }

                                // Fallback: plain text input (when no host editor matched and
                                // the type isn't date/datetime/number).
                                return (
                                  <Input
                                    ref={editInputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    onBlur={handleEditBlur}
                                    className="h-8 px-2 py-1"
                                  />
                                );
                              })()
                            ) : (
                              <div
                                className={isFit ? 'w-full whitespace-nowrap' : 'truncate w-full'}
                                title={!isFit && cellValue != null && typeof cellValue !== 'object' ? String(cellValue) : undefined}
                              >
                                {typeof col.cell === 'function'
                                  ? col.cell(cellValue, row)
                                  : (cellValue != null && typeof cellValue === 'object' ? String(cellValue) : formatCellValue(cellValue) as any)}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      {rowActions && (
                        <TableCell className={cn("text-right", cellClassName)}>
                          <div className="flex items-center justify-end gap-1">
                            {rowHasChanges && (schema.onRowSave || schema.onBatchSave) ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => cancelRowChanges(rowIndex)}
                                  disabled={isSaving}
                                  title="Cancel changes"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => saveRow(rowIndex)}
                                  disabled={isSaving}
                                  title="Save row"
                                >
                                  <Save className="h-4 w-4 text-green-600" />
                                </Button>
                              </>
                            ) : (
                              (() => {
                                const customActions =
                                  Array.isArray(schema.rowActionDefs) && schema.onRowActionDef
                                    ? schema.rowActionDefs
                                    : [];
                                if (!schema.onRowEdit && !schema.onRowDelete && customActions.length === 0) {
                                  return null;
                                }
                                return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label="Row actions"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    {schema.onRowEdit && (
                                      <DropdownMenuItem onClick={() => schema.onRowEdit?.(row)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        {t('table.edit')}
                                      </DropdownMenuItem>
                                    )}
                                    {/* Child-object custom actions (e.g. a related
                                        list surfacing the child's `list_item`
                                        actions). Dispatched with the clicked row. */}
                                    {customActions.length > 0 && schema.onRowEdit && <DropdownMenuSeparator />}
                                    {customActions.map((action) => (
                                      <DataTableRowActionItem
                                        key={action.name}
                                        action={action}
                                        row={row}
                                        onActionDef={schema.onRowActionDef}
                                      />
                                    ))}
                                    {schema.onRowDelete && (schema.onRowEdit || customActions.length > 0) && <DropdownMenuSeparator />}
                                    {schema.onRowDelete && (
                                      <DropdownMenuItem
                                        onClick={() => schema.onRowDelete?.(row)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {t('table.delete')}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                );
                              })()
                            )}
                          </div>
                        </TableCell>
                      )}
                      {addColumnEnabled && <TableCell aria-hidden className="w-10" />}
                    </TableRow>
                  );
                })}
                {/* Add record row (Airtable-style) */}
                {showAddRow && (
                  <TableRow
                    className="hover:bg-muted/30 cursor-pointer border-b border-border"
                    data-testid="add-record-row"
                    onClick={() => schema.onAddRecord?.()}
                  >
                    <TableCell
                      colSpan={columns.length + (selectable ? 1 : 0) + (showRowNumbers ? 1 : 0) + (rowActions ? 1 : 0) + (addColumnEnabled ? 1 : 0)}
                      className="h-9 px-3 py-1.5"
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                        {t('table.addRecord')}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {/* Filler rows intentionally removed: they create visible
                 * bordered empty bands on incomplete pages, making the table
                 * look broken. The scroll container's flex-1 min-h-0 handles
                 * height stability instead. */}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — hidden when only one page (no controls would be actionable) */}
      {pagination && sortedData.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">{t('table.rowsPerPage')}:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => changePageSize(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeChoices.map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {t('table.pageInfo', { current: effectivePage, total: totalPages })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(1)}
                disabled={effectivePage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(effectivePage - 1)}
                disabled={effectivePage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(effectivePage + 1)}
                disabled={effectivePage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToPage(totalPages)}
                disabled={effectivePage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Column header context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="column-context-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {sortable && (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                onClick={() => {
                  setSortColumn(contextMenu.columnKey);
                  setSortDirection('asc');
                  setContextMenu(null);
                }}
              >
                <ChevronUp className="h-3.5 w-3.5" />
                {t('table.sortAsc')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                onClick={() => {
                  setSortColumn(contextMenu.columnKey);
                  setSortDirection('desc');
                  setContextMenu(null);
                }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
                {t('table.sortDesc')}
              </button>
              <div className="my-1 h-px bg-border" />
            </>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
            onClick={() => hideColumn(contextMenu.columnKey)}
          >
            <X className="h-3.5 w-3.5" />
            {t('table.hideColumn')}
          </button>
        </div>
      )}
    </div>
  );
};

// Register the component
ComponentRegistry.register('data-table', DataTableRenderer, {
  namespace: 'ui',
  label: 'Data Table',
  icon: 'table',
  inputs: [
    { name: 'caption', type: 'string', label: 'Caption' },
    {
      name: 'columns',
      type: 'array',
      label: 'Columns',
      description: 'Array of { header, accessorKey, className, width, sortable, filterable, resizable }',
      required: true,
    },
    {
      name: 'data',
      type: 'array',
      label: 'Data',
      description: 'Array of data objects',
      required: true,
    },
    { name: 'pagination', type: 'boolean', label: 'Enable Pagination', defaultValue: true },
    { name: 'pageSize', type: 'number', label: 'Page Size', defaultValue: 10 },
    { name: 'searchable', type: 'boolean', label: 'Enable Search', defaultValue: true },
    { name: 'selectable', type: 'boolean', label: 'Enable Row Selection', defaultValue: false },
    { name: 'sortable', type: 'boolean', label: 'Enable Sorting', defaultValue: true },
    { name: 'exportable', type: 'boolean', label: 'Enable Export', defaultValue: false },
    { name: 'rowActions', type: 'boolean', label: 'Show Row Actions', defaultValue: false },
    { name: 'resizableColumns', type: 'boolean', label: 'Enable Column Resizing', defaultValue: true },
    { name: 'reorderableColumns', type: 'boolean', label: 'Enable Column Reordering', defaultValue: true },
    { name: 'className', type: 'string', label: 'CSS Class' },
  ],
  defaultProps: {
    caption: 'Enterprise Data Table',
    pagination: true,
    pageSize: 10,
    searchable: true,
    selectable: true,
    sortable: true,
    exportable: true,
    rowActions: true,
    resizableColumns: true,
    reorderableColumns: true,
    columns: [
      { header: 'ID', accessorKey: 'id', width: '80px' },
      { header: 'Name', accessorKey: 'name' },
      { header: 'Email', accessorKey: 'email' },
      { header: 'Status', accessorKey: 'status' },
      { header: 'Role', accessorKey: 'role' },
    ],
    data: [
      { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', role: 'Admin' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Active', role: 'User' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive', role: 'User' },
      { id: 4, name: 'Alice Williams', email: 'alice@example.com', status: 'Active', role: 'Manager' },
      { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', status: 'Active', role: 'User' },
      { id: 6, name: 'Diana Prince', email: 'diana@example.com', status: 'Active', role: 'Admin' },
      { id: 7, name: 'Ethan Hunt', email: 'ethan@example.com', status: 'Inactive', role: 'User' },
      { id: 8, name: 'Fiona Gallagher', email: 'fiona@example.com', status: 'Active', role: 'User' },
      { id: 9, name: 'George Wilson', email: 'george@example.com', status: 'Active', role: 'Manager' },
      { id: 10, name: 'Hannah Montana', email: 'hannah@example.com', status: 'Active', role: 'User' },
      { id: 11, name: 'Ivan Drago', email: 'ivan@example.com', status: 'Inactive', role: 'User' },
      { id: 12, name: 'Julia Roberts', email: 'julia@example.com', status: 'Active', role: 'Admin' },
    ],
  },
});
