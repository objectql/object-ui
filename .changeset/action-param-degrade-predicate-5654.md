---
'@object-ui/app-shell': patch
---

**Behaviour change:** a `master_detail` action param with no reference target now
receives the same "paste a record id" placeholder and help text a targetless
`lookup` param has had since objectui#3405. Previously it degraded to a plain
text input exactly like `lookup` did, but silently — the user was shown an
unexplained empty box that wanted a bare record id.

The cause was two hand-maintained answers to one question. `paramToField()`
performs the degradation over RESOLVED widget keys (`lookup`, `master_detail`),
while `ActionParamDialog` decided who gets the hints with its own literal over
RAW param spellings (`'lookup' || 'reference'`). Neither set contained the
other: `master_detail` degraded with no hints, and `reference` was a copy of an
alias-table row the adapter folds to `lookup` before it tests membership.

`paramToField` now exports `paramDegradesWithoutTarget(param)` and both the
adapter's own fallback branch and the dialog's two hint readers ask it, so "who
degrades" and "who gets hints after degrading" are one member set answered once
(objectui#5654; same convergence shape as objectui#4770 / #4790 / #4815).

Params that already had the hints keep them, including the `reference` spelling;
a param that renders as text without having degraded (an unknown type) still
gets no picker hints.
