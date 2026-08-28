# @object-ui/plugin-dashboard

Dashboard plugin for Object UI - Create beautiful dashboards with metrics, charts, and widgets.

## Features

- **Dashboard Layouts** - Grid-based dashboard layouts
- **Metric Cards** - Display KPIs and statistics
- **Widget System** - Modular widget components
- **Responsive** - Mobile-friendly dashboard grids
- **Customizable** - Tailwind CSS styling support

## Installation

```bash
pnpm add @object-ui/plugin-dashboard
```

## Requires a bundler — plain Node cannot import this package

`DashboardGridLayout` imports `react-grid-layout`'s stylesheet at module scope
(`import 'react-grid-layout/css/styles.css'`), and Node has no loader for `.css` at all.
Importing the published entry from plain Node ESM — no bundler, no loader hooks — therefore
resolves and then fails during evaluation:

```text
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css"
  for .../react-grid-layout/css/styles.css
```

**This is a supported-configuration statement, not a bug to report.** Unbundled Node
consumption is not supported for style-carrying plugin packages. It was ruled that way on
[objectui#5384](https://github.com/objectstack-ai/objectui/issues/5384) — deliberately, over
the alternative of moving the stylesheet out of module scope — because the grid's layout rules
are not optional and no unbundled-Node consumer exists to serve.

Consume it through a host that handles CSS imports, which every supported host does: Vite,
webpack, or Next with the package listed in `transpilePackages`. If you have a real need to
import it under plain Node — SSR with no bundler, a Node-side script — please open an issue.
That reopens the question as a design decision rather than a defect, and the shape of your
consumer is the missing input.

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-dashboard';

// Now you can use dashboard types in your schemas
const schema = {
  type: 'dashboard',
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Sales',
      value: '$123,456',
      trend: 'up',
      trendValue: '+12%'
    }
  ]
};
```

### What the side-effect import registers

That single import is the whole of registration — there is no components map to
iterate over. Importing the entry runs the eight `ComponentRegistry.register(...)`
calls in `src/index.tsx`, which claim exactly these schema types. The keys below
are read off those calls:

| Namespaced key | Bare-name fallback | Renderer behind it |
| --- | --- | --- |
| `view:dashboard` | `dashboard` | `DashboardRenderer` — the widget container |
| `plugin-dashboard:metric` | `metric` | `MetricWidget` — one KPI value |
| `plugin-dashboard:metric-card` | `metric-card` | `MetricCard` — KPI with trend and icon |
| `plugin-dashboard:object-metric` | `object-metric` | internal wrapper around `ObjectMetricWidget` — aggregates over an object |
| `plugin-dashboard:pivot` | `pivot` | `PivotTable` — pivot over rows you pass in |
| `plugin-dashboard:object-pivot` | `object-pivot` | internal wrapper around `ObjectPivotTable` — pivot queried from an object |
| `plugin-dashboard:dashboard-grid` | `dashboard-grid` | `DashboardGridLayout` — the drag/resize editable grid |
| `plugin-dashboard:object-data-table` | `object-data-table` | `ObjectDataTable` — table queried from an object |

`ComponentRegistry.register` publishes `namespace:type`, and — unless the call
passes `skipFallback: true` — the bare `type` as a back-compat fallback
(`packages/core/src/registry/Registry.ts:194`, fallback branch at `:226`). No
call in this package passes `skipFallback`, so each type above resolves under
both spellings. The two `object-*` types are served by internal wrappers that
first resolve the spec's per-element `dataSource` binding (through
`ElementDataSourceGate` from `@object-ui/react`) and then render the exported
component, which is why those rows name a wrapper rather than an export.

### Registering a component under your own key

To serve one of this package's components under a key of your own, register the
exported component — that is what a manual registration is here:

```typescript
import { ComponentRegistry } from '@object-ui/core';
import { MetricCard } from '@object-ui/plugin-dashboard';

