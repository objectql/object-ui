/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Calendar as CalendarIcon,
  PanelLeftClose,
  PanelLeft,
  CalendarDays,
  Maximize2,
  Minimize2,
  Download,
  Activity,
  Wand2,
  Undo2,
  Redo2,
} from "lucide-react"
import {
  cn,
  Button,
  Separator,
  useResizeObserver,
} from "@object-ui/components"
import { computeCriticalPath, computeProjectReschedule, type WorkingCalendar, type RescheduleChange } from "./scheduling"
import { useGanttTranslation } from "./useGanttTranslation"

const HEADER_HEIGHT = 50;
const COLUMN_WIDTH = 100; // Time column width

/**
 * Container-aware sizing helpers — replace the legacy viewport (`window.innerWidth`)
 * checks so the Gantt adapts to whatever slot it sits in (cards, sidebars, popups…).
 */
function columnWidthForContainer(width: number) {
  if (width < 640) return 35;
  if (width < 1024) return 50;
  return 60;
}

function taskListWidthForContainer(width: number) {
  if (width < 640) return 140;
  if (width < 1024) return 220;
  return 320;
}

// Show the Start/End sub-columns only when the task list is wide enough that
// the title still has room. Below this threshold the title would collapse to
// a few pixels (issue: bars rendered but names invisible).
function showStartEndColumns(taskListWidth: number) {
  return taskListWidth >= 280;
}

function rowHeightForContainer(width: number) {
  return width < 640 ? 32 : 40;
}

/**
 * Dependency link types, MS-Project style:
 * - `fs` finish-to-start (default): predecessor must finish before this task starts
 * - `ss` start-to-start, `ff` finish-to-finish, `sf` start-to-finish
 */
export type GanttLinkType = 'fs' | 'ss' | 'ff' | 'sf';

export interface GanttDependencyObject {
  id: string | number
  type?: GanttLinkType
}

/** A dependency is the PREDECESSOR's task id, optionally with a link type. */
export type GanttDependency = string | number | GanttDependencyObject;

/**
 * Task rendering variant. `summary` is implied for any task that has
 * children; `milestone` is implied when end <= start (zero duration).
 */
export type GanttTaskType = 'task' | 'summary' | 'milestone';

export interface GanttTask {
  id: string | number
  title: string
  start: Date
  end: Date
  progress: number
  color?: string
  data?: any
  dependencies?: GanttDependency[]
  /** Parent task id — builds the hierarchy. Unknown ids render as roots. */
  parent?: string | number | null
  type?: GanttTaskType
  /**
   * Baseline (planned) start/end. When both are present a thin reference bar is
   * drawn beneath the live bar so planned-vs-actual drift is visible at a glance.
   */
  baselineStart?: Date
  baselineEnd?: Date
  /**
   * Extra label/value rows for the hover tooltip (悬浮详情), in display order.
   * Populated from the view's `tooltipFields` config (resolved + formatted by
   * ObjectGantt). When present they replace the default date·duration·progress
   * line in the tooltip.
   */
  fields?: Array<{ label: string; value: string }>
}

/** Timeline granularity — one column per day, week, month, or quarter. */
export type GanttViewMode = 'day' | 'week' | 'month' | 'quarter';

const VIEW_MODES: GanttViewMode[] = ['day', 'week', 'month', 'quarter'];

/**
 * Nominal days represented by one column at each granularity. Sets the zoom
 * scale: pxPerDay = columnWidth / NOMINAL_DAYS[mode]. Actual column widths
 * follow the calendar (a 31-day month is slightly wider than a 30-day one)
 * so grid lines, bars and the Today marker share one linear ms→px mapping.
 */
export const NOMINAL_DAYS: Record<GanttViewMode, number> = {
  day: 1,
  week: 7,
  month: 30.44,
  quarter: 91.31,
};

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Floor a date to the start of its column unit (Monday for weeks). */
export function startOfUnit(date: Date, mode: GanttViewMode): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (mode === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  } else if (mode === 'month') {
    d.setDate(1);
  } else if (mode === 'quarter') {
    d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  }
  return d;
}

/**
 * Index range of cells visible in [from, to] px. `offsets` is a prefix-sum
 * array of length n+1 (offsets[i] = left edge of cell i, offsets[n] = total).
 */
function visibleRange(offsets: number[], from: number, to: number): { start: number; end: number } {
  const n = offsets.length - 1;
  let start = 0;
  while (start < n && offsets[start + 1] < from) start++;
  let end = start;
  while (end < n && offsets[end] < to) end++;
  return { start, end };
}

/** Add whole column units; month/quarter clamp the day (Jan 31 + 1mo = Feb 28). */
export function addUnits(date: Date, units: number, mode: GanttViewMode): Date {
  const d = new Date(date);
  if (mode === 'day') {
    d.setDate(d.getDate() + units);
  } else if (mode === 'week') {
    d.setDate(d.getDate() + units * 7);
  } else {
    const months = units * (mode === 'month' ? 1 : 3);
    const dayOfMonth = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dayOfMonth, lastDay));
  }
  return d;
}

/** Custom vertical timeline marker (deadline, sprint boundary, release…). */
export interface GanttMarker {
  date: Date | string
  label?: string
  color?: string
}

export interface GanttViewProps {
  tasks: GanttTask[]
  /** Initial timeline granularity (also switchable from the toolbar). */
  viewMode?: GanttViewMode
  startDate?: Date
  endDate?: Date
  /** Extra vertical marker lines rendered like the Today marker. */
  markers?: GanttMarker[]
  onTaskClick?: (task: GanttTask) => void
  onTaskUpdate?: (task: GanttTask, changes: Partial<Pick<GanttTask, 'title' | 'start' | 'end' | 'progress'>>) => void
  onTaskDelete?: (task: GanttTask) => void
  /** Notified when the user switches granularity from the toolbar. */
  onViewChange?: (view: GanttViewMode) => void
  /**
   * Enables drag-to-link: a connector dot on each bar can be dragged onto
   * another bar to create a dependency (target depends on source).
   */
  onDependencyCreate?: (source: GanttTask, target: GanttTask, type: GanttLinkType) => void
  /**
   * Enables dependency removal: right-clicking a dependency link opens a menu
   * with "移除依赖" and a type switch. Called with the source/target tasks of the
   * removed link (target no longer depends on source).
   */
  onDependencyDelete?: (source: GanttTask, target: GanttTask) => void
  /**
   * Enables row drag-to-reorder in the task list. Called with the dragged
   * task and the sibling it was dropped on (insert before it). Only fires
   * for rows sharing the same parent.
   */
  onTaskReorder?: (task: GanttTask, before: GanttTask) => void
  className?: string
  /** Enable inline editing of task fields */
  inlineEdit?: boolean
  /**
   * Show the "auto-schedule" toolbar button. Clicking it runs a one-shot
   * dependency-driven reschedule of the whole project (顺延): every successor is
   * pushed later until its link constraints hold, preserving durations, and the
   * resulting date changes are emitted via `onTaskUpdate`. Requires onTaskUpdate.
   */
  autoSchedule?: boolean
  /**
   * After a bar drag/resize, validate the move against dependency constraints
   * (拖拽冲突校验). If the new position would violate a link — the task moved
   * earlier than a predecessor allows, or its move pushes successors past their
   * constraints — a confirmation prompts to 自动顺延 (cascade-reschedule the
   * affected tasks, preserving durations) or keep the overlap. Requires
   * onTaskUpdate and only fires when links exist. Ignored in readOnly.
   */
  rescheduleOnConflict?: boolean
  /** Start with the critical-path highlight enabled (toggle stays in the toolbar). */
  criticalPathDefault?: boolean
  /**
   * Working calendar for duration math. When set, auto-schedule and critical
   * path count working days only — weekends (`skipWeekends`) and any `holidays`
   * (ISO `yyyy-mm-dd` UTC keys) are skipped rather than consumed.
   */
  workingCalendar?: WorkingCalendar
  /** Render planned-vs-actual baseline bars when tasks carry baseline dates. */
  showBaselines?: boolean
  /**
   * Read-only mode. When true, every write interaction is disabled regardless
   * of which callbacks are passed: no bar drag / resize / progress handle, no
   * inline editing, no delete, no dependency-link drag, no row reorder, no
   * auto-schedule, and the Undo/Redo toolbar buttons are hidden. Clicking a
   * task (`onTaskClick`) and switching granularity still work — those don't
   * mutate data. Equivalent to omitting all write callbacks, but explicit and
   * metadata-drivable.
   */
  readOnly?: boolean
  /**
   * Dynamic grouping accessor (动态 Group by). When provided, leaf tasks are
   * bucketed by the returned `key` and rendered beneath one synthesized summary
   * row per group — the original `parent` hierarchy is replaced by the grouping.
   * Return `null` to drop a task into the "ungrouped" bucket. Grouping is purely
   * presentational: the timeline range, critical path and auto-schedule still run
   * on the real task list, and the synthetic group rows are never draggable.
   */
  groupBy?: (task: GanttTask) => { key: string | number; label: string } | null
  /** Label for the bucket collecting tasks whose `groupBy` returns null. */
  ungroupedLabel?: string
}

