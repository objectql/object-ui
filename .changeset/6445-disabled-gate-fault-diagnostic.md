---
'@object-ui/react': minor
---

A `disabled` / `disabledOn` predicate that cannot be evaluated is now reported on the console, in development **and** in production — and the message says what this gate's fail-soft default actually did.

`SchemaRenderer` routes six visibility legs (`visibleWhen`, `visible`, `visibleOn`, `visibility`, `hidden`, `hiddenOn`) through one reporter, and called `evaluateCondition` **bare** on the two enablement legs — the only uninstrumented predicate pair in the file. A faulting `disabled` predicate had therefore never been reported in any build, in any dialect that does not report on its own.

It is also the pair whose fail-soft answer **bites**. `evaluateCondition` answers an unevaluable predicate with `true`; on the negated visibility legs that means SHOWN, here it means GREYED OUT. So the user got a control they could see and could not use, and the author got nothing to grep for.

- **Wiring only, one engine call.** Both legs pass `EvaluationOptions.onFault` (objectui#6038's seam), which hands back the fault the evaluator has already caught. No `throwOnError`, no second evaluation, no `__DEV__` split — dev and production print identical bytes.
- **No verdict moves.** The fail-soft `true` is preserved deliberately: a faulting `disabled` predicate still disables, exactly as before. Flipping that is a shipped-behaviour change and is not part of this.
- **Its own copy, not the visibility reporter's.** The shipped line says the safe default meant the gate "did NOT bite", which is written about a gate that shows the node. This gate's line says the opposite, because the opposite is true: `[ObjectUI] An enablement predicate could not be evaluated`, then the node, the key, the source, the engine's reason, and that the node renders disabled — on screen, greyed out — with nothing else on screen to say a predicate failed. One reporter, one dedupe, one severity; a second message.
- **Rate-limited exactly as the visibility gate is**, per `(node type, key, predicate source)`: two hundred rows of one broken predicate print one line, a second distinct source still prints, and the same source authored on `disabled` and on `visibleWhen` prints two — the gates cannot silence each other.
