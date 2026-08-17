---
'@object-ui/plugin-report': patch
---

Docs only: `packages/plugin-report/README.md` no longer teaches three exports the
package does not have (objectui#5016). Each was judged individually against the
entry module's export surface, and all three turned out to be **survivors of the
9.0 cutover** rather than renames — `CHANGELOG.md` records `ReportBuilder`,
`ScheduleConfig` and the drill helpers as removed with the pre-9.0 query-form
renderers, and the README kept teaching them afterwards:

- **`ReportBuilder`** — taught as the main editor component. Removed; there is no
  authoring component in this package. The Quick Start now teaches the real ones,
  with their real signatures: `ReportRenderer` (the dispatcher, which takes the
  report as `schema`), `DatasetReportRenderer` (which takes it as `report`), and
  `ReportViewer` — whose props are `{ schema, onRefresh }`, so the old
  `< ReportViewer report={…} showToolbar />` would not have compiled either.
  `report` / `showToolbar` are keys inside a `ReportViewerSchema`.
- **`registerDrillHandler(actionRunner, …)`** — taught as the drill registration
  call. Removed, and its mechanism no longer exists: drill-down is now a host
  callback, `onDrill?: (args: DatasetDrillArgs) => void`, and the host owns
  navigation because the renderer only knows dimension names (ADR-0021 D2). The
  section is rewritten around what a click actually emits, including why
  `objectFilter` (raw stored values) is what filters select/lookup dimensions
  correctly where a display-label `groupKey` would not.
- **`ScheduleConfig`** — taught as a configuration component. Removed. A schedule
  is *data* on the report schema: `ReportComponentSchema.schedule`, typed
  `ReportScheduleConfig`. Both types live in `@object-ui/types` and are not
  re-exported here, so the corrected snippet imports them from there —
  `createScheduleTrigger` is the real export, and its real signature takes
  `(report, dataSource, resource, onComplete)` and returns
  `() => Promise< LiveExportResult[] >`, not the single callback the old snippet
  passed.

Two further leftovers of the same removal are corrected: the stale survivor
sentence that listed `ReportBuilder` as still available, and the schema-driven
example's `"type": "report-builder"`, which no component registers — the
registered types are `report`, `spec-report` and `report-viewer`, now listed
explicitly. The two feature bullets asserting the removed mechanisms (a
`useReportData()` query pipeline, an `ActionRunner`-dispatched `drill` action)
state the dataset-bound path instead.

No code, types or runtime behaviour change — the diff is one README and this
changeset. The correction reaches npm with the package's next publish, which is
why it declares a patch: `README.md` is in the package's published `files`.
