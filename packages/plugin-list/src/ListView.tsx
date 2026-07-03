/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Input, Popover, PopoverContent, PopoverTrigger, FilterBuilder, SortBuilder, NavigationOverlay, GroupingEditor, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, RefreshIndicator, DataEmptyState } from '@object-ui/components';
import type { SortItem } from '@object-ui/components';
import { Search, SlidersHorizontal, ArrowUpDown, X, EyeOff, Pencil, Group, Paintbrush, Ruler, Inbox, Download, AlignJustify, Rows4, Rows3, Rows2, Share2, Printer, Plus, Trash2, CheckSquare, AlertTriangle, RotateCw, Loader2, icons, type LucideIcon } from 'lucide-react';
import type { FilterGroup } from '@object-ui/components';
import { ViewSwitcherDropdown, ViewType } from './ViewSwitcher';
import { ViewSettingsPopover } from './components/ViewSettingsPopover';
import { UserFilters } from './UserFilters';
import { SchemaRenderer, useNavigationOverlay } from '@object-ui/react';
import { useDensityMode } from '@object-ui/react';
import type { ListViewSchema } from '@object-ui/types';
import { usePullToRefresh } from '@object-ui/mobile';
import { evaluatePlainCondition, buildExpandFields } from '@object-ui/core';
import { useObjectTranslation, useObjectLabel, useSafeFieldLabel } from '@object-ui/i18n';
import { usePermissions } from '@object-ui/permissions';

export interface ListViewProps {
  schema: ListViewSchema;
  className?: string;
  onViewChange?: (view: ViewType) => void;
  onFilterChange?: (filters: any) => void;
  onSortChange?: (sort: any) => void;
  onSearchChange?: (search: string) => void;
  /** Called when the user toggles fields via the Hide Fields popover. */
  onHiddenFieldsChange?: (hidden: string[]) => void;
  /** Called when the user toggles inline record editing in View settings. */
  onInlineEditChange?: (next: boolean) => void;
  /** Called when the user resizes/reorders columns in the underlying grid. */
  onColumnStateChange?: (state: { order?: string[]; widths?: Record<string, number> }) => void;
  /** Callback when a row/item is clicked (overrides NavigationConfig) */
  onRowClick?: (record: Record<string, unknown>) => void;
  /** Show view type switcher (Grid/Kanban/etc). Default: false (view type is fixed) */
  showViewSwitcher?: boolean;
  /** Initial user-filter selections to restore (field → values; `_tab` for the active preset). */
  userFilterSelections?: Record<string, Array<string | number | boolean>>;
  /** Fires with the raw user-filter selections whenever the user changes them. */
  onUserFilterSelectionsChange?: (selections: Record<string, Array<string | number | boolean>>) => void;
  [key: string]: any;
}

// Helper to convert FilterBuilder group to ObjectStack AST.
// Accepts both the FilterBuilder vocabulary (camelCase) and the
// @objectstack/spec ViewFilterRule vocabulary (snake_case).
function mapOperator(op: string) {
  switch (op) {
    case 'equals': case 'eq': return '=';
    case 'notEquals': case 'not_equals': case 'ne': case 'neq': return '!=';
    case 'contains': return 'contains';
    case 'notContains': case 'notcontains': return 'notcontains';
    case 'greaterThan': case 'gt': return '>';
    case 'greaterOrEqual': case 'gte': return '>=';
    case 'lessThan': case 'lt': return '<';
    case 'lessOrEqual': case 'lte': return '<=';
    case 'in': return 'in';
    case 'notIn': case 'not_in': case 'nin': return 'not in';
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
  // First-run (truly empty, no filter/search) vs filtered-to-empty. Showing
  // "adjust your filters" to a brand-new user with nothing to adjust is wrong.
  'list.firstRunTitle': 'Nothing here yet',
  'list.firstRunMessage': 'Create your first record to get started.',
  'list.noMatches': 'No matching records',
  'list.noMatchesMessage': 'No records match your current filters or search. Try adjusting or clearing them.',
  'list.loading': 'Loading records…',
  // Load FAILED (network / server error) — distinct from empty. Offer retry.
  'list.loadErrorTitle': 'Couldn\u2019t load records',
  'list.loadErrorMessage': 'Something went wrong while loading this data. Check your connection and try again.',
  'list.retry': 'Retry',
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
  'grid.toolbar.densityMode': 'Density',
  'grid.toolbar.densityCompact': 'Compact',
  'grid.toolbar.densityComfortable': 'Comfortable',
  'grid.toolbar.densitySpacious': 'Spacious',
  'grid.toolbar.densityCycleHint': '{{label}} (click to cycle)',
  'grid.toolbar.densityCycleShortHint': 'Click to cycle',
  'list.viewSettings': 'View settings',
  'list.viewSettingsHint': 'Grouping, color, density, and visible fields.',
};

// Stable module-level fallback used when no I18nProvider is mounted.
// Reusing the same function reference across renders keeps downstream
// `useCallback`/`useMemo` deps stable (otherwise filterFields and tFieldLabel
// would invalidate every render in the no-provider case).
const FALLBACK_FIELD_LABEL = (_objectName: string, _fieldName: string, fallback: string) => fallback;

const fallbackListT = (key: string, options?: Record<string, unknown>) => {
  let value = LIST_DEFAULT_TRANSLATIONS[key] || key;
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      value = value.replace(`{{${k}}}`, String(v));
    }
  }
  return value;
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
      return { t: fallbackListT };
    }
    return { t: result.t };
  } catch {
    return { t: fallbackListT };
  }
}

/**
 * Safe wrapper for useObjectLabel that falls back to identity when I18nProvider is unavailable.
 */
