// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Catalog of Dashboard widget types — the same set @objectstack/spec
 * publishes for `DashboardWidgetSchema.type`. Used by the Dashboard
 * designer's "Add widget" picker so authors can choose a chart kind
 * up front instead of always starting from `metric` and rebinding.
 */

import {
  Activity,
  AreaChart,
  BarChart,
  BarChart2,
  Database,
  Donut,
  Filter,
  Hash,
  LineChart,
  PieChart,
  ScatterChart,
  Table2,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';

export type WidgetCategory = 'kpi' | 'chart' | 'data';

export interface WidgetTypeMeta {
  id: string;
  label: string;
  category: WidgetCategory;
  icon: LucideIcon;
  /** Sensible defaults applied when this widget is added. */
  defaults?: Record<string, unknown>;
}

export const WIDGET_TYPE_META: Record<string, WidgetTypeMeta> = {
  metric: { id: 'metric', label: 'Metric (KPI)', category: 'kpi', icon: Hash },
  bar: { id: 'bar', label: 'Bar chart', category: 'chart', icon: BarChart },
  'horizontal-bar': {
    id: 'horizontal-bar',
    label: 'Horizontal bar',
    category: 'chart',
    icon: BarChart2,
  },
  line: { id: 'line', label: 'Line chart', category: 'chart', icon: LineChart },
  area: { id: 'area', label: 'Area chart', category: 'chart', icon: AreaChart },
  pie: { id: 'pie', label: 'Pie chart', category: 'chart', icon: PieChart },
  donut: { id: 'donut', label: 'Donut chart', category: 'chart', icon: Donut },
  scatter: { id: 'scatter', label: 'Scatter plot', category: 'chart', icon: ScatterChart },
  funnel: { id: 'funnel', label: 'Funnel', category: 'chart', icon: TrendingDown },
  table: { id: 'table', label: 'Data table', category: 'data', icon: Table2 },
  pivot: { id: 'pivot', label: 'Pivot table', category: 'data', icon: Database },
  // NOTE: `list` and `custom` are intentionally absent — they are not members
  // of @objectstack/spec ChartTypeSchema, so a widget authored with them can
  // never publish (framework#3251). Keep this catalog in lockstep with the spec
  // enum so the "Add widget" picker only offers publishable types.
};

export const WIDGET_CATEGORY_LABEL: Record<WidgetCategory, string> = {
  kpi: 'Single value',
  chart: 'Charts',
  data: 'Tabular',
};

export const WIDGETS_BY_CATEGORY: Array<{ category: WidgetCategory; types: WidgetTypeMeta[] }> = (
  ['kpi', 'chart', 'data'] as WidgetCategory[]
).map((category) => ({
  category,
  types: Object.values(WIDGET_TYPE_META).filter((m) => m.category === category),
}));

export const UnknownWidgetIcon = Activity;
export const FilterIcon = Filter;
