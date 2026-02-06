/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { DetailView } from './DetailView';
import { DetailSection } from './DetailSection';
import { DetailTabs } from './DetailTabs';
import { RelatedList } from './RelatedList';
import type { DetailViewSchema } from '@object-ui/types';

export { DetailView, DetailSection, DetailTabs, RelatedList };
export type { DetailViewProps } from './DetailView';
export type { DetailSectionProps } from './DetailSection';
export type { DetailTabsProps } from './DetailTabs';
export type { RelatedListProps } from './RelatedList';

// Register DetailView component
ComponentRegistry.register('detail-view', DetailView, {
  namespace: 'plugin-detail',
  label: 'Detail View',
  category: 'Views',
  icon: 'FileText',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'objectName', type: 'string', label: 'Object Name' },
    { name: 'resourceId', type: 'string', label: 'Resource ID' },
    { name: 'api', type: 'string', label: 'API Endpoint' },
    { name: 'data', type: 'object', label: 'Data' },
    { name: 'sections', type: 'array', label: 'Sections' },
    { name: 'fields', type: 'array', label: 'Fields' },
    { name: 'tabs', type: 'array', label: 'Tabs' },
    { name: 'related', type: 'array', label: 'Related Lists' },
    { name: 'actions', type: 'array', label: 'Actions' },
    { name: 'showBack', type: 'boolean', label: 'Show Back Button', defaultValue: true },
    { name: 'showEdit', type: 'boolean', label: 'Show Edit Button', defaultValue: false },
    { name: 'showDelete', type: 'boolean', label: 'Show Delete Button', defaultValue: false },
  ],
  defaultProps: {
    title: 'Detail View',
    showBack: true,
    showEdit: false,
    showDelete: false,
    sections: [],
    fields: [],
    tabs: [],
    related: [],
  }
});

// Register DetailSection component
ComponentRegistry.register('detail-section', DetailSection, {
  namespace: 'plugin-detail',
  label: 'Detail Section',
  category: 'Detail Components',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'description', type: 'string', label: 'Description' },
    { name: 'fields', type: 'array', label: 'Fields', required: true },
    { name: 'collapsible', type: 'boolean', label: 'Collapsible', defaultValue: false },
    { name: 'defaultCollapsed', type: 'boolean', label: 'Default Collapsed', defaultValue: false },
    { name: 'columns', type: 'number', label: 'Columns', defaultValue: 2 },
  ],
});

// Register RelatedList component
ComponentRegistry.register('related-list', RelatedList, {
  namespace: 'plugin-detail',
  label: 'Related List',
  category: 'Detail Components',
  inputs: [
    { name: 'title', type: 'string', label: 'Title', required: true },
    { name: 'type', type: 'enum', label: 'Type', enum: [
      { label: 'List', value: 'list' },
      { label: 'Grid', value: 'grid' },
      { label: 'Table', value: 'table' }
    ], defaultValue: 'table' },
    { name: 'api', type: 'string', label: 'API Endpoint' },
    { name: 'data', type: 'array', label: 'Data' },
    { name: 'columns', type: 'array', label: 'Columns' },
  ],
});

// Alias for generic view
ComponentRegistry.register('detail', DetailView, {
  namespace: 'view',
  category: 'view',
  label: 'Detail',
  icon: 'FileText',
  inputs: [
    { name: 'objectName', type: 'string', label: 'Object Name', required: true },
    { name: 'recordId', type: 'string', label: 'Record ID' },
    { name: 'fields', type: 'array', label: 'Fields' },
  ]
});
