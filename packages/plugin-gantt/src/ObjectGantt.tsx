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

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ObjectGridSchema, DataSource, ViewData, GanttConfig } from '@object-ui/types';
import { GanttConfigSchema } from '@objectstack/spec/ui';
import { useNavigationOverlay } from '@object-ui/react';
import { RecordDetailDrawer, deriveRecordPageHref } from '@object-ui/plugin-detail';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@object-ui/components';
import { extractRecords, buildExpandFields } from '@object-ui/core';
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

        if (!dataSource || typeof dataSource.find !== 'function') {
          throw new Error('DataSource required for object/api providers');
        }

        if (dataConfig?.provider === 'object') {
          const objectName = dataConfig.object;
          // Auto-inject $expand for lookup/master_detail fields
          const expand = buildExpandFields(objectSchema?.fields);
          const result = await dataSource.find(objectName, {
            $filter: schema.filter,
            $orderby: convertSortToQueryParams(schema.sort),
            ...(expand.length > 0 ? { $expand: expand } : {}),
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
  }, [dataConfig, dataSource, hasInlineData, schema.filter, schema.sort, objectSchema]);

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

    // Resolve a value through nested paths like "account.name". Returns the
    // first non-empty string from the path (so lookups that resolve to either a
    // FK string or an embedded object both work).
    const resolvePath = (record: any, path: string): unknown => {
      if (!path) return undefined;
      const parts = path.split('.');
      let cur: any = record;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    };

    // Fallback chain: configured titleField → object's `name`/`title`/`subject`
    // → embedded lookup display label → record id. Avoids the dreaded
    // "Untitled Task" placeholder when an autonumber/title field is null but
    // other identifying data exists on the record.
    const resolveTitle = (record: any): string => {
      const candidates: unknown[] = [
        resolvePath(record, titleField),
        record?.name,
        record?.title,
        record?.subject,
        record?.label,
        // Common single embedded lookup labels (e.g. account.name on a contract).
        record?.account?.name,
        record?.opportunity?.name,
        record?.contact && [record.contact.first_name, record.contact.last_name].filter(Boolean).join(' '),
        record?.id,
        record?._id,
      ];
      for (const v of candidates) {
        if (v != null && String(v).trim() !== '') return String(v);
      }
      return 'Untitled';
    };

    return data.map((record, index) => {
      const startDate = record[startDateField];
      const endDate = record[endDateField];
      const title = resolveTitle(record);
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

  // Default to a right-side drawer so clicking a task opens an editable
  // detail panel inline (no full-page navigation). Schema can override by
  // providing its own `navigation` config (e.g., page mode).
  // detail panel inline (no full-page navigation). Schema can override by
  // providing its own `navigation` config (e.g., page mode).
  const navConfig = (schema as any).navigation ?? { mode: 'drawer', width: 'min(960px, 60vw)' };
  const navIsOverlay = navConfig.mode === 'drawer' || navConfig.mode === 'modal' || navConfig.mode === 'split' || navConfig.mode === 'popover';
  const navigation = useNavigationOverlay({
    navigation: navConfig,
    objectName: schema.objectName,
    onRowClick: navIsOverlay ? undefined : onRowClick,
  });

  // Persist a drag-driven reschedule back to the data source. Mirrors
  // ObjectCalendar.handleEventDropDefault: optimistic local patch, then
  // dataSource.update; on failure we revert and log.
  const handleTaskUpdateDefault = useCallback(
    async (task: GanttTask, changes: { start?: Date; end?: Date; title?: string; progress?: number }) => {
      if (!ganttConfig) return;
      const objectName =
        dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName;
      if (!objectName || !dataSource || typeof dataSource.update !== 'function') return;

      const { startDateField, endDateField, titleField, progressField } = ganttConfig;
      const patch: Record<string, unknown> = {};
      if (changes.start instanceof Date) patch[startDateField] = changes.start.toISOString();
      if (changes.end instanceof Date) patch[endDateField] = changes.end.toISOString();
      if (typeof changes.title === 'string' && titleField) patch[titleField] = changes.title;
      if (typeof changes.progress === 'number' && progressField) patch[progressField] = changes.progress;
      if (Object.keys(patch).length === 0) return;

      const recordId = (task as any).data?.id ?? (task as any).data?._id ?? task.id;
      if (recordId == null) return;

      // Optimistic update — replace the matching record in local state.
      const prevSnapshot = data;
      setData((prev) =>
        prev.map((r) =>
          String(r.id ?? r._id) === String(recordId) ? { ...r, ...patch } : r,
        ),
      );

      try {
        await dataSource.update(objectName, String(recordId), patch);
      } catch (err) {
        console.error('[ObjectGantt] Failed to persist task update:', err);
        setData(prevSnapshot); // revert
      }
    },
    [ganttConfig, dataConfig, dataSource, schema.objectName, data],
  );

  // -- Quick-create dialog removed --
  // The toolbar's "+ New Task" button only collected 3 fields (title +
  // start + end) which silently failed on objects with required fields
  // outside that set. The page-level header already exposes a fully-
  // fielded create form, so we defer to that instead of maintaining a
  // half-broken inline path.

  // -- Delete confirmation --
  // GanttView's row kebab calls onTaskDelete(task) -> we open an AlertDialog,
  // then issue dataSource.delete on confirm. Optimistic local removal; revert
  // on failure.
  const [pendingDelete, setPendingDelete] = useState<GanttTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  const requestDelete = useCallback((task: GanttTask) => {
    setPendingDelete(task);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const objectName =
      dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName;
    if (!objectName || !dataSource?.delete) {
      setPendingDelete(null);
      return;
    }
    const recordId =
      (pendingDelete as any).data?.id ?? (pendingDelete as any).data?._id ?? pendingDelete.id;
    if (recordId == null) {
      setPendingDelete(null);
      return;
    }

    setDeleting(true);
    const prevSnapshot = data;
    setData((prev) =>
      prev.filter((r) => String(r.id ?? r._id) !== String(recordId)),
    );
    try {
      await dataSource.delete(objectName, String(recordId));
      setPendingDelete(null);
    } catch (err) {
      console.error('[ObjectGantt] Failed to delete:', err);
      setData(prevSnapshot); // revert
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, dataConfig, dataSource, schema.objectName, data]);

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
          onTaskUpdate={handleTaskUpdateDefault}
          onTaskDelete={requestDelete}
          inlineEdit
        />
      </div>
      {navigation.isOverlay && navigation.isOpen && navigation.selectedRecord && (() => {
        const objectName = dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName;
        const rec = navigation.selectedRecord as Record<string, any>;
        const recordId = rec.id ?? rec._id;
        if (!objectName || recordId == null) return null;
        const titleText = ganttConfig?.titleField
          ? String(rec[ganttConfig.titleField] ?? 'Task Details')
          : 'Task Details';

        return (
          <RecordDetailDrawer
            open
            onClose={navigation.close}
            title={titleText}
            record={rec}
            objectName={objectName}
            recordId={recordId}
            dataSource={dataSource}
            objectSchema={objectSchema as any}
            width={navigation.width as any}
            fullPageHref={deriveRecordPageHref(objectName, recordId) ?? undefined}
            onFieldSave={async (field, value) => {
              if (!dataSource?.update) return;
              await dataSource.update(objectName, String(recordId), { [field]: value });
              setData((prev) => prev.map((r) =>
                String(r.id ?? r._id) === String(recordId)
                  ? { ...r, [field]: value }
                  : r,
              ));
            }}
            onDelete={async () => {
              if (!dataSource?.delete) return;
              await dataSource.delete(objectName, String(recordId));
              setData((prev) => prev.filter((r) =>
                String(r.id ?? r._id) !== String(recordId),
              ));
            }}
          />
        );
      })()}


      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>"{pendingDelete.title}" will be permanently removed. This action cannot be undone.</>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              disabled={deleting}
              data-testid="gantt-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
