/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ElementDataSourceGate, elementDataSourceBlock, type ElementDataSourceMapping } from '@object-ui/react';
import { DashboardRenderer } from './DashboardRenderer';
import { DashboardGridLayout } from './DashboardGridLayout';
import { MetricWidget } from './MetricWidget';
import { MetricCard } from './MetricCard';
import { ObjectMetricWidget } from './ObjectMetricWidget';
import { PivotTable } from './PivotTable';
import { ObjectPivotTable } from './ObjectPivotTable';
import { ObjectDataTable } from './ObjectDataTable';
import { DashboardConfigPanel } from './DashboardConfigPanel';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { DashboardWithConfig } from './DashboardWithConfig';
import { DrillDownDrawer } from './DrillDownDrawer';

export { DashboardRenderer, DashboardGridLayout, MetricWidget, MetricCard, ObjectMetricWidget, PivotTable, ObjectPivotTable, ObjectDataTable, DashboardConfigPanel, WidgetConfigPanel, DashboardWithConfig, DrillDownDrawer };
export type { WidgetConfigPanelProps } from './WidgetConfigPanel';
// objectui#4748 — the config sidebar's provider-less English, exported for the
// same reason the sibling plugins export theirs: a defaults map that disagrees
// with the `en` pack renders two labels for one control, and the assertion that
// it does not needs to be able to import it.
export {
  CONFIG_PANEL_DEFAULT_TRANSLATIONS,
  useConfigPanelTranslation,
  type ConfigPanelTranslate,
} from './useConfigPanelTranslation';
export type {
  WidgetDatasetCatalogEntry,
  WidgetDatasetDimension,
  WidgetDatasetMeasure,
} from './dataset-catalog';

// Register dashboard component
//
// objectui#5742 — `inputs` is the published authoring surface (serialized into
// `sdui.manifest.json` and `sdui-intrinsics.d.ts`; `dashboard` is in
// `PUBLIC_BLOCKS`), and it used to publish only `columns`/`gap`/`className`
// while `DashboardRenderer` honoured far more, so `validateTree` warned
// authors off keys that work — `widgets` included, the very key the
// objectui#5709 unconsumed-options warning descends into. The keys below are
// the per-key triage (#4668 / #5091 class), each declared because BOTH hold:
// the renderer reads it AND `@objectstack/spec`'s strict `DashboardSchema`
// accepts it, so the manifest never offers a key the save gate refuses.
//
// Deliberately NOT declared, pinned in
// `__tests__/dashboardAuthoredInputs.test.tsx`:
//   - `title`  — legacy spelling of `label`; the spec rejects it by name.
//     The `schema.title || schema.label` read STAYS (documents in the wild).
//   - `aria`   — spec tombstone (#3896 audit close-out): no dashboard
//     renderer ever applied it, and this package has no read site either.
//
// `name` is honoured too (the `schema.name` read keys the
// `dashboards.{name}.*` translation lookups) and is likewise NOT declared —
// objectui#5742 ruled it non-author for the INLINE node. Its reason is NOT
// the one above, and the difference is load-bearing: the spec ACCEPTS
// `name` — but on the DOCUMENT form, where it is required, not on this
// inline node. So the "spec accepts + renderer reads" line never fires here
// at all; its premise is about a different shape. Do not carry `title`'s
// "the spec rejects it" over to this key — the spec does not reject `name`.
// The `schema.name` read STAYS untouched.
// The evidence is the PRODUCER alone — `DashboardView` / the document loader
// hands the loaded document to the renderer, so an inline author is not the
// one who writes this key. That makes it a WEAKER exclusion than `title` /
// `aria`, each of which asserts a spec verdict a reader can re-check, and is
// why `name` carries no row in the pin test's table: there is no verdict for
// it to assert. Supporting reason: publishing `name` inline would teach
// authors — AI authors especially — to fabricate a dashboard identity that
// resolves NO translations and fails silently, minting a fresh
// silently-inert key, the exact defect class this card removes.
ComponentRegistry.register(
  'dashboard',
  DashboardRenderer,
  {
    namespace: 'view',
    label: 'Dashboard',
    category: 'Complex',
    icon: 'layout-dashboard',
    inputs: [
      { name: 'widgets', type: 'array', label: 'Widgets', description: 'The widget tree — the spec’s DashboardWidget[]. Each widget binds a dataset (ADR-0021) and may carry a layout ({ x, y, w, h }) and filterBindings. When omitted the dashboard renders an empty grid.' },
      { name: 'label', type: ['string', 'object'], label: 'Label', description: 'Display name, shown as the header title when `header` is declared — a string or an inline per-locale map such as { en, "zh-CN" }. Spec-canonical spelling; the legacy `title` spelling is not authoring surface.' },
      { name: 'description', type: ['string', 'object'], label: 'Description', description: 'Header description shown under the title — a string or an inline per-locale map. Rendered only when `header` is declared and `header.showDescription` is not false.' },
      { name: 'header', type: 'object', label: 'Header', description: 'Header block: { showTitle?, showDescription?, actions? }. Strict — the contract rejects any other key. Renders nothing (zero pixels) when everything it would show is suppressed.' },
      { name: 'globalFilters', type: 'array', label: 'Global Filters', description: 'Dashboard-level filter bar — the spec’s GlobalFilter[]. Filter values live as dashboard variables (readable in widget expressions as page.<name>) and are AND-merged into each bound widget’s query per its filterBindings.' },
      { name: 'dateRange', type: 'object', label: 'Date Range', description: 'Built-in date-range filter: { field?, defaultRange?, allowCustomRange? }. `defaultRange` takes the spec’s date presets plus "custom"; the bound field defaults to created_at.' },
      { name: 'refreshInterval', type: 'number', label: 'Refresh Interval', description: 'Auto-refresh period in seconds. Zero or a negative value disables the timer, and it only runs when the host wires an onRefresh handler.' },
      { name: 'columns', type: 'number', label: 'Columns', defaultValue: 3 },
      { name: 'gap', type: 'number', label: 'Gap', defaultValue: 4 },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
        columns: 3,
        widgets: []
    }
  }
);

