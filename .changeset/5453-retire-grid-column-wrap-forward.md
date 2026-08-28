---
'@object-ui/plugin-grid': minor
---

Retire the dead per-column `wrap` forward from `ObjectGrid`'s data-table emit (objectui#5453,
ADR-0049 enforce-or-remove).

`generateColumns()` copied a per-column `wrap` onto every column object handed to
`data-table`, and `packages/components`' `data-table.tsx` never read it. Measured on the
current ref rather than inherited from the card, with comments stripped so prose mentions
cannot be counted as reads: a column-level `wrap` scores **0**, against `accessorKey` 34,
`align` 5, `header` 4, `className` 4, `width` 8 and `fitContent` 2 in the same query shape.
Those sibling counts are the positive control — the search style does find the keys that are
genuinely consumed, so the zero is a measurement and not a mis-aimed grep. The raw string
`wrap` does occur in that file; every occurrence is `flex-wrap`, `whitespace-nowrap`, or a
variable named `wrapper`.

The implement leg was ruled out by the same measurement rather than by preference. `wrap: true`
would have to drop a `truncate`, which presupposes the renderer has somewhere to put a second
line — and it does not. `data-table`'s cell wrapper is a two-way switch,
`isFit ? 'w-full whitespace-nowrap' : 'truncate w-full'`, with a native `title` tooltip as the
only concession to overflow; the file does not read `density` or `rowHeight` at all. There is
no clamp, no expand, no line-clamp and no multi-line affordance for a per-column `wrap` to turn
on, so the enforce-or-remove default applies.

Removing the forward rather than declaring the key follows from `wrap` having **no second road
to a consumer**. That check is what separates this verdict from `pinned`, which `data-table`
also never reads and which is nonetheless kept: `ObjectGrid`'s own reorder pass consumes
`pinned` before the array reaches the slot and re-expresses it as the sticky `className` the
renderer does read. `wrap` had no such pass anywhere.

**Retired, not merely deleted.** `wrap` is no longer carved out of `RetiredListColumnKey`'s
`Exclude`, so the derived tombstone band that objectui#6461 installed on this producer now types
it `never`. Re-adding `...(col.wrap !== undefined && { wrap: col.wrap })` is a compile error
naming `wrap` — otherwise "retired" is just a deleted line the next edit can put back for free.
Deriving the band from the authored `ListColumn` is also why this needed no hand-maintained
list: taking the carve-out out was the whole edit.

**Breaking for TypeScript consumers of `@object-ui/plugin-grid`'s exported emit types only**
(`ObjectGridColumnHolds` loses its `wrap` member; `ObjectGridColumnDraft['wrap']` becomes
`never`). Marked `minor` per this repo's version-alignment rule, which reserves `major` for
following `@objectstack` across a major — the same classification the `MobileOverrides`
retirement used. **Runtime behaviour is unchanged**: an authored `wrap` did nothing before and
does nothing now. What changed is that the code no longer implies `data-table` might consume it.

⚠️ The **authorable** spelling is untouched and still declared: `@objectstack/spec`'s
`ListColumn.wrap`, which `packages/react`'s spec-bridge still forwards into the grid schema.
Whether that spec property should keep being declared with no renderer anywhere is a spec-side
enforce-or-remove question, filed separately rather than settled from inside this renderer.
