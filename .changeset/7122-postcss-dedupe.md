---
---

Dev-time only: collapse the `postcss` duplicate this branch's first lockfile
bump introduced (objectui#7122).

`aabc527cb` resolved `@objectstack/spec` to 17.3.0 and, as a side effect of that
install, re-resolved `autoprefixer`'s auto-installed `postcss` peer to 8.5.28
while `@tailwindcss/postcss` kept 8.5.26. `@object-ui/cli` depends on both and
declares `postcss` itself, so its type-check program held TWO postcss copies
with two structurally distinct `Plugin` types — and comparing
`Plugin & ExportedAPI` against `Plugin` across them exceeded the compiler's
instantiation budget: `TS2321: Excessive stack depth`, in a file this branch
never touched. `origin/main` carries one copy for that pair and is green.

The split is resolved in the lockfile only. All eight manifests that declare
`postcss` already declare `^8.5.26`, which admits 8.5.28, so no declared range
moved and no published dependency declaration differs by a byte. Empty
frontmatter is the deliberate "no release" declaration.
