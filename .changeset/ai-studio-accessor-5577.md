---
'@object-ui/app-shell': patch
---

`features.aiStudio` is now read through one `isAiStudioEnabled()` accessor instead
of being spelled inline at two call sites (objectui#5577).

`features.marketplace` already had a documented accessor whose docblock is where the
fail-open doctrine is written down — *"Fails OPEN (`!== false`): a runtime predating
`/api/v1/runtime/config`, or one whose config fetch failed, keeps the default `true`"*,
plus the "never infer this from the shape of a failure" warning. `features.aiStudio`
had no such sibling: `ChatDock` read `getRuntimeConfig().features.aiStudio !== false`
and `HomePage` read `getRuntimeConfig().features?.aiStudio !== false`, so one doctrine
had two spellings and neither reader could cite it.

The two spellings were not equivalent. `ChatDock`'s omitted the optional chain, and
against a runtime-config snapshot whose `features` is absent that read is a TypeError
rather than a fail-open — the exact shape that crashed 29 tests across four suites in
PR #5575 before it was corrected. Measured here: no live path can currently deliver
such a snapshot to `ChatDock` (the module's singleton constructs `features` on every
write and exports no setter, and no suite mounts the dock's default body under a
partial stand-in), so this closes a reachable-by-construction crash rather than a live
one — and it closes it at the source by leaving no inline read to get wrong.

`isAiStudioEnabled()` is an internal module export, matching `isMarketplaceEnabled()`:
neither is re-exported from `src/index.ts`, so the package's published `exports` surface
is unchanged.
