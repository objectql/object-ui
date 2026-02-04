/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import type { DataSource, TimelineSchema } from '@object-ui/types';
import { useDataScope } from '@object-ui/react';
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
}

export const ObjectTimeline: React.FC<ObjectTimelineProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
            if ((results as any).value) {
                data = (results as any).value;
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

    if (schema.objectName && !boundData && !schema.items) {
        fetchData();
    }
  }, [schema.objectName, dataSource, boundData, schema.items]);

  const rawData = boundData || fetchedData;

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

  const effectiveSchema = {
      ...schema,
      items: effectiveItems || [],
      className: className || schema.className
  };

  if (error) {
      return (
        <div className="p-4 text-red-500">
            Error loading timeline: {error.message}
        </div>
      );
  }

  return <TimelineRenderer schema={effectiveSchema} />;
}
