---
'@object-ui/fields': minor
---

fields: validate a STORED `location` value on an edit form (objectui#6744)

`buildValidationRules` is the producer of the host-side `error` prop that every
field widget's published objectui#3222 slot reads, and it had no branch for
`location`. So a coordinate that was **already in the record** and violated the
spec's range was never validated on an edit form: the control rendered it,
nothing marked it invalid, and submitting re-wrote it unchanged.

It now compiles a `validate.location` entry that adjudicates a present value
against `valueSchemaFor(field, 'stored')` — the platform's own value-shape
contract (ADR-0104 D1), the same schema the engine's record validator checks a
stored `location` against. An out-of-range stored value now marks the control
invalid, renders the spec's own complaint, and blocks the write; a legal value
is untouched.

⛔ The bounds are not restated in objectui. A hand-copied range would be a second
contract free to drift from the spec (AGENTS.md #0.1), so the schema is asked and
the message is built from its issues — the same discipline `LocationField`'s own
range refusal already follows.

Deliberately unchanged:

- **Input-time refusal (objectui#6714/#6716) is still the widget's.** A refusal
  means `onChange` never fires, so the typed text never becomes a form value and
  this rule is handed `undefined`. The two do not overlap.
- **Absence is `required`'s business.** The spec's schema refuses `null` and
  `undefined` outright because it describes a *present* value, so the rule asks
  core's `isMissingForRequired` — the repo's single presence contract — rather
  than inventing a second definition of "empty". A create form with an untouched
  location field is unaffected.
- **A field-authored `validate` keeps running**, composed under its own key
  rather than replaced.
- **Scope is `location` only.** Whether other field types have the same
  stored-value gap is a separate question and was not surveyed here.
