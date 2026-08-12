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
import { AppCreationWizard } from './AppCreationWizard';
import { NavigationDesigner } from './NavigationDesigner';
import { EditorModeToggle } from './EditorModeToggle';
import { DashboardEditor } from './DashboardEditor';
import { BrandingEditor } from './BrandingEditor';
import { ObjectManager } from './ObjectManager';
import { FieldDesigner } from './FieldDesigner';

export {
  PageDesigner,
  DataModelDesigner,
  ProcessDesigner,
  ReportDesigner,
  CollaborationProvider,
  ConnectionStatusIndicator,
  AppCreationWizard,
  NavigationDesigner,
  EditorModeToggle,
  DashboardEditor,
  BrandingEditor,
  ObjectManager,
  FieldDesigner,
};

export type { AppCreationWizardProps } from './AppCreationWizard';
export type { NavigationDesignerProps } from './NavigationDesigner';
export type { EditorModeToggleProps } from './EditorModeToggle';
export type { DashboardEditorProps } from './DashboardEditor';
export type { BrandingEditorProps } from './BrandingEditor';
export type { ObjectManagerProps } from './ObjectManager';
export type { FieldDesignerProps } from './FieldDesigner';

// Shared hooks
export { useUndoRedo } from './hooks/useUndoRedo';
export { useDesignerHistory } from './hooks/useDesignerHistory';
export { useConfirmDialog } from './hooks/useConfirmDialog';
export { useClipboard } from './hooks/useClipboard';
export { useMultiSelect } from './hooks/useMultiSelect';
export { useCanvasPanZoom } from './hooks/useCanvasPanZoom';
// The provider-less fallback table, exported so objectui#4401's mirror gate can
// compare it against the `en` pack from a package that depends on both.
export { DESIGNER_DEFAULT_TRANSLATIONS } from './hooks/useDesignerTranslation';

// Shared components
export { ConfirmDialog } from './components/ConfirmDialog';
export { Minimap } from './components/Minimap';
export { PropertyEditor } from './components/PropertyEditor';
export { VersionHistory } from './components/VersionHistory';

// Route-ready app authoring pages — host apps mount these at their
// preferred routes. Each page expects an active app/adapter context from
// @object-ui/app-shell and uses react-router-dom hooks
// (useParams/useNavigate) for navigation.
export { CreateAppPage } from './pages/CreateAppPage';
export { EditAppPage } from './pages/EditAppPage';
export { DashboardDesignPage } from './pages/DashboardDesignPage';

// Metadata management pages (Setup-app "Data Model" group). These talk
// directly to the metadata REST API (`/api/v1/meta/*`) via
// `MetadataClient` from `@object-ui/data-objectstack`, and do not require
// an app/adapter context. They are the visual counterpart of the
// `sys_metadata` object's `only_objects` / `only_fields` list views.
export { MetadataObjectsPage } from './MetadataObjectsPage';
export type { MetadataObjectsPageProps } from './MetadataObjectsPage';
export { MetadataFieldsPage } from './MetadataFieldsPage';
export type { MetadataFieldsPageProps } from './MetadataFieldsPage';

ComponentRegistry.register('page-designer', PageDesigner, {
  namespace: 'plugin-designer',
  label: 'Page Designer',
  category: 'Designer',
  inputs: [
    { name: 'canvas', type: 'code', label: 'Canvas Configuration' },
    { name: 'components', type: 'code', label: 'Components' },
    { name: 'showComponentTree', type: 'boolean', label: 'Show Component Tree', defaultValue: true },
    { name: 'undoRedo', type: 'boolean', label: 'Undo/Redo', defaultValue: true },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});

ComponentRegistry.register('data-model-designer', DataModelDesigner, {
  namespace: 'plugin-designer',
  label: 'Data Model Designer',
  category: 'Designer',
  inputs: [
    { name: 'entities', type: 'code', label: 'Entities' },
    { name: 'relationships', type: 'code', label: 'Relationships' },
    { name: 'autoLayout', type: 'boolean', label: 'Auto Layout', defaultValue: false },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});

ComponentRegistry.register('process-designer', ProcessDesigner, {
  namespace: 'plugin-designer',
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
});

ComponentRegistry.register('report-designer', ReportDesigner, {
  namespace: 'plugin-designer',
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
});

ComponentRegistry.register('app-creation-wizard', AppCreationWizard, {
  namespace: 'plugin-designer',
  label: 'App Creation Wizard',
  category: 'Designer',
  inputs: [
    { name: 'availableObjects', type: 'code', label: 'Available Objects' },
    { name: 'templates', type: 'code', label: 'Templates' },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});

ComponentRegistry.register('navigation-designer', NavigationDesigner, {
  namespace: 'plugin-designer',
  label: 'Navigation Designer',
  category: 'Designer',
  inputs: [
    { name: 'items', type: 'code', label: 'Navigation Items' },
    { name: 'showPreview', type: 'boolean', label: 'Show Preview', defaultValue: true },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});

ComponentRegistry.register('dashboard-editor', DashboardEditor, {
  namespace: 'plugin-designer',
  label: 'Dashboard Editor',
  category: 'Designer',
  inputs: [
    { name: 'schema', type: 'code', label: 'Dashboard Schema' },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});

ComponentRegistry.register('branding-editor', BrandingEditor, {
  namespace: 'plugin-designer',
  label: 'Branding Editor',
  category: 'Designer',
  inputs: [
    { name: 'branding', type: 'code', label: 'Branding Config' },
    { name: 'appTitle', type: 'string', label: 'App Title' },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});

ComponentRegistry.register('object-manager', ObjectManager, {
  namespace: 'plugin-designer',
  label: 'Object Manager',
  category: 'Designer',
  inputs: [
    { name: 'objects', type: 'code', label: 'Object Definitions' },
    { name: 'showSystemObjects', type: 'boolean', label: 'Show System Objects', defaultValue: true },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});

ComponentRegistry.register('field-designer', FieldDesigner, {
  namespace: 'plugin-designer',
  label: 'Field Designer',
  category: 'Designer',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name' },
    { name: 'fields', type: 'code', label: 'Field Definitions' },
    { name: 'readOnly', type: 'boolean', label: 'Read Only', defaultValue: false },
  ],
});
