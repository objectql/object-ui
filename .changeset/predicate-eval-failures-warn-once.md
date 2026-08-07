---
"@object-ui/core": patch
"@object-ui/components": patch
"@object-ui/plugin-form": patch
"@object-ui/app-shell": patch
---

Conditional-rule predicates that fail to evaluate are no longer silent
(objectstack#5149, appeal 2). `evalFieldPredicate` — the canonical funnel for
`visibleWhen` / `readonlyWhen` / `requiredWhen`, view-level `visibleOn`, legacy
`condition`, per-option `visibleWhen`, screen-field predicates and list
conditional formatting — now logs **one `console.warn` per predicate text**
when evaluation fails (parse error, unbound identifier, engine fault), carrying
the predicate source, the engine's failure reason, and the field/rule locator
the call site provides. Renderer call sites thread that locator
(`visibleWhen of field 'amount'`), so a broken predicate identifies itself in
the browser console instead of being indistinguishable from an absent one.

Verdicts are unchanged: evaluation still fails open to the caller's safe
default (flipping that default is objectstack#5149 appeal 1, tracked
separately). Fault-probing callers (`evalRowPredicate`'s fail-closed path,
`ExpressionEvaluator`'s `throwOnError`) opt out via the new
`diagnostic.warn: false` and keep their own single diagnostic, so no broken
predicate ever warns twice.
