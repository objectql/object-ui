---
"@object-ui/core": patch
---

An empty `disabled` predicate no longer refuses to run the action (objectui#3848)

`ActionRunner.execute` — the engine's public execution entry, shared by every
action surface — gated on `action.disabled != null && action.disabled !== false`
and handed the value straight to `evaluateCondition`. That function documents one
default for "there is no condition here": return `true`, meaning
*visible/enabled*. On `disabled`, `true` means BLOCKED. So every empty predicate
was read as "disabled": the handler was never invoked and the caller got
`{ success: false, error: 'Action is disabled' }` — a state the metadata never
declared. Measured with a call-counting handler:

- `disabled: ''` — handler ran: false
- `disabled: '   '` (whitespace only) — handler ran: false
- `disabled: { dialect: 'cel', source: '' }` (the empty envelope `objectstack build` can emit) — handler ran: false

After objectui#3842 / objectui#3849 fixed the renderer halves, this was live
user-visible behaviour: the button became clickable and clicking it returned
`Action is disabled` — the renderer and the execution entry disagreeing about one
predicate value, the shape objectui#3314 already paid for once.

The gate now asks whether a `disabled` gate is DECLARED — whether there is a
condition to reach a verdict on — before evaluating. "Nothing to evaluate" is
read from core's single predicate normalizer (`toPredicateInput`, which maps
`''`, `null`, an empty-`source` envelope and non-predicate values to
`undefined`), plus the whitespace-only string, which the normalizer wraps rather
than collapses and which `evaluateCondition` itself calls "no condition"
(`evalRowPredicate` applies the same blank-source rule).

**Behaviour change surface, deliberately one-directional.** Only values with
nothing to evaluate change, and only from blocked to allowed: `''`,
whitespace-only, an empty-`source` envelope, and non-predicate junk (`0`, `{}`,
which previously coerced to "disabled"). `disabled: true`, a truthy expression
and a truthy CEL envelope still block; `disabled: false` and an absent `disabled`
still run; no expression- or envelope-valued predicate changes verdict. The
existing `catch { isDisabled = false }` fail-open posture is untouched, and this
change can only stop blocking things, never start.

The value handed to the evaluator is deliberately left RAW rather than normalized
first. `evaluateCondition(toPredicateInput(x))` is not interchangeable with
`evaluateCondition(x)` for a string that is already a `${…}` template:
`toPredicateInput` assumes a bare expression and wraps unconditionally, so
`'${x}'` becomes `'${${x}}'`, fails to parse, returns verbatim, and coerces to a
constant `true` — a template-spelled predicate evaluated that way is ALWAYS
"disabled", whatever it says. That normalizer defect is filed as objectui#3871
(it is live at the action renderers and `ActionEngine`, while `SchemaRenderer` and
`page:header` evaluate the raw value and pin the correct verdict); a tripwire next
to the new pins goes red the day it is fixed. Two rows therefore still differ
between the execution and renderer paths, each recorded with its owning issue:
the empty envelope (objectui#3850 owns the renderer half's scope ruling) and the
`${…}` spelling (objectui#3871).