ComponentRegistry.register('my-metric', MetricCard, {
  namespace: 'my-app',
  label: 'My Metric',
  category: 'Dashboard',
});
```

There is also a `dashboardComponents` export: the manual-integration map, keyed
by the **same eight schema types** as the table above (objectui#5064 re-keyed it
from component class names). Each key maps to the exact component the import
registers for that type — for the two `object-*` types that is the internal
data-source-gate wrapper, not the exported widget. Iterating it with
`ComponentRegistry.register(type, component)` therefore re-registers the eight
types the import has already claimed, which is still not the manual registration
above: each such call passes no `meta`, so it trips the no-namespace deprecation
warning in `register` (`packages/core/src/registry/Registry.ts:198`) and
rewrites each bare-name registry entry without its `label`/`category` metadata
(the `namespace:type` entries are untouched). The side-effect import remains the
whole of registration.

## Schema API

### Dashboard

Container for dashboard widgets:

```typescript
{
  type: 'dashboard',
  widgets: Widget[],
  columns?: number,               // Grid columns (default: 3)
  gap?: number,                   // Gap between widgets
  className?: string
}
```

### Metric Card

Display a single metric or KPI:

```typescript
{
  type: 'metric-card',
  title: string,
  value: string | number,
  icon?: string,                  // Lucide icon name
  trend?: 'up' | 'down' | 'neutral',
  trendValue?: string,
  description?: string,
  className?: string
}
```

## Examples

### Basic Dashboard

```typescript
const schema = {
  type: 'dashboard',
  columns: 3,
  gap: 4,
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Users',
      value: '1,234',
      icon: 'users',
      trend: 'up',
      trendValue: '+12%',
      description: 'vs last month'
    },
    {
      type: 'metric-card',
      title: 'Revenue',
      value: '$56,789',
      icon: 'dollar-sign',
      trend: 'up',
      trendValue: '+8.2%',
      description: 'vs last month'
    },
    {
      type: 'metric-card',
      title: 'Active Sessions',
      value: '432',
      icon: 'activity',
      trend: 'down',
      trendValue: '-3%',
      description: 'vs last month'
    }
  ]
};
```

### Dashboard with Charts

```typescript
const schema = {
  type: 'dashboard',
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Revenue',
      value: '$123,456'
    },
    {
      type: 'card',
      title: 'Sales Trend',
      body: {
        type: 'line-chart',
        data: [/* chart data */],
        height: 300
      }
    },
    {
      type: 'card',
      title: 'Category Distribution',
      body: {
        type: 'pie-chart',
        data: [/* chart data */]
      }
    }
  ]
};
```

### Responsive Dashboard

```typescript
const schema = {
  type: 'dashboard',
  columns: 4,
  gap: 6,
  className: 'lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-1',
  widgets: [/* widgets */]
};
```

## Integration with Data Sources

Connect dashboard to live data:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'dashboard',
  dataSource,
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Users',
      value: '${data.metrics.totalUsers}',
      trend: '${data.metrics.userTrend}'
    }
  ]
};
```

## Dashboard-level filters

A dashboard can declare top-level filters — a date range and any number of
select / text filters — whose values drive **every bound widget at once**.
The filter values live as dashboard-level variables (the page/dashboard
variables primitive), and each widget declares which of **its own** fields a
filter binds to. At render time the dashboard merges the active filter values
into each bound widget's inline query (`AND`-combined with the widget's own
`filter`).

