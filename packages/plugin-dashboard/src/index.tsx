/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ComponentRegistry, elementDataSourceBlock } from '@object-ui/core';
import { ElementDataSourceGate, type ElementDataSourceMapping } from '@object-ui/react';
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
      { name: 'widgets', type: 'array', description: 'The widget tree — the spec’s DashboardWidget[]. Each widget binds a dataset (ADR-0021) and may carry a layout ({ x, y, w, h }) and filterBindings. When omitted the dashboard renders an empty grid.' },
      { name: 'label', type: ['string', 'object'], description: 'Display name, shown as the header title when `header` is declared — a string or an inline per-locale map such as { en, "zh-CN" }. Spec-canonical spelling; the legacy `title` spelling is not authoring surface.' },
      { name: 'description', type: ['string', 'object'], description: 'Header description shown under the title — a string or an inline per-locale map. Rendered only when `header` is declared and `header.showDescription` is not false.' },
      { name: 'header', type: 'object', description: 'Header block: { showTitle?, showDescription?, actions? }. Strict — the contract rejects any other key. Renders nothing (zero pixels) when everything it would show is suppressed.' },
      { name: 'globalFilters', type: 'array', description: 'Dashboard-level filter bar — the spec’s GlobalFilter[]. Filter values live as dashboard variables (readable in widget expressions as page.<name>) and are AND-merged into each bound widget’s query per its filterBindings.' },
      { name: 'dateRange', type: 'object', description: 'Built-in date-range filter: { field?, defaultRange?, allowCustomRange? }. `defaultRange` takes the spec’s date presets plus "custom"; the bound field defaults to created_at.' },
      // ⛔ STILL `refreshInterval`, and deliberately so (objectui#8820).
      //
      // `@objectstack/spec` 17.4.0 renamed this key to `refreshIntervalSeconds`
      // and the RENDERER now reads both spellings (`useDashboardAutoRefresh`).
      // This row is not a reader, though — it is a PUBLICATION. `inputs` is
      // serialized into `sdui.manifest.json` (the save gate and the parser
      // whitelist) and into `sdui-intrinsics.d.ts`, and the per-key line this
      // block was built on (objectui#5742) is: a key is declared only when the
      // renderer reads it AND the INSTALLED `@objectstack/spec`'s strict
      // `DashboardSchema` accepts it — so the manifest never offers a key the
      // save gate refuses.
      //
      // objectui resolves `@objectstack/spec@17.3.0`, where
      // `refreshIntervalSeconds` is refused by name (`unrecognized_keys`,
      // measured). Publishing it here today would offer authors a key their own
      // stack rejects — the objectui#5761 / #6223 / #6595 defect class this repo
      // has a dedicated gate for (`scripts/check-designer-field-key-parity.mjs`:
      // "every key a statically declared payload shape can emit must be a key
      // the installed spec schema accepts by name").
      //
      // ⇒ This row moves to `refreshIntervalSeconds` in the change that raises
      // the spec floor to `^17.4.0`, together with the config-panel field key,
      // the `refreshInterval` arm in `useDashboardAutoRefresh`, and the legacy
      // row in `metadata-form-i18n.ts`. Not before: the reader is
      // order-independent, the publication cannot be.
      { name: 'refreshInterval', type: 'number', description: 'Auto-refresh period in seconds. Zero or a negative value disables the timer, and it only runs when the host wires an onRefresh handler.' },
      { name: 'columns', type: 'number' },
      { name: 'gap', type: 'number' },
      { name: 'className', type: 'string' }
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
        { name: 'label', type: 'string' },
        { name: 'value', type: 'string' },
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
        { name: 'title', type: 'string' },
        { name: 'value', type: 'string', required: true },
        { name: 'icon', type: 'string' },
        { name: 'trend', type: 'enum', enum: [
          { label: 'Up', value: 'up' },
          { label: 'Down', value: 'down' },
          { label: 'Neutral', value: 'neutral' }
        ]},
        { name: 'trendValue', type: 'string' },
        { name: 'description', type: 'string' },
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
        { name: 'objectName', type: 'string', required: true },
        { name: 'label', type: 'string' },
        { name: 'aggregate', type: 'object', description: 'Aggregation config: { field, function, groupBy }' },
        { name: 'icon', type: 'string' },
        { name: 'description', type: 'string', description: 'Helper text rendered under the value.' },
        { name: 'title', type: 'string', description: 'Heading of the drill-down panel. Defaults to `label` — set it only when the records list wants a different name from the tile.' },
        { name: 'filter', type: 'array', description: 'Criteria the aggregation is scoped by. The same filter narrows the drill-down list, so the number and the records behind it always agree.' },
        { name: 'colorVariant', type: 'enum', enum: ['default', 'blue', 'teal', 'orange', 'purple', 'success', 'warning', 'danger'], description: 'Colour of the icon container. Semantic, not decorative: `success` / `warning` / `danger` should track what the number means.' },
        { name: 'variant', type: 'enum', enum: ['card', 'bare'], description: '`card` draws the tile’s own surface; `bare` drops it, for a metric already sitting inside a card.' },
        { name: 'format', type: 'string', description: 'Numeral-style format pattern, e.g. `0,0`, `$0,0`, `0%`. Use `currency` instead of hard-coding a currency symbol here.' },
        { name: 'currency', type: 'string', description: 'ISO 4217 code, e.g. `USD`. Enables locale-aware currency formatting of the value.' },
        { name: 'prefix', type: 'string', description: 'Static text placed before the formatted value.' },
        { name: 'suffix', type: 'string', description: 'Static text placed after the formatted value.' },
        { name: 'invert', type: 'boolean', description: 'Display `1 - value` — for gauges whose good direction is down, such as error rate shown as uptime.' },
        { name: 'fallbackValue', type: 'string', description: 'Value shown when no data source resolves. For static/demo tiles; a bound metric should not need it.' },
        { name: 'trend', type: 'object', description: 'Static trend badge: `{ value, label, direction }`. Use `compareTo` instead when the trend should be computed from data.' },
        { name: 'compareTo', type: 'object', description: 'Period-over-period comparison, `{ kind: "previousPeriod" }` or `{ kind: "previousYear" }` — the computed alternative to a static `trend`.' },
        { name: 'drillDown', type: 'object', description: 'Click-through config that opens the records behind the number.' },
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
      { name: 'title', type: 'string' },
      { name: 'rowField', type: 'string', required: true },
      { name: 'columnField', type: 'string', required: true },
      { name: 'valueField', type: 'string', required: true },
      { name: 'aggregation', type: 'enum', enum: [
        { label: 'Sum', value: 'sum' },
        { label: 'Count', value: 'count' },
        { label: 'Average', value: 'avg' },
        { label: 'Min', value: 'min' },
        { label: 'Max', value: 'max' },
      ]},
      { name: 'showRowTotals', type: 'boolean' },
      { name: 'showColumnTotals', type: 'boolean' },
      { name: 'format', type: 'string' },
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
      { name: 'objectName', type: 'string', required: true },
      { name: 'title', type: 'string' },
      { name: 'rowField', type: 'string', required: true },
      { name: 'columnField', type: 'string', required: true },
      { name: 'valueField', type: 'string', required: true },
      { name: 'aggregation', type: 'enum', enum: [
        { label: 'Sum', value: 'sum' },
        { label: 'Count', value: 'count' },
        { label: 'Average', value: 'avg' },
        { label: 'Min', value: 'min' },
        { label: 'Max', value: 'max' },
      ]},
      { name: 'showRowTotals', type: 'boolean' },
      { name: 'showColumnTotals', type: 'boolean' },
      { name: 'filter', type: 'array' },
      { name: 'format', type: 'string' },
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
      { name: 'title', type: 'string' },
      { name: 'className', type: 'string' }
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
      { name: 'objectName', type: 'string', required: true },
      { name: 'columns', type: 'array' },
      { name: 'filter', type: 'array' },
      { name: 'searchable', type: 'boolean' },
      { name: 'pagination', type: 'boolean' },
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
