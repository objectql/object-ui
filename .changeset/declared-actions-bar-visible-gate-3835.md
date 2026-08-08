---
"@object-ui/app-shell": patch
---

Server-declared actions declaring `visible: false` are now hidden instead of rendered as live buttons (objectui#3835)

`DeclaredActionsBar` — the bar that renders an object's SERVER-declared actions
for one record at a `location`, with no per-action host code — asked truthiness
on the gate: `if (action.visible && !isVisible) return null`. `false && …` is
falsy, so `visible: false`, the most explicit way an author can say "never show
this", fell into the "no gate declared" branch, the verdict was never consulted,
and the action rendered for everyone.

What that means on the page: the bar's host is the approvals inbox's
record-section toolbar (`apps/console/src/pages/system/ApprovalsInboxPage.tsx`),
so an approval action the metadata had switched off with `visible: false`
rendered as a live Approve / Reject / Reassign button — and this component's own
click handler is what POSTs the decision. One click was a real approve/reject
call on a request the declaration said not to offer a decision on.

This is the fifth and last member of the objectui#3492 family (after
objectui#3758 / PR #3816 for the row-action surfaces and objectui#3812 / #3823
for the action face), and the one whose two family-wide mitigations both fail:

- The action defs are **server-declared** (`objectDef.actions[]`,
  `sys_approval_request`), not hand-written view JSON. "`ActionSchema.visible` is
  `ExpressionInputSchema` with no boolean member, so `objectstack build` cannot
  emit this shape" does not apply on this path — the def arrives from server
  metadata and in-process construction, where a boolean is the natural spelling.
- The bar is mounted as **plain JSX** by its hosts, so `packages/react`'s
  `SchemaRenderer` — which evaluates a node's `visible` and hides it before the
  component mounts, and which is why objectui#3812 judged the component-level
  gates a dormant defensive layer — is not on this path at all. This gate was the
  only one there.

The gate now reads the family's one named definition,
`hasDeclaredVisibilityGate` (`!= null && !== ''`), imported from
`@object-ui/components` rather than re-spelled: five gates in three packages
asking one question must not drift into five answers. The evaluation entry is
untouched — `toPredicateInput` passes a boolean through and `useCondition`
short-circuits it instead of calling the expression engine — so a declared
`false` resolves to `false`, and every expression-valued `visible` keeps exactly
the verdict it had.

Behaviour change surface, deliberately narrow: only a declared action whose
`visible` is the literal boolean `false` (or another falsy non-empty value)
changes, from rendered to hidden, which is what the declaration asked for.
`visible: true` still renders, `''` and an absent `visible` are still no gate at
all, and the bar still renders no chrome when its located set is empty.

The suite that covered this component could not have caught it: it stubbed the
whole predicate entry constant-true (`useCondition: () => true`), with a comment
saying the test actions omit `visible` "so this is unused" — which made the gate
unreachable from the only tests that mount this component (the objectstack#4984
family, where a fixture keeps a broken rule green). That stub is gone; the suite
now runs the real `useCondition` / `toPredicateInput` and doubles only the action
dispatch, so all four shapes (`false` hides / `true` renders / undeclared renders
/ `''` is not a gate) are judged by the shipped evaluation semantics.
