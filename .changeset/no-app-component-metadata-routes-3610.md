---
'@object-ui/app-shell': patch
---

Make the zero-app console's "Object Manager" / "Datasources" entries resolve, and give that branch a not-found screen instead of a blank one (objectui#3610).

On a deployment with no published apps, the system fallback navigation sends `sys-datasources` to `/apps/setup/component/metadata/resource?type=datasource` and `sys-objects` to `/apps/setup/system/metadata/object` (rewritten by the console host onto the same legacy alias). `isMetadataRoute` is a substring test on `/metadata`, so both URLs pass the "No Apps Configured" guard and enter `AppContent`'s no-`activeApp` route table — which declared no `component/…` route at all and, unlike the with-`activeApp` table, carried no trailing catch-all. A `<Routes>` with no match renders `null`, so an admin building their first object got a fully blank screen: no 404, no error, no empty state.

Both halves are fixed on the routing side, with no navigation URL changed. The two legacy metadata aliases (`component/metadata/directory`, `component/metadata/resource/*`) are now declared in the no-`activeApp` branch too, mirroring the with-`activeApp` branch — they are redirects, not a second copy of the page, so they forward onto the canonical `metadata/:type` routes that branch already declared. And the branch now ends in the same `path="*"` → "Page not found" screen the with-app branch has always had, so the next unresolved URL in a zero-app console is reportable rather than invisible.
