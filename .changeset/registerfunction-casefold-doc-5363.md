---
'@object-ui/core': patch
---

`ExpressionEvaluator.registerFunction` now documents the case-fold it has always
performed: the name is stored — and must be called — in UPPER CASE
(objectui#5363).

`registerFunction('formatCurrency', fn)` registers `FORMATCURRENCY`, because the
method delegates to `FormulaFunctions.register`, which stores under
`name.toUpperCase()`. That fold is correct for the spreadsheet-style built-in
vocabulary (`SUM`, `IF`, `UPPER`) and is unchanged here — but nothing declared
it on the public method, and two things keep it from being self-evident at the
call site. The registry API stays case-insensitive, so `getFormulas().has()` and
`.get()` both answer to the original spelling and never reveal the fold; only
expressions see the stored key, because the evaluation scope is built from
`FormulaFunctions.toObject()`, a plain object whose identifiers are matched
case-sensitively. And a wrong-case call site does not raise: `evaluate()`
catches, warns, and returns `defaultValue ?? expression`, so the template
renders its own `${...}` source as literal text on screen rather than erroring.

Behavior is untouched — this is the declaration catching up with what the code
enforces. It ships as a patch rather than as an empty changeset because the
JSDoc is emitted into the published `dist/evaluator/ExpressionEvaluator.d.ts`,
so it is what consumers see on hover.

`ExpressionEvaluator.test.ts` gains three cases pinning the half that was
uncovered — that the given spelling does *not* resolve in an expression, that
the failure renders the raw template source instead of throwing, and that the
registry API stays case-insensitive underneath — so making registration
case-preserving fails a test instead of silently invalidating the new JSDoc.
