/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DataSource } from '@object-ui/types';
import { useDataScope, useNavigationOverlay } from '@object-ui/react';
import { NavigationOverlay } from '@object-ui/components';
import { extractRecords } from '@object-ui/core';
import { KanbanRenderer } from './index';
import { KanbanSchema } from './types';

export interface ObjectKanbanProps {
  schema: KanbanSchema;
  dataSource?: DataSource;
  className?: string; // Allow override
  onRowClick?: (record: any) => void;
  onCardClick?: (record: any) => void;
}

export const ObjectKanban: React.FC<ObjectKanbanProps> = ({
  schema,
  dataSource,
  className,
  onRowClick,
  onCardClick,
  ...props
}) => {
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [objectDef, setObjectDef] = useState<any>(null);
  // loading state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Resolve bound data if 'bind' property exists
  const boundData = useDataScope(schema.bind);

  // Fetch object definition for metadata (labels, options)
  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
        if (!dataSource || !schema.objectName) return;
        try {
            const def = await dataSource.getObjectSchema(schema.objectName);
            if (isMounted) setObjectDef(def);
        } catch (e) {
            console.warn("Failed to fetch object def", e);
        }
    };
    fetchMeta();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
        if (!dataSource || !schema.objectName) return;
        if (isMounted) setLoading(true);
        try {
            const results = await dataSource.find(schema.objectName, {
                options: { $top: 100 },
                $filter: schema.filter
            });
            
            // Handle { value: [] } OData shape or { data: [] } shape or direct array
            const data = extractRecords(results);

            console.log(`[ObjectKanban] Extracted data (length: ${data.length})`);

            if (isMounted) {
                setFetchedData(data);
            }
        } catch (e) {
            console.error('[ObjectKanban] Fetch error:', e);
            if (isMounted) setError(e as Error);
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    // Trigger fetch if we have an objectName AND verify no inline/bound data overrides it
    // And NO props.data passed from ListView
    if (schema.objectName && !boundData && !schema.data && !(props as any).data) {
        fetchData();
    }
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, (props as any).data]);

  // Determine which data to use: props.data -> bound -> inline -> fetched
  const rawData = (props as any).data || boundData || schema.data || fetchedData;

  // Enhance data with title mapping and ensure IDs
  const effectiveData = useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    
    // Support cardTitle property from schema (passed by ObjectView)
    // Fallback to legacy titleField for backwards compatibility
    let titleField = schema.cardTitle || (schema as any).titleField;

    // Fallback: Try to infer from object definition
    if (!titleField && objectDef) {
       // 1. Check for titleFormat like "{subject}" first (Higher priority for Cards)
       if (objectDef.titleFormat) {
           const match = /\{(.+?)\}/.exec(objectDef.titleFormat);
           if (match) titleField = match[1];
       }
       // 2. Check for standard NAME_FIELD_KEY
       if (!titleField && objectDef.NAME_FIELD_KEY) {
           titleField = objectDef.NAME_FIELD_KEY;
       } 
    }

    // Common title field names to try as fallback
    const TITLE_FALLBACK_FIELDS = ['name', 'title', 'subject', 'label', 'display_name'];

    return rawData.map(item => {
      // If a specific title field was configured, try it first
      let resolvedTitle = titleField ? item[titleField] : undefined;

      // Fallback: try common field names
      if (!resolvedTitle) {
        for (const field of TITLE_FALLBACK_FIELDS) {
          if (item[field]) {
            resolvedTitle = item[field];
            break;
          }
        }
      }

      return {
        ...item,
        // Ensure id exists
        id: item.id || item._id,
        // Map title
        title: resolvedTitle || 'Untitled',
      };
    });
  }, [rawData, schema, objectDef]);

  // Generate columns if missing but groupBy is present
  const effectiveColumns = useMemo(() => {
    // If columns exist, returns them (normalized)
    if (schema.columns && schema.columns.length > 0) {
        // If columns is array of strings, normalize to objects
        if (typeof schema.columns[0] === 'string') {
             // If grouping is active, assume string columns are meant for data display, not lanes
             if (!schema.groupBy) {
                 return (schema.columns as unknown as string[]).map(val => ({
                     id: val,
                     title: val
                 }));
             }
        } else {
             return schema.columns;
        }
    }

    // Try to get options from metadata
    if (schema.groupBy && objectDef?.fields?.[schema.groupBy]?.options) {
        return objectDef.fields[schema.groupBy].options.map((opt: any) => ({
            id: opt.value,
            title: opt.label
        }));
    }

    // If no columns, but we have groupBy and data, generate from data
    if (schema.groupBy && effectiveData.length > 0) {
        const groups = new Set(effectiveData.map(item => item[schema.groupBy!]));
        return Array.from(groups).map(g => ({
            id: String(g),
            title: String(g)
        }));
    }

    return [];
  }, [schema.columns, schema.groupBy, effectiveData, objectDef]);

  // Clone schema to inject data and className
  // Use grouping.fields[0].field as swimlaneField fallback when no explicit swimlaneField
  const effectiveSwimlaneField = schema.swimlaneField
    || (schema.grouping?.fields?.[0]?.field);

  const effectiveSchema = {
      ...schema,
      data: effectiveData,
      columns: effectiveColumns,
      className: className || schema.className,
      ...(effectiveSwimlaneField ? { swimlaneField: effectiveSwimlaneField } : {}),
  };

  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick: onRowClick ?? onCardClick,
  });

  if (error) {
      return (
        <div className="p-4 border border-destructive/50 rounded bg-destructive/10 text-destructive">
            Error loading kanban data: {error.message}
        </div>
      );
  }

  // Pass through to the renderer
  const detailTitle = schema.objectName
    ? `${schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1).replace(/_/g, ' ')} Detail`
    : 'Card Details';

  return (
    <>
      <KanbanRenderer schema={{
        ...effectiveSchema,
        onCardClick: (card: any) => {
          navigation.handleClick(card);
          onCardClick?.(card);
        },
      }} />
      {navigation.isOverlay && (
        <NavigationOverlay {...navigation} title={detailTitle}>
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
    </>
  );
}
