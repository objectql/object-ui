/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/plugin-object
 * 
 * ObjectQL plugin for Object UI.
 * Provides seamless integration with ObjectQL backends through smart components
 * that automatically generate UI from ObjectQL object schemas.
 * 
 * @packageDocumentation
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';

export { ObjectTable } from './ObjectTable';
export type { ObjectTableProps } from './ObjectTable';

export { ObjectGrid } from './ObjectGrid';
export type { ObjectGridProps } from './ObjectGrid';

export { ObjectForm } from './ObjectForm';
export type { ObjectFormProps } from './ObjectForm';

export { ObjectView } from './ObjectView';
export type { ObjectViewProps } from './ObjectView';

// Export field renderers for customization
export {
  getCellRenderer,
  TextCellRenderer,
  NumberCellRenderer,
  CurrencyCellRenderer,
  PercentCellRenderer,
  BooleanCellRenderer,
  DateCellRenderer,
  DateTimeCellRenderer,
  SelectCellRenderer,
  EmailCellRenderer,
  UrlCellRenderer,
  PhoneCellRenderer,
  FileCellRenderer,
  ImageCellRenderer,
  LookupCellRenderer,
  FormulaCellRenderer,
  UserCellRenderer,
} from './field-renderers';
export type { CellRendererProps } from './field-renderers';

// Re-export related types from @object-ui/types
export type {
  ObjectTableSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ObjectQLComponentSchema,
} from '@object-ui/types';

// Import components for registration
import { ObjectTable } from './ObjectTable';
import { ObjectForm } from './ObjectForm';
import { ObjectView } from './ObjectView';

// Create renderer wrappers for ComponentRegistry
const ObjectTableRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  // For now, render without dataSource since it requires ObjectQL setup
  // This allows the component to at least render in documentation
  return <ObjectTable schema={schema} dataSource={null as any} />;
};

const ObjectFormRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectForm schema={schema} dataSource={null as any} />;
};

const ObjectViewRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectView schema={schema} dataSource={null as any} />;
};

// Register components with ComponentRegistry
ComponentRegistry.register('object-table', ObjectTableRenderer, {
  label: 'Object Table',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'columns', type: 'array', label: 'Columns' },
    { name: 'searchable', type: 'boolean', label: 'Searchable', defaultValue: true },
    { name: 'selectable', type: 'boolean', label: 'Selectable', defaultValue: false },
  ],
});

ComponentRegistry.register('object-form', ObjectFormRenderer, {
  label: 'Object Form',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'mode', type: 'enum', label: 'Mode', enum: ['create', 'edit'], defaultValue: 'create' },
  ],
});

ComponentRegistry.register('object-view', ObjectViewRenderer, {
  label: 'Object View',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'layout', type: 'enum', label: 'Layout', enum: ['vertical', 'horizontal'], defaultValue: 'vertical' },
  ],
});

// Export for manual use
export const objectComponents = {
  'object-table': ObjectTableRenderer,
  'object-form': ObjectFormRenderer,
  'object-view': ObjectViewRenderer,
};
