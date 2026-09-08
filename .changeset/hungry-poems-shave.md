---
'@object-ui/plugin-designer': minor
---

**`MetadataFieldsPage` no longer rewrites a stored field type it cannot author.**

`toDesignerType` mapped every type outside `DESIGNER_FIELD_TYPES` to `'text'` on the
READ path, and `fromDesignerField` emitted the designer's type on the write path — so
relabelling one field rewrote every other field whose type this designer does not
author, on the same PUT. `text` is a legal spec type, so the save succeeded, the
designer redrew the fields as text, and nothing reported it; restoring a field required
knowing what its type used to be.

The census: `DESIGNER_FIELD_TYPES` has 27 members, `FieldType` in `@objectstack/spec`
17.3.0 declares 49, and all 27 are a subset of the 49. The 22 in the difference were
each a distinct data-loss case — `secret`, `richtext`, `toggle`, `multiselect`, `radio`,
`checkboxes`, `master_detail`, `tree`, `user`, `avatar`, `video`, `audio`, `summary`,
`composite`, `repeater`, `record`, `json`, `signature`, `qrcode`, `progress`, `tags`,
`vector`.

A field whose stored type is outside the designer's set is now carried through the
save verbatim — the mechanism this page already used one level down, where unknown
per-field KEYS survive via `carryOver` — and is listed on the page read-only, showing
its real stored type, instead of being drawn as an editable `text` field. Types inside
the set are unchanged: still editable, and a type change the author makes is still
honoured. A stored type in NEITHER vocabulary is carried through too, so an unknown
type produces a loud 422 naming the field rather than a silent rewrite.

Two behaviour changes worth naming:

- Fields with a carried-through type are no longer editable or deletable from this
  page — including deleting them, which was previously possible only because they had
  already been misrepresented as text. Use metadata-admin to change them.
- An object holding a target-less stored `master_detail` used to save from this page by
  flattening the field to `text` and losing the relationship. That field now reaches
  the existing relationship-target guard with its real type and is refused by name
  before the PUT. `@objectstack/spec` 17.3.0 requires `reference` on `master_detail`,
  so such a document's PUT answers 422 regardless; refusing here names the field and
  leaves the stored relationship intact.
