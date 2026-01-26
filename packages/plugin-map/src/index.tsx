/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectMap } from './ObjectMap';
import type { ObjectMapProps } from './ObjectMap';

export { ObjectMap };
export type { ObjectMapProps };

// Register component
const ObjectMapRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectMap schema={schema} dataSource={null as any} />;
};

ComponentRegistry.register('object-map', ObjectMapRenderer, {
  label: 'Object Map',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'map', type: 'object', label: 'Map Config', description: 'latitudeField, longitudeField, titleField' },
  ],
});
