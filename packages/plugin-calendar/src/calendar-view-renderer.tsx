/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { CalendarViewSchema } from '@object-ui/types';
import { CalendarView, type CalendarEvent } from './CalendarView';
import React from 'react';

// Calendar View Renderer - Airtable-style calendar for displaying records as events
ComponentRegistry.register('calendar-view', 
  ({ schema, className, onAction, ...props }: { schema: CalendarViewSchema; className?: string; onAction?: (action: any) => void; [key: string]: any }) => {
    // Transform schema data to CalendarEvent format
    const events = React.useMemo(() => {
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
        
        return {
          id: record._id || record.id || index,
          title: record[titleField] || 'Untitled Event',
          start: new Date(record[startField]),
          end: record[endField] ? new Date(record[endField]) : undefined,
          allDay: record[allDayField],
          color: record[colorField],
          data: record,
        };
      });
    }, [schema.data, schema.titleField, schema.startDateField, schema.endDateField, schema.colorField, schema.allDayField]);

    const handleEventClick = (event: CalendarEvent) => {
      onAction?.({ 
        type: 'event-click',
        payload: event 
      });
    };
    
    const handleAddClick = () => {
       // Standard "Create" action trigger
       onAction?.({
         type: 'create',
         payload: {}
       });
    };

    return (
      <CalendarView 
        className={className}
        events={events}
        onEventClick={handleEventClick}
        onAddClick={handleAddClick}
        // Pass validation or other props
        {...props}
      />
    );
  }
,
  {
    namespace: 'plugin-calendar',
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
