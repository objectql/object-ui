/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Input, Popover, PopoverContent, PopoverTrigger, FilterBuilder, SortBuilder, NavigationOverlay, GroupingEditor, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@object-ui/components';
import type { SortItem } from '@object-ui/components';
import { Search, SlidersHorizontal, ArrowUpDown, X, EyeOff, Group, Paintbrush, Ruler, Inbox, Download, AlignJustify, Rows4, Rows3, Rows2, Share2, Printer, Plus, Trash2, CheckSquare, icons, type LucideIcon } from 'lucide-react';
import type { FilterGroup } from '@object-ui/components';
import { ViewSwitcher, ViewType } from './ViewSwitcher';
import { TabBar } from './components/TabBar';
import type { ViewTab } from './components/TabBar';
import { UserFilters } from './UserFilters';
import { SchemaRenderer, useNavigationOverlay } from '@object-ui/react';
import { useDensityMode } from '@object-ui/react';
import type { ListViewSchema } from '@object-ui/types';
import { usePullToRefresh } from '@object-ui/mobile';
import { evaluatePlainCondition, normalizeQuickFilter, normalizeQuickFilters, buildExpandFields } from '@object-ui/core';
import { useObjectTranslation, useObjectLabel, useSafeFieldLabel } from '@object-ui/i18n';

export interface ListViewProps {
  schema: ListViewSchema;
  className?: string;
  onViewChange?: (view: ViewType) => void;
  onFilterChange?: (filters: any) => void;
  onSortChange?: (sort: any) => void;
  onSearchChange?: (search: string) => void;
  /** Called when the user toggles fields via the Hide Fields popover. */
  onHiddenFieldsChange?: (hidden: string[]) => void;
  /** Called when the user resizes/reorders columns in the underlying grid. */
  onColumnStateChange?: (state: { order?: string[]; widths?: Record<string, number> }) => void;
  /** Callback when a row/item is clicked (overrides NavigationConfig) */
  onRowClick?: (record: Record<string, unknown>) => void;
  /** Show view type switcher (Grid/Kanban/etc). Default: false (view type is fixed) */
  showViewSwitcher?: boolean;
  [key: string]: any;
}

// Helper to convert FilterBuilder group to ObjectStack AST
function mapOperator(op: string) {
  switch (op) {
    case 'equals': case 'eq': return '=';
    case 'notEquals': case 'ne': case 'neq': return '!=';
    case 'contains': return 'contains';
    case 'notContains': return 'notcontains';
    case 'greaterThan': case 'gt': return '>';
    case 'greaterOrEqual': case 'gte': return '>=';
    case 'lessThan': case 'lt': return '<';
    case 'lessOrEqual': case 'lte': return '<=';
    case 'in': return 'in';
    case 'notIn': return 'not in';
    case 'before': return '<';
    case 'after': return '>';
    default: return op;
  }
}

/**
 * Normalize a single filter condition: convert `in`/`not in` operators
 * into backend-compatible `or`/`and` of equality conditions.
 * E.g., ['status', 'in', ['a','b']] → ['or', ['status','=','a'], ['status','=','b']]
 */
export function normalizeFilterCondition(condition: any[]): any[] {
  if (!Array.isArray(condition) || condition.length < 3) return condition;

  const [field, op, value] = condition;

  // Recurse into logical groups
  if (typeof field === 'string' && (field === 'and' || field === 'or')) {
    return [field, ...condition.slice(1).map((c: any) =>
      Array.isArray(c) ? normalizeFilterCondition(c) : c
    )];
  }

  if (op === 'in' && Array.isArray(value)) {
    if (value.length === 0) return [];
    if (value.length === 1) return [field, '=', value[0]];
    return ['or', ...value.map((v: any) => [field, '=', v])];
  }

  if (op === 'not in' && Array.isArray(value)) {
    if (value.length === 0) return [];
    if (value.length === 1) return [field, '!=', value[0]];
    return ['and', ...value.map((v: any) => [field, '!=', v])];
  }

  return condition;
}

/**
 * Format an action identifier string into a human-readable label.
 * e.g., 'send_email' → 'Send Email'
 */
function formatActionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Normalize an array of filter conditions, expanding `in`/`not in` operators
 * and ensuring consistent AST structure.
 */
export function normalizeFilters(filters: any[]): any[] {
  if (!Array.isArray(filters) || filters.length === 0) return [];
  return filters
    .map(f => Array.isArray(f) ? normalizeFilterCondition(f) : f)
    .filter(f => Array.isArray(f) && f.length > 0);
}

function convertFilterGroupToAST(group: FilterGroup): any[] {
  if (!group || !group.conditions || group.conditions.length === 0) return [];

  const conditions = group.conditions.map(c => {
    if (c.operator === 'isEmpty') return [c.field, '=', null];
    if (c.operator === 'isNotEmpty') return [c.field, '!=', null];
    return [c.field, mapOperator(c.operator), c.value];
  });

  // Normalize in/not-in conditions for backend compatibility
  const normalized = normalizeFilters(conditions);
  if (normalized.length === 0) return [];
  if (normalized.length === 1) return normalized[0];
  
  return [group.logic, ...normalized];
}

/**
 * Evaluate conditional formatting rules against a record.
 * Returns a CSSProperties object for the first matching rule, or empty object.
 * Supports both field/operator/value rules and expression-based rules.
 *
 * Exported for use by child view renderers (e.g., ObjectGrid) and consumers
 * who need to evaluate formatting rules outside the ListView component.
 */
export function evaluateConditionalFormatting(
  record: Record<string, unknown>,
  rules?: ListViewSchema['conditionalFormatting']
): React.CSSProperties {
  if (!rules || rules.length === 0) return {};
  for (const rule of rules) {
    let match = false;

    // Determine expression: spec uses 'condition', ObjectUI uses 'expression'
    const expression =
      ('condition' in rule ? rule.condition : undefined)
      || ('expression' in rule ? rule.expression : undefined)
      || undefined;

    // Expression-based evaluation using safe ExpressionEvaluator
    // Supports both template expressions (${data.field > value}) and
    // plain Spec expressions (field == 'value').
    if (expression) {
      match = evaluatePlainCondition(expression, record as Record<string, any>);
    } else if ('field' in rule && 'operator' in rule && rule.field && rule.operator) {
      // Standard field/operator/value evaluation (ObjectUI format)
      const fieldValue = record[rule.field];
      switch (rule.operator) {
        case 'equals':
          match = fieldValue === rule.value;
          break;
        case 'not_equals':
          match = fieldValue !== rule.value;
          break;
        case 'contains':
          match = typeof fieldValue === 'string' && typeof rule.value === 'string' && fieldValue.includes(rule.value);
          break;
        case 'greater_than':
          match = typeof fieldValue === 'number' && typeof rule.value === 'number' && fieldValue > rule.value;
          break;
        case 'less_than':
          match = typeof fieldValue === 'number' && typeof rule.value === 'number' && fieldValue < rule.value;
          break;
        case 'in':
          match = Array.isArray(rule.value) && rule.value.includes(fieldValue);
          break;
      }
    }

    if (match) {
      // Build style: spec 'style' object is base, individual properties override
      const style: React.CSSProperties = {};
      if ('style' in rule && rule.style) Object.assign(style, rule.style);
      if ('backgroundColor' in rule && rule.backgroundColor) style.backgroundColor = rule.backgroundColor;
      if ('textColor' in rule && rule.textColor) style.color = rule.textColor;
      if ('borderColor' in rule && rule.borderColor) style.borderColor = rule.borderColor;
      return style;
    }
  }
  return {};
}

