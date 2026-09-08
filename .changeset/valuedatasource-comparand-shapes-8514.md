---
'@object-ui/core': minor
---

`ValueDataSource` reads the two comparand shapes it used to compare by reference.

**An ARRAY comparand is refused rather than compared by reference**
(objectui#8514). `{ tags: ['a', 'b'] }` took the simple-equality branch and
`!==` compares references, so it excluded every row including the deep-equal
one — silently. It is now excluded with a logged reason naming `$in`, in both
dialects and on the `$`-operator positions too. The equality positions move no
rows (a reference comparison already excluded everything); the negations do:
`$ne` / `!=` against an array was always true, so it had been selecting EVERY
row in silence.

The repair is a refusal rather than a deep-equality reading because the spec
declines to rule on an array outside `$in` / `$nin` / `$between`, and the two
in-memory matchers nearest this one both refuse it — inventing a reading here
would be a second de-facto contract the wire does not honour. Every producer in
this repo already spells a multi-value comparand `{ $in: [...] }`.

**A `{ $field }` comparand is now resolved** (objectui#8515). The spec declares
it, `@objectstack/formula` emits it, and both platform evaluation paths execute
it; this adapter compared the reference object, so such a filter answered with
no rows and no diagnostic. It is now dereferenced against the record on the six
scalar comparisons it is declared for, in both dialects. A reference in a list
position, one carrying an `addDays` offset, a dotted path, and a non-string
`$field` are refused with the reason — an `addDays` silently dropped would
return wrong rows rather than none.
