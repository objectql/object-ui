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

export interface ObjectCalendarProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onEventClick?: (record: any) => void;
  onDateClick?: (date: Date) => void;
  onEdit?: (record: any) => void;
  onDelete?: (record: any) => void;
}

/**
 * Helper to get data configuration from schema
 */
function getDataConfig(schema: ObjectGridSchema): ViewData | null {
  if (schema.data) {
    return schema.data;
  }
  
  if (schema.staticData) {
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
function getCalendarConfig(schema: ObjectGridSchema): CalendarConfig | null {
  // Check if schema has calendar configuration
  if (schema.filter && typeof schema.filter === 'object' && 'calendar' in schema.filter) {
    return (schema.filter as any).calendar as CalendarConfig;
  }
  
  // For backward compatibility, check if schema has calendar config at root
  if ((schema as any).calendar) {
    return (schema as any).calendar as CalendarConfig;
  }
  
  // Check for flat properties (used by ObjectView)
  if ((schema as any).dateField) {
      return {
          startDateField: (schema as any).dateField,
          endDateField: (schema as any).endField,
          titleField: (schema as any).titleField || 'name',
          colorField: (schema as any).colorField
      } as CalendarConfig;
  }

  return null;
}

export const ObjectCalendar: React.FC<ObjectCalendarProps> = ({
  schema,
  dataSource,
  className,
  onEventClick,
  onDateClick,
}) => {
  console.log('ObjectCalendar Schema:', JSON.stringify(schema)); 
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  const dataConfig = getDataConfig(schema);
  const calendarConfig = getCalendarConfig(schema);
  const hasInlineData = dataConfig?.provider === 'value';

  // Fetch data based on provider
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        if (hasInlineData && dataConfig?.provider === 'value') {
          setData(dataConfig.items as any[]);
          setLoading(false);
          return;
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
          setData(result?.data || []);
        } else if (dataConfig?.provider === 'api') {
          console.warn('API provider not yet implemented for ObjectCalendar');
          setData([]);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchData();
  }, [dataConfig, dataSource, hasInlineData, schema.filter, schema.sort]);

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

  // Get days in current month view
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = new Date(firstDay);
    startDay.setDate(startDay.getDate() - startDay.getDay()); // Start from Sunday
    
    const days: Date[] = [];
    const current = new Date(startDay);
    
    // Get 6 weeks worth of days
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  // Get events for a specific day
  const getEventsForDay = useCallback((day: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      eventStart.setHours(0, 0, 0, 0);
      const eventEnd = event.end ? new Date(event.end) : eventStart;
      eventEnd.setHours(23, 59, 59, 999);
      
      const checkDay = new Date(day);
      checkDay.setHours(0, 0, 0, 0);
      
      return checkDay >= eventStart && checkDay <= eventEnd;
    });
  }, [events]);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  }, []);

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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={className}>
      <div className="border rounded-lg bg-background">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="px-3 py-1 border rounded hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-px mb-px">
            {dayNames.map(day => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-px bg-border">
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = 
                day.getDate() === new Date().getDate() &&
                day.getMonth() === new Date().getMonth() &&
                day.getFullYear() === new Date().getFullYear();

              return (
                <div
                  key={index}
                  className={`min-h-24 bg-background p-2 ${
                    !isCurrentMonth ? 'text-muted-foreground bg-muted/30' : ''
                  } ${isToday ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => onDateClick?.(day)}
                >
                  <div className="text-sm font-medium mb-1">{day.getDate()}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        className="text-xs px-1 py-0.5 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event.data);
                        }}
                        style={event.color ? { borderLeft: `3px solid ${event.color}` } : undefined}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
