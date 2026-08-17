---
'@object-ui/plugin-report': patch
---

docs(plugin-report): rewrite the README export snippets against the real export signatures

The `### Export` and `### Live Export` snippets called every export function with
the wrong arity or argument order. Every name was real, so the name-set check
could not see it — only the calls were wrong:

- The six format exporters are `(report: ReportComponentSchema, data: any[], config?: ReportExportConfig): void`.
  The README called them `(data, filename)`, so a filename string landed in the
  `data` slot the engine iterates as rows, and there is no filename parameter at
  all — the download name comes from `config.filename`, else `report.title`. All
  five are synchronous `void`, so the snippet's `await` was inert.
  `exportReport` takes the format **first**, which no snippet showed.
- `exportWithLiveData(report, options)` requires `dataSource` and `resource` in
  `LiveExportOptions`; the README passed only `{ format: 'pdf' }`.
- `exportExcelWithFormulas(report, data, options)` takes three parameters; the
  README passed two, and spelled the column key `field` where `ExcelColumnConfig`
  has the required `name` and `header`. Formula templates use the `{ROW}`
  placeholder, which the old `SUM(B2:B100)` never exercised.

The rewritten blocks are the exporters' own (correct) JSDoc examples, and each
one now compiles against the package's built `dist/index.d.ts`. Docs only — no
API, export surface or runtime behaviour changed.
