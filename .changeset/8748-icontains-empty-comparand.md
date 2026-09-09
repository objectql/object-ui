---
'@object-ui/core': minor
'@object-ui/fields': minor
---

Refuse an empty or non-string `$icontains` / `icontains` comparand in `ValueDataSource`,
and stop `FilterConditionField` emitting the shape (objectui#8748).

**This moves the accept set of a published adapter**, in both filter dialects, which is
why the two halves ship together.

Measured before the change, over `@objectstack/spec`'s own `FILTER_TEXT_ROWS`:
`{ name: { $icontains: '' } }` and `['name', 'icontains', '']` each returned **all nine
rows with not one console line** — every value contains the empty substring, so the arm
ran and constrained nothing. `{ name: { $icontains: 42 } }` was evaluated after a
`String(42)` coercion nobody wrote. `FILTER_TEXT_CASES` (`@objectstack/spec/data`)
carries both shapes as REJECTION rows (`code: 'INVALID_FILTER'`,
`mustMention: ['$icontains']`), so this face was answering a published table's rows the
wrong way, in the same widening class objectui#7349 and objectui#8447 already fixed here.

**`@object-ui/core`.** The `icontains` and `$icontains` arms now check the comparand
before folding: anything that is not a NON-EMPTY STRING excludes the row and drains one
console refusal naming the operator and the field. That is this face's declared refusal
shape (objectui#7349) — the row is excluded and logged, **not** thrown; the throwing
envelope is the wire-side `@object-ui/data-objectstack`'s, whose job is deciding whether
to send a query at all. The sibling positive operators (`$contains` / `$startsWith` /
`$endsWith`) are deliberately **not** widened by analogy: the published table declares
the refusal for `$icontains` and for no other operator, and that asymmetry is pinned.

**`@object-ui/fields`.** `condToMongo` now drops a text-operator condition whose
comparand is empty (`contains`, `containsCaseInsensitive`, `notContains`, `startsWith`,
`endsWith`; `undefined` / `null` / `''`) instead of emitting it verbatim. This half is
what makes the refusal safe rather than a regression: a builder row with the operator
chosen and the value box still empty authored exactly the refused shape, so refusing it
in the matcher alone would have flipped that list from "every row" to "no rows" — the one
outcome `ValueDataSource`'s own `$exists` arm names as worse than the bug. The
value-less operators (`isNull` / `exists` / `isEmpty` and their negations) read no
comparand and are untouched, as is `equals ''`, which is a real predicate.

**Migration.** An author who wrote an empty or numeric `$icontains` comparand was getting
either every row or a coerced answer; they now get no rows and a console line naming the
operator. Write a non-empty string comparand, or drop the condition.
