/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useContext } from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRendererContext } from '@object-ui/react';
import { ListView, type ListViewHandle, type ListViewProps } from './ListView';
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

/**
 * Registry entry point for `<ListView>` — bridges the schema-renderer context
 * onto the component's `dataSource` PROP (#3144).
 *
 * `ListView` reads `props.dataSource`, and `SchemaRenderer` never injects it —
 * it only puts the data source on `SchemaRendererContext`. So registering the
 * component bare meant that on the registry/SDUI path (a metadata page, a
 * `kind:'react'` page, the designer preview) it received no data source at all:
 * its `getObjectSchema` effect returned immediately, nothing was ever fetched,
 * and it rendered the "Nothing here" empty state — while its registry `inputs`
 * declared `objectName` **required**. The app never showed this because the
 * console reaches ListView through `ObjectView`'s `renderListView` render-prop,
 * which passes a data source itself.
 *
 * That is the objectstack#4413 shape (a declared binding nothing can consume),
 * caught this time by `apps/console/src/__tests__/public-block-binding-reach.test.tsx`
 * rather than by hand. `object-form`, `object-kanban` and `object-calendar` have
 * carried this same one-line bridge all along.
 *
 * An explicit `dataSource` prop still wins — hosts that pass their own (as
 * `ObjectView` does) are unaffected. `useContext` rather than
 * `useSchemaContext()` because the latter throws outside a provider, and a bare
 * `<ListView>` with a host-supplied data source must keep working.
 */
const ListViewRenderer = React.forwardRef<ListViewHandle, ListViewProps>((props, ref) => {
  const context = useContext(SchemaRendererContext as React.Context<any>);
  return <ListView ref={ref} {...props} dataSource={props.dataSource ?? context?.dataSource} />;
});
ListViewRenderer.displayName = 'ListViewRenderer';

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
