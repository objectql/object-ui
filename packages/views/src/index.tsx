/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/views
 * 
 * Core Object UI views package.
 * Provides seamless integration with ObjectQL backends through smart components
 * that automatically generate UI from ObjectQL object schemas.
 * 
 * @packageDocumentation
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';

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
  ObjectGridSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ObjectQLComponentSchema,
} from '@object-ui/types';

// Import components for registration
import { ObjectGrid } from './ObjectGrid';
import { ObjectForm } from './ObjectForm';
import { ObjectView } from './ObjectView';

// Create renderer wrappers for ComponentRegistry
const ObjectGridRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  // Check if schema has inline data (staticData or data.items)
  const hasInlineData = schema.staticData || (schema.data?.provider === 'value' && schema.data?.items);
  
  // If no inline data and no dataSource will be provided, show placeholder
  if (!hasInlineData) {
    return (
      <div className="p-4 border border-amber-300 bg-amber-50 rounded-md">
        <p className="text-amber-800 text-sm">
          ObjectGrid requires either <code className="bg-amber-100 px-1 rounded">staticData</code> or a configured dataSource
        </p>
      </div>
    );
  }
  
  // For documentation with inline data, render without dataSource
  return <ObjectGrid schema={schema} dataSource={null as any} />;
};

const ObjectFormRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  // Check if schema has inline data
  const hasInlineData = schema.staticData || (schema.data?.provider === 'value' && schema.data?.items);
  
  // If no inline data and no dataSource will be provided, show placeholder
  if (!hasInlineData) {
    return (
      <div className="p-4 border border-amber-300 bg-amber-50 rounded-md">
        <p className="text-amber-800 text-sm">
          ObjectForm requires either <code className="bg-amber-100 px-1 rounded">staticData</code> or a configured dataSource
        </p>
      </div>
    );
  }
  
  return <ObjectForm schema={schema} dataSource={null as any} />;
};

const ObjectViewRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  // Check if schema has inline data
  const hasInlineData = schema.staticData || (schema.data?.provider === 'value' && schema.data?.items);
  
  // If no inline data and no dataSource will be provided, show placeholder
  if (!hasInlineData) {
    return (
      <div className="p-4 border border-amber-300 bg-amber-50 rounded-md">
        <p className="text-amber-800 text-sm">
          ObjectView requires either <code className="bg-amber-100 px-1 rounded">staticData</code> or a configured dataSource
        </p>
      </div>
    );
  }
  
  return <ObjectView schema={schema} dataSource={null as any} />;
};

// Register components with ComponentRegistry
ComponentRegistry.register('object-grid', ObjectGridRenderer, {
  label: 'Object Grid',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'columns', type: 'array', label: 'Columns' },
    { name: 'searchable', type: 'boolean', label: 'Searchable', defaultValue: true },
    { name: 'selectable', type: 'boolean', label: 'Selectable', defaultValue: false },
    { name: 'editable', type: 'boolean', label: 'Editable (Grid Mode)', defaultValue: false },
    { name: 'keyboardNavigation', type: 'boolean', label: 'Keyboard Navigation', defaultValue: true },
    { name: 'frozenColumns', type: 'number', label: 'Frozen Columns', defaultValue: 0 },
    { name: 'resizableColumns', type: 'boolean', label: 'Resizable Columns', defaultValue: false },
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
  'object-grid': ObjectGridRenderer,
  'object-form': ObjectFormRenderer,
  'object-view': ObjectViewRenderer,
};
