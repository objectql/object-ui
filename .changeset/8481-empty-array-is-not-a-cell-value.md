---
'@object-ui/fields': minor
---

An empty array is no longer a cell value in the shared read renderers (objectui#8481).

Three renderers in `@object-ui/fields` open a multi-value container and map their
entries into it. Their opening guards tested only `null` / `undefined` / `''`, so `[]`
passed and each mapped over zero entries — the renderer's entire output was a
**childless container**: no glyph, no `aria-label`, a visually blank cell.

| field types | renderer | output for `[]` before |
|---|---|---|
| `select`, `status`, `multiselect`, `radio`, `checkboxes`, `tags` | `SelectCellRenderer` | a flex-wrap DIV with no children |
| `lookup`, `master_detail`, `tree` | `LookupCellRenderer` | a flex-wrap DIV with no children |
| `user` | `UserCellRenderer` | an avatar-stack DIV with no children |

All ten types now render the shared `EmptyValue` affordance — the muted em-dash with a
`No value` accessible name — exactly as they already did for `null`.

**Why this is user-visible on multiple surfaces.** `@object-ui/plugin-detail` already
carried two private upstream pre-checks against this (objectui#8474's `hasCellValue`
and `RelatedList`'s `isValueEmpty` from objectui#8459), so the record page was already
protected. Every consumer that does not pre-check reached the renderer directly:
`ObjectGrid` (both the desktop table and the sub-768px card layout), `ObjectGallery`
and `ObjectKanban` were each verified by rendering to paint the blank cell before this
change and the affordance after it.

**Deliberately narrow.** This is not a package-wide emptiness predicate and the helper
is not exported. Measured by rendering every registered field type against `[]`, these
renderers hold at least seven different private answers to "is this empty", and several
of the disagreements are intentional: `JsonCellRenderer` draws the two-character array
literal (measured and kept by objectui#8474) and `FileCellRenderer` states `0 files`.
Neither moves, and both are pinned as the declared boundary of this change. `{}` is
untouched everywhere — the test is `Array.isArray`, so an object cannot reach it.
