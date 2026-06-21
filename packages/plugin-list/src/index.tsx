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

export { ListView, ViewSwitcher, ObjectGallery };
export { ViewSwitcherDropdown } from './ViewSwitcher';
export { TabBar, TabBarSelect } from './components/TabBar';
export type { TabBarProps, ViewTab } from './components/TabBar';
export { UserFilters } from './UserFilters';
export type { UserFiltersProps } from './UserFilters';
export { evaluateConditionalFormatting, normalizeFilterCondition, normalizeFilters } from './ListView';
export type { ListViewProps, ListViewHandle } from './ListView';
export type { ObjectGalleryProps } from './ObjectGallery';
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
      { label: 'Kanban', value: 'kanban' },
      { label: 'Gallery', value: 'gallery' },
      { label: 'Calendar', value: 'calendar' },
      { label: 'Timeline', value: 'timeline' },
      { label: 'Gantt', value: 'gantt' },
      { label: 'Map', value: 'map' },
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

// Alias for generic view, exposed only as `view:list`.
//
// `skipFallback` is required: the bare `list` key belongs to the bullet/numbered
// list DISPLAY primitive (`ui:list` in @object-ui/components), used by page
// schemas like `{ type: 'list', items: [...] }`. Without skipFallback this alias
// clobbered the bare key, so a hand-authored bullet list resolved to the
// data-bound ListView (which requires `objectName`) instead. Object list VIEWS
// are rendered via `type: 'list-view'`, never the bare `list` lookup, so the
// data view loses nothing by yielding the bare key.
ComponentRegistry.register('list', ListView, {
  namespace: 'view',
  skipFallback: true,
  category: 'view',
  label: 'List',
  icon: 'LayoutList',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'viewType', type: 'enum', label: 'Default View', enum: [
      { label: 'Grid', value: 'grid' },
      { label: 'Kanban', value: 'kanban' },
      { label: 'Gallery', value: 'gallery' },
      { label: 'Calendar', value: 'calendar' },
      { label: 'Timeline', value: 'timeline' },
      { label: 'Gantt', value: 'gantt' },
      { label: 'Map', value: 'map' },
    ], defaultValue: 'grid' },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'filters', type: 'array', label: 'Filters' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'options', type: 'object', label: 'View Options' },
  ]
});
