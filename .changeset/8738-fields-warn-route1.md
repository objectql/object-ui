---
'@object-ui/plugin-form': patch
---

`object-form`'s top-level `fields` (and its `form` / `view:form` alias and
`object-master-detail-form`'s parent `fields`) now emit a named
`console.warn` when a member resolves to no field name, instead of silently
dropping it (objectui#8738 route 1, ruled after route 2 landed in a prior
release).

Top-level `fields` reads only bare field-name strings (`{ name }` tolerated)
— a different vocabulary from `sections[].fields`, which also accepts the
spec `FormFieldSchema` object (identity key `field`, e.g.
`{ field: 'note', colSpan: 2 }`). Moving one of those objects into a
top-level `fields` array resolves to no name and used to vanish without a
word; it is now reported once per distinct offender via `console.warn`,
naming the skipped shape and the vocabulary difference, modelled on
`sectionFields.ts`'s existing `warnOnMixedVocabulary`.

The render outcome is unchanged — the member is still dropped, not resolved;
this is a diagnostic-only addition, not a lenient fallback. `form` /
`view:form` (the same `ObjectFormRenderer`) and `object-master-detail-form`'s
parent `fields` (routed through the same `SimpleObjectForm` read path via
`ObjectForm`) inherit the warning for free; both registrations' `description`
now also document the vocabulary (objectui#8847).
