---
'@object-ui/fields': patch
---

**Bug — a `code`/`text` value whose text is JSON rendered as the literal `[Object]`.** `coerceToSafeValue` classified strings by SHAPE: any string starting `{`/`[` and ending `}`/`]` was `JSON.parse`d and the result run through the reference-label extraction (`name || label || externalId || id || _id || '[Object]'`), which answers the placeholder for an object carrying none of those keys. Every text-like cell reaches that helper — `text`, `textarea`, `code`, `time`, `auto_number` and `qrcode` all register to `TextCellRenderer` — so a stored `{"ok": true}` displayed as `[Object]`, and `[1, 2, 3]` in a text field displayed as `1, 2, 3`.

A string is now returned verbatim, whatever its shape. The reference case the parse was written for (an unresolved external-id reference arriving as `'{"externalId":"…"}'`) belongs to reference-TYPED columns and is already handled there: `LookupCellRenderer` carries its own JSON-string branch, which resolves the label through the referenced object's schema and links to the record — neither of which the type-blind helper could do. The behaviour is scoped to the column type that owns it, not dropped. Object and array VALUES still coerce, so React error #310 stays fixed.
