---
'@object-ui/plugin-detail': patch
---

Inline edit: a rejected save now says WHICH field the server refused, and why.

Editing a record in place on a detail page and hitting Save used to surface the
backend's own string when the write was refused — `VALIDATION_FAILED:
Validation failed for crm_opportunity` — leaving the user to guess which of the
fields they had just edited was the problem. The refusal has always been
field-scoped (`@objectstack/objectql`'s validators throw `VALIDATION_FAILED`
with `fields[]`, and both the REST layer and the runtime dispatcher pass those
entries through intact); the inline surface was the last one still dropping
them. `<InlineEditSaveBar>` now renders one reason per rejected field, named by
that field's own label — the same treatment record forms have had since #3222.

Attribution never guesses. It reads the envelope through
`@object-ui/react`'s `extractFieldErrors`, the single in-repo normaliser the
form surface already uses, and an entry with no usable `field` is dropped
rather than pinned on whichever input is nearby. In the drawer's callback mode,
where persistence loops `onFieldSave(field, value)` one key at a time, a
rejection is attributed to the key that was in flight — a fact about the write,
not an inference. Anything that is not field-scoped (a network failure, a
permission denial) keeps the cleaned single-line message it had before.

Also recorded in code, per the maintainer's ruling on objectui#6868: **the
server is the validation authority on the inline-edit surface.** That was
previously an absence — `InlineFieldInput` runs no rules and takes no `error`
prop — and it is now a decision, written into both modules' headers with a
pointer to the ruling. No client-side rule evaluator was added, and none should
be: the server is the only rule source, and this surface only presents it.
