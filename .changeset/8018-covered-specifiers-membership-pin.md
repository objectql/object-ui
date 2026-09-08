---
---

Pin every member of `check-vi-mock-inherit.mjs`'s `COVERED_SPECIFIERS` against
removal, in both directions (objectui#8018). The gate's header declares the set
GROW-ONLY, but `findCallSites` classifies by membership: dropping a member made
its call sites `unjudged` rather than red. Measured on `86ef0c764` by dropping
each of the 21 members in turn — 18 left the guard's whole suite green, 384
judged call sites among them. Test only; no package is released by this change.
