---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(app-shell): give inline `lookup` action params a real record picker (#3405)

An action parameter declared inline as `{ name: 'inspector', type: 'lookup',
reference: 'sys_user' }` always rendered as a plain text input asking the user
to paste a record id (UUID) — a supervisor assigning an inspector had to go
find that person's UUID by hand, while the same reference field picks records
by name in the create/edit dialog.

`paramToField()` degrades a picker param to text when it has no `referenceTo`
target, and `referenceTo` was only ever populated on the field-backed branch of
`resolveActionParams()`. The inline branch dropped the authored `reference`
key entirely (as did the spec schema, which stripped it as unknown), so an
inline picker could never reach `<LookupField>` no matter how it was authored.

- `resolveActionParam()` now maps an inline `reference` onto `referenceTo` — on
  the inline branch, on the missing-field fallback branch, and as an override
  on the field-backed branch (matching how every other inline value overrides
  the resolved field).
- The text degradation now warns in dev naming the offending param, since with
  `@objectstack/spec` rejecting a targetless inline picker at parse time it
  means the metadata is broken, not merely partial.
- The fallback's placeholder and help text no longer claim "a picker is coming
  soon" — the picker has shipped, and the message now says the parameter has no
  reference object configured. Updated across all 10 locales.
