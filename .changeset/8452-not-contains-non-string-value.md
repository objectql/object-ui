---
"@object-ui/core": patch
---

`ValueDataSource`: a stored value that is not a string now satisfies `not_contains`
/ `$notContains` instead of failing the operator and its negation both.

Both arms were written as `typeof value === 'string' && !value.includes(target)` — a
type test standing in for the predicate. A row whose column held the number `5`
failed `contains '5'` (correct: a number cannot contain a substring) and also failed
`not_contains '5'` (wrong: for that same reason it does not contain it), so the row
appeared in **no** filter answer, and the opposite filter — the one thing a user has
to debug a missing row with — was silent too. Measured on a mixed fixture,
`not_contains '5'` returned 1 of 8 rows where it now returns 7.

The arms are now the exact complement of `contains` / `$contains`. The positive text
operators are unchanged and keep their type gate: that is the other half of
objectstack#14079 (maintainer ruling 2026-09-05, option A) — a non-string never
satisfies a positive text operator and always satisfies `$notContains`, so
complementarity holds on every face.
