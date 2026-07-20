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

import React, { useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { ObjectGridSchema, DataSource, ViewData, GanttConfig } from '@object-ui/types';
import { GanttConfigSchema } from '@objectstack/spec/ui';
import { useNavigationOverlay, SchemaRendererContext } from '@object-ui/react';
import { useLocalization, resolveFieldCurrency } from '@object-ui/i18n';
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
  cn,
} from '@object-ui/components';
import { extractRecords, buildExpandFields, getRecordDisplayName, resolveDataSource } from '@object-ui/core';
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
import { GanttView, type GanttTask, type GanttDependency, type GanttInteractions, type GanttLinkType, type GanttTaskType, type GanttViewMode } from './GanttView';
import { ResourceWorkload } from './ResourceWorkload';
import { QuickFilterBar, type QuickFilterField, type QuickFilterOption } from './QuickFilterBar';
import type { WorkingCalendar } from './scheduling';
import { normalizeShiftSegments, type ShiftSegmentsConfig } from './shifts';
import { useGanttTranslation } from './useGanttTranslation';

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
  /**
   * Record field marking a node as view-only / 仅查看 (truthy → locked). A locked
   * row's bar can't be dragged/resized, its progress can't be dragged, no
   * dependency can be drawn from it, and its inline-edit / context-menu
   * edit+delete are hidden — but clicking it (open drawer / jump) still works.
   * Independent of the global `readOnly`; use to freeze individual levels (e.g.
   * 派工单) while siblings stay editable. Maps to {@link GanttTask.locked}.
   */
  lockField?: string;
  /**
   * Record field carrying the row's OBJECT API NAME (行级对象名). Mixed-object
   * trees (an `api` provider composing parent-object rows with child-object rows)
   * need the detail drawer and its full-page link to follow each row's REAL
   * object — otherwise a child row's 「→」 builds a URL under the view's bound
   * object and 404s. Empty/missing value → falls back to the bound object.
   */
  objectField?: string;
  /**
   * How a summary bar's span is computed (汇总条区间). `'children'` (default)
   * rolls the bar up from its children — min start / max end / duration-weighted
   * progress — and IGNORES the record's own dates. `'self'` renders the bar from
   * the record's OWN start/end/progress (自身日期为准), falling back to rollup
   * only for records without dates (e.g. pure grouping levels). Use `'self'`
   * when the parent's schedule is authoritative — e.g. 排班计划 whose 派工单
   * children are locked history: under rollup, dragging the plan persists its
   * own dates but the bar snaps back to the children's extent on refetch.
   */
  summaryExtent?: 'children' | 'self';
  /**
   * Auto-collapse tree nodes at/below this 0-indexed depth on first render
   * (默认折叠). Roots are depth 0. Every node at depth `>= defaultCollapsedDepth`
   * with children starts folded; the user can still expand them. Example: a
   * 项目→产品→排产计划→派工单 tree uses `defaultCollapsedDepth: 2` so every 排产计划
   * (and its 派工单) starts collapsed. Forwarded to {@link GanttView}.
   */
  defaultCollapsedDepth?: number;
  /** Baseline (planned) start/end fields → planned-vs-actual reference bars. */
  baselineStartField?: string;
  baselineEndField?: string;
  /**
   * Record field carrying a per-task alert stroke color (逐任务预警描边):any CSS
   * color or semantic palette name (red/orange/…). When present the bar keeps
   * its fill but gets an outline + halo in that color — e.g. 超期红、临期橙,
   * typically a server-computed alert field. Empty/null → no stroke. Maps to
   * {@link GanttTask.borderColor}.
   */
  borderColorField?: string;
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
  /**
   * Whether the backing store persists dependency link TYPES (fs/ss/ff/sf).
   * Default true. Set false when dependencies are bare predecessor ids
   * (仅存紧前 id) — the link menu hides the type switcher (a switch would be
   * silently reverted on refetch) and drag-created links are always FS.
   * Forwarded to {@link GanttView}.
   */
  dependencyTypes?: boolean;
  /**
   * Business time zone (业务时区), IANA name like 'Asia/Shanghai'. Renders the
   * chart's calendar — shift bands, day columns, snapping, today line, date
   * labels — in this zone's wall time for every viewer, instead of the
   * browser's zone (which misplaces 班次 for viewers elsewhere). Persisted
   * data stays real instants. Forwarded to {@link GanttView}.
   */
  timeZone?: string;
  /**
   * Base name for exported PNG/PDF files (导出文件名), e.g. the view's display
   * label — the host's view schema often reaches this component stripped of
   * `label`, so views declare it here. Falls back to the object schema label,
   * then the object API name. A timestamp suffix is always appended.
   */
  exportFileName?: string;
  /**
   * Per-interaction switches (交互开关): `move` / `resize` / `progress` / `link`,
   * each defaulting to true. Metadata-drivable so a view can e.g. allow bar
   * moves but pin durations (`{ resize: false }`) or keep the dependency UI
   * read-only (`{ link: false }`). They only narrow what `readOnly` / row locks
   * already allow. Forwarded to {@link GanttView}.
   */
  interactions?: GanttInteractions;
  /**
   * Shift segmentation (班次/排班分段). When set, the day-mode timeline splits each
   * 排班日 (shift-day, starting at `dayStart`) into the configured bands (白班 |
   * 夜班…): a two-tier header (date over band), per-band column tints, and
   * drag/resize snapping to band boundaries. Pure config data — no shift concept
   * is hardcoded. Off by default → existing gantts are unchanged. Example:
   * `{ dayStart: '08:00', bands: [
   *     { key: 'day', label: '白班', start: '08:00', end: '20:00' },
   *     { key: 'night', label: '夜班', start: '20:00', end: '08:00' } ] }`.
   */
  timeSegments?: ShiftSegmentsConfig;
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
  /**
   * Veto hook for task edits, forwarded to {@link GanttView}. Called with the
   * gantt task and the pending changes on every commit path (drag, resize,
   * group move, progress, inline edit, auto-reschedule); return false (sync or
   * async) to cancel that task's update before it reaches the data source.
   */
  onBeforeTaskUpdate?: (
    task: GanttTask,
    changes: Partial<Pick<GanttTask, 'title' | 'start' | 'end' | 'progress'>>,
  ) => boolean | Promise<boolean>;
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
 * Pull a human-readable message out of a failed write. ApiDataSource embeds
 * the raw response body at the end of its Error message
 * (`ApiDataSource: HTTP 403 Forbidden — {"error":…,"message":…}`), so a JSON
 * tail with `message`/`error` wins; otherwise null (caller falls back to the
 * generic i18n text).
 */
function extractServerMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const idx = msg.indexOf('{');
  if (idx >= 0) {
    try {
      const body = JSON.parse(msg.slice(idx));
      const m = body?.message ?? body?.error;
      if (typeof m === 'string' && m.trim()) return m;
    } catch {
      /* body wasn't JSON — fall through */
    }
  }
  return null;
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
          borderColorField: schema.borderColorField,
          parentField: schema.parentField,
          typeField: schema.typeField,
          lockField: schema.lockField,
          objectField: schema.objectField,
          summaryExtent: schema.summaryExtent,
          defaultCollapsedDepth: schema.defaultCollapsedDepth,
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
          timeSegments: schema.timeSegments,
          interactions: schema.interactions,
          exportFileName: schema.exportFileName,
          timeZone: schema.timeZone,
          dependencyTypes: schema.dependencyTypes,
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
  onBeforeTaskUpdate,
  ...rest
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  // Tenant default currency (ADR-0053) for currency tooltips lacking a code.
  const { currency: tenantCurrency } = useLocalization();
  const { t } = useGanttTranslation();

  // Surface write-back failures (拖拽/连线/删除/行内编辑) as an error toast —
  // silent revert alone leaves the user wondering why nothing stuck (#2473).
  // The server's own message (e.g. 403「仅管理责任人可修改该排班计划」) leads;
  // the generic i18n text is the fallback.
  const notifyWriteError = useCallback((err: unknown) => {
    toast.error(t('gantt.writeFailed'), {
      description: extractServerMessage(err) ?? undefined,
    });
  }, [t]);

  const rawDataConfig = getDataConfig(schema);
  // Memoize dataConfig using deep comparison to prevent infinite loops
  const dataConfig = useMemo(() => {
    return rawDataConfig;
  }, [JSON.stringify(rawDataConfig)]);

  const ganttConfig = getGanttConfig(schema);
  const hasInlineData = dataConfig?.provider === 'value';

  // Resolve the ViewData config into a concrete DataSource adapter:
  //   provider: 'object' → the context DataSource passed via props (unchanged)
  //   provider: 'api'    → an ApiDataSource that executes the read/write HttpRequest config
  //   provider: 'value'  → an in-memory ValueDataSource
  // Every read AND write-back below goes through this single adapter, so the
  // 'api' provider now supports reschedule / dependency / delete / inline-edit
  // write-backs — not just object-backed views.
  // Host-authenticated fetch (SchemaRendererContext.apiFetch) so the 'api'
  // provider's custom endpoints carry the same Authorization/tenant headers
  // as native requests instead of relying on cookies alone (#2725).
  const apiFetch = useContext(SchemaRendererContext)?.apiFetch;
  const effectiveDataSource = useMemo(
    () => resolveDataSource(dataConfig, dataSource ?? null, { fetch: apiFetch }),
    // dataConfig is already memoized by deep value above.
    [dataConfig, dataSource, apiFetch],
  );

  // Unified resource name for find/update/delete. For 'object' it's the bound
  // object; for 'api' the adapter ignores it (the URL carries the endpoint),
  // so an empty string is fine there.
  const resource =
    dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName ?? '';

  // Load (and re-load) data through the resolved adapter. `silent: true`
  // re-reads the source WITHOUT flipping `loading`, so GanttView stays mounted
  // and keeps its scroll/collapse state — used by the write-readback below and
  // the toolbar refresh button (写后回读 / 手动刷新, #2436 第 6/7 项). Concurrent
  // reloads are sequenced: only the newest request may commit its result,
  // so a slow earlier response can't clobber a fresher one.
  const [refreshing, setRefreshing] = useState(false);
  const reloadSeqRef = useRef(0);
  const reload = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const seq = ++reloadSeqRef.current;
    const isCurrent = () => reloadSeqRef.current === seq;
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      // 1. Check for data prop (Unified ListView)
      if ((rest as any).data && Array.isArray((rest as any).data)) {
        if (isCurrent()) setData((rest as any).data);
        return;
      }

      if (hasInlineData && dataConfig?.provider === 'value') {
        if (isCurrent()) setData(dataConfig.items as any[]);
        return;
      }

      if (!effectiveDataSource || typeof effectiveDataSource.find !== 'function') {
        throw new Error('DataSource required for object/api providers');
      }

      // 'object' → context adapter, 'api' → ApiDataSource (both resolved above).
      // Auto-inject $expand for lookup/master_detail fields when a schema is
      // available; api adapters return an empty field map, so expand stays off.
      const expand = buildExpandFields(objectSchema?.fields);
      const result = await effectiveDataSource.find(resource, {
        $filter: schema.filter,
        $orderby: convertSortToQueryParams(schema.sort),
        ...(expand.length > 0 ? { $expand: expand } : {}),
      });
      if (isCurrent()) setData(extractRecords(result));
    } catch (err) {
      if (silent) {
        // Background refresh failure keeps the last good data on screen.
        console.error('[ObjectGantt] Failed to refresh data:', err);
      } else if (isCurrent()) {
        setError(err as Error);
      }
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (rest as any).data intentionally untracked, matching the original effect
  }, [effectiveDataSource, resource, hasInlineData, dataConfig, schema.filter, schema.sort, objectSchema]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Fetch object schema for field metadata
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        if (!effectiveDataSource) return;
        if (!resource) return;

        const schemaData = await effectiveDataSource.getObjectSchema(resource);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
      }
    };

    if (!hasInlineData && effectiveDataSource) {
      fetchObjectSchema();
    }
  }, [resource, effectiveDataSource, hasInlineData, dataConfig]);

  // Transform data to gantt tasks
  const tasks = useMemo(() => {
    if (!ganttConfig || !data.length) {
      return [];
    }

    const { startDateField, endDateField, titleField, progressField, dependenciesField, colorField, borderColorField, parentField, typeField, lockField, tooltipFields, baselineStartField, baselineEndField, quickFilters } = ganttConfig;
    const fieldDefs: Record<string, any> = objectSchema?.fields ?? {};

    // Fallback value→label maps from the view's quickFilters config. When the
    // data comes from an `api` provider there is no object schema, so select
    // fields have no option defs — but the same view often declares the exact
    // label pairs as quick-filter options (e.g. status: completed→已完成).
    // Reuse them so the tooltip shows display labels, not raw machine values.
    const quickFilterLabels = new Map<string, Map<string, string>>();
    for (const qf of quickFilters ?? []) {
      if (!qf?.field || !Array.isArray(qf.options) || !qf.options.length) continue;
      const m = new Map<string, string>();
      for (const opt of qf.options) {
        if (typeof opt === 'string') m.set(opt, opt);
        else if (opt && opt.value != null) m.set(String(opt.value), opt.label ?? String(opt.value));
      }
      if (m.size) quickFilterLabels.set(qf.field, m);
    }

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

    // Title resolution (ADR-0079):
    //   1. configured `titleField` (supports dotted paths, e.g. `account.name`);
    //   2. a couple of common embedded-lookup labels that the object-level
    //      resolver can't see (the gantt often renders related records);
    //   3. the unified `@object-ui/core#getRecordDisplayName` — objectSchema
    //      titleFormat → displayNameField → type-aware field derivation →
    //      `Record #<id>` floor. This is what stops a task object whose name
    //      lives in e.g. `activity_name` (no `name`/title field) from rendering
    //      "Untitled".
    const resolveTitle = (record: any): string => {
      const direct: unknown[] = [
        resolvePath(record, titleField),
        // Common single embedded lookup labels (e.g. account.name on a contract).
        record?.account?.name,
        record?.opportunity?.name,
        record?.contact && [record.contact.first_name, record.contact.last_name].filter(Boolean).join(' '),
      ];
      for (const v of direct) {
        if (v != null && String(v).trim() !== '') return String(v);
      }
      return getRecordDisplayName(objectSchema, record);
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
      // No schema options (api provider has no object schema) → quick-filter
      // options declared for the same field carry the display labels.
      if (typeof value !== 'object') {
        const qfLabel = quickFilterLabels.get(fieldName)?.get(String(value));
        if (qfLabel != null) return qfLabel;
      }
      // No field def at all → sniff ISO date / datetime strings so raw
      // `2026-08-14T08:00:00.000Z` payloads still format like real date fields.
      if (type == null && typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
        if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) && !isNaN(new Date(value).getTime())) {
          return formatDateTime(value);
        }
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
          return formatCurrency(Number(value), resolveFieldCurrency(def as any, tenantCurrency));
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
        const raw = resolvePath(record, fieldName);
        // Per-level tooltips (悬浮分层字段): mixed trees list the UNION of every
        // level's fields here; a row omits the ones that don't apply to it, so
        // an absent value must drop the line, not render a placeholder dash.
        if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) continue;
        rows.push({
          label: resolveFieldLabel(fieldName, explicitLabel),
          value: formatFieldValue(raw, fieldName),
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
      // Alert stroke (预警描边): semantic palette names map to their hex;
      // anything else (hex, css color) passes through untouched.
      const borderColorRaw = borderColorField ? record[borderColorField] : undefined;
      const borderColor =
        borderColorRaw != null && borderColorRaw !== ''
          ? getSemanticHex(String(borderColorRaw), String(borderColorRaw))
          : undefined;

      return {
        id: record.id || record._id || `task-${index}`,
        title,
        start: startDate ? new Date(startDate) : new Date(),
        end: endDate ? new Date(endDate) : new Date(),
        // Whether the record carried real dates (vs the placeholder "today"
        // above) — summaryExtent:'self' falls back to rollup when it didn't.
        hasOwnDates: !!(startDate && endDate),
        progress: Math.min(100, Math.max(0, progress || 0)), // Clamp between 0-100
        dependencies: normalizeDependencies(dependencies),
        parent: parentField ? record[parentField] ?? null : undefined,
        type: typeField ? normalizeTaskType(record[typeField]) : undefined,
        locked: lockField ? !!record[lockField] : undefined,
        color,
        borderColor,
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

  // Shift segmentation (班次分段). Normalize the declarative `timeSegments` config
  // once into the model GanttView lays band columns / snaps drags against. null
  // (no/invalid config) leaves the timeline an ordinary day axis.
  const shiftSegments = useMemo(
    () => normalizeShiftSegments(ganttConfig?.timeSegments),
    [ganttConfig?.timeSegments],
  );

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
        // Served schemas key the target as `reference` (ObjectStack
        // convention); reference_to/referenceTo cover ObjectUI-authored defs.
        const refObject: string | undefined =
          fd?.reference_to ?? fd?.reference ?? fd?.referenceTo;
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

  // 保存布局 covers the quick-filter chips too: GanttView persists its own
  // snapshot under persistLayoutKey and fires onLayoutChange; the chips live up
  // here, so they get a sibling localStorage key and restore on mount.
  const persistLayoutKey =
    (schema as any).persistLayout === false
      ? undefined
      : `${schema.objectName || (dataConfig?.provider === 'object' ? dataConfig.object : '') || 'gantt'}:${(schema as any).viewName || 'default'}`;
  const filtersStorageKey = persistLayoutKey ? `gantt-layout:${persistLayoutKey}:filters` : null;
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>(() => {
    if (!filtersStorageKey || typeof window === 'undefined') return {};
    try {
      const parsed = JSON.parse(window.localStorage.getItem(filtersStorageKey) || 'null');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
      }
      return out;
    } catch {
      return {};
    }
  });
  const persistFilters = useCallback(() => {
    if (!filtersStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(filtersStorageKey, JSON.stringify(filterValues));
    } catch {
      /* storage unavailable / full — non-fatal */
    }
  }, [filtersStorageKey, filterValues]);
  const handleFilterChange = useCallback((field: string, values: string[]) => {
    setFilterValues((prev) => ({ ...prev, [field]: values }));
  }, []);
  const clearFilters = useCallback(() => setFilterValues({}), []);

  // Detail-page href for a row, honouring objectField (mixed-object trees):
  // the link must follow the ROW's object, not the view's bound one — a child-object
  // row opened under the bound object's route otherwise builds a 404 URL.
  // deriveRecordPageHref needs the routed object's segment in the current path
  // (a foreign row object never appears there), so derive from the routed
  // object and swap the segment. Used by the drawer's 整页 link.
  // With objectField configured, a row without a value is a synthetic group
  // header composed by the endpoint (its id isn't a real record id) — no
  // detail page or drawer exists for it.
  const isSyntheticRow = useCallback(
    (rec: Record<string, any> | undefined): boolean =>
      !!ganttConfig?.objectField && !String(rec?.[ganttConfig.objectField] ?? '').trim(),
    [ganttConfig?.objectField],
  );

  const recordDetailHref = useCallback(
    (rec: Record<string, any>): { objectName: string; recordId: string | number; href: string | null } | null => {
      const rowObject = ganttConfig?.objectField
        ? String(rec[ganttConfig.objectField] ?? '').trim()
        : '';
      const objectName = rowObject || resource;
      const recordId = rec.id ?? rec._id;
      if (!objectName || recordId == null) return null;
      const routedHref = resource ? deriveRecordPageHref(resource, recordId) : null;
      const href =
        !resource || objectName === resource
          ? routedHref
          : routedHref?.replace(`/${resource}/record/`, `/${objectName}/record/`) ?? null;
      return { objectName, recordId, href };
    },
    [ganttConfig?.objectField, resource],
  );

  // Apply the active filters in memory: a task matches when, for every dimension
  // with a non-empty selection, its resolved key is among the selected values.
  // Tree-aware: every ancestor of a match is retained too — group/parent rows
  // rarely match themselves (they carry no filterable record), and dropping
  // them would orphan the matches and flatten the tree.
  const displayTasks = useMemo(() => {
    const active = Object.entries(filterValues).filter(([, v]) => v.length > 0);
    if (!active.length) return tasks;
    const byId = new Map(tasks.map((t) => [String(t.id), t]));
    const keep = new Set<string>();
    for (const t of tasks) {
      const matches = active.every(([field, vals]) => {
        const key = resolveFilterKey((t as any).data, field);
        return key != null && vals.includes(key);
      });
      if (!matches) continue;
      let cur: GanttTask | undefined = t;
      while (cur && !keep.has(String(cur.id))) {
        keep.add(String(cur.id));
        cur = cur.parent != null ? byId.get(String(cur.parent)) : undefined;
      }
    }
    return tasks.filter((t) => keep.has(String(t.id)));
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

  // #2473: an `api`-provider row is a composed render payload (bar_color,
  // node_type, sort_key…), not the business record — and a foreign-object row
  // has no schema at all, so the drawer degraded to humanized English labels.
  // When the drawer opens, fetch the REAL record (and its schema for foreign
  // objects) through the context DataSource; fall back to the raw row when
  // there's no context DS or the fetch fails (inline `value` demos keep
  // working unchanged).
  const [drawerFetch, setDrawerFetch] = useState<{ key: string; record: any; schema: any } | null>(null);
  const drawerRec = navigation.isOverlay && navigation.isOpen
    ? (navigation.selectedRecord as Record<string, any> | null)
    : null;
  useEffect(() => {
    if (!drawerRec) { setDrawerFetch(null); return; }
    const detail = recordDetailHref(drawerRec);
    if (!detail) { setDrawerFetch(null); return; }
    const { objectName, recordId } = detail;
    const needsRealRecord = dataConfig?.provider === 'api' || objectName !== resource;
    if (!needsRealRecord || !dataSource || typeof dataSource.findOne !== 'function') {
      setDrawerFetch(null);
      return;
    }
    const key = `${objectName}:${recordId}`;
    let cancelled = false;
    (async () => {
      try {
        // Schema comes from the SAME context DataSource as the record — the
        // component-level `objectSchema` state is unusable here: under the
        // 'api' provider it's the adapter's `{fields: {}}` stub, which blanks
        // every field label in the drawer.
        const [record, schema] = await Promise.all([
          dataSource.findOne(objectName, String(recordId)),
          typeof dataSource.getObjectSchema === 'function'
            ? dataSource.getObjectSchema(objectName).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!cancelled) setDrawerFetch(record ? { key, record, schema } : null);
      } catch (err) {
        console.error('[ObjectGantt] Failed to fetch drawer record, falling back to row payload:', err);
        if (!cancelled) setDrawerFetch(null);
      }
    })();
    return () => { cancelled = true; };
  }, [drawerRec, recordDetailHref, dataConfig?.provider, resource, dataSource]);

  // Persist a drag-driven reschedule back to the data source. Mirrors
  // ObjectCalendar.handleEventDropDefault: optimistic local patch, then
  // dataSource.update; on failure we revert and log.
  const handleTaskUpdateDefault = useCallback(
    async (task: GanttTask, changes: { start?: Date; end?: Date; title?: string; progress?: number }) => {
      if (!ganttConfig) return;
      if (!effectiveDataSource || typeof effectiveDataSource.update !== 'function') return;

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
        await effectiveDataSource.update(resource, String(recordId), patch);
        // Read back so server-computed fields (parent rollups, alert
        // colors, recalculated durations) refresh — the optimistic patch
        // only knows what the client wrote (#2436 第 6 项).
        void reload({ silent: true });
      } catch (err) {
        console.error('[ObjectGantt] Failed to persist task update:', err);
        setData(prevSnapshot); // revert
        notifyWriteError(err);
      }
    },
    [ganttConfig, effectiveDataSource, resource, data, reload, notifyWriteError],
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
      if (!effectiveDataSource || typeof effectiveDataSource.update !== 'function') return;
      const nextValue = serializeDependencies(raw, nextDeps);
      const prevSnapshot = data;
      setData((prev) =>
        prev.map((r) =>
          String(r.id ?? r._id) === String(targetId) ? { ...r, [depField]: nextValue } : r,
        ),
      );
      try {
        await effectiveDataSource.update(resource, String(targetId), { [depField]: nextValue });
        void reload({ silent: true }); // 写后回读 — see handleTaskUpdateDefault
      } catch (err) {
        console.error('[ObjectGantt] Failed to persist dependency:', err);
        setData(prevSnapshot); // revert
        notifyWriteError(err);
      }
    },
    [ganttConfig, effectiveDataSource, resource, data, reload, notifyWriteError],
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
    if (!effectiveDataSource?.delete) {
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
      // ApiDataSource.delete reports failure as `false` instead of throwing —
      // without this check a rejected delete keeps the optimistic removal.
      const ok = await effectiveDataSource.delete(resource, String(recordId));
      if (ok === false) throw new Error(t('gantt.writeFailed'));
      setPendingDelete(null);
      void reload({ silent: true }); // 写后回读 — parent rollups shrink after a child delete
    } catch (err) {
      console.error('[ObjectGantt] Failed to delete:', err);
      setData(prevSnapshot); // revert
      setPendingDelete(null);
      notifyWriteError(err);
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, effectiveDataSource, resource, data, reload, notifyWriteError, t]);

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
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
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
      {/* Fill the host's flex cell instead of guessing with a viewport calc:
          `100vh - 200px` overshoots whenever the chrome above (tabs, toolbar,
          quick filters) exceeds 200px, and the overflow-hidden host then CLIPS
          the pane's bottom edge — swallowing the horizontal scrollbar
          (水平滚动条被裁掉). flex-1/min-h-0 tracks the real available height;
          the min-h keeps standalone embeds (no sized parent) usable. */}
      <div className="flex-1 min-h-[420px]">
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
            // Synthetic group rows have no backing record — opening the
            // drawer would only show the raw composed payload (#2473).
            if (!isSyntheticRow(task.data as Record<string, any> | undefined)) {
              navigation.handleClick(task.data);
            }
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
          shiftSegments={shiftSegments}
          showBaselines={(schema as any).showBaselines !== false}
          readOnly={!!(schema as any).readOnly}
          mobileReadOnly={(schema as any).mobileReadOnly !== false}
          persistLayoutKey={persistLayoutKey}
          onLayoutChange={filtersStorageKey ? persistFilters : undefined}
          groupBy={groupByAccessor}
          defaultCollapsedDepth={ganttConfig?.defaultCollapsedDepth}
          summaryExtent={ganttConfig?.summaryExtent}
          interactions={ganttConfig?.interactions}
          dependencyTypes={ganttConfig?.dependencyTypes}
          timeZone={ganttConfig?.timeZone}
          onBeforeTaskUpdate={onBeforeTaskUpdate}
          exportFileName={
            // Explicit view config first (排班计划甘特图) — the host strips
            // `label` off the schema it hands us — then the bound object's
            // label, then its API name.
            String(
              ganttConfig?.exportFileName ?? (schema as any).label ?? objectSchema?.label ?? schema.objectName ?? ''
            ) || undefined
          }
          inlineEdit
          onRefresh={
            // Only meaningful when there's a live source to re-read (object or
            // api provider); inline `value` items and the data prop are owned
            // by the host.
            (dataConfig?.provider === 'object' || dataConfig?.provider === 'api') &&
            typeof effectiveDataSource?.find === 'function'
              ? () => reload({ silent: true })
              : undefined
          }
          refreshing={refreshing}
        />
        )}
      </div>
      {navigation.isOverlay && navigation.isOpen && navigation.selectedRecord && (() => {
        const rec = navigation.selectedRecord as Record<string, any>;
        const detail = recordDetailHref(rec);
        if (!detail || isSyntheticRow(rec)) return null;
        const { objectName, recordId } = detail;
        const fullPageHref = detail.href ?? undefined;
        const titleText = ganttConfig?.titleField
          ? String(rec[ganttConfig.titleField] ?? t('gantt.drawer.fallbackTitle'))
          : t('gantt.drawer.fallbackTitle');
        // Row-level lock (lockField) and global readOnly must also lock the
        // drawer: omitting onFieldSave/onDelete renders it strictly read-only.
        const recLocked =
          !!(schema as any).readOnly ||
          (ganttConfig?.lockField ? !!rec[ganttConfig.lockField] : false);
        // #2473: prefer the fetched business record + schema over the raw row
        // payload (see the drawerFetch effect above for why they can differ).
        const fetched = drawerFetch?.key === `${objectName}:${recordId}` ? drawerFetch : null;
        const drawerRecord = fetched?.record ?? rec;
        const drawerSchema = fetched?.schema
          ?? (objectName === resource ? (objectSchema as any) : undefined);
        // Field saves on a fetched record write the BUSINESS object through the
        // context DataSource (the gantt endpoint only understands composed
        // rows); everything else keeps the gantt-endpoint write path.
        const saveDS = fetched && dataSource ? dataSource : effectiveDataSource;

        return (
          <RecordDetailDrawer
            open
            onClose={navigation.close}
            title={titleText}
            record={drawerRecord}
            objectName={objectName}
            recordId={recordId}
            dataSource={saveDS ?? undefined}
            objectSchema={drawerSchema}
            width={navigation.width as any}
            fullPageHref={fullPageHref}
            onFieldSave={recLocked ? undefined : async (field, value) => {
              if (!saveDS?.update) return;
              try {
                await saveDS.update(objectName, String(recordId), { [field]: value });
              } catch (err) {
                // DetailView rolls back and shows the (cleaned) message inline
                // next to the field — surface the server's reason, not the raw
                // "ApiDataSource: HTTP 403 …" transport string.
                const serverMsg = extractServerMessage(err);
                throw serverMsg ? new Error(serverMsg) : err;
              }
              if (fetched) {
                setDrawerFetch((prev) =>
                  prev && prev.key === fetched.key
                    ? { ...prev, record: { ...prev.record, [field]: value } }
                    : prev,
                );
              }
              setData((prev) => prev.map((r) =>
                String(r.id ?? r._id) === String(recordId)
                  ? { ...r, [field]: value }
                  : r,
              ));
              void reload({ silent: true }); // 写后回读 — see handleTaskUpdateDefault
            }}
            onDelete={recLocked ? undefined : async () => {
              if (!effectiveDataSource?.delete) return;
              try {
                // ApiDataSource.delete reports failure as `false`, not a throw.
                const ok = await effectiveDataSource.delete(objectName, String(recordId));
                if (ok === false) throw new Error(t('gantt.writeFailed'));
              } catch (err) {
                notifyWriteError(err);
                throw err;
              }
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
            <AlertDialogTitle>{t('gantt.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? t('gantt.delete.body', { title: pendingDelete.title })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('gantt.delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              disabled={deleting}
              data-testid="gantt-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t('gantt.delete.deleting') : t('gantt.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
