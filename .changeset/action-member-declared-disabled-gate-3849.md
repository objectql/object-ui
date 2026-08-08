---
"@object-ui/components": patch
"@object-ui/plugin-detail": patch
---

`disabled: ''` no longer greys out the remaining five action surfaces (objectui#3849)

objectui#3842 / PR #3851 fixed the "is a `disabled` gate DECLARED?" test on
`action:button` and app-shell's `DeclaredActionsBar`. Five same-shaped sites were
outside that PR's scope and stayed on `!= null`, so within one component the
`visible` gate asked `hasDeclaredVisibilityGate` while the `disabled` gate on the
next line asked `!= null` — two spellings of one question:

- `@object-ui/components` — `action:icon`, `action:group`'s inline button
  (`InlineActionButton`) and dropdown item (`DropdownActionItem`), and
  `action:menu`'s item (`ActionMenuItem`).
- `@object-ui/plugin-detail` — `record:quick_actions`' `QuickActionButton`.

Why the missing `!== ''` half is a defect on this key and not on `visible`:
`toPredicateInput('')` is `undefined` and `evaluateCondition(undefined)` is
`true`. On `visible` that `true` means SHOW, so an over-broad "declared" test and
a permissive empty predicate cancel out. On `disabled` it means DISABLE, so they
compound — `disabled: ''` (an empty predicate: nothing declared) rendered a
permanently greyed-out control, with nothing the author could write to un-grey
it. Unlike #3842's approvals inbox, these five are the general action face
(toolbars, dropdowns, record quick actions), so the reach is wider even though no
single high-value host owns them.

**Behaviour change surface, deliberately narrow.** Only `disabled: ''` changes —
from disabled to clickable, which is what "no predicate" asked for. `disabled:
true` still disables, `disabled: false` and an absent `disabled` still do not, and
no expression-valued `disabled` changes verdict. On the four sites that also carry
the legacy non-spec `enabled` fallback, one consequence follows: an empty
`disabled` now falls THROUGH to that leg instead of short-circuiting on the empty
predicate, so an action spelling both (`disabled: ''` + `enabled: true`) becomes
clickable. `record:quick_actions` has no `enabled` leg, so its chain is the single
gate.

Routing those legacy `enabled` legs through the same definition is
behaviour-preserving by derivation rather than a fix: the leg is negated
(`disabled = !isEnabled`), so an empty predicate's `true` already arrived as "not
disabled" — the verdict "no gate declared" produces. #3842's four-shape derivation
table is reproduced next to the new pins, together with the statement that no
`enabled` case can go red by reverting that leg.

`hasDeclaredVisibilityGate` keeps its historic name (the objectui#3842 ruling): the
predicate is key-neutral, and one implementation behind two names is how a repo
grows dialects. The three `@object-ui/components` sites import it relatively;
`record:quick_actions` takes it from the package barrel, the cross-package route
objectui#3835 opened. Every call site says so in a comment.
