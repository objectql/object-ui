---
'@object-ui/types': patch
'@object-ui/fields': patch
---

`QueryParams.$filter` now declares both shapes the data sources actually accept — the
MongoDB-style field-keyed record, or a `FilterArray`, the ObjectQL AST sugar bound from
`@objectstack/spec/data` (objectui#3909).

**Nothing is narrowed and no accepted value changes.** `Record<string, any>` already
accepted arrays structurally — they satisfy its string index — so the union documents
shapes that were always legal rather than admitting new ones. Measured both ways under
`tsc --strict`: all five inputs `translateFilterToAST` enumerates assign to the old and
new declarations alike, and both reject a bare number and a bare string identically. A
downstream `turbo run build` over all 43 dependent packages is green, which is the
evidence a published type change breaks no consumer.

The harm was entirely on the type face, and it was two-sided. The declaration blocked
nothing while describing one legal shape as though it were the only one — objectui#3831
is what that cost, a rule array accepted by a `Record<string, any>` slot, object-spread
flattened to `{"0": {...}}`, types green, and the query filtering on a column literally
named `0`. And someone writing a new consumer would read the type and its record-only
`@example`, conclude the array path was illegal, and add a tolerant conversion for it —
the "widen the consumer to tolerate the producer" shape AGENTS.md #0.1 forbids. Two
producers have fed arrays through this slot all along: `plugin-list`'s
`buildEffectiveFilter` (grid and export) and `plugin-view`'s `ObjectView` (calendar /
kanban / gallery / timeline). The runtime was right; the declaration was narrow.

The array half is **bound** to the spec's `FilterArray` rather than restated locally, so
it cannot fork from the vocabulary the servers parse — the same failure two hand-written
operator lists had in objectui#3948. The doc comment names `translateFilterToAST` as the
authoritative accepted set instead of carrying a second list to drift from.

`@object-ui/fields` drops the local cast this defect forced. PR objectui#3908 wrote
`filter as Record<string, any>` at one assignment in `useRecordQuery`, deliberately, as
debt rather than widening the shared type. `hasFilter` is now a type predicate narrowing
to the `$filter` slot's own type, so the assignment needs no cast and the guard cannot
drift from the declaration it guards. Type-only throughout; no runtime behaviour changes.
