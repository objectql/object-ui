/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useContext } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRendererContext as ImportedSchemaRendererContext } from '@object-ui/react';
import { ObjectView } from './ObjectView';
import { ViewSwitcher } from './ViewSwitcher';
import { FilterUI } from './FilterUI';
import { SortUI } from './SortUI';
import { SharedViewLink } from './SharedViewLink';

export { ObjectView, ViewSwitcher, FilterUI, SortUI, SharedViewLink };
export { ViewTabBar } from './ViewTabBar';
export { ManageViewsDialog } from './ManageViewsDialog';
export { deriveRecordSurface, deriveRecordFlowSurface, RECORD_SURFACE_PAGE_THRESHOLD, deriveOverlaySize, overlayWidthFor } from './recordSurface';
export type { RecordSurface, OverlaySize, RecordFlow, RecordFlowContainer, RecordFlowSurface } from './recordSurface';
export type { ObjectViewProps } from './ObjectView';
export type { ViewSwitcherProps } from './ViewSwitcher';
export type { ViewTabBarProps, ViewTabItem, AvailableViewType } from './ViewTabBar';
export type { ManageViewsDialogProps } from './ManageViewsDialog';
export type { FilterUIProps } from './FilterUI';
export type { SortUIProps } from './SortUI';
export type { SharedViewLinkProps } from './SharedViewLink';

// View config helpers (field options, filter/sort builders, view-type
// metadata). The runtime ViewConfigPanel now hosts the studio's spec-driven
// inspector, so the legacy `buildViewConfigSchema` engine has been retired;
// these utilities still back the CreateViewDialog field pickers.
export {
  deriveFieldOptions,
  toFilterGroup,
  toSortItems,
  VIEW_TYPE_LABELS,
  VIEW_TYPE_OPTIONS,
  isImageLikeField,
  isGeoLikeField,
  pickPreferredField,
  KANBAN_GROUP_PREFERRED,
  PRIMARY_DATE_PREFERRED,
  END_DATE_PREFERRED,
  TITLE_PREFERRED,
} from './config/view-config-utils';
export type { FieldOption } from './config/view-config-utils';

/**
 * SchemaRendererContext is created by @object-ui/react.
 * The context value provides { dataSource }.
 */
const SchemaRendererContext: React.Context<any> = ImportedSchemaRendererContext;

// Register object-view component
const ObjectViewRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  // Resolve dataSource from SchemaRendererProvider context
  const ctx = useContext(SchemaRendererContext);
  const dataSource = ctx?.dataSource ?? null;

  return <ObjectView schema={schema} dataSource={dataSource} />;
};

ComponentRegistry.register('object-view', ObjectViewRenderer, {
  namespace: 'plugin-view',
  label: 'Object View',
  category: 'view',
  icon: 'LayoutDashboard',
  inputs: [
    { name: 'objectName', type: 'string', required: true },
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'layout', type: 'enum', enum: ['drawer', 'modal', 'page'] },
    { name: 'defaultViewType', type: 'enum', enum: ['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'map'] },
    { name: 'defaultListView', type: 'string' },
    { name: 'showSearch', type: 'boolean' },
    { name: 'showFilters', type: 'boolean' },
    { name: 'showCreate', type: 'boolean' },
    { name: 'showViewSwitcher', type: 'boolean' },
    { name: 'listViews', type: 'object' },
    { name: 'navigation', type: 'object' },
    { name: 'searchableFields', type: 'array' },
    { name: 'filterableFields', type: 'array' },
  ],
  defaultProps: {
    layout: 'drawer',
    defaultViewType: 'grid',
    showSearch: true,
    showFilters: true,
    showCreate: true,
    showViewSwitcher: true,
  },
});

// Register alias 'view' → same renderer
ComponentRegistry.register('view', ObjectViewRenderer, {
  namespace: 'plugin-view',
  label: 'View',
  category: 'view',
});

ComponentRegistry.register('view-switcher', ViewSwitcher, {
  namespace: 'view',
  label: 'View Switcher',
  category: 'view',
  icon: 'LayoutGrid',
  inputs: [
    { name: 'views', type: 'array', required: true },
    { name: 'defaultView', type: 'string' },
    { name: 'activeView', type: 'string' },
    { name: 'variant', type: 'enum', enum: ['tabs', 'buttons', 'dropdown'] },
    { name: 'position', type: 'enum', enum: ['top', 'bottom', 'left', 'right'] },
    { name: 'persistPreference', type: 'boolean' },
    { name: 'storageKey', type: 'string' },
    { name: 'onViewChange', type: 'string' },
  ],
  defaultProps: {
    variant: 'tabs',
    position: 'top',
    defaultView: 'grid',
    views: [
      { type: 'grid', label: 'Grid', schema: { type: 'text', content: 'Grid view' } },
      { type: 'list', label: 'List', schema: { type: 'text', content: 'List view' } },
    ],
  },
});

ComponentRegistry.register('filter-ui', FilterUI, {
  namespace: 'view',
  label: 'Filter UI',
  category: 'view',
  icon: 'SlidersHorizontal',
  inputs: [
    { name: 'filters', type: 'array', required: true },
    { name: 'values', type: 'object' },
    { name: 'onChange', type: 'string' },
    { name: 'showClear', type: 'boolean' },
    { name: 'showApply', type: 'boolean' },
    { name: 'layout', type: 'enum', enum: ['inline', 'popover', 'drawer'] },
  ],
  defaultProps: {
    layout: 'inline',
    showApply: false,
    showClear: true,
    filters: [
      { field: 'name', label: 'Name', type: 'text', placeholder: 'Search name' },
      { field: 'status', label: 'Status', type: 'select', options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ] },
      { field: 'created_at', label: 'Created', type: 'date' },
    ],
  },
});

ComponentRegistry.register('sort-ui', SortUI, {
  namespace: 'view',
  label: 'Sort UI',
  category: 'view',
  icon: 'ArrowUpDown',
  inputs: [
    { name: 'fields', type: 'array', required: true },
    { name: 'sort', type: 'array' },
    { name: 'onChange', type: 'string' },
    { name: 'multiple', type: 'boolean' },
    { name: 'variant', type: 'enum', enum: ['dropdown', 'buttons'] },
  ],
  defaultProps: {
    variant: 'dropdown',
    multiple: true,
    fields: [
      { field: 'name', label: 'Name' },
      { field: 'created_at', label: 'Created At' },
    ],
    sort: [{ field: 'name', direction: 'asc' }],
  },
});

ComponentRegistry.register('shared-view-link', SharedViewLink, {
  namespace: 'view',
  label: 'Shared View Link',
  category: 'view',
  icon: 'Share2',
  inputs: [
    { name: 'objectName', type: 'string', required: true },
    { name: 'viewId', type: 'string' },
    { name: 'baseUrl', type: 'string' },
  ],
  defaultProps: {
    objectName: 'objects',
    viewId: 'default',
  },
});

// Simple View Renderer (Container)
const SimpleViewRenderer: React.FC<any> = ({ schema, className, children, dataSource, ...props }) => {
  // If columns prop is present, use grid layout
  const style = schema.props?.columns 
    ? { display: 'grid', gridTemplateColumns: `repeat(${schema.props.columns}, 1fr)`, gap: '1rem' }
    : undefined;

  return (
    <div 
      className={className} 
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

ComponentRegistry.register('view:simple', SimpleViewRenderer, {
  namespace: 'plugin-view',
  label: 'Simple View',
  category: 'view'
});
