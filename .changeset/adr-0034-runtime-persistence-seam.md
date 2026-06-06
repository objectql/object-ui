---
"@object-ui/app-shell": patch
---

ADR-0034 step 1: introduce a flag-gated runtime metadata persistence seam. `persistRuntimeMetadata` / `publishRuntimeMetadata` centralise where the runtime view/report/dashboard editors save. Behind the `VITE_RUNTIME_EDIT_VIA_META` flag (default **off**) they reproduce today's `sys_*` writes exactly (zero behaviour change); flag **on** routes to the studio `/meta` per-item draft/publish model (`MetadataClient.save(..., { mode: 'draft' })` + `publish`). ReportView and DashboardView now save through the seam; ObjectView (view) and the draft/publish UI are deliberately deferred. No `sys_*` table is removed and no data is migrated. Also adds the finalized ADR-0034.
