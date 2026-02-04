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
import { ObjectGantt } from './ObjectGantt';
import type { ObjectGanttProps } from './ObjectGantt';

export { ObjectGantt };
export type { ObjectGanttProps };

export { GanttView } from './GanttView';
export type { GanttViewProps, GanttTask, GanttViewMode } from './GanttView';

// Register component
export const ObjectGanttRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  const { dataSource } = useSchemaContext();
  return <ObjectGantt schema={schema} dataSource={dataSource} />;
};

ComponentRegistry.register('object-gantt', ObjectGanttRenderer, {
  namespace: 'plugin-gantt',
  label: 'Object Gantt',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'gantt', type: 'object', label: 'Gantt Config', description: 'startDateField, endDateField, titleField, progressField, percentageField, colorField, dependenciesField' },
  ],
});
