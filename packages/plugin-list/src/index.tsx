/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { ListView } from './ListView';
import { ListViewBlock } from './ListViewBlock';
import { ViewSwitcher } from './ViewSwitcher';
import { ObjectGallery } from './ObjectGallery';

export { ListView, ListViewBlock, ViewSwitcher, ObjectGallery };
export { ViewSwitcherDropdown } from './ViewSwitcher';
export { TabBar, TabBarSelect } from './components/TabBar';
export type { TabBarProps, ViewTab } from './components/TabBar';
export { UserFilters } from './UserFilters';
export type { UserFiltersProps } from './UserFilters';
export { evaluateConditionalFormatting, normalizeFilterCondition, normalizeFilters } from './ListView';
export type { ListViewProps, ListViewHandle } from './ListView';
export type { ObjectGalleryProps } from './ObjectGallery';
export type { ViewSwitcherProps, ViewType } from './ViewSwitcher';

/**
 * Registry entry point for `<ListView>`. Both bridges it carries — the
 * schema-renderer context onto the `dataSource` PROP (#3144), and the spec's
 * `PageComponentSchema.dataSource` BINDING onto the props `ListView` reads
 * (objectstack#5576) — are documented on {@link ListViewBlock}.
 */
const ListViewRenderer = ListViewBlock;

// Register ListView component
ComponentRegistry.register('list-view', ListViewRenderer, {
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
    { name: 'columns', type: 'array', label: 'Columns' },
    { name: 'filter', type: 'array', label: 'Filter' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'options', type: 'object', label: 'View Options' },
  ],
  defaultProps: {
    objectName: '',
    viewType: 'grid',
    columns: [],
    filter: [],
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
ComponentRegistry.register('list', ListViewRenderer, {
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
    { name: 'columns', type: 'array', label: 'Columns' },
    { name: 'filter', type: 'array', label: 'Filter' },
    { name: 'sort', type: 'array', label: 'Sort' },
    { name: 'options', type: 'object', label: 'View Options' },
  ]
});
