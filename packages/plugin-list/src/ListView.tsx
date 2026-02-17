/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Input, Popover, PopoverContent, PopoverTrigger, FilterBuilder, SortBuilder, NavigationOverlay } from '@object-ui/components';
import type { SortItem } from '@object-ui/components';
import { Search, SlidersHorizontal, ArrowUpDown, X, EyeOff, Group, Paintbrush, Ruler, Inbox, Download, AlignJustify, Share2, icons, type LucideIcon } from 'lucide-react';
import type { FilterGroup } from '@object-ui/components';
import { ViewSwitcher, ViewType } from './ViewSwitcher';
import { SchemaRenderer, useNavigationOverlay } from '@object-ui/react';
import { useDensityMode } from '@object-ui/react';
import type { ListViewSchema } from '@object-ui/types';
import { usePullToRefresh } from '@object-ui/mobile';

export interface ListViewProps {
  schema: ListViewSchema;
  className?: string;
  onViewChange?: (view: ViewType) => void;
  onFilterChange?: (filters: any) => void;
  onSortChange?: (sort: any) => void;
  onSearchChange?: (search: string) => void;
  /** Callback when a row/item is clicked (overrides NavigationConfig) */
  onRowClick?: (record: Record<string, unknown>) => void;
  /** Show view type switcher (Grid/Kanban/etc). Default: false (view type is fixed) */
  showViewSwitcher?: boolean;
  [key: string]: any;
}

// Helper to convert FilterBuilder group to ObjectStack AST
function mapOperator(op: string) {
  switch (op) {
    case 'equals': return '=';
    case 'notEquals': return '!=';
    case 'contains': return 'contains';
    case 'notContains': return 'notcontains';
    case 'greaterThan': return '>';
    case 'greaterOrEqual': return '>=';
    case 'lessThan': return '<';
    case 'lessOrEqual': return '<=';
    case 'in': return 'in';
    case 'notIn': return 'not in';
    case 'before': return '<';
    case 'after': return '>';
    default: return '=';
  }
}

function convertFilterGroupToAST(group: FilterGroup): any[] {
  if (!group || !group.conditions || group.conditions.length === 0) return [];

  const conditions = group.conditions.map(c => {
    if (c.operator === 'isEmpty') return [c.field, '=', null];
    if (c.operator === 'isNotEmpty') return [c.field, '!=', null];
    return [c.field, mapOperator(c.operator), c.value];
  });

  if (conditions.length === 1) return conditions[0];
  
  return [group.logic, ...conditions];
}

