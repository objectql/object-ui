/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { DataSource, TimelineSchema, TimelineConfig } from '@object-ui/types';
import { useDataScope, useNavigationOverlay } from '@object-ui/react';
import { NavigationOverlay } from '@object-ui/components';
import { extractRecords, buildExpandFields } from '@object-ui/core';
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
   /** @deprecated Use startDateField instead */
   dateField: z.string().optional(),
   startDateField: z.string().optional(),
   endDateField: z.string().optional(),
   descriptionField: z.string().optional(),
   groupByField: z.string().optional(),
   colorField: z.string().optional(),
   scale: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional(),
});

export interface ObjectTimelineProps {
  schema: TimelineSchema & {
    objectName?: string;
    /** Spec-compliant nested timeline config */
    timeline?: TimelineConfig;
    /** @deprecated Use timeline.titleField instead */
    titleField?: string;
    /** @deprecated Use timeline.startDateField instead */
    dateField?: string;
    /** @deprecated Use timeline.startDateField instead */
    startDateField?: string;
    /** @deprecated Use timeline.endDateField instead */
    endDateField?: string;
    descriptionField?: string;
    /** @deprecated Use timeline.groupByField instead */
    groupByField?: string;
    /** @deprecated Use timeline.colorField instead */
    colorField?: string;
    /** @deprecated Use timeline.scale instead */
    scale?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
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
  const [objectDef, setObjectDef] = useState<any>(null);

  // Resolve nested TimelineConfig (spec-compliant)
  const timelineConfig = schema.timeline;

  useEffect(() => {
    const result = TimelineExtensionSchema.safeParse(schema);
    if (!result.success) {
      console.warn(`[ObjectTimeline] Invalid timeline configuration:`, result.error.format());
    }
  }, [schema]);

  const boundData = useDataScope(schema.bind);

  // Fetch object definition for metadata
  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
      if (!dataSource || typeof dataSource.getObjectSchema !== 'function' || !schema.objectName) return;
      try {
        const def = await dataSource.getObjectSchema(schema.objectName);
        if (isMounted) setObjectDef(def);
      } catch (e) {
        console.warn('Failed to fetch object def for ObjectTimeline', e);
      }
    };
    fetchMeta();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  useEffect(() => {
    const fetchData = async () => {
        if (!dataSource || typeof dataSource.find !== 'function' || !schema.objectName) return;
        setLoading(true);
        try {
            // Auto-inject $expand for lookup/master_detail fields
            const expand = buildExpandFields(objectDef?.fields);
            const results = await dataSource.find(schema.objectName, {
                options: { $top: 100 },
                ...(expand.length > 0 ? { $expand: expand } : {}),
            });
            const data = extractRecords(results);
            setFetchedData(data);
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
  }, [schema.objectName, dataSource, boundData, schema.items, (props as any).data, refreshKey, objectDef]);

  const rawData = (props as any).data || boundData || fetchedData;

  // Transform data to items if we have raw data and no explicit items
  let effectiveItems = schema.items;
  
  if (!effectiveItems && rawData && Array.isArray(rawData)) {
      // Resolve TimelineConfig with backwards-compatible fallbacks
      const titleField = timelineConfig?.titleField ?? schema.mapping?.title ?? schema.titleField ?? 'name';
      // Spec-compliant: prefer timeline.startDateField, fallback to flat props
      const startDateField = timelineConfig?.startDateField ?? schema.mapping?.date ?? schema.startDateField ?? schema.dateField ?? 'date';
      const endDateField = timelineConfig?.endDateField ?? schema.endDateField ?? startDateField;
      const descField = schema.mapping?.description ?? schema.descriptionField ?? 'description';
      const variantField = schema.mapping?.variant ?? 'variant';
      const groupByField = timelineConfig?.groupByField ?? schema.groupByField;
      const colorField = timelineConfig?.colorField ?? schema.colorField;

      effectiveItems = rawData.map(item => ({
          title: item[titleField],
          // Support both 'time' (vertical) and 'startDate' (gantt)
          time: item[startDateField],
          startDate: item[startDateField], 
          endDate: item[endDateField],
          description: item[descField],
          variant: item[variantField] || 'default',
          // Spec-compliant: group and color support
          ...(groupByField ? { group: item[groupByField] } : {}),
          ...(colorField ? { color: item[colorField] } : {}),
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

  // Resolve scale: spec timeline.scale takes priority over flat schema.scale
  const resolvedScale = timelineConfig?.scale ?? schema.scale;

  const effectiveSchema = {
      ...schema,
      items: effectiveItems || [],
      className: className || schema.className,
      // Map spec 'scale' to renderer 'timeScale' (used by gantt variant)
      ...(resolvedScale ? { timeScale: resolvedScale } : {}),
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
    <div ref={pullRef} className="relative overflow-auto h-full min-w-0">
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
