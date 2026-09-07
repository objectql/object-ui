---
'@object-ui/core': minor
---

`DataScopeManager` now **denies** a row when a row-level scope rule carries an operator its evaluator does not implement. It used to **admit** the row.

Behaviour change on a permission boundary, stated plainly. `evaluateFilter` implements nine operator spellings — `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `in`, `nin`, `contains` — and its `default` arm returned `true`, so a stored `RowLevelFilter` carrying any other spelling passed every record the rule existed to hide, silently: no error, no console line, only a result set that was too large, which looks exactly like a correctly configured permissive scope. The arm now returns `false`, the answer `evaluateCondition` in `@object-ui/permissions` already gives from its own `default` arm. Because `applyFilters` ANDs a scope's rules, one unrecognised rule now denies every row in that scope.

Who this reaches, measured on this release's base rather than assumed. The `RowLevelFilter['operator']` union is closed, so no TypeScript caller can write an unimplemented spelling, and no code in this repository constructs a `RowLevelFilter` outside the evaluator's own test. The path that changes is scope configuration read back from stored or hand-written JSON and handed to `setFilters` / `registerScopeWithConfig`, where the operator arrives as a plain string the type never checked. A deployment holding such a rule with a spelling outside the nine — including the spec's canonical `equals` / `not_equals` / `greater_than` / `starts_with` and the null-ness family `is_null` / `is_not_null`, none of which have an arm — sees fewer rows from that scope after upgrading, never more. Those spellings are not implemented here; they are refused instead of admitted. Whether to canonicalise them through the spec's `canonicalAstOperator` is left open on objectui#7378.

Graded `minor` because a release reader can observe the narrowing on stored data; the declared type is unchanged and the set of spellings the evaluator accepts has not widened.
