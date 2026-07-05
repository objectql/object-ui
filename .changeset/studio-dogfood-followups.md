---
"@object-ui/app-shell": minor
---

Studio package-create dogfood follow-ups (objectstack-ai/framework#2615):

- Read-only packages now gate authoring affordances client-side (Add field, New object/flow/permission set, nav Edit, Save draft, Publish, Create app) with a "switch to a writable package" hint, instead of letting doomed edits pile up until the server 422s (objectui#2259). Records stay fully usable; the field inspector opens read-only.
- New fields auto-derive their API name from the label while still auto-named — now also for the Data pillar's generic `field_N` names, so relabeling "New field" to "Status" yields a `status` column instead of `field_2` forever (objectui#2260).
- Publish is review-then-confirm: the header button opens the pending-changes panel, whose footer "Publish N change(s)" fires the atomic package publish; panel entries expand to a per-item field/property diff against the live version (objectui#2261).
- Create app can scaffold navigation from the package's objects (checkbox, on by default): one spec-valid object menu item per object, closing the "fresh app has zero nav" dead-end (objectui#2262).
