/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import {
  ElementDataSourceGate,
  useSchemaContext,
  type ElementDataSourceMapping,
} from '@object-ui/react';
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

/**
 * What `ObjectCalendar` reads for its own query: `objectName`, `filter` and
 * `sort` (`ObjectCalendar.tsx` — `$filter: schema.filter`,
 * `$orderby: convertSortToQueryParams(schema.sort)`).
 *
 * `columns` and a row cap are not mapped: a calendar projects the fields its
 * `calendar` config names (start/end/title/color), and it fetches the whole
 * window rather than a capped page, so neither key has a read site to write to.
 */
const OBJECT_CALENDAR_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
  sort: true,
};

// Register object-calendar component
export const ObjectCalendarRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  // The spec's `PageComponentSchema.dataSource` binding (objectstack#6953): a
  // calendar authored with the binding and no `objectName` never fetched, and
  // rendered an empty month with no error.
  return (
    <ElementDataSourceGate
      schema={schema}
      mapping={OBJECT_CALENDAR_DATA_SOURCE}
      dataSource={dataSource}
      testId="object-calendar"
      errorTitle="This calendar’s data source could not be resolved"
    >
      {(bound) => <ObjectCalendar schema={bound} dataSource={dataSource} {...props} />}
    </ElementDataSourceGate>
  );
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
