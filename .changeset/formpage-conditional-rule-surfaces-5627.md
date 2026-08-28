---
'@object-ui/console': patch
---

`FormPage` — the console's own form renderer, serving both the public `/f/:slug`
route and the internal `/forms/:name` one — now honours the three conditional-rule
surfaces it still dropped after objectui#5594: section-level `visibleWhen` /
`visibleOn`, and the object-level field rules `visibleWhen` / `readonlyWhen` /
`requiredWhen` (objectui#5627).

This is the second form renderer in the repo, and it honoured exactly one of the
four surfaces the sibling chain does. A section an author conditioned away rendered
in full — heading and every control — on both routes including the anonymous one.
The object-level half was worse than fail-open hiding: `readonly` was whatever the
static flag said, so a field a `readonlyWhen` should have locked stayed editable and
paired with the server's fail-closed unbound-scope behaviour into "the user edits,
the save reports success, and the value never lands".

Both halves evaluate through the SHARED machinery rather than a fourth consumer-side
copy of the rule semantics: `@object-ui/core`'s `resolveFieldRuleState` for the three
field rules — which brings the settled rulings with it, including the `serverOwnedValue`
carve-out that keeps a create form from requiring a producer-owned control (#4069 /
#4085) — and its `evalFieldPredicate` for the section predicate, with the canonical-first
`visibleWhen ?? visibleOn` read every sibling reader spells.

Visibility stays a RENDERING rule at both granularities: a hidden section's fields
still submit their values, exactly as a hidden field's have since #5594.
