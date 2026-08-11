---
'@object-ui/plugin-detail': patch
---

A `password` or `secret` field on the record detail page is no longer inline-editable: it renders no pencil / double-click affordance and produces no editor, on both the details body and the highlights strip.

Both types are **masked on read** — `getCellRenderer` returns a fixed bullet run for either — so the value the row could hand an editor was never the credential. `InlineFieldInput` had no branch for either type, so both reached the terminal raw text input at the end of the component, and the row's payload value was seeded into a `type="text"` box: rendered in clear, selectable and copyable, in a control the user reads as holding their credential. Committing the row then wrote that placeholder back verbatim over the field. For `secret` the overwritten value is an opaque reference into an encrypted store (ADR-0100), so the write destroyed the pointer, not just the display. Nothing in the flow said so; the failure surfaced later, wherever that credential was used.

The decision already existed one package over. `INLINE_EXCLUDED_FIELD_TYPES` in `@object-ui/fields` excludes both types with exactly this reasoning, and the grid honours it through `isInlineExcludedFieldType()`. The detail hosts gated on readonly / computed / system only and never consulted it, so the detail page reproduced the precise failure the set exists to prevent. Both hosts now consult that same alias-aware contract (`isInlineExcludedDetailFieldType`, a narrow-only union of the authored and the object type, matching the computed gate under objectui#3355) rather than growing a second hand-maintained list — so the rule cannot drift between the grid and the detail page again.

Consulting the shared set closes the container family on the detail page with it: `object`, `composite`, `record`, `grid`, `repeater` and `vector` rode the same plain-text fallback with an object-shaped value, and are now excluded too. The spec spelling `autonumber` is likewise excluded, where the detail computed gate only knew the `auto_number` spelling. The heavy-editor family (`markdown`, `html`, `richtext`) loses its one-line text box on the detail page — those are authored in the record form, which has the real editors.

The binary/attachment family is deliberately exempt and keeps its detail editor. It is in the shared set for a grid-cell reason — a cell cannot host an upload dropzone — while `InlineFieldInput` routes `image` / `avatar` / `signature` / `file` (and the `video` / `audio` spellings) to the same upload widgets the record form uses. That exemption is pinned against the routing it claims, so it cannot outlive it.

Re-authoring a credential is unchanged and still belongs in the record form, which has the widget for it (`PasswordField`).
