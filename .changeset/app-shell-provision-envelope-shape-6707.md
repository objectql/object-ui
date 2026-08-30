---
'@object-ui/app-shell': minor
---

`provisionProductionEnvironment` now REFUSES a success payload whose `data`
carries no `environment` row, instead of resolving best-effort (objectui#6707).

objectui#6629 fixed this consumer to read the created environment from the
nested `environment` key, but deliberately left the envelope check alone: it
catches a **missing** `data` and says nothing about `data`'s **shape**. So a
producer that regressed to a flat payload would once again resolve successfully
with `id` and `hostname` both `undefined` — the same silent outcome #6629 had
just fixed, reachable again by a producer change alone.

A flat payload is a producer contract violation, not a second dialect to be
tolerated, and tolerating it is how the original defect stayed invisible. The
call refuses it now, which routes a producer regression to this call's already
documented failure path rather than a successful-looking no-op: the sole caller
(`CreateWorkspaceDialog`) already wraps the call in `try`/`catch`, logs a
warning, and lets the onboarding gate re-provision lazily on first navigation.
Workspace creation itself is unaffected — the caller does not re-throw, and it
never read this call's return value.

The refusal carries its own diagnostic, distinct from the missing-envelope one,
so a logged warning still distinguishes "the control plane did not wrap the
payload" from "it did not put the row where it says it does".

The wire shape this is written against is confirmed producer-side rather than
inferred from this consumer — the distinction is load-bearing, because before
#6629 the only in-repo artifact pinning this payload was a hand-written mock
pinning the bug shape. Both sources are recorded on the function's docblock.
