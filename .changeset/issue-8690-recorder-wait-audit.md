---
---

Test-only (plugin-designer) plus one repo script. The `MetadataObjectsPage.lookupKeying`
round-trip pin now reads its "no delete was issued" assertion after the page's
`reload()` — the handler's last statement — instead of after the first PUT, so the
emptiness is dated to the end of the write sequence rather than to its start. Adds
`scripts/census-recorder-wait-shape.mjs`, the objectui#8690 corpus detector. No
published behaviour changes.
