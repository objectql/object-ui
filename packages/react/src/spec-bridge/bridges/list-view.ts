/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from '../types';
import type { ListView, ListColumn } from '@objectstack/spec/ui';

/**
 * Bridge input: the spec-canonical ListView (#2231 — the former hand-written
 * `ListViewSpec`/`ListColumn` mirrors are retired; the shape now derives from
 * `@objectstack/spec/ui` and can no longer drift). Relaxed to `Partial` because
 * hosts routinely hand the bridge fragmentary view-configs (every field was
 * optional in the old mirror too, including spec-required `columns`).
 */
type ListViewSpec = Partial<ListView>;

function mapColumn(col: ListColumn | string): Record<string, any> {
  // Spec-legacy shorthand: a bare field name stands for a default column.
  if (typeof col === 'string') {
    return { accessorKey: col, header: col };
  }

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
  if (spec.bulkActionDefs) node.bulkActionDefs = spec.bulkActionDefs;
  if (spec.virtualScroll != null) node.virtualScroll = spec.virtualScroll;
  if (spec.conditionalFormatting) node.conditionalFormatting = spec.conditionalFormatting;
  if (spec.inlineEdit != null) node.inlineEdit = spec.inlineEdit;
  if (spec.exportOptions) node.exportOptions = spec.exportOptions;
  if (spec.emptyState) node.emptyState = spec.emptyState;
  if (spec.userActions) node.userActions = spec.userActions;
  if (spec.appearance) node.appearance = spec.appearance;
  if (spec.compactToolbar != null) node.compactToolbar = spec.compactToolbar;
  if (spec.addRecord) node.addRecord = spec.addRecord;
  if (spec.showRecordCount != null) node.showRecordCount = spec.showRecordCount;
  if (spec.allowPrinting != null) node.allowPrinting = spec.allowPrinting;

  // P1.6 — i18n & ARIA
  if (spec.aria) node.aria = spec.aria;
  if (spec.sharing) {
    // Normalize spec sharing format: map type → visibility, set enabled = true
    const sharing: Record<string, any> = { ...spec.sharing };
    if (sharing.type && !sharing.visibility) {
      sharing.visibility = sharing.type === 'collaborative' ? 'team' : 'private';
    }
    if (sharing.type && sharing.enabled == null) {
      sharing.enabled = true;
    }
    node.sharing = sharing;
  }
  if (spec.hiddenFields) node.hiddenFields = spec.hiddenFields;
  if (spec.fieldOrder) node.fieldOrder = spec.fieldOrder;
  if (spec.description) node.description = spec.description;

  return node;
};
