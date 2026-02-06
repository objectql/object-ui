/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectForm } from './ObjectForm';

export { ObjectForm };
export type { ObjectFormProps } from './ObjectForm';

// Register object-form component
const ObjectFormRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectForm schema={schema} />;
};

ComponentRegistry.register('object-form', ObjectFormRenderer, {
  namespace: 'plugin-form',
  label: 'Object Form',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'mode', type: 'enum', label: 'Mode', enum: ['create', 'edit', 'view'] },
  ]
});

// Note: 'form' type is handled by @object-ui/components Form component
// This plugin only handles 'object-form' which integrates with ObjectQL/ObjectStack
// Do NOT register as 'form' - that would conflict with the low-level Form renderer
