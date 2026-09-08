---
'@object-ui/core': patch
---

`convertFiltersToAST` now refuses a bare ARRAY in comparand position —
`{ tags: ['a', 'b'] }` — with a `FilterOperatorError` (`INVALID_FILTER` / 400)
that names the field, prints the comparand and prescribes the spelling that
works, instead of lowering it to `['tags', '=', ['a', 'b']]` (objectui#8530).

That node was never answerable: the ObjectQL filter AST has no array-equality,
so `@objectstack/driver-sql` refused it with `400 INVALID_FILTER` from the wire
and every in-memory matcher (`@objectstack/formula`, `ValueDataSource` since
objectui#8514) excluded every row. The author found out two layers away, as a
failed list or an empty one. The refusal now lands at lowering time, where the
field and the offending value are still in hand — the same treatment this file
already gives `$regex` and `$not`, the two other shapes it cannot lower.

It is deliberately NOT read as membership. `{ tags: [...] }` and
`{ tags: { $in: [...] } }` are different statements and the second is already
spellable; rewriting one into the other would guess at intent and silently
change which rows a stored view returns — the lenient second contract
objectui#8514 was resolved against on this same data shape one layer down. The
error message says so, and names `$in` / `$nin` / `$between` as the spellings to
use. `$in` / `$nin` / `$between` members, `$and` / `$or` groups and stored
`ViewFilterRule` values (`in` / `between`) are legitimately arrays and keep
lowering exactly as before.

Every producer in this repository already spells a multi-value comparand
`{ $in: [...] }` (measured across the `$filter` literals and record builders
under `packages/*/src` and `apps/*/src`), so no shipped surface changes
behaviour; only a hand-authored `{ field: [...] }` now fails at the producer
instead of the consumer. No ruled contract ever answered that shape — the spec
leaves an array outside `$in` / `$nin` / `$between` unruled, `driver-sql` and the
in-memory matchers refuse it, and only a document store's native array-equality
happened to read it — so nothing a backend was promised is taken away.
