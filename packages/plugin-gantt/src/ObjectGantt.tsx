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
import {
  getSemanticColorName,
  getSemanticHex,
  humanizeLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatCurrency,
} from '@object-ui/fields';
import { GanttView, type GanttTask, type GanttDependency, type GanttLinkType, type GanttTaskType, type GanttViewMode } from './GanttView';
import { ResourceWorkload } from './ResourceWorkload';
import { QuickFilterBar, type QuickFilterField, type QuickFilterOption } from './QuickFilterBar';
import type { WorkingCalendar } from './scheduling';

/**
 * One quick-filter dimension (快速筛选维度). Generic by design: the page configures
 * which record fields become filter dropdowns; the plugin resolves each one's
 * options from the object schema (select options / lookup reference records) so
 * no business field names are baked into the (MIT) plugin.
 */
export interface QuickFilterDef {
  /** Record field / dot-path the dimension filters on. */
  field: string;
  /** Trigger label (falls back to the schema field label / humanized name). */
  label?: string;
  /**
   * Explicit option override. Highest priority — use for fixed enums that are
   * not modeled as select options (e.g. 派工类别). Plain strings become
   * value === label; objects allow a distinct display label.
   */
  options?: Array<string | { value: string | number; label?: string }>;
}

/**
 * Hierarchy/type fields are ObjectUI extensions on top of the spec's
 * GanttConfig (not yet in @objectstack/spec GanttConfigSchema).
 */
type GanttConfigEx = GanttConfig & {
  parentField?: string;
  /**
   * Record field whose value maps onto a node kind (see {@link normalizeTaskType}):
   * `task` / `summary` (project/phase) / `milestone` / `group`. `group` (or
   * `folder`) renders a pure tree header with NO bar — for 项目/产品 style levels
   * that only group, never schedule.
   */
  typeField?: string;
  /** Baseline (planned) start/end fields → planned-vs-actual reference bars. */
  baselineStartField?: string;
  baselineEndField?: string;
  /**
   * Dynamic Group by (动态 Group by). When set, leaf tasks are bucketed by this
   * field and rendered under one synthesized summary row per distinct value
   * (replacing the parent hierarchy). Select options / lookups resolve to their
   * display label, matching list/kanban grouping.
   */
  groupByField?: string;
  /**
   * Resource / Workload view (资源/工作负载视图). When true, the chart renders a
   * per-resource load histogram instead of the timeline grid: each task loads
   * its `assigneeField` resource by `effortField` units (default 1) over its
   * span, and any column whose summed load exceeds `capacity` is flagged as
   * over-allocated. `assigneeField` is required for this view to bucket by.
   */
  resourceView?: boolean;
  assigneeField?: string;
  effortField?: string;
  /** Per-resource capacity ceiling (default 1). Loads above this flag overload. */
  capacity?: number;
  /**
   * Quick filters (快速筛选). A row of multi-select dropdowns rendered above the
   * chart; each narrows the visible task bars by one dimension. Options resolve
   * from the object schema (select options or lookup reference records) so the
   * lists are the full domain, not just values present in the current data.
   */
  quickFilters?: QuickFilterDef[];
  /**
   * When true (default), filtering recomputes the timeline range so it zooms to
   * the filtered tasks' interval. Set false to keep the range pinned to the full
   * (unfiltered) task set while filtering only hides bars.
   */
  autoZoomToFilter?: boolean;
};

/** Map a record's type value onto a GanttTaskType (undefined = infer). */
export function normalizeTaskType(raw: unknown): GanttTaskType | undefined {
  if (raw == null) return undefined;
  const key = String(raw).toLowerCase().trim();
  if (key === 'milestone') return 'milestone';
  // Pure grouping header (无条): a tree node with no timeline bar. Use for
  // 项目/产品 style levels that只分组、不排期.
  if (key === 'group' || key === 'folder') return 'group';
  if (key === 'summary' || key === 'project' || key === 'phase') return 'summary';
  if (key === 'task') return 'task';
  return undefined;
}

