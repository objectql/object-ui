---
---

Correct the "Why this port is not YET pinned in
`scripts/upstream-port-pin.json`" section of `scripts/check-bash32-floor.mjs`
(objectui#8385). Prose only in a repo-internal gate script; no package source
and no published contract is touched, so nothing is released by this change.

The section argued from `pin.upstream.ref`, a single ledger-wide field. It no
longer exists: objectui#8288 made `ref` a required key on each `files[]` entry,
`validatePin` now REFUSES a pin that still carries `upstream.ref`, and
`resyncedPin` writes only the re-synced entry's own `ref` and digest. So the
section did not merely describe a blocker that had lifted — it sent a reader
looking for a field that would be rejected if they wrote it.

The rewrite states the blocker is gone, and states what registration still
costs (per-file work: upstream blob at a named ref, its digest, and each
divergence declared as an exact text pair with a `why`). The one conclusion
that was still true is kept: this file has NO drift gate until it is
registered.

⛔ No revision is written into the new prose, on purpose. That section had
already gone stale twice by the same mechanism — objectui#7749 moved the global
ref out from under the sentence describing it, and objectui#8288 then deleted
the field that sentence named — so the new wording points at
`scripts/upstream-port-pin.json`, where each entry now carries its own `ref`,
instead of restating one and going stale a third time.
