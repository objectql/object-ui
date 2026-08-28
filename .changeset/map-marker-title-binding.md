---
'@object-ui/app-shell': patch
---

Interface-page maps: derive a marker-title binding from the object's display field

An ADR-0047 interface page that whitelists `map` derives its map binding with
`defaultMapFromObject`, which bound only `locationField`. With no `titleField`
reaching `ObjectMap`, `getMapConfig` filled the gap with the literal `'name'`
and the marker title is a plain `record[titleField]` read — so on any object
whose display field is not `name` (for example one keyed by `title`), every
marker popup titled itself `undefined`.

The derivation now also binds the object's display field, resolved with the
field-name half of ADR-0079's precedence: the declared `nameField` (and its
`displayNameField` / `NAME_FIELD_KEY` aliases), otherwise the shared
`deriveTitleField` scan from `@object-ui/core` — the same ranking the kanban,
calendar and gantt renderers resolve titles through, so a map and a board over
one object agree on what a record is called. When nothing resolves the key is
omitted rather than defaulted. A hand-declared `map` block still wins per key.
