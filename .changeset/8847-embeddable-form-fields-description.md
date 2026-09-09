---
'@object-ui/plugin-form': patch
---

`embeddable-form`'s top-level `fields` input now documents its member
vocabulary (objectui#8847, the last of the registrations #8738 opened — the
same trap already documented on `object-form`, `form` / `view:form`, and
`object-master-detail-form`'s parent `fields`).

The registration declared `{ name: 'fields', type: 'array' }` with no
description, so an author had nowhere to read that this key's members are
**bare field names** — a different vocabulary from `sections[].fields`, which
also accepts the spec `FormFieldSchema` object (identity key `field`, e.g.
`{ field: 'note', colSpan: 2 }`). `EmbeddableForm` passes `config.fields`
straight through to `<ObjectForm>` with no `sections`, so it renders through
the same `SimpleObjectForm` read path as `object-form`; moving one of those
objects into `embeddable-form`'s `fields` resolves to no name and is silently
skipped. Behaviour is unchanged — this only adds the description text, and
records (measured, not assumed) that this surface already inherits the
`console.warn` route 1 (objectui#8738/#8859) added at that same read site.
