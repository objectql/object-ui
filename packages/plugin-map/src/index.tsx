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
 * One caveat that belongs next to `filter: true` rather than in a changelog:
 * `getMapConfig` ALSO accepts the map's own configuration stashed under
 * `schema.filter.map` (a legacy shape predating the `map` input). A binding whose
 * filter actually composes replaces that object with an AND node, so the legacy
 * stash stops being found — authoring the map config under `map` (the declared
 * input) is the supported spelling and the only one the binding is compatible
 * with. Filed separately as the overload it is; nothing here relies on it, and a
 * schema with no composing filter passes `schema.filter` through untouched.
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
