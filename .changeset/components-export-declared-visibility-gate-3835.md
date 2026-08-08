---
"@object-ui/components": patch
---

Export `hasDeclaredVisibilityGate` from the package barrel (objectui#3835)

`hasDeclaredVisibilityGate(visible)` — "did this action DECLARE a visibility gate
at all?", i.e. `!= null && !== ''`, with the verdict left to the evaluation entry
— is the single definition objectui#3492 established and PR #3816 / #3825 / #3836
applied to every member-action gate in this package and in `@object-ui/plugin-grid`.
It lived module-private in `src/renderers/action/visibility-gate.ts`.

The family turned out to have a member outside these packages:
`@object-ui/app-shell`'s `DeclaredActionsBar` gates server-declared actions with
the same question and had the same truthiness bug (objectui#3835). Exporting the
one definition is what keeps that fix from becoming a fifth hand-spelled copy of
it — the drift shape objectui#3142 already had to unpick for `locations` in these
same files.

Additive only: one `export` line, no behaviour change in this package. The
function is pure and dependency-free.