// Register metric widget (legacy)
ComponentRegistry.register(
  'metric',
  MetricWidget,
  {
    namespace: 'plugin-dashboard',
    label: 'Metric Widget',
    category: 'Dashboard',
    inputs: [
        { name: 'label', type: 'string', label: 'Label' },
        { name: 'value', type: 'string', label: 'Value' },
    ]
  }
);

// Register metric card (new standalone component)
ComponentRegistry.register(
  'metric-card',
  MetricCard,
  {
    namespace: 'plugin-dashboard',
    label: 'Metric Card',
    category: 'Dashboard',
    inputs: [
        { name: 'title', type: 'string', label: 'Title' },
        { name: 'value', type: 'string', label: 'Value', required: true },
        { name: 'icon', type: 'string', label: 'Icon (Lucide name)' },
        { name: 'trend', type: 'enum', label: 'Trend', enum: [
          { label: 'Up', value: 'up' },
          { label: 'Down', value: 'down' },
          { label: 'Neutral', value: 'neutral' }
        ]},
        { name: 'trendValue', type: 'string', label: 'Trend Value (e.g., +12%)' },
        { name: 'description', type: 'string', label: 'Description' },
    ],
    defaultProps: {
      title: 'Metric',
      value: '0'
    }
  }
);

/**
 * What `ObjectMetricWidget` reads for its own query: the object it aggregates
 * and the filter it aggregates over. A metric is ONE aggregated number — there
 * is no projection, no ordering and no page — so `columns` / `sort` / `limit`
 * have no read site here and are left unmapped rather than written to a key the
 * widget ignores.
 */
const OBJECT_METRIC_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
};

/**
 * Registry shell for `object-metric` — the spec's per-element `dataSource`
 * binding onto the props {@link ObjectMetricWidget} reads (objectstack#6953).
 *
 * This widget is registered directly and takes `objectName` / `filter` as PROPS
 * (`SchemaRenderer` spreads the schema's own keys onto it), so the binding had
 * no path in at all: a metric authored with `dataSource: { object, view }` and
 * no flat `objectName` fell through to the widget's no-object branch and showed
 * its static fallback value — a number that looks real and answers nothing.
 *
 * The props keep their standing when there is no binding: `bound` IS the schema
 * by reference in that case, so `bound?.x ?? props.x` resolves to what the
 * spread already provided, and a host that renders this component with explicit
 * props and no schema at all (the dashboard grid path) is untouched.
 */
const ObjectMetricBlock: React.FC<{ schema?: any; [key: string]: any }> = elementDataSourceBlock(({ schema, ...props }) => (
  <ElementDataSourceGate
    schema={schema}
    mapping={OBJECT_METRIC_DATA_SOURCE}
    dataSource={props.dataSource}
    testId="object-metric"
    errorTitle="This metric’s data source could not be resolved"
  >
    {(bound) => (
      <ObjectMetricWidget
        {...(props as any)}
        objectName={bound?.objectName ?? props.objectName}
        filter={bound?.filter ?? props.filter}
      />
    )}
  </ElementDataSourceGate>
));

