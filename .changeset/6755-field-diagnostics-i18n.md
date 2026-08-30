---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

Field widgets say WHY they refused an edit in the reader's language
(objectui#6755, maintainer ruling 2026-08-29).

Three sentences a person has to read to recover from a refusal were string
literals in the widgets, inside a package whose locale channel 11 of its 55
widgets already use: `ObjectField`'s `Invalid JSON`, and `LocationField`'s
format and range refusals (objectui#6716 / #6714). So a zh / ja / ar user who
mistyped a coordinate or a JSON blob was told why in English, in a form whose
labels, gate hints and validation copy were all translated.

- All three now read from `useFieldTranslation` / `FIELD_DEFAULTS` under
  `fields.object.invalidJson`, `fields.location.refusedFormat` and
  `fields.location.refusedRange`, with entries in all ten locale packs — bound
  from now on by `check:i18n-drift`.
- The `en` values are byte-identical to the literals they replace, so English
  and provider-less rendering are unchanged, and the refusal pins of
  objectui#6716 / #6715 and `plugin-form`'s two refusal suites are untouched.
- `fields.location.refusedRange` keys the FRAME only: the interpolated
  `{{detail}}` is `LocationValueSchema`'s own complaint, because the widget must
  not restate the spec's bounds (a hand-copied range is a second contract).
- Not in scope, and recorded rather than folded in: `LocationField`'s third
  refusal sentence — the residue arm objectui#6715 added after the ruling was
  written — is still a literal. objectui#6888 carries it.