function useListFieldLabel() {
  try {
    const { fieldLabel, actionLabel } = useObjectLabel();
    return { fieldLabel, actionLabel };
  } catch {
    return { fieldLabel: FALLBACK_FIELD_LABEL, actionLabel: undefined as any };
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
  onInlineEditChange,
  onColumnStateChange,
  onRowClick,
  showViewSwitcher: showViewSwitcherProp,
  userFilterSelections,
  onUserFilterSelectionsChange,
  ...props
}, ref) => {
  // The switcher can be enabled either by the host component (prop) or by
  // the schema itself (ADR-0047 — ObjectView/InterfaceListPage stamp it on
  // the schema when appearance.allowedVisualizations whitelists >1 type).
  const showViewSwitcher = showViewSwitcherProp ?? (propSchema as any)?.showViewSwitcher ?? false;
  // i18n support for record count and other labels
  const { t } = useListViewTranslation();
  const { fieldLabel: resolveFieldLabel, actionLabel: resolveActionLabel } = useListFieldLabel();
  const { translateOptions } = useSafeFieldLabel();

  // Kernel level default: Ensure viewType is always a RENDERABLE kind.
  // Two inputs must land on 'grid': a missing viewType, and the view-metadata
  // kind `'list'` (AI-authored views store `type/viewKind: 'list'`, which hosts
  // forward verbatim) — 'list' names the view CATEGORY, not a renderer, and
  // letting it through used to hit the typeless default branch below and
  // render as a red "Unknown component type" box.
  // Perf: only allocate a new object when normalization is actually needed,
  // otherwise return propSchema as-is so downstream useMemos see a stable
  // reference when callers already provide a renderable viewType (the common case).
  const schema = React.useMemo(
    () =>
      propSchema.viewType && (propSchema.viewType as string) !== 'list'
        ? propSchema
        : { ...propSchema, viewType: 'grid' },
    [propSchema],
  );

  // Convenience: resolve field label with schema.objectName pre-bound
  const tFieldLabel = React.useCallback(
    (fieldName: string, fallback: string) =>
      schema.objectName ? resolveFieldLabel(schema.objectName, fieldName, fallback) : fallback,
    [schema.objectName, resolveFieldLabel],
  );

  // Convenience: resolve action label with schema.objectName pre-bound.
  // Falls back to title-casing the action key when no i18n resource is found,
  // matching the previous local `formatActionLabel` helper.
  const tActionLabel = React.useCallback(
    (actionName: string) => {
      const fallback = formatActionLabel(actionName);
      if (schema.objectName && typeof resolveActionLabel === 'function') {
        return resolveActionLabel(schema.objectName, actionName, fallback);
      }
      return fallback;
    },
    [schema.objectName, resolveActionLabel],
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
      compactToolbar: schema.compactToolbar === true,
      showAddRecord: addRecordEnabled,
      addRecordPosition: (schema.addRecord?.position === 'bottom' ? 'bottom' : 'top') as 'top' | 'bottom',
    };
  }, [schema.userActions, schema.showSearch, schema.showSort, schema.showFilters, schema.showDensity, schema.showHideFields, schema.showGroup, schema.showColor, schema.compactToolbar, schema.addRecord, schema.userActions?.addRecordForm]);

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

  // Data State
  const dataSource = props.dataSource;
  const [data, setData] = React.useState<any[]>([]);
  // Load failure (network / server error) is distinct from "empty": we must
  // not tell a user to "create your first record" when the fetch actually
  // failed. Captured here so the render can show a retryable error panel.
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // Start in loading state when we will fetch from a dataSource so the empty
  // state doesn't flash before the first effect runs. Inline data (schema.data
  // as an array or a `value` provider) starts as not-loading.
  const [loading, setLoading] = React.useState<boolean>(() => {
    if (Array.isArray(schema.data)) return false;
    if (
      schema.data &&
      typeof schema.data === 'object' &&
      (schema.data as any).provider === 'value' &&
      Array.isArray((schema.data as any).items)
    ) {
      return false;
    }
    return true;
  });
  const [objectDef, setObjectDef] = React.useState<any>(null);
  const [objectDefLoaded, setObjectDefLoaded] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [dataLimitReached, setDataLimitReached] = React.useState(false);

  // --- P1: Imperative refresh API ---
  React.useImperativeHandle(ref, () => ({
    refresh: () => setRefreshKey(k => k + 1),
  }), []);

  // --- P2: Auto-subscribe to DataSource mutation events ---
  // Refetch whenever the bound object is mutated through the DataSource. This
  // is the ONLY refresh signal for inline-edit "Save All": ObjectGrid persists
  // those edits by calling dataSource.update() directly, with no form-success
  // handler to bump an external refreshTrigger — so subscribing even when
  // `refreshTrigger` is provided is required, not redundant. Form/delete flows
  // also bump refreshTrigger; the extra refetch that produces is harmless
  // because find() coalesces concurrent identical reads into one round-trip.
  React.useEffect(() => {
    if (!dataSource?.onMutation || !schema.objectName) return;
    const unsub = dataSource.onMutation((event: any) => {
      if (event.resource === schema.objectName) {
        setRefreshKey(k => k + 1);
      }
    });
    return unsub;
  }, [dataSource, schema.objectName]);

  // Dynamic page size state (wired from pageSizeOptions selector)
  const [dynamicPageSize, setDynamicPageSize] = React.useState<number | undefined>(undefined);
  const effectivePageSize = dynamicPageSize ?? schema.pagination?.pageSize ?? 100;

  // --- Server-side pagination (#2212) ---
  // ListView owns the fetch, so it owns paging too: it requests one window at a
  // time ($skip = (page-1)*size) and reads the real match `total` from the
  // result. That total + page controls are handed DOWN to the flat grid view so
  // its existing (single) DataTable pager becomes server-driven — records past
  // the first window are reachable, and we never stack a second pager on top.
  const [serverPage, setServerPage] = React.useState(1);
  const [serverTotal, setServerTotal] = React.useState<number | null>(null);

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


  // User Filters State (Airtable Interfaces-style)
  const [userFilterConditions, setUserFilterConditions] = React.useState<any[]>([]);

  // User filters render ONLY when explicitly configured (ADR-0047 §data
  // mode): saved list views already act as the preset switcher, so an
  // unconfigured view keeps a clean toolbar instead of growing auto-derived
  // dropdowns. When a config asks for dropdown/toggle elements without
  // naming fields, fill the field list from objectDef select-like fields so
  // authors can write `userFilters: { element: 'dropdown' }` as shorthand.
  const resolvedUserFilters = React.useMemo<ListViewSchema['userFilters'] | undefined>(() => {
    const configured = schema.userFilters;
    if (!configured) return undefined;
    if (configured.element === 'tabs') return configured;
    if (configured.fields && configured.fields.length > 0) return configured;
    if (!objectDef?.fields) return configured;

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

    if (derivedFields.length === 0) return configured;

    return { ...configured, fields: derivedFields };
  }, [schema.userFilters, objectDef, tFieldLabel]);

  // ADR-0053: userFilters (dropdown | tabs) is the sole page filter control.
  const filterElements = resolvedUserFilters;

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

  // Inline-edit State (initialized from schema). Kept local — like hiddenFields
  // — so the toolbar toggle flips the grid immediately. The parent persists via
  // onInlineEditChange (debounced) and doesn't update the `inlineEdit` prop
  // synchronously, so reading `schema.inlineEdit` directly would make the button
  // appear dead until a full reload.
  const [inlineEdit, setInlineEdit] = React.useState<boolean>(() => !!schema.inlineEdit);
  React.useEffect(() => {
    setInlineEdit(!!schema.inlineEdit);
  }, [schema.inlineEdit]);
  // Setter that also notifies parent for persistence (debounced upstream).
  const updateInlineEdit = React.useCallback(
    (next: boolean) => {
      setInlineEdit(next);
      onInlineEditChange?.(next);
    },
    [onInlineEditChange]
  );

  // Export State
  const [showExport, setShowExport] = React.useState(false);
  // Server-streamed export (xlsx / type-aware csv|json) in-flight + last error.
  const [exportBusy, setExportBusy] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  // Object-level export permission gate. Default-allow: export stays enabled
  // unless `allowExport === false` or `operations.export === false`.
  const exportPermitted = schema.allowExport !== false && schema.operations?.export !== false;

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

  // ── Gallery card density ────────────────────────────────────────────
  // Separate from the table `density.mode` (which controls rowHeight) —
  // the gallery uses 3 column counts mapped to `GalleryConfig.cardSize`
  // (small/medium/large). Persisted per-object so users can keep
  // Accounts compact while leaving Products comfortable.
  type GalleryCardSize = 'small' | 'medium' | 'large';
  const galleryDensityKey = React.useMemo(
    () => `objectui:gallery:density:${schema.objectName ?? 'default'}`,
    [schema.objectName],
  );
  const [galleryCardSize, setGalleryCardSize] = React.useState<GalleryCardSize>(() => {
    if (typeof window === 'undefined') return (schema.gallery?.cardSize as GalleryCardSize) ?? 'medium';
    try {
      const v = window.localStorage.getItem(galleryDensityKey);
      if (v === 'small' || v === 'medium' || v === 'large') return v;
    } catch { /* private mode — fall through */ }
    return (schema.gallery?.cardSize as GalleryCardSize) ?? 'medium';
  });
  const cycleGalleryDensity = React.useCallback(() => {
    setGalleryCardSize((prev) => {
      const next: GalleryCardSize = prev === 'large' ? 'medium' : prev === 'medium' ? 'small' : 'large';
      try { window.localStorage.setItem(galleryDensityKey, next); } catch { /* ignore */ }
      return next;
    });
  }, [galleryDensityKey]);

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

  // Auto-compute $expand fields from objectDef (lookup / master_detail).
  //
  // Important: include not only the user-declared `schema.fields` (table
  // columns) but also the runtime fields used by alternate view types
  // (kanban cardFields, calendar dateField, gallery coverField, etc.).
  // Otherwise a kanban whose card shows `account` would request
  // `?select=...,account,...` but never `populate=account`, so the server
  // returns the bare FK ID instead of the expanded record. This is why
  // list view shows "Initech Solutions" but kanban used to show
  // "8UY9zHWBfjYjYor4" for the same field.
  const expandFields = React.useMemo(() => {
    const baseColumns = Array.isArray(schema.fields)
      ? (schema.fields as any[])
          .map((f) => (typeof f === 'string' ? f : f?.field))
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    const collected = new Set<string>(baseColumns);
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
        ...(Array.isArray(v.metaFields) ? v.metaFields : []),
      ];
      for (const f of candidates) {
        if (typeof f === 'string' && f) collected.add(f);
      }
    };
    collectViewFields((schema as any).kanban);
    collectViewFields((schema as any).options?.kanban);
    collectViewFields((schema as any).calendar);
    collectViewFields((schema as any).options?.calendar);
    collectViewFields((schema as any).gallery);
    collectViewFields((schema as any).options?.gallery);
    collectViewFields((schema as any).timeline);
    collectViewFields((schema as any).options?.timeline);
    collectViewFields((schema as any).gantt);
    collectViewFields((schema as any).options?.gantt);
    const augmented = collected.size > 0 ? Array.from(collected) : undefined;
    return buildExpandFields(objectDef?.fields, augmented);
  }, [
    objectDef?.fields,
    schema.fields,
    (schema as any).kanban,
    (schema as any).calendar,
    (schema as any).gallery,
    (schema as any).timeline,
    (schema as any).gantt,
    (schema as any).options,
  ]);

  // Permissions context — must be read before the data-fetch effect so
  // the effect can FLS-gate the `$select` projection (preventing the
  // server from returning denied fields). Also feeds the column-list
  // gate further down the file.
  const perms = usePermissions();

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
      if (!dataSource || !schema.objectName) {
        // No way to fetch — clear the loading state so the empty state
        // (or downstream view) can render instead of an indefinite skeleton.
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setLoadError(null);
      try {
        // Construct filter
        let finalFilter: any = [];
        const baseFilter = schema.filters || [];
        const userFilter = convertFilterGroupToAST(currentFilters);
        
        
        // Normalize userFilter conditions (convert `in` to `or` of `=`)
        const normalizedUserFilterConditions = normalizeFilters(userFilterConditions);

        // Merge all filter sources with consistent structure
        const allFilters = [
          ...(baseFilter.length > 0 ? [baseFilter] : []),
          ...(userFilter.length > 0 ? [userFilter] : []),
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
        //
        // FLS: also drop columns the current user cannot read. Sending a
        // denied field in $select would leak the value at the server
        // boundary even though the UI hides it — server-side trust must
        // never be defeated by what the client requests.
        const selectFields = (() => {
          const rawCols = Array.isArray(schema.fields)
            ? (schema.fields as any[])
                .map(f => (typeof f === 'string' ? f : f?.field))
                .filter((v): v is string => typeof v === 'string' && v.length > 0)
            : [];
          const cols = (perms?.isLoaded && schema.objectName)
            ? rawCols.filter(c => perms.checkField(schema.objectName!, c, 'read'))
            : rawCols;
          if (cols.length === 0) return undefined;
          // Don't speculatively add `_id` / `name` — some backends reject
          // unknown select keys with an empty result set rather than
          // ignoring them. Stick to the user-requested columns plus the
          // expanded relation roots (which we know are valid because
          // buildExpandFields() derived them from the object schema).
          const required = new Set<string>(['id']);
          for (const c of cols) required.add(c);
          for (const e of expandFields) required.add(e);

          // Real fields of the object, used to gate the SPECULATIVE
          // view-binding fields below. The comment above is the tell: "some
          // backends reject unknown select keys with an empty result set
          // rather than ignoring them" — the cloud multi-tenant runtime does
          // exactly that, so a single unknown column in $select silently
          // zeroes the whole list (an AI-built `product` view auto-requesting
          // `status`/`due_date`/`image` then looks like "no data exists").
          // The user-declared `cols` and `expandFields` are already
          // known-valid (perms.checkField / buildExpandFields derived them
          // from the schema); only the auto-included view-binding fields are
          // unsafe. When the object schema isn't loaded yet we can't
          // validate, so we keep the prior permissive behavior (the data
          // fetch waits for objectDefLoaded, so this is virtually never hit).
          const knownObjectFields = (() => {
            const f = objectDef?.fields;
            if (!f) return null;
            const names = Array.isArray(f)
              ? (f as any[]).map(x => x?.name).filter((n): n is string => typeof n === 'string')
              : Object.keys(f);
            const s = new Set<string>(names);
            s.add('id'); s.add('created_at'); s.add('updated_at');
            return s;
          })();
          const addSpeculative = (f: unknown) => {
            if (typeof f !== 'string' || !f) return;
            if (!knownObjectFields || knownObjectFields.has(f)) required.add(f);
          };

          // View-specific runtime fields. Each non-grid view binds to one
          // or more record fields (groupBy for kanban, dates for calendar/
          // timeline/gantt, image/title for gallery). Without these in the
          // projection the view renders correctly-shaped records but with
          // blank values — e.g. a kanban grouped by `industry` puts every
          // card into the implicit "no value" column. Added via
          // addSpeculative so a binding naming a field this object lacks is
          // dropped instead of poisoning the query.
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
              ...(Array.isArray(v.metaFields) ? v.metaFields : []),
            ];
            for (const f of candidates) addSpeculative(f);
          };
          collectViewFields(schema.kanban);
          collectViewFields(schema.options?.kanban);
          collectViewFields(schema.calendar);
          collectViewFields(schema.options?.calendar);
          collectViewFields(schema.gallery);
          collectViewFields(schema.options?.gallery);
          collectViewFields(schema.timeline);
          collectViewFields(schema.options?.timeline);
          // Timeline plugin shows status / priority chips inline. Auto-include
          // them when no explicit metaFields was configured so views like
          // `task_timeline` ({ columns: ['subject', 'status'] }) still get
          // priority badges out of the box. Gated through addSpeculative: only
          // added when the object actually has these fields (a `product` with
          // no status/priority must not get them, or the list goes empty).
          {
            const tCfg: any = schema.timeline ?? schema.options?.timeline;
            if (tCfg && !Array.isArray(tCfg.metaFields)) {
              addSpeculative('status');
              addSpeculative('priority');
            }
          }
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

        // Window the request only for the flat grid view. Grouped grids and the
        // visual views (kanban/calendar/gantt/gallery) consume the whole batch,
        // so they keep their single-window fetch and in-memory handling.
        const paginate = currentView === 'grid' && !(groupingConfig?.fields?.length);
        const skip = paginate ? (serverPage - 1) * effectivePageSize : 0;

        const results = await dataSource.find(schema.objectName, {
           ...(hasFilter ? { $filter: finalFilter } : {}),
           $orderby: sort,
           $top: effectivePageSize,
           ...(skip > 0 ? { $skip: skip } : {}),
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

        // Capture the real match total (framework #2212: findData now returns it).
        // With a known total the grid pages server-side, so the "showing first N"
        // cap warning no longer applies; without one we fall back to the old
        // single-window behaviour and keep the warning.
        const rawTotal = (results && typeof results === 'object')
          ? ((results as any).total ?? (results as any).count)
          : undefined;
        const knownTotal = typeof rawTotal === 'number' ? rawTotal : null;
        setServerTotal(paginate ? knownTotal : null);
        setDataLimitReached(
          !(paginate && knownTotal != null) && items.length >= effectivePageSize,
        );
      } catch (err) {
        // Only log + surface errors from the latest request. A failed fetch is
        // NOT an empty result — record it so the render shows an error panel
        // (with retry) rather than "Create your first record".
        if (requestId === fetchRequestIdRef.current) {
          console.error("ListView data fetch error:", err);
          setData([]);
          setLoadError((err as any)?.message ? String((err as any).message) : String(err ?? 'Unknown error'));
        }
      } finally {
        if (isMounted && requestId === fetchRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [schema.objectName, schema.data, dataSource, schema.filters, effectivePageSize, currentSort, currentFilters, userFilterConditions, refreshKey, searchTerm, schema.searchableFields, expandFields, objectDefLoaded, schema.refreshTrigger, perms, serverPage, currentView, groupingConfig]); // Re-fetch on filter/sort/search/refreshTrigger/perms/page change

  // Any change to the result-defining inputs (object, filters, sort, search,
  // grouping, page size) invalidates the current page number — snap back to
  // page 1 so the user never lands on a now-out-of-range window. We compare by
  // VALUE via a JSON signature (not effect deps): ListView re-initializes sort/
  // grouping references during mount, which would otherwise reset the page out
  // from under a user who just turned it. serverPage is deliberately NOT part of
  // the signature, so turning the page never triggers a reset.
  const pageResetSignature = JSON.stringify([
    schema.objectName, schema.filters, effectivePageSize, currentSort,
    currentFilters, userFilterConditions, searchTerm, currentView, groupingConfig,
  ]);
  const prevPageResetSignature = React.useRef(pageResetSignature);
  React.useEffect(() => {
    if (prevPageResetSignature.current !== pageResetSignature) {
      prevPageResetSignature.current = pageResetSignature;
      setServerPage(1);
    }
  }, [pageResetSignature]);

  // Available view types based on schema configuration
  const availableViews = React.useMemo(() => {
    // Capability-resolvable types: a visualization is only offered when its
    // required field bindings resolve (ADR-0047) — kanban needs a groupBy,
    // calendar a start date, etc. `grid` always renders.
    const resolvable: ViewType[] = ['grid'];

    // Check for Kanban capabilities (spec config takes precedence)
    if (schema.kanban?.groupByField || schema.kanban?.groupField || schema.options?.kanban?.groupField) {
      resolvable.push('kanban');
    }

    // Check for Gallery capabilities (spec config takes precedence)
    if (schema.gallery?.coverField || schema.gallery?.imageField || schema.options?.gallery?.imageField) {
      resolvable.push('gallery');
    }

    // Check for Calendar capabilities (spec config takes precedence)
    if (schema.calendar?.startDateField || schema.options?.calendar?.startDateField) {
      resolvable.push('calendar');
    }

    // Check for Timeline capabilities (spec config takes precedence)
    if (schema.timeline?.startDateField || schema.options?.timeline?.startDateField || schema.options?.timeline?.dateField || schema.options?.calendar?.startDateField) {
      resolvable.push('timeline');
    }

    // Check for Gantt capabilities (spec config takes precedence)
    if (schema.gantt?.startDateField || schema.options?.gantt?.startDateField) {
      resolvable.push('gantt');
    }

    // Check for Map capabilities
    if (schema.options?.map?.locationField || (schema.options?.map?.latitudeField && schema.options?.map?.longitudeField)) {
      resolvable.push('map');
    }

    // Check for Tree capabilities — a self-referencing parent pointer.
    if ((schema as any).tree?.parentField || schema.options?.tree?.parentField || schema.viewType === 'tree') {
      resolvable.push('tree');
    }

    // Always allow switching back to the viewType defined in schema
    if (schema.viewType && !resolvable.includes(schema.viewType as ViewType) &&
       ['grid', 'kanban', 'calendar', 'timeline', 'gantt', 'map', 'gallery', 'chart', 'tree'].includes(schema.viewType)) {
      resolvable.push(schema.viewType as ViewType);
    }

    // appearance.allowedVisualizations is the author whitelist (ADR-0047):
    // effective options = whitelist ∩ resolvable. Types whose bindings don't
    // resolve are hidden even when whitelisted — a kanban without a groupBy
    // field renders garbage, so it must not be offered.
    const whitelist = schema.appearance?.allowedVisualizations;
    if (Array.isArray(whitelist) && whitelist.length > 0) {
      const filtered = whitelist.filter((v: any) => resolvable.includes(v)) as ViewType[];
      return filtered.length > 0 ? filtered : (['grid'] as ViewType[]);
    }

    return resolvable;
  }, [schema.options, schema.viewType, schema.kanban, schema.calendar, schema.gantt, schema.gallery, schema.timeline, (schema as any).tree, schema.appearance?.allowedVisualizations]);

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

  // Field-level permission gate. Filter unreadable columns from the
  // field list BEFORE any downstream column construction so they also
  // disappear from the hide-fields popover, filter/sort builders, and
  // grid `$select`. (`perms` was hoisted to before the data-fetch
  // effect so $select can be gated server-side too.)
  // Apply hiddenFields and fieldOrder to produce effective fields
  const effectiveFields = React.useMemo(() => {
    let fields = schema.fields || [];

    // Defensive: ensure fields is an array of strings/objects
    if (!Array.isArray(fields)) {
      fields = [];
    }

    // FLS: drop columns the current user cannot read.
    if (perms?.isLoaded && schema.objectName) {
      fields = fields.filter((f: any) => {
        const fieldName = typeof f === 'string' ? f : (f?.name || f?.fieldName || f?.field);
        if (!fieldName) return true;
        return perms.checkField(schema.objectName!, fieldName, 'read');
      });
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
  }, [schema.fields, schema.objectName, hiddenFields, schema.fieldOrder, perms]);

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
      // `default` deliberately shares the grid branch: an unrecognized
      // viewType must degrade to a working table, never to a typeless schema
      // (SchemaRenderer shows those as a red "Unknown component type" box).
      default:
      case 'grid':
        return {
          type: 'object-grid',
          ...baseProps,
          columns: effectiveFields,
          ...(schema.conditionalFormatting ? { conditionalFormatting: schema.conditionalFormatting } : {}),
          editable: inlineEdit,
          ...(schema.wrapHeaders != null ? { wrapHeaders: schema.wrapHeaders } : {}),
          ...(schema.virtualScroll != null ? { virtualScroll: schema.virtualScroll } : {}),
          ...(schema.resizable != null ? { resizable: schema.resizable } : {}),
          ...(schema.selection ? { selection: schema.selection } : {}),
          ...(schema.pagination ? { pagination: schema.pagination } : {}),
          ...(groupingConfig ? { grouping: groupingConfig } : {}),
          ...(rowColorConfig ? { rowColor: rowColorConfig } : {}),
          ...(schema.rowActions ? { rowActions: schema.rowActions } : {}),
          ...((schema as any).rowActionDefs ? { rowActionDefs: (schema as any).rowActionDefs } : {}),
          ...(schema.bulkActions ? { batchActions: schema.bulkActions } : {}),
          ...((schema as any).bulkActionDefs ? { bulkActionDefs: (schema as any).bulkActionDefs } : {}),
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
          // User's runtime override from the toolbar density button wins
          // over schema defaults. Persisted to localStorage in ListView.
          cardSize: galleryCardSize,
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
      case 'tree': {
        // Self-referencing tree-grid. Config lives under view.tree.* (direct)
        // or options.tree.* (app-shell object pages). parentField auto-detects
        // from the object's tree/self-reference field when omitted.
        const treeCfg = (schema as any).tree || schema.options?.tree || {};
        return {
          type: 'object-tree',
          ...baseProps,
          parentField: treeCfg.parentField,
          labelField: treeCfg.labelField || treeCfg.titleField || 'name',
          fields: treeCfg.fields || effectiveFields,
          defaultExpandedDepth: treeCfg.defaultExpandedDepth,
          ...treeCfg,
        };
      }
      case 'chart': {
        // A `chart` list view renders an aggregated chart of the object's
        // records (e.g. sum of estimate_hours grouped by status), delegating
        // to the same object-chart component the dashboard uses.
        const chartCfg = (schema as any).chart || schema.options?.chart || {};
        // ADR-0021 (#1890): the single author-facing shape binds to a semantic
        // `dataset` and selects dimensions/measures BY NAME, so the chart runs
        // through the governed queryDataset path (numbers consistent everywhere).
        if (chartCfg.dataset) {
          const dims: string[] = Array.isArray(chartCfg.dimensions) ? chartCfg.dimensions : [];
          const vals: string[] = Array.isArray(chartCfg.values) ? chartCfg.values : [];
          return {
            type: 'object-chart',
            dataset: chartCfg.dataset,
            dimensions: dims,
            values: vals,
            chartType: chartCfg.chartType || 'bar',
            xAxisKey: dims[0],
            series: vals.map((v: string) => ({ dataKey: v, label: v })),
            className: 'h-[400px] w-full',
          };
        }
        // Legacy inline aggregate (deprecated — pre-ADR-0021 metadata). Kept as a
        // fallback so existing authored chart views keep rendering.
        const valueField = (Array.isArray(chartCfg.yAxisFields) && chartCfg.yAxisFields[0])
          || chartCfg.valueField || 'value';
        const categoryField = chartCfg.xAxisField || chartCfg.categoryField || 'name';
        return {
          type: 'object-chart',
          objectName: schema.objectName,
          chartType: chartCfg.chartType || 'bar',
          filters: schema.filters,
          aggregate: {
            field: valueField,
            function: chartCfg.aggregation || 'count',
            groupBy: categoryField,
          },
          xAxisKey: categoryField,
          series: [{ dataKey: valueField, label: valueField }],
          className: 'h-[400px] w-full',
        };
      }
    }
  }, [currentView, schema, currentSort, effectiveFields, groupingConfig, rowColorConfig, navigation.handleClick, density.mode, galleryCardSize, inlineEdit]);

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

  // Export handler
  const handleExport = React.useCallback((format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    // Object-level export permission gate. Default-allow.
    if (!exportPermitted) return;
    const exportConfig = resolvedExportOptions;
    const maxRecords = exportConfig?.maxRecords || 0;
    const includeHeaders = exportConfig?.includeHeaders !== false;
    const prefix = exportConfig?.fileNamePrefix || schema.objectName || 'export';

    // Server-streamed path: csv / xlsx / json via dataSource.exportDownload.
    // XLSX is server-only; type-aware value formatting, field resolution and
    // permission enforcement all happen server-side. Mirrors the active view's
    // filter + sort so the exported file matches what the user sees.
    const serverEligible = (format === 'csv' || format === 'xlsx' || format === 'json')
      && typeof dataSource?.exportDownload === 'function'
      && !!schema.objectName
      && (exportConfig as any)?.streaming !== false;
    if (serverEligible) {
      const fields = effectiveFields
        .map((f: any) => typeof f === 'string' ? f : (f.name || f.fieldName || f.field))
        .filter(Boolean);

      // Merge the same filter sources as the data fetch (base + user + conditions).
      const baseFilter = schema.filters || [];
      const userFilter = convertFilterGroupToAST(currentFilters);
      const normalizedUserFilterConditions = normalizeFilters(userFilterConditions);
      const allFilters = [
        ...(baseFilter.length > 0 ? [baseFilter] : []),
        ...(userFilter.length > 0 ? [userFilter] : []),
        ...normalizedUserFilterConditions,
      ].filter((f: any) => Array.isArray(f) && f.length > 0);
      const finalFilter = allFilters.length > 1
        ? ['and', ...allFilters]
        : allFilters.length === 1 ? allFilters[0] : undefined;

      const sort = currentSort.length > 0
        ? currentSort
            .filter(item => item.field)
            .map(item => ({ field: item.field, direction: item.order as 'asc' | 'desc' }))
        : undefined;

      setExportError(null);
      setExportBusy(true);
      void (async () => {
        try {
          const blob = await dataSource!.exportDownload!(schema.objectName!, {
            format: format as 'csv' | 'xlsx' | 'json',
            fields: fields.length ? fields : undefined,
            filter: finalFilter,
            sort,
            includeHeaders,
            limit: maxRecords > 0 ? maxRecords : undefined,
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${prefix}.${format}`;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setShowExport(false);
        } catch (err) {
          // Surface the failure instead of swallowing it (e.g. permission denied
          // or a server error) — the toolbar shows the message.
          console.error('ListView export failed:', err);
          setExportError(err instanceof Error ? err.message : String(err));
        } finally {
          setExportBusy(false);
        }
      })();
      return;
    }

    // Client-side fallback (csv / json only).
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
  }, [data, effectiveFields, resolvedExportOptions, schema.objectName, schema.filters, exportPermitted, dataSource, currentFilters, userFilterConditions, currentSort]);

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
      aria-busy={loading || undefined}
      data-state={loading ? 'loading' : 'idle'}
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? t('list.refreshing') : t('list.pullToRefresh')}
        </div>
      )}
      {/* View Description (single line, no border duplication) */}
      {schema.description && (schema.appearance?.showDescription !== false) && (
        <div className="px-4 pt-1.5 text-xs text-muted-foreground bg-background" data-testid="view-description">
          {typeof schema.description === 'string' ? schema.description : ''}
        </div>
      )}

      {/* Unified toolbar — Tabs + UserFilters (left) + Tool buttons (right) on one row.
          The right-hand cluster is wrapped in a single rounded pill container
          with vertical dividers (Linear / Notion style) so utility buttons
          read as one segmented control rather than a loose bag of icons. */}
      <div className="border-b px-2 sm:px-4 py-1.5 flex items-center justify-between gap-1 sm:gap-2 bg-background">
        <div className="flex items-center gap-2 overflow-x-auto min-w-0">
          {/* User Filters — filter elements (dropdown chips / preset tabs /
              toggles). Mutually exclusive with view tabs above, so at most
              one filter element group ever renders here. On mobile we keep
              them visible (single line, scrollable) to match the Airtable
              Interface pattern. */}
          {filterElements && (
              <div className="shrink-0 min-w-0 overflow-x-auto" data-testid="user-filters">
                <UserFilters
                  config={filterElements}
                  objectDef={objectDef}
                  data={data}
                  onFilterChange={setUserFilterConditions}
                  maxVisible={3}
                  initialSelections={userFilterSelections}
                  onSelectionsChange={onUserFilterSelectionsChange}
                />
              </div>
          )}
        </div>

        <div className="flex items-center gap-0 shrink-0 rounded-lg border border-border bg-muted/40 p-0.5 shadow-sm">
          {/* Visualization switcher — compact dropdown (Airtable-style
              "List ▾"), first slot of the right tool cluster so the whole
              toolbar stays a single row. */}
          {showViewSwitcher && (
            <>
              <ViewSwitcherDropdown
                currentView={currentView}
                availableViews={availableViews}
                onViewChange={handleViewChange}
              />
              <div className="h-4 w-px bg-border/60 mx-0.5" />
            </>
          )}
          {/* Inline edit — toggle record editing for this (grid) view. Persists
              `inlineEdit` on the view via onInlineEditChange. */}
          {currentView === 'grid' && onInlineEditChange && !toolbarFlags.compactToolbar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateInlineEdit(!inlineEdit)}
              className={cn(
                "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                inlineEdit && "text-primary"
              )}
              title={t('list.inlineEditLabel', { defaultValue: 'Edit records inline (click a cell to edit)' })}
              data-testid="toolbar-inline-edit-toggle"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t('list.inlineEditShort', { defaultValue: 'Edit inline' })}</span>
            </Button>
          )}
          {/* Hide Fields — hidden on mobile (collapsed into ViewSettingsPopover) */}
          {toolbarFlags.showHideFields && !toolbarFlags.compactToolbar && (
          <Popover open={showHideFields} onOpenChange={setShowHideFields}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  hiddenFields.size > 0 && "text-primary"
                )}
              >
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.hideFields')}</span>
                {hiddenFields.size > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
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
          {toolbarFlags.showHideFields && !toolbarFlags.compactToolbar && (toolbarFlags.showFilters || toolbarFlags.showSort || toolbarFlags.showGroup) && (
            <div className="hidden sm:block h-5 w-px bg-border/50 mx-1 shrink-0" />
          )}

          {/* Filter — universal advanced filter builder.
              Always shown when enabled. The left-side quick-filter chips
              (filterElements) are predefined named filters; the
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
                  hasFilters && "text-foreground font-medium"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.filter')}</span>
                {hasFilters && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
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

          {/* Group — hidden on mobile (collapsed into ViewSettingsPopover) */}
          {toolbarFlags.showGroup && !toolbarFlags.compactToolbar && (
          <Popover open={showGroupPopover} onOpenChange={setShowGroupPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  groupingConfig && "text-foreground font-medium"
                )}
              >
                <Group className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.group')}</span>
                {groupingConfig && groupingConfig.fields?.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
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
                      addGroup: t('list.addGroup', { defaultValue: 'Add group field' }),
                      collapseTitle: t('list.collapsedByDefault', { defaultValue: 'Collapsed by default' }),
                      removeTitle: t('list.removeGroup', { defaultValue: 'Remove' }),
                    }}
                    onChange={(next) => setGroupingConfig(next as any)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          )}

          {/* Sort — desktop only. Mobile relies on the (typically pre-sorted)
              default view; users who need ad-hoc sorting switch to desktop. */}
          {toolbarFlags.showSort && (
          <Popover open={showSort} onOpenChange={setShowSort}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  currentSort.length > 0 && "text-foreground font-medium"
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('list.sort')}</span>
                {currentSort.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
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
          {!toolbarFlags.compactToolbar && (toolbarFlags.showFilters || toolbarFlags.showSort || toolbarFlags.showGroup) && (toolbarFlags.showColor || toolbarFlags.showDensity) && (
            <div className="hidden sm:block h-5 w-px bg-border/50 mx-1 shrink-0" />
          )}

          {/* Color — hidden on mobile (collapsed into ViewSettingsPopover) */}
          {toolbarFlags.showColor && !toolbarFlags.compactToolbar && (
          <Popover open={showColorPopover} onOpenChange={setShowColorPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:inline-flex h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                  rowColorConfig && "text-foreground font-medium"
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

          {/* Row Height / Density Mode — table-style density (rowHeight) */}
          {toolbarFlags.showDensity && !toolbarFlags.compactToolbar && currentView !== 'gallery' && (() => {
            const DensityIcon = density.mode === 'compact' ? Rows4 : density.mode === 'comfortable' ? Rows3 : Rows2;
            const modeLabel =
              density.mode === 'compact'
                ? t('grid.toolbar.densityCompact', { defaultValue: 'Compact' })
                : density.mode === 'comfortable'
                  ? t('grid.toolbar.densityComfortable', { defaultValue: 'Comfortable' })
                  : t('grid.toolbar.densitySpacious', { defaultValue: 'Spacious' });
            const densityLabel = t('grid.toolbar.densityMode', { defaultValue: 'Density' });
            const ariaLabel = `${densityLabel}: ${modeLabel}`;
            const titleLabel = t('grid.toolbar.densityCycleHint', {
              defaultValue: '{{label}} (click to cycle)',
              label: ariaLabel,
            });
            return (
              <Button
                variant="ghost"
                size="sm"
                aria-label={ariaLabel}
                className={cn(
                  "hidden sm:inline-flex h-7 w-7 p-0 text-muted-foreground hover:text-primary transition-colors duration-150",
                  density.mode !== 'compact' && "text-foreground font-medium"
                )}
                onClick={density.cycle}
                title={titleLabel}
              >
                <DensityIcon className="h-3.5 w-3.5" />
              </Button>
            );
          })()}

          {/* Gallery card density — same toolbar slot, only when gallery view is active */}
          {toolbarFlags.showDensity && !toolbarFlags.compactToolbar && currentView === 'gallery' && (() => {
            const GalleryDensityIcon = galleryCardSize === 'small' ? Rows4 : galleryCardSize === 'medium' ? Rows3 : Rows2;
            const modeLabel =
              galleryCardSize === 'small'
                ? t('grid.toolbar.densityCompact', { defaultValue: 'Compact' })
                : galleryCardSize === 'medium'
                  ? t('grid.toolbar.densityComfortable', { defaultValue: 'Comfortable' })
                  : t('grid.toolbar.densitySpacious', { defaultValue: 'Spacious' });
            const densityLabel = t('grid.toolbar.densityMode', { defaultValue: 'Density' });
            const ariaLabel = `${densityLabel}: ${modeLabel}`;
            const titleLabel = t('grid.toolbar.densityCycleHint', {
              defaultValue: '{{label}} (click to cycle)',
              label: ariaLabel,
            });
            return (
              <Button
                variant="ghost"
                size="sm"
                aria-label={ariaLabel}
                className={cn(
                  "hidden sm:inline-flex h-7 w-7 p-0 text-muted-foreground hover:text-primary transition-colors duration-150",
                  galleryCardSize !== 'small' && "text-foreground font-medium",
                )}
                onClick={cycleGalleryDensity}
                title={titleLabel}
              >
                <GalleryDensityIcon className="h-3.5 w-3.5" />
              </Button>
            );
          })()}

          {/* (Removed) Previously a mobile-only ViewSettingsPopover gear was
              rendered here to expose HideFields / Group / Color / Density on
              phones. Those controls are essentially no-ops on a single-column
              mobile layout, so on mobile we now drop the gear entirely. The
              same controls remain available on desktop via the individual
              buttons above, and on tablet via the existing compactToolbar
              gear below. */}

          {/* Compact View Settings popover (P1-4): bundles Group + Color + Density + Hide Fields
              into a single gear button when schema.compactToolbar is enabled. */}
          {toolbarFlags.compactToolbar && (
            toolbarFlags.showGroup || toolbarFlags.showColor || toolbarFlags.showDensity || toolbarFlags.showHideFields
          ) && (
            <ViewSettingsPopover
              t={t as any}
              allFields={allFields as any}
              showGroup={toolbarFlags.showGroup}
              groupingConfig={groupingConfig}
              setGroupingConfig={setGroupingConfig}
              showColor={toolbarFlags.showColor}
              rowColorConfig={rowColorConfig}
              setRowColorConfig={setRowColorConfig}
              showDensity={toolbarFlags.showDensity}
              density={density as any}
              showHideFields={toolbarFlags.showHideFields}
              hiddenFields={hiddenFields}
              updateHiddenFields={updateHiddenFields}
              showInlineEdit={currentView === 'grid'}
              inlineEdit={inlineEdit}
              setInlineEdit={updateInlineEdit}
            />
          )}

          {/* --- Separator: Appearance | Export --- */}
          {(toolbarFlags.showColor || toolbarFlags.showDensity || toolbarFlags.compactToolbar) && resolvedExportOptions && exportPermitted && (
            <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
          )}

          {/* Export */}
          {resolvedExportOptions && exportPermitted && (
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
                      disabled={exportBusy}
                      onClick={() => handleExport(format)}
                    >
                      {exportBusy
                        ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        : <Download className="h-3.5 w-3.5 mr-2" />}
                      {t('list.exportAs', { format: format.toUpperCase() })}
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
            const hasLeftSideItems = schema.allowPrinting || (schema.sharing?.enabled || schema.sharing?.type) || (resolvedExportOptions && exportPermitted);
            return toolbarFlags.showSearch && hasLeftSideItems ? (
              <div className="h-5 w-px bg-border/50 mx-1 shrink-0" />
            ) : null;
          })()}

          {/* Search (icon button + popover) — desktop only. The global
              top-bar search (⌘K) is already prominent on mobile, so an
              additional list-scoped search popover would be redundant chrome.
              Filter remains the primary way to narrow data on phones. */}
          {toolbarFlags.showSearch && (
            <Popover open={showSearchPopover} onOpenChange={setShowSearchPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "hidden sm:inline-flex h-7 w-7 p-0 text-muted-foreground hover:text-primary text-xs transition-colors duration-150",
                    searchTerm && "text-foreground font-medium"
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

      {/* View Content */}
      <div key={currentView} className="flex-1 min-h-0 bg-background relative overflow-hidden animate-in fade-in-0 duration-200">
        {/* Re-fetch indicator: thin top progress bar shown when refreshing
            existing data (filter/sort/search change). Skipped during the
            initial load — the full skeleton below handles that case. */}
        <RefreshIndicator active={loading && data.length > 0} />
        {/* Empty state is rendered here ONLY for tabular/list-like views.
            Structural views (kanban/calendar/gallery/gantt/timeline/map) own
            their own empty rendering so their column/lane/grid structure
            stays visible — otherwise users see a generic "No items found"
            on Task Board / Calendar etc. even though the view exists. */}
        {/* Loading state — shown when fetching with no data yet. Rendered at
            the ListView level so every inner view (grid/kanban/calendar/...)
            gets a consistent indicator instead of momentarily showing an
            empty state on slow networks. */}
        {loadError && data.length === 0 ? (
          <DataEmptyState
            data-testid="list-error-state"
            className="h-full min-h-[200px] p-8 gap-1 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:text-foreground [&>p]:max-w-md"
            icon={<AlertTriangle className="h-12 w-12 text-destructive/60" />}
            iconWrapperClassName="mb-3"
            title={t('list.loadErrorTitle')}
            description={t('list.loadErrorMessage')}
            action={(
              <Button
                variant="outline"
                size="sm"
                data-testid="list-error-retry"
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                <RotateCw className="h-4 w-4 mr-1.5" />
                {t('list.retry')}
              </Button>
            )}
          />
        ) : loading && data.length === 0 ? (
          <div
            className="flex flex-col h-full min-h-[200px] p-4 gap-2"
            data-testid="list-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="sr-only">{t('list.loading')}</span>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-9 rounded bg-muted/60 animate-pulse"
                style={{ opacity: Math.max(0.25, 1 - i * 0.12) }}
              />
            ))}
          </div>
        ) : !loading && data.length === 0 && currentView === 'grid' ? (
          (() => {
            const iconName = schema.emptyState?.icon;
            const ResolvedIcon: LucideIcon = iconName
              ? ((icons as Record<string, LucideIcon>)[
                  iconName.split('-').map((w: any) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
                ] ?? Inbox)
              : Inbox;
            // Distinguish "filtered/searched to empty" from "truly empty
            // (first run)". A new user with no filters shouldn't be told to
            // "adjust your filters" — they should be invited to create.
            const hasActiveQuery =
              !!(searchTerm && searchTerm.trim()) ||
              (Array.isArray(userFilterConditions) && userFilterConditions.length > 0) ||
              (Array.isArray(currentFilters?.conditions) && currentFilters.conditions.length > 0);
            const title = (typeof schema.emptyState?.title === 'string' ? schema.emptyState.title : undefined)
              ?? (hasActiveQuery ? t('list.noMatches') : t('list.firstRunTitle'));
            const description = (typeof schema.emptyState?.message === 'string' ? schema.emptyState.message : undefined)
              ?? (hasActiveQuery ? t('list.noMatchesMessage') : t('list.firstRunMessage'));
            return (
              <DataEmptyState
                data-testid="empty-state"
                className="h-full min-h-[200px] p-8 gap-1 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:text-foreground [&>p]:max-w-md"
                icon={<ResolvedIcon className="h-12 w-12 text-muted-foreground/50" />}
                iconWrapperClassName="mb-3"
                title={title}
                description={description}
                action={toolbarFlags.showAddRecord ? (
                  <Button
                    variant="default"
                    size="sm"
                    data-testid="empty-state-add-record"
                    onClick={() => props.onAddRecord?.()}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('list.addRecord')}
                  </Button>
                ) : undefined}
              />
            );
          })()
        ) : (
          <SchemaRenderer
            schema={viewComponentSchema}
            {...props}
            data={data}
            loading={loading}
            onRowSelect={setSelectedRows}
            {...(currentView === 'grid' && !(groupingConfig?.fields?.length) && serverTotal != null
              ? {
                  // Drive the flat grid's single (DataTable) pager from the
                  // server: it renders THIS window as the current page, the real
                  // total sets the page count, and turning the page asks ListView
                  // to refetch the next window. One pager, server-backed (#2212).
                  manualPagination: true,
                  rowCount: serverTotal,
                  page: serverPage,
                  pageSize: effectivePageSize,
                  onPageChange: (p: number) => setServerPage(p),
                  onPageSizeChange: (n: number) => { setDynamicPageSize(n); setServerPage(1); },
                }
              : {})}
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
                  {tActionLabel(action)}
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
          {/* Grid view delegates the rows-per-page selector to the DataTable's
              own server-driven pager (ObjectGrid passes pagination.pageSizeOptions
              straight through). Rendering a second native <select> here produced a
              duplicate control, so for grid we suppress it and only keep this
              fallback selector for pager-less views (gallery/kanban/calendar). */}
          {currentView !== 'grid' && schema.pagination?.pageSizeOptions && schema.pagination.pageSizeOptions.length > 0 && (
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