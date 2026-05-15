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

export interface GanttTask {
  id: string | number
  title: string
  start: Date
  end: Date
  progress: number
  color?: string
  data?: any
  dependencies?: (string | number)[]
}

/**
 * @deprecated The day/week/month/quarter view-mode dropdown was removed
 * because all four values rendered the same daily-column timeline.
 * Kept exported only to avoid breaking downstream type imports; the
 * `viewMode` / `onViewChange` props on `GanttViewProps` are no-ops.
 * Re-introduce real semantics here when timeline granularity is
 * implemented.
 */
export type GanttViewMode = 'day' | 'week' | 'month' | 'quarter';

export interface GanttViewProps {
  tasks: GanttTask[]
  /** @deprecated no-op — see {@link GanttViewMode} */
  viewMode?: GanttViewMode
  startDate?: Date
  endDate?: Date
  onTaskClick?: (task: GanttTask) => void
  onTaskUpdate?: (task: GanttTask, changes: Partial<Pick<GanttTask, 'title' | 'start' | 'end' | 'progress'>>) => void
  onTaskDelete?: (task: GanttTask) => void
  /** @deprecated no-op — see {@link GanttViewMode} */
  onViewChange?: (view: GanttViewMode) => void
  className?: string
  /** Enable inline editing of task fields */
  inlineEdit?: boolean
}

