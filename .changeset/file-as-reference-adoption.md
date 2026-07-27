---
"@object-ui/fields": minor
"@object-ui/app-shell": patch
---

feat(fields): adopt the file-as-reference value shape (ObjectStack ADR-0104 D3 wave 2)

A `file`/`image` field value now reaches the UI in one of three forms, and the
rules for reading them live in one place — `@object-ui/fields`' new
`file-value` module — instead of being re-derived in each widget:

1. **Reference** — a bare `sys_file` id string, what the backend stores once
   file-as-reference is adopted.
2. **Expanded** — `{ id, name, size, mimeType, url }`, what the read path
   returns after resolving a reference.
3. **Legacy inline blob** — `{ file_id?, name, original_name, size, mime_type,
   url }`, the pre-reference shape this package used to build itself.

**The casing split is the bug this fixes.** The expanded form carries
`mimeType`; the legacy blob carries `mime_type`. `FileField`, `FileCell` and
`ImageField` all read only `mime_type`, so the moment a backend starts returning
the expanded form they stop recognising images — thumbnails silently degrade to
a generic file icon, with nothing pointing at a value shape as the cause.
`readFileValue()` accepts both.

**Uploads now submit the reference form** — the bare `sys_file` id — when the
upload adapter surfaced one, falling back to the legacy blob when it did not
(the object-URL fallback adapter, or a backend predating file-as-reference). The
same build therefore works against both. Action params already POSTed a bare
fileId; record field values now use the same contract, and
`serializeParamValues` shares the `fileIdOf()` extractor so the two surfaces
cannot drift on what counts as an id.

Because a bare id carries no name or URL, each widget remembers the display
details of files it just uploaded, keyed by id, so an upload renders immediately
rather than showing a bare token until the next read enriches it.
