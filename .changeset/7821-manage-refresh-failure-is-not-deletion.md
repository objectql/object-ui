---
'@object-ui/app-shell': patch
---

A failed package-list refresh no longer reads as "the package was deleted" and no
longer evicts the author from the Studio (objectui#7821).

`onManageChanged` — the callback the Studio's `PackageDetailSheet` fires after every
package lifecycle action (disable / duplicate / delete / publish / manifest edit) —
refreshed the list into a local `list` initialised to `[]` and swallowed the rejection
under a comment reading "keep the stale list". That is true of the `pkgs` state, which
is simply not written, and false of the local, which stayed `[]`. So after a failed
`GET /api/v1/packages` the `!list.some(...)` check three lines down was
unconditionally true, the code took the branch labelled `// Deleted`, and — when the
managed package was the one under the editor — navigated away with `list[0]`
undefined, i.e. to `/home`. One transient 503, network blip or auth expiry threw the
author out of the editor with no toast and no confirmation, while the package was
still there.

The local now starts as `null` — "the refresh told us nothing" — and only a list that
actually came back, without the managed package in it, is read as a deletion. A
failure draws no inference at all: no navigation. It is reported instead, through the
posture this surface already has (objectui#7368): `formatMetadataError` on the shared
`studio-package-list` sonner id, and recorded so the switcher reads `failed` rather
than presenting a now-stale list as current. A real deletion navigates exactly as
before — to the first surviving package, or `/home` when none is left.

Still a `.catch` and still no retry: one 503 must not take the Studio down, and no
retry policy has been ruled on.
