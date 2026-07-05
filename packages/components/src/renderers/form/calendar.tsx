/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { CalendarSchema } from '@object-ui/types';
import { Calendar } from '../../ui';

ComponentRegistry.register('calendar', 
  ({ schema, className, ...props }: { schema: CalendarSchema; className?: string; [key: string]: any }) => (
    <Calendar
      mode={(schema.mode || "single") as any}
      selected={(schema.value || schema.defaultValue) as any}
      className={className}
      {...props}
    />
  ),
  {
    namespace: 'ui',
    // `calendar` collides with the plugin-calendar full CRUD calendar VIEW,
    // which owns the bare `type: 'calendar'` schema keyword; this date-picker
    // primitive is reached via `ui:calendar` only.
    skipFallback: true,
    label: 'Calendar',
    inputs: [
      { name: 'mode', type: 'enum', enum: ['default', 'single', 'multiple', 'range'], defaultValue: 'single', label: 'Mode' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      mode: 'single',
      className: 'rounded-md border'
    }
  }
);
