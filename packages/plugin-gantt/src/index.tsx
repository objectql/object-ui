/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry, elementDataSourceBlock } from '@object-ui/core';
import {
  ElementDataSourceGate,
  useSchemaContext,
  type ElementDataSourceMapping,
} from '@object-ui/react';
import { ObjectGantt } from './ObjectGantt';

export { ObjectGantt };
export type { ObjectGanttProps, QuickFilterDef } from './ObjectGantt';

export { QuickFilterBar } from './QuickFilterBar';
export type {
  QuickFilterBarProps,
  QuickFilterField,
  QuickFilterOption,
  QuickFilterLabels,
} from './QuickFilterBar';

export { GanttView } from './GanttView';
export type {
  GanttViewProps,
  GanttTask,
  GanttTaskType,
  GanttViewMode,
  GanttDependency,
  GanttDependencyObject,
  GanttLinkType,
  GanttMarker,
} from './GanttView';
export { normalizeDependencies, normalizeTaskType } from './ObjectGantt';

export { normalizeShiftSegments, parseHHMM, shiftDayStart, bandAt } from './shifts';
export type {
  ShiftSegmentsConfig,
  ShiftBandConfig,
  NormShiftSegments,
  NormShiftBand,
} from './shifts';

export { ResourceWorkload } from './ResourceWorkload';
export type { ResourceWorkloadProps } from './ResourceWorkload';
export { computeWorkload } from './workload';
export type {
  WorkloadColumn,
  WorkloadOptions,
  ResourceCell,
  ResourceLoad,
} from './workload';

/**
 * What `ObjectGantt` reads for its own query: `objectName` (via `getDataConfig`,
 * which turns it into the `provider: 'object'` config the fetch resolves its
 * `resource` from), `filter` and `sort` (`ObjectGantt.tsx` —
 * `$filter: schema.filter`, `$orderby: convertSortToQueryParams(schema.sort)`).
 *
 * `columns` and a row cap are NOT mapped, because neither has a read site: a
 * gantt projects the fields its `gantt` config names (start/end/title/progress/
 * dependencies/…) rather than a column list, and its reload issues no `$top` at
 * all — it loads the whole bar set and lets `GanttView` window it. Writing a
 * view's field list or page size onto either key would hand the block a value it
 * ignores, which is the defect this wiring removes, one layer deeper.
 *
 * Inline data still wins, unchanged: `getDataConfig` prefers `schema.data` /
 * `schema.staticData` over the object name, so a gantt authored with both a
 * binding and inline rows renders the inline rows exactly as it did before.
 */
const OBJECT_GANTT_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
  sort: true,
};

// Register component
export const ObjectGanttRenderer: React.FC<{ schema: any }> = elementDataSourceBlock(({ schema }) => {
  const { dataSource } = useSchemaContext() || {};
  // The spec's `PageComponentSchema.dataSource` binding (objectstack#7121). A
  // gantt authored with the binding and no flat `objectName` produced no data
  // config at all, so `resolveDataSource` had nothing to fetch through: an empty
  // chart, no request, no diagnostic.
  return (
    <ElementDataSourceGate
      schema={schema}
      mapping={OBJECT_GANTT_DATA_SOURCE}
      dataSource={dataSource}
      testId="object-gantt"
      errorTitle="This gantt chart’s data source could not be resolved"
    >
      {(bound) => <ObjectGantt schema={bound} dataSource={dataSource} />}
    </ElementDataSourceGate>
  );
});

ComponentRegistry.register('object-gantt', ObjectGanttRenderer, {
  namespace: 'plugin-gantt',
  label: 'Object Gantt',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'gantt', type: 'object', label: 'Gantt Config', description: 'startDateField, endDateField, titleField, progressField, percentageField, colorField, dependenciesField' },
  ],
});

ComponentRegistry.register('gantt', ObjectGanttRenderer, {
  namespace: 'view',
  label: 'Gantt View',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'gantt', type: 'object', label: 'Gantt Config', description: 'startDateField, endDateField, titleField, progressField, percentageField, colorField, dependenciesField' },
  ],
});
