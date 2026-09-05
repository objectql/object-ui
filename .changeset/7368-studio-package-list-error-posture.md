---
'@object-ui/app-shell': patch
---

Studio top bar: a failed package-list fetch is reported and told apart from the
other two states it used to look exactly like (objectui#7368).

`PackageSwitcher` held the list as `PkgEntry[] | null` and caught the
`fetchPackages()` rejection into an empty block, so `null` meant both "still
loading" and "the fetch failed". The trigger rendered `current?.name ?? packageId`,
which collapses a third situation into the same pixels: a package whose producer
declared no name at all (`parsePackages` falls `name` back to the id). Any failure
of `GET /api/v1/packages` therefore left the Studio top bar printing the raw
reverse-domain package id — `app.b2r4` — with no toast, no console line and no
retry, forever, and the author had no way to tell whether to go fix the manifest or
to go retry.

The switcher now records the failure beside the list and renders the three states
apart: `loading` keeps a spinner next to the id, `failed` adds a "Failed to load"
marker carrying the error on its tooltip and replaces the popover's forever-"Loading…"
line with the reason, and `loaded` leaves the id standing alone — where a bare id now
really does mean "this package declares no name". The two sibling `fetchPackages()`
callers on the same surface (the writability courtesy gate and the object-namespace
lookup) stop swallowing their rejections too; all three report on one shared sonner
id, so a single outage produces one toast rather than three.

The degradation itself is deliberately kept — the switcher still navigates and one
503 does not take the top bar down — and no retry was added: retry policy (how many,
what backoff, what to show after giving up) is undecided, and retrying would delay
the moment the failure becomes visible, which is the opposite of what this fixes.
