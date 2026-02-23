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
import { AppCreationWizard } from './AppCreationWizard';
import { NavigationDesigner } from './NavigationDesigner';
import { EditorModeToggle } from './EditorModeToggle';
import { DashboardEditor } from './DashboardEditor';
import { PageCanvasEditor } from './PageCanvasEditor';
import { ObjectViewConfigurator } from './ObjectViewConfigurator';
import { BrandingEditor } from './BrandingEditor';

export {
  PageDesigner,
  DataModelDesigner,
  ProcessDesigner,
  ReportDesigner,
  CollaborationProvider,
  ConnectionStatusIndicator,
  ViewDesigner,
  AppCreationWizard,
  NavigationDesigner,
  EditorModeToggle,
  DashboardEditor,
  PageCanvasEditor,
  ObjectViewConfigurator,
  BrandingEditor,
};

export type { ViewDesignerProps, ViewDesignerConfig } from './ViewDesigner';
export type { AppCreationWizardProps } from './AppCreationWizard';
export type { NavigationDesignerProps } from './NavigationDesigner';
export type { EditorModeToggleProps } from './EditorModeToggle';
export type { DashboardEditorProps } from './DashboardEditor';
export type { PageCanvasEditorProps, CanvasComponent } from './PageCanvasEditor';
export type { ObjectViewConfiguratorProps, ViewConfig, ViewColumn, ViewType } from './ObjectViewConfigurator';
export type { BrandingEditorProps } from './BrandingEditor';

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

// Register app creation wizard component
ComponentRegistry.register(
  'app-creation-wizard',
  AppCreationWizard,
  {
    label: 'App Creation Wizard',
    category: 'Designer',
    inputs: [
      { name: 'availableObjects', type: 'code', label: 'Available Objects' },
      { name: 'templates', type: 'code', label: 'Templates' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register navigation designer component
ComponentRegistry.register(
  'navigation-designer',
  NavigationDesigner,
  {
    label: 'Navigation Designer',
    category: 'Designer',
    inputs: [
      { name: 'items', type: 'code', label: 'Navigation Items' },
      { name: 'showPreview', type: 'boolean', label: 'Show Preview', defaultValue: true },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register dashboard editor component
ComponentRegistry.register(
  'dashboard-editor',
  DashboardEditor,
  {
    label: 'Dashboard Editor',
    category: 'Designer',
    inputs: [
      { name: 'schema', type: 'code', label: 'Dashboard Schema' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register page canvas editor component
ComponentRegistry.register(
  'page-canvas-editor',
  PageCanvasEditor,
  {
    label: 'Page Canvas Editor',
    category: 'Designer',
    inputs: [
      { name: 'schema', type: 'code', label: 'Page Schema' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register object view configurator component
ComponentRegistry.register(
  'object-view-configurator',
  ObjectViewConfigurator,
  {
    label: 'Object View Configurator',
    category: 'Designer',
    inputs: [
      { name: 'config', type: 'code', label: 'View Config' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);

// Register branding editor component
ComponentRegistry.register(
  'branding-editor',
  BrandingEditor,
  {
    label: 'Branding Editor',
    category: 'Designer',
    inputs: [
      { name: 'branding', type: 'code', label: 'Branding Config' },
      { name: 'appTitle', type: 'string', label: 'App Title' },
      { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
    ],
  }
);
