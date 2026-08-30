---
'@object-ui/types': minor
---

The report authoring face declares what its own examples author (objectui#6121,
maintainer ruling 2026-08-25, Option A — fix the type producer, not the docs).

- `ReportComponentSchema.exportConfigs` is now
  `Partial<Record<ReportExportFormat, ReportExportConfig>>` instead of a TOTAL
  `Record`. Configuring ONE export format no longer forces an author to declare
  all five (`pdf`, `excel`, `csv`, `html`, `json`). The published runtime twin
  was never total — `z.record(z.string(), ReportExportConfigSchema)` in
  `@object-ui/types/zod` has all keys optional — so the TS declaration had been
  stricter than the validator that actually judges authored JSON. This is a pure
  relaxation: every literal that type-checked before still does.

- `ChartDataSeries` gains the optional per-series family override `type`
  (`'bar' | 'line' | 'area'`), with the same key added to its zod twin
  `ChartDataSeriesSchema`. The renderer already reads it —
  `normalizeChartSchema`'s `normalizeSeries` in `@object-ui/plugin-charts`
  resolves the family as `str(raw.chartType) ?? str(raw.type)` — so `type` was
  the author spelling of an override the type refused to declare. The union is
  the three families that read honours, deliberately NOT the wider `ChartType`:
  a wider union would advertise an override the normalizer drops in silence.

Both relaxations carry pins that fail if either is narrowed back
(`packages/types/src/__tests__/report-schema-authoring-face.test.ts`).

`ReportComponentSchema.dataSource` is NOT changed here — measuring the authorable
shape against the report runtime's actual read, which the ruling requires,
produced a fork the ruling did not cover. It is escalated on objectui#6121.
