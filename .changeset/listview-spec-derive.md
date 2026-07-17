---
"@object-ui/types": minor
---

feat(types): derive `ListViewSchema` from `@objectstack/spec/ui` instead of a hand-written copy (#2231)

`@object-ui/types` shipped a hand-written mirror of the spec's UI ListView zod
(`packages/types/src/zod/objectql.zod.ts`) plus a parallel hand-written TS `interface`
(`objectql.ts`). Both had drifted from the authoritative `@objectstack/spec/ui`
`ListViewSchema`, with nothing enforcing they stay in sync.

- The zod `ListViewSchema` now **derives** from the spec's `ListViewSchema`: spec-owned
  fields (`filter`, `sort`, `selection`, `navigation`, `pagination`, `grouping`,
  `rowColor`, `userActions`, `appearance`, `tabs`, `addRecord`, `rowHeight`, `sharing`,
  `chart`/`tree` configs, `responsive`, `performance`, …) flow in **by reference** instead
  of being re-typed. The component envelope (`type: 'list-view'` discriminator +
  `objectName`) and the legacy objectui vocabulary (`viewType`, `fields`, `filters`, the
  `show*` toolbar flags, `densityMode`, `color`, …) plus the configs whose objectui shape
  is intentionally broader than spec's (`userFilters`, `sharing`, `aria`,
  `conditionalFormatting`, `exportOptions`, `kanban`/`calendar`/`gantt`/`gallery`/
  `timeline`) remain as sanctioned local `.extend()`s. Existing payloads keep validating;
  spec-canonical payloads (`columns`/`filter`/`userActions`) now validate too.
- The hand-written TS `interface ListViewSchema` is replaced by
  `z.infer<typeof ListViewSchema> & ListViewRuntimeProps`, so the type can no longer drift
  from the schema. Non-serializable runtime-only props (`onNavigate`, `onDensityChange`,
  `refreshTrigger`) live in `ListViewRuntimeProps`.
- Added a drift-guard test (`list-view-spec-parity.test.ts`) that fails if the spec grows a
  field objectui hasn't triaged, renames an aliased anchor (`type`/`columns`/`filter`), or
  an objectui-only field is added outside the sanctioned-local set.
- Bumped the `@objectstack/spec` dependency `^14.6.0` → `^15.1.0` across the workspace
  (15.1.0 carries the framework#3021 `lazySchema`/`z.toJSONSchema` identity fix that the
  spec-derived Page/View inspectors depend on).

Migrating the legacy vocabulary to the spec-canonical keys and adopting spec's narrower
sub-shapes are deferred follow-ups (see #2231). No runtime behavior change.
