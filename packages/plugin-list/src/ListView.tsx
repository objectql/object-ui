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
import { Search, SlidersHorizontal, ArrowUpDown, X, EyeOff, Group, Paintbrush, Ruler } from 'lucide-react';
import type { FilterGroup } from '@object-ui/components';
import { ViewSwitcher, ViewType } from './ViewSwitcher';
import { SchemaRenderer, useNavigationOverlay } from '@object-ui/react';
import type { ListViewSchema } from '@object-ui/types';

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
        
        // Merge base filters and user filters
        if (baseFilter.length > 0 && userFilter.length > 0) {
            finalFilter = ['and', baseFilter, userFilter];
        } else if (userFilter.length > 0) {
            finalFilter = userFilter;
        } else {
            finalFilter = baseFilter;
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
           } else if (Array.isArray((results as any).value)) {
              items = (results as any).value;
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
  }, [schema.objectName, dataSource, schema.filters, currentSort, currentFilters]); // Re-fetch on filter/sort change

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
    if (schema.options?.timeline?.dateField || schema.options?.calendar?.startDateField) {
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

  // Generate the appropriate view component schema
  const viewComponentSchema = React.useMemo(() => {
    const baseProps = {
      objectName: schema.objectName,
      fields: schema.fields,
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
          columns: schema.fields,
          ...(schema.options?.grid || {}),
        };
      case 'kanban':
        return {
          type: 'object-kanban',
          ...baseProps,
          groupBy: schema.options?.kanban?.groupField || 'status',
          groupField: schema.options?.kanban?.groupField || 'status',
          titleField: schema.options?.kanban?.titleField || 'name',
          cardFields: schema.fields || [],
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
          dateField: schema.options?.timeline?.dateField || 'created_at',
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
  }, [currentView, schema, currentSort]);

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

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
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
      <div className="border-b px-4 py-1 flex items-center justify-between gap-2 bg-background">
        <div className="flex items-center gap-0.5 overflow-hidden">
          {/* Hide Fields */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
            disabled
          >
            <EyeOff className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Hide fields</span>
          </Button>

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
            <PopoverContent align="start" className="w-[600px] p-4">
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
            <PopoverContent align="start" className="w-[600px] p-4">
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

          {/* Row Height */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs hidden lg:flex"
            disabled
          >
            <Ruler className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Row height</span>
          </Button>
        </div>

        {/* Right: Search */}
        <div className="flex items-center gap-1">
          {searchExpanded ? (
            <div className="relative w-48 lg:w-64">
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

      {/* View Content */}
      <div className="flex-1 min-h-0 bg-background relative overflow-hidden">
        <SchemaRenderer 
          schema={viewComponentSchema} 
          {...props} 
          data={data}
          loading={loading}
        />
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