/**
 * Normalize a record's dependencies field into GanttDependency[].
 * Accepts:
 * - CSV string: "task1, task2"
 * - array of ids: ["task1", 42]
 * - array of objects: [{ id: "task1", type: "ss" }] — `task`/`target`/`_id`
 *   accepted as id aliases; type aliases like "finish_to_start"/"end-to-start"
 *   map onto fs/ss/ff/sf.
 */
const LINK_TYPE_ALIASES: Record<string, GanttLinkType> = {
  fs: 'fs', ss: 'ss', ff: 'ff', sf: 'sf',
  finish_to_start: 'fs', start_to_start: 'ss', finish_to_finish: 'ff', start_to_finish: 'sf',
  end_to_start: 'fs', end_to_end: 'ff', start_to_end: 'sf',
};

export function normalizeDependencies(raw: unknown): GanttDependency[] {
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'number') return [raw];
  if (!Array.isArray(raw)) return [];
  const out: GanttDependency[] = [];
  for (const item of raw) {
    if (item == null || item === '') continue;
    if (typeof item === 'object') {
      const id = (item as any).id ?? (item as any)._id ?? (item as any).task ?? (item as any).target;
      if (id == null || id === '') continue;
      const typeKey = String((item as any).type ?? '').toLowerCase().replace(/-/g, '_');
      const type = LINK_TYPE_ALIASES[typeKey];
      out.push(type ? { id, type } : { id });
    } else {
      out.push(item as string | number);
    }
  }
  return out;
}

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
function getGanttConfig(schema: ObjectGridSchema | any): GanttConfigEx | null {
  let config: GanttConfigEx | null = null;

  // 1. Check top-level properties (ObjectGanttSchema style)
  if (schema.startDateField && schema.endDateField) {
      config = {
          startDateField: schema.startDateField,
          endDateField: schema.endDateField,
          titleField: schema.titleField || 'name',
          progressField: schema.progressField,
          dependenciesField: schema.dependenciesField || schema.dependencyField,
          colorField: schema.colorField,
          parentField: schema.parentField,
          typeField: schema.typeField,
          tooltipFields: schema.tooltipFields,
          baselineStartField: schema.baselineStartField,
          baselineEndField: schema.baselineEndField,
          groupByField: schema.groupByField,
          resourceView: schema.resourceView,
          assigneeField: schema.assigneeField,
          effortField: schema.effortField,
          capacity: schema.capacity,
          quickFilters: schema.quickFilters,
          autoZoomToFilter: schema.autoZoomToFilter,
      };
      return config;
  }

  // 2. Check schema.gantt (ObjectGridSchema style)
  if (schema.gantt) {
    config = schema.gantt as GanttConfigEx;
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

    const { startDateField, endDateField, titleField, progressField, dependenciesField, colorField, parentField, typeField, tooltipFields, baselineStartField, baselineEndField } = ganttConfig;
    const fieldDefs: Record<string, any> = objectSchema?.fields ?? {};

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

    // Label for a tooltip field: explicit override → object schema label →
    // humanized field name (so "due_date" reads as "Due Date").
    const resolveFieldLabel = (fieldName: string, explicit?: string): string => {
      if (explicit) return explicit;
      const def = fieldDefs[fieldName] ?? fieldDefs[fieldName.split('.')[0]];
      if (def?.label) return def.label;
      return humanizeLabel(fieldName);
    };

    // Format a tooltip value by its field type, mirroring how list/grid cells
    // render the same data: select options resolve to their label, lookups to
    // the embedded record's name, dates/numbers/currency/percent through the
    // shared @object-ui/fields formatters.
    const formatFieldValue = (value: unknown, fieldName: string): string => {
      if (value == null || value === '') return '—';
      const def = fieldDefs[fieldName] ?? fieldDefs[fieldName.split('.')[0]];
      const type: string | undefined = def?.type;
      const options: Array<{ value: unknown; label: string }> | undefined = def?.options;
      if (Array.isArray(options) && options.length) {
        const opt = options.find((o) => String(o.value) === String(value));
        if (opt) return opt.label;
      }
      switch (type) {
        case 'date':
          return formatDate(value as any);
        case 'datetime':
          return formatDateTime(value as any);
        case 'number':
        case 'integer':
        case 'float':
        case 'decimal':
          return formatNumber(Number(value));
        case 'currency':
          return formatCurrency(Number(value));
        case 'percent':
          return formatPercent(Number(value));
        case 'boolean':
        case 'checkbox':
          return value ? 'Yes' : 'No';
        default:
          // Multi-value lookup / multiselect: a populated relation array is
          // [{name},{name}] — also `typeof 'object'`, but with no
          // name/label/title/id of its own. Map each element to its display
          // value (scalars pass through) and join, so e.g. 执行责任人 renders
          // the assignees instead of collapsing to '—'.
          if (Array.isArray(value)) {
            const parts = value
              .map((el) => {
                if (el == null) return '';
                if (typeof el === 'object') {
                  const o = el as any;
                  return String(o.name ?? o.label ?? o.title ?? o.id ?? '');
                }
                return String(el);
              })
              .filter(Boolean);
            return parts.length ? parts.join(', ') : '—';
          }
          if (typeof value === 'object') {
            const o = value as any;
            return String(o.name ?? o.label ?? o.title ?? o.id ?? '—');
          }
          return String(value);
      }
    };

    const buildTooltipFields = (record: any): Array<{ label: string; value: string }> | undefined => {
      if (!tooltipFields || !tooltipFields.length) return undefined;
      const rows: Array<{ label: string; value: string }> = [];
      for (const entry of tooltipFields) {
        const fieldName = typeof entry === 'string' ? entry : entry?.field;
        if (!fieldName) continue;
        const explicitLabel = typeof entry === 'object' ? entry.label : undefined;
        rows.push({
          label: resolveFieldLabel(fieldName, explicitLabel),
          value: formatFieldValue(resolvePath(record, fieldName), fieldName),
        });
      }
      return rows.length ? rows : undefined;
    };

    return data.map((record, index) => {
      const startDate = record[startDateField];
      const endDate = record[endDateField];
      const baselineStartRaw = baselineStartField ? record[baselineStartField] : undefined;
      const baselineEndRaw = baselineEndField ? record[baselineEndField] : undefined;
      const baselineStart = baselineStartRaw ? new Date(baselineStartRaw) : undefined;
      const baselineEnd = baselineEndRaw ? new Date(baselineEndRaw) : undefined;
      const title = resolveTitle(record);
      const progress = progressField ? record[progressField] : 0;
      const dependencies = dependenciesField ? record[dependenciesField] : [];
      // Bar color resolution:
      //   1. explicit `colorField` value (hex or semantic name) — metadata wins.
      //   2. fall back to the record's status / state / priority field so
      //      the timeline reflects the same color story as list/kanban.
      //   3. if neither exists, GanttView paints the platform default blue.
      let color = colorField ? record[colorField] : undefined;
      if (!color) {
        const fallbackVal =
          record.status ?? record.state ?? record.priority ?? record.severity;
        if (fallbackVal != null && fallbackVal !== '') {
          const name = getSemanticColorName(undefined, fallbackVal);
          if (name) color = getSemanticHex(name);
        }
      }

      return {
        id: record.id || record._id || `task-${index}`,
        title,
        start: startDate ? new Date(startDate) : new Date(),
        end: endDate ? new Date(endDate) : new Date(),
        progress: Math.min(100, Math.max(0, progress || 0)), // Clamp between 0-100
        dependencies: normalizeDependencies(dependencies),
        parent: parentField ? record[parentField] ?? null : undefined,
        type: typeField ? normalizeTaskType(record[typeField]) : undefined,
        color,
        baselineStart: baselineStart && !isNaN(baselineStart.getTime()) ? baselineStart : undefined,
        baselineEnd: baselineEnd && !isNaN(baselineEnd.getTime()) ? baselineEnd : undefined,
        fields: buildTooltipFields(record),
        data: record,
      };
    }).filter(task => !isNaN(task.start.getTime()) && !isNaN(task.end.getTime()));
  }, [data, ganttConfig, objectSchema]);

  // Dynamic Group by accessor (动态 Group by). Resolves each task's grouping
  // value off its backing record, mapping select options / lookups to their
  // display label — the same value story as list/kanban grouping. Returns null
  // for empty values so those tasks fall into GanttView's "ungrouped" bucket.
  const groupByAccessor = useMemo(() => {
    const field = ganttConfig?.groupByField;
    if (!field) return undefined;
    const fieldDefs: Record<string, any> = objectSchema?.fields ?? {};
    const resolvePath = (record: any, path: string): unknown => {
      if (!path) return undefined;
      let cur: any = record;
      for (const p of path.split('.')) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    };
    const labelFor = (value: unknown): string => {
      const def = fieldDefs[field] ?? fieldDefs[field.split('.')[0]];
      const options: Array<{ value: unknown; label: string }> | undefined = def?.options;
      if (Array.isArray(options) && options.length) {
        const opt = options.find((o) => String(o.value) === String(value));
        if (opt) return opt.label;
      }
      if (typeof value === 'object' && value !== null) {
        const o = value as any;
        return String(o.name ?? o.label ?? o.title ?? o.id ?? value);
      }
      return String(value);
    };
    return (task: GanttTask): { key: string | number; label: string } | null => {
      const raw = resolvePath((task as any).data, field);
      if (raw == null || raw === '') return null;
      // Group key uses the embedded record's id for lookups so two labels that
      // collide still split correctly; otherwise the scalar value.
      const key =
        typeof raw === 'object' && raw !== null
          ? String((raw as any).id ?? (raw as any)._id ?? labelFor(raw))
          : (raw as string | number);
      return { key, label: labelFor(raw) };
    };
  }, [ganttConfig?.groupByField, objectSchema]);

  // Resource / Workload view (资源/工作负载视图). `assigneeAccessor` buckets each
  // task by its resource field (select option / lookup → display label, same as
  // grouping); `effortAccessor` reads the per-task load (default 1). Both read
  // off the backing record so the histogram reflects the real assignment data.
  const assigneeAccessor = useMemo(() => {
    const field = ganttConfig?.assigneeField;
    if (!field) return undefined;
    const fieldDefs: Record<string, any> = objectSchema?.fields ?? {};
    const resolvePath = (record: any, path: string): unknown => {
      if (!path) return undefined;
      let cur: any = record;
      for (const p of path.split('.')) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    };
    const labelFor = (value: unknown): string => {
      const def = fieldDefs[field] ?? fieldDefs[field.split('.')[0]];
      const options: Array<{ value: unknown; label: string }> | undefined = def?.options;
      if (Array.isArray(options) && options.length) {
        const opt = options.find((o) => String(o.value) === String(value));
        if (opt) return opt.label;
      }
      if (typeof value === 'object' && value !== null) {
        const o = value as any;
        return String(o.name ?? o.label ?? o.title ?? o.id ?? value);
      }
      return String(value);
    };
    return (task: GanttTask): { key: string | number; label: string } | null => {
      const raw = resolvePath((task as any).data, field);
      if (raw == null || raw === '') return null;
      const key =
        typeof raw === 'object' && raw !== null
          ? String((raw as any).id ?? (raw as any)._id ?? labelFor(raw))
          : (raw as string | number);
      return { key, label: labelFor(raw) };
    };
  }, [ganttConfig?.assigneeField, objectSchema]);

  const effortAccessor = useMemo(() => {
    const field = ganttConfig?.effortField;
    if (!field) return undefined;
    return (task: GanttTask): number => {
      const raw = (task as any).data?.[field];
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
  }, [ganttConfig?.effortField]);

  // Working calendar: when the schema opts into weekend-skipping or supplies a
  // holiday list, duration/reschedule math is measured in working days. The
  // holidays array (ISO yyyy-mm-dd strings) becomes a Set for O(1) lookups.
  const workingCalendar = useMemo<WorkingCalendar | undefined>(() => {
    const sw = (schema as any).skipWeekends;
    const hol = (schema as any).holidays as string[] | undefined;
    if (!sw && (!hol || hol.length === 0)) return undefined;
    return {
      skipWeekends: !!sw,
      holidays: hol && hol.length ? new Set(hol) : undefined,
    };
  }, [schema]);

  // ── Quick filters (快速筛选) ─────────────────────────────────────────────
  // Resolve each task's value for a filter dimension into a stable key. Lookups
  // resolve to the embedded record's id (matching the lookup option values);
  // scalars / select values use their string form. Mirrors the grouping key
  // logic so a filter and a group-by on the same field agree.
  const resolveFilterKey = useCallback((record: any, field: string): string | null => {
    if (!record || !field) return null;
    let cur: any = record;
    for (const p of field.split('.')) {
      if (cur == null) return null;
      cur = cur[p];
    }
    if (cur == null || cur === '') return null;
    if (typeof cur === 'object') {
      const o = cur as any;
      return String(o.id ?? o._id ?? o.value ?? o.name ?? '');
    }
    return String(cur);
  }, []);

  const quickFilterDefs = ganttConfig?.quickFilters;

  // Lookup/master_detail dimensions pull their full option domain from the
  // referenced object (reference_to) via the data source — so the dropdown
  // shows every possible value, not only those present in the loaded rows.
  const [lookupOptions, setLookupOptions] = useState<Record<string, QuickFilterOption[]>>({});
  useEffect(() => {
    if (!quickFilterDefs?.length || !dataSource || typeof dataSource.find !== 'function') return;
    const fieldDefs: Record<string, any> = objectSchema?.fields ?? {};
    let cancelled = false;
    (async () => {
      const next: Record<string, QuickFilterOption[]> = {};
      for (const def of quickFilterDefs) {
        if (def.options) continue; // explicit override — no fetch
        const fd = fieldDefs[def.field] ?? fieldDefs[def.field.split('.')[0]];
        const type: string | undefined = fd?.type;
        if (type !== 'lookup' && type !== 'master_detail') continue;
        const refObject: string | undefined = fd?.reference_to ?? fd?.referenceTo;
        if (!refObject) continue;
        try {
          const result = await dataSource.find(refObject, { $top: 1000 });
          const records = extractRecords(result);
          next[def.field] = records.map((r: any) => ({
            value: String(r.id ?? r._id ?? r.value ?? ''),
            label: String(r.name ?? r.label ?? r.title ?? r.id ?? r._id ?? ''),
          }));
        } catch (err) {
          console.warn(`[ObjectGantt] Failed to load quick-filter options for "${def.field}":`, err);
        }
      }
      if (!cancelled) setLookupOptions((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(quickFilterDefs), dataSource, objectSchema]);

  // Resolve the final option list per dimension, by priority:
  //   1. explicit `options` on the def (fixed enums like 派工类别)
  //   2. select/enum field options from the object schema (full domain)
  //   3. fetched lookup reference records (full domain, async above)
  //   4. distinct values present in the loaded data (fallback)
  const resolvedQuickFilters = useMemo<QuickFilterField[]>(() => {
    if (!quickFilterDefs?.length) return [];
    const fieldDefs: Record<string, any> = objectSchema?.fields ?? {};
    return quickFilterDefs.map((def) => {
      const fd = fieldDefs[def.field] ?? fieldDefs[def.field.split('.')[0]];
      const label = def.label ?? fd?.label ?? humanizeLabel(def.field);
      let options: QuickFilterOption[] = [];

      if (def.options?.length) {
        options = def.options.map((o) =>
          typeof o === 'object'
            ? { value: String(o.value), label: String(o.label ?? o.value) }
            : { value: String(o), label: String(o) },
        );
      } else if (Array.isArray(fd?.options) && fd.options.length) {
        options = fd.options.map((o: any) => ({
          value: String(o.value ?? o),
          label: String(o.label ?? o.value ?? o),
        }));
      } else if (lookupOptions[def.field]?.length) {
        options = lookupOptions[def.field];
      } else {
        // Distinct fallback: derive labels from the records themselves.
        const seen = new Map<string, string>();
        for (const record of data) {
          const key = resolveFilterKey(record, def.field);
          if (key == null) continue;
          if (!seen.has(key)) {
            // Pull a readable label off the raw value (embedded lookup name or scalar).
            let cur: any = record;
            for (const p of def.field.split('.')) cur = cur?.[p];
            const lbl =
              cur && typeof cur === 'object'
                ? String((cur as any).name ?? (cur as any).label ?? (cur as any).title ?? key)
                : key;
            seen.set(key, lbl);
          }
        }
        options = [...seen.entries()].map(([value, lbl]) => ({ value, label: lbl }));
      }
      return { field: def.field, label, options };
    });
  }, [quickFilterDefs, objectSchema, lookupOptions, data, resolveFilterKey]);

  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const handleFilterChange = useCallback((field: string, values: string[]) => {
    setFilterValues((prev) => ({ ...prev, [field]: values }));
  }, []);
  const clearFilters = useCallback(() => setFilterValues({}), []);

  // Apply the active filters in memory: a task passes when, for every dimension
  // with a non-empty selection, its resolved key is among the selected values.
  const displayTasks = useMemo(() => {
    const active = Object.entries(filterValues).filter(([, v]) => v.length > 0);
    if (!active.length) return tasks;
    return tasks.filter((t) =>
      active.every(([field, vals]) => {
        const key = resolveFilterKey((t as any).data, field);
        return key != null && vals.includes(key);
      }),
    );
  }, [tasks, filterValues, resolveFilterKey]);

  // Auto-zoom is free: GanttView derives the timeline range from the tasks it
  // receives, so passing the (smaller) filtered set rescales the axis. To pin
  // the range instead (autoZoomToFilter === false), compute a fixed window from
  // the FULL task set and hand it to GanttView so filtering only hides bars.
  const lockedRange = useMemo<{ start: Date; end: Date } | null>(() => {
    if (ganttConfig?.autoZoomToFilter !== false || !tasks.length) return null;
    let min = tasks[0].start.getTime();
    let max = tasks[0].end.getTime();
    for (const t of tasks) {
      min = Math.min(min, t.start.getTime());
      max = Math.max(max, t.end.getTime());
    }
    return { start: new Date(min), end: new Date(max) };
  }, [tasks, ganttConfig?.autoZoomToFilter]);

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

  // Re-serialize a normalized dependency list back onto a record field,
  // preserving the field's original shape where possible: a CSV string stays
  // CSV *as long as* no link carries a non-default (non-FS) type — types can't
  // round-trip through CSV, so the moment one appears we promote to the object
  // array form (`[{ id, type }, …]`). Plain FS links serialize as bare ids.
  const serializeDependencies = (raw: unknown, deps: GanttDependency[]): unknown => {
    const hasTypes = deps.some((d) => typeof d === 'object' && d.type && d.type !== 'fs');
    if (!hasTypes && typeof raw === 'string') {
      return deps.map((d) => String(typeof d === 'object' ? d.id : d)).join(',');
    }
    if (!hasTypes) {
      return deps.map((d) => (typeof d === 'object' ? d.id : d));
    }
    return deps.map((d) =>
      typeof d === 'object'
        ? (d.type && d.type !== 'fs' ? { id: d.id, type: d.type } : d.id)
        : d,
    );
  };

  const persistDependencies = useCallback(
    async (targetId: string | number, raw: unknown, nextDeps: GanttDependency[]) => {
      const depField = ganttConfig?.dependenciesField;
      if (!depField) return;
      const objectName =
        dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName;
      if (!objectName || !dataSource || typeof dataSource.update !== 'function') return;
      const nextValue = serializeDependencies(raw, nextDeps);
      const prevSnapshot = data;
      setData((prev) =>
        prev.map((r) =>
          String(r.id ?? r._id) === String(targetId) ? { ...r, [depField]: nextValue } : r,
        ),
      );
      try {
        await dataSource.update(objectName, String(targetId), { [depField]: nextValue });
      } catch (err) {
        console.error('[ObjectGantt] Failed to persist dependency:', err);
        setData(prevSnapshot); // revert
      }
    },
    [ganttConfig, dataConfig, dataSource, schema.objectName, data],
  );

  // Persist a created/updated dependency (依赖增 + 类型选择): upsert the source
  // (predecessor) id onto the target record's dependencies field with the given
  // link type. Re-invoking with a different type updates that link's type.
  const handleDependencyCreate = useCallback(
    async (source: GanttTask, target: GanttTask, type: GanttLinkType = 'fs') => {
      const sourceId = (source as any).data?.id ?? (source as any).data?._id ?? source.id;
      const targetId = (target as any).data?.id ?? (target as any).data?._id ?? target.id;
      if (sourceId == null || targetId == null) return;
      const depField = ganttConfig?.dependenciesField;
      if (!depField) return;

      const record = data.find((r) => String(r.id ?? r._id) === String(targetId));
      const raw = record?.[depField];
      const existing = normalizeDependencies(raw);
      const idOf = (d: GanttDependency) => String(typeof d === 'object' ? d.id : d);
      const cur = existing.find((d) => idOf(d) === String(sourceId));
      const curType = cur && typeof cur === 'object' ? (cur.type ?? 'fs') : 'fs';
      if (cur && curType === type) return; // already linked with this type — no-op

      const entry: GanttDependency = type === 'fs' ? sourceId : { id: sourceId, type };
      const nextDeps = cur
        ? existing.map((d) => (idOf(d) === String(sourceId) ? entry : d))
        : [...existing, entry];
      await persistDependencies(targetId, raw, nextDeps);
    },
    [ganttConfig, data, persistDependencies],
  );

  // Persist a removed dependency (依赖删): drop the source id from the target
  // record's dependencies field. Optimistic with revert, same as create.
  const handleDependencyDelete = useCallback(
    async (source: GanttTask, target: GanttTask) => {
      const sourceId = (source as any).data?.id ?? (source as any).data?._id ?? source.id;
      const targetId = (target as any).data?.id ?? (target as any).data?._id ?? target.id;
      if (sourceId == null || targetId == null) return;
      const depField = ganttConfig?.dependenciesField;
      if (!depField) return;

      const record = data.find((r) => String(r.id ?? r._id) === String(targetId));
      const raw = record?.[depField];
      const existing = normalizeDependencies(raw);
      const idOf = (d: GanttDependency) => String(typeof d === 'object' ? d.id : d);
      const nextDeps = existing.filter((d) => idOf(d) !== String(sourceId));
      if (nextDeps.length === existing.length) return; // nothing to remove
      await persistDependencies(targetId, raw, nextDeps);
    },
    [ganttConfig, data, persistDependencies],
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
      {resolvedQuickFilters.length > 0 && (
        <QuickFilterBar
          filters={resolvedQuickFilters}
          value={filterValues}
          onChange={handleFilterChange}
          onClear={clearFilters}
          resultCount={displayTasks.length}
          totalCount={tasks.length}
          labels={{
            all: '全部',
            clear: '清除筛选',
            empty: '无可选项',
            resultSummary: (shown, total) => `显示 ${shown} / ${total} 项任务`,
          }}
        />
      )}
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        {ganttConfig?.resourceView && assigneeAccessor ? (
          <ResourceWorkload
            tasks={displayTasks}
            assignee={assigneeAccessor}
            effort={effortAccessor}
            capacity={ganttConfig?.capacity ?? 1}
            viewMode={((schema as any).viewMode as GanttViewMode) || 'day'}
          />
        ) : (
        <GanttView
          tasks={displayTasks}
          startDate={lockedRange?.start}
          endDate={lockedRange?.end}
          onTaskClick={(task) => {
            navigation.handleClick(task.data);
            onTaskClick?.(task.data);
          }}
          onTaskUpdate={handleTaskUpdateDefault}
          onTaskDelete={requestDelete}
          onDependencyCreate={ganttConfig?.dependenciesField ? handleDependencyCreate : undefined}
          onDependencyDelete={ganttConfig?.dependenciesField ? handleDependencyDelete : undefined}
          markers={(schema as any).markers}
          autoSchedule={!!ganttConfig?.dependenciesField}
          rescheduleOnConflict={!!ganttConfig?.dependenciesField}
          criticalPathDefault={!!(schema as any).criticalPath}
          workingCalendar={workingCalendar}
          showBaselines={(schema as any).showBaselines !== false}
          readOnly={!!(schema as any).readOnly}
          mobileReadOnly={(schema as any).mobileReadOnly !== false}
          persistLayoutKey={
            (schema as any).persistLayout === false
              ? undefined
              : `${schema.objectName || (dataConfig?.provider === 'object' ? dataConfig.object : '') || 'gantt'}:${(schema as any).viewName || 'default'}`
          }
          groupBy={groupByAccessor}
          inlineEdit
        />
        )}
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
