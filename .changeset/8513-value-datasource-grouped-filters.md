---
'@object-ui/core': patch
---

`ValueDataSource`'s object-dialect matcher executes `$and` and `$or`
(objectui#8513). A `provider: 'value'` list with a grouped filter returned
**zero rows**; it now returns the rows the platform's own conformance table says
it should.

**What moved.** `{ $or: [ … ] }` and `{ $and: [ … ] }` were refused by the
object-dialect matcher — the row excluded, the reason logged since
objectui#8447, and before that excluded in silence. They are now evaluated, and
they nest and AND with their sibling keys the way a `FilterCondition` says they
do. Refusing them made this adapter the one face answering "no rows" to a shape
`@objectstack/spec` declares, this repo's own `convertFiltersToAST` lowers, and
all five platform backends execute. **No accept set is widened**: no new
operator, no new key, nothing admitted that `FilterConditionSchema` does not
already declare.

**The empty-group identities** follow objectstack#5322 (merged as
objectstack#5365) — `{ $and: [] }` matches every row, `{ $or: [] }` matches
none, a `{}` branch is a TRUE disjunct that absorbs its `$or` and drops out of an
`$and`. They are not written as special cases: `every` and `some` already answer
that way for an empty array. Pinned against the spec's published cross-backend
`FILTER_LOGIC_CASES` table rather than a local fixture — 27 of its 29 cases pass,
up from 10.

**Why this is a fix and not a feature on the reachable path.**
`convertFiltersToAST` returns the ORIGINAL object when a filter lowers to no
conditions, and the TRUE identities are exactly that case — so `toFilterNode`
hands `{ $and: [] }` and `{ $or: [{}] }` back unlowered and every consumer on
that chain drops them straight onto `$filter`. Those two filters mean "every
row" and answered "no rows".

**`$not` is unchanged and still refused**, deliberately. Its NULL-safe semantics
are ruled (objectstack#5146), but this repo's `convertFiltersToAST` throws for it
on an AST-shaped narrowing — `FILTER_ARRAY_LOGIC_KEYWORDS` is `['and', 'or']`,
and rewriting the negation inward is silently partial because `startswith` /
`endswith` / `between` / `icontains` have no negated counterpart. Whether that
narrowing should stand now that upstream has ruled is a separate question. The
refusal now carries its own message naming `$not` rather than falling through to
the generic combinator arm, so the three combinators stay three distinct cases —
they failed in **opposite** directions before objectui#8447 and a fix must not
flatten them.