/**
 * Evaluate conditional formatting rules against a record.
 * Returns a CSSProperties object for the first matching rule, or empty object.
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
    const fieldValue = record[rule.field];
    let match = false;
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
    if (match) {
      const style: React.CSSProperties = {};
      if (rule.backgroundColor) style.backgroundColor = rule.backgroundColor;
      if (rule.textColor) style.color = rule.textColor;
      if (rule.borderColor) style.borderColor = rule.borderColor;
      return style;
    }
  }
  return {};
}

export const ListView: React.FC<ListViewProps> = ({
  schema: propSchema,
  className,
  onViewChange,
  onFilterChange,
  onSortChange,
  onSearchChange,
  onRowClick,
  showViewSwitcher = false,
  ...props
}) => {
  // Kernel level default: Ensure viewType is always defined (default to 'grid')
  const schema = React.useMemo(() => ({
    ...propSchema,
    viewType: propSchema.viewType || 'grid'
  }), [propSchema]);

  const [currentView, setCurrentView] = React.useState<ViewType>(
    (schema.viewType as ViewType)
  );
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Sort State
  const [showSort, setShowSort] = React.useState(false);
  const [currentSort, setCurrentSort] = React.useState<SortItem[]>(() => {
    if (schema.sort && schema.sort.length > 0) {
      return schema.sort.map(s => ({
        id: crypto.randomUUID(),
        field: s.field,
        order: (s.order as 'asc' | 'desc') || 'asc'
      }));
    }
    return [];
  });

  const [showFilters, setShowFilters] = React.useState(false);
  
  const [currentFilters, setCurrentFilters] = React.useState<FilterGroup>({
    id: 'root',
    logic: 'and',
    conditions: []
  });

  // Data State
  const dataSource = props.dataSource;
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [objectDef, setObjectDef] = React.useState<any>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Quick Filters State
  const [activeQuickFilters, setActiveQuickFilters] = React.useState<Set<string>>(() => {
    const defaults = new Set<string>();
    schema.quickFilters?.forEach(qf => {
      if (qf.defaultActive) defaults.add(qf.id);
    });
    return defaults;
  });

  // Hidden Fields State (initialized from schema)
  const [hiddenFields, setHiddenFields] = React.useState<Set<string>>(
    () => new Set(schema.hiddenFields || [])
  );
  const [showHideFields, setShowHideFields] = React.useState(false);

  // Export State
  const [showExport, setShowExport] = React.useState(false);

  // Density Mode — rowHeight maps to density if densityMode not explicitly set
  const resolvedDensity = React.useMemo(() => {
    if (schema.densityMode) return schema.densityMode;
    if (schema.rowHeight) {
      const map: Record<string, 'compact' | 'comfortable' | 'spacious'> = {
        compact: 'compact',
        medium: 'comfortable',
        tall: 'spacious',
      };
      return map[schema.rowHeight] || 'comfortable';
    }
    return 'comfortable';
  }, [schema.densityMode, schema.rowHeight]);
  const density = useDensityMode(resolvedDensity);

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
    const fetchObjectDef = async () => {
      if (!dataSource || !schema.objectName) return;
      try {
        const def = await dataSource.getObjectSchema(schema.objectName);
        if (isMounted) {
          setObjectDef(def);
        }
      } catch (err) {
        console.warn("Failed to fetch object schema for ListView:", err);
      }
    };
    fetchObjectDef();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  // Fetch data effect
  React.useEffect(() => {
    let isMounted = true;
    
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
        if (schema.quickFilters && activeQuickFilters.size > 0) {
          schema.quickFilters.forEach(qf => {
            if (activeQuickFilters.has(qf.id) && qf.filters && qf.filters.length > 0) {
              quickFilterConditions.push(qf.filters);
            }
          });
        }
        
        // Merge base filters, user filters, and quick filters
        const allFilters = [
          ...(baseFilter.length > 0 ? [baseFilter] : []),
          ...(userFilter.length > 0 ? [userFilter] : []),
          ...quickFilterConditions,
        ];
        
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

        const results = await dataSource.find(schema.objectName, {
           $filter: finalFilter,
           $orderby: sort,
           $top: 100 // Default pagination limit
        });
        
        let items: any[] = [];
        if (Array.isArray(results)) {
            items = results;
        } else if (results && typeof results === 'object') {
           if (Array.isArray((results as any).data)) {
              items = (results as any).data; 
           } else if (Array.isArray((results as any).records)) {
              items = (results as any).records;
           }
        }
        
        if (isMounted) {
          setData(items);
        }
      } catch (err) {
        console.error("ListView data fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, schema.filters, currentSort, currentFilters, activeQuickFilters, refreshKey]); // Re-fetch on filter/sort change

  // Available view types based on schema configuration
  const availableViews = React.useMemo(() => {
    const views: ViewType[] = ['grid'];
    
    // Check for Kanban capabilities
    if (schema.options?.kanban?.groupField) {
      views.push('kanban');
    }

    // Check for Gallery capabilities
    if (schema.options?.gallery?.imageField) {
      views.push('gallery');
    }
    
    // Check for Calendar capabilities
    if (schema.options?.calendar?.startDateField) {
      views.push('calendar');
    }
    
    // Check for Timeline capabilities
    if (schema.options?.timeline?.startDateField || schema.options?.timeline?.dateField || schema.options?.calendar?.startDateField) {
      views.push('timeline');
    }
    
    // Check for Gantt capabilities
    if (schema.options?.gantt?.startDateField) {
      views.push('gantt');
    }
    
    // Check for Map capabilities
    if (schema.options?.map?.locationField || (schema.options?.map?.latitudeField && schema.options?.map?.longitudeField)) {
      views.push('map');
    }
    
    // Always allow switching back to the viewType defined in schema if it's one of the supported types
    // This ensures that if a view is configured as "map", the map button is shown even if we missed the options check above
    if (schema.viewType && !views.includes(schema.viewType as ViewType) && 
       ['grid', 'kanban', 'calendar', 'timeline', 'gantt', 'map', 'gallery'].includes(schema.viewType)) {
      views.push(schema.viewType as ViewType);
    }
    
    return views;
  }, [schema.options, schema.viewType]);

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
    
    // Remove hidden fields
    if (hiddenFields.size > 0) {
      fields = fields.filter((f: any) => {
        const fieldName = typeof f === 'string' ? f : (f.name || f.fieldName || f.field);
        return !hiddenFields.has(fieldName);
      });
    }
    
    // Apply field order
    if (schema.fieldOrder && schema.fieldOrder.length > 0) {
      const orderMap = new Map(schema.fieldOrder.map((f, i) => [f, i]));
      fields = [...fields].sort((a: any, b: any) => {
        const nameA = typeof a === 'string' ? a : (a.name || a.fieldName || a.field);
        const nameB = typeof b === 'string' ? b : (b.name || b.fieldName || b.field);
        const orderA = orderMap.get(nameA) ?? Infinity;
        const orderB = orderMap.get(nameB) ?? Infinity;
        return orderA - orderB;
      });
    }
    
    return fields;
  }, [schema.fields, hiddenFields, schema.fieldOrder]);

  // Generate the appropriate view component schema
  const viewComponentSchema = React.useMemo(() => {
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
    };

    switch (currentView) {
      case 'grid':
        return {
          type: 'object-grid',
          ...baseProps,
          columns: effectiveFields,
          ...(schema.conditionalFormatting ? { conditionalFormatting: schema.conditionalFormatting } : {}),
          ...(schema.inlineEdit != null ? { editable: schema.inlineEdit } : {}),
          ...(schema.options?.grid || {}),
        };
      case 'kanban':
        return {
          type: 'object-kanban',
          ...baseProps,
          groupBy: schema.options?.kanban?.groupField || 'status',
          groupField: schema.options?.kanban?.groupField || 'status',
          titleField: schema.options?.kanban?.titleField || 'name',
          cardFields: effectiveFields || [],
          ...(schema.options?.kanban || {}),
        };
      case 'calendar':
        return {
          type: 'object-calendar',
          ...baseProps,
          startDateField: schema.options?.calendar?.startDateField || 'start_date',
          endDateField: schema.options?.calendar?.endDateField || 'end_date',
          titleField: schema.options?.calendar?.titleField || 'name',
          ...(schema.options?.calendar || {}),
        };
      case 'gallery':
        return {
          type: 'object-gallery',
          ...baseProps,
          imageField: schema.options?.gallery?.imageField,
          titleField: schema.options?.gallery?.titleField || 'name',
          subtitleField: schema.options?.gallery?.subtitleField,
          ...(schema.options?.gallery || {}),
        };
      case 'timeline':
        return {
          type: 'object-timeline',
          ...baseProps,
          startDateField: schema.options?.timeline?.startDateField || schema.options?.timeline?.dateField || 'created_at',
          titleField: schema.options?.timeline?.titleField || 'name',
          ...(schema.options?.timeline || {}),
        };
      case 'gantt':
        return {
          type: 'object-gantt',
          ...baseProps,
          startDateField: schema.options?.gantt?.startDateField || 'start_date',
          endDateField: schema.options?.gantt?.endDateField || 'end_date',
          progressField: schema.options?.gantt?.progressField || 'progress',
          dependenciesField: schema.options?.gantt?.dependenciesField || 'dependencies',
          ...(schema.options?.gantt || {}),
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
  }, [currentView, schema, currentSort, effectiveFields]);

  const hasFilters = currentFilters.conditions && currentFilters.conditions.length > 0;

  const filterFields = React.useMemo(() => {
    if (!objectDef?.fields) {
        // Fallback to schema fields if objectDef not loaded yet
        return (schema.fields || []).map((f: any) => {
           if (typeof f === 'string') return { value: f, label: f, type: 'text' };
           return {
              value: f.name || f.fieldName,
              label: f.label || f.name,
              type: f.type || 'text',
              options: f.options
           };
        });
    }
    
    return Object.entries(objectDef.fields).map(([key, field]: [string, any]) => ({
        value: key,
        label: field.label || key,
        type: field.type || 'text',
        options: field.options
    }));
  }, [objectDef, schema.fields]);

  const [searchExpanded, setSearchExpanded] = React.useState(false);

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
    const exportConfig = schema.exportOptions;
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
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') ? `"${str.replace(/"/g, '""')}"` : str;
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
  }, [data, effectiveFields, schema.exportOptions, schema.objectName]);

  // All available fields for hide/show
  const allFields = React.useMemo(() => {
    return (schema.fields || []).map((f: any) => {
      if (typeof f === 'string') return { name: f, label: f };
      return { name: f.name || f.fieldName || f.field, label: f.label || f.name || f.field };
    });
  }, [schema.fields]);

  return (
    <div
      ref={pullRef}
      className={cn('flex flex-col h-full bg-background relative', className)}
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
          {isRefreshing ? 'Refreshing…' : 'Pull to refresh'}
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

      {/* Airtable-style Toolbar — Row 2: Tool buttons */}
      <div className="border-b px-2 sm:px-4 py-1 flex items-center justify-between gap-1 sm:gap-2 bg-background">
        <div className="flex items-center gap-0.5 overflow-hidden flex-1 min-w-0">
          {/* Hide Fields */}
          <Popover open={showHideFields} onOpenChange={setShowHideFields}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs",
                  hiddenFields.size > 0 && "text-primary"
                )}
              >
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Hide fields</span>
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
                  <h4 className="font-medium text-sm">Hide Fields</h4>
                  {hiddenFields.size > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setHiddenFields(new Set())}>
                      Show all
                    </Button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {allFields.map(field => (
                    <label key={field.name} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenFields.has(field.name)}
                        onChange={() => {
                          setHiddenFields(prev => {
                            const next = new Set(prev);
                            if (next.has(field.name)) {
                              next.delete(field.name);
                            } else {
                              next.add(field.name);
                            }
                            return next;
                          });
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

          {/* Filter */}
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs",
                  hasFilters && "text-primary"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Filter</span>
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
                  <h4 className="font-medium text-sm">Filter Records</h4>
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

          {/* Group */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
            disabled
          >
            <Group className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Group</span>
          </Button>

          {/* Sort */}
          <Popover open={showSort} onOpenChange={setShowSort}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-primary text-xs",
                  currentSort.length > 0 && "text-primary"
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Sort</span>
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
                  <h4 className="font-medium text-sm">Sort Records</h4>
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

          {/* Color */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
            disabled
          >
            <Paintbrush className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Color</span>
          </Button>

          {/* Row Height / Density Mode */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs hidden lg:flex"
            onClick={density.cycle}
            title={`Density: ${density.mode}`}
          >
            <AlignJustify className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline capitalize">{density.mode}</span>
          </Button>

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
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-48 p-2">
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
                      Export as {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Share */}
          {schema.sharing?.enabled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
              title={`Sharing: ${schema.sharing.visibility || 'private'}`}
              data-testid="share-button"
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}
        </div>

        {/* Right: Search */}
        <div className="flex items-center gap-1">
          {searchExpanded ? (
            <div className="relative w-36 sm:w-48 lg:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Find..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-7 h-7 text-xs bg-muted/50 border-transparent hover:bg-muted focus:bg-background focus:border-input transition-colors"
                autoFocus
                onBlur={() => {
                  if (!searchTerm) setSearchExpanded(false);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-muted-foreground/20"
                onClick={() => {
                  handleSearchChange('');
                  setSearchExpanded(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
              onClick={() => setSearchExpanded(true)}
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          )}
        </div>
      </div>


      {/* Filters Panel - Removed as it is now in Popover */}

      {/* Quick Filters Row */}
      {schema.quickFilters && schema.quickFilters.length > 0 && (
        <div className="border-b px-2 sm:px-4 py-1 flex items-center gap-1 flex-wrap bg-background" data-testid="quick-filters">
          {schema.quickFilters.map(qf => {
            const isActive = activeQuickFilters.has(qf.id);
            const QfIcon: LucideIcon | null = qf.icon
              ? ((icons as Record<string, LucideIcon>)[
                  qf.icon.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
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
        {!loading && data.length === 0 ? (
          (() => {
            const iconName = schema.emptyState?.icon;
            const ResolvedIcon: LucideIcon = iconName
              ? ((icons as Record<string, LucideIcon>)[
                  iconName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
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
              </div>
            );
          })()
        ) : (
          <SchemaRenderer 
            schema={viewComponentSchema} 
            {...props} 
            data={data}
            loading={loading}
          />
        )}
      </div>

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
};
