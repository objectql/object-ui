/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from '../types';
import type { ListView, ListColumn, RowHeight } from '@objectstack/spec/ui';

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

/**
 * The spec's five row heights collapsed onto the renderer's three densities.
 *
 * `Record<RowHeight, …>` on purpose (objectui#4352): the key set is the spec's,
 * so a row height added upstream fails the build here instead of silently
 * arriving with no density. The table used to carry four more keys —
 * `comfortable`, `spacious`, `small`, `large` — which `RowHeightSchema` does
 * not admit, so no spec-valid list view could ever reach them; they only
 * survived because the parameter was widened back to `string` and the fixture
 * asserting three of them compiled against nothing. Deleting them is AGENTS.md
 * #0.1: a renderer-side dialect for off-spec metadata is a second de-facto
 * contract, and one strict contract beats N. An off-spec `rowHeight` now falls
 * through to `undefined` — the producer is where it gets fixed.
 */
const ROW_HEIGHT_TO_DENSITY: Record<
  RowHeight,
  'compact' | 'comfortable' | 'spacious'
> = {
  compact: 'compact',
  short: 'compact',
  medium: 'comfortable',
  tall: 'spacious',
  extra_tall: 'spacious',
};

function mapDensity(
  rowHeight?: RowHeight,
): 'compact' | 'comfortable' | 'spacious' | undefined {
  if (!rowHeight) return undefined;
  return ROW_HEIGHT_TO_DENSITY[rowHeight];
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
  // `sharing` is already the spec's `ViewSharing` shape on both sides (#2890) —
  // this used to DOWNGRADE it here, inventing a legacy `visibility` audience and
  // an `enabled` flag that the renderer then had to fold back.
  if (spec.sharing) node.sharing = spec.sharing;
  if (spec.hiddenFields) node.hiddenFields = spec.hiddenFields;
  if (spec.fieldOrder) node.fieldOrder = spec.fieldOrder;
  if (spec.description) node.description = spec.description;

  return node;
};
