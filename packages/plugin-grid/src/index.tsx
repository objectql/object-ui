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
import { ImportWizard } from './ImportWizard';

export { ObjectGrid, VirtualGrid, ImportWizard };
export { InlineEditing } from './InlineEditing';
export { useRowColor } from './useRowColor';
export { useGroupedData } from './useGroupedData';
export { GroupRow } from './GroupRow';
export { RowActionMenu, formatActionLabel } from './components/RowActionMenu';
export { BulkActionBar } from './components/BulkActionBar';
export { useCellClipboard } from './useCellClipboard';
export { useGradientColor } from './useGradientColor';
export { useGroupReorder } from './useGroupReorder';
export { useColumnSummary } from './useColumnSummary';
export { FormulaBar } from './FormulaBar';
export { SplitPaneGrid } from './SplitPaneGrid';
export type { ObjectGridProps } from './ObjectGrid';
export type { VirtualGridProps, VirtualGridColumn } from './VirtualGrid';
export type { InlineEditingProps } from './InlineEditing';
export type { ImportWizardProps, ImportResult } from './ImportWizard';
export type { GroupEntry, UseGroupedDataResult, AggregationType, AggregationConfig, AggregationResult } from './useGroupedData';
export type { GroupRowProps } from './GroupRow';
export type { RowActionMenuProps } from './components/RowActionMenu';
export type { BulkActionBarProps } from './components/BulkActionBar';
export type { CellRange, UseCellClipboardOptions, UseCellClipboardResult } from './useCellClipboard';
export type { GradientStop, UseGradientColorOptions } from './useGradientColor';
export type { UseGroupReorderOptions, UseGroupReorderResult } from './useGroupReorder';
export type { ColumnSummaryConfig, ColumnSummaryResult } from './useColumnSummary';
export type { FormulaBarProps } from './FormulaBar';
export type { SplitPaneGridProps } from './SplitPaneGrid';

// Register object-grid component
export const ObjectGridRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  return <ObjectGrid schema={schema} dataSource={dataSource} {...props} />;
};

ComponentRegistry.register('object-grid', ObjectGridRenderer, {
  namespace: 'plugin-grid',
  label: 'Object Grid',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'columns', type: 'array', label: 'Columns' },
    { name: 'filters', type: 'array', label: 'Filters' },
  ]
});

// Alias for view namespace - this allows using { type: 'view:grid' } in schemas
// which is semantically meaningful for data display components
ComponentRegistry.register('grid', ObjectGridRenderer, {
  namespace: 'view',
  label: 'Data Grid',
  category: 'view',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'columns', type: 'array', label: 'Columns' },
    { name: 'filters', type: 'array', label: 'Filters' },
  ]
});

// Register import-wizard component
const ImportWizardRenderer: React.FC<{ schema: any; [key: string]: any }> = ({ schema, ...props }) => {
  const { dataSource } = useSchemaContext() || {};
  return (
    <ImportWizard
      objectName={schema.objectName}
      objectLabel={schema.objectLabel}
      fields={schema.fields ?? []}
      dataSource={dataSource}
      {...props}
    />
  );
};

ComponentRegistry.register('import-wizard', ImportWizardRenderer, {
  namespace: 'plugin-grid',
  label: 'Import Wizard',
  category: 'plugin',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'fields', type: 'array', label: 'Fields', required: true },
  ]
});

// Note: 'grid' type is handled by @object-ui/components Grid layout component
// This plugin only handles 'object-grid' which integrates with ObjectQL/ObjectStack
