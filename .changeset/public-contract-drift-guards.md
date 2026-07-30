---
"@object-ui/sdui-parser": minor
"@object-ui/console": patch
---

feat(sdui): guard the public contract against silent drift — coverage test + manifest lazy-stub assertion

Follow-up to objectui#2953. That bug — every lazily-registered public block
missing from the contract, and so from every `kind:'react'` page's scope —
survived because nothing compared `PUBLIC_BLOCKS` against what an app actually
registers. Type-check, lint, build and the whole suite stayed green while seven
curated blocks were unusable. Two guards close that class.

**Console ↔ contract coverage.** `apps/console/src/register-plugins.ts` extracts
the plugin registration out of `main.tsx` so it can be imported without booting
the app. A new `apps/console/src/__tests__/public-contract.test.ts` reads that
real list and pins, as exact lists, which curated tags the console exposes (35),
which are still unimplemented (`line_items`), and which reach the contract
through a pending lazy stub. Exact lists rather than `toContain`, because the
failure mode is a *shrinking* contract. Reverting the #2953 fix drops coverage
from 35 to 28 and fails all four assertions.

**Manifests must be generated from loaded registrations.** New exported
`assertFullyLoaded(configs)` in `@object-ui/sdui-parser`, plus `lazy?: boolean`
on `RegistryConfigLike`. A lazy stub carries metadata but no `inputs`, so it
would be written into `sdui.manifest.json` as a block that takes no props —
making every prop an author passes it an `unknown-prop` diagnostic in the save
gate. Both generators now assert instead: `gen-manifest.ts` throws, and
`dev/manifest-dump.tsx` also imports the console's real registration list, so a
plugin the console lazy-registers but the dump forgets to import eagerly is
caught rather than silently emitted propless. `scripts/dump-public-manifest.mjs`
surfaces that failure instead of timing out for 120s with no message.

Also documents `object-chart` as a seventh block affected by objectui#2953 —
the issue listed six.
