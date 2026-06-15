---
"@object-ui/plugin-charts": patch
---

fix(chart): consume ADR-0021 `dataset` binding in list/object chart views

Chart views authored to the current spec (ADR-0021: `dataset` + `dimensions` +
`values`) previously rendered nothing — the renderers only read the **removed**
legacy inline `xAxisField` / `yAxisFields` / `aggregation` shape, so a
spec-compliant chart view showed an empty canvas. `ObjectChart` now runs the
governed `queryDataset` path when a chart binds to a dataset (the same path the
dashboard `DatasetWidget` uses, so numbers stay consistent), and `ListView` /
`ObjectView` emit the dataset shape. The legacy inline aggregate is kept as a
deprecated fallback so pre-ADR-0021 metadata keeps rendering.

Refs objectstack-ai/framework#1890