// Default English translations for fallback when I18nProvider is not available
const LIST_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'list.recordCount': '{{count}} records',
  'list.recordCountOne': '{{count}} record',
  'list.noItems': 'No items found',
  'list.noItemsMessage': 'There are no records to display. Try adjusting your filters or adding new data.',
  'list.search': 'Search',
  'list.filter': 'Filter',
  'list.filterRecords': 'Filter Records',
  'list.sort': 'Sort',
  'list.sortRecords': 'Sort Records',
  'list.group': 'Group',
  'list.groupBy': 'Group By',
  'list.export': 'Export',
  'list.exportAs': 'Export as {{format}}',
  'list.color': 'Color',
  'list.rowColor': 'Row Color',
  'list.colorByField': 'Color by field',
  'list.clear': 'Clear',
  'list.none': 'None',
  'list.hideFields': 'Hide fields',
  'list.showAll': 'Show all',
  'list.pullToRefresh': 'Pull to refresh',
  'list.refreshing': 'Refreshing…',
  'list.dataLimitReached': 'Showing first {{limit}} records. More data may be available.',
  'list.addRecord': 'Add record',
  'list.tabs': 'Tabs',
  'list.allRecords': 'All Records',
  'list.share': 'Share',
  'list.print': 'Print',
  'list.hideFieldsTitle': 'Hide Fields',
  'table.rowsPerPage': 'Rows per page',
};

/**
 * Safe wrapper for useObjectTranslation that falls back to English defaults
 * when I18nProvider is not available (e.g., standalone usage outside console).
 */
