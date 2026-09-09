---
'@object-ui/plugin-form': patch
---

`object-form`'s top-level `fields` input now documents its member vocabulary
(objectui#8738, route 2 of 2 — route 1, a diagnostic `console.warn`, is a
separate ruling still pending).

The registration declared `{ name: 'fields', type: 'array' }` with no
description, so an author had nowhere to read that this key's members are
**bare field names** — a different vocabulary from `sections[].fields`, which
also accepts the spec `FormFieldSchema` object (identity key `field`, e.g.
`{ field: 'note', colSpan: 2 }`). Moving one of those objects to the top-level
`fields` resolves to no name and is silently skipped by `SimpleObjectForm`
(`ObjectForm.tsx`) and by `buildFlatFields` (`flatFields.ts`, shared by the
drawer/modal presentations) — no throw, no warning, no empty-state. Behaviour
is unchanged; this only adds the description text an author would need to
avoid the drop before writing it.
