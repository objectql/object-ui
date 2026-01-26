/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectCalendar } from './ObjectCalendar';
import type { ObjectCalendarProps } from './ObjectCalendar';

export { ObjectCalendar };
export type { ObjectCalendarProps };

// Register component
const ObjectCalendarRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectCalendar schema={schema} dataSource={null as any} />;
};

ComponentRegistry.register('object-calendar', ObjectCalendarRenderer, {
  label: 'Object Calendar',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'calendar', type: 'object', label: 'Calendar Config', description: 'startDateField, endDateField, titleField, colorField' },
  ],
});
