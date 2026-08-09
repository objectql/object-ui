---
"@object-ui/core": patch
"@object-ui/react": patch
---

Blank predicates and non-predicate values are no longer gates, at the last three entries that still judged them (objectui#3955, objectui#3957, objectui#3960)

objectui#3850 sank "is a predicate gate DECLARED here?" into one definition,
`@object-ui/core`'s `hasDeclaredPredicate`. Three places were left out of that
ruling's placement clause, each with the same shape of defect: the evaluator's
single default for "there is nothing here to evaluate" is `true`, meaning
*visible/enabled*, and wherever a too-wide "declared" test hands it an empty
predicate on an INVERTED key, that `true` turns a control off for a value the
metadata never used to say anything.

**`SchemaRenderer`'s `hidden` / `hiddenOn` legs (objectui#3955)** asked
`!== undefined` and did NOT negate the verdict, so an empty predicate meant HIDE
and the node disappeared — on the generic rendering path, since that block runs
for every schema type. Harder to diagnose than the `disabled` twin objectui#3862
fixed: a greyed-out control is still on screen, while a node that never rendered
is indistinguishable from metadata that meant to hide it. Both legs now read the
shared definition.

**The "blank" criterion now covers the envelope spelling (objectui#3960).** The
definition trimmed a whitespace-only STRING and not an envelope's whitespace-only
`source`, because `toPredicateInput` folds a `source` of `''` and does not trim.
So `{ dialect: 'cel', source: '   ' }` was a declared gate whose verdict came from
core's own CEL entry calling that exact value "no predicate" (`if (!source.trim())
return true`) — `disabled` greyed out forever and `ActionRunner.execute` answered
`{ success: false, error: 'Action is disabled' }` with the handler never invoked.
Blankness is now decided once for both spellings, at the definition. The
NORMALIZER's contract is deliberately unchanged: "what shape does the evaluator
accept" is not the same question as "is there a condition", and moving the trim
there would have flipped verdicts for every
`useCondition(toPredicateInput(…))` call site, including container-level `visible`
reads that never asked this question at all.

**`ActionEngine.getActionsForLocation`'s `visible` filter (objectui#3957)** was the
last consumer answering the question with a range of its own — three empty
spellings folded by hand, everything else coerced with `Boolean(raw)`. It now reads
the shared definition and the coercion branch is gone, so one value no longer gets
two answers depending on whether an action was surfaced by the engine or rendered
standalone (the invariant objectui#3314 established). Its fail-CLOSED posture on a
predicate that THROWS is untouched (`throwOnError: true` + `warnHiddenPredicate`):
"the predicate faulted" and "there is no predicate" are different facts.

Behaviour changes, before → after. Observation-class: each needs an author to write
an empty/blank predicate or a non-predicate value, and there is no known user path
today.

| value | `ActionEngine` `visible` | `SchemaRenderer` `hidden` | `disabled` (action face + generic path) | `ActionRunner.execute` `disabled` |
|---|---|---|---|---|
| `''` / `null` | shown → shown | HIDDEN → rendered | unchanged | unchanged |
| `'   '` (blank text) | HIDDEN → shown | HIDDEN → rendered | unchanged | unchanged |
| `0` / `NaN` | HIDDEN → shown | HIDDEN → rendered | unchanged | unchanged |
| `{}` / `[]` | shown → shown | HIDDEN → rendered | unchanged | unchanged |
| `{ dialect: 'cel', source: '' }` | shown → shown | HIDDEN → rendered | unchanged | unchanged |
| `{ dialect: 'cel', source: '   ' }` | shown → shown | HIDDEN → rendered | GREY → on | refused → runs |
| `{ source: '   ' }` (no dialect) | HIDDEN → shown | HIDDEN → rendered | GREY → on | refused → runs |
| `true` / `false` / bare CEL / `${…}` / a non-blank envelope | unchanged | unchanged | unchanged | unchanged |

Every row moves toward "there is no gate here", never away from it, and no value
that HAS a verdict changes it — a declared `false` is still a verdict, not a
missing gate (objectui#3812), and blankness is `trim()`, not "short": `{ dialect:
'cel', source: ' x ' }` is a predicate. One alias precedence changes with the
`hidden` legs and is pinned rather than claimed as an equivalence: an undeclared
`hidden` no longer short-circuits the chain, so a declared `hiddenOn` is finally
consulted.

`SchemaRenderer`'s four `visible*` legs keep `!== undefined` deliberately, as
objectui#3850 ruled: their `true` is negated, so an empty predicate already lands
on "shown", and narrowing them would change alias precedence rather than fix
anything.
