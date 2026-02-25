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
import { ObjectMap } from './ObjectMap';
import type { ObjectMapProps } from './ObjectMap';

export { ObjectMap };
export type { ObjectMapProps };

// Register component
export const ObjectMapRenderer: React.FC<any> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  return <ObjectMap schema={schema} dataSource={dataSource} {...props} />;
};

console.log('Registering object-map...');
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
