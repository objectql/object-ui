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

  NOT only a relaxation on the runtime side, and this is the half a consumer
  needs before taking the bump. `ChartDataSeriesSchema` is a stripping
  `z.object`, so a stored series carrying a non-family `type` — `type: 'pie'`,
  say, copied from `@objectstack/spec`'s `ChartSeries`, whose `type` IS the
  full `ChartType` — used to PARSE, with the unrecognised key dropped in
  silence; it now FAILS. `ChartDataSeriesSchema` feeds `ChartSchema.series`,
  so a consumer running `safeParse` over stored chart JSON newly gets
  `invalid_value` at `series.N.type` where it previously got nothing. (Checked
  against the package's own zod 4.4.3, both directions, with `type: 'line'`
  and a series carrying no `type` as controls: both still parse.) What to do
  about it: the rejected value never had an effect — `normalizeSeries` honours
  exactly the three families and drops every other one with no error, no
  warning and no output key — so the failure surfaces an override that was
  already inert. Drop the `type` from the stored series, or, if the whole
  chart really is that family, move it to the chart's own `chartType`, which
  still takes the full `ChartType`. The TS side is widening-only; only the
  published validator newly rejects.

Both changes carry pins in
`packages/types/src/__tests__/report-schema-authoring-face.test.ts`: the
widenings fail if either is narrowed back, and the rejection above is pinned
openly as `rejects a family the normalizer would silently drop`.

`ReportComponentSchema.dataSource` is NOT changed here — measuring the authorable
shape against the report runtime's actual read, which the ruling requires,
produced a fork the ruling did not cover. It is escalated on objectui#6121.
