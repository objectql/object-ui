/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useSchemaContext } from '@object-ui/react';
import { ObjectCalendar } from './ObjectCalendar';
import type { ObjectCalendarProps } from './ObjectCalendar';

// Export ObjectCalendar component
export { ObjectCalendar };
export type { ObjectCalendarProps };

// Export CalendarView component (merged from plugin-calendar-view)
export { CalendarView } from './CalendarView';
export type { CalendarViewProps, CalendarEvent } from './CalendarView';

// Import and register calendar-view renderer
import './calendar-view-renderer';

// Register object-calendar component
export const ObjectCalendarRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext();
  return <ObjectCalendar schema={schema} dataSource={dataSource} {...props} />;
};

ComponentRegistry.register('object-calendar', ObjectCalendarRenderer, {
  namespace: 'plugin-calendar',
  label: 'Object Calendar',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'calendar', type: 'object', label: 'Calendar Config', description: 'startDateField, endDateField, titleField, colorField' },
  ],
});

ComponentRegistry.register('calendar', ObjectCalendarRenderer, {
  namespace: 'view',
  label: 'Calendar View',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'calendar', type: 'object', label: 'Calendar Config', description: 'startDateField, endDateField, titleField, colorField' },
  ],
});
