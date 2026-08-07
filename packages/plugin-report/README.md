# @object-ui/plugin-report

Report components for Object UI — build, view, render, and export reports with scheduling support.

## Features

- 🧩 **Four spec report variants** — `tabular` / `summary` / `matrix` / `joined`, dispatched by a single `<ReportRenderer schema={...}>`
- 🧮 **Server-side aggregation** — `useReportData()` posts spec `QueryAST` to `POST /api/v1/data/:object/query`; transparent in-memory fallback
- 📅 **Date bucketing** — `dateGranularity: day|week|month|quarter|year` on `groupingsAcross` / `groupingsDown`
- 🪜 **Multi-level grouping + totals** — row totals, column totals, grand totals for matrix; tabular/summary delegate to `ObjectGrid`
- 🎯 **Cell drill-down** — every aggregated cell dispatches a `drill` action via `ActionRunner`; targets List view or a nested Report (M3)
- 🧱 **Joined reports** — vertically stacked sub-reports; each block owns its own `objectName`, filter and data fetch
- 🎨 **Type-aware cells** — `select` → Badge, `lookup` → link, `boolean` → ✓/✗, `email`/`url`/`phone` → links, `image` → thumbnail (auto-hydrated from object metadata)
- 🖨️ **Multi-format export** — CSV, JSON, HTML, PDF, Excel; live-data and Excel-formula variants
- 📦 **Auto-registered** — components register with `ComponentRegistry` on import; embed via `{ "type": "spec-report", "report": {...} }`

## Installation

```bash
npm install @object-ui/plugin-report
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `@object-ui/core`

## Quick Start

```tsx
import { ReportBuilder, ReportViewer, ReportRenderer } from '@object-ui/plugin-report';

function ReportEditorPage() {
  return <ReportBuilder report={initialReport} />;
}

function ReportViewPage() {
  return <ReportViewer report={reportDefinition} showToolbar />;
}

function EmbeddedReport() {
  return (
    <ReportRenderer
      title="Monthly Sales"
      description="Sales performance overview"
      chart={chartConfig}
    />
  );
}
```

## Spec Reports — the four variants

The plugin renders any `Report` defined by `@objectstack/spec`:

```ts
import type { ReportInput } from '@objectstack/spec/ui';
import { ReportRenderer } from '@object-ui/plugin-report';

const report: ReportInput = {
  name: 'opp_by_stage',
  objectName: 'opportunity',
  type: 'summary',
  columns: [
    { field: 'stage' },
    { field: 'amount', aggregate: 'sum' },
    { field: 'id', label: 'Deals', aggregate: 'count' },
  ],
  groupingsDown: [{ field: 'stage', sortOrder: 'asc' }],
};

<ReportRenderer schema={report} dataSource={ds} />
```

| `type`    | Description                                          |
| --------- | ---------------------------------------------------- |
| `tabular` | Flat record list                                     |
| `summary` | Single-axis grouped + aggregated                     |
| `matrix`  | Row × column pivot with cell aggregates and totals   |
| `joined`  | Vertically stacked sub-reports, each with own data   |

### Matrix (row × column pivot)

```ts
{
  name: 'pipeline_by_quarter',
  objectName: 'opportunity',
  type: 'matrix',
  columns: [{ field: 'amount', label: 'Pipeline', aggregate: 'sum' }],
  groupingsDown:   [{ field: 'forecast_category' }],
  groupingsAcross: [{ field: 'close_date', dateGranularity: 'quarter' }],
}
```

`dateGranularity` accepts `day | week | month | quarter | year` and is
pushed down to the server-side aggregator.

### Joined (M3)

```ts
{
  name: 'churn_signals',
  objectName: 'account',          // container default
  type: 'joined',
  columns: [],
  blocks: [
    { name: 'at_risk', type: 'summary', columns: [...], filter: {...} },
    { name: 'lost',    type: 'summary', objectName: 'opportunity', columns: [...], filter: {...} },
  ],
}
```

Block rules: `objectName` falls back to the container; `filter` is ANDed
with the container's; each block runs an isolated `useReportData()` call;
`block.type` must not be `joined` (no recursion).

## Server-side aggregation + drill-down

`useReportData()` translates a `Report` into spec `QueryAST` and posts it
to `POST /api/v1/data/:object/query`. If the endpoint is unavailable it
falls back transparently to `dataSource.find()` + client-side aggregation.

Every aggregated cell dispatches a `drill` action through `ActionRunner`:

```tsx
import { registerDrillHandler } from '@object-ui/plugin-report';
registerDrillHandler(actionRunner, { navigate: router.push });
```

Drill targets:
1. **List view** — default; navigates to the filtered records.
2. **Report drawer** — if the host widget declares `drillDown.report`,
   the click opens a side drawer that renders that report scoped to the
   cell's group key (composes dashboard → report → record).

## Filter-time date helpers — current limitation

The server does **not** currently evaluate `` cel`...` `` expressions
embedded in filter values. Use module-load ISO strings instead:

```ts
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

