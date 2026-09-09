---
'@object-ui/app-shell': patch
---

Studio settings: correct the `highlightFields` help text, which told authors the
value was capped at four.

The old string ("default list columns, cards and detail header take the first 4")
was a universal claim, and a census of all eight read sites showed the platform
gives a declared `highlightFields` five different treatments: no cap at all on the
two list faces, the grid, kanban cards and the detail header; four on the
synthesized page highlights and the lookup picker; six on related lists. An author
who believed the help and wrote four therefore under-declared on every uncapped
surface, silently and with nothing reporting a problem.

The replacement names no number and enumerates no surface, so it cannot be
falsified by the next consumer added: it describes `highlightFields` as the
object's most important fields, in display order, taken by each surface up to the
room it has. Both locales change together, so a Chinese-UI author is not left
sizing lists to a cap that was never there.

The underlying inconsistency — eight consumers, five caps, one of them baked into
a published export signature — is tracked separately in objectui#8824 and is
deliberately NOT changed here.
