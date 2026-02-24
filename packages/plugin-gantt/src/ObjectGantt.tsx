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
import { GanttConfigSchema } from '@objectstack/spec/ui';
import { useNavigationOverlay } from '@object-ui/react';
import { NavigationOverlay } from '@object-ui/components';
import { extractRecords } from '@object-ui/core';
import { GanttView, type GanttTask } from './GanttView';

export interface ObjectGanttProps {
  schema: ObjectGridSchema;
  dataSource?: DataSource;
  className?: string;
  onTaskClick?: (record: any) => void;
  onRowClick?: (record: any) => void;
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
function getGanttConfig(schema: ObjectGridSchema | any): GanttConfig | null {
  let config: GanttConfig | null = null;
  
  // 1. Check top-level properties (ObjectGanttSchema style)
  if (schema.startDateField && schema.endDateField) {
      config = {
          startDateField: schema.startDateField,
          endDateField: schema.endDateField,
          titleField: schema.titleField || 'name',
          progressField: schema.progressField,
          dependenciesField: schema.dependenciesField || schema.dependencyField,
          colorField: schema.colorField
      };
      return config;
  }

  // 2. Check schema.gantt (ObjectGridSchema style)
  if (schema.gantt) {
    config = schema.gantt as GanttConfig;
  }

  if (config) {
    const result = GanttConfigSchema.safeParse(config);
    if (!result.success) {
      console.warn(`[ObjectGantt] Invalid gantt configuration:`, result.error.format());
    }
    return config;
  }
  
  return null;
}

export const ObjectGantt: React.FC<ObjectGanttProps> = ({
  schema,
  dataSource,
  className,
  onTaskClick,
  onRowClick,
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);

  const rawDataConfig = getDataConfig(schema);
  // Memoize dataConfig using deep comparison to prevent infinite loops
  const dataConfig = useMemo(() => {
    return rawDataConfig;
  }, [JSON.stringify(rawDataConfig)]);

  const ganttConfig = getGanttConfig(schema);
  const hasInlineData = dataConfig?.provider === 'value';

  // Fetch data based on provider
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Check for data prop (Unified ListView)
        if ((rest as any).data && Array.isArray((rest as any).data)) {
            setData((rest as any).data);
            setLoading(false);
            return;
        }

        
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
          
          let items: any[] = extractRecords(result);
          setData(items);
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

    const { startDateField, endDateField, titleField, progressField, dependenciesField, colorField } = ganttConfig;

    return data.map((record, index) => {
      const startDate = record[startDateField];
      const endDate = record[endDateField];
      const title = record[titleField] || 'Untitled Task';
      const progress = progressField ? record[progressField] : 0;
      const dependencies = dependenciesField ? record[dependenciesField] : [];
      const color = colorField ? record[colorField] : undefined;

      return {
        id: record.id || record._id || `task-${index}`,
        title,
        start: startDate ? new Date(startDate) : new Date(),
        end: endDate ? new Date(endDate) : new Date(),
        progress: Math.min(100, Math.max(0, progress || 0)), // Clamp between 0-100
        dependencies: Array.isArray(dependencies) ? dependencies : [],
        color,
        data: record,
      };
    }).filter(task => !isNaN(task.start.getTime()) && !isNaN(task.end.getTime()));
  }, [data, ganttConfig]);

  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick,
  });

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

  return (
    <div className={className}>
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <GanttView 
          tasks={tasks}
          onTaskClick={(task) => {
            navigation.handleClick(task.data);
            onTaskClick?.(task.data);
          }}
          onAddClick={() => {
            // Placeholder for add action
          }}
        />
      </div>
      {navigation.isOverlay && (
        <NavigationOverlay {...navigation} title="Task Details">
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
