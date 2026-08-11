---
"@object-ui/app-shell": patch
---

`DeclaredActionsBar` reads `visible` / `disabled` off the typed action def instead of through `(action as any)`.

The `disabled` cast was the one the maintainer's 2026-08-06 ruling on
objectstack#4075 named: `ActionDef.disabled` was hand-written as
`string | boolean` and could not describe the `{ dialect, source }` envelope the
spec emits, so the bar had to reach around the type to evaluate it. With both
keys now derived from the spec's unified three-arm shape (`@object-ui/core`, step
3) there is nothing left to reach around. The adjacent `visible` casts go with
them for the same reason — step 2 declared `visible` and deleted `ActionEngine`'s
equivalent casts, but missed this file's.

No behaviour change: `toPredicateInput` and `hasDeclaredPredicate` both take
`unknown`, so the casts only ever affected whether the property access compiled,
never which verdict it produced.
