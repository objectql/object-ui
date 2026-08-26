---
'@object-ui/core': patch
---

`ExpressionEvaluator.evaluate` now reports a faulting `${…}` at most **once per authored
source** instead of once per evaluation (objectui#6444). It is the hottest of the three
predicate paths in this area — `SchemaRenderer` calls it for every `properties.*` value,
every `props.*` value and `content`, for every node, on every render — so a single broken
`${…}` prop in a 200-row list wrote 200 console lines per render, and 200 more on the next
one. Measured on the built evaluator before the fix: three identical faulting
`evaluateCondition` calls produced 3 lines where the `{ dialect: 'cel' }` envelope produced
1; the 200-row list produced 200. After: 1 in every case.

This is the one-per-source rate limit both sibling reporters already carry
(`warnPredicateFailure` in `fieldRules.ts`, `visibilityDiagnostic.ts` in `@object-ui/react`),
not a third mechanism. The dedupe key is the predicate's **authoring** identity — the fault
site plus the source text, never the scope it ran against — which is both the siblings'
precedent and the defect itself: the 200-row flood is one authored source evaluated against
200 distinct scopes, so a scope-sensitive key would emit all 200 lines again.

Nothing else moves. The two message texts are unchanged, a distinct broken source still gets
its own line, `EvaluationOptions.onFault` still fires on every fault (objectui#6038's passback
contract, so a caller doing its own warn-once bookkeeping keeps control of it), `throwOnError`
still throws on every evaluation, and no symbol is added to the published surface.
