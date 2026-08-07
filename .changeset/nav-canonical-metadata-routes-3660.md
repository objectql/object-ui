---
'@object-ui/console': patch
'@object-ui/app-shell': patch
---

Point the last four navigation producers at the canonical metadata-admin routes instead of the deprecated `component/metadata` alias, removing a redirect hop from each (objectui#3660).

The System hub's "Metadata" and "Datasources" cards aimed at `…/component/metadata/directory` and `…/component/metadata/resource?type=datasource`, and the `sys-datasources` entry in both `AppSidebar.systemFallbackNavigation` and `UnifiedSidebar.homeNavigation` spelled the latter too. app-shell declares those spellings as legacy *aliases*, not pages: their route element is `LegacyMetadataRedirect`, which immediately navigates on to `…/metadata` and `…/metadata/datasource`. Every click on any of the four therefore paid a redundant hop plus a re-render to reach a destination the navigation could name directly. All four now name it.

The landing pages are unchanged, byte for byte — the new URLs are exactly what the alias hop was already computing (`datasource` percent-encodes to itself, and neither producer carried a query or hash beyond the `?type=` the alias itself consumed). Only the intermediate hop is gone.

The alias routes stay declared in both `AppContent` branches, untouched: bookmarks and external links still arrive on them and are still forwarded. This completes objectui#3639, which corrected the console host's two redirects and enumerated these four as the remainder.