```jsonc
{
  "type": "dashboard",
  "dateRange": {
    "field": "created_at",          // default binding target
    "defaultRange": "last_30_days", // today | this_week | … | last_90_days | custom
    "allowCustomRange": true        // offer a custom from/to calendar
  },
  "globalFilters": [
    {
      "name": "region",             // stable filter name (defaults to field)
      "field": "region",            // default binding target
      "label": "Region",
      "type": "select",             // text | select | date | number | lookup
      // Canonical @objectstack/spec pair form — the only form the platform
      // accepts at publish. The bare-string shorthand (["EMEA", …]) is
      // deprecated: still lifted at runtime, now warns (objectui#4356).
      "options": [
        { "value": "EMEA", "label": "EMEA" },
        { "value": "APAC", "label": "APAC" },
        { "value": "AMER", "label": "AMER" }
      ]
      // or dynamic: "optionsFrom": { "object": "accounts", "valueField": "region" }
    }
  ],
  "widgets": [
    // Widgets bind a semantic-layer dataset (ADR-0021) and select its
    // dimensions/measures by name. The pre-ADR-0021 top-level `object` +
    // `categoryField`/`valueField`/`aggregate` shape was REMOVED — a widget
    // still carrying it renders "This widget uses a retired data format.
    // Edit it to bind a dataset." instead of a chart. A renderer-internal
    // query lives under `options.data` as `{ provider: 'object', object,
    // aggregate }`; an `options.data` array is fixed demo data.
    //
    // Default binding: the filter's own `field` (dateRange → created_at).
    { "id": "w1", "type": "bar", "dataset": "invoices", "dimensions": ["status"], "values": ["count"] },
    // Explicit binding: map each filter to THIS widget's own field.
    {
      "id": "w2", "type": "line", "dataset": "accounts", "dimensions": ["signed_month"], "values": ["count"],
      "filterBindings": { "dateRange": "signed_at", "region": "sales_region" }
    },
    // Opt out of a filter with `false`.
    {
      "id": "w3", "type": "metric", "dataset": "invoices", "values": ["count"],
      "filterBindings": { "region": false }
    }
  ]
}
```

Binding rules, in precedence order:

1. `filterBindings[name]` as a string — apply the filter to that field.
2. `filterBindings[name]: false` — opt this widget out.
3. Legacy `targetWidgets` on the filter — when set, only listed widget ids
   get the default binding (an explicit `filterBindings` entry still wins).
4. Otherwise the filter applies to its own `field` (the built-in date range
   defaults to `dateRange.field ?? 'created_at'`).

Notes:

- Date presets stay symbolic (`{30_days_ago}` … date-macro tokens) until
  query time, so widgets resolve them exactly like hand-authored filters.
- Dataset-bound widgets receive the merged filter through the dataset
  query's `runtimeFilter`.
- Static-data widgets (inline `data` arrays) have no query to scope and are
  not filtered.
- Filter values are also readable in widget expressions as `page.<name>`
  (e.g. `page.region`), since they are hosted as dashboard variables.
- `optionsFrom` resolves distinct option values server-side (a dataset
  GROUP BY) when the data source supports dataset queries, falling back to
  a client-side dedupe over the first 200 records otherwise.
- Default bindings are metadata-aware for inline `object` widgets: a default
  field that doesn't exist on the widget's object is skipped with a console
  warning instead of emitting a query that matches nothing. Explicit
  `filterBindings` strings are always honoured as written.

## Widget accent colour (`colorVariant`)

A KPI widget can declare a semantic accent. The vocabulary is
`@objectstack/spec`'s `WidgetColorVariantSchema` enum — `default`, `blue`,
`teal`, `orange`, `purple`, `success`, `warning`, `danger` — the same eight
tokens the designer's swatch picker offers:

```typescript
{
  id: 'kpi_at_risk',
  type: 'metric',
  title: 'At-Risk Projects',
  dataset: 'project_health',
  values: ['project_count'],
  filter: { health: 'red' },
  colorVariant: 'danger',   // tints the value; card chrome stays neutral
}
```

Where the accent lands depends on the layout, not on the token:

| Layout | Accent |
| --- | --- |
| Card chrome (`MetricWidget`, inline `object-metric`) | the icon chip's background + foreground |
| Chrome-less (`MetricWidget variant: 'bare'`, and every dataset-bound `metric`) | the big number's text colour |

Both read one shared table (`src/colorVariants.ts`), so the same declaration
reads the same on either surface. `default` — and omitting the key — means "no
accent"; the widget renders in the ambient foreground colour. A token outside
the enum gets no accent and is not aliased to a nearby colour: it is invalid
metadata, rejected where it is authored and published rather than reinterpreted
here.

## TypeScript Support

This package ships **components, not schema types** — its whole type export
surface is `WidgetConfigPanelProps`, `ConfigPanelTranslate` and the three
`WidgetDataset*` catalog types, none of which describe an authored dashboard.
The authored shape is typed by `@object-ui/types`:

| Import from `@object-ui/types` | What it types |
| --- | --- |
| `DashboardComponentSchema` | the whole `type: 'dashboard'` node — `columns`, `gap`, `widgets`, `header`, `globalFilters`, `dateRange`, `refreshInterval`, … |
| `DashboardWidgetSchema` | one entry of `widgets[]` — the spec's `DashboardWidget` keys, plus objectui's own (`component`, `layout`, `options`, …) |
| `DashboardWidgetLayout` | a widget's `{ x, y, w, h }` grid box |

```typescript
import type {
  DashboardComponentSchema,
  DashboardWidgetSchema,
} from '@object-ui/types';

// Dataset-bound KPI — the widget vocabulary (see "Dashboard-level filters").
const revenue: DashboardWidgetSchema = {
  id: 'kpi_revenue',
  type: 'metric',
  title: 'Revenue',
  dataset: 'invoices',
  values: ['count'],
  colorVariant: 'success',
};

// Single-value widget with no query: the number lives under `options`.
const users: DashboardWidgetSchema = {
  id: 'kpi_users',
  type: 'metric',
  title: 'Total Users',
  options: { value: '1,234' },
};

// Component format: a registered component node in the widget's `component`
// slot. Its keys are that COMPONENT's props, not widget keys.
const custom: DashboardWidgetSchema = {
  id: 'kpi_custom',
  component: {
    type: 'metric-card',
    title: 'Revenue',
    value: '$123,456',
    trend: 'up',
    trendValue: '+12%',
  },
  layout: { x: 0, y: 0, w: 3, h: 2 },
};

