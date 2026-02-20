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
  actionUrl?: string;
  actionType?: string;
  actionIcon?: string;
  object?: string;
  filter?: any;
  categoryField?: string;
  valueField?: string;
  aggregate?: string;
  measures?: any[];
  layout?: any;
  options?: any;
  responsive?: any;
  aria?: { ariaLabel?: string; ariaDescribedBy?: string; role?: string };
}

interface DashboardHeader {
  showTitle?: boolean;
  showDescription?: boolean;
  actions?: Array<{
    label: string;
    actionUrl?: string;
    actionType?: string;
    icon?: string;
  }>;
  [key: string]: any;
}

interface GlobalFilter {
  field: string;
  label?: string;
  type?: string;
  options?: string[];
  optionsFrom?: {
    object: string;
    valueField: string;
    labelField?: string;
    filter?: any;
  };
  defaultValue?: any;
  scope?: string;
  targetWidgets?: string[];
}

interface DashboardSpec {
  name?: string;
  label?: string;
  description?: string;
  widgets?: DashboardWidget[];
  globalFilters?: GlobalFilter[];
  header?: DashboardHeader;
  // P1.3 additions
  refreshInterval?: number;
  dateRange?: {
    field?: string;
    defaultRange?: string;
    allowCustomRange?: boolean;
  };
  aria?: { ariaLabel?: string; ariaDescribedBy?: string; role?: string };
  performance?: any;
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
  if (widget.actionUrl) node.actionUrl = widget.actionUrl;
  if (widget.actionType) node.actionType = widget.actionType;
  if (widget.actionIcon) node.actionIcon = widget.actionIcon;
  if (widget.object) node.object = widget.object;
  if (widget.filter) node.filter = widget.filter;
  if (widget.categoryField) node.categoryField = widget.categoryField;
  if (widget.valueField) node.valueField = widget.valueField;
  if (widget.aggregate) node.aggregate = widget.aggregate;
  if (widget.measures) node.measures = widget.measures;
  if (widget.layout) node.layout = widget.layout;
  if (widget.options) node.options = widget.options;
  if (widget.responsive) node.responsive = widget.responsive;
  if (widget.aria) node.aria = widget.aria;

  return node;
}

function mapGlobalFilters(filters: GlobalFilter[]): SchemaNode {
  return {
    type: 'filter-bar',
    id: 'dashboard-filters',
    filters: filters.map((f) => {
      const mapped: Record<string, any> = { field: f.field };
      if (f.label) mapped.label = f.label;
      if (f.type) mapped.type = f.type;
      if (f.options) mapped.options = f.options;
      if (f.optionsFrom) mapped.optionsFrom = f.optionsFrom;
      if (f.defaultValue != null) mapped.defaultValue = f.defaultValue;
      if (f.scope) mapped.scope = f.scope;
      if (f.targetWidgets) mapped.targetWidgets = f.targetWidgets;
      return mapped;
    }),
  };
}

function mapHeader(header: DashboardHeader): SchemaNode {
  const node: SchemaNode = {
    type: 'dashboard-header',
    id: 'dashboard-header',
    ...header,
  };
  return node;
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

  // P1.3 — Date range filter
  if (spec.dateRange) {
    bodyChildren.push({
      type: 'date-range-filter',
      id: 'dashboard-date-range',
      ...spec.dateRange,
    });
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
  if (spec.description) node.description = spec.description;
  if (spec.refreshInterval != null) node.refreshInterval = spec.refreshInterval;

  // P1.6 — i18n & ARIA
  if (spec.aria) node.aria = spec.aria;
  if (spec.performance) node.performance = spec.performance;

  return node;
};
