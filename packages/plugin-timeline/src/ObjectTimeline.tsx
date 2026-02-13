/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { DataSource, TimelineSchema } from '@object-ui/types';
import { useDataScope, useNavigationOverlay } from '@object-ui/react';
import { NavigationOverlay } from '@object-ui/components';
import { usePullToRefresh } from '@object-ui/mobile';
import { z } from 'zod';
import { TimelineRenderer } from './renderer';

const TimelineMappingSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  variant: z.string().optional(),
});

const TimelineExtensionSchema = z.object({
   mapping: TimelineMappingSchema.optional(),
   objectName: z.string().optional(),
   titleField: z.string().optional(),
   dateField: z.string().optional(),
   descriptionField: z.string().optional(),
});

export interface ObjectTimelineProps {
  schema: TimelineSchema & {
    objectName?: string;
    titleField?: string;
    dateField?: string;
    descriptionField?: string;
    // Map data fields to timeline item properties
    mapping?: {
      title?: string;
      date?: string;
      description?: string;
      variant?: string;
    }
  };
  dataSource?: DataSource;
  className?: string;
  onRowClick?: (record: any) => void;
  onItemClick?: (record: any) => void;
}

export const ObjectTimeline: React.FC<ObjectTimelineProps> = ({
  schema,
  dataSource,
  className,
  onRowClick,
  onItemClick,
  ...props
}) => {
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const result = TimelineExtensionSchema.safeParse(schema);
    if (!result.success) {
      console.warn(`[ObjectTimeline] Invalid timeline configuration:`, result.error.format());
    }
  }, [schema]);

  const boundData = useDataScope(schema.bind);

  useEffect(() => {
    const fetchData = async () => {
        if (!dataSource || !schema.objectName) return;
        setLoading(true);
        try {
            const results = await dataSource.find(schema.objectName, {
                options: { $top: 100 }
            });
            let data = results;
            if ((results as any).records) {
                data = (results as any).records;
            } else if ((results as any).data) {
                data = (results as any).data;
            }

            if (Array.isArray(data)) {
                setFetchedData(data);
            }
        } catch (e) {
            console.error(e);
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    };

    if (schema.objectName && !boundData && !schema.items && !(props as any).data) {
        fetchData();
    }
  }, [schema.objectName, dataSource, boundData, schema.items, (props as any).data, refreshKey]);

  const rawData = (props as any).data || boundData || fetchedData;

  // Transform data to items if we have raw data and no explicit items
  let effectiveItems = schema.items;
  
  if (!effectiveItems && rawData && Array.isArray(rawData)) {
      const titleField = schema.mapping?.title || schema.titleField || 'name';
      const dateField = schema.mapping?.date || schema.dateField || 'date';
      const descField = schema.mapping?.description || schema.descriptionField || 'description';
      const variantField = schema.mapping?.variant || 'variant';

      effectiveItems = rawData.map(item => ({
          title: item[titleField],
          // Support both 'time' (vertical) and 'startDate' (gantt)
          time: item[dateField],
          startDate: item[dateField], 
          endDate: item[dateField], // Default single point
          description: item[descField],
          variant: item[variantField] || 'default',
          // Pass original item for click handlers
          _data: item
      }));
  }

  const handleRefresh = useCallback(async () => {
    setRefreshKey(k => k + 1);
  }, []);

  const { ref: pullRef, isRefreshing, pullDistance } = usePullToRefresh<HTMLDivElement>({
    onRefresh: handleRefresh,
    enabled: !!schema.objectName && !!dataSource,
  });

  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick: onRowClick ?? onItemClick,
  });

  const effectiveSchema = {
      ...schema,
      items: effectiveItems || [],
      className: className || schema.className,
      onItemClick: (item: any) => {
        const record = item._data || item;
        navigation.handleClick(record);
        onItemClick?.(record);
      },
  };

  if (error) {
      return (
        <div className="p-4 text-red-500">
            Error loading timeline: {error.message}
        </div>
      );
  }

  return (
    <div ref={pullRef} className="relative overflow-auto h-full">
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: pullDistance }}
        >
          {isRefreshing ? 'Refreshing…' : 'Pull to refresh'}
        </div>
      )}
      <TimelineRenderer schema={effectiveSchema} />
      {navigation.isOverlay && (
        <NavigationOverlay {...navigation} title="Timeline Item">
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
}
