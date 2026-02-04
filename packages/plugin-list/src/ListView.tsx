/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Input } from '@object-ui/components';
import { Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { ViewSwitcher, ViewType } from './ViewSwitcher';
import { SchemaRenderer } from '@object-ui/react';
import type { ListViewSchema } from '@object-ui/types';

export interface ListViewProps {
  schema: ListViewSchema;
  className?: string;
  onViewChange?: (view: ViewType) => void;
  onFilterChange?: (filters: any) => void;
  onSortChange?: (sort: any) => void;
  onSearchChange?: (search: string) => void;
  [key: string]: any;
}

export const ListView: React.FC<ListViewProps> = ({
  schema,
  className,
  onViewChange,
  onFilterChange: _onFilterChange,
  onSortChange,
  onSearchChange,
  ...props
}) => {
  const [currentView, setCurrentView] = React.useState<ViewType>(
    (schema.viewType as ViewType) || 'grid'
  );
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField] = React.useState(schema.sort?.[0]?.field || '');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(schema.sort?.[0]?.order || 'asc');
  const [showFilters, setShowFilters] = React.useState(false);

  const storageKey = React.useMemo(() => {
    return schema.id 
      ? `listview-${schema.objectName}-${schema.id}-view`
      : `listview-${schema.objectName}-view`;
  }, [schema.objectName, schema.id]);

  // Load saved view preference
  React.useEffect(() => {
    try {
      const savedView = localStorage.getItem(storageKey);
      if (savedView && ['grid', 'list', 'kanban', 'calendar', 'chart'].includes(savedView)) {
        setCurrentView(savedView as ViewType);
      }
    } catch (error) {
      console.warn('Failed to load view preference from localStorage:', error);
    }
  }, [storageKey]);

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

  const handleSortChange = React.useCallback(() => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortChange?.({ field: sortField, order: newOrder });
  }, [sortField, sortOrder, onSortChange]);

  // Generate the appropriate view component schema
  const viewComponentSchema = React.useMemo(() => {
    const baseProps = {
      objectName: schema.objectName,
      fields: schema.fields,
      filters: schema.filters,
      sort: [{ field: sortField, order: sortOrder }],
    };

    switch (currentView) {
      case 'grid':
        return {
          type: 'object-grid',
          ...baseProps,
          columns: schema.fields,
          ...(schema.options?.grid || {}),
        };
      case 'list':
        return {
          type: 'object-grid',
          ...baseProps,
          columns: schema.fields,
          compact: true,
          ...(schema.options?.list || {}),
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
      case 'chart':
        return {
          type: 'object-chart',
          ...baseProps,
          chartType: schema.options?.chart?.chartType || 'bar',
          xAxisField: schema.options?.chart?.xAxisField || 'name',
          yAxisFields: schema.options?.chart?.yAxisFields || ['value'],
          ...(schema.options?.chart || {}),
        };
      case 'spreadsheet':
        return {
          type: 'object-spreadsheet',
          ...baseProps,
          ...(schema.options?.spreadsheet || {}),
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
  }, [currentView, schema, sortField, sortOrder]);

  // Available view types based on schema configuration
  const availableViews = React.useMemo(() => {
    const views: ViewType[] = ['grid', 'list'];
    
    if (schema.options?.kanban?.groupField) {
      views.push('kanban');
    }
    if (schema.options?.calendar?.startDateField) {
      views.push('calendar');
    }
    if (schema.options?.chart) {
      views.push('chart');
    }
    
    return views;
  }, [schema.options]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${schema.objectName}...`}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-8"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => handleSearchChange('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && 'bg-muted')}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
          </Button>

          {sortField && (
            <Button variant="outline" size="sm" onClick={handleSortChange}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            </Button>
          )}
        </div>

        <ViewSwitcher
          currentView={currentView}
          availableViews={availableViews}
          onViewChange={handleViewChange}
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border rounded-lg bg-muted/30">
          <div className="text-sm font-medium mb-2">Filters</div>
          <div className="text-xs text-muted-foreground">
            Advanced filter UI coming soon. Current filters: {JSON.stringify(schema.filters || [])}
          </div>
        </div>
      )}

      {/* View Content */}
      <div className="flex-1">
        <SchemaRenderer schema={viewComponentSchema} {...props} />
      </div>
    </div>
  );
};
