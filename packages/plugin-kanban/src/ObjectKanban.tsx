/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DataSource } from '@object-ui/types';
import { useDataScope } from '@object-ui/react';
import { KanbanRenderer } from './index';
import { KanbanSchema } from './types';

export interface ObjectKanbanProps {
  schema: KanbanSchema;
  dataSource?: DataSource;
  className?: string; // Allow override
}

export const ObjectKanban: React.FC<ObjectKanbanProps> = ({
  schema,
  dataSource,
  className,
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
    const fetchMeta = async () => {
        if (!dataSource || !schema.objectName) return;
        try {
            const def = await dataSource.getObject(schema.objectName);
            setObjectDef(def);
        } catch (e) {
            console.warn("Failed to fetch object def", e);
        }
    };
    fetchMeta();
  }, [schema.objectName, dataSource]);

  useEffect(() => {
    const fetchData = async () => {
        if (!dataSource || !schema.objectName) return;
        setLoading(true);
        try {
            // Simple find for now, usually we might want filters
            // Using a large limit or pagination would be needed for real apps,
            // for now, we assume a reasonable default.
            const results = await dataSource.find(schema.objectName, {
                options: { $top: 100 } // Fetch up to 100 cards
            });
            // Handle { value: [] } OData shape or { data: [] } shape or direct array
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

    // Trigger fetch if we have an objectName AND verify no inline/bound data overrides it
    if (schema.objectName && !boundData && !schema.data) {
        fetchData();
    }
  }, [schema.objectName, dataSource, boundData, schema.data]);

  // Determine which data to use: bound -> inline -> fetched
  const rawData = boundData || schema.data || fetchedData;

  // Enhance data with title mapping and ensure IDs
  const effectiveData = useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    
    // Support cardTitle property from schema (passed by ObjectView)
    // @ts-ignore - cardTitle might not be in KanbanSchema type definition yet
    const titleField = schema.cardTitle || (schema as any).titleField || 'name'; 
    
    return rawData.map(item => ({
      ...item,
      // Ensure id exists
      id: item.id || item._id,
      // Map title
      title: item[titleField] || item.title || 'Untitled',
    }));
  }, [rawData, schema]);

  // Generate columns if missing but groupBy is present
  const effectiveColumns = useMemo(() => {
    // If columns exist, returns them (normalized)
    if (schema.columns && schema.columns.length > 0) {
        // If columns is array of strings, normalize to objects
        if (typeof schema.columns[0] === 'string') {
             return (schema.columns as unknown as string[]).map(val => ({
                 id: val,
                 title: val
             }));
        }
        return schema.columns;
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
  const effectiveSchema = {
      ...schema,
      data: effectiveData,
      columns: effectiveColumns,
      className: className || schema.className
  };

  if (error) {
      return (
        <div className="p-4 border border-destructive/50 rounded bg-destructive/10 text-destructive">
            Error loading kanban data: {error.message}
        </div>
      );
  }

  // Pass through to the renderer
  return <KanbanRenderer schema={effectiveSchema} />;
}
