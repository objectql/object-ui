/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from '../types';

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
  quickFilters?: any[];
  selection?: any;
  pagination?: any;
  rowHeight?: string;
  grouping?: any;
  rowColor?: any;
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
    comfortable: 'comfortable',
    spacious: 'spacious',
    small: 'compact',
    medium: 'comfortable',
    large: 'spacious',
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
  if (spec.quickFilters) node.quickFilters = spec.quickFilters;

  return node;
};
