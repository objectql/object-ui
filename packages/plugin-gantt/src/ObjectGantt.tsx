/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectGantt Component
 * 
 * A specialized Gantt chart component that works with ObjectQL data sources.
 * Displays tasks with date ranges, progress, and dependencies.
 * Implements the gantt view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Gantt chart timeline visualization
 * - Task progress tracking (0-100%)
 * - Task dependencies visualization
 * - Date range display
 * - Auto-scrolling timeline
 * - Works with object/api/value data providers
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { ObjectGridSchema, DataSource, ViewData, GanttConfig } from '@object-ui/types';

export interface ObjectGanttProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onTaskClick?: (record: any) => void;
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
 * Helper to get gantt configuration from schema
 */
function getGanttConfig(schema: ObjectGridSchema): GanttConfig | null {
  // Check if schema has gantt configuration
  if (schema.filter && typeof schema.filter === 'object' && 'gantt' in schema.filter) {
    return (schema.filter as any).gantt as GanttConfig;
  }
  
  // For backward compatibility, check if schema has gantt config at root
  if ((schema as any).gantt) {
    return (schema as any).gantt as GanttConfig;
  }
  
  return null;
}

export const ObjectGantt: React.FC<ObjectGanttProps> = ({
  schema,
  dataSource,
  className,
  onTaskClick,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);

  const dataConfig = getDataConfig(schema);
  const ganttConfig = getGanttConfig(schema);
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
          console.warn('API provider not yet implemented for ObjectGantt');
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

  // Transform data to gantt tasks
  const tasks = useMemo(() => {
    if (!ganttConfig || !data.length) {
      return [];
    }

    const { startDateField, endDateField, titleField, progressField, dependenciesField } = ganttConfig;

    return data.map((record, index) => {
      const startDate = record[startDateField];
      const endDate = record[endDateField];
      const title = record[titleField] || 'Untitled Task';
      const progress = progressField ? record[progressField] : 0;
      const dependencies = dependenciesField ? record[dependenciesField] : [];

      return {
        id: record.id || record._id || `task-${index}`,
        title,
        start: startDate ? new Date(startDate) : new Date(),
        end: endDate ? new Date(endDate) : new Date(),
        progress: Math.min(100, Math.max(0, progress || 0)), // Clamp between 0-100
        dependencies: Array.isArray(dependencies) ? dependencies : [],
        data: record,
      };
    }).filter(task => !isNaN(task.start.getTime()) && !isNaN(task.end.getTime()));
  }, [data, ganttConfig]);

  // Calculate timeline range
  const timelineRange = useMemo(() => {
    if (!tasks.length) {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 3, 0),
      };
    }

    const allDates = tasks.flatMap(task => [task.start, task.end]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    // Add some padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    return { start: minDate, end: maxDate };
  }, [tasks]);

  // Generate month headers
  const months = useMemo(() => {
    const result = [];
    const current = new Date(timelineRange.start);
    current.setDate(1);

    while (current <= timelineRange.end) {
      result.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }, [timelineRange]);

  // Calculate task bar position and width
  const getTaskPosition = (task: any) => {
    const totalDays = (timelineRange.end.getTime() - timelineRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const taskStart = (task.start.getTime() - timelineRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const taskDuration = (task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24);

    return {
      left: `${(taskStart / totalDays) * 100}%`,
      width: `${(taskDuration / totalDays) * 100}%`,
    };
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading Gantt chart...</div>
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

  if (!ganttConfig) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">
            Gantt configuration required. Please specify startDateField, endDateField, and titleField.
          </div>
        </div>
      </div>
    );
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className={className}>
      <div className="border rounded-lg bg-background overflow-hidden">
        <div className="flex">
          {/* Task List */}
          <div className="w-64 border-r flex-shrink-0">
            <div className="border-b p-3 font-semibold bg-muted">Tasks</div>
            <div>
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="border-b p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => onTaskClick?.(task.data)}
                >
                  <div className="font-medium text-sm truncate">{task.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {task.start.toLocaleDateString()} - {task.end.toLocaleDateString()}
                  </div>
                  {task.progress > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-x-auto">
            {/* Month Headers */}
            <div className="border-b bg-muted sticky top-0 z-10">
              <div className="flex">
                {months.map((month, index) => {
                  const daysInMonth = new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    0
                  ).getDate();
                  
                  return (
                    <div
                      key={index}
                      className="border-r p-3 text-center font-semibold text-sm"
                      style={{ minWidth: `${daysInMonth * 20}px` }}
                    >
                      {monthNames[month.getMonth()]} {month.getFullYear()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Bars */}
            <div className="relative">
              {tasks.map((task) => {
                const position = getTaskPosition(task);
                
                return (
                  <div
                    key={task.id}
                    className="border-b relative"
                    style={{ height: '60px' }}
                  >
                    {/* Month grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {months.map((month, idx) => {
                        const daysInMonth = new Date(
                          month.getFullYear(),
                          month.getMonth() + 1,
                          0
                        ).getDate();
                        
                        return (
                          <div
                            key={idx}
                            className="border-r"
                            style={{ minWidth: `${daysInMonth * 20}px` }}
                          />
                        );
                      })}
                    </div>

                    {/* Task Bar */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-8 bg-primary/80 rounded cursor-pointer hover:bg-primary transition-colors flex items-center px-2 text-white text-xs font-medium overflow-hidden"
                      style={position}
                      onClick={() => onTaskClick?.(task.data)}
                    >
                      {/* Progress overlay */}
                      {task.progress > 0 && (
                        <div
                          className="absolute inset-0 bg-primary-foreground/20"
                          style={{ width: `${task.progress}%` }}
                        />
                      )}
                      <span className="relative z-10 truncate">{task.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
