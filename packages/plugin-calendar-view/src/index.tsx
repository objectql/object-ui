/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@object-ui/components"

const DEFAULT_EVENT_COLOR = "bg-blue-500 text-white"

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
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date) => void
  onViewChange?: (view: "month" | "week" | "day") => void
  onNavigate?: (date: Date) => void
  className?: string
}

function CalendarView({
  events = [],
  view = "month",
  currentDate = new Date(),
  onEventClick,
  onDateClick,
  onViewChange,
  onNavigate,
  className,
}: CalendarViewProps) {
  const [selectedView, setSelectedView] = React.useState(view)
  const [selectedDate, setSelectedDate] = React.useState(currentDate)

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
      return selectedDate.toLocaleDateString("default", {
        month: "long",
        year: "numeric",
      })
    } else if (selectedView === "week") {
      const weekStart = getWeekStart(selectedDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      return `${weekStart.toLocaleDateString("default", {
        month: "short",
        day: "numeric",
      })} - ${weekEnd.toLocaleDateString("default", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    } else {
      return selectedDate.toLocaleDateString("default", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="h-8 w-8"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold ml-2">{getDateLabel()}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedView} onValueChange={handleViewChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {selectedView === "month" && (
          <MonthView
            date={selectedDate}
            events={events}
            onEventClick={onEventClick}
            onDateClick={onDateClick}
          />
        )}
        {selectedView === "week" && (
          <WeekView
            date={selectedDate}
            events={events}
            onEventClick={onEventClick}
            onDateClick={onDateClick}
          />
        )}
        {selectedView === "day" && (
          <DayView
            date={selectedDate}
            events={events}
            onEventClick={onEventClick}
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
  return new Date(d.setDate(diff))
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
    const prevDate = new Date(firstDay)
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
    const nextDate = new Date(lastDay)
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
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date) => void
}

function MonthView({ date, events, onEventClick, onDateClick }: MonthViewProps) {
  const days = getMonthDays(date)
  const today = new Date()
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="flex flex-col h-full">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day, events)
          const isCurrentMonth = day.getMonth() === date.getMonth()
          const isToday = isSameDay(day, today)

          return (
            <div
              key={index}
              className={cn(
                "border-b border-r last:border-r-0 p-2 min-h-[100px] cursor-pointer hover:bg-accent/50",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground"
              )}
              onClick={() => onDateClick?.(day)}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-1",
                  isToday &&
                    "inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground h-6 w-6"
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "text-xs px-2 py-1 rounded truncate cursor-pointer hover:opacity-80",
                      event.color || DEFAULT_EVENT_COLOR
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
                    +{dayEvents.length - 3} more
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
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date) => void
}

function WeekView({ date, events, onEventClick, onDateClick }: WeekViewProps) {
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
                {day.toLocaleDateString("default", { weekday: "short" })}
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
      <div className="grid grid-cols-7 flex-1">
        {weekDays.map((day) => {
          const dayEvents = getEventsForDate(day, events)
          return (
            <div
              key={day.toISOString()}
              className="border-r last:border-r-0 p-2 min-h-[400px] cursor-pointer hover:bg-accent/50"
              onClick={() => onDateClick?.(day)}
            >
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "text-sm px-3 py-2 rounded cursor-pointer hover:opacity-80",
                      event.color || DEFAULT_EVENT_COLOR
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
                    <div className="font-medium">{event.title}</div>
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
}

function DayView({ date, events, onEventClick }: DayViewProps) {
  const dayEvents = getEventsForDate(date, events)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter((event) => {
            if (event.allDay) return hour === 0
            const eventHour = event.start.getHours()
            return eventHour === hour
          })

          return (
            <div key={hour} className="flex border-b min-h-[60px]">
              <div className="w-20 p-2 text-sm text-muted-foreground border-r">
                {hour === 0
                  ? "12 AM"
                  : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                  ? "12 PM"
                  : `${hour - 12} PM`}
              </div>
              <div className="flex-1 p-2 space-y-2">
                {hourEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "px-3 py-2 rounded cursor-pointer hover:opacity-80",
                      event.color || DEFAULT_EVENT_COLOR
                    )}
                    style={
                      event.color && event.color.startsWith("#")
                        ? { backgroundColor: event.color }
                        : undefined
                    }
                    onClick={() => onEventClick?.(event)}
                  >
                    <div className="font-medium">{event.title}</div>
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

// Export renderer to register the component with ObjectUI
export * from './renderer';
