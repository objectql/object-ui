---
"@object-ui/console": patch
---

fix(ADR-0046): docs portal shows summaries, not machine ids.

The portal listed each doc as title + its raw machine name (`showcase_index`)
— noise for the business readers docs are written for. Drop the machine id from
the reader-facing list and render the doc's `description` (ADR-0046) as a
one-line summary under the title instead. Falls back cleanly when a doc has no
description.
