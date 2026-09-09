---
'@object-ui/fields': patch
---

An object literal is no longer drawn as an invented identity in six cell-renderer
families (objectui#8596).

Measured by rendering all 53 registered field types through `getCellRenderer` against
`[]`, `{}`, `''` and `null` — 212 cells — before and after. **14 cells moved, all in the
`{}` column**; the `[]`, `''` and `null` columns are byte-identical.

| field types | `{}` drew | `{}` now draws |
|---|---|---|
| `email` / `url` / `phone` | a live anchor — `mailto:[Object]`, `tel:[Object]` — plus a copy button | `[Object]`, exactly as `text` prints it |
| `color` | a swatch whose `background` was the string `[object Object]` | `[Object]`, exactly as `text` prints it |
| `select` / `status` / `multiselect` / `radio` / `checkboxes` / `tags` | a badge reading `[Object Object]` | a badge reading `[Object]` |
| `user` | an avatar captioned `U`, labelled `User` | `[Object]`, exactly as `lookup` prints it |
| `file` / `video` / `audio` | a chip named `File` | the shared "No value" affordance |

The direction is the spec's, per family, not one sweep. `email` / `url` / `phone` /
`color` are `STRING_VALUE_TYPES` ("Value is a plain string") — the same set whose `{}`
ruling landed for `markdown` / `html` / `richtext`: the record IS storing something, so
it prints the family's existing coercion rather than the "No value" affordance, and
draws no affordance that asserts more (a `mailto:[Object]` cannot send mail; a copy
button offers `[Object]` to the clipboard; `background: [object Object]` is a
declaration the browser drops). The option families resolve to a string code, so the
same coercion answers them and the badge stays. `user` shares its `valueSchemaFor` arm
with `lookup`, which already answered an object it cannot name with the coerced text.

`file` / `video` / `audio` are the family whose answer differs, and the spec names the
input: the media value schema makes `url` its one required member and rejects "an empty
object", so `{}` is a value of neither the stored nor the expanded form — the record
holds no file, and "No value" is true of it. `image` / `avatar`, the same spec family,
already answered `{}` that way.

Deliberately not swept: `boolean` / `toggle` (already fixed), the declared json-literal
fence on `location` / `geolocation` / `json` / `object` / `composite` / `record`, the
`date` renderer's own dash, arrays (a one-entry array still coerces and still links), and
any object carrying a member — a `{ name: 'contract.pdf' }` attachment and a
`{ id: 'u_1' }` reference render exactly as before, so real data is never hidden.
