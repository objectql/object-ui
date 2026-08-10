---
"@object-ui/components": patch
---

`action:bar` member actions declaring `visible: false` are now hidden instead of rendered

`action:button` and `action:icon` carried the same truthiness gate objectui#3812
removed from the member-action leaves — `if (schema.visible && !isVisible)
return null` — so `visible: false`, the most explicit way an author can say
"never show this", fell into the "no gate declared" branch and the action
rendered anyway.

objectui#3812's triage judged the five component-level `schema.visible` gates a
dormant defensive layer, because `packages/react`'s `SchemaRenderer` evaluates
`newSchema.visible !== undefined` and hides the node before the component ever
mounts. Two of the five are not dormant, and this is the difference:

`action:bar` does not route through `SchemaRenderer`. It resolves each member's
renderer from the `ComponentRegistry` itself and spreads the whole member action
onto that renderer's schema, so an author's `visible` on a member arrives as the
child's own `schema.visible` and lands on the child's gate. `action:bar` is also
the only gate on that path by design — its `filteredActions` deliberately
filters on `requiredPermissions` and `actionRendersAt` only, leaving `visible` to
the member renderer. The path is reachable end-to-end and is now pinned that way
(registry-mounted `action:bar`, member declaring `visible: false`), so the
reachability does not have to be argued again.

Both gates now read the same named definition as the rest of the family,
`hasDeclaredVisibilityGate` (`!= null && !== ''`) — the invariant objectui#3492
established for the selection bar and objectui#3758 applied to the row-action
surfaces. The evaluation entry is untouched and already short-circuits a boolean
rather than handing it to the CEL engine, which `actionPredicate.parity` pins for
both the engine and the renderer path.

Behaviour change surface, deliberately narrow: only an `action:button` /
`action:icon` whose `visible` is the literal boolean `false` (or another falsy
non-empty value) changes — from rendered to hidden, which is what the
declaration asked for. `visible: true` still renders, `''` and an absent
`visible` are still no gate at all, and no expression-valued `visible` changes
verdict. `ActionSchema.visible` is `ExpressionInputSchema` with no boolean
member, so `objectstack build` cannot emit this shape; hand-written view JSON and
in-process callers constructing action defs can.

The remaining three component-level gates (`action:group`, `action:menu`,
`action:bar`'s own) stay as they are — they only ever mount through
`SchemaRenderer`, which resolves `visible` first, and the overflow `action:menu`
that `action:bar` synthesizes carries no `visible` at all.