// Register object-aware metric widget (async data loading with error states)
ComponentRegistry.register(
  'object-metric',
  ObjectMetricBlock,
  {
    namespace: 'plugin-dashboard',
    label: 'Object Metric',
    category: 'Dashboard',
    inputs: [
        { name: 'objectName', type: 'string', label: 'Object Name', required: true },
        { name: 'label', type: 'string', label: 'Label' },
        { name: 'aggregate', type: 'object', label: 'Aggregate', description: 'Aggregation config: { field, function, groupBy }' },
        { name: 'icon', type: 'string', label: 'Icon (Lucide name)' },
        { name: 'description', type: 'string', label: 'Description', description: 'Helper text rendered under the value.' },
        { name: 'title', type: 'string', label: 'Drill-down Title', description: 'Heading of the drill-down panel. Defaults to `label` — set it only when the records list wants a different name from the tile.' },
        { name: 'filter', type: 'array', label: 'Filter', description: 'Criteria the aggregation is scoped by. The same filter narrows the drill-down list, so the number and the records behind it always agree.' },
        { name: 'colorVariant', type: 'enum', label: 'Color Variant', enum: ['default', 'blue', 'teal', 'orange', 'purple', 'success', 'warning', 'danger'], description: 'Colour of the icon container. Semantic, not decorative: `success` / `warning` / `danger` should track what the number means.' },
        { name: 'variant', type: 'enum', label: 'Layout Variant', enum: ['card', 'bare'], description: '`card` draws the tile’s own surface; `bare` drops it, for a metric already sitting inside a card.' },
        { name: 'format', type: 'string', label: 'Number Format', description: 'Numeral-style format pattern, e.g. `0,0`, `$0,0`, `0%`. Use `currency` instead of hard-coding a currency symbol here.' },
        { name: 'currency', type: 'string', label: 'Currency Code', description: 'ISO 4217 code, e.g. `USD`. Enables locale-aware currency formatting of the value.' },
        { name: 'prefix', type: 'string', label: 'Prefix', description: 'Static text placed before the formatted value.' },
        { name: 'suffix', type: 'string', label: 'Suffix', description: 'Static text placed after the formatted value.' },
        { name: 'invert', type: 'boolean', label: 'Invert', description: 'Display `1 - value` — for gauges whose good direction is down, such as error rate shown as uptime.' },
        { name: 'fallbackValue', type: 'string', label: 'Fallback Value', description: 'Value shown when no data source resolves. For static/demo tiles; a bound metric should not need it.' },
        { name: 'trend', type: 'object', label: 'Trend', description: 'Static trend badge: `{ value, label, direction }`. Use `compareTo` instead when the trend should be computed from data.' },
        { name: 'compareTo', type: 'object', label: 'Compare To', description: 'Period-over-period comparison, `{ kind: "previousPeriod" }` or `{ kind: "previousYear" }` — the computed alternative to a static `trend`.' },
        { name: 'drillDown', type: 'object', label: 'Drill Down', description: 'Click-through config that opens the records behind the number.' },
    ],
    defaultProps: {
      label: 'Metric',
    }
  }
);

// Register pivot table component
ComponentRegistry.register(
  'pivot',
  PivotTable,
  {
    namespace: 'plugin-dashboard',
    label: 'Pivot Table',
    category: 'Dashboard',
    icon: 'table-2',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'rowField', type: 'string', label: 'Row Field', required: true },
      { name: 'columnField', type: 'string', label: 'Column Field', required: true },
      { name: 'valueField', type: 'string', label: 'Value Field', required: true },
      { name: 'aggregation', type: 'enum', label: 'Aggregation', enum: [
        { label: 'Sum', value: 'sum' },
        { label: 'Count', value: 'count' },
        { label: 'Average', value: 'avg' },
        { label: 'Min', value: 'min' },
        { label: 'Max', value: 'max' },
      ]},
      { name: 'showRowTotals', type: 'boolean', label: 'Show Row Totals' },
      { name: 'showColumnTotals', type: 'boolean', label: 'Show Column Totals' },
      { name: 'format', type: 'string', label: 'Number Format' },
    ],
    defaultProps: {
      rowField: '',
      columnField: '',
      valueField: '',
      aggregation: 'sum',
      data: [],
    }
  }
);

