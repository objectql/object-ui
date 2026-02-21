/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { PageDesigner } from './PageDesigner';
import { DataModelDesigner } from './DataModelDesigner';
import { ProcessDesigner } from './ProcessDesigner';
import { ReportDesigner } from './ReportDesigner';
import { CollaborationProvider, ConnectionStatusIndicator } from './CollaborationProvider';
import { ViewDesigner } from './ViewDesigner';

export {
  PageDesigner,
  DataModelDesigner,
  ProcessDesigner,
  ReportDesigner,
  CollaborationProvider,
  ConnectionStatusIndicator,
  ViewDesigner,
};

export type { ViewDesignerProps, ViewDesignerConfig } from './ViewDesigner';

// Shared hooks
export { useUndoRedo } from './hooks/useUndoRedo';
export { useDesignerHistory } from './hooks/useDesignerHistory';
export { useConfirmDialog } from './hooks/useConfirmDialog';
export { useClipboard } from './hooks/useClipboard';
export { useMultiSelect } from './hooks/useMultiSelect';
export { useCanvasPanZoom } from './hooks/useCanvasPanZoom';

// Shared components
export { ConfirmDialog } from './components/ConfirmDialog';
export { Minimap } from './components/Minimap';
export { PropertyEditor } from './components/PropertyEditor';
export { VersionHistory } from './components/VersionHistory';

// Register page designer component
ComponentRegistry.register(
  'page-designer',
  PageDesigner,
  {
    label: 'Page Designer',
    category: 'Designer',
    inputs: [
      { name: 'canvas', type: 'code', label: 'Canvas Configuration' },
      { name: 'components', type: 'code', label: 'Components' },
      { name: 'showComponentTree', type: 'boolean', label: 'Show Component Tree', defaultValue: true },
      { name: 'undoRedo', type: 'boolean', label: 'Undo/Redo', defaultValue: true },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register data model designer component
ComponentRegistry.register(
  'data-model-designer',
  DataModelDesigner,
  {
    label: 'Data Model Designer',
    category: 'Designer',
    inputs: [
      { name: 'entities', type: 'code', label: 'Entities' },
      { name: 'relationships', type: 'code', label: 'Relationships' },
      { name: 'autoLayout', type: 'boolean', label: 'Auto Layout', defaultValue: false },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register process designer component
ComponentRegistry.register(
  'process-designer',
  ProcessDesigner,
  {
    label: 'Process Designer (BPMN)',
    category: 'Designer',
    inputs: [
      { name: 'processName', type: 'string', label: 'Process Name' },
      { name: 'nodes', type: 'code', label: 'Nodes' },
      { name: 'edges', type: 'code', label: 'Edges' },
      { name: 'showMinimap', type: 'boolean', label: 'Show Minimap', defaultValue: false },
      { name: 'showToolbar', type: 'boolean', label: 'Show Toolbar', defaultValue: true },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register report designer component
ComponentRegistry.register(
  'report-designer',
  ReportDesigner,
  {
    label: 'Report Designer',
    category: 'Designer',
    inputs: [
      { name: 'reportName', type: 'string', label: 'Report Name' },
      { name: 'objectName', type: 'string', label: 'Data Source Object' },
      { name: 'sections', type: 'code', label: 'Sections' },
      { name: 'showToolbar', type: 'boolean', label: 'Show Toolbar', defaultValue: true },
      { name: 'showPropertyPanel', type: 'boolean', label: 'Show Property Panel', defaultValue: true },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register view designer component
ComponentRegistry.register(
  'view-designer',
  ViewDesigner,
  {
    label: 'View Designer',
    category: 'Designer',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name' },
      { name: 'viewId', type: 'string', label: 'View ID' },
      { name: 'viewLabel', type: 'string', label: 'View Label' },
      { name: 'viewType', type: 'string', label: 'View Type', defaultValue: 'grid' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);
