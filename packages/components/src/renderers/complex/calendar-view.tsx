import { ComponentRegistry } from '@object-ui/core';
import { CalendarView, type CalendarEvent } from '@/ui';
import React from 'react';

// Calendar View Renderer - Airtable-style calendar for displaying records as events
ComponentRegistry.register('calendar-view', 
  ({ schema, className, onAction, ...props }) => {
    // Transform schema data to CalendarEvent format
    const events: CalendarEvent[] = React.useMemo(() => {
      if (!schema.data || !Array.isArray(schema.data)) return [];
      
      return schema.data.map((record: any, index: number) => {
        /** Field name to use for event title display */
        const titleField = schema.titleField || 'title';
        /** Field name containing the event start date/time */
        const startField = schema.startDateField || 'start';
        /** Field name containing the event end date/time (optional) */
        const endField = schema.endDateField || 'end';
        /** Field name to determine event color or color category */
        const colorField = schema.colorField || 'color';
        /** Field name indicating if event is all-day */
        const allDayField = schema.allDayField || 'allDay';
        
        const title = record[titleField] || 'Untitled';
        const start = record[startField] ? new Date(record[startField]) : new Date();
        const end = record[endField] ? new Date(record[endField]) : undefined;
        const allDay = record[allDayField] !== undefined ? record[allDayField] : false;
        
        // Handle color mapping
        let color = record[colorField];
        if (color && schema.colorMapping && schema.colorMapping[color]) {
          color = schema.colorMapping[color];
        }
        
        return {
          id: record.id || record._id || index,
          title,
          start,
          end,
          allDay,
          color,
          data: record,
        };
      });
    }, [schema.data, schema.titleField, schema.startDateField, schema.endDateField, schema.colorField, schema.allDayField, schema.colorMapping]);

    const handleEventClick = React.useCallback((event: CalendarEvent) => {
      if (onAction) {
        onAction({
          type: 'event_click',
          payload: { event: event.data, eventId: event.id }
        });
      }
      if (schema.onEventClick) {
        schema.onEventClick(event.data);
      }
    }, [onAction, schema]);

    const handleDateClick = React.useCallback((date: Date) => {
      if (onAction) {
        onAction({
          type: 'date_click',
          payload: { date }
        });
      }
      if (schema.onDateClick) {
        schema.onDateClick(date);
      }
    }, [onAction, schema]);

    const handleViewChange = React.useCallback((view: "month" | "week" | "day") => {
      if (onAction) {
        onAction({
          type: 'view_change',
          payload: { view }
        });
      }
      if (schema.onViewChange) {
        schema.onViewChange(view);
      }
    }, [onAction, schema]);

    const handleNavigate = React.useCallback((date: Date) => {
      if (onAction) {
        onAction({
          type: 'navigate',
          payload: { date }
        });
      }
      if (schema.onNavigate) {
        schema.onNavigate(date);
      }
    }, [onAction, schema]);

    return (
      <CalendarView
        events={events}
        view={schema.view || 'month'}
        currentDate={schema.currentDate ? new Date(schema.currentDate) : undefined}
        onEventClick={handleEventClick}
        onDateClick={schema.allowCreate || schema.onDateClick ? handleDateClick : undefined}
        onViewChange={handleViewChange}
        onNavigate={handleNavigate}
        className={className}
        {...props}
      />
    );
  },
  {
    label: 'Calendar View',
    inputs: [
      { 
        name: 'data', 
        type: 'array', 
        label: 'Data',
        description: 'Array of record objects to display as events'
      },
      { 
        name: 'titleField', 
        type: 'string', 
        label: 'Title Field',
        defaultValue: 'title',
        description: 'Field name to use for event title'
      },
      { 
        name: 'startDateField', 
        type: 'string', 
        label: 'Start Date Field',
        defaultValue: 'start',
        description: 'Field name for event start date'
      },
      { 
        name: 'endDateField', 
        type: 'string', 
        label: 'End Date Field',
        defaultValue: 'end',
        description: 'Field name for event end date (optional)'
      },
      { 
        name: 'allDayField', 
        type: 'string', 
        label: 'All Day Field',
        defaultValue: 'allDay',
        description: 'Field name for all-day flag'
      },
      { 
        name: 'colorField', 
        type: 'string', 
        label: 'Color Field',
        defaultValue: 'color',
        description: 'Field name for event color'
      },
      {
        name: 'colorMapping',
        type: 'object',
        label: 'Color Mapping',
        description: 'Map field values to colors (e.g., {meeting: "blue", deadline: "red"})'
      },
      { 
        name: 'view', 
        type: 'enum', 
        enum: ['month', 'week', 'day'], 
        defaultValue: 'month', 
        label: 'View Mode',
        description: 'Calendar view mode (month, week, or day)'
      },
      {
        name: 'currentDate',
        type: 'string',
        label: 'Current Date',
        description: 'ISO date string for initial calendar date'
      },
      { 
        name: 'allowCreate', 
        type: 'boolean', 
        label: 'Allow Create',
        defaultValue: false,
        description: 'Allow creating events by clicking on dates'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      view: 'month',
      titleField: 'title',
      startDateField: 'start',
      endDateField: 'end',
      allDayField: 'allDay',
      colorField: 'color',
      allowCreate: false,
      data: [
        {
          id: 1,
          title: 'Team Meeting',
          start: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
          end: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
          color: '#3b82f6',
          allDay: false
        },
        {
          id: 2,
          title: 'Project Deadline',
          start: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(),
          color: '#ef4444',
          allDay: true
        },
        {
          id: 3,
          title: 'Conference',
          start: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
          end: new Date(new Date().setDate(new Date().getDate() + 9)).toISOString(),
          color: '#10b981',
          allDay: true
        }
      ],
      className: 'h-[600px] border rounded-lg'
    }
  }
);
