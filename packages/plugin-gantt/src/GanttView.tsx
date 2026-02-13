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
  MoreHorizontal,
  Plus
} from "lucide-react"
import { 
  cn, 
  Button, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Separator
} from "@object-ui/components"

const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 40;
const COLUMN_WIDTH = 100; // Time column width

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

export type GanttViewMode = 'day' | 'week' | 'month' | 'quarter';

export interface GanttViewProps {
  tasks: GanttTask[]
  viewMode?: GanttViewMode
  startDate?: Date
  endDate?: Date
  onTaskClick?: (task: GanttTask) => void
  onViewChange?: (view: GanttViewMode) => void
  onAddClick?: () => void
  className?: string
}

export function GanttView({
  tasks,
  viewMode = 'month',
  startDate,
  endDate,
  onTaskClick,
  onViewChange,
  onAddClick,
  className
}: GanttViewProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [columnWidth, setColumnWidth] = React.useState(60);
  
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

  const taskListWidth = 300;
  
  const headerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);

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
    <div className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onAddClick?.()} aria-label="Create new task">
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">New</span>
          </Button>
          <div className="h-4 w-px bg-border mx-1 sm:mx-2" />
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-xs sm:text-sm">
            {timelineRange.start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => onViewChange?.(v as GanttViewMode)}>
            <SelectTrigger className="w-[100px] sm:w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day View</SelectItem>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="month">Month View</SelectItem>
              <SelectItem value="quarter">Quarter View</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex bg-muted rounded-md p-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setColumnWidth(prev => Math.max(20, prev - 10))}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setColumnWidth(prev => Math.min(100, prev + 10))}>
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
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
            <div className="flex-1">Task Name</div>
            <div className="w-16 sm:w-20 text-right hidden sm:block">Start</div>
            <div className="w-16 sm:w-20 text-right hidden sm:block">End</div>
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
            {tasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center border-b px-2 sm:px-4 hover:bg-accent/50 cursor-pointer transition-colors touch-manipulation"
                style={{ height: ROW_HEIGHT }}
                onClick={() => onTaskClick?.(task)}
              >
                <div className="flex-1 truncate font-medium text-xs sm:text-sm flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: task.color || '#3b82f6' }} 
                  />
                  {task.title}
                </div>
                <div className="w-16 sm:w-20 text-right text-xs text-muted-foreground hidden sm:block">
                  {task.start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </div>
                <div className="w-16 sm:w-20 text-right text-xs text-muted-foreground hidden sm:block">
                  {task.end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Side: Timeline */}
          <div 
            className="flex-1 overflow-auto bg-background/50 relative [-webkit-overflow-scrolling:touch]" 
            ref={timelineRef}
            onScroll={handleScroll}
          >
            <div style={{ width: timeColumns.length * columnWidth }}>
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
                   const style = getTaskStyle(task);
                   return (
                    <div 
                      key={task.id}
                      className="relative border-b hover:bg-black/5"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div 
                        className="absolute top-2 h-[calc(100%-16px)] rounded-sm bg-primary border border-primary-foreground/20 shadow-sm cursor-pointer hover:brightness-110 flex items-center px-2 group"
                        style={{ 
                          left: style.left, 
                          width: style.width,
                          backgroundColor: task.color || '#3b82f6'
                        }}
                        onClick={() => onTaskClick?.(task)}
                      >
                        {/* Progress Filter */}
                        {task.progress > 0 && (
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-black/20 rounded-l-sm"
                            style={{ width: `${task.progress}%` }}
                          />
                        )}
                        
                        {/* Hover Details */}
                        <span className="text-[10px] text-white font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {Math.round(task.progress)}%
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
