/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Widget-type → dispatch family, shared by every dashboard surface.
 *
 * Three surfaces used to restate this knowledge independently and disagree:
 * `DatasetWidget` covered all 19 `ChartTypeSchema` values, `DashboardRenderer`
 * covered 15, and `DashboardGridLayout` 8. A type the surface didn't name fell
 * through to `{ ...widget }`, whose `type` no component registers — so
 * `SchemaRenderer` rendered a red `role="alert"` panel dumping the widget JSON
 * (#2943).
 *
 * The single-value families were the sharpest case: `DashboardRenderer` already
 * had `METRIC_LIKE_TYPES = ['gauge','solid-gauge','kpi','bullet']` with a
 * docstring saying they "render as a metric card rather than a chart" — and
 * consulted it only to pick a grid span. The tile was sized correctly and the
 * widget was never routed.
 */

/**
 * Spec chart families that only render as another family. Normalizing them
 * here is what lets one branch serve `column` and `bar` (the spec's own
 * `ChartTypeSchema` comment records the same equivalences).
 */
export const CHART_TYPE_ALIASES: Record<string, string> = {
  column: 'bar',
  'stacked-bar': 'bar',
  'grouped-bar': 'bar',
  'bi-polar-bar': 'bar',
  spline: 'line',
  'step-line': 'line',
  'stacked-area': 'area',
  pyramid: 'funnel',
  bubble: 'scatter',
};

/** Cartesian / categorical / flow families the chart renderer draws. */
export const SERIES_CHART_TYPES: ReadonlySet<string> = new Set([
  'bar', 'horizontal-bar', 'line', 'area', 'pie', 'donut',
  'scatter', 'funnel', 'radar', 'treemap', 'sankey',
]);

/**
 * Single-value "performance" families — one number, optionally against a
 * target. They render as a metric card, which is what the spec's own
 * `ChartTypeSchema` comment calls "honest single-value variants pending a real
 * dial/target renderer". `metric` is the objectui widget spelling of the same
 * thing.
 */
export const METRIC_LIKE_TYPES: ReadonlySet<string> = new Set([
  'metric', 'gauge', 'solid-gauge', 'kpi', 'bullet',
]);

/** Tabular families — a grouped/flat table of records. */
export const TABLE_LIKE_TYPES: ReadonlySet<string> = new Set(['table', 'list']);

/**
 * Chart families with no renderer and no honest approximation (they need
 * richer data — OHLC, per-record distributions — or a geo dependency). Some
 * were dropped from `ChartTypeSchema` entirely; they stay named so stale
 * stored dashboards get a labelled placeholder rather than a red error box.
 */
export const UNSUPPORTED_CHART_TYPES: ReadonlySet<string> = new Set([
  'sunburst', 'word-cloud', 'choropleth', 'bubble-map', 'gl-map',
  'heatmap', 'waterfall', 'box-plot', 'violin', 'candlestick', 'stock',
]);

/** How a dashboard surface should render one widget type. */
export type WidgetDispatchFamily =
  /** A series chart (the resolved base family is in `chartType`). */
  | 'series'
  /** A single-value metric card. */
  | 'metric'
  /** A records table. */
  | 'table'
  /** Cross-tab — dataset-bound only; a non-dataset pivot is stale metadata. */
  | 'pivot'
  /** Author-supplied component schema required. */
  | 'custom'
  /** Known family, no renderer — labelled placeholder. */
  | 'unsupported'
  /** Not a widget vocabulary member — the surface passes it through. */
  | 'passthrough';

export interface WidgetDispatch {
  family: WidgetDispatchFamily;
  /** For `series`: the alias-resolved base family to draw. */
  chartType?: string;
}

/**
 * Classify a widget `type` into its dispatch family. Exported for the
 * spec-parity test, which asserts that no `ChartTypeSchema` value lands on
 * `passthrough` (the branch that produces the red box).
 */
export function classifyWidgetType(widgetType: string | undefined): WidgetDispatch {
  if (!widgetType) return { family: 'passthrough' };
  const resolved = CHART_TYPE_ALIASES[widgetType] ?? widgetType;
  if (SERIES_CHART_TYPES.has(resolved)) return { family: 'series', chartType: resolved };
  if (METRIC_LIKE_TYPES.has(widgetType)) return { family: 'metric' };
  if (TABLE_LIKE_TYPES.has(widgetType)) return { family: 'table' };
  if (widgetType === 'pivot') return { family: 'pivot' };
  if (widgetType === 'custom') return { family: 'custom' };
  if (UNSUPPORTED_CHART_TYPES.has(widgetType)) return { family: 'unsupported' };
  return { family: 'passthrough' };
}