filter: { close_date: { $gte: daysAgo(30) } }
```

See the bundled CRM `customer_churn_signals` demo for the full pattern.
Native filter-time CEL evaluation is tracked for a future major version.

## Legacy components

`ReportBuilder`, `ReportViewer` and the export functions below remain
available for legacy presentation-layer reports and are not affected by
the spec-driven pipeline above.



Export reports in multiple formats:

```tsx
import {
  exportReport,
  exportAsCSV,
  exportAsJSON,
  exportAsHTML,
  exportAsPDF,
  exportAsExcel,
} from '@object-ui/plugin-report';

await exportAsCSV(reportData, 'sales-report.csv');
await exportAsPDF(reportData, 'sales-report.pdf');
await exportAsExcel(reportData, 'sales-report.xlsx');
```

### Live Export

Export with real-time data and Excel formulas:

```tsx
import { exportWithLiveData, exportExcelWithFormulas } from '@object-ui/plugin-report';

await exportWithLiveData(reportConfig, { format: 'pdf' });
await exportExcelWithFormulas(reportConfig, {
  columns: [{ field: 'total', formula: 'SUM(B2:B100)' }],
});
```

### ScheduleConfig

Configure recurring report generation:

```tsx
import { ScheduleConfig, createScheduleTrigger } from '@object-ui/plugin-report';

<ScheduleConfig
  reportId="monthly-sales"
  onSave={(schedule) => saveSchedule(schedule)}
/>

const trigger = createScheduleTrigger((reportId) => generateReport(reportId));
```

### Schema-Driven Usage

Components auto-register with `ComponentRegistry`:

```json
{
  "type": "report-builder",
  "report": { "sections": [] }
}
```

### Type-aware cell rendering

`ReportViewer` delegates cell rendering to the shared `getCellRenderer`
registry from `@object-ui/fields`, so each column is rendered with the
component appropriate for its type — instead of `String(value)`.

| `field.type`                  | Rendering                                     |
| ----------------------------- | --------------------------------------------- |
| `text` / `string`             | Plain text                                    |
| `number` / `currency` / `percent` | Locale-formatted, optional currency/percent symbol |
| `boolean`                     | ✓ / ✗ icons                                   |
| `date` / `datetime` / `time`  | Localised date/time                           |
| `select` / `multi_select` / `status` | Badge(s), label resolved from `options`, color from `option.color` or `colorMap` |
| `lookup` / `reference` / `master_detail` | Linked record name (id fallback), deep-link to `/console/apps/<app>/<referenceTo>/record/<id>` |
| `email`                       | `mailto:` link                                |
| `url`                         | External link (`target="_blank"`)             |
| `phone`                       | `tel:` link                                   |
| `image`                       | Inline thumbnail                              |
| `file`                        | Filename + download link                      |
| `user` / `owner`              | Avatar + name                                 |
| `richtext` / `html` / `markdown` | Sanitised inline content                   |
| `json`                        | Collapsed code preview                        |

Authors do **not** need to repeat type metadata on every report column:
when a report binds an `objectName`, the runtime auto-hydrates each
column's `type`, `options`, `referenceTo`, and `label` from the
corresponding `ObjectField`. Author-provided values always win.

Minimal report leveraging type-aware cells:

```ts
import type { ReportInput } from '@objectstack/spec/ui';

export const ContactsReport: ReportInput = {
  name: 'contacts_by_account',
  label: 'Contacts by Account',
  objectName: 'contact', // ← enables auto-hydration
  type: 'tabular',
  columns: [
    { field: 'full_name', label: 'Name' },
    { field: 'email',      label: 'Email' },     // → mailto:
    { field: 'phone',      label: 'Phone' },     // → tel:
    { field: 'is_primary', label: 'Primary' },   // → ✓/✗
    { field: 'account',    label: 'Account' },   // → linked record
    { field: 'status',     label: 'Status' },    // → Badge with option color
  ],
};
```

Override per column when needed:

```ts
columns: [
  { field: 'tier', label: 'Tier', type: 'select',
    options: [{ value: 'gold', label: 'Gold', color: 'amber' }] },
]
```

Legacy `renderAs: 'badge'` + `colorMap` is still honoured for plain
string columns.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-report)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-report)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
