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
import { ObjectTree } from './ObjectTree';
import type { ObjectTreeProps } from './ObjectTree';

export { ObjectTree };
export type { ObjectTreeProps };

// Renderer wrapper: pulls the dataSource from schema context, mirroring the
// other view plugins (object-map / object-gantt / …).
export const ObjectTreeRenderer: React.FC<any> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  return <ObjectTree schema={schema} dataSource={dataSource} {...props} />;
};

const treeInputs = [
  { name: 'objectName', type: 'string' as const, label: 'Object Name', required: true },
  {
    name: 'tree',
    type: 'object' as const,
    label: 'Tree Config',
    description: 'parentField, labelField, fields, defaultExpandedDepth',
  },
];

ComponentRegistry.register('object-tree', ObjectTreeRenderer, {
  namespace: 'plugin-tree',
  label: 'Object Tree',
  category: 'view',
  inputs: treeInputs,
});

ComponentRegistry.register('tree', ObjectTreeRenderer, {
  namespace: 'view',
  label: 'Tree View',
  category: 'view',
  inputs: treeInputs,
});
