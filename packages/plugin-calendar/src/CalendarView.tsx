/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, PlusIcon } from "lucide-react"
import { 
  cn, 
  Button, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@object-ui/components"
import { useObjectTranslation } from "@object-ui/i18n"

const DEFAULT_EVENT_COLOR = "bg-blue-500 text-white"
const STABLE_DEFAULT_DATE = new Date()

// Default English translations for fallback when I18nProvider is not available
const DEFAULT_TRANSLATIONS: Record<string, string> = {
  'calendar.today': 'Today',
  'calendar.month': 'Month',
  'calendar.week': 'Week',
  'calendar.day': 'Day',
  'calendar.newEvent': 'New event',
  'calendar.moreEvents': '+{{count}} more',
}

/**
 * Safe wrapper for useObjectTranslation that falls back to English defaults
 * when I18nProvider is not available (e.g., standalone usage outside console).
 */
function useCalendarTranslation() {
  try {
    const result = useObjectTranslation()
    // Check if i18n is properly initialized by testing a known key
    const testValue = result.t('calendar.today')
    if (testValue === 'calendar.today') {
      // i18n returned the key itself — not initialized
      return {
        t: (key: string, options?: Record<string, unknown>) => {
          let value = DEFAULT_TRANSLATIONS[key] || key
          if (options) {
            for (const [k, v] of Object.entries(options)) {
              value = value.replace(`{{${k}}}`, String(v))
            }
          }
          return value
        },
        language: 'en',
      }
    }
    return { t: result.t, language: result.language }
  } catch {
    return {
      t: (key: string, options?: Record<string, unknown>) => {
        let value = DEFAULT_TRANSLATIONS[key] || key
        if (options) {
          for (const [k, v] of Object.entries(options)) {
            value = value.replace(`{{${k}}}`, String(v))
          }
        }
        return value
      },
      language: 'en',
    }
  }
}

export interface CalendarEvent {
  id: string | number
  title: string
  start: Date
  end?: Date
  allDay?: boolean
  color?: string
  data?: any
}

export interface CalendarViewProps {
  events?: CalendarEvent[]
  view?: "month" | "week" | "day"
  currentDate?: Date
  locale?: string
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date) => void
  onViewChange?: (view: "month" | "week" | "day") => void
  onNavigate?: (date: Date) => void
  onAddClick?: () => void
  onEventDrop?: (event: CalendarEvent, newStart: Date, newEnd?: Date) => void
  className?: string
}

