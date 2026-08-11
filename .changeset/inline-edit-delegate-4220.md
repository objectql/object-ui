---
'@object-ui/plugin-detail': patch
'@object-ui/fields': patch
---

fix(detail): inline edit no longer destroys array values or flattens types on the record page

`InlineFieldInput`'s type switch ended in a raw text input, and every type it had
no branch for landed there: the value was displayed through `coerceToSafeValue`
and written back as whatever the user typed — a bare string.

Two damage classes survived the earlier passes. Array-valued fields (`tags`,
`checkboxes`, an options-less multi picklist) were offered for editing as
`"a, b"` — `coerceToSafeValue` joins arrays — and saved back as that string, so
the array was gone. Type-lossy scalars (`toggle`, `slider`, `progress`,
`rating`, `radio`) round-tripped through `String()`, so a boolean column
received `"true"`, a numeric one `"42"`, and `radio` accepted any free-typed
value its option list never offered.

Types the switch already routes keep their editors. Everything else that the
fields package can edit inline now falls back to `FieldEditWidget` — the same
control the form renders, `json` → the code editor included — and only genuinely
string-valued types (`text`, `textarea`, `email`, `phone`, `url`) keep the plain
input. A drift guard asserts every field type is exactly one of routed /
excluded / delegated / benign, so a new type can no longer inherit the
value-destroying default in silence.

`@object-ui/fields`: the four fixed-option widgets no longer clear the stored
value when the field declares no `options` at all. An empty offered set had two
opposite causes — a list that cascaded to zero (clear) and a list that was never
authored (nothing to decide) — and the second deleted the value on mount, which
the grid's inline cell editor has always been able to trigger. `FieldEditWidget`
also forwards `autoFocus` to the widget it renders.
