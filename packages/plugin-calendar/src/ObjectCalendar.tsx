/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectCalendar Component
 * 
 * A specialized calendar component that works with ObjectQL data sources.
 * Displays records as calendar events based on date field configuration.
 * Implements the calendar view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Month/week/day calendar views
 * - Auto-mapping of records to calendar events
 * - Date range filtering
 * - Event click handling
 * - Color coding support
 * - Works with object/api/value data providers
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ObjectGridSchema, DataSource, ViewData, CalendarConfig } from '@object-ui/types';
import { CalendarView, type CalendarEvent } from './CalendarView';
import { usePullToRefresh } from '@object-ui/mobile';
import { useNavigationOverlay } from '@object-ui/react';
import { NavigationOverlay } from '@object-ui/components';
import { extractRecords } from '@object-ui/core';

export interface CalendarSchema {
  type: 'calendar';
  objectName?: string;
  dateField?: string;
  endField?: string;
  titleField?: string;
  colorField?: string;
  filter?: any;
  sort?: any;
  /** Initial view mode */
  defaultView?: 'month' | 'week' | 'day';
}

export interface ObjectCalendarProps {
  schema: ObjectGridSchema | CalendarSchema;
  dataSource?: DataSource;
  className?: string;
  onEventClick?: (record: any) => void;
  onRowClick?: (record: any) => void;
  onDateClick?: (date: Date) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
  onNavigate?: (date: Date) => void;
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  onEventDrop?: (record: any, newStart: Date, newEnd?: Date) => void;
  locale?: string;
}

/**
 * Helper to get data configuration from schema
 */
function getDataConfig(schema: ObjectGridSchema | CalendarSchema): ViewData | null {
  if ('data' in schema && schema.data) {
    return schema.data;
  }
  
  if ('staticData' in schema && schema.staticData) {
    return {
      provider: 'value',
      items: schema.staticData,
    };
  }
  
  if (schema.objectName) {
    return {
      provider: 'object',
      object: schema.objectName,
    };
  }
  
  return null;
}

/**
 * Helper to convert sort config to QueryParams format
 */