function CalendarView({
  events = [],
  view = "month",
  currentDate = STABLE_DEFAULT_DATE,
  locale = "default",
  onEventClick,
  onDateClick,
  onViewChange,
  onNavigate,
  onAddClick,
  onEventDrop,
  className,
}: CalendarViewProps) {
  const [selectedView, setSelectedView] = React.useState(view)
  const [selectedDate, setSelectedDate] = React.useState(currentDate)
  const { t, language } = useCalendarTranslation()
  const effectiveLocale = locale !== "default" ? locale : language

  // Sync state if props change
  React.useEffect(() => {
    setSelectedDate(currentDate)
  }, [currentDate])

  React.useEffect(() => {
    setSelectedView(view)
  }, [view])

  // Auto-switch to day view on mobile
  const onViewChangeRef = React.useRef(onViewChange)
  onViewChangeRef.current = onViewChange

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setSelectedView("day")
        onViewChangeRef.current?.("day")
      }
    }
    handleChange(mq)
    mq.addEventListener("change", handleChange)
    return () => mq.removeEventListener("change", handleChange)
  }, [])

  const handlePrevious = () => {
    const newDate = new Date(selectedDate)
    if (selectedView === "month") {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (selectedView === "week") {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() - 1)
    }
    setSelectedDate(newDate)
    onNavigate?.(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(selectedDate)
    if (selectedView === "month") {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (selectedView === "week") {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setDate(newDate.getDate() + 1)
    }
    setSelectedDate(newDate)
    onNavigate?.(newDate)
  }

  const handleToday = () => {
    const today = new Date()
    setSelectedDate(today)
    onNavigate?.(today)
  }

  const handleViewChange = (newView: "month" | "week" | "day") => {
    setSelectedView(newView)
    onViewChange?.(newView)
  }

  const getDateLabel = () => {
    if (selectedView === "month") {
      return selectedDate.toLocaleDateString(effectiveLocale, {
        month: "long",
        year: "numeric",
      })
    } else if (selectedView === "week") {
      const weekStart = getWeekStart(selectedDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      return `${weekStart.toLocaleDateString(effectiveLocale, {
        month: "short",
        day: "numeric",
      })} - ${weekEnd.toLocaleDateString(effectiveLocale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    } else {
      return selectedDate.toLocaleDateString(effectiveLocale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    }
  }

  // Swipe navigation for mobile
  const touchStart = React.useRef<number>(0)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      const newDate = new Date(selectedDate)
      if (selectedView === "day") newDate.setDate(newDate.getDate() + (diff > 0 ? 1 : -1))
      else if (selectedView === "week") newDate.setDate(newDate.getDate() + (diff > 0 ? 7 : -7))
      else newDate.setMonth(newDate.getMonth() + (diff > 0 ? 1 : -1))
      setSelectedDate(newDate)
      onNavigate?.(newDate)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      onNavigate?.(date)
    }
  }

  return (
    <div role="region" aria-label="Calendar" className={cn("flex flex-col h-full bg-background min-w-0 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-4 border-b min-w-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted/50 rounded-lg p-1 gap-1">
             <Button variant="ghost" size="sm" onClick={handleToday} className="h-8" aria-label="Go to today">
               {t('calendar.today')}
             </Button>
             <div className="h-4 w-px bg-border mx-1" />
             <Button
               variant="ghost"
               size="icon"
               aria-label="Previous period"
               onClick={handlePrevious}
               className="h-8 w-8"
             >
               <ChevronLeftIcon className="h-4 w-4" />
             </Button>
             <Button
               variant="ghost"
               size="icon"
               aria-label="Next period"
               onClick={handleNext}
               className="h-8 w-8"
             >
               <ChevronRightIcon className="h-4 w-4" />
             </Button>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                aria-label={`Current date: ${getDateLabel()}`}
                className={cn(
                  "text-base sm:text-xl font-semibold h-auto px-2 sm:px-3 py-1 hover:bg-muted/50 transition-colors",
                  "flex items-center gap-2"
                )}
              >
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <span>{getDateLabel()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
                fromYear={2000}
                toYear={2050}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedView} onValueChange={handleViewChange}>
            <SelectTrigger className="w-32 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('calendar.day')}</SelectItem>
              <SelectItem value="week">{t('calendar.week')}</SelectItem>
              <SelectItem value="month">{t('calendar.month')}</SelectItem>
            </SelectContent>
          </Select>
          
          {onAddClick && (
            <Button onClick={onAddClick} size="sm" className="gap-1">
              <PlusIcon className="h-4 w-4" />
              {t('calendar.newEvent')}
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {selectedView === "month" && (
          <MonthView
            date={selectedDate}
            events={events}
            locale={effectiveLocale}
            onEventClick={onEventClick}
            onDateClick={onDateClick}
            onEventDrop={onEventDrop}
          />
        )}
        {selectedView === "week" && (
          <WeekView
            date={selectedDate}
            events={events}
            locale={effectiveLocale}
            onEventClick={onEventClick}
            onDateClick={onDateClick}
          />
        )}
        {selectedView === "day" && (
          <DayView
            date={selectedDate}
            events={events}
            onEventClick={onEventClick}
            onDateClick={onDateClick}
          />
        )}
      </div>
    </div>
  )
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  return d
}

function getMonthDays(date: Date): Date[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay()
  const days: Date[] = []

  // Add previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    const prevDate = new Date(firstDay.getTime())
    prevDate.setDate(prevDate.getDate() - (i + 1))
    days.push(prevDate)
  }

  // Add current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // Add next month days
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    const nextDate = new Date(lastDay.getTime())
    nextDate.setDate(nextDate.getDate() + i)
    days.push(nextDate)
  }

  return days
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function getEventsForDate(date: Date, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = new Date(event.start)
    const eventEnd = event.end ? new Date(event.end) : new Date(eventStart)

    // Create new date objects for comparison to avoid mutation
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    const dateEnd = new Date(date)
    dateEnd.setHours(23, 59, 59, 999)

    const eventStartTime = new Date(eventStart)
    eventStartTime.setHours(0, 0, 0, 0)
    const eventEndTime = new Date(eventEnd)
    eventEndTime.setHours(23, 59, 59, 999)

    return dateStart <= eventEndTime && dateEnd >= eventStartTime
  })
}

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  locale?: string
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date) => void
  onEventDrop?: (event: CalendarEvent, newStart: Date, newEnd?: Date) => void
}

function MonthView({ date, events, locale = "default", onEventClick, onDateClick, onEventDrop }: MonthViewProps) {
  const days = React.useMemo(() => getMonthDays(date), [date.getFullYear(), date.getMonth()])
  const today = React.useMemo(() => new Date(), [])
  const { t } = useCalendarTranslation()
  const weekDays = React.useMemo(() => {
    const refSunday = new Date(2024, 0, 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refSunday)
      d.setDate(d.getDate() + i)
      return d.toLocaleDateString(locale, { weekday: "short" })
    })
  }, [locale])
  const [draggedEventId, setDraggedEventId] = React.useState<string | number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null)

  // Pre-build event index by date key for O(1) lookup per cell instead of O(N)
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const eventStart = new Date(event.start)
      const eventEnd = event.end ? new Date(event.end) : new Date(eventStart)
      eventStart.setHours(0, 0, 0, 0)
      eventEnd.setHours(0, 0, 0, 0)
      const cursor = new Date(eventStart)
      while (cursor <= eventEnd) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
        const arr = map.get(key)
        if (arr) {
          arr.push(event)
        } else {
          map.set(key, [event])
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return map
  }, [events])

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEventId(event.id)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(event.id))
  }

  const handleDragEnd = () => {
    setDraggedEventId(null)
    setDropTargetIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTargetIndex(index)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when actually leaving the cell, not when moving over child elements
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTargetIndex(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault()
    setDropTargetIndex(null)
    setDraggedEventId(null)

    if (!onEventDrop) return

    const eventId = e.dataTransfer.getData("text/plain")
    const draggedEvent = events.find((ev) => String(ev.id) === eventId)
    if (!draggedEvent) return

    const oldStart = new Date(draggedEvent.start)
    const oldStartDay = new Date(oldStart)
    oldStartDay.setHours(0, 0, 0, 0)

    const newTargetDay = new Date(targetDay)
    newTargetDay.setHours(0, 0, 0, 0)

    const deltaMs = newTargetDay.getTime() - oldStartDay.getTime()
    if (deltaMs === 0) return

    const newStart = new Date(oldStart.getTime() + deltaMs)

    let newEnd: Date | undefined
    if (draggedEvent.end) {
      newEnd = new Date(new Date(draggedEvent.end).getTime() + deltaMs)
    }

    onEventDrop(draggedEvent, newStart, newEnd)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Week day headers */}
      <div role="row" className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div role="grid" aria-label="Calendar grid" className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day, index) => {
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
          const dayEvents = eventsByDate.get(key) || []
          const isCurrentMonth = day.getMonth() === date.getMonth()
          const isToday = isSameDay(day, today)

          return (
            <div
              key={index}
              role="gridcell"
              aria-label={`${day.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "border-b border-r last:border-r-0 p-2 min-h-[100px] cursor-pointer hover:bg-accent/50",
                !isCurrentMonth && "bg-muted/50 text-muted-foreground opacity-50",
                dropTargetIndex === index && "ring-2 ring-primary"
              )}
              onClick={() => onDateClick?.(day)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-2",
                  isToday &&
                    "inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground h-6 w-6"
                )}
                {...(isToday ? { "aria-current": "date" as const } : {})}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    role="button"
                    title={event.title}
                    aria-label={event.title}
                    draggable={!!onEventDrop}
                    onDragStart={(e) => handleDragStart(e, event)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "text-xs px-2 py-1 rounded truncate cursor-pointer hover:opacity-80",
                      event.color?.startsWith("#") ? "text-white" : (event.color || DEFAULT_EVENT_COLOR),
                      draggedEventId === event.id && "opacity-50"
                    )}
                    style={
                      event.color && event.color.startsWith("#")
                        ? { backgroundColor: event.color }
                        : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick?.(event)
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-2">
                    {t('calendar.moreEvents', { count: dayEvents.length - 3 })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface WeekViewProps {
  date: Date
  events: CalendarEvent[]
  locale?: string
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date) => void
}

function WeekView({ date, events, locale = "default", onEventClick, onDateClick }: WeekViewProps) {
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSlotTouchStart = (day: Date) => {
    if (!onDateClick) return
    longPressTimer.current = setTimeout(() => {
      onDateClick(day)
    }, 500)
  }

  const handleSlotTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const weekStart = getWeekStart(date)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + i)
    return day
  })
  const today = new Date()

  return (
    <div className="flex flex-col h-full">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today)
          return (
            <div
              key={day.toISOString()}
              className="p-3 text-center border-r last:border-r-0"
            >
              <div className="text-sm font-medium text-muted-foreground">
                {day.toLocaleDateString(locale, { weekday: "short" })}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold mt-1",
                  isToday &&
                    "inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground h-8 w-8"
                )}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Week events */}
      <div role="grid" className="grid grid-cols-7 flex-1">
        {weekDays.map((day) => {
          const dayEvents = getEventsForDate(day, events)
          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              aria-label={`${day.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}`}
              className="border-r last:border-r-0 p-2 min-h-[400px] cursor-pointer hover:bg-accent/50"
              onClick={() => onDateClick?.(day)}
              onTouchStart={() => handleSlotTouchStart(day)}
              onTouchEnd={handleSlotTouchEnd}
            >
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    role="button"
                    title={event.title}
                    aria-label={event.title}
                    className={cn(
                      "text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded cursor-pointer hover:opacity-80",
                      event.color?.startsWith("#") ? "text-white" : (event.color || DEFAULT_EVENT_COLOR)
                    )}
                    style={
                      event.color && event.color.startsWith("#")
                        ? { backgroundColor: event.color }
                        : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick?.(event)
                    }}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    {!event.allDay && (
                      <div className="text-xs opacity-90 mt-1">
                        {event.start.toLocaleTimeString("default", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date) => void
}

function DayView({ date, events, onEventClick, onDateClick }: DayViewProps) {
  const dayEvents = getEventsForDate(date, events)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSlotTouchStart = (hour: number) => {
    if (!onDateClick) return
    longPressTimer.current = setTimeout(() => {
      const clickDate = new Date(date)
      clickDate.setHours(hour, 0, 0, 0)
      onDateClick(clickDate)
    }, 500)
  }

  const handleSlotTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div role="list" className="flex-1 overflow-auto">
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter((event) => {
            if (event.allDay) return hour === 0
            const eventHour = event.start.getHours()
            return eventHour === hour
          })

          return (
            <div key={hour} role="listitem" className="flex border-b min-h-[60px]">
              <div className="w-20 p-2 text-sm text-muted-foreground border-r">
                {hour === 0
                  ? "12 AM"
                  : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                  ? "12 PM"
                  : `${hour - 12} PM`}
              </div>
              <div
                className="flex-1 p-2 space-y-2"
                onTouchStart={() => handleSlotTouchStart(hour)}
                onTouchEnd={handleSlotTouchEnd}
              >
                {hourEvents.map((event) => (
                  <div
                    key={event.id}
                    title={event.title}
                    aria-label={event.title}
                    className={cn(
                      "px-2 sm:px-3 py-1.5 sm:py-2 rounded cursor-pointer hover:opacity-80",
                      event.color?.startsWith("#") ? "text-white" : (event.color || DEFAULT_EVENT_COLOR)
                    )}
                    style={
                      event.color && event.color.startsWith("#")
                        ? { backgroundColor: event.color }
                        : undefined
                    }
                    onClick={() => onEventClick?.(event)}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    {!event.allDay && (
                      <div className="text-xs opacity-90 mt-1">
                        {event.start.toLocaleTimeString("default", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {event.end &&
                          ` - ${event.end.toLocaleTimeString("default", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { CalendarView }
