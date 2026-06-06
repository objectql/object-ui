---
"@object-ui/app-shell": patch
---

ADR-0034 step 2: route ObjectView's view-config save through the runtime persistence seam, completing the seam's coverage of all three runtime editors (view/report/dashboard). Corrects the seam's `view` branch to mirror ObjectView's real update path (`dataSource.updateViewConfig(...)`, the ADR-0005 overlay API) rather than a raw `sys_view` write. Behaviour is unchanged while the `VITE_RUNTIME_EDIT_VIA_META` flag is off; flag on routes the view update to the studio `/meta` draft. The view CREATE path (`createView` + default-column/kanban/gallery massaging) and the draft/publish UI remain deferred.