function convertSortToQueryParams(sort: string | any[] | undefined): Record<string, 'asc' | 'desc'> | undefined {
  if (!sort) return undefined;
  
  // If it's a string like "name desc"
  if (typeof sort === 'string') {
    const parts = sort.split(' ');
    const field = parts[0];
    const order = (parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
    return { [field]: order };
  }
  
  // If it's an array of SortConfig objects
  if (Array.isArray(sort)) {
    return sort.reduce((acc, item) => {
      if (item.field && item.order) {
        acc[item.field] = item.order;
      }
      return acc;
    }, {} as Record<string, 'asc' | 'desc'>);
  }
  
  return undefined;
}

/**
 * Helper to get calendar configuration from schema
 */
function getCalendarConfig(schema: ObjectGridSchema | CalendarSchema): CalendarConfig | null {
  // Check if schema has calendar configuration
  if ('filter' in schema && schema.filter && typeof schema.filter === 'object' && 'calendar' in schema.filter) {
    return (schema.filter as any).calendar as CalendarConfig;
  }
  
  // For backward compatibility, check if schema has calendar config at root
  if ((schema as any).calendar) {
    return (schema as any).calendar as CalendarConfig;
  }
  
  // Check for flat properties (used by ObjectView)
  if ((schema as any).startDateField || (schema as any).dateField) {
      return {
          startDateField: (schema as any).startDateField || (schema as any).dateField,
          endDateField: (schema as any).endDateField || (schema as any).endField,
          titleField: (schema as any).titleField || 'name',
          colorField: (schema as any).colorField,
          allDayField: (schema as any).allDayField
      } as CalendarConfig;
  }

  return null;
}

export const ObjectCalendar: React.FC<ObjectCalendarProps> = ({
  schema,
  dataSource,
  className,
  onEventClick,
  onRowClick,
  onDateClick,
  onNavigate,
  onViewChange,
  onEventDrop,
  locale,
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePullRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handlePullRefresh,
    enabled: !!dataSource && !!schema.objectName,
  });

  const dataConfig = useMemo(() => getDataConfig(schema), [
    (schema as any).data,
    (schema as any).staticData,
    schema.objectName,
  ]);
  const calendarConfig = useMemo(() => getCalendarConfig(schema), [
    schema.filter,
    (schema as any).calendar,
    (schema as any).dateField,
    (schema as any).endField,
    (schema as any).titleField,
    (schema as any).colorField
  ]);
  const hasInlineData = dataConfig?.provider === 'value';

  // Fetch data based on provider
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        
        if (hasInlineData && dataConfig?.provider === 'value') {
          if (isMounted) {
            setData(dataConfig.items as any[]);
            setLoading(false);
          }
          return;
        }

        // Prioritize data passed from parent (ListView)
        if ((schema as any).data || (rest as any).data) {
            const passedData = (schema as any).data || (rest as any).data;
            if (Array.isArray(passedData)) {
                setData(passedData);
                setLoading(false);
                return;
            }
        }

        if (!dataSource) {
          throw new Error('DataSource required for object/api providers');
        }

        if (dataConfig?.provider === 'object') {
          const objectName = dataConfig.object;
          const result = await dataSource.find(objectName, {
            $filter: schema.filter,
            $orderby: convertSortToQueryParams(schema.sort),
          });
          
          let items: any[] = extractRecords(result);
          
          if (isMounted) {
            setData(items);
          }
        } else if (dataConfig?.provider === 'api') {
          console.warn('API provider not yet implemented for ObjectCalendar');
          if (isMounted) setData([]);
        }
        
        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('[ObjectCalendar] Error fetching data:', err);
        if (isMounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [dataConfig, dataSource, hasInlineData, schema.filter, schema.sort, refreshKey]);

  // Fetch object schema for field metadata
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!dataSource) return;
        
        const objectName = dataConfig?.provider === 'object' 
          ? dataConfig.object 
          : schema.objectName;
          
        if (!objectName) return;
        
        const schemaData = await dataSource.getObjectSchema(objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
      }
    };

    if (!hasInlineData && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, dataSource, hasInlineData, dataConfig]);

  // Transform data to calendar events
  const events = useMemo(() => {
    if (!calendarConfig || !data.length) {
      return [];
    }

    const { startDateField, endDateField, titleField, colorField } = calendarConfig;

    return data.map((record, index) => {
      const startDate = record[startDateField];
      const endDate = endDateField ? record[endDateField] : null;
      const title = record[titleField] || 'Untitled';
      const color = colorField ? record[colorField] : undefined;

      return {
        id: record.id || record._id || `event-${index}`,
        title,
        start: startDate ? new Date(startDate) : new Date(),
        end: endDate ? new Date(endDate) : undefined,
        color,
        allDay: !endDate, // If no end date, treat as all-day event
        data: record,
      };
    }).filter(event => !isNaN(event.start.getTime())); // Filter out invalid dates
  }, [data, calendarConfig]);

  // Get days in current month view - REMOVED (Handled by CalendarView)
  
  const handleCreate = useCallback(() => {
    // Standard "Create" action trigger
    const today = new Date();
    onDateClick?.(today);
  }, [onDateClick]);

  // --- NavigationConfig support ---
  // Must be called before any early returns to satisfy React hooks rules
  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick,
  });

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading calendar...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-destructive">Error: {error.message}</div>
        </div>
      </div>
    );
  }

  if (!calendarConfig) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">
            Calendar configuration required. Please specify startDateField and titleField.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={pullRef} className={className}>
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? 'Refreshing…' : 'Pull to refresh'}
        </div>
      )}
      <div className="border rounded-lg bg-background h-[calc(100vh-120px)] sm:h-[calc(100vh-160px)] md:h-[calc(100vh-200px)] min-h-[400px] sm:min-h-[600px]">
        <CalendarView
          events={events}
          currentDate={currentDate}
          view={(schema as any).defaultView || 'month'}
          locale={locale}
          onEventClick={(event) => {
            navigation.handleClick(event.data);
            onEventClick?.(event.data);
          }}
          onDateClick={onDateClick}
          onNavigate={(date) => {
            setCurrentDate(date);
            onNavigate?.(date);
          }}
          onViewChange={(v) => {
            setView(v);
            onViewChange?.(v);
          }}
          onAddClick={undefined}
          onEventDrop={onEventDrop ? (event, newStart, newEnd) => {
            onEventDrop(event.data, newStart, newEnd);
          } : undefined}
        />
      </div>
      {navigation.isOverlay && (
        <NavigationOverlay {...navigation} title="Event Details">
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
