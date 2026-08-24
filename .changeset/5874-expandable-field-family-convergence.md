---
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-detail': patch
'@object-ui/app-shell': patch
---

Four more private copies of the reference-bearing field family converge onto
`@object-ui/core`'s `EXPANDABLE_FIELD_TYPES`, and the "fourth and last private copy" claim
that `paramToField` still stated is corrected (objectui#5874, objectui#5875).

Each copy diverged from the published family in BOTH directions, so this is a behaviour
change on every face and not a refactor:

- **`user` and `tree` are now treated as relations.** Both carry the same foreign-key
  storage as `lookup` and resolve through the same expand path (objectui#2032), and each
  face's own stated reason for special-casing `lookup` applied to them verbatim — so
  gaining them restores the rule each face already meant. A `user` / `tree` field is now
  read-only in the quick-look drawer (`RecordDetailDrawer`), where the drawer wires no
  relation picker and a plain text input let a user overwrite the relation with a
  free-form string; it gets the wide layout basis in the record header's highlights strip
  (`HeaderHighlight`), whose inline editor is a record picker; and a field-backed action
  param over one now inherits the picker config it needs (`resolveActionParams`).
- **`master_detail` is now treated as a relation by `resolveActionParams` too** — it was
  the only face missing that member as well, so a field-backed `master_detail` action param
  inherited no `referenceTo` at all and degraded to the unexplained "paste a record id"
  text input that objectui#3405 exists to prevent.
- **The undeclarable `reference` spelling is gone from the three field-type faces.**
  Measured against `@objectstack/spec`'s closed `FieldType` vocabulary with live controls
  (`lookup` / `master_detail` / `user` / `tree`) and dead ones (the retired `owner`, plus a
  nonsense spelling): `reference` is absent, so no spec-compliant object schema could
  declare a field that reached those branches. It sat exactly where `owner` sat before
  objectui#4814 retired it — dead weight that read as live capability.

`resolveActionParams` keeps answering for `reference`, deliberately and by a different
route: it is refused by the spec's `ActionParamSchema` too, but the dialog still accepts it
from params already authored with it, and that acceptance belongs to the one alias table in
`paramToField` rather than to a hand-copied membership test. This face now asks the shared
family over the widget key that table produces — the same expression `paramToField`
evaluates one step later, so the half that populates a param's picker config and the half
that forwards it can no longer disagree.

No face copies the set: each calls `.has()` on the object `@object-ui/core` exports, and
each carries an identity pin (a spy on that `has`) so a member-identical private copy fails
instead of quietly re-forking the table.
