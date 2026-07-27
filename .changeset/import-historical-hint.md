---
"@object-ui/plugin-grid": patch
---

docs(plugin-grid): the "Import as historical data" wizard hint now reflects audit-timeline preservation (#3493)

`treatAsHistorical` gained a second half in framework #3493/#3497 — the import
write context also carries `preserveAudit`, so a historical import keeps the
original `updated_at`/`updated_by` and business `readonly` fields instead of
stamping-now / stripping them. The checkbox hint only described the
state-machine-skip half; it now also says the original timestamps & author are
preserved. The `ImportRequest.treatAsHistorical` type doc (`@object-ui/types`)
is updated to match. Copy-only — no behavior change (the checkbox already sent
`treatAsHistorical`, so the server-side extension is reached without any wiring
change).
