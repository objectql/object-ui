---
"@object-ui/plugin-grid": patch
---

`object-grid` publishes the filter key it actually reads: `filter`, singular (objectui#4041)

The registration declared plural `filters` while `ObjectGrid` reads singular
`schema.filter`, and `schema.filters` had **zero** read points anywhere in the
renderer. Both halves of that mismatch were silent, in opposite directions:

- An author following the published vocabulary wrote `filters: [...]`. The save
  gate accepted it — `sdui-parser/src/validate.ts` walks a node's props against
  the block's `inputs`, and `filters` was there — the renderer never read it, and
  the grid answered with **the whole table**. No error at authoring time, none at
  runtime, and a wider answer is not visibly wrong.
- The spelling that actually worked, `filter`, was undeclared, so writing it was
  reported as `unknown-prop`.

Published word and runtime read pointed at opposite keys, on a shipped authoring
surface. `list-view` — the sibling block, same family — has always declared the
singular and read the singular.

**The plural is removed, not taught to the renderer** (maintainer ruling
2026-08-10, option A). It has no read point on any ref, so no working grid can
depend on it: this deletes a key with no users rather than a contract. Teaching
the renderer to read `filters` too was the rejected alternative — it would have
hardened a misspelling into a second de-facto contract for the same concept.

`patch` rather than `minor`/`major` on that same fact. The removed key never
reached the query on any released version, so nothing that worked stops working;
what changes is that a filter written under the published name now takes effect.

**The read point now lowers through `toFilterNode`**, which is what makes the
newly-reachable key honest rather than merely reachable. Until now the only value
that could arrive at `schema.filter` was an ObjectQL AST synthesized by
`ElementDataSourceGate`, and copying that onto `$filter` verbatim was correct. An
author writes the spec's view vocabulary instead — `ViewFilterRule[]`,
`[{ field, operator, value }]` — and that shape byte-copied onto `$filter` is
refused on the wire: `isFilterAST` is false for an array of objects and the data
API answers `400 INVALID_FILTER` (measured against a real backend in
objectui#3431). Declaring the key without this hop would have traded a silent
wrong answer for a guaranteed failure, which is not a fix. `toFilterNode` is the
repo's single lowering hop before the wire and every other consumer on this chain
already went through it — `plugin-list`'s `buildEffectiveFilter`, `plugin-view`'s
`ObjectView`, `plugin-detail`'s `RelatedList`; this read point was the last one
that did not.

Two behaviour changes ride along at that read point, both narrow and both toward
the shared sink's documented contract: a MongoDB-style object `filter` is now
converted instead of silently dropped (the old `Array.isArray` guard read false
for it, and the grid returned every record — the same defect `buildEffectiveFilter`
fixed one package over), and a declared-but-empty `filter: []` now skips `$filter`
rather than sending an empty one. The fetch and the server-side export read the
same lowered value, so the downloaded file cannot disagree with the screen.
