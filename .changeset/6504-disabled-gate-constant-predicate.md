---
'@object-ui/react': patch
---

Extends objectui#5687's adapter-only `data.*` constant-predicate diagnostic — a node-gate
predicate that evaluates perfectly, against the wrong object, because at the node tier
`data` is the data-source adapter, not the row — to the `disabled` / `disabledOn` gate
(objectui#6504, maintainer ruling 2026-08-27 option A).

A node written `{ "type": "button", "disabled": "data.status == 'locked'" }` evaluates
cleanly (no fault, so objectui#6445's fault reporter correctly stays silent), and on the
constant's other polarity (`data.locked == null`, `!data.assignee`, or an adapter that
answers nothing) hands the gate a constant `true` that greys the control out on every row,
in every build, with nothing on the console. This leg now names it, in development only —
option C (always-on) was excluded, outside the #5687 precedent.

The copy is new, not reused: the visibility leg's sentence ("a constant `false` hides the
node on every row") is written about the opposite polarity and would be false on this gate.
The enablement leg's own sentence names the constant-`true` direction — the control renders
DISABLED, greyed out, indistinguishable from a gate the author meant to close.

Both legs carry the same dissolution pointer: this diagnostic — visibility AND enablement
together — dissolves when objectui#5330's `data.*` deprecation window closes.

Dev-only, no verdict change, no interpolation change, no published type widened (the new
`AdapterOnlyPredicateGateKind` type and the new prefix constant are module-internal, not
re-exported from the package entry — matching objectui#5687's own symbols, which never were
either).
