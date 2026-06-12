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

export interface GanttTask {
  id: string | number
  title: string
  start: Date
  end: Date
  progress: number
  color?: string
  data?: any
  dependencies?: GanttDependency[]
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

  const getTaskStyle = (task: GanttTask) => {
    const startOffsetMs = task.start.getTime() - timelineRange.start.getTime();
    const durationMs = task.end.getTime() - task.start.getTime();

    const left = (startOffsetMs / MS_PER_DAY) * pxPerDay;
    // Min 1 day, and never thinner than 3px so the bar stays visible (and
    // grabbable) at coarse granularities where a day is only ~2px.
    const width = Math.max((durationMs / MS_PER_DAY) * pxPerDay, pxPerDay, 3);

    return { left, width };
  };

  // Bar geometry with the in-flight drag preview applied, so dependency
  // links follow the bar while it is being moved/resized.
  const getLiveTaskStyle = (task: GanttTask) => {
    if (dragState && dragState.taskId === task.id) {
      const previewed = computeDragChanges(dragState);
      return getTaskStyle({ ...task, start: previewed.start, end: previewed.end });
    }
    return getTaskStyle(task);
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
    const indexById = new Map<string, number>();
    tasks.forEach((task, i) => indexById.set(String(task.id), i));
    const out: ResolvedLink[] = [];
    tasks.forEach((task, targetIndex) => {
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
  }, [tasks]);

  // Orthogonal elbow path from the predecessor anchor to the dependent
  // anchor. Anchors per link type: fs = source end → target start,
  // ss = start → start, ff = end → end, sf = start → end.
  const linkPath = (link: ResolvedLink): string | null => {
    const source = tasks[link.sourceIndex];
    const target = tasks[link.targetIndex];
    if (!source || !target) return null;
    const s = getLiveTaskStyle(source);
    const tg = getLiveTaskStyle(target);
    const sy = link.sourceIndex * rowHeight + rowHeight / 2;
    const ty = link.targetIndex * rowHeight + rowHeight / 2;
    const exitRight = link.type === 'fs' || link.type === 'ff';
    const enterRight = link.type === 'ff' || link.type === 'sf';
    const sx = exitRight ? s.left + s.width : s.left;
    const tx = enterRight ? tg.left + tg.width : tg.left;
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
            {tasks.map((task) => {
              const isEditing = inlineEdit && editingTask === task.id;
              return (
              <div 
                key={task.id}
                className="group/task-row flex items-center border-b px-2 sm:px-4 hover:bg-accent/50 cursor-pointer transition-colors touch-manipulation"
                style={{ height: rowHeight }}
                onClick={() => !isEditing && onTaskClick?.(task)}
                onDoubleClick={() => {
                  if (inlineEdit && onTaskUpdate) {
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
                <div className="flex-1 truncate font-medium text-xs sm:text-sm flex items-center gap-2">
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
                      <span className="truncate">{task.title}</span>
                      <span className="text-[10px] text-muted-foreground sm:hidden">
                        {task.start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })} → {task.end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
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
                    task.start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
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
                    task.end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
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
                {tasks.map((task) => {
                   const baseStyle = getTaskStyle(task);
                   const isDragging = dragState?.taskId === task.id;
                   const liveStyle = isDragging ? getLiveTaskStyle(task) : baseStyle;
                   const canDrag = !!onTaskUpdate;
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
                    height={tasks.length * rowHeight}
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
