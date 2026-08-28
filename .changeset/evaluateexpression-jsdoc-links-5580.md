---
'@object-ui/core': patch
---

Both `evaluateExpression` references in the `ExpressionEvaluator.registerFunction`
JSDoc are now qualified, so each resolves to the entity it means (objectui#5580).

`ExpressionEvaluator.ts` declares two things spelled `evaluateExpression`: the method
on `ExpressionEvaluator` (bare expression, throws) and the module-level export
(context bag, fail-soft, delegating to `evaluate`). The `registerFunction` block
referred to both under the one spelling, four lines apart.

The prose link was not merely ambiguous, it was bound wrong. Measured with
`checker.getSymbolAtLocation` on the pre-fix source, `{@link evaluateExpression}`
resolved to the module-level `FunctionDeclaration` — the fail-soft one — inside the
sentence that calls it *"the throwing sibling"*. The neighbouring `{@link evaluate}`
binds to the method, but only because no module-level `evaluate` exists to outrank
it, so the rule "an unqualified link resolves to the enclosing class's member" does
not hold here. The link is now `{@link ExpressionEvaluator.evaluateExpression}`,
which the checker resolves to the `MethodDeclaration`.

The `@example`'s final line is the module-level export — its second parameter is a
context bag and the `${...}` wrapper only resolves on the `evaluate` path — but it sat
two lines below calls that establish `evaluator.` as the receiver, and a `.d.ts` hover
carries no import to disambiguate. It now names the module-level export and shows the
import it needs.

This is prose only: the diff is confined to a block comment and no declaration moves.
It is scored `patch` rather than the empty-frontmatter form because the block is
emitted into what npm ships — measured, this edit moves both
`dist/evaluator/ExpressionEvaluator.d.ts` and `dist/evaluator/ExpressionEvaluator.js`
(this package builds with a bare `tsc`, which preserves comments in the JS emit), and
the ten changed lines in that JS are all comment lines.

`registerFunction-jsdoc-links.test.ts` pins the binding against the checker rather
than asserting it in prose, since a `{@link}` that binds to the wrong entity is
indistinguishable in source from one that binds right.
