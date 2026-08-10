---
"@object-ui/app-shell": patch
---

metadata-admin: restore per-field diagnostics when editing an invalid stored `view`

Editing a stored `view` is judged by the wire gate `ViewMetadataSchema`, which is a
union. Zod reports a union failure as a single root issue — no path, message
`Invalid input` — so every field-level diagnostic collapsed into one message that
pointed at nothing: `SchemaForm` had no field to highlight and Monaco had no
position to jump to, and the guided messages the spec writes for these rejections
never reached the editor.

Failures are now expanded to the union member the draft's own `viewKind`
discriminant selects, so a bad stored view reports `config.type` with the list of
valid layouts, a mis-typed filter reports `config.filter.0.operator`, and a
container key that belongs to a single view gets the spec's full
`defineView(...)` guidance back. Only the selected member's issues are shown, so
the other members' rejections do not become noise.

Validation verdicts are unchanged: the accept/reject decision is still made by the
one gate, and this only changes how an already-failed draft is presented.
