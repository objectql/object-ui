---
'@object-ui/app-shell': patch
---

`predicate.ts`'s `in [...]` membership check now names an element it cannot
parse instead of silently discarding the whole set.

`path in [...]` hands the bracketed text to `parseLiteral`'s array branch,
which JSON-parses it after normalising quotes. An element that is not a JSON
literal — a path, a bare identifier, a trailing comma — made that
`JSON.parse` throw, and the `catch` returned `[]` with nothing in the
console. `[].includes(anything)` is `false`, so the predicate silently read
FALSE FOR EVERY ROW, and — because the parse is whole-set, not per-element —
one bad element discarded every good literal sitting next to it too:
`data.type in ['text', data.a]` collapsed exactly as hard as `data.type in
[data.a]` alone.

Same family as objectui#4049 (a silently wrong verdict, zero warning) and the
same ruling: **diagnose only, zero semantic change.** The `catch` still
returns `[]` — an `in` set that fails to parse is still, and remains, the
empty set; this evaluator does not gain the ability to resolve a path inside
`in [...]` (that stays outside the declared subset). All that changes is that
a dev-mode `console.warn` now names the predicate and, best-effort, the
element that broke the parse.

Fixes objectui#4266.
