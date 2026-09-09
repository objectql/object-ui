---
---

Repo script only. `scripts/census-recorder-wait-shape.mjs` now records, in its header,
what its two recorder-matching modes actually disagree about (objectui#8703): the modes
are incomparable by construction, their strict buckets are nevertheless nested on the
current tree, and two mode-independent rules — the forward window ending at the next
`await` in the FILE, and every textual occurrence counting as a "read" — put seven
non-reads in a strict bucket of eighteen. It also prints a caveat next to its own
counts. No published behaviour changes.
