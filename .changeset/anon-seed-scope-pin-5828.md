---
---

Test-only: lands the objectui#5746 enumeration harness as a regression pin under
objectui#5828. It mounts the real console boot path (real `AuthProvider`, real
`ConnectedShell` session gate, real `MetadataProvider`; only the auth and
metadata servers are doubled) and asserts what is true today — including that
the guest and `previewMode` boots write `objectui:metadata:app:@none:@anon`,
which is the open observation objectui#5828 carries, not a change made here. The
pin that can fail is S6: it goes red if objectui#5198's principal-scoped cache
key stops discriminating principals. No published behaviour changes.
