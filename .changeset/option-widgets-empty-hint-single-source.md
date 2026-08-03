---
"@object-ui/components": patch
"@object-ui/fields": patch
"@object-ui/i18n": patch
---

The option widgets' "this list cannot be filled" message now has one source, and
it is translated (objectui#3231).

FROM: `SelectField`, `MultiSelectField`, `RadioField` and `CheckboxesField` each
carried their own copy of the empty/gated state, each destructured the declared
`emptyHint` prop into `_emptyHint` and dropped it, and each rendered a hardcoded
English literal (`'No options available'`, `` `Select ${…} first` ``) even in a
Chinese or Japanese session. TO: one shared `OptionsEmptyState` — the host's
`emptyHint` when it supplied one, otherwise a translated fallback
(`fields.options.empty` / `fields.options.selectFirst`, added to all ten locale
packs).

`emptyHint` was declared, produced by the form renderer and transported, then
lost three times over — so no registered widget could ever render it. All three
breaks are fixed, because closing only the last one delivers nothing:

- `isOptionField` compared the raw resolved type against `'select'` /`'radio'` /
  `'multiselect'` / `'checkboxes'`. Object-derived forms emit
  `mapFieldTypeToFormType`'s prefixed ids (`field:select`), which matched none of
  them, so for every option field coming from an object schema — the normal case
  in the console — the whole cascade block was skipped and no hint was computed
  at all. It now normalizes the `field:` prefix, the same normalization
  `stripRegisteredFieldProps` already applied a few lines below.
- `stripRegisteredFieldProps` then removed the `emptyHint` key from what was
  left. It is now forwarded to the four cascade option types, alongside
  `dependentValues`. This stays an allow-list rather than a blanket
  pass-through: every other registered widget spreads its leftover props onto a
  DOM node, where an unknown `emptyHint` attribute is a React warning.
- the widgets themselves discarded it. Keeping it out of the `...props` spread
  was correct; not using it afterwards was not.

User-visible effect: a dependency-gated option list now prompts with the
controlling field's **label** ("Select Country first") instead of its raw
metadata name, in the session's language; an unconfigured list says so in the
session's language too. The gate sentence is one i18n key shared by the renderer
and the widget fallback, so the two sides cannot word it differently.

Untouched: the built-in (unregistered) `select` branch of the form renderer,
which already consumed `emptyHint`. That is a separate live path.
