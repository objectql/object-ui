---
"@object-ui/app-shell": patch
---

`DeclaredActionsBar` binds its row through the shared `usePredicateRecordContext`

The bar held an inline copy of the three-way row binding — `{ ...row, record: row, data: row }`, added by objectui#4077 to fix its root-only predicate scope. objectui#4079 fixed the same fault on the four generic action renderers and gave the rule one name instead of a fifth copy: `usePredicateRecordContext`, exported from `@object-ui/react` beside `useCondition`. The bar now calls it.

No verdict changes on any row: the two copies agreed wherever a row exists, which is every surface that mounts this bar today. They differed in one corner, and the helper's semantics are the ones kept — with **no** row, the bar now binds nothing where it used to bind `{ record: {}, data: {} }`. Since `useCondition` merges this context over the ambient predicate scope, the old shape blanked out a `record` a host had put in the scope itself; "this surface has no row" and "this surface's row is empty" are now distinct here too.

Two implementations of one binding rule is what objectui#3367 / #3842 rule against, and this family already paid for it once at the `toPredicateInput` level (objectui#3314: two normalizations drifted, and the same `visible:` predicate reached different verdicts depending on which path surfaced the action). Nothing had drifted here yet — the next edit to the rule is what this closes off.
