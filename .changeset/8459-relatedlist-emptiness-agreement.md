---
'@object-ui/plugin-detail': minor
---

`RelatedList`'s column pruning and its cell placeholder now share ONE definition
of emptiness (objectui#8459).

The component decided "is there anything to show here?" twice, with two
different answers. `isValueEmpty` — the predicate behind `pruneEmpty`, which
drops a column whose every cell is empty — counts `null`, `undefined`, a string
that is empty **after trimming**, and an **empty array**. The placeholder branch
of `makeCell`, which draws the muted em-dash for one cell, tested `null` and
`undefined` alone.

**The user-visible defect.** The two are not independent questions: `pruneEmpty`
keeps a column when *some* cell is not empty, so a column the reader can see has
been promised it holds something. When only one row in a column was blank, that
column survived — and its blank row then painted a **visually blank cell**,
which is exactly the UI the em-dash exists to prevent, drawn by the same
function that draws `—` for `null` one branch above. Measured in a real grid: a
`note` column holding `['   ', 'real note']` kept its header and printed three
spaces into the first cell. A multi-select column holding `[[], ['a']]` did the
same with nothing at all.

**The change.** The cell branch now asks `isValueEmpty`, the one definition this
component already had. Because the old test was a strict subset of it, no cell
that drew the em-dash before stops drawing it: the values whose rendering
changes are whitespace-only strings, empty strings and empty arrays, which now
draw the placeholder instead of nothing.

**Deliberately NOT delegated to `DetailSection`'s `hasCellValue`.** That
function calls every non-null object a VALUE, and `typeof [] === 'object'` — so
it reads an empty array as filled. This surface reads it as empty, and for a
grid that is the right answer: the select renderer maps `[]` over zero options
and paints nothing, so an all-empty-array column that is pruned today would
instead have survived and rendered a column of blank cells. Delegating would
have introduced the very defect being fixed. The two surfaces agree on every
scalar (both trim) and on non-empty objects, which stay values so the type-aware
renderers keep drawing coordinates, addresses and badges.

`0` and `false` are values here exactly as before.
