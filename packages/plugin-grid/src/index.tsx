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
import { ObjectGrid } from './ObjectGrid';
import { VirtualGrid } from './VirtualGrid';

export { ObjectGrid, VirtualGrid };
export type { ObjectGridProps } from './ObjectGrid';
export type { VirtualGridProps, VirtualGridColumn } from './VirtualGrid';

// Register object-grid component
const ObjectGridRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  return <ObjectGrid schema={schema} dataSource={dataSource} {...props} />;
};

ComponentRegistry.register('object-grid', ObjectGridRenderer, {
  namespace: 'plugin-grid',
  label: 'Object Grid',
  category: 'plugin'
});

// Alias for view namespace - this allows using { type: 'view:grid' } in schemas
// which is semantically meaningful for data display components
ComponentRegistry.register('grid', ObjectGridRenderer, {
  namespace: 'view',
  label: 'Data Grid',
  category: 'view'
});

// Note: 'grid' type is handled by @object-ui/components Grid layout component
// This plugin only handles 'object-grid' which integrates with ObjectQL/ObjectStack
