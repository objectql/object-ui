/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useContext } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectView } from './ObjectView';
import { ViewSwitcher } from './ViewSwitcher';
import { FilterUI } from './FilterUI';
import { SortUI } from './SortUI';
import { SharedViewLink } from './SharedViewLink';

export { ObjectView, ViewSwitcher, FilterUI, SortUI, SharedViewLink };
export { ViewTabBar } from './ViewTabBar';
export type { ObjectViewProps } from './ObjectView';
export type { ViewSwitcherProps } from './ViewSwitcher';
export type { ViewTabBarProps, ViewTabItem, AvailableViewType } from './ViewTabBar';
export type { FilterUIProps } from './FilterUI';
export type { SortUIProps } from './SortUI';
export type { SharedViewLinkProps } from './SharedViewLink';

/**
 * SchemaRendererContext is created by @object-ui/react.
 * We import it dynamically to avoid a circular dependency.
 * The context value provides { dataSource }.
 * A fallback context is created so hooks are never called conditionally.
 */
const FallbackContext = React.createContext<any>(null);
let SchemaRendererContext: React.Context<any> = FallbackContext;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@object-ui/react');
  // The context is re-exported from @object-ui/react
  if (mod.SchemaRendererContext) {
    SchemaRendererContext = mod.SchemaRendererContext;
  }
} catch {
  // @object-ui/react not available — registry-based dataSource only
}

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
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'description', type: 'string', label: 'Description' },
    { name: 'layout', type: 'enum', label: 'Form Layout', enum: ['drawer', 'modal', 'page'] },
    { name: 'defaultViewType', type: 'enum', label: 'Default View Type', enum: ['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'map'] },
    { name: 'defaultListView', type: 'string', label: 'Default Named View' },
    { name: 'showSearch', type: 'boolean', label: 'Show Search' },
    { name: 'showFilters', type: 'boolean', label: 'Show Filters' },
    { name: 'showCreate', type: 'boolean', label: 'Show Create Button' },
    { name: 'showRefresh', type: 'boolean', label: 'Show Refresh Button' },
    { name: 'showViewSwitcher', type: 'boolean', label: 'Show View Switcher' },
    { name: 'listViews', type: 'object', label: 'Named List Views' },
    { name: 'navigation', type: 'object', label: 'Navigation Config' },
    { name: 'searchableFields', type: 'array', label: 'Searchable Fields' },
    { name: 'filterableFields', type: 'array', label: 'Filterable Fields' },
  ],
  defaultProps: {
    layout: 'drawer',
    defaultViewType: 'grid',
    showSearch: true,
    showFilters: true,
    showCreate: true,
    showRefresh: true,
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
    { name: 'views', type: 'array', label: 'Views', required: true },
    { name: 'defaultView', type: 'string', label: 'Default View' },
    { name: 'activeView', type: 'string', label: 'Active View' },
    { name: 'variant', type: 'enum', label: 'Variant', enum: ['tabs', 'buttons', 'dropdown'] },
    { name: 'position', type: 'enum', label: 'Position', enum: ['top', 'bottom', 'left', 'right'] },
    { name: 'persistPreference', type: 'boolean', label: 'Persist Preference' },
    { name: 'storageKey', type: 'string', label: 'Storage Key' },
    { name: 'onViewChange', type: 'string', label: 'On View Change Event' },
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
    { name: 'filters', type: 'array', label: 'Filters', required: true },
    { name: 'values', type: 'object', label: 'Values' },
    { name: 'onChange', type: 'string', label: 'On Change Event' },
    { name: 'showClear', type: 'boolean', label: 'Show Clear Button' },
    { name: 'showApply', type: 'boolean', label: 'Show Apply Button' },
    { name: 'layout', type: 'enum', label: 'Layout', enum: ['inline', 'popover', 'drawer'] },
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
    { name: 'fields', type: 'array', label: 'Fields', required: true },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'onChange', type: 'string', label: 'On Change Event' },
    { name: 'multiple', type: 'boolean', label: 'Allow Multiple' },
    { name: 'variant', type: 'enum', label: 'Variant', enum: ['dropdown', 'buttons'] },
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
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'viewId', type: 'string', label: 'View ID' },
    { name: 'baseUrl', type: 'string', label: 'Base URL' },
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
