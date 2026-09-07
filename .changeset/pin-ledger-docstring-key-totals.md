---
---

Test-only change to `@object-ui/types`' zod-mirror-parity pin file. Both LEDGER
DOCSTRINGS — above `interface UnmirroredDeclared` and above `interface
RuntimeOnlyDeclared` — stated that ledger records **94 keys**; two independent
instruments measure **87**, wrong since objectui#7779 and fully green the whole time
(objectui#8243). Those two live figures are corrected and are now derived from the
ledger through the docstrings' own spelling. The stale decomposition beside them
(`94 − 1 seeded + 3 mirrored + 2 retired + 23 reclassified`) needs key provenance no
ledger here records, so instead of being refreshed or deleted it is rewritten as a
reading at NAMED REVISIONS — 98 keys at `beccf1c6b`, of which 85 survive and 13 have
left at `ed7178bf3` — which cannot rot and needs no hand re-derivation at the next
repair. The measured 13 and the prose-derived 10 / 3 split of it are kept visibly
apart. No published behaviour changes.
