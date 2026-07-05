---
"@object-ui/components": patch
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
---

fix(components): page:header record title honours `nameField` via the unified ADR-0079 resolver

The default console record detail page renders the synthesized `page:header`
(`buildDefaultPageSchema`, renderViaSchema default-on), whose record-chip title
chain probed `objSchema.primaryField` (not a spec property — always undefined),
`titleFormat`, then hardcoded `name`/`full_name`/`title`/`subject`/
`display_name`/`label` record keys. It never consulted the object's declared
`nameField`/`displayNameField`, so an object titled by e.g. `subject` rendered
`<ObjectLabel> <id-prefix>` as its H1 instead of the record's real name.

`PageHeaderRenderer` now resolves through `getRecordDisplayName(objSchema, data,
{ deriveFromRecordKeys: false })` after the author overrides and before the
legacy probes — mirroring `DetailView.resolveDisplayTitle` so both headers
agree. `RecordDetailView`'s `primaryField` derivation and
`buildDefaultPageSchema`'s highlight-strip dedup also honour
`nameField`/`displayNameField`.
