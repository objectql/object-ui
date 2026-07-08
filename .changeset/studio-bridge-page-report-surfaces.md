---
'@object-ui/app-shell': minor
---

The top bar's "Design in Studio" bridge now deep-links pages and reports, not just dashboards.

Previously only a **dashboard** route deep-linked to its design page in Studio's Interfaces pillar; a **page** or **report** route fell back to the package's generic Data tab, dropping the admin far from the surface they were viewing. The route-type → surface-type mapping now covers all three interface types (`dashboard` / `page` / `report`) via the new `appStudioRoutePath` helper, so e.g. viewing `/apps/:pkg/page/showcase_crm_workbench` and clicking the hammer opens `/studio/:packageId/interfaces?surface=page:showcase_crm_workbench`. Object routes and the app root still open the Data tab.
