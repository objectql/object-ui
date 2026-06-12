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

export interface GanttViewProps {
  tasks: GanttTask[]
  /** Initial timeline granularity (also switchable from the toolbar). */
  viewMode?: GanttViewMode
  startDate?: Date
  endDate?: Date
  onTaskClick?: (task: GanttTask) => void
  onTaskUpdate?: (task: GanttTask, changes: Partial<Pick<GanttTask, 'title' | 'start' | 'end' | 'progress'>>) => void
  onTaskDelete?: (task: GanttTask) => void
  /** Notified when the user switches granularity from the toolbar. */
  onViewChange?: (view: GanttViewMode) => void
  className?: string
  /** Enable inline editing of task fields */
  inlineEdit?: boolean
}

export function GanttView({
  tasks,
  viewMode: viewModeProp,
  startDate,
  endDate,
  onTaskClick,
  onTaskUpdate,
  onViewChange,
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

  // Drag-and-drop state for rescheduling a bar (move + resize from either edge).
  // unitDelta is the snapped offset, in columns of the active granularity, from
  // the original position; preview is rendered by overriding left/width when
  // dragState.taskId matches.
  type DragMode = 'move' | 'resize-left' | 'resize-right';
  const [dragState, setDragState] = React.useState<{
    taskId: string | number;
    mode: DragMode;
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
          onTaskUpdate(task, { start, end });
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
  }, [dragState, columnWidth, tasks, onTaskUpdate, computeDragChanges]);

  const beginDrag = React.useCallback((task: GanttTask, mode: DragMode, e: React.PointerEvent) => {
    if (!onTaskUpdate) return;
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      taskId: task.id,
      mode,
      originStart: new Date(task.start),
      originEnd: new Date(task.end),
      originClientX: e.clientX,
      unitDelta: 0,
    });
  }, [onTaskUpdate]);
  
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

  const totalWidth = React.useMemo(
    () => timeColumns.reduce((sum, col) => sum + col.width, 0),
    [timeColumns]
  );

  // Upper scale row: month groups under day/week, year groups under month/quarter.
  const headerGroups = React.useMemo(() => {
    const groups: { key: string; label: string; width: number }[] = [];
    const byYear = viewMode === 'month' || viewMode === 'quarter';
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
        });
      }
    }
    return groups;
  }, [timeColumns, viewMode]);

  const taskListWidth_LEGACY_REMOVED = null; // taskListWidth now derived from useResizeObserver above
  
  const headerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);
  // Wrapper around the scroll-syncing timeline body, so the pinch handler
  // and the "Today" button can target a stable node.
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

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
    // Sync horizontal scroll to header
    if (headerRef.current) {
        headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    // Sync vertical scroll to task list
    if (listRef.current) {
        listRef.current.scrollTop = e.currentTarget.scrollTop;
    }
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

  // Row geometry (summary rollup applied) with the in-flight drag preview,
  // so dependency links follow the bar while it is being moved/resized.
  const getLiveRowStyle = (row: GanttRow) => {
    if (!row.isSummary && dragState && dragState.taskId === row.task.id) {
      const previewed = computeDragChanges(dragState);
      return styleFor(previewed.start, previewed.end);
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

  // Orthogonal elbow path from the predecessor anchor to the dependent
  // anchor. Anchors per link type: fs = source end → target start,
  // ss = start → start, ff = end → end, sf = start → end.
  const linkPath = (link: ResolvedLink): string | null => {
    const source = rows[link.sourceIndex];
    const target = rows[link.targetIndex];
    if (!source || !target) return null;
    const s = getLiveRowStyle(source);
    const tg = getLiveRowStyle(target);
    const sy = link.sourceIndex * rowHeight + rowHeight / 2;
    const ty = link.targetIndex * rowHeight + rowHeight / 2;
    const exitRight = link.type === 'fs' || link.type === 'ff';
    const enterRight = link.type === 'ff' || link.type === 'sf';
    // Milestones anchor at their diamond center regardless of side.
    const sx = source.isMilestone ? s.left : exitRight ? s.left + s.width : s.left;
    const tx = target.isMilestone ? tg.left : enterRight ? tg.left + tg.width : tg.left;
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
        </div>
      </div>

      {/* Gantt Body */}
      <div className="flex flex-col flex-1 overflow-hidden">
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
              <div className="flex h-[45%] border-b" data-testid="gantt-header-groups">
                {headerGroups.map((group) => (
                  <div
                    key={group.key}
                    className="flex items-center justify-center border-r text-[10px] font-medium text-muted-foreground overflow-hidden"
                    style={{ width: group.width, minWidth: group.width }}
                  >
                    <span className="truncate px-1">{group.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-1" data-testid="gantt-header-units">
                {timeColumns.map((col, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-center gap-1 border-r text-xs text-muted-foreground h-full overflow-hidden",
                      col.isWeekend && "bg-muted/50"
                    )}
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    <span className="font-medium text-foreground truncate">{col.label}</span>
                    {col.sublabel && columnWidth >= 32 && (
                      <span className="text-[10px] opacity-70">{col.sublabel}</span>
                    )}
                  </div>
                ))}
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
          >
            {rows.map((row) => {
              const task = row.task;
              const isEditing = inlineEdit && editingTask === task.id;
              const isCollapsed = collapsedIds.has(String(task.id));
              return (
              <div
                key={task.id}
                className="group/task-row flex items-center border-b px-2 sm:px-4 hover:bg-accent/50 cursor-pointer transition-colors touch-manipulation"
                style={{ height: rowHeight }}
                onClick={() => !isEditing && onTaskClick?.(task)}
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
                  className="absolute top-0 bottom-0 w-px bg-red-500/80 z-20 pointer-events-none"
                  style={{ left: todayLeftPx }}
                  data-testid="gantt-today-marker"
                  aria-label={t('gantt.toolbar.today')}
                >
                  <div className="absolute -top-2 -translate-x-1/2 left-0 text-[10px] font-semibold text-white bg-red-500 rounded-sm px-1 py-0.5 whitespace-nowrap">
                    {t('gantt.toolbar.today')}
                  </div>
                </div>
              )}
              {/* Timeline Task Rows */}
              <div className="relative">
                {/* Background Grid */}
                <div className="absolute inset-0 flex pointer-events-none z-0">
                   {timeColumns.map((col, i) => (
                    <div
                      key={i}
                      className={cn(
                        "border-r h-full",
                        col.isWeekend && "bg-muted/20"
                      )}
                      style={{ width: col.width, minWidth: col.width }}
                    />
                  ))}
                </div>

                {/* Task Bars */}
                {rows.map((row) => {
                   const task = row.task;
                   const baseStyle = styleFor(row.start, row.end);
                   const isDragging = dragState?.taskId === task.id;
                   const liveStyle = isDragging ? getLiveRowStyle(row) : baseStyle;
                   const canDrag = !!onTaskUpdate && !row.isSummary;

                   if (row.isSummary) {
                     // Summary bracket: slim bar with downward end caps spanning
                     // the children rollup. Read-only — children drive its range.
                     return (
                      <div
                        key={task.id}
                        className="relative border-b hover:bg-black/5"
                        style={{ height: rowHeight }}
                      >
                        <div
                          className="absolute rounded-[2px] bg-foreground/75"
                          style={{ left: baseStyle.left, width: baseStyle.width, top: rowHeight * 0.18, height: 6 }}
                          data-testid={`gantt-summary-bar-${task.id}`}
                          data-progress={Math.round(row.progress)}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId((cur) => (cur === task.id ? null : cur))}
                          onClick={() => onTaskClick?.(task)}
                        >
                          <div className="absolute left-0 top-0 w-[3px] bg-foreground/75 rounded-b-[2px]" style={{ height: 12 }} />
                          <div className="absolute right-0 top-0 w-[3px] bg-foreground/75 rounded-b-[2px]" style={{ height: 12 }} />
                        </div>
                      </div>
                     );
                   }

                   if (row.isMilestone) {
                     const size = Math.max(Math.round(rowHeight * 0.4), 12);
                     return (
                      <div
                        key={task.id}
                        className="relative border-b hover:bg-black/5"
                        style={{ height: rowHeight }}
                      >
                        <div
                          className={cn(
                            "absolute rotate-45 rounded-[2px] border border-primary-foreground/20 shadow-sm select-none",
                            canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            isDragging && "ring-2 ring-primary/60 brightness-110 z-10"
                          )}
                          style={{
                            left: liveStyle.left - size / 2,
                            top: (rowHeight - size) / 2,
                            width: size,
                            height: size,
                            backgroundColor: task.color || '#3b82f6',
                          }}
                          data-testid={`gantt-milestone-${task.id}`}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId((cur) => (cur === task.id ? null : cur))}
                          onClick={() => {
                            if (suppressNextClickRef.current) return;
                            onTaskClick?.(task);
                          }}
                          onPointerDown={canDrag ? (e) => {
                            if (e.button !== 0) return;
                            beginDrag(task, 'move', e);
                          } : undefined}
                        />
                      </div>
                     );
                   }

                   return (
                    <div
                      key={task.id}
                      className="relative border-b hover:bg-black/5"
                      style={{ height: rowHeight }}
                    >
                      {/* Ghost: original position rendered faded while dragging */}
                      {isDragging && (
                        <div
                          className="absolute top-1 sm:top-2 h-[calc(100%-8px)] sm:h-[calc(100%-16px)] rounded-sm border border-dashed border-primary/60 pointer-events-none"
                          style={{ left: baseStyle.left, width: baseStyle.width, opacity: 0.35 }}
                          aria-hidden="true"
                        />
                      )}
                      <div 
                        className={cn(
                          "absolute top-1 sm:top-2 h-[calc(100%-8px)] sm:h-[calc(100%-16px)] rounded-sm bg-primary border border-primary-foreground/20 shadow-sm hover:brightness-110 flex items-center px-2 group select-none",
                          canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                          isDragging && "ring-2 ring-primary/60 brightness-110 z-10"
                        )}
                        style={{ 
                          left: liveStyle.left, 
                          width: liveStyle.width,
                          backgroundColor: task.color || '#3b82f6'
                        }}
                        data-testid={`gantt-task-bar-${task.id}`}
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() => setHoveredTaskId((cur) => (cur === task.id ? null : cur))}
                        onClick={() => {
                          if (suppressNextClickRef.current) return;
                          onTaskClick?.(task);
                        }}
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
                              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40"
                              data-testid={`gantt-task-resize-left-${task.id}`}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                beginDrag(task, 'resize-left', e);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div
                              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40"
                              data-testid={`gantt-task-resize-right-${task.id}`}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                beginDrag(task, 'resize-right', e);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        )}

                        {/* Progress Filter */}
                        {task.progress > 0 && (
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-black/20 rounded-l-sm pointer-events-none"
                            style={{ width: `${task.progress}%` }}
                          />
                        )}
                        
                        {/* Hover Details / drag tooltip */}
                        <span className="text-[10px] text-white font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {isDragging
                            ? `${computeDragChanges(dragState!).start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} → ${computeDragChanges(dragState!).end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}`
                            : `${Math.round(task.progress)}%`}
                        </span>
                      </div>
                    </div>
                   )
                })}

                {/* Dependency Links — SVG overlay above bars, below the Today
                    marker (z-20). pointer-events-none so bar drag/click win. */}
                {links.length > 0 && (
                  <svg
                    className="absolute top-0 left-0 pointer-events-none z-10"
                    width={totalWidth}
                    height={rows.length * rowHeight}
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
                  </svg>
                )}

                {/* Current Time Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                  style={{
                    left: (new Date().getTime() - timelineRange.start.getTime()) / MS_PER_DAY * pxPerDay
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-[3px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
