---
"@object-ui/types": minor
"@object-ui/plugin-dashboard": minor
"@object-ui/app-shell": minor
---

feat(dashboard): Studio authors the ADR-0021 dataset shape only (framework#3251)

Finishes the dashboard analytics migration on the authoring side so the
framework can enable `DashboardWidgetSchema.strict()`. Both Studio surfaces now
emit only the semantic-layer shape (`dataset` + `dimensions` + `values`); no
surface authors the removed pre-ADR-0021 inline query.

**FROM → TO** (authoring)

- charts: `object` + `categoryField` + `valueField` + `aggregate`
  → `dataset` + `dimensions` + `values`
- pivots: `object` + `rowField` + `columnField` + `valueField` + `aggregation`
  → `dataset` + `dimensions` + `values` (last dimension spreads across columns)

**Changes**

- `@object-ui/types` — `DashboardWidgetSchema` gains `dataset` / `dimensions` /
  `values`; the inline analytics keys (`object`, `categoryField`,
  `categoryGranularity`, `valueField`, `aggregate`, `measures`) are marked
  `@deprecated` (retained only so the renderer can still read legacy/static
  metadata during the transition).
- `@object-ui/plugin-dashboard` — `WidgetConfigPanel` is rewritten as a dataset
  picker (chart AND pivot). **Breaking prop change:** the unused
  `availableObjects` / `availableFields` props are replaced by a new
  `datasets?: WidgetDatasetCatalogEntry[]` (+ `datasetsLoading?`) catalog prop,
  also forwarded by `DashboardWithConfig`. Hosts resolve the catalog (e.g. via
  the metadata client's `list('dataset')`); without it the panel falls back to
  free-text authoring. New exports: `WidgetDatasetCatalogEntry` and
  `sanitizeDraftForType`.
- `@object-ui/app-shell` — the metadata-admin `DashboardWidgetInspector` drops
  the legacy inline fields (object / value field / category field / aggregate);
  the dataset section is now the primary (and only) analytics binding, and the
  filter-binding field picker sources options from the bound dataset's
  dimensions. The "Add widget" catalog drops `list` / `custom` — neither is a
  member of `@objectstack/spec` `ChartTypeSchema`, so a widget authored with
  them could never publish.

**Not changed:** `DashboardRenderer` keeps its legacy/static read branches and
the `ObjectPivotTable` / `PivotTable` blocks (still public SDUI blocks and the
backward-compat path for stored/static widgets) — only the dashboard authoring
flow stops emitting the legacy keys. Retiring those renderer branches is a
follow-up gated on migrating stored dashboards.
