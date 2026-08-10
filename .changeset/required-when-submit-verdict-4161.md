---
'@object-ui/components': patch
---

Conditional required (`requiredWhen`) now decides at SUBMIT time too — the star and the validator can no longer disagree

A `requiredWhen` predicate that flipped to FALSE after the dialog mounted updated only half the form. The display layer re-evaluated correctly — the asterisk and `aria-required` both disappeared — while submit stayed refused with "<field> is required" and no write was ever issued. The user saw an optional field and a form that would not save, with nothing on screen naming the field it was still waiting on (objectui#4161).

The cause is not a mount-time snapshot, which is what the symptom looks like. The renderer hands react-hook-form its per-field rules as a `<Controller rules>` prop, and RHF *merges* that object into the field descriptor it already holds — `_f: { ...previous._f, ...options }`. A rule key that stops being spelled is therefore never removed. Rules could be ADDED live (a predicate flipping TRUE after mount did start enforcing, correctly) but never withdrawn: the `validate.required` entry installed the first time the predicate evaluated TRUE outlived every later FALSE verdict. The validation layer was append-only, latched on the first TRUE the field ever produced.

The `validate.required` entry is now registered unconditionally and decides required-ness when it *runs*, reading the live verdict the renderer publishes on every render — the same single `resolveFieldRuleState` result that draws the asterisk, not a second evaluation of the predicate with its own copy of the record assembly. Both directions are pinned: a predicate flipping FALSE re-opens submit, a predicate flipping TRUE starts enforcing, and statically required fields are unaffected.
