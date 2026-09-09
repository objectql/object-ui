---
'@object-ui/core': minor
---

A field-rule predicate the author **declared and left blank** is no longer silent, and the
three fault directions in `resolveFieldRuleState` are now named and documented instead of
being bare positional booleans (objectui#8069). **No fallback value moves.**

**The blank hole.** `''` and `'   '` are authorable — `ExpressionWireSchema` is a bare
`z.string()` with no `.min(1)`, and `resolveFieldRuleState`'s own guard is `!= null`, so a
blank predicate passes both. `evalFieldPredicate` then returned the caller's fallback on its
first line, *before* `warnPredicateFailure` or `onFault` could fire. That is a third state,
not a spelling of either neighbour: the key is present (so it is not "the author wrote no
rule") and nothing evaluates (so no engine fault is raised). The one state an author reaches
by *starting* a rule and not finishing it was the one state that said nothing at all — which
is exactly what objectui#4051 / objectstack#5149 ruled out for every other fault.

Both spellings now report `[blank] the predicate is declared but empty — nothing to evaluate`
through the same single reporting site as every other fault, on both channels (the built-in
`console.warn` and the `onFault` passback, so the fault-probing callers that pass
`warn: false` are not silenced either). **Every verdict is unchanged**, including the
envelope spelling: `{ source: '' }` used to reach the engine and come back
"AST-only evaluation not yet supported; persist `source`" and `{ source: '   ' }`
"Unexpected token: EOF" — two misleading reasons for one author mistake, both already
resolving to the same fallback this change keeps. Blankness is decided by
`isBlankPredicateText` (`evaluator/declaredPredicate.ts`), the repo's one definition of that
question since objectui#3960, now exported for this second consumer rather than copied.

For this one fault class the once-per-predicate dedupe key joins the caller's **locator**: a
blank predicate has no distinguishing text, so every blank rule in an app shares the key
`""` and the first one would silence every other author's. Non-blank keys are unchanged.

**The named directions.** `resolveFieldRuleState` passed `true` / `false` / `false` as bare
third arguments and answered the adjacent "no rule declared" case with the *same* literal —
so every permissive value was written twice, and the "the rule broke" answer was chosen by
aligning it with the "the rule is absent" answer beside it. Six module-private constants now
spell the two questions apart (`*_WHEN_FAULTED` / `*_WHEN_ABSENT`), with one docblock
recording the direction, the fact that all three point the permissive way so a single
mistyped column yields a form that shows more, locks less and demands less at once, and what
the history does and does not record about why (objectui#1578 and ADR-0036 both carry a
per-key "a fault is safe" rationale; no commit puts the case where all three faults arrive
from one typo). `evalFieldPredicate`'s docblock gains the call-site policy table — five
distinct fault policies share this one helper, two of which detect a fault by calling it
twice with *opposite* fallbacks and therefore depend on `fallback` staying freely
specifiable.

Whether the direction belongs in the authored contract, and whether a loud-but-safe middle
should exist, remain open on objectui#8069.
