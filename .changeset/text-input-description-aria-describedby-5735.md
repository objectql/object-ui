---
'@object-ui/components': patch
---

`element:text_input` now ties its authored `description` to the field with
`aria-describedby`, so assistive tech announces the helper text as the input's
accessible description instead of leaving it as an unassociated paragraph
beside the field (objectui#5735).

Before this the paragraph and the input were siblings with no programmatic
relationship: a screen reader moving to the field announced the label and the
value and never the helper text. The `label` half of the same block was already
wired (`htmlFor` against the input's `id`), which is what made the gap specific
to `description` rather than a general absence of a11y wiring — and the
identical key authored on a field INSIDE `renderers/form/form.tsx` has been
announced all along, so one authoring key behaved two ways depending on which
container the author reached for. It no longer does.

The paragraph's id is minted per instance with `React.useId()` — the same source
`FormItem` mints the form renderer's description id from — and deliberately not
derived from `schema.id`. The two associations in this block need ids on
opposite ends: `htmlFor` names the INPUT, whose id only the author can supply,
so that wiring still holds only when they gave the node an `id`; `aria-describedby`
names the PARAGRAPH, which the renderer owns, so the description association
holds unconditionally and cannot collide when two nodes share an authored id.
The attribute is emitted only when a paragraph is actually rendered — an absent
or empty `description` leaves the input with no `aria-describedby` rather than a
dangling reference.

The key's published `ComponentInput` description, which documented this gap in
so many words, is rewritten in the same change. Its closing advice — prefer
`label` for an instruction a user must not miss — is kept rather than deleted,
on a new basis: a description is announced after the field's name and screen
readers gate description text behind verbosity settings a user can turn down, so
it remains the half of the announcement most likely to go unheard.
