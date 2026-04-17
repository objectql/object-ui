# @object-ui/plugin-report

Report components for Object UI — build, view, render, and export reports with scheduling support.

## Features

- 📊 **Report Builder** - Visual drag-and-drop report construction
- 👁️ **Report Viewer** - Interactive report viewing with toolbar controls
- 🖨️ **Report Renderer** - Render reports from JSON definitions with charts
- 📤 **Multi-Format Export** - Export to CSV, JSON, HTML, PDF, and Excel
- 🔄 **Live Data Export** - Export with real-time data via `exportWithLiveData`
- 📈 **Excel Formulas** - Export Excel files with live formulas via `exportExcelWithFormulas`
- ⏰ **Schedule Config** - Configure recurring report generation and delivery
- 📦 **Auto-registered** - Components register with `ComponentRegistry` on import

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

## API

### ReportBuilder

Visual report construction interface:

```tsx
<ReportBuilder report={initialReport} />
```

### ReportViewer

Interactive report viewer with toolbar:

```tsx
<ReportViewer report={reportDefinition} showToolbar />
```

### ReportRenderer

Renders a report from a JSON chart configuration:

```tsx
<ReportRenderer title="Revenue" description="Q4 Revenue" chart={chartConfig} />
```

### Export Functions

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

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-report)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-report)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
