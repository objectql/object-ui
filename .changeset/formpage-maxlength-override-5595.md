---
'@object-ui/console': patch
---

`buildSections` now honours a FormView field's `maxLength` override instead of always
taking the object's ceiling (objectui#5595).

The function merges a form's field overrides with the target object's field definitions,
and its own docstring states the rule: *"Field-level FormField overrides take precedence
over object defaults."* Every key in the loop is built that way — `override.label ??
def.label`, `override.required ?? def.required`, `override.placeholder ?? def.placeholder`
— except one, which read `def.maxLength` unconditionally. So an author who set a tighter
per-form limit (a short public intake form over a column whose object-level ceiling is
generous) got the generous one.

The failure was silent in the worst direction: no diagnostic, no warning, and the form
still submits, so the symptom is a value the author believed the input refused being
accepted. It is load-bearing rather than cosmetic — the merged row reaches the DOM at two
`maxLength={field.maxLength}` sites, the `textarea` arm and the default `input type="text"`
arm.

`override.maxLength ?? def.maxLength` — `??` rather than `||`, matching the sibling keys,
so an explicitly declared `0` stays a value the author wrote rather than falling through
to the column's ceiling. This narrows only what the input allows; the object's storage
ceiling still decides at submit time, so nothing that was accepted before is now rejected
anywhere but at the keyboard.

Why it survived: the console's local `FormFieldSpec` did not declare `maxLength` at all
until objectui#5542, so no one typing a spec in this app could write the override in the
first place, and the inert merge branch was never exercised. #5542 converged that type
onto the shared app-shell declaration, which does declare the key — making the gap
expressible, and therefore findable.

The pin `#5542` left behind — `expect(row.maxLength).toBeUndefined()` in
`FormPage.fieldSpec.test.ts`, which recorded the old answer explicitly rather than
assuming it — is **inverted** to `toBe(40)` rather than deleted. It was the pre-registered
evidence for this fix, and it is what made the gap findable in the first place, so it
keeps its place and names the honoured answer.
