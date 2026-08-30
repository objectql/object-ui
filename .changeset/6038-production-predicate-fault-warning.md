---
'@object-ui/core': patch
'@object-ui/react': patch
'@object-ui/components': patch
---

A node-gate visibility predicate that FAULTS now says so in a production build, once per
distinct predicate source (objectui#6038, maintainer ruling 2026-08-25, option B: "the
silence is no longer an accepted property"). Observability only — no verdict moves.

`SchemaRenderer`'s visibility chain is fail-open: a predicate that cannot be evaluated
resolves to the same answer as one that said yes, so a gate that stops biting looks
exactly like a gate the author got right. The diagnostic that names it (objectui#5454 /
objectui#5687) sat behind a `__DEV__` short-circuit, because the only fault-detection
channel available was `throwOnError`, and on the CEL branch `evaluateCelCondition`
implements that by evaluating **twice** — too expensive to ship for every predicate of
every node.

**What production actually printed before, measured per dialect on the built evaluator**
— the card's premise held for one dialect of three, and the other two failed in opposite
directions:

| dialect | production console, before |
|---|---|
| bare string | **nothing** |
| `{ dialect: 'cel' }` envelope | one generic line, deduped per source |
| `${…}` template | one generic line **per evaluation**, never deduped |

So the dialect objectstack#11254 measured a live gate breaking on was the silent one,
while the template dialect was the console flood the ruling's rate-limit clause exists to
prevent.

**The fix reports the fault the evaluator already detected, at the same number of engine
calls.** `EvaluationOptions.onFault` is a new passback on `@object-ui/core`'s
`ExpressionEvaluator`: every fault site is already inside a `catch`, or already holds the
canonical engine's failure reason, so nothing is evaluated twice. It mirrors, one layer
up, the seam `FieldPredicateDiagnostic` already documents (`warn: false` plus a reason
passback), and supplying it transfers reporting to the caller so one fault stays one
line. Pinned: the CEL branch performs the same number of record reads with the passback
as without it, and strictly fewer than the `throwOnError` probe.

`SchemaRenderer` passes it in production and reports through the **same** reporter the dev
branch uses — same message, same severity, same dedupe `Set`, same key. Development and
production now print the identical line for the identical fault; the `__DEV__` gate no
longer decides *whether* a fault is reported, only *how* it is detected.

`page:tabs` item-level `visibleWhen` (`@object-ui/components`) is covered by the same
reporter and the same rate limit. It swallowed the identical fault under a different
helper, and it was the worse of the two: the node gate at least reported in development,
while a faulting item predicate was silent in *both* builds on a gate whose false verdict
removes an entire tab, header and panel.

**Rate limit:** deduped per (node type, gate key, predicate source) — never per render and
never per node instance. A two-hundred-row list of one broken predicate is one line; a
second distinct predicate source still gets its own line. Both halves are pinned, because
a test that asserts only "a warning was emitted" is equally green on an implementation
that emitted fifty, and one that asserts only "exactly one" is equally green on an
implementation that suppresses everything.

**Not changed by this card, deliberately:** the fail-open semantics themselves; the
objectui#5687 adapter-only `data.*` report, which stays development-only under its own
2026-08-22 ruling (that path is not a fault — the predicate evaluated perfectly, against
the wrong object); and the `/forms/:name` scope wiring of objectui#6262, which lands in
its own PR.

`reportUnresolvableVisibilityPredicate`, `formatUnresolvableVisibilityMessage`,
`UNRESOLVABLE_VISIBILITY_PREFIX` and `__resetVisibilityPredicateWarnings` are now exported
from `@object-ui/react` so every surface that evaluates a node `visibleWhen` shares one
reporter and one rate limit — a second copy would mean a second dedupe `Set`, and one
authored predicate would be entitled to one line per package instead of one line.
