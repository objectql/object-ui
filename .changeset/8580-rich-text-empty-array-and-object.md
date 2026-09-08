---
'@object-ui/fields': patch
---

`markdown`, `html` and `richtext` cells no longer draw a childless container for `[]` or the literal `[object Object]` for `{}` (objectui#8580).

Third part of the empty-array census: objectui#8481 moved the three multi-value renderers whose output for `[]` was blank, objectui#8490 the nine that fabricated a value. Measured by rendering every registered field type on `7102b20d9`, this family was what remained of the blank class:

| field types | renderer | rendered for `[]` before | rendered for `{}` before |
|---|---|---|---|
| `markdown` | `MarkdownCellRenderer` | a childless `prose` block (its loading fallback a childless span) | a paragraph reading `[object Object]` |
| `html`, `richtext` | `HtmlCellRenderer` | a childless `prose` block | the text `[object Object]` |

**Two defects, two rulings.** `@objectstack/spec` types all three fields as a plain string (`STRING_VALUE_TYPES`), in the same value class as `text` / `textarea` / `code`, and neither shape is a value of that class:

- `[]` now renders the shared `EmptyValue` affordance — the muted em-dash with a `No value` accessible name — exactly as `null` and `''` already did, and as its twelve siblings do. It holds no string and nothing to format.
- `{}` is **not** swept into the affordance (the record is storing something, so "No value" would be false) and is no longer `String()`'d. The three types now coerce exactly as the text class does (`coerceToSafeValue`): an object carrying a display name renders that name; a bare `{}` renders `[Object]`, the same text a `text` cell shows for it. A one-entry array formats its one entry, as `email` links its one address.

Populated values are untouched: a stored string reaches each pipeline verbatim, so `html` / `richtext` run through the same sanitiser on the same bytes (pinned byte-for-byte), and `markdown` still drops raw HTML.

`coerceToSafeValue` moved into its own module inside the package so the rich-content display module can share it without importing the barrel; it is still exported from `@object-ui/fields`, unchanged.
