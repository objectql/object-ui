---
---

Docs only: the expression guides taught `"value": "${...}"` on `type: "text"`
nodes, which the renderer reads back but never evaluates, so the reader saw the
literal `${...}` on screen. All 29 authored occurrences now spell the carriage
`content`, the ruled sole evaluation channel for `text` (objectui#7015,
maintainer ruling 2026-08-31 on objectstack#13670, option 2).

No package source changed, so this ships nothing — `check-changeset-presence`
independently reports "no changeset is owed" for this diff. The declaration is
here to state the release intent explicitly rather than to bump anything.
