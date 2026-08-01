---
"@object-ui/types": minor
"@object-ui/core": minor
---

Report / chart / query symbols stop wearing `@objectstack/spec`'s names
(objectui#3155, objectstack#4115).

**Breaking for TypeScript imports** — six exported names change. Each was a
different concept than the spec export it collided with, so an author reading
the objectui declaration as "the spec's" was reading a false claim:

| was | now | why they were never the same thing |
|:--|:--|:--|
| `ChartSeries` | `ChartDataSeries` | ours is a display name plus literal `data: number[]`; the spec's is a dataset-bound series descriptor (`type`/`stack`/`yAxis`/`variant`) with no data at all |
| `ChartSeriesSchema` | `ChartDataSeriesSchema` | zod twin of the above |
| `QueryAST` | `SqlQueryAST` | ours is a compiled SQL syntax tree (`select`/`from`/`join`/`group_by`); the spec's is the ObjectQL request descriptor (`object`/`fields`/`where`/`expand`) |
| `QuerySchema` | `DriverQueryConfig` | ours is the high-level config `QueryASTBuilder` compiles; the spec exports that name as a zod schema value |
| `DriverInterface` | `SqlDriverInterface` | ours is objectui's SQL-oriented client abstraction (`query(sql, params)`); the spec's is the platform runtime driver contract |
| `DatasourceSchema` | `DatasourceRegistration` | ours is the in-memory record `DatasourceManager` holds — its `driver` is a live instance; the spec's is the authored metadata document, where `driver` is a name |

Three more are now DERIVED from the spec instead of hand-restated, which fixes
live silent-stripping defects, since a `z.object()` drops unknown keys:

- **`DashboardWidgetSchema`** declared 10 of the spec's 22 keys, so
  `objectui validate` deleted the other 12 without a word — `chartConfig`,
  `colorVariant`, `filter`, `responsive`, `aria`,
  `actionUrl`/`actionType`/`actionIcon`, `compareTo`, `suppressWarnings` and the
  `requiresObject` / `requiresService` capability gates the dashboard renderer
  honours at runtime. The TS interface had declared most of them all along, so a
  widget could type-check and still lose half its configuration on validation.
  Pinned divergences kept: `id` stays optional, `type` stays widened for the
  objectui-only `list` / `custom` families, and the legacy `component` envelope
  stays.
- **`GlobalFilterSchema`** took `scope` as a free-form string (any typo
  validated); it now uses the spec's `widget | dashboard` vocabulary. The three
  objectui widenings that back a real runtime normalizer are kept and pinned:
  the bare-string `options` shorthand, the normalized `{ preset }` date default,
  and an optional `optionsFrom.labelField`.
- **`AppContextSelectorSchema`** was a full restatement; spec keys and their
  defaults now flow in by reference, with `label` widened for objectui's i18n
  label envelope — which `AppContextSelectors` already renders.

`ListViewSchema`'s zod node now names the spec in its own initializer rather
than one hop away through a local const, so its long-standing derivation is
visible where it is declared.

Drift guard: `packages/types/src/__tests__/report-chart-query-spec-parity.test.ts`.
