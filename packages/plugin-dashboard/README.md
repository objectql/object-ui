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

### Manual Registration

```typescript
import { dashboardComponents } from '@object-ui/plugin-dashboard';
import { ComponentRegistry } from '@object-ui/core';

// Register dashboard components
Object.entries(dashboardComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

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
      "options": ["EMEA", "APAC", "AMER"]
      // or dynamic: "optionsFrom": { "object": "accounts", "valueField": "region" }
    }
  ],
  "widgets": [
    // Default binding: the filter's own `field` (dateRange → created_at).
    { "id": "w1", "type": "bar", "object": "invoices", "aggregate": "count" },
    // Explicit binding: map each filter to THIS widget's own field.
    {
      "id": "w2", "type": "line", "object": "accounts", "aggregate": "count",
      "filterBindings": { "dateRange": "signed_at", "region": "sales_region" }
    },
    // Opt out of a filter with `false`.
    {
      "id": "w3", "type": "metric", "object": "invoices", "aggregate": "count",
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

## TypeScript Support

```typescript
import type { DashboardSchema, MetricCardSchema } from '@object-ui/plugin-dashboard';

const metricCard: MetricCardSchema = {
  type: 'metric-card',
  title: 'Revenue',
  value: '$123,456',
  trend: 'up',
  trendValue: '+12%'
};

const dashboard: DashboardSchema = {
  type: 'dashboard',
  columns: 3,
  widgets: [metricCard]
};
```

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
`referenceTo`, or your own `cell` function on a column to bypass
auto-detection.

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

## DashboardGridLayout — persisting drag / resize edits

### DashboardRenderer — design-mode widget reorder

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
  onSchemaChange={(next) => client.meta.saveItem('dashboard', next.name, next)}
/>
```

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

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-dashboard)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-dashboard)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
