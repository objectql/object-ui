---
'@object-ui/app-shell': patch
---

Studio: a failed package lookup no longer opens the management sheet on nothing

`fetchFullPackage` — the helper behind the switcher's "Package info & settings" —
fetched `/api/v1/packages` and went straight to `res.json()`, never reading
`res.ok`. The platform answers a failed read in the ADR-0112 envelope
(`{ success: false, error: { code, message } }`), which parses cleanly through
that reader: the error object is neither an array nor carries `packages`, so the
list fell to `[]` and the lookup returned `null` without throwing. `openManage`'s
`catch` therefore never ran and the two lines after it still fired, opening the
management sheet over a null package — which renders nothing. During an outage
the author clicked the menu item and got silence: no sheet, no toast, no
explanation.

The read now refuses a non-2xx, carrying the server's own `error.message` and
`error.code` (in the 5xx band the platform withholds the producer's prose, so the
code is the discriminating word) and naming the status when the body is not JSON
at all. The failure is reported through this surface's existing posture —
`formatMetadataError` on the shared `studio-package-list` sonner id, so one outage
across this surface's four callers of that endpoint is one toast, not four.

And the sheet no longer opens on a `null` package at all: a successful list that
simply does not contain the package — deleted or uninstalled elsewhere — now says
so instead of opening over nothing.