export function GanttView({
  tasks,
  startDate,
  endDate,
  onTaskClick,
  onTaskUpdate,
  className,
  inlineEdit = false,
}: GanttViewProps) {
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

  // Drag-and-drop state for rescheduling a bar (move + resize from either edge).
  // dayDelta is the snapped offset from the original position; preview is rendered
  // by overriding left/width when dragState.taskId matches.
  type DragMode = 'move' | 'resize-left' | 'resize-right';
  const [dragState, setDragState] = React.useState<{
    taskId: string | number;
    mode: DragMode;
    originStart: Date;
    originEnd: Date;
    originClientX: number;
    dayDelta: number;
  } | null>(null);
  const dragStateRef = React.useRef<typeof dragState>(null);
  React.useEffect(() => { dragStateRef.current = dragState; }, [dragState]);
  // Suppress the click that fires immediately after a drag pointerup.
  const suppressNextClickRef = React.useRef(false);

  const computeDragChanges = React.useCallback((s: NonNullable<typeof dragState>) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    const minDurationMs = msPerDay; // never collapse below 1 day
    const deltaMs = s.dayDelta * msPerDay;
    let start = new Date(s.originStart);
    let end = new Date(s.originEnd);
    if (s.mode === 'move') {
      start = new Date(s.originStart.getTime() + deltaMs);
      end = new Date(s.originEnd.getTime() + deltaMs);
    } else if (s.mode === 'resize-left') {
      start = new Date(s.originStart.getTime() + deltaMs);
      if (end.getTime() - start.getTime() < minDurationMs) {
        start = new Date(end.getTime() - minDurationMs);
      }
    } else if (s.mode === 'resize-right') {
      end = new Date(s.originEnd.getTime() + deltaMs);
      if (end.getTime() - start.getTime() < minDurationMs) {
        end = new Date(start.getTime() + minDurationMs);
      }
    }
    return { start, end };
  }, []);

  // Window-level pointer listeners: track horizontal motion in whole-day snaps,
  // commit via onTaskUpdate on pointerup, suppress the trailing click.
  React.useEffect(() => {
    if (!dragState) return;
    const onMove = (e: PointerEvent) => {
      const cur = dragStateRef.current;
      if (!cur) return;
      const next = Math.round((e.clientX - cur.originClientX) / Math.max(columnWidth, 1));
      if (next !== cur.dayDelta) {
        setDragState({ ...cur, dayDelta: next });
      }
    };
    const onUp = () => {
      const cur = dragStateRef.current;
      if (!cur) return;
      if (cur.dayDelta !== 0) {
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
      dayDelta: 0,
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
    
    // Normalize to start of day
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    
    return { start, end };
  }, [startDate, endDate, tasks]);

  // Generate timeline columns
  const timeColumns = React.useMemo(() => {
    const cols: { date: Date; label: string; isWeekend: boolean }[] = [];
    const current = new Date(timelineRange.start);
    
    while (current <= timelineRange.end) {
      cols.push({
        date: new Date(current),
        label: current.getDate().toString(),
        isWeekend: current.getDay() === 0 || current.getDay() === 6
      });
      current.setDate(current.getDate() + 1);
    }
    
    return cols;
  }, [timelineRange]);

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
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = (now.getTime() - timelineRange.start.getTime()) / msPerDay;
    return Math.round(days * columnWidth);
  }, [timelineRange, columnWidth]);
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
    const totalDuration = timelineRange.end.getTime() - timelineRange.start.getTime();
    const tickWidth = columnWidth; // px per day
    const msPerDay = 1000 * 60 * 60 * 24;
    
    const startOffsetMs = task.start.getTime() - timelineRange.start.getTime();
    const durationMs = task.end.getTime() - task.start.getTime();
    
    const left = (startOffsetMs / msPerDay) * tickWidth;
    const width = Math.max((durationMs / msPerDay) * tickWidth, tickWidth); // Min 1 day width
    
    return { left, width };
  };

  return (
    <div ref={containerRef} className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden min-w-0", className)}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border-b bg-card">
        <div className="flex items-center gap-2">
          {/* "New Task" intentionally removed — the page-level header
              already exposes a fully-fielded create form for this
              object, and the toolbar's quick-create only set 3 fields
              which was confusing for required-field-heavy schemas. */}
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous period">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next period">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-xs sm:text-sm">
            {timelineRange.start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View-mode select removed — it was cosmetic only. The
              timeline always iterates one day per column regardless of
              the chosen value, and the only knob that actually changes
              column density is the Zoom in/out below. Re-introduce a
              real Select here when day/week/month/quarter rendering is
              actually implemented in `timeColumns` + `tickWidth`. */}
          <div className="flex bg-muted rounded-md p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setColumnWidthOverride(Math.max(15, columnWidth - 10))}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setColumnWidthOverride(Math.min(120, columnWidth + 10))}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTaskListCollapsed((v) => !v)}
            aria-label={taskListCollapsed ? 'Show task list' : 'Hide task list'}
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
            aria-label="Jump to today"
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
            <div className="flex-1 truncate">Task Name</div>
            {showSEColumns && (
              <>
                <div className="w-16 sm:w-20 text-right">Start</div>
                <div className="w-16 sm:w-20 text-right">End</div>
              </>
            )}
          </div>
          
          {/* Timeline Header */}
          <div className="flex-1 overflow-hidden" ref={headerRef}>
            <div className="flex h-full" style={{ width: timeColumns.length * columnWidth }}>
              {timeColumns.map((col, i) => (
                <div 
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-center border-r text-xs text-muted-foreground h-full",
                    col.isWeekend && "bg-muted/50"
                  )}
                  style={{ width: columnWidth, minWidth: columnWidth }}
                >
                  <span className="font-medium text-foreground">{col.label}</span>
                  <span className="text-[10px] opacity-70">
                    {col.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                </div>
              ))}
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
            <div className="relative" style={{ width: timeColumns.length * columnWidth }}>
              {/* Today vertical marker — sticky inside the scroll area, in front of grid + bars */}
              {todayLeftPx != null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500/80 z-20 pointer-events-none"
                  style={{ left: todayLeftPx }}
                  data-testid="gantt-today-marker"
                  aria-label="Today"
                >
                  <div className="absolute -top-2 -translate-x-1/2 left-0 text-[10px] font-semibold text-white bg-red-500 rounded-sm px-1 py-0.5 whitespace-nowrap">
                    Today
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
                      style={{ width: columnWidth, minWidth: columnWidth }}
                    />
                  ))}
                </div>

                {/* Task Bars */}
                {tasks.map((task) => {
                   const baseStyle = getTaskStyle(task);
                   const isDragging = dragState?.taskId === task.id;
                   let liveStyle = baseStyle;
                   if (isDragging && dragState) {
                     const previewed = computeDragChanges(dragState);
                     liveStyle = getTaskStyle({ ...task, start: previewed.start, end: previewed.end });
                   }
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
                
                {/* Current Time Indicator */}
                <div 
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                  style={{ 
                    left: (new Date().getTime() - timelineRange.start.getTime()) / (1000 * 60 * 60 * 24) * columnWidth 
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
