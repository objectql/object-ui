---
"@object-ui/core": patch
"@object-ui/app-shell": patch
"@object-ui/data-objectstack": patch
"@object-ui/console": patch
---

chore(deps): align `@objectstack/formula` / `lint` / `client` to `^15.1.1`

These three were still pinned to `^14.6.0` while `@objectstack/spec` was already
`^15.1.1` — a version skew from the v15 upgrade (formula/lint/client publish in
lockstep with spec, and their own 15.0.0 entries are pure dependency bumps, so
this is alignment, not a behavioral migration).

Practical effect: the client-side field-rule evaluation
(`visibleWhen`/`readonlyWhen`/`requiredWhen` via `fieldRules.ts`, which delegates
to `@objectstack/formula`'s `ExpressionEngine`) now tracks the 15.x engine — and
will pick up the framework's `dateField == today()` equality fix
(objectstack-ai/framework#3205) automatically at the next 15.x release via the
caret range. Renderer/action `visible`/`disabled` predicates are unaffected (they
use the home-grown JS evaluator — tracked separately in #2661).