const dashboard: DashboardComponentSchema = {
  type: 'dashboard',
  columns: 3,
  gap: 4,
  widgets: [revenue, users, custom],
};
```

There is **no per-widget-family schema type**: one `DashboardWidgetSchema`
covers every `type` (`metric`, `bar`, `table`, …) and the family-specific
settings live under `options`. `MetricCard`'s own props — `value`, `trend`,
`trendValue` — are the component's, not the widget's: `DashboardWidgetSchema`
declares none of them, and the component's props interface is not on this
package's export surface either. So a `metric-card` node is typed only where it
appears as a component (the `component` slot above), not as a widget family.

## Customization

All components support Tailwind CSS classes:

```typescript
const schema = {
  type: 'metric-card',
  title: 'Custom Metric',
  value: '100',
  className: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
};
```

## Type-aware list/table widget cells

Dashboard `type: 'table'` widgets bound to an `objectName` automatically
render each cell using the appropriate component for the field's type — the
same cell renderers used by `ObjectGrid` (the list view) and reports
(`@object-ui/plugin-report`).

You don't need to declare `type` on each column. The widget fetches the
object schema once and infers the renderer from the bound field:

| Field type | Cell rendering |
|---|---|
| `select` / `picklist` / `status` | Translated label inside a colored Badge |
| `lookup` / `reference` / `master_detail` / `user` / `owner` | Display name (FK is auto-expanded server-side via `$expand`) |
| `boolean` | Checkbox |
| `email` | `mailto:` link |
| `url` | Clickable link |
| `phone` | Phone link with copy button |
| `date` / `datetime` | Locale-formatted date |
| `currency` | Locale currency (or honour `format: '$0,0'`) |
| `percent` | `0%` / `0.0%` formatted (honour `format`) |

Author overrides always win — pass `type`, `format`, `options`,
`currency`, `referenceTo`, or your own `cell` function on a column to
bypass auto-detection. An explicit `currency` (ISO 4217 code, e.g.
`"EUR"`) wins over both the symbol inferred from `format` and the tenant
default currency.

```jsonc
{
  "type": "table",
  "objectName": "opportunity",
  "columns": [
    { "accessorKey": "name",        "header": "Opportunity" },
    { "accessorKey": "account",     "header": "Account" },
    { "accessorKey": "amount",      "header": "Amount",      "format": "$0,0" },
    { "accessorKey": "stage",       "header": "Stage" },
    { "accessorKey": "probability", "header": "Probability", "format": "0%" },
    { "accessorKey": "close_date",  "header": "Close Date",  "format": "YYYY-MM-DD" },
    { "accessorKey": "owner",       "header": "Owner" }
  ]
}
```

## DashboardRenderer — design-mode widget reorder

When `DashboardRenderer` is used in design mode (`designMode={true}` plus an
`onWidgetsReorder` callback), widgets become sortable via
[**@dnd-kit**](https://dndkit.com/). Dragging a widget over another inserts
it at that index (insertion semantics, not swap) — the array order *is* the
visual order because widgets render with `gridColumn: span W`. The renderer
calls `onWidgetsReorder(nextWidgets)` with the reordered array; the host (e.g.
`DashboardView`) is responsible for persisting the change via its DataSource.

A 5px pointer-activation distance keeps click-to-select working on the same
widget surface.

## DashboardGridLayout — persisting drag / resize edits

`DashboardGridLayout` (registered as schema `type: 'dashboard-grid'`) has an
inline **"Edit Layout"** mode that lets users drag and resize widgets via
`react-grid-layout`. When the user clicks **Save Layout**, the new grid
coordinates are merged back into `schema.widgets[].layout` and handed off
through the `onSchemaChange` callback.

```tsx
<DashboardGridLayout
  schema={dashboard}
  // ✅ Preferred — write the updated schema through your data adapter.
  onSchemaChange={(next) => {
    // `name` is optional on the schema, and `saveItem` requires it — decide
    // what an unnamed dashboard means to your host instead of writing through.
    if (!next.name) return;
    client.meta.saveItem('dashboard', next.name, next);
  }}
/>
```

The guard is not defensive noise: the callback receives a
`DashboardComponentSchema`, whose `name` is optional (`BaseSchema.name` in
`@object-ui/types`), while `client.meta.saveItem(type, name, item)` declares
`name: string`. Passing `next.name` straight through is `TS2345` under `strict`
(`Argument of type 'string | undefined' is not assignable to parameter of type
'string'`), so a copied snippet does not compile — and what the server does with
an absent name has **not** been measured here, which is the other reason this
example declines to send one rather than guessing. A host that already knows
which metadata item the grid is editing should pass that name from its own state
instead of reading it off the node.

If `onSchemaChange` is **not** provided, layout edits stay in component
state and are lost on refresh — a `console.warn` is emitted in development
to flag the missing wiring. The component never writes to `localStorage`
or any other storage on its own: persistence is the parent's concern,
delegated to whatever data adapter you have injected (REST, ObjectQL,
file system, …) per the protocol-agnostic architecture rule.

> ⚠️ **Removed in 3.4:** the legacy `persistLayoutKey` prop and its
> built-in localStorage fallback have been removed. Previously a shared
> default key `'dashboard-layout'` caused layouts to bleed across
> dashboards. If you still want a browser-local cache for a demo, do it
> in the parent inside `onSchemaChange`.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-dashboard)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-dashboard)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
