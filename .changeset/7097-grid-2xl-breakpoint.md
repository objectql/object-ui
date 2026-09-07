---
'@object-ui/components': patch
---

`ui:grid` renders the `2xl` breakpoint its `columns` map has always accepted
(objectui#7097).

`columns: { xs: 1, '2xl': 6 }` type-checked, passed `GridSchema`'s zod mirror, emitted
**no class**, and rendered at the `xs` count on every screen — no error, no warning.
Measured through a real `SchemaRenderer` render:

| authored `columns` | before | after |
|---|---|---|
| `{ xs: 1, '2xl': 6 }` | `grid grid-cols-1 gap-4` | `grid grid-cols-1 2xl:grid-cols-6 gap-4` |
| `{ xs: 1, xl: 5 }` | `grid grid-cols-1 xl:grid-cols-5 gap-4` | unchanged |
| `4` | `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4` | unchanged |

`2xl` is a full member of the repo's breakpoint vocabulary everywhere else —
`BreakpointName` in `@object-ui/types`, `BREAKPOINTS` / `BREAKPOINT_ORDER` in
`@object-ui/mobile`, `BreakpointColumnMap` in `@object-ui/layout`, whose
`ResponsiveGrid` already emits `2xl:grid-cols-*`. Only this consumer stopped at five.

**The drop was in two layers, and both are fixed.** `grid.tsx` had neither a `2xl` read
arm nor a `GRID_COLS_2XL` static class map. Adding the read arm alone would have
produced a class name Tailwind never compiles — Tailwind v4 finds utilities by scanning
source text, so a `2xl:grid-cols-${n}` assembled at runtime is not a utility that
exists, and the node would have rendered unstyled while a unit test went green. The
twelve literal class strings are what make the class real; measured against the
package's own Tailwind build, the `2xl:grid-cols-*` rules go from **0 to 12** in the
compiled stylesheet, with the twelve `xl:grid-cols-*` rules unchanged as the control.

Nothing that rendered before renders differently: the other five tiers, the bare-number
mobile-first ramp, and the designer's flat `smColumns`…`xlColumns` channel are
unchanged.
