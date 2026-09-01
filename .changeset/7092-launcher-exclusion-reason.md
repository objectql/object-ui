---
---

Corrects the `PALETTE_EXCLUSIONS` reason string for `app:launcher` in the Studio
page-palette ledger. It read "shell singleton — the app shell renders it, not a page",
and objectui#7091 registered a real `app:launcher` renderer, so a page can now render it
and the "not a page" clause became false. The reason now reads "shell singleton — lives
in the app shell chrome", mirroring the neutral form its sibling `global:notifications`
has carried since objectui#6757 shipped that type a renderer without its wording rotting:
the entry describes WHERE the thing lives, not whether a renderer exists, so a later
renderer cannot falsify it.

The exclusion itself is an unchanged decision — `app:launcher` stays out of the page
palette, and its key and position in the ledger are untouched. Whether it should become
palette-authorable is a separate product question this does not answer. No published
behaviour moves: the reason strings are developer-facing ledger prose, read by no runtime
code path, and `PALETTE_EXCLUSIONS` is not exported from `@object-ui/app-shell`'s entry.
