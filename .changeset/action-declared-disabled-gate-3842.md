---
"@object-ui/app-shell": patch
"@object-ui/components": patch
---

An action declaring `disabled: ''` is no longer greyed out forever (objectui#3842)

The "is a `disabled` gate declared?" test stopped at `!= null`, missing the
`!== ''` half of the invariant the `visible` family converged on
(`hasDeclaredVisibilityGate`, objectui#3492 / #3758 / #3812 / #3823 / #3835). So
`disabled: ''` counted as a declared gate, and the verdict went to the evaluation
entry — which reads an empty predicate as "no condition → `true`"
(`toPredicateInput('')` is `undefined`, `evaluateCondition(undefined)` is `true`).

The direction is why this half is a defect and the `visible` half was not. On
`visible`, that `true` means SHOW, so an over-broad "declared" test and a
permissive empty predicate cancel out and `visible: ''` renders either way. On
`disabled`, the same `true` means DISABLE — the two mistakes compound, and an
empty predicate stopped meaning "no gate" and started meaning "permanently
greyed out". One empty predicate, opposite treatment under two keys.

Two gates now ask the shared definition instead:

- `@object-ui/app-shell`'s `DeclaredActionsBar` — the hot one. Its actions are
  SERVER-declared (`objectDef.actions[]`) and its hosts are the approvals inbox's
  record sections, so a `disabled: ''` arriving from metadata (an authoring form
  left empty, a template that rendered to an empty string) produced an Approve /
  Reject button nobody could click, indistinguishable from deliberate metadata.
  objectui#3835 was this same surface failing the other way.
- `@object-ui/components`' `action:button` — verified to be the same shape before
  it was changed (the issue inferred it from the identical spelling but did not
  probe it): with `disabled: ''` the rendered button carried `disabled=""`.

**Behaviour change surface, deliberately narrow.** Only `disabled: ''` changes —
from disabled to clickable, which is what "no predicate" asked for. `disabled:
true` still disables, `disabled: false` and an absent `disabled` still do not, and
no expression-valued `disabled` changes verdict. One consequence worth naming: on
`action:button`, an empty `disabled` now falls THROUGH to the legacy non-spec
`enabled` fallback instead of short-circuiting on the empty predicate, so an
action spelling both (`disabled: ''` + `enabled: true`) becomes clickable.

The legacy `enabled` leg of `action:button` was routed through the same
definition for consistency, and that part is behaviour-preserving by derivation
rather than a fix: the leg is negated (`disabled = !isEnabled`), so an empty
predicate's `true` already arrived as "not disabled" — the same verdict "no gate"
produces. All four shapes are identical under either test; the derivation table
and the reason no test can distinguish them are written down next to the pins.

`hasDeclaredVisibilityGate` keeps its historic name at both call sites (the
objectui#3842 dispatch ruling): the predicate is key-neutral, and one
implementation behind two names is how a repo grows dialects. Each call site says
so in a comment.
