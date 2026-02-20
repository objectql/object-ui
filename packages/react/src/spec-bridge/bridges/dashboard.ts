/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from '../types';

interface DashboardWidget {
  title?: string;
  description?: string;
  type?: string;
  chartConfig?: any;
  colorVariant?: string;
  object?: string;
  filter?: any;
  categoryField?: string;
  valueField?: string;
  aggregate?: string;
  measures?: any[];
  layout?: any;
}

interface DashboardSpec {
  name?: string;
  label?: string;
  widgets?: DashboardWidget[];
  globalFilters?: any[];
  header?: any;
}

function mapWidget(widget: DashboardWidget, index: number): SchemaNode {
  const node: SchemaNode = {
    type: widget.type ?? 'chart',
    id: `widget-${index}`,
  };

  if (widget.title) node.title = widget.title;
  if (widget.description) node.description = widget.description;
  if (widget.chartConfig) node.chartConfig = widget.chartConfig;
  if (widget.colorVariant) node.colorVariant = widget.colorVariant;
  if (widget.object) node.object = widget.object;
  if (widget.filter) node.filter = widget.filter;
  if (widget.categoryField) node.categoryField = widget.categoryField;
  if (widget.valueField) node.valueField = widget.valueField;
  if (widget.aggregate) node.aggregate = widget.aggregate;
  if (widget.measures) node.measures = widget.measures;
  if (widget.layout) node.layout = widget.layout;

  return node;
}

function mapGlobalFilters(filters: any[]): SchemaNode {
  return {
    type: 'filter-bar',
    id: 'dashboard-filters',
    filters,
  };
}

function mapHeader(header: any): SchemaNode {
  return {
    type: 'dashboard-header',
    id: 'dashboard-header',
    ...header,
  };
}

/** Transforms a Dashboard spec into a dashboard layout SchemaNode */
export const bridgeDashboard: BridgeFn<DashboardSpec> = (
  spec: DashboardSpec,
  _context: BridgeContext,
): SchemaNode => {
  const widgetNodes = (spec.widgets ?? []).map(mapWidget);

  const bodyChildren: SchemaNode[] = [];

  if (spec.header) {
    bodyChildren.push(mapHeader(spec.header));
  }

  if (spec.globalFilters && spec.globalFilters.length > 0) {
    bodyChildren.push(mapGlobalFilters(spec.globalFilters));
  }

  bodyChildren.push({
    type: 'widget-grid',
    id: 'dashboard-widgets',
    body: widgetNodes,
  });

  const node: SchemaNode = {
    type: 'dashboard',
    id: spec.name,
    body: bodyChildren,
  };

  if (spec.label) node.label = spec.label;

  return node;
};
