/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from '../types';
import type { ListViewGalleryConfig, ListViewTimelineConfig } from '@object-ui/types';

interface ListColumn {
  field: string;
  label?: string;
  width?: number;
  align?: string;
  hidden?: boolean;
  sortable?: boolean;
  resizable?: boolean;
  wrap?: boolean;
  type?: string;
  pinned?: string;
  summary?: any;
  link?: any;
  action?: any;
}

interface ListViewSpec {
  name?: string;
  label?: string;
  type?: string;
  data?: any;
  columns?: ListColumn[];
  filter?: any;
  sort?: any;
  searchableFields?: string[];
  filterableFields?: string[];
  quickFilters?: any[];
  selection?: any;
  pagination?: any;
  rowHeight?: string;
  resizable?: boolean;
  striped?: boolean;
  bordered?: boolean;
  grouping?: any;
  rowColor?: any;
  navigation?: any;
  kanban?: any;
  calendar?: any;
  gantt?: any;
  gallery?: ListViewGalleryConfig;
  timeline?: ListViewTimelineConfig;
  // P1.1 additions
  rowActions?: string[];
  bulkActions?: string[];
  virtualScroll?: boolean;
  conditionalFormatting?: Array<{ condition: string; style: Record<string, string> }>;
  inlineEdit?: boolean;
  exportOptions?: any;
  emptyState?: { title?: string; message?: string; icon?: string };
  userActions?: any;
  appearance?: any;
  tabs?: any[];
  addRecord?: any;
  showRecordCount?: boolean;
  allowPrinting?: boolean;
  // P1.6 i18n & ARIA
  aria?: { ariaLabel?: string; ariaDescribedBy?: string; role?: string };
  sharing?: any;
  hiddenFields?: string[];
  fieldOrder?: string[];
  description?: string;
}

function mapColumn(col: ListColumn): Record<string, any> {
  const mapped: Record<string, any> = {
    accessorKey: col.field,
    header: col.label ?? col.field,
  };

  if (col.width != null) mapped.width = col.width;
  if (col.align) mapped.align = col.align;
  if (col.hidden != null) mapped.hidden = col.hidden;
  if (col.sortable != null) mapped.sortable = col.sortable;
  if (col.resizable != null) mapped.resizable = col.resizable;
  if (col.wrap != null) mapped.wrap = col.wrap;
  if (col.type) mapped.type = col.type;
  if (col.pinned) mapped.pinned = col.pinned;
  if (col.summary) mapped.summary = col.summary;
  if (col.link) mapped.link = col.link;
  if (col.action) mapped.action = col.action;

  return mapped;
}

function mapDensity(
  rowHeight?: string,
): 'compact' | 'comfortable' | 'spacious' | undefined {
  if (!rowHeight) return undefined;
  const map: Record<string, 'compact' | 'comfortable' | 'spacious'> = {
    compact: 'compact',
    short: 'compact',
    comfortable: 'comfortable',
    spacious: 'spacious',
    small: 'compact',
    medium: 'comfortable',
    large: 'spacious',
    tall: 'spacious',
    extra_tall: 'spacious',
  };
  return map[rowHeight];
}

/** Transforms a ListView spec into a DataTable SchemaNode */
export const bridgeListView: BridgeFn<ListViewSpec> = (
  spec: ListViewSpec,
  _context: BridgeContext,
): SchemaNode => {
  const columns = (spec.columns ?? []).map(mapColumn);
  const density = mapDensity(spec.rowHeight);

  const node: SchemaNode = {
    type: 'object-grid',
    id: spec.name,
    columns,
    data: spec.data,
  };

  if (spec.label) node.label = spec.label;
  if (spec.selection) node.selection = spec.selection;
  if (spec.pagination) node.pagination = spec.pagination;
  if (spec.sort) node.sort = spec.sort;
  if (spec.filter) node.filter = spec.filter;
  if (density) node.density = density;
  if (spec.grouping) node.grouping = spec.grouping;
  if (spec.rowColor) node.rowColor = spec.rowColor;
  if (spec.searchableFields) node.searchableFields = spec.searchableFields;
  if (spec.filterableFields) node.filterableFields = spec.filterableFields;
  if (spec.quickFilters) node.quickFilters = spec.quickFilters;
  if (spec.resizable != null) node.resizable = spec.resizable;
  if (spec.striped != null) node.striped = spec.striped;
  if (spec.bordered != null) node.bordered = spec.bordered;
  if (spec.navigation) node.navigation = spec.navigation;
  if (spec.kanban) node.kanban = spec.kanban;
  if (spec.calendar) node.calendar = spec.calendar;
  if (spec.gantt) node.gantt = spec.gantt;
  if (spec.gallery) node.gallery = spec.gallery;
  if (spec.timeline) node.timeline = spec.timeline;

  // P1.1 — Spec Protocol Alignment additions
  if (spec.rowActions) node.rowActions = spec.rowActions;
  if (spec.bulkActions) node.bulkActions = spec.bulkActions;
  if (spec.virtualScroll != null) node.virtualScroll = spec.virtualScroll;
  if (spec.conditionalFormatting) node.conditionalFormatting = spec.conditionalFormatting;
  if (spec.inlineEdit != null) node.inlineEdit = spec.inlineEdit;
  if (spec.exportOptions) node.exportOptions = spec.exportOptions;
  if (spec.emptyState) node.emptyState = spec.emptyState;
  if (spec.userActions) node.userActions = spec.userActions;
  if (spec.appearance) node.appearance = spec.appearance;
  if (spec.tabs) node.tabs = spec.tabs;
  if (spec.addRecord) node.addRecord = spec.addRecord;
  if (spec.showRecordCount != null) node.showRecordCount = spec.showRecordCount;
  if (spec.allowPrinting != null) node.allowPrinting = spec.allowPrinting;

  // P1.6 — i18n & ARIA
  if (spec.aria) node.aria = spec.aria;
  if (spec.sharing) node.sharing = spec.sharing;
  if (spec.hiddenFields) node.hiddenFields = spec.hiddenFields;
  if (spec.fieldOrder) node.fieldOrder = spec.fieldOrder;
  if (spec.description) node.description = spec.description;

  return node;
};
