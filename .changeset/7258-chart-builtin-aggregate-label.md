---
'@object-ui/core': minor
'@object-ui/i18n': minor
'@object-ui/plugin-charts': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-report': patch
---

Localize the server's built-in aggregate measure titles on dataset charts
(objectui#7258 — consumer half of the objectstack#14492 contract; maintainer
ruling B, 2026-09-02).

A dataset-bound chart's aggregate axis / legend title read the analytics
service's hard-coded English `Count` on a zh console whose category labels were
already Chinese. The renderer was passing `fields[].label` through verbatim —
correctly, for an author-declared measure (objectui#4106) — and had no way to
tell the server's built-in default apart from an author's label.

The wire now can: `AnalyticsResult.fields[]` gains an OPTIONAL structural
discriminator, `builtinAggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max' |
'count_distinct'`, populated only on the server-side built-in defaults
(objectstack#14492). This change is the consumer side of that contract:

- `@object-ui/core`: `buildChartSeries` now accepts `ChartMeasureField[]` —
  `ChartResultField` plus the optional `builtinAggregate` carrier
  (`BuiltinAggregateCarrier`), declared beside the renderer shape rather than
  on it because the spec this release is built against does not carry the key
  yet; new `BUILTIN_AGGREGATES` / `BuiltinAggregate` / `isBuiltinAggregate` /
  `resolveMeasureLabel`; `ChartSeriesOptions.builtinAggregateLabels` carries
  the locale strings in (core stays React-free and i18n-free — the same
  division as `nullCategoryLabel`). A field carrying a recognised
  discriminator resolves through that map; every other field keeps its wire
  `label` verbatim — never by matching the label's text or the field's name
  (the rejected option A).
- `@object-ui/i18n`: `builtinAggregateLabels(tt)` resolves the six strings
  through the existing `report.aggregate.*` keys (zh already carried 计数 /
  求和 / 平均 / …; all ten packs are pinned to cover the vocabulary).
- `plugin-charts` (`ObjectChart`), `plugin-dashboard` (`DatasetWidget`),
  `plugin-report` (`DatasetReportRenderer`): pass the resolved map to
  `buildChartSeries`.

Before: 合作中 / 已流失 / 潜在 under an axis titled `Count`. After: the same
chart titled `计数`; an `en` session still reads `Count`; an author-labelled
measure (`Tasks`) and a measure literally named `count` without the
discriminator are byte-for-byte unchanged. Until the upstream field is
populated the wire carries no discriminator and every chart renders exactly as
before.
