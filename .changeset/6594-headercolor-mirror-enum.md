---
'@object-ui/types': minor
---

`DetailViewSection.headerColor` is now the closed six-token vocabulary on both halves of
the contract — the TypeScript declaration and the `@object-ui/types/zod` mirror — instead of
`string` / `z.string()` (objectui#6594, maintainer ruling A of 2026-08-26 recorded at
objectstack#12126). The six are `muted`, `muted/50`, `accent`, `primary/10`, `secondary/10`
and `destructive/10`: exactly what `@object-ui/plugin-detail`'s `HEADER_COLOR_CLASSES`
resolves (objectui#6178) and exactly what `@objectstack/spec` declares on its strict
`record:details` section schema (objectstack PR #12616).

## ⚠️ Accept-set narrowing — these spellings stop validating

`DetailViewSectionSchema.headerColor` was `z.string().optional()`, so **any string parsed
green** while the renderer contributed no class for most of them. It is now
`z.enum([...]).optional()`: a value outside the six is refused at parse time with
`headerColor` named in the error path, and is a `tsc` error at every authoring site typed
against `DetailViewSection`.

**Authored metadata in this repo needs no migration.** Measured before tightening, across
the whole tracked tree: `headerColor` occurs in **ten files, none of them authored
metadata** — the renderer and its tests, the two declaration files changed here, and two
markdown notes. `examples/`, `content/`, `apps/`, `e2e/` and `docs/` contain **zero**
occurrences (positive control: `sections` and `detail-view` both hit in those directories,
so the census reached them). Nothing in the repo authors a value outside the six.

## The renderer's `bg-*` pass-through is deliberately NOT declared

`headerColorClass` also hands a value that is already a complete `bg-*` class through
untouched. Ruling A rejected declaring that (option B, "the capability illusion"): whether
such a class renders depends on the host app's Tailwind build, so declaring it would promise
a capability the contract cannot keep. It stays a renderer affordance — still supported by
the renderer, never invited by the contract. The three renderer tests that exercise
off-contract values (`bg-accent`, `not-a-token`, `constructor`) now route them through a
documented `offContract()` seam in `DetailSection.headerColor.test.tsx`, which is the visible
consequence of the narrowing rather than a workaround for it: metadata still arrives as JSON
over the wire, where no compiler was involved, so the renderer must keep behaving sanely.

## The three ends cannot drift

`packages/plugin-detail/src/__tests__/headerColor.contractPin-6594.test.ts` pins the resolver,
the TypeScript declaration and the zod mirror against the ruled vocabulary — the resolver's
key set one-to-one at runtime, the declaration by invariant type equality, the mirror by
reading its own enum options. It fails in **both** directions: a seventh token on any one end,
or one of the six dropped from any one end, turns it red, and the comparator itself is pinned
against synthetic inputs so the guard has been shown to fail rather than only to pass.

## Shape, and where it departs from the nearest precedent

The nearest precedent is objectui#5853 (`.changeset/5853-tablecolumn-type-canonical-union.md`),
which narrowed `TableColumn.type` on the same three-ends pattern and **exported** a
`TABLE_COLUMN_TYPES` tuple for the zod mirror to build its enum from. That shape is not
available here and the difference is structural, not a preference: `packages/types/src/views.ts`
is a **type-only** module, so a tuple there would add a runtime export to the package barrel
(a value export cannot ride the barrel's `export type` block) and a runtime import edge from
the zod entry into `views.js`. #5853 had a second reason to export — producers needed its
`normalizeTableColumnType()` at their emit seam — and `headerColor` has no producer that needs
a runtime value. The literals are therefore written on each half and the anti-drift guarantee
is carried by the pin above, which also covers the third end a shared tuple could not reach:
the renderer, in a package `@object-ui/types` must not depend on.
