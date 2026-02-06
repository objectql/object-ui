/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { ListView } from './ListView';
import { ViewSwitcher } from './ViewSwitcher';
import { ObjectGallery } from './ObjectGallery';
import type { ListViewSchema } from '@object-ui/types';

export { ListView, ViewSwitcher, ObjectGallery };
export type { ListViewProps } from './ListView';
export type { ViewSwitcherProps, ViewType } from './ViewSwitcher';

// Register ListView component
ComponentRegistry.register('list-view', ListView, {
  namespace: 'plugin-list',
  label: 'List View',
  category: 'Views',
  icon: 'LayoutList',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'viewType', type: 'enum', label: 'Default View', enum: [
      { label: 'Grid', value: 'grid' },
      { label: 'List', value: 'list' },
      { label: 'Kanban', value: 'kanban' },
      { label: 'Calendar', value: 'calendar' },
      { label: 'Chart', value: 'chart' }
    ], defaultValue: 'grid' },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'filters', type: 'array', label: 'Filters' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'options', type: 'object', label: 'View Options' },
  ],
  defaultProps: {
    objectName: '',
    viewType: 'grid',
    fields: [],
    filters: [],
    sort: [],
    options: {},
  }
});

// Alias for generic view
ComponentRegistry.register('list', ListView, {
  namespace: 'view',
  category: 'view',
  label: 'List',
  icon: 'LayoutList',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'viewType', type: 'enum', label: 'Default View', enum: [
      { label: 'Grid', value: 'grid' },
      { label: 'List', value: 'list' },
      { label: 'Kanban', value: 'kanban' },
      { label: 'Calendar', value: 'calendar' },
      { label: 'Chart', value: 'chart' }
    ], defaultValue: 'grid' },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'filters', type: 'array', label: 'Filters' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'options', type: 'object', label: 'View Options' },
  ]
});