/**
 * What `ObjectPivotTable` reads for its own query: the object it cross-tabs and
 * the filter it cross-tabs over (`ObjectPivotTable.tsx` —
 * `dataSource.find(schema.objectName, { $filter: resolveFilterPlaceholders(schema.filter, …) })`).
 *
 * `sort` / `limit` / `columns` are deliberately unmapped, none of them having a
 * read site here: a pivot's ordering comes out of its own row/column grouping
 * (`rowField` / `columnField`), its fetch issues no `$top` because a cross-tab
 * over a truncated page would report wrong totals, and its "columns" are the
 * `columnField` VALUES, not a field projection a saved view could supply.
 */
const OBJECT_PIVOT_DATA_SOURCE: ElementDataSourceMapping = {
  filter: true,
};

/**
 * Registry shell for `object-pivot` — the spec's per-element `dataSource`
 * binding onto the schema keys {@link ObjectPivotTable} reads (objectstack#7121).
 *
 * Without it a pivot authored the way the spec documents (`dataSource: { object,
 * view }`, no flat `objectName`) fell through the `if (!dataSource ||
 * !schema.objectName) return;` guard in its fetch effect: an empty cross-tab, no
 * request, no diagnostic. Same shape the sibling `object-metric` above had.
 *
 * Props pass through untouched, and `bound` IS the schema by reference when there
 * is no binding — so the dashboard/manual paths that render this component with a
 * plain schema behave exactly as before.
 */
const ObjectPivotBlock: React.FC<{ schema?: any; [key: string]: any }> = elementDataSourceBlock(({ schema, ...props }) => (
  <ElementDataSourceGate
    schema={schema}
    mapping={OBJECT_PIVOT_DATA_SOURCE}
    dataSource={props.dataSource}
    testId="object-pivot"
    errorTitle="This pivot table’s data source could not be resolved"
  >
    {(bound) => <ObjectPivotTable {...(props as any)} schema={bound as any} />}
  </ElementDataSourceGate>
));

// Register object-aware pivot table (async data loading)
ComponentRegistry.register(
  'object-pivot',
  ObjectPivotBlock,
  {
    namespace: 'plugin-dashboard',
    label: 'Object Pivot Table',
    category: 'Dashboard',
    icon: 'table-2',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name', required: true },
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'rowField', type: 'string', label: 'Row Field', required: true },
      { name: 'columnField', type: 'string', label: 'Column Field', required: true },
      { name: 'valueField', type: 'string', label: 'Value Field', required: true },
      { name: 'aggregation', type: 'enum', label: 'Aggregation', enum: [
        { label: 'Sum', value: 'sum' },
        { label: 'Count', value: 'count' },
        { label: 'Average', value: 'avg' },
        { label: 'Min', value: 'min' },
        { label: 'Max', value: 'max' },
      ]},
      { name: 'showRowTotals', type: 'boolean', label: 'Show Row Totals' },
      { name: 'showColumnTotals', type: 'boolean', label: 'Show Column Totals' },
      { name: 'filter', type: 'array', label: 'Filter' },
      { name: 'format', type: 'string', label: 'Number Format' },
    ],
    defaultProps: {
      rowField: '',
      columnField: '',
      valueField: '',
      aggregation: 'sum',
    }
  }
);

// Register dashboard grid layout component
ComponentRegistry.register(
  'dashboard-grid',
  DashboardGridLayout,
  {
    namespace: 'plugin-dashboard',
    label: 'Dashboard Grid (Editable)',
    category: 'Complex',
    icon: 'layout-grid',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
        title: 'Dashboard',
        widgets: [],
    }
  }
);

// Register object-aware data table (async data loading)
ComponentRegistry.register(
  'object-data-table',
  ObjectDataTable,
  {
    namespace: 'plugin-dashboard',
    label: 'Object Data Table',
    category: 'Dashboard',
    icon: 'table',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name', required: true },
      { name: 'columns', type: 'array', label: 'Columns' },
      { name: 'filter', type: 'array', label: 'Filter' },
      { name: 'searchable', type: 'boolean', label: 'Searchable' },
      { name: 'pagination', type: 'boolean', label: 'Pagination' },
    ],
    defaultProps: {
      searchable: false,
      pagination: false,
    }
  }
);

// Standard Export Protocol - for manual integration. Keyed by the schema
// `type` each entry serves (objectui#5064 — aligned with the four sibling
// `*Components` maps); every value is the exact component the side-effect
// import registers for that type, including the two internal
// data-source-gate wrappers for the `object-*` types.
export const dashboardComponents = {
  'dashboard': DashboardRenderer,
  'metric': MetricWidget,
  'metric-card': MetricCard,
  'object-metric': ObjectMetricBlock,
  'pivot': PivotTable,
  'object-pivot': ObjectPivotBlock,
  'dashboard-grid': DashboardGridLayout,
  'object-data-table': ObjectDataTable,
};
