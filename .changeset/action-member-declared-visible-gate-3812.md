---
"@object-ui/components": patch
---

Action-face member actions declaring `visible: false` are now hidden instead of rendered

The three member-action gates on the action face asked truthiness —
`if (action.visible && !isVisible) return null` — so `visible: false`, the most
explicit way an author can say "never show this", fell into the "no gate
declared" branch and the action rendered anyway:

- `action:group` in `display: 'inline'` mode (`InlineActionButton`);
- `action:group` in `display: 'dropdown'` mode (`DropdownActionItem`);
- `action:menu`'s items (`ActionMenuItem`).

These leaves `.map()` the component's own `actions` array, so neither
`SchemaRenderer`'s node-level `visible` handling nor
`ActionEngine.getActionsForLocation` (whose boolean `visible` was always
correct) is in the path — the truthy gate was the only gate.

All three now read one named definition, `hasDeclaredVisibilityGate`
(`!= null && !== ''`), and let the declaration itself decide. This is not a new
decision: objectui#3492 established the invariant for the selection bar, whose
`hasVisibilityGate` spells out why truthiness cannot answer the question, and
objectui#3758 applied it to both row-action surfaces. The evaluation entry is
untouched and already short-circuits a boolean rather than handing it to the CEL
engine, which `actionPredicate.parity` pins for both the engine and the renderer
path.

Behaviour change surface, deliberately narrow: only a member action whose
`visible` is the literal boolean `false` (or another falsy non-empty value)
changes — from rendered to hidden, which is what the declaration asked for.
`visible: true` still renders, `''` and an absent `visible` are still no gate at
all, and no expression-valued `visible` changes verdict.
`ActionSchema.visible` is `ExpressionInputSchema` with no boolean member, so
`objectstack build` cannot emit this shape; hand-written view JSON and
in-process callers constructing action defs can.
