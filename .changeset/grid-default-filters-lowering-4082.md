---
"@object-ui/plugin-grid": patch
---

`ObjectGrid` lowers the deprecated `defaultFilters` through `toFilterNode` instead of
byte-copying it onto `$filter` (objectui#4082).

The query assembly already lowered the canonical `filter` key through `toFilterNode` —
the repo's single "last hop before the wire" (objectui#4041) — while the legacy branch
beside it assigned `params.$filter = schema.defaultFilters` verbatim. That made this the
one leg on the chain reaching the wire unlowered: `plugin-list`'s `buildEffectiveFilter`
and `plugin-view`'s non-grid fetch both already route the same value through
`toFilterNode` / `mergeFilterNodes`.

Byte-copying is refused on the wire for both shapes the slot carries. `defaultFilters` is
declared `Record<string, any>` (the MongoDB-style shape) and `isFilterAST` is false for a
plain object; an array of `ViewFilterRule` objects fails the same predicate. Either one
answers `400 INVALID_FILTER` — measured against a real backend in objectui#3431.

`toFilterNode` handles both without new logic: objects route through
`convertFiltersToAST`, rule arrays lower element-wise, and an AST already in the slot
passes through untouched, so nothing is lowered twice. It also folds an absent or empty
source to `undefined`, which is why the truthiness guard is gone — `defaultFilters: {}`
used to send `$filter: {}`, asking the server a question with no content in a shape it
refuses; now `$filter` is omitted, matching the canonical key's documented behaviour.

**Grade — this is less dormant than the card assumed.** objectui#4082 was filed
observation-class on "no measured producer", reasoning that `defaultFilters` is not in
`object-grid`'s registered `inputs` so an author writing it only draws a save-gate
warning. That reasoning covers authors, but not the framework: `plugin-view`'s
`ObjectView` writes the slot itself, forwarding an active named view's `filter` as
`defaultFilters: viewFilter || schema.table?.defaultFilters` in its `gridSchema` memo —
and `plugin-view`'s own README documents `listViews.<name>.filter` as
`[{ field, operator, value }, …]`, the exact shape objectui#3431 measured as
`400 INVALID_FILTER`. The registered `object-view` / `view` renderer passes no
`renderListView`, so that path falls through to `ObjectGrid` rather than to `ListView`,
and `ListView`'s lowering does not cover it. So a schema-registration host — the
documented authoring path — reached the raw assignment whenever an active named view
carried a filter. Not asserted here: a failing request captured against a running
deployment. `app-shell` is unaffected either way; it supplies `renderListView` and
delegates to `ListView`, which lowers.

Not in scope, and deliberately not done: retiring `defaultFilters`. This is
consumer-side only — the key the schema admits is unchanged, and its precedence behind
the canonical `filter` is unchanged.

The sibling legacy `defaultSort` leg was graded and needs no change; see the PR for the
measurements.
