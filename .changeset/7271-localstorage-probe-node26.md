---
---

Repair the test-environment storage globals so a `Storage.prototype` instrument
cannot go silently blind on a newer Node (objectui#7271). Test only; no package
is released by this change.

From Node 26 the experimental Web Storage globals are on by default, and
Vitest's `populateGlobal` copies happy-dom's `Storage` class but not its
`localStorage`/`sessionStorage` — so the class and the stores came from two
different implementations, and instrumentation of `Storage.prototype` observed
nothing. `vitest.setup.base.ts` now states the rule positively (in a DOM
environment every storage global is that environment's own `Storage`) and
verifies it, and `anonSeedScope-5746.enumeration.test.tsx` names the failure
mode instead of reporting seven anonymous zeros.
