# @object-ui/plugin-report

Report components for Object UI — render, view and export reports, with scheduling support. Report *authoring* is not part of this package.

## Features

- 🧩 **Four spec report variants** — `tabular` / `summary` / `matrix` / `joined`, dispatched by a single `<ReportRenderer schema={...}>`
- 🧮 **Server-side aggregation** — a dataset-bound report selects measures by name through `dataSource.queryDataset`; totals come back pre-aggregated (ADR-0021)
- 📅 **Date bucketing** — `dateGranularity: day|week|month|quarter|year` on `groupingsAcross` / `groupingsDown`
- 🪜 **Multi-level grouping + totals** — row totals, column totals, grand totals for matrix; tabular/summary delegate to `ObjectGrid`
- 🎯 **Cell drill-down** — aggregated rows and matrix cells emit `DatasetDrillArgs` to the host's `onDrill` callback; the host owns navigation (ADR-0021 D2)
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

## Quick Start

`ReportRenderer` is the one entry point — a dispatcher that routes any report
shape to the right renderer. It takes the report as `schema`; there is no
report-authoring component in this package (see
[Legacy presentation layer](#legacy-presentation-layer)).

```tsx
import { ReportRenderer } from '@object-ui/plugin-report';

// `dataSource` and `router` are host-provided.
function ReportPage() {
  return (
    <ReportRenderer
      schema={{
        name: 'opp_by_stage',
        type: 'summary',
        dataset: 'opportunity_pipeline',
        rows: ['stage'],
        values: ['amount_sum', 'deal_count'],
      }}
      dataSource={dataSource}
      onDrill={({ object }) => router.push(`/records/${object}`)}
    />
  );
}
```

The dataset-bound renderer can also be addressed directly when the host has
already decided the shape — it takes the report as `report`, not `schema`:

```tsx
import { DatasetReportRenderer, isDatasetReport } from '@object-ui/plugin-report';

if (isDatasetReport(stored)) {
  return <DatasetReportRenderer report={stored} dataSource={dataSource} />;
}
```

`ReportViewer` renders a presentation-layer report, and takes a whole
`ReportViewerSchema` as `schema` — `report` / `showToolbar` are keys *inside*
that schema, not props of the component:

```tsx
import { ReportViewer } from '@object-ui/plugin-report';

function LegacyReportPage() {
  return (
    <ReportViewer
      schema={{ type: 'report-viewer', report: reportDefinition, data: rows, showToolbar: true }}
      onRefresh={refetch}
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

A dataset-bound report selects its dimensions (`rows`, and for `matrix` also
`columns`) and measures (`values`) **by name** and runs them through
`dataSource.queryDataset` — the same governed semantic-layer path that
dataset-bound dashboard widgets and the dataset preview use, so the numbers and
the server-resolved dimension labels match everywhere. Totals (row subtotals,
column subtotals, grand total) are **server-computed**: the renderer places the
pre-aggregated rows it is handed and never re-aggregates bucketed values
client-side, since measures like `avg` cannot be recombined without drifting
from the semantic layer.

Drill-down is a **host callback, not a registered handler**: pass `onDrill` and
every aggregated row / matrix cell becomes clickable. The report emits *what was
clicked*; the host decides where that goes, because the renderer only knows
dimension names (ADR-0021 D2).

```tsx
import { ReportRenderer, type DatasetDrillArgs } from '@object-ui/plugin-report';

<ReportRenderer
  schema={report}
  dataSource={dataSource}
  onDrill={(args: DatasetDrillArgs) => {
    // The host resolves dataset → object and dimension → field, then navigates.
    const filter = { ...args.objectFilter, ...args.runtimeFilter };
    router.push(`/records/${args.object}?filter=${encodeURIComponent(JSON.stringify(filter))}`);
  }}
/>
```

What a drill click carries:

| `DatasetDrillArgs` | Meaning |
| ------------------ | ------- |
| `dataset`      | Dataset the clicked aggregate was computed over. |
| `groupKey`     | Dimension **name** → clicked bucket value (row dims, plus across dims for a matrix cell). |
| `runtimeFilter`| The effective render-time scope filter, if any. |
| `object`       | The dataset's base object, when the server supplied it. |
| `objectFilter` | Exact record-list filter (object **field** name → raw stored value) for the clicked bucket. Present only when the server returned the dimension→field mapping plus raw grouped values — that is what lets select/lookup dimensions filter precisely instead of by display label. |

Supply no `onDrill` and nothing is clickable; a report can also opt out with
`drilldown: false`.

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

## Legacy presentation layer

`ReportViewer`, `LegacyReportRenderer` and the export functions below remain
available for pre-spec presentation reports (`{ report, data, columns, chart }`)
and are not affected by the dataset-bound pipeline above.

The authoring components that used to sit alongside them — `ReportBuilder`,
`ScheduleConfig`, `ChartConfig`, the columns/groupings editors — and the
`registerDrillHandler`-style drill helpers were **removed** in the 9.0 cutover
(see `CHANGELOG.md`). They have no replacement export in this package: report
authoring lives in the console designer, and drill-down is the `onDrill`
callback above.

### Export

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

### Scheduled export

A schedule is **data on the report schema**, not a component: it is
`ReportComponentSchema.schedule`, typed `ReportScheduleConfig`. Both types live
in `@object-ui/types` and are *not* re-exported here — importing them from this
package is a TS2305.

`createScheduleTrigger` turns that declared schedule into a callable a workflow
engine can invoke. It takes the report, the data source, the resource to query
and a completion callback:

```ts
import { createScheduleTrigger } from '@object-ui/plugin-report';
import type { ReportComponentSchema, ReportScheduleConfig } from '@object-ui/types';

// `dataSource` and `notify` are host-provided.

const report: ReportComponentSchema = {
  type: 'report',
  title: 'Monthly Sales',
  schedule: {
    enabled: true,
    frequency: 'monthly',
    dayOfMonth: 1,
    time: '07:00',
    formats: ['pdf', 'excel'],
    recipients: ['sales@example.com'],
  },
};

const trigger = createScheduleTrigger(
  report,
  dataSource,
  'orders',
  (exported: ReportComponentSchema, schedule: ReportScheduleConfig) => {
    notify(schedule.recipients ?? [], schedule.subject ?? exported.title);
  },
);

const results = await trigger(); // LiveExportResult[] — one entry per scheduled format
```

`trigger()` reads `report.schedule` itself: a schedule that is missing or
`enabled: false` exports nothing and resolves to `[]`. Otherwise it exports once
per entry in `schedule.formats` (falling back to `report.defaultExportFormat`,
then `'pdf'`) and calls the completion callback with the report and the schedule
it ran.

### Schema-Driven Usage

Importing the package registers three component types with `ComponentRegistry`:

| `type`          | Component        | Notes                                              |
| --------------- | ---------------- | -------------------------------------------------- |
| `report`        | `ReportRenderer` | The dispatcher.                                    |
| `spec-report`   | `ReportRenderer` | Spec-native alias; the report goes under `report`.  |
| `report-viewer` | `ReportViewer`   | Presentation-layer viewer.                         |

```json
{
  "type": "spec-report",
  "report": {
    "name": "opp_by_stage",
    "type": "summary",
    "dataset": "opportunity_pipeline",
    "rows": ["stage"],
    "values": ["amount_sum"]
  }
}
```

There is no `report-builder` component type — the authoring component that name
addressed was removed in the 9.0 cutover, so a node declaring it resolves to
nothing.

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
