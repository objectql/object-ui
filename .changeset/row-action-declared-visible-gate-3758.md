---
"@object-ui/plugin-grid": patch
"@object-ui/components": patch
---

Row actions declaring `visible: false` are now hidden instead of rendered

A custom row action's visibility **gate** was detected by truthiness, so
`visible: false` — the most explicit way an author can say "never show this" —
fell into the "no gate declared" branch and the action rendered for every row.
Both surfaces of the ObjectGrid row cell (the "⋮" overflow item and the inline
`variant:'primary'` button) and the data-table's row overflow menu read the same
gate, so all three rendered it; the `#3562` emptiness guard counts with that same
gate, so a row whose only action was `visible: false` also grew a "⋮" it could
not fill.

The gate now detects a **declared** gate by `!= null && !== ''` and lets the
declaration itself decide — a boolean short-circuits to its own verdict rather
than being handed to the CEL engine. This is the invariant objectui#3492 already
established for the selection bar, whose `hasVisibilityGate` spells out why
truthiness cannot answer the question, and the same `!= null` posture the
built-in `visibleWhen` gate has always had. `visible: true` still renders,
`''` and an absent `visible` are still no gate at all, and no expression-valued
`visible` changes verdict.

Behaviour change surface, deliberately narrow: only an action whose `visible` is
the literal boolean `false` (or another falsy non-empty value) changes — it goes
from rendered to hidden, which is what the declaration asked for.
`ActionSchema.visible` is `ExpressionInputSchema` with no boolean member, so
`objectstack build` cannot emit this shape; hand-written view JSON and
in-process callers constructing defs can, and did. The three row surfaces now
reach the same verdict as the selection bar and the record page header for every
non-expression shape, which `predicate-surface-parity` pins.