export function GanttView({
  tasks,
  viewMode: viewModeProp,
  startDate,
  endDate,
  markers,
  onTaskClick,
  onTaskUpdate: onTaskUpdateProp,
  onTaskDelete: onTaskDeleteProp,
  onViewChange,
  onDependencyCreate: onDependencyCreateProp,
  onDependencyDelete: onDependencyDeleteProp,
  onTaskReorder: onTaskReorderProp,
  className,
  inlineEdit: inlineEditProp = false,
  autoSchedule: autoScheduleProp = false,
  rescheduleOnConflict: rescheduleOnConflictProp = false,
  criticalPathDefault = false,
  workingCalendar,
  showBaselines = true,
  readOnly = false,
  groupBy,
  ungroupedLabel = 'Ungrouped',
}: GanttViewProps) {
  // Read-only gating, applied once at the top so every downstream usage —
  // drag/resize/progress, inline edit, delete, link-drag, reorder,
  // auto-schedule, and the Undo/Redo toolbar (which keys off onTaskUpdate) —
  // inherits it. `onTaskClick` / `onViewChange` stay live: they don't mutate.
  const onTaskUpdate = readOnly ? undefined : onTaskUpdateProp;
  const onTaskDelete = readOnly ? undefined : onTaskDeleteProp;
  const onDependencyCreate = readOnly ? undefined : onDependencyCreateProp;
  const onDependencyDelete = readOnly ? undefined : onDependencyDeleteProp;
  const onTaskReorder = readOnly ? undefined : onTaskReorderProp;
  const inlineEdit = readOnly ? false : inlineEditProp;
  const autoSchedule = readOnly ? false : autoScheduleProp;
  const rescheduleOnConflict = readOnly ? false : rescheduleOnConflictProp;
  const { t, language } = useGanttTranslation();
  // Locale for every user-facing date label. Falls back to the runtime default
  // (browser locale) when no I18nProvider supplies a language, so standalone
  // embeds and tests behave exactly as before.
  const dateLocale = language || undefined;
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { width: containerWidth } = useResizeObserver(containerRef);
  const effectiveWidth = containerWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const isNarrow = effectiveWidth < 640;
  const rowHeight = rowHeightForContainer(effectiveWidth);
  const baseColumnWidth = columnWidthForContainer(effectiveWidth);
  // Mobile UX (round 3): make zoom + list-collapse stateful so the toolbar
  // buttons + pinch-to-zoom gesture actually persist.
  const [columnWidthOverride, setColumnWidthOverride] = React.useState<number | null>(null);
  // Timeline granularity. The prop seeds (and can later override) the state;
  // the toolbar segmented control switches it interactively.
  const [viewMode, setViewMode] = React.useState<GanttViewMode>(
    viewModeProp && VIEW_MODES.includes(viewModeProp) ? viewModeProp : 'day'
  );
  React.useEffect(() => {
    if (viewModeProp && VIEW_MODES.includes(viewModeProp)) setViewMode(viewModeProp);
  }, [viewModeProp]);
  const changeViewMode = React.useCallback((mode: GanttViewMode) => {
    setViewMode(mode);
    onViewChange?.(mode);
  }, [onViewChange]);
  const [taskListCollapsed, setTaskListCollapsed] = React.useState<boolean>(false);
  // Auto-collapse the list once on first narrow render — undoable by the user.
  const collapsedAutoSet = React.useRef(false);
  React.useEffect(() => {
    if (!collapsedAutoSet.current && isNarrow) {
      setTaskListCollapsed(true);
      collapsedAutoSet.current = true;
    }
  }, [isNarrow]);
  const taskListWidth = taskListCollapsed ? 0 : taskListWidthForContainer(effectiveWidth);
  // Fit-to-width ("zoom to fit"): in coarse modes a short project's natural grid
  // (span × base px/day) is far narrower than the timeline area, leaving the
  // right side blank. Rather than pad the calendar with years of empty units, we
  // STRETCH the column width so the real span fills the viewport. A manual zoom
  // (columnWidthOverride) always wins; a long project whose grid already
  // overflows keeps the base width and simply scrolls.
  const fitColumnWidth = React.useMemo(() => {
    // Only stretch when the right edge is auto-derived; a caller-pinned endDate
    // means a deliberate window, so respect the fixed per-unit width and scroll.
    if (columnWidthOverride != null || endDate || tasks.length === 0) return null;
    let start = startDate ? new Date(startDate) : new Date(Math.min(...tasks.map((t) => t.start.getTime())));
    const end = new Date(Math.max(...tasks.map((t) => t.end.getTime())));
    if (!startDate) start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 14);
    start = startOfUnit(start, viewMode);
    end.setHours(23, 59, 59, 999);
    const spanDays = Math.max(1, (end.getTime() - start.getTime()) / MS_PER_DAY);
    const avail = Math.max(0, effectiveWidth - taskListWidth);
    if (avail <= 0) return null;
    // Column width that makes the natural span exactly fill the area.
    const fit = (avail / spanDays) * NOMINAL_DAYS[viewMode];
    if (fit <= baseColumnWidth) return null; // grid already overflows → scroll
    // Cap so one unit can't dominate (keep ≥ ~2 columns visible) — a sub-unit
    // project then fills most of the area with a small honest gap, not 1 slab.
    const capped = Math.min(fit, avail * 0.6);
    return capped > baseColumnWidth ? capped : null;
  }, [columnWidthOverride, tasks, startDate, endDate, viewMode, effectiveWidth, taskListWidth, baseColumnWidth]);
  const columnWidth = columnWidthOverride ?? fitColumnWidth ?? baseColumnWidth;
  // One column = one unit of the active granularity; bars/markers map time
  // linearly at pxPerDay so they stay aligned with the calendar-width columns.
  const pxPerDay = columnWidth / NOMINAL_DAYS[viewMode];
  const showSEColumns = showStartEndColumns(taskListWidth);
  const [editingTask, setEditingTask] = React.useState<string | number | null>(null);
  const [editValues, setEditValues] = React.useState<Record<string, string>>({});
  // Hovered bar id — used to highlight its dependency links.
  const [hoveredTaskId, setHoveredTaskId] = React.useState<string | number | null>(null);

  // Dynamic Group by (动态 Group by). When `groupBy` is set we synthesize one
  // summary row per bucket and reparent each leaf task onto it, replacing the
  // original hierarchy. The existing rollup/collapse/summary machinery then
  // renders the groups for free. This is a PRESENTATIONAL transform: the
  // timeline range, critical path and auto-schedule deliberately keep reading
  // the real `tasks` prop (see those memos), and synthetic rows carry
  // `data.__group` so drag is suppressed. With no accessor, `displayTasks === tasks`.
  const displayTasks = React.useMemo<GanttTask[]>(() => {
    if (!groupBy) return tasks;
    // Grouping operates on leaf tasks; original parent rows (summaries) are
    // dropped and their leaves regrouped under the new buckets.
    const parentIds = new Set<string>();
    for (const tk of tasks) {
      const p = tk.parent != null && tk.parent !== '' ? String(tk.parent) : null;
      if (p) parentIds.add(p);
    }
    type Bucket = { key: string; label: string; items: GanttTask[] };
    const buckets = new Map<string, Bucket>(); // insertion order = first-seen
    for (const tk of tasks) {
      if (parentIds.has(String(tk.id))) continue;
      const g = groupBy(tk);
      const key = g ? String(g.key) : '__ungrouped__';
      const label = g ? g.label : ungroupedLabel;
      let b = buckets.get(key);
      if (!b) { b = { key, label, items: [] }; buckets.set(key, b); }
      b.items.push(tk);
    }
    const out: GanttTask[] = [];
    for (const b of buckets.values()) {
      const gid = `__group__${b.key}`;
      const first = b.items[0];
      // Placeholder dates — rollup recomputes the true span from the children.
      out.push({
        id: gid,
        title: b.label,
        start: first.start,
        end: first.end,
        progress: 0,
        type: 'summary',
        parent: null,
        data: { __group: true },
      });
      for (const tk of b.items) out.push({ ...tk, parent: gid });
    }
    return out;
  }, [groupBy, tasks, ungroupedLabel]);

  // Children index for group operations: dragging a summary bar moves its
  // whole subtree by the same offset. Mirrors the orphan/self-parent rules
  // of the row tree below.
  const childrenByParent = React.useMemo(() => {
    const ids = new Set(displayTasks.map((t) => String(t.id)));
    const map = new Map<string, GanttTask[]>();
    for (const t of displayTasks) {
      const p = t.parent != null && t.parent !== '' ? String(t.parent) : null;
      if (p && p !== String(t.id) && ids.has(p)) {
        const list = map.get(p);
        if (list) list.push(t);
        else map.set(p, [t]);
      }
    }
    return map;
  }, [displayTasks]);

  const taskById = React.useMemo(() => {
    const m = new Map<string, GanttTask>();
    for (const t of displayTasks) m.set(String(t.id), t);
    return m;
  }, [displayTasks]);

  const collectDescendants = React.useCallback((id: string | number): GanttTask[] => {
    const out: GanttTask[] = [];
    const seen = new Set<string>();
    const walk = (key: string) => {
      for (const c of childrenByParent.get(key) ?? []) {
        const ck = String(c.id);
        if (seen.has(ck)) continue; // parent cycles
        seen.add(ck);
        out.push(c);
        walk(ck);
      }
    };
    walk(String(id));
    return out;
  }, [childrenByParent]);

  // Drag-and-drop state for rescheduling a bar (move + resize from either edge).
  // unitDelta is the snapped offset, in columns of the active granularity, from
  // the original position; preview is rendered by overriding left/width when
  // dragState.taskId matches.
  type DragMode = 'move' | 'resize-left' | 'resize-right';
  const [dragState, setDragState] = React.useState<{
    taskId: string | number;
    mode: DragMode;
    /** Summary-bar drag: shift the whole subtree by the same offset. */
    group: boolean;
    originStart: Date;
    originEnd: Date;
    originClientX: number;
    unitDelta: number;
  } | null>(null);
  const dragStateRef = React.useRef<typeof dragState>(null);
  React.useEffect(() => { dragStateRef.current = dragState; }, [dragState]);
  // Suppress the click that fires immediately after a drag pointerup.
  const suppressNextClickRef = React.useRef(false);

  const computeDragChanges = React.useCallback((s: NonNullable<typeof dragState>) => {
    const minDurationMs = MS_PER_DAY; // never collapse below 1 day
    // Folded axes advance by working columns (Fri +1 → Mon); otherwise snap to
    // whole calendar units. foldShiftRef is set during render (below).
    const shift = (date: Date, n: number) =>
      foldShiftRef.current ? foldShiftRef.current(date, n) : addUnits(date, n, viewMode);
    let start = new Date(s.originStart);
    let end = new Date(s.originEnd);
    if (s.mode === 'move') {
      // Snap the start to whole units; the end follows by the same ms offset
      // so the task keeps its duration even across uneven months.
      start = shift(s.originStart, s.unitDelta);
      end = new Date(s.originEnd.getTime() + (start.getTime() - s.originStart.getTime()));
    } else if (s.mode === 'resize-left') {
      start = shift(s.originStart, s.unitDelta);
      if (end.getTime() - start.getTime() < minDurationMs) {
        start = new Date(end.getTime() - minDurationMs);
      }
    } else if (s.mode === 'resize-right') {
      end = shift(s.originEnd, s.unitDelta);
      if (end.getTime() - start.getTime() < minDurationMs) {
        end = new Date(start.getTime() + minDurationMs);
      }
    }
    return { start, end };
  }, [viewMode]);

  // --- Undo / redo (Phase 6) --------------------------------------------
  // GanttView is presentational — the parent owns task state — so we can't
  // snapshot it directly. Instead each committed mutation (drag/resize, group
  // drag, progress, inline edit, auto-schedule) is recorded as a batch of
  // {taskId, before, after} field deltas and replayed through onTaskUpdate.
  // Undo applies `before`, redo re-applies `after`; both look the task up by id
  // in the latest `tasks` so a parent re-render between commits is fine.
  type HistoryItem = { taskId: string; before: Partial<GanttTask>; after: Partial<GanttTask> };
  const tasksRef = React.useRef(tasks);
  tasksRef.current = tasks;
  const undoStackRef = React.useRef<HistoryItem[][]>([]);
  const redoStackRef = React.useRef<HistoryItem[][]>([]);
  const [historyVersion, setHistoryVersion] = React.useState(0);

  const commitTaskUpdates = React.useCallback(
    (updates: Array<{ task: GanttTask; changes: Partial<Pick<GanttTask, 'title' | 'start' | 'end' | 'progress'>> }>) => {
      if (!onTaskUpdate) return;
      const batch: HistoryItem[] = [];
      for (const { task, changes } of updates) {
        const before: Partial<GanttTask> = {};
        const after: Partial<GanttTask> = {};
        let dirty = false;
        for (const k of Object.keys(changes) as Array<keyof GanttTask>) {
          const next = (changes as Record<string, unknown>)[k as string];
          const prev = (task as unknown as Record<string, unknown>)[k as string];
          const same =
            next instanceof Date && prev instanceof Date
              ? next.getTime() === prev.getTime()
              : next === prev;
          (before as Record<string, unknown>)[k as string] = prev;
          (after as Record<string, unknown>)[k as string] = next;
          if (!same) dirty = true;
        }
        onTaskUpdate(task, changes);
        if (dirty) batch.push({ taskId: String(task.id), before, after });
      }
      if (batch.length) {
        undoStackRef.current.push(batch);
        redoStackRef.current = [];
        setHistoryVersion((v) => v + 1);
      }
    },
    [onTaskUpdate],
  );

  // --- 拖拽冲突校验 + 顺延确认 (Group 2) ---
  // After a bar drag/resize commits, replay the dependency forward-pass over the
  // moved task(s). If the new position would violate a link (a predecessor ends
  // after the dragged task starts, or a successor now overlaps the dragged
  // task), computeProjectReschedule returns a non-empty change set that differs
  // from what the drag itself applied — that delta is the conflict we surface.
  const [pendingConflict, setPendingConflict] = React.useState<RescheduleChange[] | null>(null);

  const maybeFlagConflict = React.useCallback(
    (applied: Array<{ task: GanttTask; changes: { start?: Date; end?: Date } }>) => {
      if (!rescheduleOnConflict) return;
      const overrides = new Map<string, { start: Date; end: Date }>();
      for (const { task, changes } of applied) {
        overrides.set(String(task.id), {
          start: changes.start ?? task.start,
          end: changes.end ?? task.end,
        });
      }
      const candidate = tasksRef.current.map((t) => {
        const o = overrides.get(String(t.id));
        return o ? { ...t, start: o.start, end: o.end } : t;
      });
      const changes = computeProjectReschedule(candidate, workingCalendar);
      // A change that merely restates the drag override is not a conflict.
      const conflict = changes.filter((c) => {
        const o = overrides.get(c.id);
        return !o || c.start.getTime() !== o.start.getTime() || c.end.getTime() !== o.end.getTime();
      });
      if (conflict.length) setPendingConflict(conflict);
    },
    [rescheduleOnConflict, workingCalendar],
  );

  const applyReschedule = React.useCallback(() => {
    if (!pendingConflict) return;
    const updates = pendingConflict
      .map((c) => {
        const task = tasksRef.current.find((tk) => String(tk.id) === c.id);
        return task ? { task, changes: { start: c.start, end: c.end } } : null;
      })
      .filter(Boolean) as Array<{ task: GanttTask; changes: { start: Date; end: Date } }>;
    if (updates.length) commitTaskUpdates(updates);
    setPendingConflict(null);
  }, [pendingConflict, commitTaskUpdates]);

  const applyHistory = React.useCallback(
    (batch: HistoryItem[], dir: 'undo' | 'redo') => {
      if (!onTaskUpdate) return;
      for (const item of batch) {
        const task = tasksRef.current.find((tk) => String(tk.id) === item.taskId);
        if (task) {
          onTaskUpdate(task, (dir === 'undo' ? item.before : item.after) as Partial<
            Pick<GanttTask, 'title' | 'start' | 'end' | 'progress'>
          >);
        }
      }
    },
    [onTaskUpdate],
  );

  const undo = React.useCallback(() => {
    const batch = undoStackRef.current.pop();
    if (!batch) return;
    applyHistory(batch, 'undo');
    redoStackRef.current.push(batch);
    setHistoryVersion((v) => v + 1);
  }, [applyHistory]);

  const redo = React.useCallback(() => {
    const batch = redoStackRef.current.pop();
    if (!batch) return;
    applyHistory(batch, 'redo');
    undoStackRef.current.push(batch);
    setHistoryVersion((v) => v + 1);
  }, [applyHistory]);

  // historyVersion bumps on every push/pop so these re-read the live refs.
  const { canUndo, canRedo } = React.useMemo(
    () => ({ canUndo: undoStackRef.current.length > 0, canRedo: redoStackRef.current.length > 0 }),
    [historyVersion],
  );

  // Window-level pointer listeners: track horizontal motion snapped to whole
  // columns (days/weeks/months/quarters depending on the active granularity),
  // commit via onTaskUpdate on pointerup, suppress the trailing click.
  React.useEffect(() => {
    if (!dragState) return;
    const onMove = (e: PointerEvent) => {
      const cur = dragStateRef.current;
      if (!cur) return;
      const next = Math.round((e.clientX - cur.originClientX) / Math.max(columnWidth, 1));
      if (next !== cur.unitDelta) {
        setDragState({ ...cur, unitDelta: next });
      }
    };
    const onUp = () => {
      const cur = dragStateRef.current;
      if (!cur) return;
      if (cur.unitDelta !== 0) {
        const task = tasks.find(t => t.id === cur.taskId);
        if (task && onTaskUpdate) {
          const { start, end } = computeDragChanges(cur);
          if (cur.group) {
            // Move the summary and every descendant by the same ms offset so
            // the subtree keeps its internal spacing and durations — recorded as
            // a single undoable batch.
            const deltaMs = start.getTime() - cur.originStart.getTime();
            const shifted = [task, ...collectDescendants(task.id)].map((t) => ({
              task: t,
              changes: {
                start: new Date(t.start.getTime() + deltaMs),
                end: new Date(t.end.getTime() + deltaMs),
              },
            }));
            commitTaskUpdates(shifted);
            maybeFlagConflict(shifted);
          } else {
            const applied = [{ task, changes: { start, end } }];
            commitTaskUpdates(applied);
            maybeFlagConflict(applied);
          }
        }
        suppressNextClickRef.current = true;
        // Reset suppression on next animation frame after the click fires.
        window.setTimeout(() => { suppressNextClickRef.current = false; }, 0);
      }
      setDragState(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragState, columnWidth, tasks, onTaskUpdate, computeDragChanges, collectDescendants, commitTaskUpdates, maybeFlagConflict]);

  const beginDrag = React.useCallback((
    task: GanttTask,
    mode: DragMode,
    e: React.PointerEvent,
    opts?: { group?: boolean; originStart?: Date; originEnd?: Date }
  ) => {
    // Synthetic Group-by rows have no real backing task to mutate.
    if (!onTaskUpdate || task.data?.__group) return;
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      taskId: task.id,
      mode,
      group: opts?.group ?? false,
      // Summary bars pass their rollup range so the drag chip and snapping
      // reflect what is actually on screen, not the task's own raw dates.
      originStart: new Date(opts?.originStart ?? task.start),
      originEnd: new Date(opts?.originEnd ?? task.end),
      originClientX: e.clientX,
      unitDelta: 0,
    });
  }, [onTaskUpdate]);

  // --- Progress drag handle ------------------------------------------------
  // A grip at the progress boundary inside the bar; horizontal motion maps
  // 1:1 to percent of the bar width, committed via onTaskUpdate({progress}).
  const [progressDrag, setProgressDrag] = React.useState<{
    taskId: string | number;
    originClientX: number;
    originProgress: number;
    barWidth: number;
    value: number;
  } | null>(null);
  const progressDragRef = React.useRef<typeof progressDrag>(null);
  React.useEffect(() => { progressDragRef.current = progressDrag; }, [progressDrag]);

  React.useEffect(() => {
    if (!progressDrag) return;
    const onMove = (e: PointerEvent) => {
      const cur = progressDragRef.current;
      if (!cur) return;
      const next = Math.min(100, Math.max(0, Math.round(
        cur.originProgress + ((e.clientX - cur.originClientX) / Math.max(cur.barWidth, 1)) * 100
      )));
      if (next !== cur.value) setProgressDrag({ ...cur, value: next });
    };
    const onUp = () => {
      const cur = progressDragRef.current;
      if (!cur) return;
      if (cur.value !== cur.originProgress) {
        const task = tasks.find((t) => t.id === cur.taskId);
        if (task && onTaskUpdate) commitTaskUpdates([{ task, changes: { progress: cur.value } }]);
        suppressNextClickRef.current = true;
        window.setTimeout(() => { suppressNextClickRef.current = false; }, 0);
      }
      setProgressDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [progressDrag, tasks, onTaskUpdate, commitTaskUpdates]);

  // --- Drag-to-create dependency -------------------------------------------
  // Dragging the connector dot on a bar draws a dashed rubber band; releasing
  // over another bar fires onDependencyCreate(source, target, 'fs'). The
  // hovered target is tracked by bar-level pointermove (no pointer capture).
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [linkDrag, setLinkDrag] = React.useState<{
    sourceId: string | number;
    x: number;
    y: number;
    targetId: string | number | null;
  } | null>(null);
  const linkDragRef = React.useRef<typeof linkDrag>(null);
  React.useEffect(() => { linkDragRef.current = linkDrag; }, [linkDrag]);

  React.useEffect(() => {
    if (!linkDrag) return;
    const onMove = (e: PointerEvent) => {
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLinkDrag((prev) => (prev ? { ...prev, x, y } : prev));
    };
    const onUp = () => {
      const cur = linkDragRef.current;
      if (cur && cur.targetId != null && String(cur.targetId) !== String(cur.sourceId) && onDependencyCreate) {
        const source = tasks.find((t) => String(t.id) === String(cur.sourceId));
        const target = tasks.find((t) => String(t.id) === String(cur.targetId));
        if (source && target) onDependencyCreate(source, target, 'fs');
      }
      suppressNextClickRef.current = true;
      window.setTimeout(() => { suppressNextClickRef.current = false; }, 0);
      setLinkDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [linkDrag, tasks, onDependencyCreate]);

  // --- Context menu ---------------------------------------------------------
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number; taskId: string | number } | null>(null);
  const ctxMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ctxMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ctxMenuRef.current && e.target instanceof Node && ctxMenuRef.current.contains(e.target)) return;
      setCtxMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  // --- Dependency link context menu (依赖增删 + 类型选择) ---------------------
  // Right-clicking a dependency link opens a small menu to switch its type
  // (FS/SS/FF/SF) or remove it. Closing mirrors the task context menu.
  const [linkCtxMenu, setLinkCtxMenu] = React.useState<{
    x: number;
    y: number;
    sourceId: string | number;
    targetId: string | number;
    type: GanttLinkType;
  } | null>(null);
  const linkCtxMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!linkCtxMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (linkCtxMenuRef.current && e.target instanceof Node && linkCtxMenuRef.current.contains(e.target)) return;
      setLinkCtxMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLinkCtxMenu(null); };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [linkCtxMenu]);

  // --- "添加紧前/紧后" dependency picker --------------------------------------
  // A secondary panel that lists candidate tasks; choosing one creates a
  // dependency. `relation: 'pred'` makes the picked task a predecessor of the
  // anchor (anchor depends on picked); `'succ'` makes it a successor.
  const [depPicker, setDepPicker] = React.useState<{
    x: number;
    y: number;
    taskId: string | number;
    relation: 'pred' | 'succ';
  } | null>(null);
  const depPickerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!depPicker) return;
    const onPointerDown = (e: PointerEvent) => {
      if (depPickerRef.current && e.target instanceof Node && depPickerRef.current.contains(e.target)) return;
      setDepPicker(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDepPicker(null); };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [depPicker]);

  // --- Keyboard navigation ---------------------------------------------------
  // The gantt body is focusable; arrows move the selection, Enter opens,
  // Delete deletes, Left/Right collapse/expand summary rows.
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | number | null>(null);

  const openContextMenu = React.useCallback((task: GanttTask, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTaskId(task.id);
    setCtxMenu({ x: e.clientX, y: e.clientY, taskId: task.id });
  }, []);

  const openLinkContextMenu = React.useCallback(
    (sourceId: string | number, targetId: string | number, type: GanttLinkType, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setLinkCtxMenu({ x: e.clientX, y: e.clientY, sourceId, targetId, type });
    },
    [],
  );

  // --- Task hierarchy -----------------------------------------------------
  // `task.parent` builds a tree; rows are the depth-first flattening with
  // collapsed subtrees removed. Summary rows (any task with children, or
  // explicit type 'summary') get their dates/progress rolled up from their
  // descendants; milestones are zero-duration diamonds.
  type GanttRow = {
    task: GanttTask;
    depth: number;
    hasChildren: boolean;
    isSummary: boolean;
    isMilestone: boolean;
    /** Effective dates/progress — children rollup for summary rows. */
    start: Date;
    end: Date;
    progress: number;
  };

  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(() => new Set());
  const toggleCollapsed = React.useCallback((id: string | number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const rows = React.useMemo<GanttRow[]>(() => {
    const ids = new Set(displayTasks.map((t) => String(t.id)));
    const byParent = new Map<string, GanttTask[]>();
    const roots: GanttTask[] = [];
    for (const t of displayTasks) {
      const p = t.parent != null && t.parent !== '' ? String(t.parent) : null;
      // Orphans (unknown parent id) and self-parents render as roots.
      if (p && p !== String(t.id) && ids.has(p)) {
        const list = byParent.get(p);
        if (list) list.push(t);
        else byParent.set(p, [t]);
      } else {
        roots.push(t);
      }
    }

    // Post-order rollup: a summary spans its children and averages their
    // progress weighted by duration. `path` guards against parent cycles.
    const rollupCache = new Map<string, { start: Date; end: Date; progress: number }>();
    const rollup = (t: GanttTask, path: Set<string>): { start: Date; end: Date; progress: number } => {
      const key = String(t.id);
      const cached = rollupCache.get(key);
      if (cached) return cached;
      const children = byParent.get(key) ?? [];
      let result: { start: Date; end: Date; progress: number };
      if (!children.length || path.has(key)) {
        result = { start: t.start, end: t.end, progress: t.progress };
      } else {
        path.add(key);
        let start: Date | null = null;
        let end: Date | null = null;
        let weighted = 0;
        let total = 0;
        for (const c of children) {
          const r = rollup(c, path);
          if (!start || r.start < start) start = r.start;
          if (!end || r.end > end) end = r.end;
          const dur = Math.max(r.end.getTime() - r.start.getTime(), MS_PER_DAY);
          weighted += dur * r.progress;
          total += dur;
        }
        path.delete(key);
        result = { start: start!, end: end!, progress: total ? weighted / total : 0 };
      }
      rollupCache.set(key, result);
      return result;
    };

    const out: GanttRow[] = [];
    const visited = new Set<string>();
    const markSubtreeVisited = (t: GanttTask) => {
      for (const c of byParent.get(String(t.id)) ?? []) {
        if (!visited.has(String(c.id))) {
          visited.add(String(c.id));
          markSubtreeVisited(c);
        }
      }
    };
    const walk = (t: GanttTask, depth: number) => {
      const key = String(t.id);
      if (visited.has(key)) return;
      visited.add(key);
      const children = byParent.get(key) ?? [];
      const hasChildren = children.length > 0;
      const isSummary = hasChildren || t.type === 'summary';
      const eff = hasChildren
        ? rollup(t, new Set())
        : { start: t.start, end: t.end, progress: t.progress };
      const isMilestone =
        !isSummary && (t.type === 'milestone' || t.end.getTime() <= t.start.getTime());
      out.push({ task: t, depth, hasChildren, isSummary, isMilestone, ...eff });
      if (hasChildren) {
        if (collapsedIds.has(key)) {
          markSubtreeVisited(t); // hidden, but not re-surfaced by the cycle sweep
        } else {
          for (const c of children) walk(c, depth + 1);
        }
      }
    };
    for (const r of roots) walk(r, 0);
    // Parent cycles (a↔b) are unreachable from any root — surface them flat
    // at the bottom rather than dropping rows silently.
    for (const t of displayTasks) if (!visited.has(String(t.id))) walk(t, 0);
    return out;
  }, [displayTasks, collapsedIds]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Undo / redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (!rows.length) return;
    const idx = selectedTaskId == null
      ? -1
      : rows.findIndex((r) => String(r.task.id) === String(selectedTaskId));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown'
        ? Math.min(rows.length - 1, idx + 1)
        : Math.max(0, idx <= 0 ? 0 : idx - 1);
      setSelectedTaskId(rows[next].task.id);
      // Keep the selected (possibly virtualized-out) row in view.
      const el = scrollAreaRef.current;
      if (el) {
        const top = next * rowHeight;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (top + rowHeight > el.scrollTop + el.clientHeight) {
          el.scrollTop = top + rowHeight - el.clientHeight;
        }
      }
      return;
    }
    if (idx < 0) return;
    const row = rows[idx];
    if (e.key === 'Enter') {
      e.preventDefault();
      onTaskClick?.(row.task);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (onTaskDelete) {
        e.preventDefault();
        onTaskDelete(row.task);
      }
    } else if (e.key === 'ArrowRight' && row.hasChildren && collapsedIds.has(String(row.task.id))) {
      e.preventDefault();
      toggleCollapsed(row.task.id);
    } else if (e.key === 'ArrowLeft' && row.hasChildren && !collapsedIds.has(String(row.task.id))) {
      e.preventDefault();
      toggleCollapsed(row.task.id);
    }
  }, [rows, selectedTaskId, onTaskClick, onTaskDelete, collapsedIds, toggleCollapsed, rowHeight, undo, redo]);

  // Calculate timeline range
  const timelineRange = React.useMemo(() => {
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();
    
    if (!startDate && tasks.length > 0) {
      // Find min start date
      start = new Date(Math.min(...tasks.map(t => t.start.getTime())));
      // Add padding
      start.setDate(start.getDate() - 7);
    }
    
    if (!endDate && tasks.length > 0) {
      // Find max end date
      end = new Date(Math.max(...tasks.map(t => t.end.getTime())));
      // Add padding
      end.setDate(end.getDate() + 14);
    }
    
    // Snap the start to a column boundary of the active granularity so
    // bars (linear ms→px from range start) line up with the grid.
    start = startOfUnit(start, viewMode);
    end.setHours(23,59,59,999);

    // NOTE: we deliberately do NOT pad the calendar to fill the viewport.
    // Adding empty trailing units would, in coarse modes, mean years of blank
    // columns (a 2.5-month project in month mode needs ~2.5 years of empty
    // months to reach the right edge). Instead the grid keeps its natural span
    // and `fitColumnWidth` stretches the column width so a short project still
    // fills the area — the industry "zoom to fit" approach.
    return { start, end };
  }, [startDate, endDate, tasks, viewMode]);

  // Non-linear working-time axis (非线性工作时间轴). In day mode, when a working
  // calendar marks weekends/holidays as non-working, those columns are DROPPED
  // from the grid entirely — Friday sits directly against Monday — so the
  // timeline shows only working time. This makes the date→px mapping non-linear
  // (a weekend spans zero pixels), which is why all positioning is routed
  // through `dateToX`/`xToDate` below rather than a flat ms→px factor.
  const folding =
    viewMode === 'day' &&
    !!workingCalendar &&
    (!!workingCalendar.skipWeekends || !!(workingCalendar.holidays && workingCalendar.holidays.size));

  const isWorkingColumn = React.useCallback(
    (date: Date): boolean => {
      if (!workingCalendar) return true;
      if (workingCalendar.skipWeekends) {
        const wd = date.getDay();
        if (wd === 0 || wd === 6) return false;
      }
      if (workingCalendar.holidays && workingCalendar.holidays.size) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (workingCalendar.holidays.has(key)) return false;
      }
      return true;
    },
    [workingCalendar],
  );

  // Generate timeline columns — one per unit of the active granularity.
  // Widths follow the calendar at pxPerDay, so a 31-day month column is
  // slightly wider than a 30-day one and stays aligned with the bars.
  const timeColumns = React.useMemo(() => {
    const cols: { date: Date; label: string; sublabel?: string; isWeekend: boolean; width: number }[] = [];
    let current = new Date(timelineRange.start);

    while (current <= timelineRange.end) {
      const next = addUnits(current, 1, viewMode);
      // Fold non-working columns out of the grid (day mode + working calendar).
      if (folding && !isWorkingColumn(current)) {
        current = next;
        continue;
      }
      const width = ((next.getTime() - current.getTime()) / MS_PER_DAY) * pxPerDay;
      let label: string;
      let sublabel: string | undefined;
      if (viewMode === 'day') {
        label = String(current.getDate());
        sublabel = current.toLocaleDateString(dateLocale, { weekday: 'narrow' });
      } else if (viewMode === 'week') {
        label = current.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' });
      } else if (viewMode === 'month') {
        label = current.toLocaleDateString(dateLocale, { month: 'short' });
      } else {
        label = `Q${Math.floor(current.getMonth() / 3) + 1}`;
      }
      cols.push({
        date: new Date(current),
        label,
        sublabel,
        isWeekend: viewMode === 'day' && (current.getDay() === 0 || current.getDay() === 6),
        width,
      });
      current = next;
    }

    return cols;
  }, [timelineRange, viewMode, pxPerDay, dateLocale, folding, isWorkingColumn]);

  // Prefix sums of column widths — left edge of column i, used both for
  // positioning the virtualized cells and for the visible-range search.
  const colOffsets = React.useMemo(() => {
    const offs = new Array<number>(timeColumns.length + 1);
    let acc = 0;
    for (let i = 0; i < timeColumns.length; i++) {
      offs[i] = acc;
      acc += timeColumns[i].width;
    }
    offs[timeColumns.length] = acc;
    return offs;
  }, [timeColumns]);

  const totalWidth = colOffsets[colOffsets.length - 1];

  // Per-column real-time anchors for the non-linear date↔px mapping. `colStartMs`
  // is each column's start timestamp; `colRealMs` its real calendar duration
  // (one day / week / month / quarter — uneven months included). When the axis
  // folds weekends out, columns are no longer time-contiguous, so positioning
  // can't use a single ms→px factor; it interpolates within the owning column.
  const colStartMs = React.useMemo(() => timeColumns.map((c) => c.date.getTime()), [timeColumns]);
  const colRealMs = React.useMemo(
    () => timeColumns.map((c) => addUnits(c.date, 1, viewMode).getTime() - c.date.getTime()),
    [timeColumns, viewMode],
  );

  // date → x (px). Binary-search the owning column, then interpolate within it.
  // For non-folded axes every column is time-contiguous, so this is exactly the
  // old linear `(ms / MS_PER_DAY) * pxPerDay`; for folded axes a date landing on
  // a dropped weekend column snaps to that column's working boundary.
  const dateToX = React.useCallback(
    (date: Date): number => {
      const n = timeColumns.length;
      if (n === 0) return 0;
      const t = date.getTime();
      let lo = 0;
      let hi = n - 1;
      let i = 0;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (colStartMs[m] <= t) {
          i = m;
          lo = m + 1;
        } else {
          hi = m - 1;
        }
      }
      const real = colRealMs[i] || MS_PER_DAY;
      let frac = (t - colStartMs[i]) / real;
      if (folding) frac = Math.max(0, Math.min(frac, 1));
      return colOffsets[i] + frac * timeColumns[i].width;
    },
    [timeColumns, colStartMs, colRealMs, colOffsets, folding],
  );

  // x (px) → date. Inverse of dateToX, used by drag/resize to read the date
  // under the pointer. Never returns a folded (non-working) instant.
  const xToDate = React.useCallback(
    (x: number): Date => {
      const n = timeColumns.length;
      if (n === 0) return new Date(timelineRange.start);
      let lo = 0;
      let hi = n - 1;
      let i = 0;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (colOffsets[m] <= x) {
          i = m;
          lo = m + 1;
        } else {
          hi = m - 1;
        }
      }
      const w = timeColumns[i].width || 1;
      const frac = (x - colOffsets[i]) / w;
      return new Date(colStartMs[i] + frac * (colRealMs[i] || MS_PER_DAY));
    },
    [timeColumns, colStartMs, colRealMs, colOffsets, timelineRange],
  );

  // Shift a date by N visible columns honouring the fold: +1 column from a
  // Friday lands on Monday, skipping the dropped weekend. Used by drag/resize
  // when the axis is folded so a one-column drag = one working day.
  const shiftByWorkingColumns = React.useCallback(
    (date: Date, n: number): Date => {
      const len = timeColumns.length;
      if (len === 0 || n === 0) return new Date(date);
      const t = date.getTime();
      let lo = 0;
      let hi = len - 1;
      let idx = 0;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (colStartMs[m] <= t) {
          idx = m;
          lo = m + 1;
        } else {
          hi = m - 1;
        }
      }
      const target = Math.min(len - 1, Math.max(0, idx + n));
      const offset = t - colStartMs[idx]; // preserve intra-day time-of-day
      return new Date(colStartMs[target] + offset);
    },
    [timeColumns, colStartMs],
  );

  // computeDragChanges (defined above) advances by whole units via addUnits in
  // the common case; when the axis folds, it routes through working columns so
  // a drag tracks the compressed grid. The ref keeps that callback stable.
  const foldShiftRef = React.useRef<((date: Date, n: number) => Date) | null>(null);
  foldShiftRef.current = folding ? shiftByWorkingColumns : null;

  // Upper scale row: month groups under day/week, year groups under month/quarter.
  const headerGroups = React.useMemo(() => {
    const groups: { key: string; label: string; width: number; offset: number }[] = [];
    const byYear = viewMode === 'month' || viewMode === 'quarter';
    let acc = 0;
    for (const col of timeColumns) {
      const key = byYear
        ? String(col.date.getFullYear())
        : `${col.date.getFullYear()}-${col.date.getMonth()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.width += col.width;
      } else {
        groups.push({
          key,
          label: byYear
            ? String(col.date.getFullYear())
            : col.date.toLocaleDateString(dateLocale, { month: 'short', year: 'numeric' }),
          width: col.width,
          offset: acc,
        });
      }
      acc += col.width;
    }
    return groups;
  }, [timeColumns, viewMode, dateLocale]);

  // Normalized custom markers (invalid/out-of-range dates dropped), positioned
  // through the same date→px mapping the bars and the Today line use so they
  // stay aligned when the axis folds non-working time.
  const resolvedMarkers = React.useMemo(() => {
    return (markers ?? [])
      .map((m, i) => {
        const date = m.date instanceof Date ? m.date : new Date(m.date);
        return {
          index: i,
          label: m.label,
          color: m.color || 'hsl(var(--primary))',
          left: Math.round(dateToX(date)),
          valid: !isNaN(date.getTime()) && date >= timelineRange.start && date <= timelineRange.end,
        };
      })
      .filter((m) => m.valid);
  }, [markers, timelineRange, dateToX]);

  const taskListWidth_LEGACY_REMOVED = null; // taskListWidth now derived from useResizeObserver above
  
  const headerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  // Wrapper around the scroll-syncing timeline body, so the pinch handler
  // and the "Today" button can target a stable node.
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // --- Virtualization ------------------------------------------------------
  // Rows and timeline columns render only what's in (or near) the viewport,
  // so the chart stays responsive with thousands of tasks / multi-year day
  // scales. Fallbacks cover jsdom (client sizes report 0 there).
  const [scrollPos, setScrollPos] = React.useState({ top: 0, left: 0 });
  const [viewport, setViewport] = React.useState({ width: 4000, height: 600 });
  const measureViewport = React.useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const width = el.clientWidth || 4000;
    const height = el.clientHeight || 600;
    setViewport((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  React.useLayoutEffect(() => {
    measureViewport();
    const el = scrollAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measureViewport);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureViewport]);

  // Visible windows. Overscan keeps scrolling seamless; the column margin is
  // in px (columns have calendar-variable widths), the row margin in rows.
  const COL_OVERSCAN_PX = 240;
  const ROW_OVERSCAN = 6;
  const colWindow = React.useMemo(
    () => visibleRange(colOffsets, scrollPos.left - COL_OVERSCAN_PX, scrollPos.left + viewport.width + COL_OVERSCAN_PX),
    [colOffsets, scrollPos.left, viewport.width]
  );
  const groupOffsets = React.useMemo(() => {
    const offs = headerGroups.map((g) => g.offset);
    offs.push(totalWidth);
    return offs;
  }, [headerGroups, totalWidth]);
  const groupWindow = React.useMemo(
    () => visibleRange(groupOffsets, scrollPos.left - COL_OVERSCAN_PX, scrollPos.left + viewport.width + COL_OVERSCAN_PX),
    [groupOffsets, scrollPos.left, viewport.width]
  );
  const rowWindow = React.useMemo(() => {
    const startIdx = Math.max(0, Math.floor(scrollPos.top / rowHeight) - ROW_OVERSCAN);
    const endIdx = Math.min(rows.length, Math.ceil((scrollPos.top + viewport.height) / rowHeight) + ROW_OVERSCAN);
    return { startIdx, endIdx };
  }, [scrollPos.top, viewport.height, rowHeight, rows.length]);
  const totalRowsHeight = rows.length * rowHeight;

  // --- Fullscreen -----------------------------------------------------------
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  React.useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  // Pinch-to-zoom state. Track distance between two touch points; deltas
  // adjust the column width within [15, 120].
  const pinchState = React.useRef<{ baseDistance: number; baseColumn: number } | null>(null);
  const onTouchStart = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = {
        baseDistance: Math.max(1, Math.sqrt(dx * dx + dy * dy)),
        baseColumn: columnWidth,
      };
    }
  }, [columnWidth]);
  const onTouchMove = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !pinchState.current) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const ratio = distance / pinchState.current.baseDistance;
    const next = Math.max(15, Math.min(120, Math.round(pinchState.current.baseColumn * ratio)));
    setColumnWidthOverride(next);
  }, []);
  const onTouchEnd = React.useCallback(() => { pinchState.current = null; }, []);

  // Compute the index (and pixel offset) of "today" within the timeline so
  // we can render a sticky marker AND scroll to it on demand.
  const todayLeftPx = React.useMemo(() => {
    const now = new Date();
    if (now < timelineRange.start || now > timelineRange.end) return null;
    return Math.round(dateToX(now));
  }, [timelineRange, dateToX]);
  const jumpToToday = React.useCallback(() => {
    if (todayLeftPx == null || !scrollAreaRef.current) return;
    const target = Math.max(0, todayLeftPx - scrollAreaRef.current.clientWidth / 2);
    scrollAreaRef.current.scrollTo({ left: target, behavior: 'smooth' });
  }, [todayLeftPx]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Sync horizontal scroll to header
    if (headerRef.current) {
        headerRef.current.scrollLeft = el.scrollLeft;
    }
    // Sync vertical scroll to task list
    if (listRef.current) {
        listRef.current.scrollTop = el.scrollTop;
    }
    // Drive the virtualization windows.
    setScrollPos((prev) =>
      prev.top === el.scrollTop && prev.left === el.scrollLeft
        ? prev
        : { top: el.scrollTop, left: el.scrollLeft }
    );
    measureViewport();
  };

  const styleFor = (start: Date, end: Date) => {
    // Route both edges through dateToX so bars compress with the axis when
    // non-working time folds out. For non-folded axes this is identical to the
    // old linear mapping (`(ms / MS_PER_DAY) * pxPerDay`).
    const left = dateToX(start);
    // Min 1 day, and never thinner than 3px so the bar stays visible (and
    // grabbable) at coarse granularities where a day is only ~2px.
    const width = Math.max(dateToX(end) - left, pxPerDay, 3);

    return { left, width };
  };

  // Ids previewed by an in-flight summary drag (the summary + its subtree).
  // Depends on the dragged id only, not on every unitDelta tick.
  const dragGroupTaskId = dragState?.group ? dragState.taskId : null;
  const dragGroupIds = React.useMemo(() => {
    if (dragGroupTaskId == null) return null;
    const set = new Set<string>([String(dragGroupTaskId)]);
    for (const d of collectDescendants(dragGroupTaskId)) set.add(String(d.id));
    return set;
  }, [dragGroupTaskId, collectDescendants]);

  // Ancestor summaries of the task being dragged on its own (not a group
  // drag). They stretch live so the parent bar grows/shrinks in real time as
  // the child crosses the parent's current extent, matching the rollup that
  // commits on drop. Null when no single-task drag is active.
  const dragStretchAncestorIds = React.useMemo(() => {
    if (!dragState || dragState.group) return null;
    const set = new Set<string>();
    const guard = new Set<string>();
    let cur = taskById.get(String(dragState.taskId));
    while (cur && cur.parent != null && cur.parent !== '') {
      const pk = String(cur.parent);
      if (guard.has(pk) || !taskById.has(pk)) break;
      guard.add(pk);
      set.add(pk);
      cur = taskById.get(pk);
    }
    return set.size ? set : null;
  }, [dragState, taskById]);

  // Row geometry (summary rollup applied) with the in-flight drag preview,
  // so dependency links follow the bar while it is being moved/resized.
  const getLiveRowStyle = (row: GanttRow) => {
    if (dragState) {
      if (dragGroupIds?.has(String(row.task.id))) {
        // Whole-group preview: every row in the subtree shifts by the same
        // snapped offset as the dragged summary bar.
        const previewed = computeDragChanges(dragState);
        const deltaMs = previewed.start.getTime() - dragState.originStart.getTime();
        return styleFor(
          new Date(row.start.getTime() + deltaMs),
          new Date(row.end.getTime() + deltaMs)
        );
      }
      if (!row.isSummary && dragState.taskId === row.task.id) {
        const previewed = computeDragChanges(dragState);
        return styleFor(previewed.start, previewed.end);
      }
      if (row.isSummary && dragStretchAncestorIds?.has(String(row.task.id))) {
        // Re-roll this ancestor's span over its leaf descendants, substituting
        // the dragged leaf's previewed dates. Summary tasks' own start/end are
        // ignored (they may be placeholders); only leaves define the extent.
        const previewed = computeDragChanges(dragState);
        const draggedId = String(dragState.taskId);
        let minStart: Date | null = null;
        let maxEnd: Date | null = null;
        for (const d of collectDescendants(row.task.id)) {
          const isLeaf = (childrenByParent.get(String(d.id)) ?? []).length === 0;
          if (!isLeaf) continue;
          const s = String(d.id) === draggedId ? previewed.start : d.start;
          const e = String(d.id) === draggedId ? previewed.end : d.end;
          if (!minStart || s < minStart) minStart = s;
          if (!maxEnd || e > maxEnd) maxEnd = e;
        }
        if (minStart && maxEnd) return styleFor(minStart, maxEnd);
      }
    }
    return styleFor(row.start, row.end);
  };

  // --- Dependency links --------------------------------------------------
  // `task.dependencies` lists predecessor ids; the arrow is drawn from the
  // predecessor bar to the dependent bar. Entries referencing unknown ids
  // (filtered records, cross-object refs) are silently skipped.
  type ResolvedLink = {
    key: string;
    sourceId: string | number; // predecessor
    targetId: string | number; // dependent task
    type: GanttLinkType;
    sourceIndex: number;
    targetIndex: number;
  };

  const links = React.useMemo<ResolvedLink[]>(() => {
    // Indexes are VISIBLE row positions — links into a collapsed subtree
    // simply disappear with their rows.
    const indexById = new Map<string, number>();
    rows.forEach((row, i) => indexById.set(String(row.task.id), i));
    const out: ResolvedLink[] = [];
    rows.forEach(({ task }, targetIndex) => {
      for (const dep of task.dependencies ?? []) {
        const isObj = typeof dep === 'object' && dep !== null;
        const depId = isObj ? (dep as GanttDependencyObject).id : dep;
        if (depId == null || depId === '') continue;
        const sourceIndex = indexById.get(String(depId));
        if (sourceIndex == null || sourceIndex === targetIndex) continue;
        const rawType = isObj ? (dep as GanttDependencyObject).type : undefined;
        const type: GanttLinkType =
          rawType === 'ss' || rawType === 'ff' || rawType === 'sf' ? rawType : 'fs';
        out.push({
          key: `${String(depId)}->${String(task.id)}:${type}`,
          sourceId: depId,
          targetId: task.id,
          type,
          sourceIndex,
          targetIndex,
        });
      }
    });
    return out;
  }, [rows]);

  // Shared row geometry: bars/diamonds/brackets and link anchors must agree
  // on these or arrows visibly miss their targets.
  const barTop = Math.round(rowHeight * 0.2); // task bar inset from the row top
  const barHeight = rowHeight - barTop * 2;
  const milestoneSize = Math.max(Math.round(rowHeight * 0.4), 12);
  // The diamond is a square rotated 45° around its center at the task date;
  // its horizontal tips sit half a diagonal out from that center.
  const milestoneHalfTip = (milestoneSize * Math.SQRT2) / 2;
  // Summary bars share the task bars' exact geometry, so link anchors are
  // uniform across row kinds.
  const summaryBarHeight = barHeight;
  const summaryBarTop = barTop;
  // Baseline (planned) reference strip — a thin bar hugging the row bottom,
  // beneath the live bar, so planned-vs-actual drift reads at a glance.
  const baselineHeight = Math.max(3, Math.round(rowHeight * 0.13));
  const baselineTop = rowHeight - baselineHeight - 1;
  const BASELINE_FILL = 'rgba(100, 116, 139, 0.35)';
  const BASELINE_BORDER = 'rgba(100, 116, 139, 0.6)';

  // Orthogonal elbow path from the predecessor anchor to the dependent
  // anchor. Anchors per link type: fs = source end → target start,
  // ss = start → start, ff = end → end, sf = start → end.
  const linkPath = (link: ResolvedLink): string | null => {
    const source = rows[link.sourceIndex];
    const target = rows[link.targetIndex];
    if (!source || !target) return null;
    const s = getLiveRowStyle(source);
    const tg = getLiveRowStyle(target);
    // Vertical anchor: every row kind (bar, diamond, summary bar) is centered
    // in its row; summary uses its own top/height so rounding stays exact.
    const rowAnchorY = (row: GanttRow) =>
      row.isSummary ? summaryBarTop + summaryBarHeight / 2 : rowHeight / 2;
    const sy = link.sourceIndex * rowHeight + rowAnchorY(source);
    const ty = link.targetIndex * rowHeight + rowAnchorY(target);
    const exitRight = link.type === 'fs' || link.type === 'ff';
    const enterRight = link.type === 'ff' || link.type === 'sf';
    // Milestones anchor at the diamond's visual tip (left/right corner of
    // the rotated square), not its center — the SVG draws above the bars,
    // so a center anchor would run the line through the diamond.
    const sx = source.isMilestone
      ? s.left + (exitRight ? milestoneHalfTip : -milestoneHalfTip)
      : exitRight ? s.left + s.width : s.left;
    const tx = target.isMilestone
      ? tg.left + (enterRight ? milestoneHalfTip : -milestoneHalfTip)
      : enterRight ? tg.left + tg.width : tg.left;
    const stub = 10; // horizontal clearance before turning
    const ex = sx + (exitRight ? stub : -stub);
    const ax = tx + (enterRight ? stub : -stub);
    const r = Math.round;
    const parts = [`M ${r(sx)} ${r(sy)}`, `L ${r(ex)} ${r(sy)}`];
    // Direct route: drop vertically at the exit stub, then run into the
    // target anchor. Only valid when the final horizontal segment travels
    // toward the arrow (otherwise the arrowhead would point away from the bar).
    const direct = enterRight ? ex >= ax : ex <= ax;
    if (direct) {
      parts.push(`L ${r(ex)} ${r(ty)}`, `L ${r(tx)} ${r(ty)}`);
    } else {
      // Backward link — detour along the source row's edge facing the target.
      const gapY = ty >= sy ? (link.sourceIndex + 1) * rowHeight : link.sourceIndex * rowHeight;
      parts.push(
        `L ${r(ex)} ${r(gapY)}`,
        `L ${r(ax)} ${r(gapY)}`,
        `L ${r(ax)} ${r(ty)}`,
        `L ${r(tx)} ${r(ty)}`,
      );
    }
    return parts.join(' ');
  };

  // Links attached to the dragged/hovered task get the highlight treatment.
  const activeLinkTaskId = dragState?.taskId ?? hoveredTaskId;

  // --- Critical path (Phase 6) ------------------------------------------
  // Toolbar toggle; when on, the zero-slack chain is highlighted on the bars
  // and the links joining them. Pure display — never mutates data.
  const [criticalOn, setCriticalOn] = React.useState(criticalPathDefault);
  const critical = React.useMemo(
    () => (criticalOn ? computeCriticalPath(tasks, workingCalendar) : null),
    [criticalOn, tasks, workingCalendar],
  );
  const isCriticalTask = React.useCallback(
    (id: string | number) => critical?.criticalIds.has(String(id)) ?? false,
    [critical],
  );
  const CRIT_COLOR = '#dc2626';

  // --- Auto-schedule (Phase 6) ------------------------------------------
  // One-shot dependency-driven reschedule (顺延): push successors later until
  // their link constraints hold, preserving durations, then persist each
  // changed task through onTaskUpdate (as one undoable batch).
  const runAutoSchedule = React.useCallback(() => {
    if (!onTaskUpdate) return;
    const changes = computeProjectReschedule(tasks, workingCalendar);
    const updates: Array<{ task: GanttTask; changes: Partial<Pick<GanttTask, 'start' | 'end'>> }> = [];
    for (const c of changes) {
      const task = tasks.find((tk) => String(tk.id) === c.id);
      if (task) updates.push({ task, changes: { start: c.start, end: c.end } });
    }
    commitTaskUpdates(updates);
  }, [tasks, onTaskUpdate, workingCalendar, commitTaskUpdates]);

  // --- Export PNG (Phase 6) ---------------------------------------------
  // Self-contained: re-draw the WHOLE chart (every row, unaffected by row
  // virtualization) into a standalone SVG from the geometry we already
  // compute, then rasterize to PNG via a canvas. No third-party dependency,
  // and concrete colors (the prebuilt CSS vars don't resolve in a detached
  // SVG). Captures the left name column + the timeline bars, links and today
  // line; critical highlighting is included when the toggle is on.
  const exportPng = React.useCallback(() => {
    if (typeof document === 'undefined' || !tasks.length) return;
    const esc = (s: string) =>
      String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    // Two-row header like the live chart: a month/year group band over the
    // day/week/… unit labels.
    const groupH = 18;
    const unitH = 18;
    const headerH = groupH + unitH;
    const nameW = Math.max(taskListWidth, 200);
    const W = Math.ceil(nameW + totalWidth);
    const H = Math.ceil(headerH + rows.length * rowHeight);
    const critEdges = critical?.criticalEdges ?? null;

    const parts: string[] = [];
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
    parts.push(`<rect x="0" y="0" width="${W}" height="${headerH}" fill="#f8fafc"/>`);

    // Header — top row: month/year groups; bottom row: unit labels.
    parts.push(`<g transform="translate(${nameW},0)" font-family="sans-serif" font-size="10" fill="#475569">`);
    headerGroups.forEach((group) => {
      parts.push(`<line x1="${group.offset.toFixed(1)}" y1="0" x2="${group.offset.toFixed(1)}" y2="${headerH}" stroke="#e2e8f0"/>`);
      parts.push(`<text x="${(group.offset + group.width / 2).toFixed(1)}" y="${groupH - 6}" text-anchor="middle" font-weight="600">${esc(group.label)}</text>`);
    });
    timeColumns.forEach((col, i) => {
      const x = colOffsets[i];
      parts.push(`<line x1="${x.toFixed(1)}" y1="${groupH}" x2="${x.toFixed(1)}" y2="${H}" stroke="#eef2f7"/>`);
      parts.push(`<text x="${(x + col.width / 2).toFixed(1)}" y="${headerH - 6}" text-anchor="middle" fill="#1f2937">${esc(col.label)}</text>`);
    });
    parts.push(`</g>`);
    parts.push(`<line x1="0" y1="${groupH}" x2="${W}" y2="${groupH}" stroke="#e2e8f0"/>`);
    parts.push(`<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="#cbd5e1"/>`);
    parts.push(`<line x1="${nameW}" y1="0" x2="${nameW}" y2="${H}" stroke="#cbd5e1"/>`);

    // Left name column.
    parts.push(`<g transform="translate(0,${headerH})" font-family="sans-serif" font-size="11" fill="#1f2937">`);
    rows.forEach((row, i) => {
      const y = i * rowHeight;
      parts.push(`<line x1="0" y1="${(y + rowHeight).toFixed(1)}" x2="${nameW}" y2="${(y + rowHeight).toFixed(1)}" stroke="#f1f5f9"/>`);
      const tx = 8 + row.depth * 14;
      const max = Math.max(4, Math.floor((nameW - tx) / 6.5));
      const title = row.task.title.length > max ? row.task.title.slice(0, max - 1) + '…' : row.task.title;
      const weight = row.isSummary ? ' font-weight="600"' : '';
      parts.push(`<text x="${tx}" y="${(y + rowHeight / 2 + 4).toFixed(1)}"${weight}>${esc(title)}</text>`);
    });
    parts.push(`</g>`);

    // Timeline: bars / milestones / links / today line.
    parts.push(`<g transform="translate(${nameW},${headerH})" font-family="sans-serif" font-size="9">`);
    rows.forEach((row, i) => {
      const y = i * rowHeight;
      const { left, width } = styleFor(row.start, row.end);
      const crit = isCriticalTask(row.task.id);
      const stroke = crit ? ` stroke="${CRIT_COLOR}" stroke-width="2"` : '';
      // Planned-vs-actual baseline strip (under the live bar, row bottom).
      if (showBaselines && row.task.baselineStart && row.task.baselineEnd) {
        const bl = styleFor(row.task.baselineStart, row.task.baselineEnd);
        parts.push(`<rect x="${bl.left.toFixed(1)}" y="${(y + baselineTop).toFixed(1)}" width="${Math.max(2, bl.width).toFixed(1)}" height="${baselineHeight}" rx="1" fill="${BASELINE_FILL}" stroke="${BASELINE_BORDER}"/>`);
      }
      if (row.isMilestone) {
        const cx = left;
        const cy = y + rowHeight / 2;
        const h = milestoneSize / 2;
        const fill = crit ? CRIT_COLOR : row.task.color || '#3b82f6';
        parts.push(`<polygon points="${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}" fill="${fill}"/>`);
      } else if (row.isSummary) {
        const fill = row.task.color || '#64748b';
        parts.push(`<rect x="${left.toFixed(1)}" y="${(y + summaryBarTop).toFixed(1)}" width="${width.toFixed(1)}" height="${summaryBarHeight}" rx="3" fill="${fill}"${stroke}/>`);
        const pw = (width * Math.min(100, Math.max(0, row.progress))) / 100;
        parts.push(`<rect x="${left.toFixed(1)}" y="${(y + summaryBarTop).toFixed(1)}" width="${pw.toFixed(1)}" height="${summaryBarHeight}" rx="3" fill="rgba(0,0,0,0.2)"/>`);
      } else {
        const fill = row.task.color || '#3b82f6';
        parts.push(`<rect x="${left.toFixed(1)}" y="${(y + barTop).toFixed(1)}" width="${width.toFixed(1)}" height="${barHeight}" rx="3" fill="${fill}"${stroke}/>`);
        const pw = (width * Math.min(100, Math.max(0, row.progress))) / 100;
        parts.push(`<rect x="${left.toFixed(1)}" y="${(y + barTop).toFixed(1)}" width="${pw.toFixed(1)}" height="${barHeight}" rx="3" fill="rgba(0,0,0,0.18)"/>`);
        if (width >= 24) {
          parts.push(`<text x="${(left + width / 2).toFixed(1)}" y="${(y + rowHeight / 2 + 3).toFixed(1)}" text-anchor="middle" fill="#ffffff">${Math.round(row.progress)}%</text>`);
        }
      }
    });
    links.forEach((link) => {
      const d = linkPath(link);
      if (!d) return;
      const critEdge = critEdges?.has(`${String(link.sourceId)}->${String(link.targetId)}`) ?? false;
      const color = critEdge ? CRIT_COLOR : '#94a3b8';
      parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${critEdge ? 2 : 1.5}"/>`);
    });
    if (todayLeftPx != null) {
      parts.push(`<line x1="${todayLeftPx.toFixed(1)}" y1="0" x2="${todayLeftPx.toFixed(1)}" y2="${rows.length * rowHeight}" stroke="#ef4444" stroke-width="1.5"/>`);
    }
    // Custom vertical markers (sprint boundaries, deadlines…), with labels.
    // CSS vars don't resolve in a detached SVG, so the themed default
    // (hsl(var(--primary))) falls back to a concrete indigo.
    const markerH = rows.length * rowHeight;
    resolvedMarkers.forEach((m) => {
      const color = /var\(/.test(m.color) ? '#6366f1' : m.color;
      parts.push(`<line x1="${m.left.toFixed(1)}" y1="0" x2="${m.left.toFixed(1)}" y2="${markerH}" stroke="${esc(color)}" stroke-width="1.5"/>`);
      if (m.label) {
        const lw = m.label.length * 6 + 8;
        parts.push(`<rect x="${(m.left - lw / 2).toFixed(1)}" y="0" width="${lw}" height="14" rx="2" fill="${esc(color)}"/>`);
        parts.push(`<text x="${m.left.toFixed(1)}" y="10" text-anchor="middle" font-size="9" font-weight="600" fill="#ffffff">${esc(m.label)}</text>`);
      }
    });
    parts.push(`</g>`);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = `gantt-${viewMode}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [tasks, rows, links, linkPath, styleFor, isCriticalTask, critical, timeColumns, colOffsets, totalWidth, taskListWidth, rowHeight, barTop, barHeight, summaryBarTop, summaryBarHeight, milestoneSize, todayLeftPx, viewMode, showBaselines, baselineTop, baselineHeight, BASELINE_FILL, BASELINE_BORDER, resolvedMarkers, headerGroups]);

  return (
    <div ref={containerRef} className={cn("flex flex-col h-full bg-background overflow-hidden min-w-0", className)}>
      {/* Hover and responsive rules the prebuilt components CSS can't provide
          (alpha utilities like hover:bg-white/40 and several sm: variants are
          never emitted there). */}
      <style>{`
        .gantt-resize-handle:hover { background-color: rgba(255, 255, 255, 0.4); }
        .gantt-bar-hover:hover { filter: brightness(1.1); }
        @media (min-width: 640px) {
          .gantt-sm-h50 { height: 50px; }
          .gantt-sm-w20 { width: 80px; }
          .gantt-sm-hidden { display: none; }
        }
      `}</style>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border-b bg-card">
        <div className="flex items-center gap-2">
          {/* "New Task" intentionally removed — the page-level header
              already exposes a fully-fielded create form for this
              object, and the toolbar's quick-create only set 3 fields
              which was confusing for required-field-heavy schemas. */}
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('gantt.toolbar.prevPeriod')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('gantt.toolbar.nextPeriod')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-xs sm:text-sm">
            {timelineRange.start.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Granularity segmented control */}
          <div className="flex bg-muted rounded-md p-1" role="group" aria-label={t('gantt.toolbar.viewMode')}>
            {VIEW_MODES.map((mode) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-1.5 sm:px-2 text-xs",
                  viewMode === mode && "bg-background shadow-sm hover:bg-background"
                )}
                onClick={() => changeViewMode(mode)}
                aria-pressed={viewMode === mode}
                data-testid={`gantt-view-mode-${mode}`}
              >
                {t(`gantt.viewMode.${mode}`)}
              </Button>
            ))}
          </div>
          {/* Zoom: adjusts column width; at the bounds it falls through to the
              next coarser/finer granularity so zooming never dead-ends. */}
          <div className="flex bg-muted rounded-md p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                if (columnWidth > 15) {
                  setColumnWidthOverride(Math.max(15, columnWidth - 10));
                } else {
                  const i = VIEW_MODES.indexOf(viewMode);
                  if (i < VIEW_MODES.length - 1) {
                    changeViewMode(VIEW_MODES[i + 1]);
                    setColumnWidthOverride(baseColumnWidth);
                  }
                }
              }}
              aria-label={t('gantt.toolbar.zoomOut')}
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                if (columnWidth < 120) {
                  setColumnWidthOverride(Math.min(120, columnWidth + 10));
                } else {
                  const i = VIEW_MODES.indexOf(viewMode);
                  if (i > 0) {
                    changeViewMode(VIEW_MODES[i - 1]);
                    setColumnWidthOverride(baseColumnWidth);
                  }
                }
              }}
              aria-label={t('gantt.toolbar.zoomIn')}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTaskListCollapsed((v) => !v)}
            aria-label={taskListCollapsed ? t('gantt.toolbar.showTaskList') : t('gantt.toolbar.hideTaskList')}
            aria-pressed={taskListCollapsed}
            data-testid="gantt-toggle-task-list"
          >
            {taskListCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={jumpToToday}
            disabled={todayLeftPx == null}
            aria-label={t('gantt.toolbar.jumpToToday')}
            data-testid="gantt-jump-today"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          {onTaskUpdate ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={undo}
                disabled={!canUndo}
                aria-label={t('gantt.toolbar.undo')}
                data-testid="gantt-undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={redo}
                disabled={!canRedo}
                aria-label={t('gantt.toolbar.redo')}
                data-testid="gantt-redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCriticalOn((v) => !v)}
            aria-label={t('gantt.toolbar.criticalPath')}
            aria-pressed={criticalOn}
            data-testid="gantt-critical-path"
            style={criticalOn ? { color: CRIT_COLOR } : undefined}
          >
            <Activity className="h-4 w-4" />
          </Button>
          {autoSchedule && onTaskUpdate ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={runAutoSchedule}
              aria-label={t('gantt.toolbar.autoSchedule')}
              data-testid="gantt-auto-schedule"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={exportPng}
            aria-label={t('gantt.toolbar.exportPng')}
            data-testid="gantt-export-png"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t('gantt.toolbar.exitFullscreen') : t('gantt.toolbar.enterFullscreen')}
            aria-pressed={isFullscreen}
            data-testid="gantt-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Gantt Body — focusable for keyboard row navigation */}
      <div
        className="flex flex-col flex-1 overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-ring"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        data-testid="gantt-body"
      >
        {/* Headers Row */}
        <div className="flex border-b bg-muted/30 shrink-0 h-10 gantt-sm-h50">
          {/* List Header */}
          <div 
            className="flex items-center font-medium text-xs text-muted-foreground px-2 sm:px-4 border-r bg-card z-20 shadow-sm"
            style={{ width: taskListWidth, minWidth: taskListWidth }}
          >
            <div className="flex-1 truncate">{t('gantt.column.taskName')}</div>
            {showSEColumns && (
              <>
                <div className="w-16 gantt-sm-w20 text-right">{t('gantt.column.start')}</div>
                <div className="w-16 gantt-sm-w20 text-right">{t('gantt.column.end')}</div>
              </>
            )}
          </div>
          
          {/* Timeline Header — two scale rows: group (month/year) over units */}
          <div className="flex-1 overflow-hidden" ref={headerRef}>
            <div className="flex flex-col h-full" style={{ width: totalWidth }}>
              <div className="relative border-b" style={{ height: '45%' }} data-testid="gantt-header-groups">
                {headerGroups.slice(groupWindow.start, groupWindow.end).map((group) => (
                  <div
                    key={group.key}
                    className="absolute top-0 bottom-0 flex items-center justify-center border-r text-[10px] font-medium text-muted-foreground overflow-hidden"
                    style={{ left: group.offset, width: group.width }}
                  >
                    <span className="truncate px-1">{group.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative flex-1" data-testid="gantt-header-units">
                {timeColumns.slice(colWindow.start, colWindow.end).map((col, i) => {
                  const idx = colWindow.start + i;
                  return (
                  <div
                    key={idx}
                    className={cn(
                      "absolute top-0 bottom-0 flex items-center justify-center gap-1 border-r text-xs text-muted-foreground overflow-hidden",
                      col.isWeekend && "bg-muted/50"
                    )}
                    style={{ left: colOffsets[idx], width: col.width }}
                  >
                    <span className="font-medium text-foreground truncate">{col.label}</span>
                    {col.sublabel && columnWidth >= 32 && (
                      <span className="text-[10px] opacity-70">{col.sublabel}</span>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Content Row */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Side: Task List (Grid) */}
          <div
            className="overflow-hidden border-r bg-card z-10 shadow-sm"
            ref={listRef}
            style={{ width: taskListWidth, minWidth: taskListWidth }}
            role="tree"
            aria-label={t('gantt.aria.taskList')}
          >
            {rowWindow.startIdx > 0 && (
              <div style={{ height: rowWindow.startIdx * rowHeight }} aria-hidden="true" />
            )}
            {rows.slice(rowWindow.startIdx, rowWindow.endIdx).map((row) => {
              const task = row.task;
              const isEditing = inlineEdit && editingTask === task.id;
              const isCollapsed = collapsedIds.has(String(task.id));
              const isSelected = selectedTaskId != null && String(selectedTaskId) === String(task.id);
              return (
              <div
                key={task.id}
                className={cn(
                  "group/task-row flex items-center border-b px-2 sm:px-4 hover:bg-accent/50 cursor-pointer transition-colors",
                  isSelected && "bg-accent/50"
                )}
                style={{ height: rowHeight, touchAction: 'manipulation' }}
                role="treeitem"
                aria-level={row.depth + 1}
                aria-selected={isSelected}
                aria-expanded={row.hasChildren ? !isCollapsed : undefined}
                draggable={!!onTaskReorder && !isEditing}
                onDragStart={onTaskReorder ? (e) => {
                  e.dataTransfer.setData('text/plain', String(task.id));
                  e.dataTransfer.effectAllowed = 'move';
                } : undefined}
                onDragOver={onTaskReorder ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                } : undefined}
                onDrop={onTaskReorder ? (e) => {
                  e.preventDefault();
                  const srcId = e.dataTransfer.getData('text/plain');
                  if (!srcId || srcId === String(task.id)) return;
                  const src = taskById.get(srcId);
                  // Reorder is sibling-scoped: dropping on a row with a
                  // different parent is ignored rather than re-parenting. In
                  // grouped mode both `src` and `task` carry the synthetic group
                  // parent, so same-group drops still match.
                  if (src && String(src.parent ?? '') === String(task.parent ?? '')) {
                    onTaskReorder(src, task);
                  }
                } : undefined}
                onContextMenu={(e) => openContextMenu(task, e)}
                onClick={() => {
                  setSelectedTaskId(task.id);
                  if (!isEditing) onTaskClick?.(task);
                }}
                onDoubleClick={() => {
                  if (inlineEdit && onTaskUpdate && !row.isSummary) {
                    setEditingTask(task.id);
                    setEditValues({
                      title: task.title,
                      start: task.start.toLocaleDateString('en-CA'),
                      end: task.end.toLocaleDateString('en-CA'),
                      progress: String(task.progress),
                    });
                  }
                }}
              >
                <div
                  className="flex-1 truncate font-medium text-xs sm:text-sm flex items-center gap-2"
                  style={row.depth > 0 ? { paddingLeft: row.depth * 14 } : undefined}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      className="h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      style={{ marginLeft: -4 }}
                      onClick={(e) => { e.stopPropagation(); toggleCollapsed(task.id); }}
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? t('gantt.row.expand') : t('gantt.row.collapse')}
                      data-testid={`gantt-row-toggle-${task.id}`}
                    >
                      {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="w-3 shrink-0" style={{ marginLeft: -4 }} aria-hidden="true" />
                  )}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: task.color || '#3b82f6' }}
                  />
                  {isEditing ? (
                    <input
                      className="border rounded px-1 py-0.5 text-xs w-full bg-background"
                      value={editValues.title || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitTaskUpdates([{
                            task,
                            changes: {
                              title: editValues.title,
                              start: new Date(editValues.start),
                              end: new Date(editValues.end),
                              progress: Number(editValues.progress) || 0,
                            },
                          }]);
                          setEditingTask(null);
                        } else if (e.key === 'Escape') {
                          setEditingTask(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="flex flex-col min-w-0">
                      <span className={cn("truncate", row.isSummary && "font-semibold")}>{task.title}</span>
                      <span className="text-[10px] text-muted-foreground gantt-sm-hidden">
                        {row.start.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })} → {row.end.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })}
                      </span>
                    </span>
                  )}
                </div>
                <div className="w-16 gantt-sm-w20 text-right text-xs text-muted-foreground hidden sm:block" hidden={!showSEColumns} style={!showSEColumns ? { display: 'none' } : undefined}>
                  {isEditing ? (
                    <input
                      type="date"
                      className="border rounded px-1 py-0.5 text-xs w-full bg-background"
                      value={editValues.start || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, start: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    row.start.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })
                  )}
                </div>
                <div className="w-16 gantt-sm-w20 text-right text-xs text-muted-foreground hidden sm:block" hidden={!showSEColumns} style={!showSEColumns ? { display: 'none' } : undefined}>
                  {isEditing ? (
                    <input
                      type="date"
                      className="border rounded px-1 py-0.5 text-xs w-full bg-background"
                      value={editValues.end || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, end: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    row.end.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })
                  )}
                </div>
                {/* Row actions removed: View / Edit / Delete are reachable
                    from the side drawer that opens on row click (DetailView
                    has inline-edit + a delete in its more-actions menu).
                    Inline edit is also still triggerable via row double-click. */}
              </div>
              );
            })}
            {rowWindow.endIdx < rows.length && (
              <div style={{ height: (rows.length - rowWindow.endIdx) * rowHeight }} aria-hidden="true" />
            )}
          </div>

          {/* Right Side: Timeline */}
          <div
            className="flex-1 overflow-auto bg-background/50 relative [-webkit-overflow-scrolling:touch]"
            ref={(el) => { (timelineRef as any).current = el; (scrollAreaRef as any).current = el; }}
            onScroll={handleScroll}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            data-testid="gantt-timeline"
          >
            <div className="relative" style={{ width: totalWidth }}>
              {/* Today vertical marker — sticky inside the scroll area, in front of grid + bars */}
              {todayLeftPx != null && (
                <div
                  className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
                  /* Explicit colors: the prebuilt components CSS doesn't emit
                     bg-red-500 / opacity-modified utilities. */
                  style={{ left: todayLeftPx, backgroundColor: 'rgba(239, 68, 68, 0.8)' }}
                  data-testid="gantt-today-marker"
                  aria-label={t('gantt.toolbar.today')}
                >
                  <div
                    className="absolute -translate-x-1/2 left-0 text-[10px] font-semibold text-white rounded-sm px-1 py-0.5 whitespace-nowrap z-30"
                    style={{ top: 2, backgroundColor: '#ef4444' }}
                  >
                    {t('gantt.toolbar.today')}
                  </div>
                </div>
              )}
              {/* Custom vertical markers (deadlines, sprint boundaries…) */}
              {resolvedMarkers.map((m) => (
                <div
                  key={m.index}
                  className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
                  style={{ left: m.left, backgroundColor: m.color }}
                  data-testid={`gantt-marker-${m.index}`}
                  aria-label={m.label}
                >
                  {m.label && (
                    <div
                      className="absolute -translate-x-1/2 left-0 text-[10px] font-semibold text-white rounded-sm px-1 py-0.5 whitespace-nowrap z-30"
                      style={{ top: 2, backgroundColor: m.color }}
                    >
                      {m.label}
                    </div>
                  )}
                </div>
              ))}
              {/* Timeline Task Rows */}
              <div className="relative" ref={contentRef}>
                {/* Background Grid — windowed to the visible columns */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                   {timeColumns.slice(colWindow.start, colWindow.end).map((col, i) => {
                    const idx = colWindow.start + i;
                    return (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 border-r"
                      style={{
                        left: colOffsets[idx],
                        width: col.width,
                        backgroundColor: col.isWeekend ? 'hsl(var(--muted) / 0.4)' : undefined,
                      }}
                    />
                    );
                  })}
                </div>

                {/* Task Bars — windowed to the visible rows */}
                {rowWindow.startIdx > 0 && (
                  <div style={{ height: rowWindow.startIdx * rowHeight }} aria-hidden="true" />
                )}
                {rows.slice(rowWindow.startIdx, rowWindow.endIdx).map((row) => {
                   const task = row.task;
                   const isCrit = isCriticalTask(task.id);
                   const baseStyle = styleFor(row.start, row.end);
                   // Baseline (planned) reference strip beneath the live bar.
                   const baseline = showBaselines && task.baselineStart && task.baselineEnd
                     ? styleFor(task.baselineStart, task.baselineEnd)
                     : null;
                   const baselineEl = baseline ? (
                     <div
                       className="absolute pointer-events-none rounded-[1px]"
                       style={{
                         left: baseline.left,
                         width: Math.max(2, baseline.width),
                         top: baselineTop,
                         height: baselineHeight,
                         backgroundColor: BASELINE_FILL,
                         border: `1px solid ${BASELINE_BORDER}`,
                       }}
                       data-testid={`gantt-baseline-${task.id}`}
                       aria-hidden="true"
                     />
                   ) : null;
                   const isDragging = dragState?.taskId === task.id;
                   const inDragGroup = dragGroupIds?.has(String(task.id)) ?? false;
                   const inDragStretch = dragStretchAncestorIds?.has(String(task.id)) ?? false;
                   const liveStyle = isDragging || inDragGroup || inDragStretch ? getLiveRowStyle(row) : baseStyle;
                   const canDrag = !!onTaskUpdate && !row.isSummary;
                   const isLinkTarget =
                     linkDrag != null &&
                     linkDrag.targetId != null &&
                     String(linkDrag.targetId) === String(task.id) &&
                     String(linkDrag.sourceId) !== String(task.id);
                   // While a connector drag is live, bars report themselves as
                   // the drop target on pointermove; the row clears it when the
                   // pointer is over empty row space (target === currentTarget).
                   const captureLinkTarget = linkDrag ? () => {
                     setLinkDrag((prev) =>
                       prev && String(prev.sourceId) !== String(task.id)
                         ? { ...prev, targetId: task.id }
                         : prev
                     );
                   } : undefined;
                   const clearLinkTarget = linkDrag ? (e: React.PointerEvent) => {
                     if (e.target === e.currentTarget) {
                       setLinkDrag((prev) => (prev ? { ...prev, targetId: null } : prev));
                     }
                   } : undefined;
                   const durationDays = Math.max(1, Math.round(
                     (row.end.getTime() - row.start.getTime()) / MS_PER_DAY
                   ));
                   const tooltip = hoveredTaskId === task.id && !dragState && !progressDrag && !linkDrag ? (
                     <div
                       className="absolute z-30 pointer-events-none rounded-md border bg-popover text-popover-foreground px-2.5 py-1.5 text-xs shadow-md whitespace-nowrap"
                       style={{ left: Math.max(liveStyle.left + 8, 4), top: rowHeight - 8 }}
                       role="tooltip"
                       data-testid={`gantt-tooltip-${task.id}`}
                     >
                       <div className="font-semibold">{task.title}</div>
                       {task.fields && task.fields.length > 0 ? (
                         <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 2, marginTop: 4 }}>
                           {task.fields.map((f, i) => (
                             <React.Fragment key={i}>
                               <span className="text-muted-foreground">{f.label}</span>
                               <span style={{ fontWeight: 500 }}>{f.value}</span>
                             </React.Fragment>
                           ))}
                         </div>
                       ) : (
                         <div className="text-muted-foreground">
                           {row.start.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                           {' → '}
                           {row.end.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                           {' · '}{durationDays}{t('gantt.tooltip.days')}
                           {' · '}{Math.round(row.progress)}%
                         </div>
                       )}
                     </div>
                   ) : null;

                   if (row.isSummary) {
                     // Summary bar: a solid row-centered bar (slightly slimmer
                     // than task bars) with the title and a darker progress
                     // fill, like svar/MS-Project group bars. Children drive
                     // its range; dragging it moves the whole subtree.
                     const summaryColor = task.color || '#0d9488';
                     return (
                      <div
                        key={task.id}
                        className="relative border-b hover:bg-accent/50"
                        style={{ height: rowHeight }}
                        onPointerMove={clearLinkTarget}
                      >
                        {baselineEl}
                        <div
                          className={cn(
                            'gantt-bar-hover absolute rounded-sm border shadow-sm flex items-center px-2 select-none',
                            onTaskUpdate ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            isDragging && 'ring-2 ring-primary z-10'
                          )}
                          /* Explicit colors: alpha utilities aren't emitted in
                             the prebuilt components CSS. */
                          style={{
                            left: liveStyle.left,
                            width: liveStyle.width,
                            top: summaryBarTop,
                            height: summaryBarHeight,
                            backgroundColor: summaryColor,
                            borderColor: isCrit ? CRIT_COLOR : 'hsl(var(--primary-foreground) / 0.2)',
                            boxShadow: isCrit ? `0 0 0 2px ${CRIT_COLOR}` : undefined,
                          }}
                          data-critical={isCrit ? 'true' : undefined}
                          data-testid={`gantt-summary-bar-${task.id}`}
                          data-progress={Math.round(row.progress)}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId((cur) => (cur === task.id ? null : cur))}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            // Group move: the summary bar drags the whole subtree.
                            beginDrag(task, 'move', e, { group: true, originStart: row.start, originEnd: row.end });
                          }}
                          onClick={() => {
                            if (suppressNextClickRef.current) return;
                            onTaskClick?.(task);
                          }}
                          onContextMenu={(e) => openContextMenu(task, e)}
                        >
                          {/* Rollup progress fill */}
                          <div
                            className="absolute left-0 top-0 bottom-0 pointer-events-none"
                            style={{ width: `${Math.round(row.progress)}%`, backgroundColor: 'rgba(0, 0, 0, 0.2)', borderTopLeftRadius: 'var(--radius-sm)', borderBottomLeftRadius: 'var(--radius-sm)' }}
                          />
                          <span className="relative text-[10px] text-white font-medium truncate pointer-events-none">
                            {task.title}
                          </span>
                        </div>
                        {isDragging && dragState && (
                          <div
                            className="absolute z-30 pointer-events-none rounded border bg-popover text-popover-foreground px-1.5 py-0.5 text-[10px] shadow whitespace-nowrap"
                            style={{ left: Math.max(liveStyle.left, 4), top: summaryBarTop + summaryBarHeight + 2 }}
                            data-testid={`gantt-summary-drag-chip-${task.id}`}
                          >
                            {computeDragChanges(dragState).start.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })}
                            {' → '}
                            {computeDragChanges(dragState).end.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })}
                          </div>
                        )}
                        {tooltip}
                      </div>
                     );
                   }

                   if (row.isMilestone) {
                     const size = milestoneSize;
                     return (
                      <div
                        key={task.id}
                        className="relative border-b hover:bg-accent/50"
                        style={{ height: rowHeight }}
                        onPointerMove={clearLinkTarget}
                      >
                        {baselineEl}
                        <div
                          className={cn(
                            "gantt-bar-hover absolute rotate-45 rounded-[2px] border shadow-sm select-none",
                            canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            isDragging && "ring-2 ring-primary z-10",
                            isLinkTarget && "ring-2 ring-primary"
                          )}
                          style={{
                            left: liveStyle.left - size / 2,
                            top: (rowHeight - size) / 2,
                            width: size,
                            height: size,
                            backgroundColor: isCrit ? CRIT_COLOR : task.color || '#3b82f6',
                            borderColor: isCrit ? CRIT_COLOR : 'hsl(var(--primary-foreground) / 0.2)',
                            boxShadow: isCrit ? `0 0 0 2px ${CRIT_COLOR}` : undefined,
                          }}
                          data-critical={isCrit ? 'true' : undefined}
                          data-testid={`gantt-milestone-${task.id}`}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId((cur) => (cur === task.id ? null : cur))}
                          onClick={() => {
                            if (suppressNextClickRef.current) return;
                            onTaskClick?.(task);
                          }}
                          onContextMenu={(e) => openContextMenu(task, e)}
                          onPointerMove={captureLinkTarget}
                          onPointerDown={canDrag ? (e) => {
                            if (e.button !== 0) return;
                            beginDrag(task, 'move', e);
                          } : undefined}
                        />
                        {tooltip}
                      </div>
                     );
                   }

                   const liveProgress = progressDrag && progressDrag.taskId === task.id
                     ? progressDrag.value
                     : task.progress;

                   return (
                    <div
                      key={task.id}
                      className="relative border-b hover:bg-accent/50"
                      style={{ height: rowHeight }}
                      onPointerMove={clearLinkTarget}
                    >
                      {/* Ghost: original position rendered faded while dragging */}
                      {isDragging && (
                        <div
                          className="absolute rounded-sm border border-dashed pointer-events-none"
                          /* Explicit top/height/border color: calc-based and
                             alpha utilities aren't emitted in the prebuilt
                             components CSS, and link anchors assume a
                             row-centered bar. */
                          style={{ left: baseStyle.left, width: baseStyle.width, top: barTop, height: barHeight, opacity: 0.35, borderColor: 'hsl(var(--primary) / 0.6)' }}
                          aria-hidden="true"
                        />
                      )}
                      {baselineEl}
                      <div
                        className={cn(
                          "gantt-bar-hover absolute rounded-sm bg-primary border shadow-sm flex items-center px-2 group select-none",
                          canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                          isDragging && "ring-2 ring-primary z-10",
                          isLinkTarget && "ring-2 ring-primary"
                        )}
                        style={{
                          left: liveStyle.left,
                          width: liveStyle.width,
                          top: barTop,
                          height: barHeight,
                          backgroundColor: task.color || '#3b82f6',
                          borderColor: isCrit ? CRIT_COLOR : 'hsl(var(--primary-foreground) / 0.2)',
                          boxShadow: isCrit ? `0 0 0 2px ${CRIT_COLOR}` : undefined,
                        }}
                        data-critical={isCrit ? 'true' : undefined}
                        data-testid={`gantt-task-bar-${task.id}`}
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() => setHoveredTaskId((cur) => (cur === task.id ? null : cur))}
                        onClick={() => {
                          if (suppressNextClickRef.current) return;
                          onTaskClick?.(task);
                        }}
                        onContextMenu={(e) => openContextMenu(task, e)}
                        onPointerMove={captureLinkTarget}
                        onPointerDown={canDrag ? (e) => {
                          // Body of bar = move; resize handles get their own onPointerDown
                          // and stopPropagation so they win.
                          if (e.button !== 0) return;
                          beginDrag(task, 'move', e);
                        } : undefined}
                      >
                        {/* Resize handles — only when bar is wide enough to host them */}
                        {canDrag && liveStyle.width >= 14 && (
                          <>
                            <div
                              className="gantt-resize-handle absolute left-0 top-0 bottom-0"
                              style={{ width: 6, cursor: 'ew-resize' }}
                              data-testid={`gantt-task-resize-left-${task.id}`}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                beginDrag(task, 'resize-left', e);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div
                              className="gantt-resize-handle absolute right-0 top-0 bottom-0"
                              style={{ width: 6, cursor: 'ew-resize' }}
                              data-testid={`gantt-task-resize-right-${task.id}`}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                beginDrag(task, 'resize-right', e);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        )}

                        {/* Progress fill — follows the handle live while dragging.
                            Explicit color: bg-black/20 isn't emitted in the
                            prebuilt components CSS. */}
                        {liveProgress > 0 && (
                          <div
                            className="absolute left-0 top-0 bottom-0 pointer-events-none"
                            style={{ width: `${liveProgress}%`, backgroundColor: 'rgba(0, 0, 0, 0.2)', borderTopLeftRadius: 'var(--radius-sm)', borderBottomLeftRadius: 'var(--radius-sm)' }}
                          />
                        )}

                        {/* Progress drag handle — grip at the progress boundary */}
                        {canDrag && liveStyle.width >= 30 && (
                          <div
                            className={cn(
                              "absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-col-resize flex items-center justify-center",
                              progressDrag?.taskId === task.id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 transition-opacity"
                            )}
                            style={{ left: `${liveProgress}%` }}
                            data-testid={`gantt-progress-handle-${task.id}`}
                            onPointerDown={(e) => {
                              if (e.button !== 0) return;
                              e.stopPropagation();
                              e.preventDefault();
                              setProgressDrag({
                                taskId: task.id,
                                originClientX: e.clientX,
                                originProgress: task.progress,
                                barWidth: liveStyle.width,
                                value: task.progress,
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Explicit colors: bg-white / ring-black-30 aren't
                                emitted in the prebuilt components CSS. */}
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: '#fff', boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.25)' }}
                            />
                          </div>
                        )}

                        {/* Connector dot — drag onto another bar to create a dependency */}
                        {onDependencyCreate && (
                          <div
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-background z-10",
                              linkDrag && String(linkDrag.sourceId) === String(task.id)
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 transition-opacity"
                            )}
                            style={{ right: -8, cursor: 'crosshair', border: '2px solid hsl(var(--primary))' }}
                            data-testid={`gantt-link-dot-${task.id}`}
                            onPointerDown={(e) => {
                              if (e.button !== 0) return;
                              e.stopPropagation();
                              e.preventDefault();
                              const rect = contentRef.current?.getBoundingClientRect();
                              setLinkDrag({
                                sourceId: task.id,
                                x: rect ? e.clientX - rect.left : 0,
                                y: rect ? e.clientY - rect.top : 0,
                                targetId: null,
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}

                        {/* Hover Details / drag tooltip */}
                        <span className="text-[10px] text-white font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {isDragging
                            ? `${computeDragChanges(dragState!).start.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })} → ${computeDragChanges(dragState!).end.toLocaleDateString(dateLocale, { month: 'numeric', day: 'numeric' })}`
                            : `${Math.round(liveProgress)}%`}
                        </span>
                      </div>
                      {tooltip}
                    </div>
                   )
                })}
                {rowWindow.endIdx < rows.length && (
                  <div style={{ height: (rows.length - rowWindow.endIdx) * rowHeight }} aria-hidden="true" />
                )}

                {/* Dependency Links — SVG overlay above bars, below the Today
                    marker (z-20). pointer-events-none so bar drag/click win.
                    Paths use absolute row indices (windowing-independent);
                    links fully outside the row window are skipped. */}
                {(links.length > 0 || linkDrag) && (
                  <svg
                    className="absolute top-0 left-0 pointer-events-none z-10"
                    width={totalWidth}
                    height={totalRowsHeight}
                    data-testid="gantt-links"
                    aria-hidden="true"
                  >
                    {/* Colors via raw theme vars (not Tailwind stroke/fill
                        utilities): consuming apps load the prebuilt components
                        CSS, which never emits those utility classes. */}
                    <defs>
                      <marker
                        id="gantt-link-arrow"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 0 L 8 4 L 0 8 z" fill="hsl(var(--muted-foreground))" />
                      </marker>
                      <marker
                        id="gantt-link-arrow-active"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 0 L 8 4 L 0 8 z" fill="hsl(var(--primary))" />
                      </marker>
                      <marker
                        id="gantt-link-arrow-critical"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 0 L 8 4 L 0 8 z" fill={CRIT_COLOR} />
                      </marker>
                    </defs>
                    {links.map((link) => {
                      const lo = Math.min(link.sourceIndex, link.targetIndex);
                      const hi = Math.max(link.sourceIndex, link.targetIndex);
                      if (hi < rowWindow.startIdx - ROW_OVERSCAN || lo > rowWindow.endIdx + ROW_OVERSCAN) return null;
                      const d = linkPath(link);
                      if (!d) return null;
                      const active =
                        activeLinkTaskId != null &&
                        (String(link.sourceId) === String(activeLinkTaskId) ||
                          String(link.targetId) === String(activeLinkTaskId));
                      const critEdge =
                        critical?.criticalEdges.has(`${String(link.sourceId)}->${String(link.targetId)}`) ?? false;
                      const marker = critEdge
                        ? 'gantt-link-arrow-critical'
                        : active
                          ? 'gantt-link-arrow-active'
                          : 'gantt-link-arrow';
                      // When dependency editing is enabled, lay an invisible,
                      // wide hit-path over each link. pointer-events IS inherited
                      // in SVG, so `pointerEvents="stroke"` on the child overrides
                      // the parent svg's `pointer-events-none`, making just the
                      // link right-clickable without stealing bar drag/click.
                      const editable = !!(onDependencyDelete || onDependencyCreate);
                      return (
                        <React.Fragment key={link.key}>
                          <path
                            d={d}
                            fill="none"
                            stroke={critEdge ? CRIT_COLOR : active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                            strokeOpacity={critEdge || active ? 1 : 0.7}
                            strokeWidth={critEdge || active ? 2 : 1.5}
                            markerEnd={`url(#${marker})`}
                            data-testid={`gantt-link-${link.sourceId}-${link.targetId}`}
                            data-link-type={link.type}
                            data-active={active ? 'true' : 'false'}
                            data-critical={critEdge ? 'true' : undefined}
                          />
                          {editable && (
                            <path
                              d={d}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={10}
                              style={{ pointerEvents: 'stroke', cursor: 'context-menu' }}
                              data-testid={`gantt-link-hit-${link.sourceId}-${link.targetId}`}
                              onContextMenu={(e) => openLinkContextMenu(link.sourceId, link.targetId, link.type, e)}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                    {/* Draft rubber band while dragging a connector dot */}
                    {linkDrag && (() => {
                      const si = rows.findIndex((r) => String(r.task.id) === String(linkDrag.sourceId));
                      if (si < 0) return null;
                      const s = getLiveRowStyle(rows[si]);
                      const sx = rows[si].isMilestone ? s.left + milestoneHalfTip : s.left + s.width;
                      const sy = si * rowHeight + rowHeight / 2;
                      return (
                        <path
                          d={`M ${Math.round(sx)} ${Math.round(sy)} L ${Math.round(linkDrag.x)} ${Math.round(linkDrag.y)}`}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          data-testid="gantt-link-draft"
                        />
                      );
                    })()}
                  </svg>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context menu — fixed-position so it escapes the scroll clipping */}
      {ctxMenu && (() => {
        const task = tasks.find((tk) => String(tk.id) === String(ctxMenu.taskId));
        if (!task) return null;
        const row = rows.find((r) => String(r.task.id) === String(ctxMenu.taskId));
        const itemCls = "w-full text-left px-3 py-1.5 hover:bg-accent focus:bg-accent outline-none";
        return (
          <div
            ref={ctxMenuRef}
            className="fixed z-50 min-w-[160px] rounded-md border bg-popover text-popover-foreground shadow-md py-1 text-sm"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            role="menu"
            data-testid="gantt-context-menu"
          >
            {onTaskClick && (
              <button
                type="button"
                role="menuitem"
                className={itemCls}
                data-testid="gantt-context-menu-view"
                onClick={() => { setCtxMenu(null); onTaskClick(task); }}
              >
                {t('gantt.menu.view')}
              </button>
            )}
            {inlineEdit && onTaskUpdate && row && !row.isSummary && (
              <button
                type="button"
                role="menuitem"
                className={itemCls}
                data-testid="gantt-context-menu-edit"
                onClick={() => {
                  setCtxMenu(null);
                  setEditingTask(task.id);
                  setEditValues({
                    title: task.title,
                    start: task.start.toLocaleDateString('en-CA'),
                    end: task.end.toLocaleDateString('en-CA'),
                    progress: String(task.progress),
                  });
                }}
              >
                {t('gantt.menu.edit')}
              </button>
            )}
            {onDependencyCreate && row && !row.isMilestone && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={itemCls}
                  data-testid="gantt-context-menu-add-predecessor"
                  onClick={() => {
                    const at = ctxMenu;
                    setCtxMenu(null);
                    setDepPicker({ x: at.x, y: at.y, taskId: task.id, relation: 'pred' });
                  }}
                >
                  {t('gantt.menu.addPredecessor')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={itemCls}
                  data-testid="gantt-context-menu-add-successor"
                  onClick={() => {
                    const at = ctxMenu;
                    setCtxMenu(null);
                    setDepPicker({ x: at.x, y: at.y, taskId: task.id, relation: 'succ' });
                  }}
                >
                  {t('gantt.menu.addSuccessor')}
                </button>
              </>
            )}
            {onTaskDelete && (
              <button
                type="button"
                role="menuitem"
                className={cn(itemCls, "text-destructive")}
                data-testid="gantt-context-menu-delete"
                onClick={() => { setCtxMenu(null); onTaskDelete(task); }}
              >
                {t('gantt.menu.delete')}
              </button>
            )}
          </div>
        );
      })()}

      {/* Dependency link context menu (类型选择 + 移除) — fixed-position. */}
      {linkCtxMenu && (() => {
        const source = tasks.find((tk) => String(tk.id) === String(linkCtxMenu.sourceId));
        const target = tasks.find((tk) => String(tk.id) === String(linkCtxMenu.targetId));
        if (!source || !target) return null;
        const itemCls = "w-full text-left px-3 py-1.5 hover:bg-accent focus:bg-accent outline-none";
        const LINK_TYPES: GanttLinkType[] = ['fs', 'ss', 'ff', 'sf'];
        return (
          <div
            ref={linkCtxMenuRef}
            className="fixed z-50 min-w-[180px] rounded-md border bg-popover text-popover-foreground shadow-md py-1 text-sm"
            style={{ left: linkCtxMenu.x, top: linkCtxMenu.y }}
            role="menu"
            data-testid="gantt-link-context-menu"
          >
            <div className="px-3 py-1 text-xs text-muted-foreground truncate">
              {source.title} → {target.title}
            </div>
            {onDependencyCreate && LINK_TYPES.map((lt) => (
              <button
                key={lt}
                type="button"
                role="menuitemradio"
                aria-checked={linkCtxMenu.type === lt}
                className={cn(itemCls, linkCtxMenu.type === lt && "font-semibold")}
                data-testid={`gantt-link-menu-type-${lt}`}
                onClick={() => {
                  setLinkCtxMenu(null);
                  if (lt !== linkCtxMenu.type) onDependencyCreate(source, target, lt);
                }}
              >
                {linkCtxMenu.type === lt ? '✓ ' : '  '}
                {t(`gantt.linkType.${lt}`)}
              </button>
            ))}
            {onDependencyDelete && (
              <>
                <div className="my-1 border-t" />
                <button
                  type="button"
                  role="menuitem"
                  className={cn(itemCls, "text-destructive")}
                  data-testid="gantt-link-menu-remove"
                  onClick={() => { setLinkCtxMenu(null); onDependencyDelete(source, target); }}
                >
                  {t('gantt.menu.removeDependency')}
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* "添加紧前/紧后" task picker — lists candidate tasks; choosing one
          creates a dependency. Excludes self and tasks already linked in that
          direction (avoids no-op duplicates). */}
      {depPicker && onDependencyCreate && (() => {
        const anchor = tasks.find((tk) => String(tk.id) === String(depPicker.taskId));
        if (!anchor) return null;
        const itemCls = "w-full text-left px-3 py-1.5 hover:bg-accent focus:bg-accent outline-none truncate";
        // Existing links so we hide candidates already connected this way.
        const existing = new Set(
          links.map((l) => `${String(l.sourceId)}->${String(l.targetId)}`),
        );
        const candidates = tasks.filter((c) => {
          if (String(c.id) === String(anchor.id)) return false;
          if (c.type === 'summary') return false;
          const key = depPicker.relation === 'pred'
            ? `${String(c.id)}->${String(anchor.id)}`
            : `${String(anchor.id)}->${String(c.id)}`;
          return !existing.has(key);
        });
        return (
          <div
            ref={depPickerRef}
            className="fixed z-50 min-w-[200px] max-h-[280px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md py-1 text-sm"
            style={{ left: depPicker.x, top: depPicker.y }}
            role="menu"
            data-testid="gantt-dep-picker"
          >
            <div className="px-3 py-1 text-xs text-muted-foreground">
              {depPicker.relation === 'pred' ? t('gantt.menu.addPredecessor') : t('gantt.menu.addSuccessor')}
            </div>
            {candidates.length === 0 ? (
              <div className="px-3 py-1.5 text-muted-foreground">{t('gantt.menu.noCandidates')}</div>
            ) : (
              candidates.map((c) => (
                <button
                  key={String(c.id)}
                  type="button"
                  role="menuitem"
                  className={itemCls}
                  data-testid={`gantt-dep-picker-option-${c.id}`}
                  onClick={() => {
                    setDepPicker(null);
                    if (depPicker.relation === 'pred') onDependencyCreate(c, anchor, 'fs');
                    else onDependencyCreate(anchor, c, 'fs');
                  }}
                >
                  {c.title}
                </button>
              ))
            )}
          </div>
        );
      })()}

      {/* 拖拽冲突 → 顺延确认 (Group 2). A centered modal lists how many tasks
          would shift and offers to auto-reschedule (自动顺延) or keep the manual
          placement (取消保留). */}
      {pendingConflict && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
          data-testid="gantt-conflict-overlay"
          onClick={() => setPendingConflict(null)}
        >
          <div
            className="min-w-[280px] max-w-[360px] rounded-lg border bg-popover text-popover-foreground shadow-lg p-4"
            role="alertdialog"
            aria-modal="true"
            data-testid="gantt-conflict-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-1" data-testid="gantt-conflict-title">
              {t('gantt.conflict.title')}
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              {t('gantt.conflict.body').replace('{count}', String(pendingConflict.length))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md border hover:bg-accent outline-none"
                data-testid="gantt-conflict-cancel"
                onClick={() => setPendingConflict(null)}
              >
                {t('gantt.conflict.cancel')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 outline-none"
                data-testid="gantt-conflict-confirm"
                onClick={applyReschedule}
              >
                {t('gantt.conflict.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
