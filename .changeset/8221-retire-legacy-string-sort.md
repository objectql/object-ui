---
'@object-ui/core': minor
'@object-ui/types': minor
'@object-ui/app-shell': minor
'@object-ui/plugin-form': minor
'@object-ui/plugin-timeline': minor
'@object-ui/plugin-view': patch
'@object-ui/plugin-map': patch
---

Retire the legacy string `sort` clause: one spelling, the array
(objectui#8221) — `convertSortToQueryParams` now REFUSES `"name desc"` with a
diagnostic naming `[{ field: 'name', order: 'desc' }]`, instead of lowering it.

**BREAKING for `@object-ui/core` consumers — scored `minor`, not `major`, per
AGENTS.md 版本号策略** (every package is in one fixed group, so a `major` here
would carry all 39 off the `@objectstack` major this repo is pinned to). The
breaking semantics are stated below rather than encoded in the version.

Director ruling, decision batch #77 (2026-09-07), option B. Three faces
disagreed about one key: `@object-ui/core` implemented the string clause
on purpose (`sort-query.ts`, docblock and all), `content/docs/plugins/plugin-map.mdx`
taught it as `sort?: string | SortConfig[]`, and the html tier answered
`type-mismatch` for it because all seven `sort` registrations publish
`type: 'array'` alone — while `@objectstack/spec` refuses the string outright on
`element-record-picker`. Option A (per-block string arms) was rejected by name:
it would make one key mean different things on different blocks.

**What moves.** `convertSortToQueryParams(sort)` narrows from
`string | QuerySortEntry[]` to `QuerySortEntry[]`, and the three declarations
that published a string arm narrow with it — `ObjectGridSchema.sort`,
`ObjectMapSchema.sort` and `ObjectGanttSchema.sort`, in the TypeScript face AND
in the zod mirror, together, because a narrowing that left `z.string()` in the
mirror is the declared-vs-enforced split this change exists to close. The local
`sort` declarations on `LineItemsPanel`, `ObjectTimeline` and
`deriveRelatedLists`'s ListView input narrow the same way.

**What a string does now.** Types are erased, so the signature stops a string
only at compile time; authored JSON and stored `sys_metadata` rows still reach
the sink carrying `"name desc"`. Such a value is REFUSED — the query carries no
`$orderby` — and `console.error` names the array form, quotes what arrived and
states the consequence, once per spelling. A silent `undefined` was the one
outcome the ruling ruled out.

**Measured consequences you may see.** A related list that inherited its child
object's default list-view sort in the legacy spelling stops inheriting it (the
console says so). `@objectstack/spec@17.3.0` still ACCEPTS the string on
`ListViewSchema.sort` and on `RecordRelatedListProps.sort`, so such metadata is
still spec-legal today; the spec-side pull-back is its own card. Two surfaces
are deliberately untouched, because they are a DIFFERENT string dialect that
never reaches this sink: `record:related_list`'s `'field'` / `'-field'` form,
normalized by `RelatedList.normalizeSortSpec`, and `ListView.parseSortConfig`,
which reads the platform view record the spec still blesses.

Docs teach the array only: `content/docs/plugins/plugin-map.mdx`,
`content/docs/plugins/plugin-view.mdx` and `packages/plugin-view/README.md`.
