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
import type { ObjectGridSchema, DataSource, ListColumn, ViewData } from '@object-ui/types';
import type { I18nLabel } from '@objectstack/spec/ui';
import { SchemaRenderer, useDataScope, useNavigationOverlay, useAction, useObjectTranslation, useSafeFieldLabel } from '@object-ui/react';
import { getCellRenderer, resolveCellRendererType, formatCurrency, formatCompactCurrency, formatDate, formatPercent, humanizeLabel, getBadgeColorClasses } from '@object-ui/fields';
import { useLocalization, resolveFieldCurrency } from '@object-ui/i18n';
import {
  Badge, Button, NavigationOverlay, EmptyValue,
  Popover, PopoverContent, PopoverTrigger,
  ExportProgressDialog, useExportJob, RefreshIndicator,
} from '@object-ui/components';
import { usePullToRefresh } from '@object-ui/mobile';
import { evaluatePlainCondition, buildExpandFields } from '@object-ui/core';
import { ChevronRight, ChevronDown, ChevronLeft, ChevronsLeft, ChevronsRight, Download, Rows2, Rows3, Rows4, AlignJustify, Type, Hash, Calendar, CheckSquare, User, Tag, Clock } from 'lucide-react';
import { useRowColor } from './useRowColor';
import { useGroupedData } from './useGroupedData';
import { GroupRow } from './GroupRow';
import { useColumnSummary } from './useColumnSummary';
import { resolveRowCrudAffordances } from './rowCrudAffordances';
import { RowActionMenu, formatActionLabel } from './components/RowActionMenu';
import { BulkActionBar } from './components/BulkActionBar';
import { BulkActionDialog } from './components/BulkActionDialog';
import type { BulkActionDef } from '@object-ui/types';

// Clickable text cell that can safely contain other interactive content
// (e.g., EmailCellRenderer's copy button). Using <button> here would
// produce an invalid <button> > <button> nesting (hydration error +
// breaks the inner copy click). role="link" + tabIndex + keyboard
// handlers preserves accessibility while allowing arbitrary children.
const LinkCell: React.FC<{
  testId: string;
  onActivate: () => void;
  children: React.ReactNode;
}> = ({ testId, onActivate, children }) => (
  <span
    role="link"
    tabIndex={0}
    data-testid={testId}
    className="text-primary font-medium underline-offset-4 hover:underline cursor-pointer truncate block max-w-full"
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


// Default English fallback translations for the grid
const GRID_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'grid.actions': 'Actions',
  'grid.edit': 'Edit',
  'grid.delete': 'Delete',
  'grid.export': 'Export',
  'grid.exportAs': 'Export as {{format}}',
  'grid.loading': 'Loading grid...',
  'grid.errorLoading': 'Error loading grid',
  'grid.pullToRefresh': 'Pull to refresh',
  'grid.refreshing': 'Refreshing…',
  'grid.openRecord': 'Open record',
  'grid.empty': 'Empty',
  'grid.yes': 'Yes',
  'grid.no': 'No',
  'grid.systemFields': 'System',
  // Reused by the grouped-view pager (falls back here when no I18nProvider).
  'table.rowsPerPage': 'Rows per page',
  'table.pageInfo': 'Page {{current}} of {{total}}',
};

/**
 * Safe wrapper for useObjectTranslation that falls back to English defaults
 * when I18nProvider is not available (e.g., standalone usage).
 */
function useGridTranslation() {
  try {
    const result = useObjectTranslation();
    const testValue = result.t('grid.actions');
    if (testValue === 'grid.actions') {
      return {
        t: (key: string, options?: Record<string, unknown>) => {
          let value = GRID_DEFAULT_TRANSLATIONS[key] || key;
          if (options) {
            for (const [k, v] of Object.entries(options)) {
              value = value.replace(`{{${k}}}`, String(v));
            }
          }
          return value;
        },
      };
    }
    return { t: result.t };
  } catch {
    return {
      t: (key: string, options?: Record<string, unknown>) => {
        let value = GRID_DEFAULT_TRANSLATIONS[key] || key;
        if (options) {
          for (const [k, v] of Object.entries(options)) {
            value = value.replace(`{{${k}}}`, String(v));
          }
        }
        return value;
      },
    };
  }
}

/** Resolve an I18nLabel (string) to a plain string. */
function resolveColumnLabel(label: string | I18nLabel | undefined): string | undefined {
  if (label == null) return undefined;
  return typeof label === 'string' ? label : undefined;
}

