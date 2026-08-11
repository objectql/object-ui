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
import { ObjectMap } from './ObjectMap';
import type { ObjectMapProps } from './ObjectMap';

export { ObjectMap };
export type { ObjectMapProps };

/**
 * What `ObjectMap` reads for its own query: `objectName` (via `getDataConfig`),
 * `filter` and `sort` (`ObjectMap.tsx` — `$filter: schema.filter`,
 * `$orderby: convertSortToQueryParams(schema.sort)`).
 *
 * No `columns` and no row cap are mapped: a map projects the fields its `map`
 * config names (latitude/longitude/title/description) and its fetch issues no
 * `$top`, so neither key has a read site to write to.
 *
 * `filter` here means the query filter and nothing else. `getMapConfig` used to
 * ALSO accept the map's own configuration stashed under `schema.filter.map` (a
 * shape predating the `map` input); that read is gone as of objectui#4034 —
 * the map config is read from the declared `map` input only, and a schema still
 * carrying the legacy stash gets a dev-mode warning instead of silently losing
 * its markers. Nothing here ever relied on it.
 */
const OBJECT_MAP_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
  sort: true,
};

// Register component
export const ObjectMapRenderer: React.FC<any> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  // The spec's `PageComponentSchema.dataSource` binding (objectstack#7121): a map
  // authored with the binding and no flat `objectName` got a null data config, so
  // it rendered an empty map — no markers, no request, no diagnostic.
  return (
    <ElementDataSourceGate
      schema={schema}
      mapping={OBJECT_MAP_DATA_SOURCE}
      dataSource={dataSource}
      testId="object-map"
      errorTitle="This map’s data source could not be resolved"
    >
      {(bound) => <ObjectMap schema={bound} dataSource={dataSource} {...props} />}
    </ElementDataSourceGate>
  );
};

ComponentRegistry.register('object-map', ObjectMapRenderer, {
  namespace: 'plugin-map',
  label: 'Object Map',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'map', type: 'object', label: 'Map Config', description: 'latitudeField, longitudeField, titleField' },
  ],
});

ComponentRegistry.register('map', ObjectMapRenderer, {
  namespace: 'view',
  label: 'Map View',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'map', type: 'object', label: 'Map Config', description: 'latitudeField, longitudeField, titleField' },
  ],
});
