/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectGrid } from './ObjectGrid';

export { ObjectGrid };
export type { ObjectGridProps } from './ObjectGrid';

// Register object-grid component
const ObjectGridRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectGrid schema={schema} dataSource={null as any} />;
};

ComponentRegistry.register('object-grid', ObjectGridRenderer);
ComponentRegistry.register('grid', ObjectGridRenderer); // Alias
