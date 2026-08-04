---
"@object-ui/plugin-detail": patch
---

`field:permission-facet-link` now registers through `withFieldCarrier` — the
repo's only raw `field:` registration bypassed the single-metadata-carrier seam
(objectui#3233), so under the SDUI path (`SchemaRenderer` passes `schema`,
never `field`) the widget read `field === undefined` and silently rendered an
anonymous facet summary (`field?.name` empty, no facet branch selected). The
form and inline-edit hosts were unaffected — they pass `field` directly, which
the carrier forwards unchanged. Fixes objectui#3307.
