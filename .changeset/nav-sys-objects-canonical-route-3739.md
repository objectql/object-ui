---
'@object-ui/app-shell': patch
---

Point the `sys-objects` navigation entries at the canonical metadata-admin route instead of the `system/metadata/object` alias, removing a redirect hop from each click (objectui#3739).

`AppSidebar.systemFallbackNavigation`, `UnifiedSidebar.homeNavigation` and `console/home/QuickActions` all spelled this target `/apps/setup/system/metadata/object`. That is not a page: `apps/console`'s host fragment declares `system/metadata/:metadataType` with `MetadataRedirect` as its element, which immediately navigates on to `/apps/setup/metadata/object` — the engine's real route (`metadata/:type`, `MetadataResourceListPage`). Every click therefore paid a redundant hop plus a re-render to reach a destination the navigation could name directly. All three now name it.

This is the same defect objectui#3660 fixed for `sys-datasources`, declared on the line immediately below `sys-objects` in both sidebar arrays. It was missed there because the two entries reached their aliases through different route tables — `sys-datasources` through app-shell's own `component/metadata/resource` alias, `sys-objects` through the host's `system/metadata/:type` rewrite.

The landing page is unchanged, byte for byte: the new URL is exactly what the alias hop was already computing (`object` percent-encodes to itself, and no producer carried a query or hash). Only the intermediate hop is gone. Of the three producers, the two sidebars are live; `QuickActions` has no JSX call site today, so its change is a guard against the dead link returning with the component.

The alias routes stay declared and untouched: bookmarks and external links still arrive on them and are still forwarded.
