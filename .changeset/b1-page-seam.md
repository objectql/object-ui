---
"@object-ui/app-shell": minor
---

Runtime persistence seam: add `'page'` artifact type (record-page draft/publish).

`RuntimeArtifactType` now includes `'page'`, so a record `PageSchema` stages and publishes through the same ADR-0034 `/meta` draft model as views/reports/dashboards (#1541). New pure helpers `recordPageName(objectName, existing?)` (prefers an assigned page name, else mints `<object>_record`) and `recordPageEnvelope(objectName, schema, name?)` (sets the `name`/`object`/`pageType:'record'`/`kind:'full'` identity fields the resolver matches on) — foundation for the record-page edit loop.
