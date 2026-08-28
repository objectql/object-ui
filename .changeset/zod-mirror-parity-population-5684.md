---
---

Test-infrastructure only, no shipped code touched: the derived anti-drift parity
construction that objectui#5680 built for `BaseSchema` now covers every hand-written
zod mirror in `@object-ui/types`'s `src/zod/` directory instead of that one schema.

A mirror restates a TypeScript declaration by hand, and when the declaration widens
and the mirror does not follow, the published validator refuses a spelling the
published types invite — `declared !== enforced` on a shipped surface. Two instances
were found independently before anything looked for them (objectui#4605, #5186);
nothing detected the class itself.

`packages/types/src/__tests__/zod-mirror-parity.test.ts` registers 164 mirror/declaration
pairs and applies one construction to all of them: it reads each mirror's own `.shape`
and compares every key against the declaration, so a widening that forgets a mirror
turns red with no key list to maintain. A runtime census reads the directory off disk
and fails when an exported const is in neither the registry nor the reasoned exclusion
list, so a mirror added later cannot join the population silently. 18 pairs carry
measured drift today and are pinned to their exact drifted key sets as a ratchet — new
drift fails, and so does a stale entry once the drift is fixed.

`base-schema-zod-mirror-parity.test.ts` keeps its objectui#4605 runtime pins and no
longer restates the type-level construction; `BaseSchema` is one registered row.
