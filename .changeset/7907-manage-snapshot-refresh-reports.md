---
'@object-ui/app-shell': patch
---

Studio: a failed managed-snapshot refresh no longer leaves the package sheet showing
the pre-action record as current (objectui#7907).

`onManageChanged` runs after every package lifecycle action fired from the detail sheet
(disable / enable / duplicate / publish / publish-drafts / manifest edit). Its tail
re-read the managed record so the change would show immediately, and swallowed any
failure under a bare `catch {}` commented "keep the current snapshot" — a snapshot the
action itself had just made stale. The author disabled a package, was told nothing, and
went on reading `Status: Enabled`.

The sheet derives its lifecycle verb from that record (`enabled` picks both the button's
label and the endpoint it POSTs), so a stale snapshot did not merely display a stale
badge — it re-armed the author with the verb they had just fired. The failure is now
reported through this surface's existing posture (`formatMetadataError` on the shared
`studio-package-list` sonner id, so one outage across the surface is still one toast)
and the sheet closes rather than stay open on a record known to be pre-action. The
Studio, the top bar and the package list are untouched: still a degradation, never a
throw, and no navigation is inferred from a refresh that could not happen.

The same tail dropped `fresh === null` — a successful read whose list no longer contains
the package — just as quietly; it now reports that with the same sentence `openManage`
already uses for it.

Pre-existing, and objectui#7881 made it much easier to hit rather than causing it:
before that fix `fetchFullPackage` never read `res.ok`, so this `catch` could only ever
see a non-JSON body; now that the helper refuses a non-2xx, the same `catch` was also
swallowing every 401 / 403 / 503 / 500.
