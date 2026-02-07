/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ObjectView } from './ObjectView';
import { ViewSwitcher } from './ViewSwitcher';
import { FilterUI } from './FilterUI';
import { SortUI } from './SortUI';

export { ObjectView, ViewSwitcher, FilterUI, SortUI };
export type { ObjectViewProps } from './ObjectView';
export type { ViewSwitcherProps } from './ViewSwitcher';
export type { FilterUIProps } from './FilterUI';
export type { SortUIProps } from './SortUI';

// Register object-view component
const ObjectViewRenderer: React.FC<{ schema: any }> = ({ schema }) => {
  return <ObjectView schema={schema} dataSource={null as any} />;
};

ComponentRegistry.register('object-view', ObjectViewRenderer, {
  namespace: 'plugin-view'
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

// Simple View Renderer (Container)
const SimpleViewRenderer: React.FC<any> = ({ schema, className, children, ...props }) => {
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
