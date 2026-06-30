---
"@object-ui/plugin-grid": patch
---

fix(grid): don't open an inline editor for read-only / computed / binary fields

Inline editing fell back to a plain text box for every field without a
dedicated widget — including ones you can never author a value for. Found by
browser-testing the field-zoo: a **Formula**, **Roll-up**, or **Auto Number**
cell (system-computed) opened an editable text input, as did **File / Image /
Avatar / Video / Audio / Signature** (binary). Typing into a computed cell is
meaningless and, if the server accepted it, would clobber the derived value.

Gate it: a column is marked `editable: false` (which the data-table already
honors — it won't enter edit mode) when the field is `readonly` or an
inherently non-authorable type (`formula`, `summary`/`rollup`, `autonumber`,
`file`, `image`, `avatar`, `video`, `audio`, `signature`). Ordinary types
(text, number, date, select, boolean, …) are unaffected. Relational/structured
types (lookup, master-detail, json, …) intentionally keep their text fallback
for now — they want a proper picker, not a hard read-only lock.
