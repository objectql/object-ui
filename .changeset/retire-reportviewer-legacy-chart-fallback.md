---
"@object-ui/types": minor
"@object-ui/plugin-report": minor
"@object-ui/app-shell": minor
---

feat(report)!: drop `SpecReportColumn`/`SpecReportGrouping` re-exports + retire the legacy ReportViewer chart fallback (#3463)

Cross-repo close-out of the ADR-0021 report cleanup (framework #3463). Upstream
`@objectstack/spec` removed the dead `ReportColumnSchema` / `ReportGroupingSchema`
and the unread report `chart.groupBy`; this drops their objectui mirrors and the
now-orphaned legacy report chart path.

- **types**: removed the `SpecReportColumn` / `SpecReportColumnInput` /
  `SpecReportGrouping` / `SpecReportGroupingInput` type re-exports and the
  `SpecReportColumnSchema` / `SpecReportGroupingSchema` value re-exports from
  `@object-ui/types` (they aliased the deleted upstream symbols). The live
  report shape is dataset-bound — `SpecReport` with `dataset` + `values`
  (measure names) + `rows` / `columns` (dimension names).
- **app-shell**: `ReportView` now renders every report through the spec
  `ReportRenderer` dispatcher (dataset → `DatasetReportRenderer`, stored pre-9.0
  JSON → presentation bridge, pre-spec `{ data, columns }` → `LegacyReportRenderer`).
  Deleted the `ReportViewer` last-resort branch, the `mapReportForViewer`
  spec→legacy chart-section adapter (the sole producer of `xAxisField` /
  `yAxisFields`), and the now-dead data-fetch loading flag. No shipped report
  metadata reached the removed branch — the Studio inspector only ever writes
  the dataset-bound shape.
- **plugin-report**: removed the `ReportViewer` chart-section branch. It read
  the invented `xAxisField` / `yAxisFields` (never the spec's `xAxis` / `yAxis`)
  and was only fed by the deleted `mapReportForViewer`. `ReportViewer` itself is
  retained — its table / summary / text sections still back the `report-viewer`
  registered component and the pre-9.0 presentation bridge.

**Migration**: nothing an author writes changes. TypeScript consumers importing
`SpecReportColumn*` / `SpecReportGrouping*` from `@object-ui/types` have no
replacement type — model report columns as the dataset's measure names and
grouping as its dimension names.
