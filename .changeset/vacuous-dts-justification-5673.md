---
'@object-ui/core': patch
---

Withdraw the entry-surface justification on core's `SchemaNode` re-export, and put
the gauge that can actually fail in its place (objectui#5673).

`packages/core/src/types/index.ts` carried, as the justification for the #4580
re-export convergence, *core's own entry surface is unchanged (`dist/index.d.ts` is
byte-identical across the change — measured, both rounds)*. The reading was real and
it certified nothing. `core/dist/index.d.ts` is emitted from a barrel that only
FORWARDS the symbol, and forwarding never restates a shape — not `export *`, and not
the `export type { … }` line that names this one. Only the module that DECLARES the
symbol can move, so that file is byte-identical under any change to a re-exported
declaration's shape, and it could not have failed for the change class it was quoted
against.

Measured for this change rather than argued. One optional key was injected into
`BaseSchema` — the shape `SchemaNode` publishes — both packages were rebuilt from a
cleared `dist/` and a cleared `tsconfig.tsbuildinfo`, then the probe was dropped and
both rebuilt again:

| emitted file | base | with probe | probe dropped |
|---|---|---|---|
| `@object-ui/types` `dist/base.d.ts` — declares the shape | `31b5a01d…` | `8487500e…` **moved** | `31b5a01d…` |
| `@object-ui/core` `dist/types/index.d.ts` — forwards it | `0e64c8c6…` | `0e64c8c6…` | `0e64c8c6…` |
| `@object-ui/core` `dist/index.d.ts` — entry barrel, names it | `5cca207a…` | `5cca207a…` | `5cca207a…` |

The corrected block states that calibration as a recipe with its failure mode, so the
next reader inherits a gauge that can be checked instead of a sentence that cannot.
The `ComponentRendererProps` block below it already reached the right verdict, but
gave a narrower reason for it — that core's entry is an `export *` barrel — which is
not the mechanism, and is wrong for a symbol the barrel names on its
`export type { … }` line; it now states the forwarding rule.

Documentation only, in a published declaration file: these docblocks sit on export
specifiers, so `core/dist/types/index.d.ts` carries them into the tarball, while
`core/dist/index.d.ts` does not move for them either — the same insensitivity,
demonstrated once more on this very change. No type moves and no runtime behaviour
changes.