function useListViewTranslation() {
  try {
    const result = useObjectTranslation();
    const testValue = result.t('list.recordCount');
    if (testValue === 'list.recordCount') {
      // i18n returned the key itself — not initialized
      return {
        t: (key: string, options?: Record<string, unknown>) => {
          let value = LIST_DEFAULT_TRANSLATIONS[key] || key;
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
        let value = LIST_DEFAULT_TRANSLATIONS[key] || key;
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

/**
 * Safe wrapper for useObjectLabel that falls back to identity when I18nProvider is unavailable.
 */
function useListFieldLabel() {
  try {
    const { fieldLabel } = useObjectLabel();
    return { fieldLabel };
  } catch {
    return {
      fieldLabel: (_objectName: string, _fieldName: string, fallback: string) => fallback,
    };
  }
}

/**
 * Imperative handle exposed by ListView via React.forwardRef.
 * Allows parent components to trigger a data refresh programmatically.
 *
 * @example
 * ```tsx
 * const listRef = React.useRef<ListViewHandle>(null);
 * <ListView ref={listRef} schema={schema} />
 * // After a mutation:
 * listRef.current?.refresh();
 * ```
 */
export interface ListViewHandle {
  /** Force the ListView to re-fetch data from the DataSource */
  refresh(): void;
}

export const ListView = React.forwardRef<ListViewHandle, ListViewProps>(({
  schema: propSchema,
  className,
  onViewChange,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onHiddenFieldsChange,
  onColumnStateChange,
  onRowClick,
  showViewSwitcher = false,
  ...props
}, ref) => {
  // i18n support for record count and other labels
  const { t } = useListViewTranslation();
  const { fieldLabel: resolveFieldLabel } = useListFieldLabel();
  const { translateOptions } = useSafeFieldLabel();

  // Kernel level default: Ensure viewType is always defined (default to 'grid')
  const schema = React.useMemo(() => ({
    ...propSchema,
    viewType: propSchema.viewType || 'grid'
  }), [propSchema]);

  // Convenience: resolve field label with schema.objectName pre-bound
  const tFieldLabel = React.useCallback(
    (fieldName: string, fallback: string) =>
      schema.objectName ? resolveFieldLabel(schema.objectName, fieldName, fallback) : fallback,
    [schema.objectName, resolveFieldLabel],
  );

  // Resolve toolbar visibility flags: userActions overrides showX flags
  const toolbarFlags = React.useMemo(() => {
    const ua = schema.userActions;
    const addRecordEnabled = schema.addRecord?.enabled === true && ua?.addRecordForm !== false;
    return {
      showSearch: ua?.search !== undefined ? ua.search : schema.showSearch !== false,
      showSort: ua?.sort !== undefined ? ua.sort : schema.showSort !== false,
      showFilters: ua?.filter !== undefined ? ua.filter : schema.showFilters !== false,
      showDensity: ua?.rowHeight !== undefined ? ua.rowHeight : schema.showDensity !== false,
      showHideFields: schema.showHideFields === true,
      showGroup: schema.showGroup !== false,
      showColor: schema.showColor === true,
      showAddRecord: addRecordEnabled,
      addRecordPosition: (schema.addRecord?.position === 'bottom' ? 'bottom' : 'top') as 'top' | 'bottom',
    };
  }, [schema.userActions, schema.showSearch, schema.showSort, schema.showFilters, schema.showDensity, schema.showHideFields, schema.showGroup, schema.showColor, schema.addRecord, schema.userActions?.addRecordForm]);

  const [currentView, setCurrentView] = React.useState<ViewType>(
    (schema.viewType as ViewType)
  );
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showSearchPopover, setShowSearchPopover] = React.useState(false);
  
  // Sort State
  const [showSort, setShowSort] = React.useState(false);
  const [currentSort, setCurrentSort] = React.useState<SortItem[]>(() => {
    if (schema.sort && schema.sort.length > 0) {
      return schema.sort.map((s: any) => {
        // Support legacy string format "field desc"
        if (typeof s === 'string') {
          const parts = s.trim().split(/\s+/);
          return {
            id: crypto.randomUUID(),
            field: parts[0],
            order: (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
          };
        }
        return {
          id: crypto.randomUUID(),
          field: s.field,
          order: (s.order as 'asc' | 'desc') || 'asc',
        };
      });
    }
    return [];
  });

  // Sync when parent schema.sort changes (view switch / reload pulls a
  // saved override). Compare by stringified payload to avoid render loops.
  const schemaSortKey = React.useMemo(
    () => JSON.stringify(schema.sort || []),
    [schema.sort]
  );
  React.useEffect(() => {
    if (schema.sort && schema.sort.length > 0) {
      setCurrentSort(
        schema.sort.map((s: any) => {
          if (typeof s === 'string') {
            const parts = s.trim().split(/\s+/);
            return {
              id: crypto.randomUUID(),
              field: parts[0],
              order: (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
            };
          }
          return {
            id: crypto.randomUUID(),
            field: s.field,
            order: (s.order as 'asc' | 'desc') || 'asc',
          };
        })
      );
    } else {
      setCurrentSort([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaSortKey]);

  const [showFilters, setShowFilters] = React.useState(false);

  const [currentFilters, setCurrentFilters] = React.useState<FilterGroup>({
    id: 'root',
    logic: 'and',
    conditions: []
  });

  // Tab State
  const [activeTab, setActiveTab] = React.useState<string | undefined>(() => {
    if (!schema.tabs || schema.tabs.length === 0) return undefined;
    const defaultTab = schema.tabs.find((t: any) => t.isDefault);
    return defaultTab?.name ?? schema.tabs[0]?.name;
  });

  const handleTabChange = React.useCallback(
    (tab: ViewTab) => {
      setActiveTab(tab.name);
      // Apply tab filter if defined
      if (tab.filter) {
        const tabFilters: FilterGroup = {
          id: `tab-filter-${tab.name}`,
          logic: tab.filter.logic || 'and',
          conditions: tab.filter.conditions || [],
        };
        setCurrentFilters(tabFilters);
        onFilterChange?.(tabFilters);
      } else {
        const emptyFilters: FilterGroup = { id: 'root', logic: 'and', conditions: [] };
        setCurrentFilters(emptyFilters);
        onFilterChange?.(emptyFilters);
      }
    },
    [onFilterChange],
  );

  // Data State
  const dataSource = props.dataSource;
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [objectDef, setObjectDef] = React.useState<any>(null);
  const [objectDefLoaded, setObjectDefLoaded] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [dataLimitReached, setDataLimitReached] = React.useState(false);

  // --- P1: Imperative refresh API ---
  React.useImperativeHandle(ref, () => ({
    refresh: () => setRefreshKey(k => k + 1),
  }), []);

  // --- P2: Auto-subscribe to DataSource mutation events ---
  // When an external refreshTrigger is provided, rely on that instead of
  // subscribing to dataSource mutations to avoid double refreshes.
  React.useEffect(() => {
    if (!dataSource?.onMutation || !schema.objectName || schema.refreshTrigger) return;
    const unsub = dataSource.onMutation((event: any) => {
      if (event.resource === schema.objectName) {
        setRefreshKey(k => k + 1);
      }
    });
    return unsub;
  }, [dataSource, schema.objectName, schema.refreshTrigger]);

  // Dynamic page size state (wired from pageSizeOptions selector)
  const [dynamicPageSize, setDynamicPageSize] = React.useState<number | undefined>(undefined);
  const effectivePageSize = dynamicPageSize ?? schema.pagination?.pageSize ?? 100;

  // Grouping state (initialized from schema, user can add/remove via popover).
  // Supports three input shapes from the schema:
  //   1. Spec-compliant `grouping: { fields: [...] }` (preferred — supports
  //      arbitrary nesting depth).
  //   2. Shorthand `groupBy: 'fieldname'` written by the view config UI for
  //      the primary group.
  //   3. Optional `groupBy2: 'fieldname'` for a secondary (nested) group,
  //      enabling Airtable-style two-level grouping from the visual editor.
  // Any combination of (2) + (3) is normalized into a multi-level
  // GroupingConfig so the renderer honors grouping configured visually.
  const initialGroupingConfig = React.useMemo(() => {
    if (schema.grouping?.fields?.length) return schema.grouping;
    const primary = typeof schema.groupBy === 'string' ? schema.groupBy.trim() : '';
    const secondary = typeof schema.groupBy2 === 'string' ? schema.groupBy2.trim() : '';
    const fields: Array<{ field: string; order: 'asc'; collapsed: boolean }> = [];
    if (primary) fields.push({ field: primary, order: 'asc', collapsed: false });
    if (secondary && secondary !== primary) {
      fields.push({ field: secondary, order: 'asc', collapsed: false });
    }
    return fields.length > 0 ? { fields } : undefined;
  }, [schema.grouping, schema.groupBy, schema.groupBy2]);
  const [groupingConfig, setGroupingConfig] = React.useState(initialGroupingConfig);
  const [showGroupPopover, setShowGroupPopover] = React.useState(false);

  // Re-sync grouping when the underlying schema-driven config changes (e.g. the
  // user edits `groupBy` in the view designer). User-driven changes via the
  // popover keep the latest interaction since this only fires on schema deltas.
  const lastSchemaGroupingRef = React.useRef(initialGroupingConfig);
  React.useEffect(() => {
    if (lastSchemaGroupingRef.current !== initialGroupingConfig) {
      lastSchemaGroupingRef.current = initialGroupingConfig;
      setGroupingConfig(initialGroupingConfig);
    }
  }, [initialGroupingConfig]);

  // Row color state (initialized from schema, user can configure via popover)
  const [rowColorConfig, setRowColorConfig] = React.useState(schema.rowColor);
  const [showColorPopover, setShowColorPopover] = React.useState(false);

  // Bulk action state
  const [selectedRows, setSelectedRows] = React.useState<any[]>([]);

  // Request counter for debounce — only the latest request writes data
  const fetchRequestIdRef = React.useRef(0);

  // Quick Filters State
  const [activeQuickFilters, setActiveQuickFilters] = React.useState<Set<string>>(() => {
    const defaults = new Set<string>();
    schema.quickFilters?.forEach((qf: any) => {
      const normalized = normalizeQuickFilter(qf);
      if (normalized.defaultActive) defaults.add(normalized.id);
    });
    return defaults;
  });

  // User Filters State (Airtable Interfaces-style)
  const [userFilterConditions, setUserFilterConditions] = React.useState<any[]>([]);

  // Auto-derive userFilters from objectDef when not explicitly configured
  const resolvedUserFilters = React.useMemo<ListViewSchema['userFilters'] | undefined>(() => {
    // If explicitly configured, use as-is
    if (schema.userFilters) return schema.userFilters;

    // Auto-derive from objectDef for select/multi-select/boolean fields
    if (!objectDef?.fields) return undefined;

    const FILTERABLE_FIELD_TYPES = new Set(['select', 'multi-select', 'boolean']);
    const derivedFields: NonNullable<NonNullable<ListViewSchema['userFilters']>['fields']> = [];

    const fieldsEntries: Array<[string, any]> = Array.isArray(objectDef.fields)
      ? objectDef.fields.map((f: any) => [f.name, f])
      : Object.entries(objectDef.fields);

    for (const [key, field] of fieldsEntries) {
      // Include fields with a filterable type, or fields that have options without an explicit type
      if (FILTERABLE_FIELD_TYPES.has(field.type) || (field.options && !field.type)) {
        derivedFields.push({
          field: key,
          label: tFieldLabel(key, field.label || key),
          type: field.type === 'boolean' ? 'boolean' : field.type === 'multi-select' ? 'multi-select' : 'select',
        });
      }
    }

    if (derivedFields.length === 0) return undefined;

    return { element: 'dropdown', fields: derivedFields };
  }, [schema.userFilters, objectDef]);

  // Hidden Fields State (initialized from schema)
  const [hiddenFields, setHiddenFields] = React.useState<Set<string>>(
    () => new Set(schema.hiddenFields || [])
  );
  // Sync when parent schema changes (e.g. switching between views, reload
  // pulls a saved override). Wrapped in JSON to avoid Set identity churn.
  const schemaHiddenKey = React.useMemo(
    () => JSON.stringify(schema.hiddenFields || []),
    [schema.hiddenFields]
  );
  React.useEffect(() => {
    setHiddenFields(new Set(schema.hiddenFields || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaHiddenKey]);

  // Setter that also notifies parent for persistence (debounced upstream).
  const updateHiddenFields = React.useCallback(
    (next: Set<string>) => {
      setHiddenFields(next);
      onHiddenFieldsChange?.(Array.from(next));
    },
    [onHiddenFieldsChange]
  );
  const [showHideFields, setShowHideFields] = React.useState(false);

  // Export State
  const [showExport, setShowExport] = React.useState(false);

  // Normalize quickFilters: support both ObjectUI format { id, label, filters[] }
  // and spec format { field, operator, value }. Spec items are auto-converted.
  const normalizedQuickFilters = React.useMemo(
    () => normalizeQuickFilters(schema.quickFilters),
    [schema.quickFilters],
  );

  // Normalize exportOptions: support both ObjectUI object format and spec string[] format
  const resolvedExportOptions = React.useMemo(() => {
    if (!schema.exportOptions) return undefined;
    // Spec format: simple string[] like ['csv', 'xlsx']
    if (Array.isArray(schema.exportOptions)) {
      return { formats: schema.exportOptions as Array<'csv' | 'xlsx' | 'json' | 'pdf'> };
    }
    // ObjectUI format: already an object
    return schema.exportOptions;
  }, [schema.exportOptions]);

  // Density Mode — rowHeight maps to density if densityMode not explicitly set
  const resolvedDensity = React.useMemo(() => {
    if (schema.densityMode) return schema.densityMode;
    if (schema.rowHeight) {
      const map: Record<string, 'compact' | 'comfortable' | 'spacious'> = {
        compact: 'compact',
        short: 'compact',
        medium: 'comfortable',
        tall: 'spacious',
        extra_tall: 'spacious',
      };
      return map[schema.rowHeight] || 'comfortable';
    }
    return 'compact';
  }, [schema.densityMode, schema.rowHeight]);
  const density = useDensityMode(resolvedDensity, {
    onChange: schema.onDensityChange,
  });

  const handlePullRefresh = React.useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handlePullRefresh,
    enabled: !!dataSource && !!schema.objectName,
  });

  const storageKey = React.useMemo(() => {
    return schema.id 
      ? `listview-${schema.objectName}-${schema.id}-view`
      : `listview-${schema.objectName}-view`;
  }, [schema.objectName, schema.id]);

  // Fetch object definition
  React.useEffect(() => {
    let isMounted = true;
    // Reset loaded flag so data fetch waits for the new schema
    setObjectDefLoaded(false);
    setObjectDef(null);
    const fetchObjectDef = async () => {
      if (!dataSource || !schema.objectName) {
        setObjectDefLoaded(true);
        return;
      }
      if (typeof dataSource.getObjectSchema !== 'function') {
        setObjectDefLoaded(true);
        return;
      }
      try {
        const def = await dataSource.getObjectSchema(schema.objectName);
        if (isMounted) {
          setObjectDef(def);
        }
      } catch (err) {
        console.warn("Failed to fetch object schema for ListView:", err);
      } finally {
        if (isMounted) {
          setObjectDefLoaded(true);
        }
      }
    };
    fetchObjectDef();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  // Auto-compute $expand fields from objectDef (lookup / master_detail)
  const expandFields = React.useMemo(
    () => buildExpandFields(objectDef?.fields, schema.fields),
    [objectDef?.fields, schema.fields],
  );

  // Fetch data effect — supports schema.data (ViewDataSchema) provider modes
  React.useEffect(() => {
    let isMounted = true;
    const requestId = ++fetchRequestIdRef.current;

    // Check for inline data via schema.data provider: 'value'
    if (schema.data && typeof schema.data === 'object' && !Array.isArray(schema.data)) {
      const dataConfig = schema.data as any;
      if (dataConfig.provider === 'value' && Array.isArray(dataConfig.items)) {
        let items = dataConfig.items;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          items = items.filter((row: any) =>
            Object.values(row).some(
              (v) => v != null && String(v).toLowerCase().includes(q),
            ),
          );
        }
        setData(items);
        setLoading(false);
        setDataLimitReached(false);
        return;
      }
    }
    // Also support schema.data as a plain array (shorthand for value provider)
    if (Array.isArray(schema.data)) {
      let items = schema.data as any[];
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        items = items.filter((row: any) =>
          Object.values(row).some(
            (v) => v != null && String(v).toLowerCase().includes(q),
          ),
        );
      }
      setData(items);
      setLoading(false);
      setDataLimitReached(false);
      return;
    }

    // Wait for objectDef to load before fetching data so that $expand is computed
    if (!objectDefLoaded) return;
    
    const fetchData = async () => {
      if (!dataSource || !schema.objectName) return;
      
      setLoading(true);
      try {
        // Construct filter
        let finalFilter: any = [];
        const baseFilter = schema.filters || [];
        const userFilter = convertFilterGroupToAST(currentFilters);
        
        // Collect active quick filter conditions
        const quickFilterConditions: any[] = [];
        if (normalizedQuickFilters && activeQuickFilters.size > 0) {
          normalizedQuickFilters.forEach((qf: any) => {
            if (activeQuickFilters.has(qf.id) && qf.filters && qf.filters.length > 0) {
              quickFilterConditions.push(qf.filters);
            }
          });
        }
        
        // Normalize userFilter conditions (convert `in` to `or` of `=`)
        const normalizedUserFilterConditions = normalizeFilters(userFilterConditions);

        // Merge all filter sources with consistent structure
        const allFilters = [
          ...(baseFilter.length > 0 ? [baseFilter] : []),
          ...(userFilter.length > 0 ? [userFilter] : []),
          ...quickFilterConditions,
          ...normalizedUserFilterConditions,
        ].filter(f => Array.isArray(f) && f.length > 0);
        
        if (allFilters.length > 1) {
          finalFilter = ['and', ...allFilters];
        } else if (allFilters.length === 1) {
          finalFilter = allFilters[0];
        }
        
        // Convert sort to query format
        // Use array format to ensure order is preserved (Object keys are not guaranteed ordered)
        const sort: any = currentSort.length > 0
          ? currentSort
              .filter(item => item.field) // Ensure field is selected
              .map(item => ({ field: item.field, order: item.order }))
          : undefined;

        // Build a $select projection from the columns the listview actually
        // shows (plus required relational keys). This trims server payload
        // significantly for wide objects.
        const selectFields = (() => {
          const cols = Array.isArray(schema.fields)
            ? (schema.fields as any[])
                .map(f => (typeof f === 'string' ? f : f?.field))
                .filter((v): v is string => typeof v === 'string' && v.length > 0)
            : [];
          if (cols.length === 0) return undefined;
          // Don't speculatively add `_id` / `name` — some backends reject
          // unknown select keys with an empty result set rather than
          // ignoring them. Stick to the user-requested columns plus the
          // expanded relation roots (which we know are valid because
          // buildExpandFields() derived them from the object schema).
          const required = new Set<string>(['id']);
          for (const c of cols) required.add(c);
          for (const e of expandFields) required.add(e);

          // View-specific runtime fields. Each non-grid view binds to one
          // or more record fields (groupBy for kanban, dates for calendar/
          // timeline/gantt, image/title for gallery). Without these in the
          // projection the view renders correctly-shaped records but with
          // blank values — e.g. a kanban grouped by `industry` puts every
          // card into the implicit "no value" column.
          const collectViewFields = (v: any) => {
            if (!v) return;
            const candidates = [
              v.groupField, v.groupBy,
              v.titleField, v.cardTitle,
              v.startDateField, v.endDateField, v.dateField, v.endField,
              v.colorField, v.allDayField,
              v.coverField, v.imageField, v.subtitleField,
              v.swimlaneField, v.valueField,
              ...(Array.isArray(v.cardFields) ? v.cardFields : []),
              ...(Array.isArray(v.visibleFields) ? v.visibleFields : []),
            ];
            for (const f of candidates) {
              if (typeof f === 'string' && f) required.add(f);
            }
          };
          collectViewFields(schema.kanban);
          collectViewFields(schema.options?.kanban);
          collectViewFields(schema.calendar);
          collectViewFields(schema.options?.calendar);
          collectViewFields(schema.gallery);
          collectViewFields(schema.options?.gallery);
          collectViewFields(schema.timeline);
          collectViewFields(schema.options?.timeline);
          collectViewFields(schema.gantt);
          collectViewFields(schema.options?.gantt);

          return Array.from(required);
        })();

        // Only send $filter when it is a non-empty AST. Sending an empty
        // array results in `?filter=%5B%5D` which is wasted bandwidth and
        // can defeat server-side query parsing/caching.
        const hasFilter = Array.isArray(finalFilter)
          ? finalFilter.length > 0
          : !!finalFilter && Object.keys(finalFilter).length > 0;

        const results = await dataSource.find(schema.objectName, {
           ...(hasFilter ? { $filter: finalFilter } : {}),
           $orderby: sort,
           $top: effectivePageSize,
           ...(selectFields ? { $select: selectFields } : {}),
           ...(expandFields.length > 0 ? { $expand: expandFields } : {}),
           ...(searchTerm ? {
             $search: searchTerm,
             ...(schema.searchableFields && schema.searchableFields.length > 0
               ? { $searchFields: schema.searchableFields }
               : {}),
           } : {}),
        });

        // Stale request guard: only apply the latest request's results
        if (!isMounted || requestId !== fetchRequestIdRef.current) return;
        
        let items: any[] = [];
        if (Array.isArray(results)) {
            items = results;
        } else if (results && typeof results === 'object') {
           if (Array.isArray((results as any).data)) {
              items = (results as any).data; 
           } else if (Array.isArray((results as any).records)) {
              items = (results as any).records;
           } else if (Array.isArray((results as any).value)) {
              items = (results as any).value;
           }
        }
        
        setData(items);
        setDataLimitReached(items.length >= effectivePageSize);
      } catch (err) {
        // Only log errors from the latest request
        if (requestId === fetchRequestIdRef.current) {
          console.error("ListView data fetch error:", err);
        }
      } finally {
        if (isMounted && requestId === fetchRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => { isMounted = false; };
  }, [schema.objectName, schema.data, dataSource, schema.filters, effectivePageSize, currentSort, currentFilters, activeQuickFilters, normalizedQuickFilters, userFilterConditions, refreshKey, searchTerm, schema.searchableFields, expandFields, objectDefLoaded, schema.refreshTrigger]); // Re-fetch on filter/sort/search/refreshTrigger change

  // Available view types based on schema configuration
  const availableViews = React.useMemo(() => {
    // If appearance.allowedVisualizations is set, use it as whitelist
    if (schema.appearance?.allowedVisualizations && schema.appearance.allowedVisualizations.length > 0) {
      return schema.appearance.allowedVisualizations.filter((v: any) =>
        ['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'map'].includes(v)
      ) as ViewType[];
    }

    const views: ViewType[] = ['grid'];
    
    // Check for Kanban capabilities (spec config takes precedence)
    if (schema.kanban?.groupField || schema.options?.kanban?.groupField) {
      views.push('kanban');
    }

    // Check for Gallery capabilities (spec config takes precedence)
    if (schema.gallery?.coverField || schema.gallery?.imageField || schema.options?.gallery?.imageField) {
      views.push('gallery');
    }
    
    // Check for Calendar capabilities (spec config takes precedence)
    if (schema.calendar?.startDateField || schema.options?.calendar?.startDateField) {
      views.push('calendar');
    }
    
    // Check for Timeline capabilities (spec config takes precedence)
    if (schema.timeline?.startDateField || schema.options?.timeline?.startDateField || schema.options?.timeline?.dateField || schema.options?.calendar?.startDateField) {
      views.push('timeline');
    }
    
    // Check for Gantt capabilities (spec config takes precedence)
    if (schema.gantt?.startDateField || schema.options?.gantt?.startDateField) {
      views.push('gantt');
    }
    
    // Check for Map capabilities
    if (schema.options?.map?.locationField || (schema.options?.map?.latitudeField && schema.options?.map?.longitudeField)) {
      views.push('map');
    }
    
    // Always allow switching back to the viewType defined in schema if it's one of the supported types
    if (schema.viewType && !views.includes(schema.viewType as ViewType) && 
       ['grid', 'kanban', 'calendar', 'timeline', 'gantt', 'map', 'gallery'].includes(schema.viewType)) {
      views.push(schema.viewType as ViewType);
    }
    
    return views;
  }, [schema.options, schema.viewType, schema.kanban, schema.calendar, schema.gantt, schema.gallery, schema.timeline, schema.appearance?.allowedVisualizations]);

  // Sync view from props
  React.useEffect(() => {
     if (schema.viewType) {
        setCurrentView(schema.viewType as ViewType);
     }
  }, [schema.viewType]);

  // Load saved view preference (DISABLED: interfering with schema-defined views)
  /*
  React.useEffect(() => {
    try {
      const savedView = localStorage.getItem(storageKey);
      if (savedView && ['grid', 'kanban', 'calendar', 'timeline', 'gantt', 'map', 'gallery'].includes(savedView) && availableViews.includes(savedView as ViewType)) {
        setCurrentView(savedView as ViewType);
      }
    } catch (error) {
      console.warn('Failed to load view preference from localStorage:', error);
    }
  }, [storageKey, availableViews]);
  */

  const handleViewChange = React.useCallback((view: ViewType) => {
    setCurrentView(view);
    try {
      localStorage.setItem(storageKey, view);
    } catch (error) {
      console.warn('Failed to save view preference to localStorage:', error);
    }
    onViewChange?.(view);
  }, [storageKey, onViewChange]);

  const handleSearchChange = React.useCallback((value: string) => {
    setSearchTerm(value);
    onSearchChange?.(value);
  }, [onSearchChange]);

  // --- NavigationConfig support ---
  const navigation = useNavigationOverlay({
    navigation: schema.navigation,
    objectName: schema.objectName,
    onNavigate: schema.onNavigate,
    onRowClick,
  });

  // Apply hiddenFields and fieldOrder to produce effective fields
  const effectiveFields = React.useMemo(() => {
    let fields = schema.fields || [];

    // Defensive: ensure fields is an array of strings/objects
    if (!Array.isArray(fields)) {
      fields = [];
    }
    
    // Remove hidden fields
    if (hiddenFields.size > 0) {
      fields = fields.filter((f: any) => {
        const fieldName = typeof f === 'string' ? f : (f?.name || f?.fieldName || f?.field);
        return fieldName != null && !hiddenFields.has(fieldName);
      });
    }
    
    // Apply field order
    if (schema.fieldOrder && schema.fieldOrder.length > 0) {
      const orderMap = new Map<string, number>(schema.fieldOrder.map((f: any, i: number) => [f as string, i]));
      fields = [...fields].sort((a: any, b: any) => {
        const nameA = typeof a === 'string' ? a : (a?.name || a?.fieldName || a?.field);
        const nameB = typeof b === 'string' ? b : (b?.name || b?.fieldName || b?.field);
        const orderA: number = orderMap.get(nameA) ?? Infinity;
        const orderB: number = orderMap.get(nameB) ?? Infinity;
        return orderA - orderB;
      });
    }
    
    return fields;
  }, [schema.fields, hiddenFields, schema.fieldOrder]);

  // Generate the appropriate view component schema
  const viewComponentSchema = React.useMemo(() => {
    const densityRowHeight = density.mode === 'compact'
      ? 'compact'
      : density.mode === 'spacious'
        ? 'tall'
        : 'medium';
    const baseProps = {
      objectName: schema.objectName,
      fields: effectiveFields,
      filters: schema.filters,
      sort: currentSort,
      className: "h-full w-full",
      // Disable internal controls that clash with ListView toolbar
      showSearch: false,
      // Pass navigation click handler to child views
      onRowClick: navigation.handleClick,
      // Forward density to child views (overrides schema.rowHeight at runtime)
      rowHeight: densityRowHeight,
      // Suppress child grid's own row-height toggle since ListView toolbar controls it
      hideRowHeightToggle: true,
      // Forward display properties to child views
      ...(schema.striped != null ? { striped: schema.striped } : {}),
      ...(schema.bordered != null ? { bordered: schema.bordered } : {}),
      // Forward column-state callback (resize/reorder) so a parent can
      // persist user adjustments alongside the view definition.
      ...(onColumnStateChange ? { onColumnStateChange } : {}),
      // Hydrate child grid with previously persisted column state.
      ...(schema.columnState ? { columnState: schema.columnState } : {}),
    };

    switch (currentView) {
      case 'grid':
        return {
          type: 'object-grid',
          ...baseProps,
          columns: effectiveFields,
          ...(schema.conditionalFormatting ? { conditionalFormatting: schema.conditionalFormatting } : {}),
          ...(schema.inlineEdit != null ? { editable: schema.inlineEdit } : {}),
          ...(schema.wrapHeaders != null ? { wrapHeaders: schema.wrapHeaders } : {}),
          ...(schema.virtualScroll != null ? { virtualScroll: schema.virtualScroll } : {}),
          ...(schema.resizable != null ? { resizable: schema.resizable } : {}),
          ...(schema.selection ? { selection: schema.selection } : {}),
          ...(schema.pagination ? { pagination: schema.pagination } : {}),
          ...(groupingConfig ? { grouping: groupingConfig } : {}),
          ...(rowColorConfig ? { rowColor: rowColorConfig } : {}),
          ...(schema.rowActions ? { rowActions: schema.rowActions } : {}),
          ...(schema.bulkActions ? { batchActions: schema.bulkActions } : {}),
          ...(schema.options?.grid || {}),
        };
      case 'kanban':
        return {
          type: 'object-kanban',
          ...baseProps,
          groupBy: schema.kanban?.groupField || schema.options?.kanban?.groupField || 'status',
          groupField: schema.kanban?.groupField || schema.options?.kanban?.groupField || 'status',
          ...(schema.kanban?.titleField || schema.options?.kanban?.titleField
            ? { titleField: schema.kanban?.titleField || schema.options?.kanban?.titleField }
            : {}),
          cardFields: schema.kanban?.cardFields || effectiveFields || [],
          ...(groupingConfig ? { grouping: groupingConfig } : {}),
          ...(schema.options?.kanban || {}),
          ...(schema.kanban || {}),
        };
      case 'calendar':
        return {
          type: 'object-calendar',
          ...baseProps,
          startDateField: schema.calendar?.startDateField || schema.options?.calendar?.startDateField || 'start_date',
          endDateField: schema.calendar?.endDateField || schema.options?.calendar?.endDateField || 'end_date',
          ...(schema.calendar?.titleField || schema.options?.calendar?.titleField
            ? { titleField: schema.calendar?.titleField || schema.options?.calendar?.titleField }
            : {}),
          ...(schema.calendar?.defaultView ? { defaultView: schema.calendar.defaultView } : {}),
          ...(schema.options?.calendar || {}),
          ...(schema.calendar || {}),
        };
      case 'gallery': {
        // Merge spec config over legacy options into nested gallery prop
        const mergedGallery = {
          ...(schema.options?.gallery || {}),
          ...(schema.gallery || {}),
        };
        return {
          type: 'object-gallery',
          ...baseProps,
          // Nested gallery config (spec-compliant, used by ObjectGallery)
          gallery: Object.keys(mergedGallery).length > 0 ? mergedGallery : undefined,
          // Deprecated top-level props for backward compat
          imageField: schema.gallery?.coverField || schema.gallery?.imageField || schema.options?.gallery?.imageField,
          titleField: schema.gallery?.titleField || schema.options?.gallery?.titleField || 'name',
          subtitleField: schema.gallery?.subtitleField || schema.options?.gallery?.subtitleField,
          ...(groupingConfig ? { grouping: groupingConfig } : {}),
        };
      }
      case 'timeline': {
        // Merge spec config over legacy options into nested timeline prop
        const mergedTimeline = {
          ...(schema.options?.timeline || {}),
          ...(schema.timeline || {}),
        };
        return {
          type: 'object-timeline',
          ...baseProps,
          // Nested timeline config (spec-compliant, used by ObjectTimeline)
          timeline: Object.keys(mergedTimeline).length > 0 ? mergedTimeline : undefined,
          // Deprecated top-level props for backward compat
          startDateField: schema.timeline?.startDateField || schema.options?.timeline?.startDateField || schema.options?.timeline?.dateField || 'created_at',
          titleField: schema.timeline?.titleField || schema.options?.timeline?.titleField || 'name',
          ...(schema.timeline?.endDateField ? { endDateField: schema.timeline.endDateField } : {}),
          ...(schema.timeline?.groupByField ? { groupByField: schema.timeline.groupByField } : {}),
          ...(schema.timeline?.colorField ? { colorField: schema.timeline.colorField } : {}),
          ...(schema.timeline?.scale ? { scale: schema.timeline.scale } : {}),
        };
      }
      case 'gantt':
        return {
          type: 'object-gantt',
          ...baseProps,
          startDateField: schema.gantt?.startDateField || schema.options?.gantt?.startDateField || 'start_date',
          endDateField: schema.gantt?.endDateField || schema.options?.gantt?.endDateField || 'end_date',
          progressField: schema.gantt?.progressField || schema.options?.gantt?.progressField || 'progress',
          dependenciesField: schema.gantt?.dependenciesField || schema.options?.gantt?.dependenciesField || 'dependencies',
          ...(schema.gantt?.titleField ? { titleField: schema.gantt.titleField } : {}),
          ...(schema.options?.gantt || {}),
          ...(schema.gantt || {}),
        };
      case 'map':
        return {
          type: 'object-map',
          ...baseProps,
          locationField: schema.options?.map?.locationField || 'location',
          ...(schema.options?.map || {}),
        };
      default:
        return baseProps;
    }
  }, [currentView, schema, currentSort, effectiveFields, groupingConfig, rowColorConfig, navigation.handleClick, density.mode]);

  const hasFilters = currentFilters.conditions && currentFilters.conditions.length > 0;

  const filterFields = React.useMemo(() => {
    let fields: Array<{ value: string; label: string; type: string; options?: any; referenceTo?: string; displayField?: string; idField?: string }>;

    // Translate select-field option labels through the i18n resolver.
    // fieldDef.options may be an array of { value, label } or a keyed object;
    // we normalize to array form so FilterBuilder's value-pickers show
    // localized option labels (e.g. 网站 instead of "Web").
    const buildOptions = (key: string, raw: any): any[] | undefined => {
      if (!raw) return undefined;
      const arr: Array<{ value: any; label: string; [k: string]: any }> = Array.isArray(raw)
        ? raw.map((o: any) => ({
            value: o?.value ?? o,
            label: o?.label ?? String(o?.value ?? o),
            ...(o && typeof o === 'object' ? o : {}),
          }))
        : Object.entries(raw as Record<string, any>).map(([value, meta]) => ({
            value,
            label: (meta as any)?.label || value,
            ...(meta as any),
          }));
      return schema.objectName ? translateOptions(schema.objectName, key, arr) : arr;
    };

    if (!objectDef?.fields) {
        // Fallback to schema fields if objectDef not loaded yet
        fields = (schema.fields || []).map((f: any) => {
           if (typeof f === 'string') return { value: f, label: f, type: 'text' };
           const fieldName = f.name || f.fieldName;
           return {
              value: fieldName,
              label: tFieldLabel(fieldName, f.label || f.name),
              type: f.type || 'text',
              options: buildOptions(fieldName, f.options),
              referenceTo: f.reference_to || f.reference,
              displayField: f.display_field || f.reference_field,
              idField: f.id_field,
           };
        });
    } else {
        fields = Object.entries(objectDef.fields).map(([key, field]: [string, any]) => ({
            value: key,
            label: tFieldLabel(key, field.label || key),
            type: field.type || 'text',
            options: buildOptions(key, field.options),
            referenceTo: field.reference_to || field.reference,
            displayField: field.display_field || field.reference_field,
            idField: field.id_field,
        }));
    }

    // Apply filterableFields whitelist restriction
    if (schema.filterableFields && schema.filterableFields.length > 0) {
      const allowed = new Set(schema.filterableFields);
      fields = fields.filter(f => allowed.has(f.value));
    }

    return fields;
  }, [objectDef, schema.fields, schema.filterableFields, schema.objectName, tFieldLabel, translateOptions]);

  // Quick filter toggle handler
  const toggleQuickFilter = React.useCallback((id: string) => {
    setActiveQuickFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Export handler
  const handleExport = React.useCallback((format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    const exportConfig = resolvedExportOptions;
    const maxRecords = exportConfig?.maxRecords || 0;
    const includeHeaders = exportConfig?.includeHeaders !== false;
    const prefix = exportConfig?.fileNamePrefix || schema.objectName || 'export';
    const exportData = maxRecords > 0 ? data.slice(0, maxRecords) : data;

    if (format === 'csv') {
      const fields = effectiveFields.map((f: any) => typeof f === 'string' ? f : (f.name || f.fieldName || f.field));
      const rows: string[] = [];
      if (includeHeaders) {
        rows.push(fields.join(','));
      }
      exportData.forEach(record => {
        rows.push(fields.map((f: string) => {
          const val = record[f];
          // Type-safe serialization: handle arrays, objects, null/undefined
          let str: string;
          if (val == null) {
            str = '';
          } else if (Array.isArray(val)) {
            str = val.map(v =>
              (v != null && typeof v === 'object') ? JSON.stringify(v) : String(v ?? ''),
            ).join('; ');
          } else if (typeof val === 'object') {
            str = JSON.stringify(val);
          } else {
            str = String(val);
          }
          // Escape CSV special characters
          const needsQuoting = str.includes(',') || str.includes('"')
            || str.includes('\n') || str.includes('\r');
          return needsQuoting ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
      });
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setShowExport(false);
  }, [data, effectiveFields, resolvedExportOptions, schema.objectName]);

  // All available fields for hide/show (with i18n)
  const allFields = React.useMemo(() => {
    return (schema.fields || []).map((f: any) => {
      if (typeof f === 'string') {
        return { name: f, label: tFieldLabel(f, f) };
      }
      const name = f.name || f.fieldName || f.field;
      const rawLabel = f.label || f.name || f.field;
      return { name, label: tFieldLabel(name, rawLabel) };
    });
  }, [schema.fields, tFieldLabel]);

  return (
    <div
      ref={pullRef}
      className={cn('flex flex-col h-full bg-background relative min-w-0 overflow-hidden', className)}
      {...(schema.aria?.label ? { 'aria-label': schema.aria.label } : {})}
      {...(schema.aria?.describedBy ? { 'aria-describedby': schema.aria.describedBy } : {})}
      {...(schema.aria?.live ? { 'aria-live': schema.aria.live } : {})}
      role="region"
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? t('list.refreshing') : t('list.pullToRefresh')}
        </div>
      )}
      {/* Airtable-style Toolbar — Row 1: View tabs */}
      {showViewSwitcher && (
        <div className="border-b px-4 py-1 flex items-center bg-background">
          <ViewSwitcher
            currentView={currentView}
            availableViews={availableViews}
            onViewChange={handleViewChange}
          />
        </div>
      )}

      {/* View Tabs */}
      {schema.tabs && schema.tabs.length > 0 && (
        <TabBar
          tabs={schema.tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      {/* View Description */}
      {schema.description && (schema.appearance?.showDescription !== false) && (
        <div className="border-b px-4 py-1.5 text-xs text-muted-foreground bg-background" data-testid="view-description">
          {typeof schema.description === 'string' ? schema.description : ''}
        </div>
      )}

      {/* Airtable-style Toolbar — UserFilter badges (left) + Tool buttons (right) */}
      <div className="border-b px-2 sm:px-4 py-1 flex items-center justify-between gap-1 sm:gap-2 bg-background">
        <div className="flex items-center gap-0.5 overflow-x-auto min-w-0">
          {/* User Filters — inline in toolbar (Airtable Interfaces-style) */}
          {resolvedUserFilters && (
              <div className="shrink-0 min-w-0" data-testid="user-filters">
                <UserFilters
                  config={resolvedUserFilters}
                  objectDef={objectDef}
                  data={data}
                  onFilterChange={setUserFilterConditions}
                  maxVisible={3}
                />
              </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Hide Fields */}
          {toolbarFlags.showHideFields && (
          <Popover open={showHideFields} onOpenChange={setShowHideFields}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  hiddenFields.size > 0 && "text-primary"
                )}
              >
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.hideFields')}</span>
                {hiddenFields.size > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {hiddenFields.size}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.hideFieldsTitle')}</h4>
                  {hiddenFields.size > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => updateHiddenFields(new Set())}>
                      {t('list.showAll')}
                    </Button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {allFields.map((field: any) => (
                    <label key={field.name} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenFields.has(field.name)}
                        onChange={() => {
                          const next = new Set(hiddenFields);
                          if (next.has(field.name)) {
                            next.delete(field.name);
                          } else {
                            next.add(field.name);
                          }
                          updateHiddenFields(next);
                        }}
                        className="rounded border-input"
                      />
                      <span className="truncate">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* --- Separator: Hide Fields | Data Manipulation --- */}
          {toolbarFlags.showHideFields && (toolbarFlags.showFilters || toolbarFlags.showSort || toolbarFlags.showGroup) && (
            <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />
          )}

          {/* Filter — universal advanced filter builder.
              Always shown when enabled. The left-side quick-filter chips
              (resolvedUserFilters) are predefined named filters; the
              right-side Popover is a free-form field-by-field builder that
              can express filters the chips cannot. They serve different
              purposes and must coexist. */}
          {toolbarFlags.showFilters && (
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  hasFilters && "bg-primary/10 border border-primary/20 text-primary"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.filter')}</span>
                {hasFilters && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {currentFilters.conditions?.length || 0}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[calc(100vw-2rem)] sm:w-[600px] max-w-[600px] p-3 sm:p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.filterRecords')}</h4>
                </div>
                <FilterBuilder
                  fields={filterFields}
                  value={currentFilters}
                  onChange={(newFilters) => {
                    setCurrentFilters(newFilters);
                    if (onFilterChange) onFilterChange(newFilters);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* Group */}
          {toolbarFlags.showGroup && (
          <Popover open={showGroupPopover} onOpenChange={setShowGroupPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  groupingConfig && "bg-primary/10 border border-primary/20 text-primary"
                )}
              >
                <Group className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.group')}</span>
                {groupingConfig && groupingConfig.fields?.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {groupingConfig.fields.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.groupBy')}</h4>
                  {groupingConfig && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setGroupingConfig(undefined)} data-testid="clear-grouping">
                      {t('list.clear')}
                    </Button>
                  )}
                </div>
                <div data-testid="group-field-list">
                  <GroupingEditor
                    value={groupingConfig as any}
                    fieldOptions={allFields.map((f: any) => ({ value: f.name, label: f.label || f.name }))}
                    maxLevels={3}
                    labels={{
                      addGroup: t('list.addGroup', 'Add group field'),
                      collapseTitle: t('list.collapsedByDefault', 'Collapsed by default'),
                      removeTitle: t('list.removeGroup', 'Remove'),
                    }}
                    onChange={(next) => setGroupingConfig(next as any)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* Sort */}
          {toolbarFlags.showSort && (
          <Popover open={showSort} onOpenChange={setShowSort}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  currentSort.length > 0 && "bg-primary/10 border border-primary/20 text-primary"
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.sort')}</span>
                {currentSort.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {currentSort.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[calc(100vw-2rem)] sm:w-[600px] max-w-[600px] p-3 sm:p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.sortRecords')}</h4>
                </div>
                <SortBuilder
                  fields={filterFields}
                  value={currentSort}
                  onChange={(newSort) => {
                    setCurrentSort(newSort);
                    if (onSortChange) onSortChange(newSort);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* --- Separator: Data Manipulation | Appearance --- */}
          {(toolbarFlags.showFilters || toolbarFlags.showSort || toolbarFlags.showGroup) && (toolbarFlags.showColor || toolbarFlags.showDensity) && (
            <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />
          )}

          {/* Color */}
          {toolbarFlags.showColor && (
          <Popover open={showColorPopover} onOpenChange={setShowColorPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  rowColorConfig && "bg-primary/10 border border-primary/20 text-primary"
                )}
              >
                <Paintbrush className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.color')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-sm">{t('list.rowColor')}</h4>
                  {rowColorConfig && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setRowColorConfig(undefined)} data-testid="clear-row-color">
                      {t('list.clear')}
                    </Button>
                  )}
                </div>
                <div className="space-y-2" data-testid="color-field-list">
                  <label className="text-xs text-muted-foreground">{t('list.colorByField')}</label>
                  <select
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                    value={rowColorConfig?.field || ''}
                    onChange={(e) => {
                      const field = e.target.value;
                      if (!field) {
                        setRowColorConfig(undefined);
                      } else {
                        setRowColorConfig({ field, colors: rowColorConfig?.colors || {} });
                      }
                    }}
                    data-testid="color-field-select"
                  >
                    <option value="">{t('list.none')}</option>
                    {allFields.map((field: any) => (
                      <option key={field.name} value={field.name}>{field.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* Row Height / Density Mode */}
          {toolbarFlags.showDensity && (() => {
            const DensityIcon = density.mode === 'compact' ? Rows4 : density.mode === 'comfortable' ? Rows3 : Rows2;
            return (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Density: ${density.mode}`}
                className={cn(
                  "h-7 w-7 p-0 text-muted-foreground hover:text-primary transition-colors duration-150",
                  density.mode !== 'compact' && "bg-primary/10 border border-primary/20 text-primary"
                )}
                onClick={density.cycle}
                title={`Density: ${density.mode} (click to cycle)`}
              >
                <DensityIcon className="h-3.5 w-3.5" />
              </Button>
            );
          })()}

          {/* --- Separator: Appearance | Export --- */}
          {(toolbarFlags.showColor || toolbarFlags.showDensity) && resolvedExportOptions && schema.allowExport !== false && (
            <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />
          )}

          {/* Export */}
          {resolvedExportOptions && schema.allowExport !== false && (
            <Popover open={showExport} onOpenChange={setShowExport}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">{t('list.export')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-48 p-2">
                <div className="space-y-1">
                  {(resolvedExportOptions.formats || ['csv', 'json']).map((format: any) => (
                    <Button
                      key={format}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-xs"
                      onClick={() => handleExport(format)}
                    >
                      <Download className="h-3.5 w-3.5 mr-2" />
                      {t('list.exportAs', { format: format.toUpperCase() })}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Share — supports both ObjectUI visibility model and spec personal/collaborative model */}
          {(schema.sharing?.enabled || schema.sharing?.type) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
              title={`Sharing: ${schema.sharing?.visibility || schema.sharing?.type || 'private'}`}
              data-testid="share-button"
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.share')}</span>
            </Button>
          )}

          {/* Print */}
          {schema.allowPrinting && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
              onClick={() => window.print()}
              data-testid="print-button"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.print')}</span>
            </Button>
          )}

          {/* --- Separator: Print/Share/Export | Search --- */}
          {(() => {
            const hasLeftSideItems = schema.allowPrinting || (schema.sharing?.enabled || schema.sharing?.type) || (resolvedExportOptions && schema.allowExport !== false);
            return toolbarFlags.showSearch && hasLeftSideItems ? (
              <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />
            ) : null;
          })()}

          {/* Search (icon button + popover) */}
          {toolbarFlags.showSearch && (
            <Popover open={showSearchPopover} onOpenChange={setShowSearchPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                    searchTerm && "bg-primary/10 border border-primary/20 text-primary"
                  )}
                  data-testid="search-icon-button"
                  title={t('list.search')}
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-64 p-2" data-testid="search-popover">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t('list.search') + '...'}
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-7 h-8 text-xs"
                    autoFocus
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-muted-foreground/20"
                      onClick={() => handleSearchChange('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Add Record (top position) */}
          {toolbarFlags.showAddRecord && toolbarFlags.addRecordPosition === 'top' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
              data-testid="add-record-button"
              onClick={() => props.onAddRecord?.()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.addRecord')}</span>
            </Button>
          )}
        </div>
      </div>


      {/* Filters Panel - Removed as it is now in Popover */}

      {/* Quick Filters Row */}
      {normalizedQuickFilters && normalizedQuickFilters.length > 0 && (
        <div className="border-b px-2 sm:px-4 py-1 flex items-center gap-1 flex-wrap bg-background" data-testid="quick-filters">
          {normalizedQuickFilters.map((qf: any) => {
            const isActive = activeQuickFilters.has(qf.id);
            const QfIcon: LucideIcon | null = qf.icon
              ? ((icons as Record<string, LucideIcon>)[
                  qf.icon.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
                ] ?? null)
              : null;
            return (
              <Button
                key={qf.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => toggleQuickFilter(qf.id)}
              >
                {QfIcon && <QfIcon className="h-3 w-3 mr-1.5" />}
                {qf.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* View Content */}
      <div key={currentView} className="flex-1 min-h-0 bg-background relative overflow-hidden animate-in fade-in-0 duration-200">
        {/* Empty state is rendered here ONLY for tabular/list-like views.
            Structural views (kanban/calendar/gallery/gantt/timeline/map) own
            their own empty rendering so their column/lane/grid structure
            stays visible — otherwise users see a generic "No items found"
            on Task Board / Calendar etc. even though the view exists. */}
        {!loading && data.length === 0 && (currentView === 'grid' || currentView === 'list') ? (
          (() => {
            const iconName = schema.emptyState?.icon;
            const ResolvedIcon: LucideIcon = iconName
              ? ((icons as Record<string, LucideIcon>)[
                  iconName.split('-').map((w: any) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
                ] ?? Inbox)
              : Inbox;
            return (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-8" data-testid="empty-state">
                <ResolvedIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  {(typeof schema.emptyState?.title === 'string' ? schema.emptyState.title : undefined) ?? 'No items found'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {(typeof schema.emptyState?.message === 'string' ? schema.emptyState.message : undefined) ?? 'There are no records to display. Try adjusting your filters or adding new data.'}
                </p>
                {toolbarFlags.showAddRecord && (
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-4"
                    data-testid="empty-state-add-record"
                    onClick={() => props.onAddRecord?.()}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('list.addRecord')}
                  </Button>
                )}
              </div>
            );
          })()
        ) : (
          <SchemaRenderer 
            schema={viewComponentSchema} 
            {...props} 
            data={data}
            loading={loading}
            onRowSelect={setSelectedRows}
          />
        )}
      </div>

      {/* Add Record (bottom position) */}
      {toolbarFlags.showAddRecord && toolbarFlags.addRecordPosition === 'bottom' && (
        <div className="border-t px-2 sm:px-4 py-1 bg-background shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150"
            data-testid="add-record-button"
            onClick={() => props.onAddRecord?.()}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">{t('list.addRecord')}</span>
          </Button>
        </div>
      )}

      {/* Bulk Actions Bar — skip for grid view since ObjectGrid renders its own BulkActionBar */}
      {schema.bulkActions && schema.bulkActions.length > 0 && selectedRows.length > 0 && currentView !== 'grid' && (
        <div
          className="border-t border-primary/30 px-4 py-2 flex items-center gap-2 text-xs bg-primary/10 text-foreground shrink-0 shadow-sm"
          role="region"
          aria-label="Bulk actions"
          data-testid="bulk-actions-bar"
        >
          <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium">
            {selectedRows.length} {selectedRows.length === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex items-center gap-1.5 ml-3">
            {schema.bulkActions.map((action: any) => {
              const actionStr = String(action).toLowerCase();
              const isDestructive = actionStr.includes('delete') || actionStr.includes('remove') || actionStr.includes('destroy');
              const Icon = isDestructive ? Trash2 : null;
              return (
                <Button
                  key={action}
                  variant={isDestructive ? 'destructive' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={() => props.onBulkAction?.(action, selectedRows)}
                  data-testid={`bulk-action-${action}`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {formatActionLabel(action)}
                </Button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs ml-auto gap-1"
            onClick={() => setSelectedRows([])}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        </div>
      )}

      {/* Record count status bar (Airtable-style) */}
      {!loading && data.length > 0 && schema.showRecordCount !== false && (
        <div
          className="border-t px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground bg-background shrink-0"
          data-testid="record-count-bar"
        >
          <span className="font-medium text-foreground/80">
            {data.length === 1 ? t('list.recordCountOne', { count: data.length }) : t('list.recordCount', { count: data.length })}
          </span>
          {dataLimitReached && (
            <span className="text-amber-600" data-testid="data-limit-warning">
              {t('list.dataLimitReached', { limit: effectivePageSize })}
            </span>
          )}
          {schema.pagination?.pageSizeOptions && schema.pagination.pageSizeOptions.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span>{t('table.rowsPerPage', { defaultValue: 'Rows per page' })}</span>
              <select
                data-testid="page-size-selector"
                className="h-7 w-[72px] px-2 py-1 text-xs rounded-md border border-input bg-background"
                value={String(effectivePageSize)}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setDynamicPageSize(newSize);
                  if (props.onPageSizeChange) props.onPageSizeChange(newSize);
                }}
              >
                {schema.pagination.pageSizeOptions.map((size: any) => (
                  <option key={size} value={String(size)}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Navigation Overlay (drawer/modal/popover) */}
      {navigation.isOverlay && (
        <NavigationOverlay
          {...navigation}
          title={
            schema.label
              ? `${schema.label} Detail`
              : schema.objectName
                ? `${schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1)} Detail`
                : 'Record Detail'
          }
        >
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
    </div>
  );
});

ListView.displayName = 'ListView';