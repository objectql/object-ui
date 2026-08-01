---
"@object-ui/app-shell": patch
---

Say what the Decision inspector actually does: the default path is the edge marker, not the branch.

Two help strings described mechanisms the engine does not have.

The **Branches** editor said a branch whose expression is `"true"` *is* the
default/else path. It is how you **ask** for one — `FlowEdgeInspector.applyBranch()`
turns such a branch into `isDefault: true` on the out-edge it wires, and the marker
on that edge is what routes. Conflating the two is the reading that let
objectstack-ai/objectstack#4414 ship a decision whose guard did not guard, and it is
worth being exact about now that `isDefault` is finally enforced: the key had **zero
readers** in the engine until then, so this designer had been writing a marker
nothing honoured, and every Studio "default/else" edge ran unconditionally alongside
whichever branch matched. The help also now states that branches are tried in order
and that the expression is bare CEL — a braced predicate there is a build failure
since objectstack-ai/objectstack#4439.

The legacy single **Condition** field said *"Prefer Branches above"*, which reads as
"this works, but the other is better". It does not work at all: the decision executor
never reads `config.condition`. The engine honours that key only on a Start node, as
the trigger gate, and `os validate` now reports it as `flow-inert-node-condition`.
The field stays render-only (its `__legacy__` controller never matches, so it is not
offered for new authoring) so a stored value is not invisible — but the help says it
is inert and where the predicate belongs instead.

Text only; no behaviour change on this side.