export interface ObjectGridProps {
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

export const ObjectGrid: React.FC<ObjectGridProps> = ({
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
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Tenant default currency (ADR-0053) backstops amount cells that lack a code.
  const { currency: tenantCurrency } = useLocalization();
  const { t } = useGridTranslation();
  const { fieldLabel: resolveFieldLabel, translateOptions } = useSafeFieldLabel();
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [useCardView, setUseCardView] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const exportJob = useExportJob({ dataSource });
  const [rowHeightMode, setRowHeightMode] = useState<'compact' | 'short' | 'medium' | 'tall' | 'extra_tall'>(schema.rowHeight ?? 'compact');
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [totalMatching, setTotalMatching] = useState<number | undefined>(undefined);
  const [activeBulkDef, setActiveBulkDef] = useState<BulkActionDef | null>(null);
  const [activeBulkRows, setActiveBulkRows] = useState<any[]>([]);
  const lastFindParamsRef = React.useRef<Record<string, unknown> | null>(null);
  // Grouped view paginates whole groups (groups stay intact, never split across
  // pages). Defaults to the schema page size, falling back to 10 groups/page.
  const [groupedPage, setGroupedPage] = useState(1);
  const [groupedPageSize, setGroupedPageSize] = useState<number>(
    (schema.pagination as any)?.pageSize ?? schema.pageSize ?? 10,
  );

  // Sync internal rowHeightMode when schema.rowHeight prop changes (e.g., parent ListView density toggle)
  React.useEffect(() => {
    if (schema.rowHeight && schema.rowHeight !== rowHeightMode) {
      setRowHeightMode(schema.rowHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.rowHeight]);

  // Column state persistence (order and widths)
  const columnStorageKey = React.useMemo(() => {
    return schema.id
      ? `grid-columns-${schema.objectName}-${schema.id}`
      : `grid-columns-${schema.objectName}`;
  }, [schema.objectName, schema.id]);

  const [columnState, setColumnState] = useState<{
    order?: string[];
    widths?: Record<string, number>;
  }>(() => {
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
    const onChange = (rest as any).onColumnStateChange;
    if (typeof onChange === 'function') {
      try { onChange(state); } catch (e) { console.warn('onColumnStateChange threw:', e); }
    }
  }, [columnStorageKey, rest]);

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

  // Check if data is passed directly (from ListView)
  const passedData = (rest as any).data;

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

  // Extract stable primitive/reference-stable values from schema for dependency arrays.
  // This prevents infinite re-render loops when schema is a new object on each render
  // (e.g. when rendered through SchemaRenderer which creates a fresh evaluatedSchema).
  const objectName = dataConfig?.provider === 'object' && dataConfig && 'object' in dataConfig
    ? (dataConfig as any).object
    : schema.objectName;
  const schemaFields = schema.fields;
  const schemaColumns = schema.columns;
  const schemaFilter = schema.filter;
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
          const getSelectFields = () => {
            // Always include 'id' so row click / navigation handlers can resolve
            // the record key — without it `record.id` is undefined and the
            // primary-field link silently no-ops.
            const ensureId = (list: any[]): any[] => {
              const names = list.map((f: any) => typeof f === 'string' ? f : (f?.name || f?.field));
              return names.includes('id') ? list : ['id', ...list];
            };
            if (schemaFields) return ensureId(schemaFields as any[]);
            if (schemaColumns && Array.isArray(schemaColumns)) {
              const fields = schemaColumns.map((c: any) => typeof c === 'string' ? c : c.field);
              return ensureId(fields);
            }
            return undefined;
          };

          const params: any = {
            $select: getSelectFields(),
            $top: serverPageSize,
            $skip: (serverPage - 1) * serverPageSize,
          };

          // Support new filter format
          if (schemaFilter && Array.isArray(schemaFilter)) {
            params.$filter = schemaFilter;
          } else if (schema.defaultFilters) {
            // Legacy support
            params.$filter = schema.defaultFilters;
          }

          // Support new sort format
          if (schemaSort) {
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

          // Auto-inject $expand for lookup/master_detail fields
          const expand = buildExpandFields(resolvedSchema?.fields, schemaColumns ?? schemaFields);
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
  }, [objectName, schemaFields, schemaColumns, schemaFilter, schemaSort, schemaPagination, schemaPageSize, serverPage, serverPageSize, dataSource, hasInlineData, dataConfig, refreshKey]);

  // Reset to page 1 whenever the query itself changes (object / filter / sort),
  // so we never request a page index that no longer exists for the new result
  // set (e.g. applying a filter while sitting on page 5 of the old query).
  React.useEffect(() => {
    setServerPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectName, schemaFilter, schemaSort]);

  // --- NavigationConfig support ---
  // Must be called before any early returns to satisfy React hooks rules
  const navigation = useNavigationOverlay({
    navigation: schema.navigation,
    objectName: schema.objectName,
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
  const getRowStyle = useCallback((row: Record<string, unknown>): React.CSSProperties | undefined => {
    const rules = schema.conditionalFormatting;
    if (!rules || rules.length === 0) return undefined;
    for (const rule of rules) {
      let match = false;
      const expression =
        ('condition' in rule ? (rule as any).condition : undefined)
        || ('expression' in rule ? (rule as any).expression : undefined)
        || undefined;
      if (expression) {
        match = evaluatePlainCondition(expression, row as Record<string, any>);
      } else if ('field' in rule && 'operator' in rule && (rule as any).field && (rule as any).operator) {
        const r = rule as any;
        const fieldValue = row[r.field];
        switch (r.operator) {
          case 'equals': match = fieldValue === r.value; break;
          case 'not_equals': match = fieldValue !== r.value; break;
          case 'contains': match = typeof fieldValue === 'string' && typeof r.value === 'string' && fieldValue.includes(r.value); break;
          case 'greater_than': match = typeof fieldValue === 'number' && typeof r.value === 'number' && fieldValue > r.value; break;
          case 'less_than': match = typeof fieldValue === 'number' && typeof r.value === 'number' && fieldValue < r.value; break;
          case 'in': match = Array.isArray(r.value) && r.value.includes(fieldValue); break;
        }
      }
      if (match) {
        const style: React.CSSProperties = {};
        if ('style' in rule && (rule as any).style) Object.assign(style, (rule as any).style);
        if ('backgroundColor' in rule && (rule as any).backgroundColor) style.backgroundColor = (rule as any).backgroundColor;
        if ('textColor' in rule && (rule as any).textColor) style.color = (rule as any).textColor;
        if ('borderColor' in rule && (rule as any).borderColor) style.borderColor = (rule as any).borderColor;
        return style;
      }
    }
    return undefined;
  }, [schema.conditionalFormatting]);

  // --- Grouping support ---
  // Build a per-field value formatter so group headers display the human
  // readable label for select/boolean fields rather than the raw value
  // (e.g. "In Progress" instead of "in_progress", "Yes" instead of "true").
  const groupValueFormatter = React.useMemo(() => {
    const grouping = schema.grouping;
    if (!grouping?.fields?.length) return undefined;

    // Per-field { value -> label } lookup, plus a per-field type so we can
    // handle booleans / dates / users without dedicated option lists.
    const lookup = new Map<string, { type?: string; options?: Map<string, string> }>();

    for (const gf of grouping.fields) {
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
      // grids without an objectName still produce a readable label.
      if (meta.type === 'boolean' || typeof value === 'boolean') {
        if (value === true || value === 'true') return t('grid.booleanTrue', 'Yes');
        if (value === false || value === 'false') return t('grid.booleanFalse', 'No');
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

  const generateColumns = useCallback(() => {
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
      // Check if columns are already in data-table format (have 'accessorKey')
      // vs ListColumn format (have 'field')
      if (cols.length > 0 && typeof cols[0] === 'object' && cols[0] !== null) {
        const firstCol = cols[0] as any;
        
        // Already in data-table format - apply type inference for columns without custom cell renderers
        if ('accessorKey' in firstCol) {
          return (cols as any[]).map((col) => {
            if (col.cell) return col; // already has custom renderer

            const syntheticCol: ListColumn = { field: col.accessorKey, label: col.header, type: col.type };
            const inferredType = inferColumnType(syntheticCol);
            if (!inferredType) return col;

            const CellRenderer = getCellRenderer(inferredType);
            const fieldMeta: Record<string, any> = { name: col.accessorKey, type: inferredType };

            if (inferredType === 'select') {
              const uniqueValues = Array.from(new Set(data.map(row => row[col.accessorKey]).filter(Boolean)));
              fieldMeta.options = uniqueValues.map((v: any) => ({ value: v, label: humanizeLabel(String(v)) }));
            }
            // Pass through metadata-defined appearance only — never override
            // the field's display style from the renderer. This keeps list
            // cells visually consistent with detail / form rendering.
            if ((col as any).appearance != null) {
              fieldMeta.appearance = (col as any).appearance;
            }

            return {
              ...col,
              ...(schema.showColumnTypeIcons && { headerIcon: getTypeIcon(inferredType) }),
              cell: (value: any) => <CellRenderer value={value} field={fieldMeta as any} />,
            };
          });
        }
        
        // ListColumn format - convert to data-table format with full feature support
        if ('field' in firstCol) {
          return (cols as ListColumn[])
            .filter((col) => col?.field && typeof col.field === 'string' && !col.hidden)
            .map((col, colIndex) => {
              const rawHeader = resolveColumnLabel(col.label) || col.field.charAt(0).toUpperCase() + col.field.slice(1).replace(/_/g, ' ');
              const header = schema.objectName ? resolveFieldLabel(schema.objectName, col.field, rawHeader) : rawHeader;

              // Build custom cell renderer based on column configuration
              let cellRenderer: ((value: any, row: any) => React.ReactNode) | undefined;

              // Type-based cell renderer: explicit col type > objectDef type > heuristic inference.
              // Format hints (e.g. `text` + `format: 'phone'`) promote to the
              // richer renderer (PhoneCellRenderer) via resolveCellRendererType.
              const objectDefField = objectSchema?.fields?.[col.field];
              const baseInferredType = col.type || objectDefField?.type || inferColumnType({ field: col.field }) || null;
              const formatHint = (col as any).format ?? objectDefField?.format;
              const inferredType = baseInferredType
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
                if (objectDefField.format) fieldMeta.format = objectDefField.format;
                if (objectDefField.options) fieldMeta.options = translateOptions(schema.objectName, col.field, objectDefField.options);
              }
              // Auto-generate options from data for inferred select without existing options
              if (inferredType === 'select' && !fieldMeta.options) {
                const uniqueValues = Array.from(new Set(data.map(row => row[col.field]).filter(Boolean)));
                fieldMeta.options = uniqueValues.map(v => ({ value: v, label: humanizeLabel(String(v)) }));
              }
              if ((col as any).options) {
                fieldMeta.options = translateOptions(schema.objectName, col.field, (col as any).options);
              }
              // Honor metadata-defined appearance only (col.appearance or
              // objectDef field.appearance). When unset, the cell renders
              // its default badge style — same as detail / form views.
              const explicitAppearance = (col as any).appearance ?? objectDefField?.appearance;
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
              const prefixConfig = (col as any).prefix;
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
              const isEssential = colIndex === 0 || (col as any).essential === true;

              return {
                header,
                accessorKey: col.field,
                ...(schema.showColumnTypeIcons && { headerIcon: getTypeIcon(inferredType) }),
                ...(!isEssential && { className: 'hidden sm:table-cell' }),
                ...(col.width && { width: col.width }),
                ...(inferredAlign && { align: inferredAlign }),
                sortable: col.sortable !== false,
                ...(col.resizable !== undefined && { resizable: col.resizable }),
                ...(col.wrap !== undefined && { wrap: col.wrap }),
                ...(cellRenderer && { cell: cellRenderer }),
                ...(col.pinned && { pinned: col.pinned }),
              };
            });
        }
      }
      
      // String array format - enrich with objectDef field metadata for type-aware rendering
      return (cols as string[])
        .filter((fieldName) => typeof fieldName === 'string' && fieldName.trim().length > 0)
        .map((fieldName, colIndex) => {
          const fieldDef = objectSchema?.fields?.[fieldName];
          const rawFieldLabel = fieldDef?.label;
          const rawHeader = rawFieldLabel || fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');
          const header = schema.objectName ? resolveFieldLabel(schema.objectName, fieldName, rawHeader) : rawHeader;

          // Resolve type: objectDef type > heuristic inference (consistent with ListColumn path)
          const resolvedType = fieldDef?.type || inferColumnType({ field: fieldName }) || null;
          const CellRenderer = resolvedType ? getCellRenderer(resolvedType) : null;

          // Build field metadata with objectDef enrichment
          const fieldMeta: Record<string, any> = { name: fieldName, type: resolvedType || 'text' };
          if (fieldDef) {
            if (fieldDef.label) fieldMeta.label = fieldDef.label;
            if (fieldDef.currency) fieldMeta.currency = fieldDef.currency;
            if (fieldDef.precision !== undefined) fieldMeta.precision = fieldDef.precision;
            if (fieldDef.format) fieldMeta.format = fieldDef.format;
            if (fieldDef.options) fieldMeta.options = translateOptions(schema.objectName, fieldName, fieldDef.options);
          }
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
            ...(schema.showColumnTypeIcons && resolvedType && { headerIcon: getTypeIcon(resolvedType) }),
            ...(inferredAlign && { align: inferredAlign }),
            ...(cellRenderer && { cell: cellRenderer }),
            sortable: fieldDef?.sortable !== false,
          };
        });
    }

    // Legacy support: use 'fields' if columns not provided
    if (hasInlineData) {
      const inlineData = dataConfig?.provider === 'value' ? dataConfig.items as any[] : [];
      if (inlineData.length > 0) {
        const fieldsToShow = schemaFields || Object.keys(inlineData[0]);
        return fieldsToShow.map((fieldName) => {
          const fieldDef = objectSchema?.fields?.[fieldName];
          const resolvedType = fieldDef?.type || inferColumnType({ field: fieldName }) || null;
          const CellRenderer = resolvedType ? getCellRenderer(resolvedType) : null;
          const header = fieldDef?.label || fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');

          // Build field metadata with objectDef enrichment
          const fieldMeta: Record<string, any> = { name: fieldName, type: resolvedType || 'text' };
          if (fieldDef) {
            if (fieldDef.label) fieldMeta.label = fieldDef.label;
            if (fieldDef.currency) fieldMeta.currency = fieldDef.currency;
            if (fieldDef.precision !== undefined) fieldMeta.precision = fieldDef.precision;
            if (fieldDef.format) fieldMeta.format = fieldDef.format;
            if (fieldDef.options) fieldMeta.options = translateOptions(schema.objectName, fieldName, fieldDef.options);
          }
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
            ...(schema.showColumnTypeIcons && resolvedType && { headerIcon: getTypeIcon(resolvedType) }),
            ...(inferredAlign && { align: inferredAlign }),
            ...(CellRenderer && { cell: (value: any) => <CellRenderer value={value} field={fieldMeta as any} /> }),
            sortable: fieldDef?.sortable !== false,
          };
        });
      }
    }

    if (!objectSchema) return [];

    const generatedColumns: any[] = [];
    // Default columns priority (when schema doesn't specify columns):
    //   1. Explicit `compactLayout` from the object schema (curated business fields).
    //   2. Otherwise, all schema fields with system-managed fields pushed to the end.
    //
    // Also drop fields that are platform-managed identifiers/audit columns or
    // marked `hidden: true`/`readonly: true` so default list views show only
    // the business fields users actually care about. Callers can still opt-in
    // to system columns by passing an explicit `fields` / `columns` prop.
    const SYSTEM_FIELDS = new Set([
      'id', 'created_at', 'createdAt', 'updated_at', 'updatedAt',
      'deleted_at', 'deletedAt', 'created_by', 'createdBy',
      'updated_by', 'updatedBy', '_version', '_rev',
    ]);
    const compactLayout: string[] | undefined = (objectSchema as any)?.compactLayout;
    const allFieldNames = Object.keys(objectSchema.fields || {});
    let fieldsToShow: string[];
    if (schemaFields) {
      fieldsToShow = schemaFields;
    } else if (compactLayout?.length) {
      fieldsToShow = compactLayout.filter((n) => objectSchema.fields?.[n]);
    } else {
      // Drop hidden + readonly system-managed fields, then push remaining
      // system identifier/audit fields to the end as a fallback.
      const visibleFields = allFieldNames.filter((n) => {
        const f = objectSchema.fields?.[n];
        if (!f) return false;
        if (f.hidden) return false;
        // Drop readonly fields when their name matches a system identifier/audit column.
        if (f.readonly && SYSTEM_FIELDS.has(n)) return false;
        return true;
      });
      fieldsToShow = [
        ...visibleFields.filter((n) => !SYSTEM_FIELDS.has(n)),
        ...visibleFields.filter((n) => SYSTEM_FIELDS.has(n)),
      ];
    }

    fieldsToShow.forEach((fieldName) => {
      const field = objectSchema.fields?.[fieldName];
      if (!field) return;

      if (field.permissions && field.permissions.read === false) return;

      const CellRenderer = getCellRenderer(field.type);
      const numericTypes = ['number', 'currency', 'percent'];
      const translatedField = field.options
        ? { ...field, options: translateOptions(schema.objectName, fieldName, field.options) }
        : field;
      const fieldForCell: any = translatedField;
      generatedColumns.push({
        header: schema.objectName ? resolveFieldLabel(schema.objectName, fieldName, field.label || fieldName) : field.label || fieldName,
        accessorKey: fieldName,
        ...(numericTypes.includes(field.type) && { align: 'right' }),
        cell: (value: any) => <CellRenderer value={value} field={fieldForCell} />,
        sortable: field.sortable !== false,
      });
    });

    return generatedColumns;
  }, [objectSchema, schemaFields, schemaColumns, dataConfig, hasInlineData, navigation.handleClick, executeAction, data, resolveFieldLabel, translateOptions, schema.objectName]);

  const handleExport = useCallback((format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    const exportConfig = schema.exportOptions;
    const maxRecords = exportConfig?.maxRecords || 0;
    const includeHeaders = exportConfig?.includeHeaders !== false;
    const prefix = exportConfig?.fileNamePrefix || schema.objectName || 'export';

    // Async streaming path — use spec v4 createExportJob when the data source
    // supports it (and the format is something the server can stream).
    const asyncEligible = format === 'csv' || format === 'xlsx' || format === 'json';
    const useAsync = asyncEligible
      && exportJob.isSupported
      && schema.objectName
      && !hasInlineData
      // Honor an opt-out: schema.exportOptions.streaming === false forces client-side.
      && (exportConfig as any)?.streaming !== false;

    if (useAsync) {
      const cols = generateColumns().filter((c: any) => c.accessorKey !== '_actions');
      const fields = cols.map((c: any) => c.accessorKey).filter(Boolean);
      setShowExport(false);
      setExportDialogOpen(true);
      void exportJob.start(schema.objectName!, {
        format: format === 'json' ? 'json' : (format as 'csv' | 'xlsx'),
        fields: fields.length ? fields : undefined,
        includeHeaders,
        limit: maxRecords > 0 ? maxRecords : undefined,
      });
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
      const cols = generateColumns().filter((c: any) => c.accessorKey !== '_actions');
      const fields = cols.map((c: any) => c.accessorKey);
      const headers = cols.map((c: any) => c.header);
      const rows: string[] = [];
      if (includeHeaders) {
        rows.push(headers.join(','));
      }
      exportData.forEach(record => {
        rows.push(fields.map((f: string) => escapeCsvValue(record[f])).join(','));
      });
      downloadFile(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${prefix}.csv`);
    } else if (format === 'json') {
      downloadFile(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }), `${prefix}.json`);
    }
    setShowExport(false);
  }, [data, schema.exportOptions, schema.objectName, generateColumns, exportJob, hasInlineData]);

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

  const columns = generateColumns();

  // Apply persisted column order and widths
  let persistedColumns = [...columns];
  
  // Apply saved widths
  if (columnState.widths) {
    persistedColumns = persistedColumns.map((col: any) => {
      const savedWidth = columnState.widths?.[col.accessorKey];
      if (savedWidth) {
        return { ...col, size: savedWidth };
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
  const rowActionDefsList: any[] = Array.isArray((schema as any).rowActionDefs) ? (schema as any).rowActionDefs : [];
  const wantEditAction = rowActionsList.includes('edit');
  const wantDeleteAction = rowActionsList.includes('delete');
  const customRowActions = rowActionsList.filter(a => a !== 'edit' && a !== 'delete');
  // Honor the object's CRUD affordance flags: when `userActions.edit`/`delete`
  // is explicitly false the object opted out of the generic row Edit/Delete
  // (e.g. sys_environment ships a dedicated Rename + cascade-Delete instead).
  // This stops a generic "Delete" from duplicating the object's own Delete
  // action, and a generic "Edit" the object turned off from leaking back in.
  const { canEdit, canDelete } = resolveRowCrudAffordances({
    operationsUpdate: operations?.update,
    operationsDelete: operations?.delete,
    wantEditAction,
    wantDeleteAction,
    hasOnEdit: !!onEdit,
    hasOnDelete: !!onDelete,
    userActions: (objectSchema as any)?.userActions,
  });
  const hasActions = !!(operations && (operations.update || operations.delete));
  const hasRowActions = customRowActions.length > 0 || rowActionDefsList.length > 0 || wantEditAction || wantDeleteAction;

  const columnsWithActions = (hasActions || hasRowActions) ? [
    ...persistedColumns,
    {
      header: t('grid.actions'),
      accessorKey: '_actions',
      cell: (_value: any, row: any) => (
        <RowActionMenu
          row={row}
          rowActions={customRowActions}
          rowActionDefs={rowActionDefsList}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          onAction={(action, r) => executeAction({ type: action, params: { record: r } })}
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
            executeAction(dispatch);
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

  const applyDensity = (col: any) => ({
    ...col,
    cellClassName: [rowHeightCellClass, col.cellClassName].filter(Boolean).join(' '),
  });

  const orderedColumns = hasPinnedColumns
    ? [
        ...pinnedLeftCols.map(applyDensity),
        ...unpinnedCols.map(applyDensity),
        ...pinnedRightCols.map((col: any) => ({
          ...applyDensity(col),
          className: [col.className, rightPinnedClasses].filter(Boolean).join(' '),
          cellClassName: [rowHeightCellClass, col.cellClassName, rightPinnedClasses].filter(Boolean).join(' '),
        })),
      ]
    : columnsWithActions.map(applyDensity);

  // Calculate frozenColumns: if pinned columns exist, use left-pinned count; otherwise use schema default
  const effectiveFrozenColumns = hasPinnedColumns
    ? pinnedLeftCols.length
    : (schema.frozenColumns ?? 1);

  // Determine selection mode (support both new and legacy formats)
  // Auto-enable 'multiple' selection when bulk actions are defined OR when
  // a bulk-delete affordance is implicitly available (canDelete + onBulkDelete
  // wired by the consumer). This gives every list a multi-select + delete UX
  // out of the box without forcing each view JSON to declare bulkActions.
  const explicitBulkActions = schema.batchActions ?? (schema as any).bulkActions;
  const bulkActionDefs: BulkActionDef[] = Array.isArray((schema as any).bulkActionDefs)
    ? (schema as any).bulkActionDefs
    : [];
  const effectiveBulkActions: string[] =
    explicitBulkActions && explicitBulkActions.length > 0
      ? explicitBulkActions
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
    const base = { ...(lastFindParamsRef.current ?? {}) } as Record<string, unknown>;
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
  const dispatchBulkAction = (action: string, rows: any[]) => {
    void (async () => {
      const expanded = await resolveBulkRows(rows);
      if (action === 'delete' && onBulkDelete) {
        onBulkDelete(expanded);
        setSelectedRows([]);
        setSelectAllMatching(false);
        return;
      }
      executeAction({ type: action, params: { records: expanded } });
    })();
  };

  // Rich BulkActionDef dispatcher — opens the BulkActionDialog (params →
  // confirm → progress → result). When the user closes the dialog after a
  // run, refresh data so the grid reflects mutations.
  const dispatchBulkActionDef = (def: BulkActionDef, rows: any[]) => {
    void (async () => {
      const expanded = await resolveBulkRows(rows);
      setActiveBulkDef(def);
      setActiveBulkRows(expanded);
    })();
  };
  const handleBulkDialogClose = (result?: unknown) => {
    setActiveBulkDef(null);
    setActiveBulkRows([]);
    if (result) {
      // Clear selection after a successful run so the toolbar resets.
      setSelectedRows([]);
      setSelectAllMatching(false);
      // Trigger refresh via the same path used by single-record mutations.
      setRefreshKey(k => k + 1);
    }
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

  // Server-side pagination applies to the flat, server-fetched list only.
  // Inline/static data and the grouped view paginate in-memory (grouped mode
  // keeps whole groups together via its own groupedPage state), so they stay
  // on DataTable's default client-side slicing.
  const useServerPagination = !hasInlineData && !isGrouped;

  const dataTableSchema: any = {
    type: 'data-table',
    caption: schema.label || schema.title,
    columns: orderedColumns,
    data,
    pagination: paginationEnabled,
    pageSize: useServerPagination ? serverPageSize : pageSize,
    // In server mode `data` IS the current page; tell DataTable to render it
    // as-is and drive paging via the callbacks below using the real match total.
    manualPagination: useServerPagination,
    rowCount: useServerPagination ? totalMatching : undefined,
    page: useServerPagination ? serverPage : undefined,
    onPageChange: useServerPagination ? setServerPage : undefined,
    onPageSizeChange: useServerPagination
      ? (size: number) => { setServerPageSize(size); setServerPage(1); }
      : undefined,
    searchable: searchEnabled,
    selectable: selectionMode,
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
    rowActions: !!(schema.editable && hasActions),
    resizableColumns: schema.resizable ?? schema.resizableColumns ?? true,
    reorderableColumns: schema.reorderableColumns ?? false,
    editable: schema.editable ?? false,
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
    showAddRow: !!operations?.create,
    onAddRecord: onAddRecord,
    rowClassName: schema.rowColor ? (row: any, _idx: number) => getRowClassName(row) : undefined,
    rowStyle: schema.conditionalFormatting?.length ? (row: any, _idx: number) => getRowStyle(row) : undefined,
    frozenColumns: effectiveFrozenColumns,
    onSelectionChange: (rows: any[]) => {
      setSelectedRows(rows);
      onRowSelect?.(rows);
    },
    onRowClick: navigation.handleClick,
    onCellChange: onCellChange,
    onRowSave: onRowSave,
    onBatchSave: onBatchSave,
    onColumnResize: (columnKey: string, width: number) => {
      saveColumnState({
        ...columnState,
        widths: { ...columnState.widths, [columnKey]: width },
      });
    },
    onColumnReorder: (newOrder: string[]) => {
      saveColumnState({
        ...columnState,
        order: newOrder,
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
    let maxLen = String(col.header ?? '').length;
    for (const row of data.slice(0, 50)) {
      const v = row?.[key];
      const len = v != null ? String(v).length : 0;
      if (len > maxLen) maxLen = len;
    }
    groupedColumnWidths[key] = Math.min(400, Math.max(80, maxLen * 8 + 48));
  }

  /** Build a per-group data-table schema (inherits everything except data & pagination). */
  const buildGroupTableSchema = (groupRows: any[]) => ({
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
    // Pin explicit, shared widths so columns align across all groups.
    columns: (dataTableSchema.columns as any[]).map((c: any) => ({
      ...c,
      width: groupedColumnWidths[c.accessorKey] ?? c.width,
    })),
  });

  // Build record detail title
  const detailTitle = schema.label
    ? `${schema.label} Detail`
    : schema.objectName
      ? `${schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1)} Detail`
      : 'Record Detail';

  // Mobile card-view: below the 768px app breakpoint (matches useIsMobile /
  // Tailwind md: / the responsive page+grid layout), render stacked cards
  // instead of a side-scrolling wide table.
  if (useCardView && data.length > 0 && !isGrouped) {
    const displayColumns = generateColumns().filter((c: any) => c.accessorKey !== '_actions');

    // Build a lookup of column metadata for smart rendering
    const colMap = new Map<string, any>();
    displayColumns.forEach((col: any) => colMap.set(col.accessorKey, col));

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
                    {row[titleCol.accessorKey] != null && typeof row[titleCol.accessorKey] === 'object' ? String(row[titleCol.accessorKey]) : (row[titleCol.accessorKey] ?? '—')}
                  </div>
                )}

                {/* Amount + Stage row - side by side for compact display */}
                {(amountCol || stageCol) && (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {amountCol && (
                      <span className="text-sm tabular-nums font-medium">
                        {typeof row[amountCol.accessorKey] === 'number'
                          ? formatCompactCurrency(row[amountCol.accessorKey], resolveFieldCurrency(amountCol as any, tenantCurrency))
                          : (row[amountCol.accessorKey] != null && typeof row[amountCol.accessorKey] === 'object' ? String(row[amountCol.accessorKey]) : (row[amountCol.accessorKey] ?? '—'))}
                      </span>
                    )}
                    {stageCol && row[stageCol.accessorKey] && (() => {
                      const rawValue = row[stageCol.accessorKey];
                      const optMeta = resolveOptionMeta(stageCol.accessorKey, rawValue);
                      // Explicit option color wins (matches desktop grid via
                      // getBadgeColorClasses); fall back to the pipeline-stage
                      // heuristics keyed on the raw value, which stays stable
                      // across locales.
                      const badgeClasses = optMeta.color
                        ? getBadgeColorClasses(optMeta.color, rawValue)
                        : stageBadgeColor(String(rawValue));
                      return (
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 max-w-[140px] truncate ${badgeClasses}`}
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
                          ? formatDate(row[dateCols[0].accessorKey], 'short')
                          : '—'}
                      </span>
                    )}
                    {percentCols[0] && row[percentCols[0].accessorKey] != null && (
                      <span className="tabular-nums">
                        {formatPercent(Number(row[percentCols[0].accessorKey]))}
                      </span>
                    )}
                  </div>
                )}

                {/* Additional date fields beyond the first */}
                {dateCols.slice(1).map((col: any) => (
                  <div key={col.accessorKey} className="flex justify-between items-center py-0.5">
                    <span className="text-xs text-muted-foreground">{col.header}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {row[col.accessorKey] ? formatDate(row[col.accessorKey], 'short') : '—'}
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
                        {col.cell ? col.cell(val, row) : String(val)}
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
            {(record) => (
              <div className="space-y-3">
                {Object.entries(record).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm">{String(value ?? '—')}</span>
                  </div>
                ))}
              </div>
            )}
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
  const showRowHeightToggle = schema.rowHeight !== undefined && !(schema as any).hideRowHeightToggle;
  const hasToolbar = schema.exportOptions || showRowHeightToggle;
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
      {schema.exportOptions && (
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
              {(schema.exportOptions.formats || ['csv', 'json']).map(format => (
                <Button
                  key={format}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs"
                  onClick={() => handleExport(format)}
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  {t('grid.exportAs', { format: format.toUpperCase() })}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  ) : null;

  // Form-based record detail renderer (replaces simple key-value dump)
  const renderRecordDetail = (record: any) => {
    const systemFields = ['_id', 'id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    const entries = Object.entries(record);
    // Honor `hidden: true` on the schema field def — internal/system fields
    // (e.g. database_url, environment_id, is_system) shouldn't leak into the
    // grid's record-detail drawer just because they're in the record payload.
    const isHidden = (key: string) => objectSchema?.fields?.[key]?.hidden === true;
    const regularFields = entries.filter(([key]) => !systemFields.includes(key) && !isHidden(key));
    const metaFields = entries.filter(([key]) => systemFields.includes(key) && key !== '_id' && key !== 'id');

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
      // Detect date-like values
      if (typeof value === 'string' && !isNaN(Date.parse(value)) && (key.includes('date') || key.includes('_at') || key.includes('time'))) {
        return <span className="text-sm tabular-nums">{formatDate(value)}</span>;
      }
      // Detect currency-like fields by name
      const currencyFields = ['amount', 'price', 'total', 'revenue', 'cost', 'value', 'budget', 'salary'];
      if (typeof value === 'number' && currencyFields.some(f => key.toLowerCase().includes(f))) {
        return <span className="text-sm tabular-nums font-medium">{formatCurrency(value, tenantCurrency)}</span>;
      }
      return <span className="text-sm break-words">{String(value)}</span>;
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
                  <span className="text-xs text-muted-foreground flex-1 min-w-0 break-words">{String(value ?? '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

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
    const ftype = fieldDef?.type;
    if (ftype === 'select' || ftype === 'status') {
      const opts = fieldDef?.options
        ? translateOptions(schema.objectName, field, fieldDef.options)
        : undefined;
      const matched = Array.isArray(opts)
        ? opts.find((o: any) => String(o.label) === label || String(o.value) === label)
        : undefined;
      labelColorClass = getBadgeColorClasses(matched?.color, matched?.value ?? label);
    }
    return { fieldLabel, labelColorClass };
  };

  const renderGroup = (group: typeof groups[number]): React.ReactNode => {
    const { fieldLabel, labelColorClass } = resolveGroupHeader(group.field, group.label);
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

  const gridContent = isGrouped ? (
    <div className="flex flex-col h-full min-h-0">
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
    <>
      <SchemaRenderer schema={dataTableSchema} />
      {summaryFooter}
    </>
  );

  // Shared async-export progress dialog (used by both render paths).
  const exportProgressDialog = (
    <ExportProgressDialog
      open={exportDialogOpen}
      onOpenChange={setExportDialogOpen}
      job={exportJob}
      filename={`${schema.exportOptions?.fileNamePrefix || schema.objectName || 'export'}.${exportJob.progress?.format || 'csv'}`}
      closeAfterDownloadMs={400}
    />
  );

  // Rendered BulkActionDialog (shared across both render branches).
  const bulkDialog = (
    <BulkActionDialog
      def={activeBulkDef}
      rows={activeBulkRows}
      open={!!activeBulkDef}
      onClose={handleBulkDialogClose}
      dataSource={dataSource as any}
      resource={schema.objectName ?? ''}
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
            <>
              {gridToolbar}
              {gridContent}
              <BulkActionBar
                selectedRows={selectedRows}
                actions={effectiveBulkActions ?? []}
                actionDefs={bulkActionDefs}
                onAction={dispatchBulkAction}
                onActionDef={dispatchBulkActionDef}
                onClearSelection={() => { setSelectedRows([]); setSelectAllMatching(false); }}
                pageSize={data.length}
                totalMatching={totalMatching}
                allMatchingSelected={selectAllMatching}
                onSelectAllMatching={() => setSelectAllMatching(true)}
              />
            </>
          }
        >
          {(record) => renderRecordDetail(record)}
        </NavigationOverlay>
        {exportProgressDialog}
        {bulkDialog}
      </>
    );
  }

  return (
    <div ref={pullRef} className="relative h-full">
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
        onAction={dispatchBulkAction}
        onActionDef={dispatchBulkActionDef}
        onClearSelection={() => { setSelectedRows([]); setSelectAllMatching(false); }}
        pageSize={data.length}
        totalMatching={totalMatching}
        allMatchingSelected={selectAllMatching}
        onSelectAllMatching={() => setSelectAllMatching(true)}
      />
      {navigation.isOverlay && (
        <NavigationOverlay
          {...navigation}
          title={detailTitle}
        >
          {(record) => renderRecordDetail(record)}
        </NavigationOverlay>
      )}
      {exportProgressDialog}
      {bulkDialog}
    </div>
  );
};
