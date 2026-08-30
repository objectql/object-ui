---
---

Makes the `button` entry in `scripts/container-declaration-baseline.json` a **permanent,
reasoned exception** instead of a provisional one, executing objectui#6804's maintainer
ruling (2026-08-30). objectui#6779 had excluded `button` from the ratchet-to-zero list
"pending a separate card"; that card has now been ruled, and the exclusion stands: `button`
does not declare `isContainer`.

The entry's `reason` now carries the ruling's ground rather than a forward reference —
`isContainer` means layout containment, not "this tag renders children", and `button` reads
`schema.children` only as a fallback for `schema.label`, so declaring it would make one
predicate mean two things and would delete the `Button` identifier from the JSX scope of
every `kind:'react'` page, against zero measured pull the other way. Its owning `issue`
moves from `objectui#6779` (which deferred the question) to `objectui#6804` (which answered
it), with the provenance kept in the reason.

This matters because an exception with no recorded ground is indistinguishable from a
missed one, and that indistinguishability is the mechanism behind this defect class's three
independent rediscoveries (objectui#3900 / objectui#6740 / objectui#6764).

Also records a measurement the note previously implied away: `button` is the only public
tag among the 45 violations listed, but not the only public tag in the containment story —
ADR-0080's `PUBLIC_BLOCKS` carries `badge` and `alert` as bare keys too, so of the 14 tags
the ruling covers, three are published contract. The 11 bare `sidebar-*` keys are not (the
public sidebar is the namespaced `page:sidebar`, which already declares `isContainer`).

Ledger and test prose only. No published behaviour changes, no registration's metadata is
altered, and every assertion that keeps the exception honest is unchanged.
