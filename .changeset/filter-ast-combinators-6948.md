---
'@object-ui/core': minor
'@object-ui/data-objectstack': patch
---

`convertFiltersToAST` lowers the `$and` / `$or` combinators to real ObjectQL AST
group nodes (objectui#6948).

`FilterCondition` declares `$and` / `$or` / `$not`, and this repo's one lowering
had no branch for any of them. `$and` / `$or` fell through to the
simple-equality branch and became a leaf naming a field literally called `$and`
/ `$or`. That leaf reached the server intact — `parseFilterAST` reads
`['$or', '=', [...]]` back as a real `$or`, so the wire condition was correct
and is unchanged by this release — but it is a well-formed *comparison* node, so
every AST evaluator in this repo read `$or` as a field name, found no such key
on any record, and returned an EMPTY list with no error. Producers that reach
this today include `mergeFilters` (dashboard scope broadcast, dataset report
blocks), `FilterConditionField`, and `Field.relatedListFilter`.

`minor` rather than `patch`: shipped results move. A list filtered by a
combinator through any in-process data source went from zero rows to the rows
the author asked for, and an unknown or refused operator *inside* a combinator
branch — which used to travel to the wire unchecked inside the leaf's value slot
— is now refused at the same door as every other operator.

`$not` is refused with an accurate message instead of translated: the AST has no
negation keyword (`FILTER_ARRAY_LOGIC_KEYWORDS` is `['and', 'or']`) and several
operators it carries have no negated counterpart, so a rewrite would be silently
partial. It threw before this change too, naming the author's own nested field
as a bogus operator; the verdict is unchanged, only the diagnostic.
