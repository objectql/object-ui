---
"@object-ui/core": patch
---

fix(core): evaluate bare CEL predicates in `evaluateCondition`

`ExpressionEvaluator.evaluateCondition` delegated to `evaluate`, which only
processes `${...}` templates and returns any other string verbatim. A bare
predicate such as `record.status == "converted"` (the shape `objectstack build`
emits for `disabled`/`visible`/`condition`) was therefore returned as a
non-empty string and coerced to `true` — so every bare-expression predicate was
silently always-truthy.

The most visible symptom: a param-collecting `api` action invoked from the
record header (e.g. CRM "Reassign Lead") was treated as permanently `disabled`,
so `ActionRunner.execute` bailed before opening the param dialog. The renderer
(`page:header`) was unaffected because it evaluates via `evaluateExpression`
directly.

`evaluateCondition` now treats a non-`${}` condition as a single expression
(via `evaluateExpression`), keeps the `${...}` template path, and preserves the
"empty/undefined ⇒ visible/enabled" and "unparseable ⇒ default visible/enabled"
fallbacks. Also hardens `ActionRunner`'s `disabled` gate to evaluate the
boolean/string/envelope form rather than treating any object as truthy, and
unifies the grid row-action predicate scope so `record.*` and bare-field
predicates resolve identically on every surface.
