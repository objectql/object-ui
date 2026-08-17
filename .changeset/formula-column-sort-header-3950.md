---
'@object-ui/core': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-list': patch
---

Grid and related-list column headers no longer offer a sort on a `formula` column.

A `formula` value is computed on read: no driver materialises a column for it, so
a server `$orderby` naming one has nothing to order by. That sort never worked.
Until objectstack#6994 the platform did not say so — the response carried the very
values it had been asked to order by, out of order, under a `200`, with ascending
and descending byte-identical on a real SQL driver — and it now answers
`400 INVALID_SORT`. So the header was wrong before the platform's refusal and is
wrong after it, for the same reason: it offers a sort that cannot be performed.

`ObjectGrid` withheld the affordance only from reference-bearing columns
(objectui#3096). Unmaterialized types are a SECOND reason a server sort is
impossible, not a different mechanism, so it now reads both — and so do the two
sort entry points of a related list (the embedded table's headers and the
sort-button row a `data-list` card keeps), which each derived that rule
separately.

Client-side sorting is deliberately unchanged. There the rows are all in the
browser and the formula value is the one the server hydrated on read, so ordering
by what the cell shows is honest — the same split the relational carve-out makes.
A sort DECLARED in view metadata is also unchanged: it still goes out and is still
refused by name, because silently dropping an author's declaration would hide the
authoring error instead of surfacing it (the toolbar's sort picker keeps such a
field listed for exactly that reason — it is the only way to remove it).

The membership — `formula` alone — moved out of a private set in `ListView` into
`@object-ui/core` (`UNMATERIALIZED_FIELD_TYPES` / `isUnmaterializedFieldType`),
bound to `@objectstack/spec`'s own storage predicate so the renderer cannot drift
from what the drivers actually store. It is deliberately narrower than the spec's
write contract `COMPUTED_VALUE_TYPES`: a `summary` and an `autonumber` each get a
real maintained column and sort correctly, and withholding their headers would
have broken two affordances that work.
