---
"@object-ui/core": patch
---

`condition: false` now actually prevents the action from executing (objectui#3872)

`ActionRunner.execute` — the engine's public execution entry, shared by every
action surface — gated conditional execution on `if (action.condition)`, i.e. on
the raw value's TRUTHINESS. Truthiness cannot answer the question the gate needs
answered ("did the author declare a condition?"), and on this key it answered in
the over-permissive direction: `condition: false` fell on `if (false)`, so the
whole block was skipped, `evaluateCondition` was never consulted, and the action
executed. Measured with a call-counting handler:

- `condition: false` — handler ran: **true**, result `{ success: true }`
- `condition: { dialect: 'cel', source: 'false' }` — handler ran: false, result `{ success: false, error: 'Action condition not met' }`

Two spellings of the same statement, opposite outcomes. `false` is the most
explicit "never execute this" metadata can carry — and what a template that
switches an action off emits — so the direction matters: the action really ran,
possibly writing. This is the over-permission half of the objectui#3492 family
(the `disabled` gate one line below is objectui#3848, whose defect pointed the
other way).

The gate now asks whether a `condition` gate is DECLARED before evaluating.
"Nothing to evaluate" is read from core's single predicate normalizer
(`toPredicateInput`, which maps `''`, `null`, an empty-`source` envelope and
non-predicate values to `undefined`), plus the whitespace-only string, which the
normalizer wraps rather than collapses — objectui#3850's ruling on the scope of
"empty predicate", the same one the `disabled` gate already applies. Once the
door asks the right question the verdict needs no boolean branch of its own:
`evaluateCondition` returns a boolean argument verbatim.

**Behaviour change surface, deliberately one-directional and one row wide.**
Exactly one shape changes verdict — a declared boolean `false`, from executing to
refused (`{ success: false, error: 'Action condition not met' }`, the message the
key already used). Everything else is byte-identical: `condition: true`, an
absent `condition`, and truthy expressions/envelopes still execute; falsy
expressions, falsy CEL envelopes and falsy `${…}` templates are still refused,
as before; the three empty predicates (`''`, whitespace-only, an empty-`source`
envelope) still execute, now because nothing was declared rather than because
`if ('')` happened to be falsy; and non-predicate junk (`0`, `{}`) still
executes — a value that is not a predicate must not decide an action's fate,
which is the fail-open posture this module already committed to for `disabled`.
So this change can only start refusing execution, never start allowing it — the
mirror image of objectui#3848's fix.

`ActionDef.condition` is widened to `string | boolean` to match what the gate now
honours (and the `disabled` key beside it). This is not a lenient consumer
alias: the boolean was always accepted at runtime through the interface's index
signature, it was simply ignored.

The value handed to the evaluator is deliberately left RAW rather than normalized
first, for the same reason as objectui#3848 with the sign flipped:
`toPredicateInput` wraps unconditionally, so an already-templated `'${x}'`
becomes `'${${x}}'`, fails to parse, returns verbatim and coerces to a constant
`true` — on `disabled` that blocks everything, on `condition` it would EXECUTE
everything. That normalizer defect is objectui#3871; a tripwire next to the new
pins goes red the day it is fixed.
