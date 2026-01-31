/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectGantt } from './ObjectGantt';
import type { ObjectGanttProps } from './ObjectGantt';

export { ObjectGantt };
export type { ObjectGanttProps };

// Register component
const ObjectGanttRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectGantt schema={schema} dataSource={null as any} />;
};

ComponentRegistry.register('object-gantt', ObjectGanttRenderer, {
  namespace: 'plugin-gantt',
  label: 'Object Gantt',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'gantt', type: 'object', label: 'Gantt Config', description: 'startDateField, endDateField, titleField, progressField, dependenciesField' },
  ],
});
