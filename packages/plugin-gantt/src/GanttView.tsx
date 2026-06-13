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
} from "lucide-react"
import { 
  cn, 
  Button, 
  Separator,
  useResizeObserver,
} from "@object-ui/components"
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
const NOMINAL_DAYS: Record<GanttViewMode, number> = {
  day: 1,
  week: 7,
  month: 30.44,
  quarter: 91.31,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Floor a date to the start of its column unit (Monday for weeks). */
function startOfUnit(date: Date, mode: GanttViewMode): Date {
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
function addUnits(date: Date, units: number, mode: GanttViewMode): Date {
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
   * Enables row drag-to-reorder in the task list. Called with the dragged
   * task and the sibling it was dropped on (insert before it). Only fires
   * for rows sharing the same parent.
   */
  onTaskReorder?: (task: GanttTask, before: GanttTask) => void
  className?: string
  /** Enable inline editing of task fields */
  inlineEdit?: boolean
}

export function GanttView({
  tasks,
  viewMode: viewModeProp,
  startDate,
  endDate,
  markers,
  onTaskClick,
  onTaskUpdate,
  onTaskDelete,
  onViewChange,
  onDependencyCreate,
  onTaskReorder,
  className,
  inlineEdit = false,
}: GanttViewProps) {
  const { t } = useGanttTranslation();
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
  const columnWidth = columnWidthOverride ?? baseColumnWidth;
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
  // One column = one unit of the active granularity; bars/markers map time
  // linearly at pxPerDay so they stay aligned with the calendar-width columns.
  const pxPerDay = columnWidth / NOMINAL_DAYS[viewMode];
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
  const showSEColumns = showStartEndColumns(taskListWidth);
  const [editingTask, setEditingTask] = React.useState<string | number | null>(null);
  const [editValues, setEditValues] = React.useState<Record<string, string>>({});
  // Hovered bar id — used to highlight its dependency links.
  const [hoveredTaskId, setHoveredTaskId] = React.useState<string | number | null>(null);

  // Children index for group operations: dragging a summary bar moves its
  // whole subtree by the same offset. Mirrors the orphan/self-parent rules
  // of the row tree below.
  const childrenByParent = React.useMemo(() => {
    const ids = new Set(tasks.map((t) => String(t.id)));
    const map = new Map<string, GanttTask[]>();
    for (const t of tasks) {
      const p = t.parent != null && t.parent !== '' ? String(t.parent) : null;
      if (p && p !== String(t.id) && ids.has(p)) {
        const list = map.get(p);
        if (list) list.push(t);
        else map.set(p, [t]);
      }
    }
    return map;
  }, [tasks]);

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
    let start = new Date(s.originStart);
    let end = new Date(s.originEnd);
    if (s.mode === 'move') {
      // Snap the start to whole units; the end follows by the same ms offset
      // so the task keeps its duration even across uneven months.
      start = addUnits(s.originStart, s.unitDelta, viewMode);
      end = new Date(s.originEnd.getTime() + (start.getTime() - s.originStart.getTime()));
    } else if (s.mode === 'resize-left') {
      start = addUnits(s.originStart, s.unitDelta, viewMode);
      if (end.getTime() - start.getTime() < minDurationMs) {
        start = new Date(end.getTime() - minDurationMs);
      }
    } else if (s.mode === 'resize-right') {
      end = addUnits(s.originEnd, s.unitDelta, viewMode);
      if (end.getTime() - start.getTime() < minDurationMs) {
        end = new Date(start.getTime() + minDurationMs);
      }
    }
    return { start, end };
  }, [viewMode]);

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
            // the subtree keeps its internal spacing and durations.
            const deltaMs = start.getTime() - cur.originStart.getTime();
            const shift = (t: GanttTask) =>
              onTaskUpdate(t, {
                start: new Date(t.start.getTime() + deltaMs),
                end: new Date(t.end.getTime() + deltaMs),
              });
            shift(task);
            for (const d of collectDescendants(task.id)) shift(d);
          } else {
            onTaskUpdate(task, { start, end });
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
  }, [dragState, columnWidth, tasks, onTaskUpdate, computeDragChanges, collectDescendants]);

  const beginDrag = React.useCallback((
    task: GanttTask,
    mode: DragMode,
    e: React.PointerEvent,
    opts?: { group?: boolean; originStart?: Date; originEnd?: Date }
  ) => {
    if (!onTaskUpdate) return;
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
        if (task && onTaskUpdate) onTaskUpdate(task, { progress: cur.value });
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
  }, [progressDrag, tasks, onTaskUpdate]);

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
    const ids = new Set(tasks.map((t) => String(t.id)));
    const byParent = new Map<string, GanttTask[]>();
    const roots: GanttTask[] = [];
    for (const t of tasks) {
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
    for (const t of tasks) if (!visited.has(String(t.id))) walk(t, 0);
    return out;
  }, [tasks, collapsedIds]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
  }, [rows, selectedTaskId, onTaskClick, onTaskDelete, collapsedIds, toggleCollapsed, rowHeight]);

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

    return { start, end };
  }, [startDate, endDate, tasks, viewMode]);

  // Generate timeline columns — one per unit of the active granularity.
  // Widths follow the calendar at pxPerDay, so a 31-day month column is
  // slightly wider than a 30-day one and stays aligned with the bars.
  const timeColumns = React.useMemo(() => {
    const cols: { date: Date; label: string; sublabel?: string; isWeekend: boolean; width: number }[] = [];
    let current = new Date(timelineRange.start);

    while (current <= timelineRange.end) {
      const next = addUnits(current, 1, viewMode);
      const width = ((next.getTime() - current.getTime()) / MS_PER_DAY) * pxPerDay;
      let label: string;
      let sublabel: string | undefined;
      if (viewMode === 'day') {
        label = String(current.getDate());
        sublabel = current.toLocaleDateString(undefined, { weekday: 'narrow' });
      } else if (viewMode === 'week') {
        label = current.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
      } else if (viewMode === 'month') {
        label = current.toLocaleDateString(undefined, { month: 'short' });
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
  }, [timelineRange, viewMode, pxPerDay]);

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
            : col.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
          width: col.width,
          offset: acc,
        });
      }
      acc += col.width;
    }
    return groups;
  }, [timeColumns, viewMode]);

  // Normalized custom markers (invalid/out-of-range dates dropped), with the
  // same linear ms→px mapping the bars and the Today line use.
  const resolvedMarkers = React.useMemo(() => {
    return (markers ?? [])
      .map((m, i) => {
        const date = m.date instanceof Date ? m.date : new Date(m.date);
        return {
          index: i,
          label: m.label,
          color: m.color || 'hsl(var(--primary))',
          left: Math.round(((date.getTime() - timelineRange.start.getTime()) / MS_PER_DAY) * pxPerDay),
          valid: !isNaN(date.getTime()) && date >= timelineRange.start && date <= timelineRange.end,
        };
      })
      .filter((m) => m.valid);
  }, [markers, timelineRange, pxPerDay]);

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
    const days = (now.getTime() - timelineRange.start.getTime()) / MS_PER_DAY;
    return Math.round(days * pxPerDay);
  }, [timelineRange, pxPerDay]);
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
    const startOffsetMs = start.getTime() - timelineRange.start.getTime();
    const durationMs = end.getTime() - start.getTime();

    const left = (startOffsetMs / MS_PER_DAY) * pxPerDay;
    // Min 1 day, and never thinner than 3px so the bar stays visible (and
    // grabbable) at coarse granularities where a day is only ~2px.
    const width = Math.max((durationMs / MS_PER_DAY) * pxPerDay, pxPerDay, 3);

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

  return (
    <div ref={containerRef} className={cn("flex flex-col h-full bg-background overflow-hidden min-w-0", className)}>
      {/* Hover rules the prebuilt components CSS can't provide (alpha
          utilities like hover:bg-white/40 are never emitted there). */}
      <style>{`
        .gantt-resize-handle:hover { background-color: rgba(255, 255, 255, 0.4); }
        .gantt-bar-hover:hover { filter: brightness(1.1); }
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
            {timelineRange.start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
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
        <div className="flex border-b bg-muted/30 shrink-0 h-10 sm:h-[50px]">
          {/* List Header */}
          <div 
            className="flex items-center font-medium text-xs text-muted-foreground px-2 sm:px-4 border-r bg-card z-20 shadow-sm"
            style={{ width: taskListWidth, minWidth: taskListWidth }}
          >
            <div className="flex-1 truncate">{t('gantt.column.taskName')}</div>
            {showSEColumns && (
              <>
                <div className="w-16 sm:w-20 text-right">{t('gantt.column.start')}</div>
                <div className="w-16 sm:w-20 text-right">{t('gantt.column.end')}</div>
              </>
            )}
          </div>
          
          {/* Timeline Header — two scale rows: group (month/year) over units */}
          <div className="flex-1 overflow-hidden" ref={headerRef}>
            <div className="flex flex-col h-full" style={{ width: totalWidth }}>
              <div className="relative h-[45%] border-b" data-testid="gantt-header-groups">
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
                  "group/task-row flex items-center border-b px-2 sm:px-4 hover:bg-accent/50 cursor-pointer transition-colors touch-manipulation",
                  isSelected && "bg-accent/50"
                )}
                style={{ height: rowHeight }}
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
                  const src = tasks.find((t) => String(t.id) === srcId);
                  // Reorder is sibling-scoped: dropping on a row with a
                  // different parent is ignored rather than re-parenting.
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
                      className="h-4 w-4 -ml-1 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground"
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
                    <span className="w-3 -ml-1 shrink-0" aria-hidden="true" />
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
                          onTaskUpdate?.(task, {
                            title: editValues.title,
                            start: new Date(editValues.start),
                            end: new Date(editValues.end),
                            progress: Number(editValues.progress) || 0,
                          });
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
                      <span className="text-[10px] text-muted-foreground sm:hidden">
                        {row.start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} → {row.end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                      </span>
                    </span>
                  )}
                </div>
                <div className="w-16 sm:w-20 text-right text-xs text-muted-foreground hidden sm:block" hidden={!showSEColumns} style={!showSEColumns ? { display: 'none' } : undefined}>
                  {isEditing ? (
                    <input
                      type="date"
                      className="border rounded px-1 py-0.5 text-xs w-full bg-background"
                      value={editValues.start || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, start: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    row.start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
                  )}
                </div>
                <div className="w-16 sm:w-20 text-right text-xs text-muted-foreground hidden sm:block" hidden={!showSEColumns} style={!showSEColumns ? { display: 'none' } : undefined}>
                  {isEditing ? (
                    <input
                      type="date"
                      className="border rounded px-1 py-0.5 text-xs w-full bg-background"
                      value={editValues.end || ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, end: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    row.end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
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
                    className="absolute -top-2 -translate-x-1/2 left-0 text-[10px] font-semibold text-white rounded-sm px-1 py-0.5 whitespace-nowrap"
                    style={{ backgroundColor: '#ef4444' }}
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
                      className="absolute -top-2 -translate-x-1/2 left-0 text-[10px] font-semibold text-white rounded-sm px-1 py-0.5 whitespace-nowrap"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.label}
                    </div>
                  )}
                </div>
              ))}
              {/* Timeline Task Rows */}
              <div className="relative" ref={contentRef}>
                {/* Background Grid — windowed to the visible columns */}
                <div className="absolute inset-0 pointer-events-none z-0">
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
                   const baseStyle = styleFor(row.start, row.end);
                   const isDragging = dragState?.taskId === task.id;
                   const inDragGroup = dragGroupIds?.has(String(task.id)) ?? false;
                   const liveStyle = isDragging || inDragGroup ? getLiveRowStyle(row) : baseStyle;
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
                       <div className="text-muted-foreground">
                         {row.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                         {' → '}
                         {row.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                         {' · '}{durationDays}{t('gantt.tooltip.days')}
                         {' · '}{Math.round(row.progress)}%
                       </div>
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
                            borderColor: 'hsl(var(--primary-foreground) / 0.2)',
                          }}
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
                            className="absolute left-0 top-0 bottom-0 rounded-l-sm pointer-events-none"
                            style={{ width: `${Math.round(row.progress)}%`, backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
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
                            {computeDragChanges(dragState).start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                            {' → '}
                            {computeDragChanges(dragState).end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
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
                            backgroundColor: task.color || '#3b82f6',
                            borderColor: 'hsl(var(--primary-foreground) / 0.2)',
                          }}
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
                          borderColor: 'hsl(var(--primary-foreground) / 0.2)'
                        }}
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
                              className="gantt-resize-handle absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                              data-testid={`gantt-task-resize-left-${task.id}`}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                beginDrag(task, 'resize-left', e);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div
                              className="gantt-resize-handle absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
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
                            className="absolute left-0 top-0 bottom-0 rounded-l-sm pointer-events-none"
                            style={{ width: `${liveProgress}%`, backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
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
                              "absolute -right-2 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-background cursor-crosshair z-10",
                              linkDrag && String(linkDrag.sourceId) === String(task.id)
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 transition-opacity"
                            )}
                            style={{ border: '2px solid hsl(var(--primary))' }}
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
                            ? `${computeDragChanges(dragState!).start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} → ${computeDragChanges(dragState!).end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}`
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
                      return (
                        <path
                          key={link.key}
                          d={d}
                          fill="none"
                          stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                          strokeOpacity={active ? 1 : 0.7}
                          strokeWidth={active ? 2 : 1.5}
                          markerEnd={`url(#${active ? 'gantt-link-arrow-active' : 'gantt-link-arrow'})`}
                          data-testid={`gantt-link-${link.sourceId}-${link.targetId}`}
                          data-link-type={link.type}
                          data-active={active ? 'true' : 'false'}
                        />
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
    </div>
  )
}
